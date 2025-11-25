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

    // Отправляем WebSocket событие о новом сообщении
    this.websocketService.emitToChat(chatId, 'message:new', message);
    this.websocketService.emitToUser(userId, 'chats:update', {});

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

    return chat;
  }
}
