import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { WebSocketService } from '../ws/websocket.service';

@Injectable()
export class ChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketService: WebSocketService,
  ) {}

  listChatsForUser(userId: string) {
    return this.prisma.chat.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: { include: { user: true } },
        lastMessage: { include: { sender: true } },
        event: {
          include: {
            organizer: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listMessages(userId: string, chatId: string) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });

    if (!participant) {
      throw new ForbiddenException('Access denied to chat messages');
    }

    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: true,
      },
    });
  }

  async createMessage(userId: string, chatId: string, dto: CreateMessageDto) {
    const message = await this.prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        content: dto.content,
        eventId: dto.eventId,
      },
      include: {
        sender: true,
      },
    });

    await this.prisma.chat.update({
      where: { id: chatId },
      data: {
        lastMessageId: message.id,
        updatedAt: new Date(),
      },
    });

    // Отправляем WebSocket событие о новом сообщении всем участникам чата
    this.websocketService.emitToChat(chatId, 'message:new', message);
    
    // Отправляем обновление списка чатов всем участникам чата
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
          select: { userId: true },
        },
      },
    });
    
    if (chat) {
      const participantIds = chat.participants.map(p => p.userId);
      this.websocketService.emitToUsers(participantIds, 'chats:update', {});
    }

    return message;
  }

  async createEventChat(userId: string, eventId: string, participantIds: string[]) {
    // Проверяем, существует ли уже чат для этого события
    const existingChat = await this.prisma.chat.findUnique({
      where: { eventId },
      include: {
        participants: true,
      },
    });

    if (existingChat) {
      // Если чат существует, добавляем участников, которых еще нет
      const existingParticipantIds = new Set(
        existingChat.participants.map(p => p.userId)
      );
      
      const newParticipants = participantIds.filter(id => !existingParticipantIds.has(id));
      
      if (newParticipants.length > 0) {
        await this.prisma.chatParticipant.createMany({
          data: newParticipants.map(participantId => ({
            chatId: existingChat.id,
            userId: participantId,
          })),
          skipDuplicates: true,
        });
      }

      return this.prisma.chat.findUnique({
        where: { id: existingChat.id },
        include: {
          participants: { include: { user: true } },
          lastMessage: { include: { sender: true } },
          event: {
            include: {
              organizer: true,
            },
          },
        },
      });
    }

    // Создаем новый чат
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { organizer: true },
    });

    if (!event) {
      throw new ForbiddenException('Event not found');
    }

    // Проверяем, что пользователь является участником события
    const membership = await this.prisma.eventMembership.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });

    if (!membership || membership.status !== 'ACCEPTED') {
      // Проверяем, является ли пользователь организатором
      if (event.organizerId !== userId) {
        throw new ForbiddenException('Only event participants can create event chat');
      }
    }

    const chat = await this.prisma.chat.create({
      data: {
        type: 'EVENT',
        eventId,
        name: `${event.title} - ${new Date(event.startTime).toLocaleDateString()}`,
        participants: {
          create: participantIds.map(participantId => ({
            userId: participantId,
          })),
        },
      },
      include: {
        participants: { include: { user: true } },
        event: {
          include: {
            organizer: true,
          },
        },
      },
    });

    return chat;
  }

  async createPersonalChat(userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new ForbiddenException('Cannot create chat with yourself');
    }

    // Проверяем, существует ли уже личный чат между этими пользователями
    const existingKey = await this.prisma.personalChatKey.findFirst({
      where: {
        OR: [
          { userAId: userId, userBId: otherUserId },
          { userAId: otherUserId, userBId: userId },
        ],
      },
    });

    if (existingKey) {
      // Возвращаем существующий чат
      return this.prisma.chat.findUnique({
        where: { id: existingKey.chatId },
        include: {
          participants: { include: { user: true } },
          lastMessage: { include: { sender: true } },
        },
      });
    }

    // Создаем новый личный чат
    const chat = await this.prisma.chat.create({
      data: {
        type: 'PERSONAL',
        name: null, // Личные чаты не имеют имени
        participants: {
          create: [
            { userId },
            { userId: otherUserId },
          ],
        },
      },
      include: {
        participants: { include: { user: true } },
        lastMessage: { include: { sender: true } },
      },
    });

    // Создаем ключ для быстрого поиска
    await this.prisma.personalChatKey.create({
      data: {
        userAId: userId,
        userBId: otherUserId,
        chatId: chat.id,
      },
    });

    // Отправляем уведомление обоим участникам о создании нового чата
    this.websocketService.emitToUsers([userId, otherUserId], 'chats:update', {});

    return chat;
  }

  async deleteChat(userId: string, chatId: string, leaveEvent: boolean = false) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: true,
        event: true,
      },
    });

    if (!chat) {
      throw new ForbiddenException('Chat not found');
    }

    // Проверяем, что пользователь является участником чата
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });

    if (!participant) {
      throw new ForbiddenException('You are not a participant of this chat');
    }

    // Если это чат события и leaveEvent=true, выходим из события
    if (chat.type === 'EVENT' && chat.eventId && leaveEvent) {
      // Импортируем EventsService для выхода из события
      // Для этого нужно использовать dependency injection или вызвать через другой сервис
      // Пока оставляем логику выхода из события на клиенте
    }

    // Удаляем участника из чата
    await this.prisma.chatParticipant.delete({
      where: { chatId_userId: { chatId, userId } },
    });

    // Проверяем, остались ли участники в чате
    const remainingParticipants = await this.prisma.chatParticipant.findMany({
      where: { chatId },
    });

    // Если участников не осталось - удаляем чат полностью
    if (remainingParticipants.length === 0) {
      await this.prisma.$transaction(async (tx) => {
        // Удаляем все сообщения
        await tx.message.deleteMany({ where: { chatId } });
        // Удаляем все связи с папками
        await tx.folderChat.deleteMany({ where: { chatId } });
        // Удаляем ключ личного чата, если есть
        await tx.personalChatKey.deleteMany({ where: { chatId } });
        // Удаляем чат
        await tx.chat.delete({ where: { id: chatId } });
      });
    }

    // Отправляем WebSocket событие об обновлении чатов
    const allParticipantIds = chat.participants.map(p => p.userId);
    this.websocketService.emitToUsers(allParticipantIds, 'chats:update', {});

    return { success: true, chatDeleted: remainingParticipants.length === 0 };
  }
}
