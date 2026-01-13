import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { WebSocketService } from '../ws/websocket.service';

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketService: WebSocketService,
  ) {}

  async listChatsForUser(userId: string) {
    // ПРОСТАЯ ЛОГИКА: возвращаем ВСЕ чаты, где пользователь является участником ИЛИ организатором события
    // ЧАТЫ НИКОГДА НЕ УДАЛЯЮТСЯ - они остаются в списке всегда
    
    console.log(`[listChatsForUser] START: userId=${userId}`);
    this.logger.log(`[listChatsForUser] START: userId=${userId}`);
    
    // 1. Получаем все чаты, где пользователь является участником
    const chatsAsParticipant = await this.prisma.chat.findMany({
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
            memberships: {
              where: { userId },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // 2. Получаем все чаты событий, где пользователь является организатором ИЛИ участником события
    // Это гарантирует, что чаты остаются видимыми, даже если пользователь покинул чат
    // Сначала находим события, где пользователь является организатором
    const organizedEvents = await this.prisma.event.findMany({
      where: {
        organizerId: userId,
      },
      select: { id: true },
    });
    
    // Затем находим события, где пользователь является участником (через EventMembership)
    const participatedEvents = await this.prisma.eventMembership.findMany({
      where: {
        userId,
      },
      select: { eventId: true },
    });
    
    // Объединяем все eventId
    const allUserEventIds = [
      ...organizedEvents.map(e => e.id),
      ...participatedEvents.map(m => m.eventId),
    ];
    const uniqueEventIds = Array.from(new Set(allUserEventIds));
    
    console.log(`[listChatsForUser] Found ${organizedEvents.length} organized events, ${participatedEvents.length} participated events, total unique: ${uniqueEventIds.length}`);
    this.logger.log(`[listChatsForUser] Found ${organizedEvents.length} organized events, ${participatedEvents.length} participated events, total unique: ${uniqueEventIds.length}`);
    
    // Затем находим чаты для всех этих событий
    const eventChats = uniqueEventIds.length > 0 ? await this.prisma.chat.findMany({
      where: {
        type: 'EVENT',
        eventId: {
          in: uniqueEventIds,
        },
      },
      include: {
        participants: { include: { user: true } },
        lastMessage: { include: { sender: true } },
        event: {
          include: {
            organizer: true,
            memberships: {
              where: { userId },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }) : [];
    
    console.log(`[listChatsForUser] Found ${eventChats.length} event chats for ${uniqueEventIds.length} events`);
    this.logger.log(`[listChatsForUser] Found ${eventChats.length} event chats for ${uniqueEventIds.length} events`);
    if (eventChats.length > 0) {
      console.log(`[listChatsForUser] Event chat IDs: ${eventChats.map(c => c.id).join(', ')}`);
      this.logger.log(`[listChatsForUser] Event chat IDs: ${eventChats.map(c => c.id).join(', ')}`);
    }

    // 3. Объединяем и убираем дубликаты
    const allChats = [...chatsAsParticipant];
    const existingChatIds = new Set(chatsAsParticipant.map(c => c.id));
    
    // Добавляем событийные чаты, которых нет в списке участников
    eventChats.forEach(chat => {
      if (!existingChatIds.has(chat.id)) {
        allChats.push(chat);
      }
    });

    // Логируем для отладки
    console.log(`[listChatsForUser] FINAL: userId: ${userId}, uniqueEvents: ${uniqueEventIds.length}, chatsAsParticipant: ${chatsAsParticipant.length}, eventChats: ${eventChats.length}, total: ${allChats.length}`);
    this.logger.log(`[listChatsForUser] FINAL: userId: ${userId}, uniqueEvents: ${uniqueEventIds.length}, chatsAsParticipant: ${chatsAsParticipant.length}, eventChats: ${eventChats.length}, total: ${allChats.length}`);
    if (allChats.length > 0) {
      console.log(`[listChatsForUser] RETURNING chats: ${allChats.map(c => `${c.id} (eventId: ${c.eventId || 'N/A'})`).join(', ')}`);
      this.logger.log(`[listChatsForUser] RETURNING chats: ${allChats.map(c => `${c.id} (eventId: ${c.eventId || 'N/A'})`).join(', ')}`);
    } else {
      console.error(`[listChatsForUser] ERROR: Returning 0 chats but should have ${eventChats.length} event chats!`);
      this.logger.error(`[listChatsForUser] ERROR: Returning 0 chats but should have ${eventChats.length} event chats!`);
    }

    // Сортируем по дате обновления и возвращаем
    return allChats.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async listMessages(userId: string, chatId: string) {
    // Проверяем, является ли пользователь участником чата
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });

    // Если пользователь не участник, проверяем, является ли это событийным чатом,
    // и участвовал ли пользователь в событии
    if (!participant) {
      const chat = await this.prisma.chat.findUnique({
        where: { id: chatId },
        include: {
          event: {
            include: {
              memberships: {
                where: { userId },
              },
            },
          },
        },
      });

      // Если это событийный чат и пользователь участвовал в событии (или был организатором),
      // разрешаем доступ к сообщениям (даже если он покинул чат)
      if (chat?.type === 'EVENT' && chat.eventId && chat.event) {
        const isOrganizer = chat.event.organizerId === userId;
        const hasMembership = chat.event.memberships.length > 0;
        
        if (isOrganizer || hasMembership) {
          // Разрешаем доступ к сообщениям
        } else {
          throw new ForbiddenException('Access denied to chat messages');
        }
      } else {
      throw new ForbiddenException('Access denied to chat messages');
      }
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
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
          },
        },
        event: true,
      },
    });

    if (!chat) {
      throw new ForbiddenException('Chat not found');
    }

    // Проверяем, что пользователь является участником чата ИЛИ организатором/участником события
    const participant = chat.participants.find(p => p.userId === userId);
    
    console.log(`[deleteChat] userId: ${userId}, chatId: ${chatId}, participant found: ${!!participant}, chat type: ${chat.type}, eventId: ${chat.eventId}`);
    this.logger.log(`[deleteChat] userId: ${userId}, chatId: ${chatId}, participant found: ${!!participant}, chat type: ${chat.type}, eventId: ${chat.eventId}`);
    
    // Если пользователь не участник чата, проверяем, является ли он организатором или участником события
    let userName: string;
    if (!participant) {
      if (chat.type === 'EVENT' && chat.eventId) {
        const event = await this.prisma.event.findUnique({
          where: { id: chat.eventId },
          include: {
            memberships: {
              where: { userId },
            },
          },
        });
        
        // Разрешаем покинуть чат, если пользователь является организатором или участником события
        if (event && (event.organizerId === userId || event.memberships.length > 0)) {
          // Получаем имя пользователя из базы данных
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, username: true },
          });
          userName = user?.name || user?.username || 'Пользователь';
        } else {
          throw new ForbiddenException('You are not a participant of this chat');
        }
      } else {
      throw new ForbiddenException('You are not a participant of this chat');
      }
    } else {
      userName = participant.user.name || participant.user.username || 'Пользователь';
    }

    // Если это чат события и leaveEvent=true, выходим из события
    if (chat.type === 'EVENT' && chat.eventId && leaveEvent) {
      // Импортируем EventsService для выхода из события
      // Для этого нужно использовать dependency injection или вызвать через другой сервис
      // Пока оставляем логику выхода из события на клиенте
    }

    // Создаем системное сообщение о выходе из чата
    const systemMessage = await this.prisma.message.create({
      data: {
        chatId: chat.id,
        senderId: userId,
        content: `${userName} покинул(а) чат`,
      },
      include: { sender: true },
    });

    await this.prisma.chat.update({
      where: { id: chat.id },
      data: { lastMessageId: systemMessage.id, updatedAt: new Date() },
    });

    // Удаляем участника из чата (если он был участником)
    if (participant) {
    await this.prisma.chatParticipant.delete({
      where: { chatId_userId: { chatId, userId } },
    });
    }

    // Проверяем, остались ли участники в чате
    const remainingParticipants = await this.prisma.chatParticipant.findMany({
      where: { chatId },
    });

    // ЧАТ НИКОГДА НЕ УДАЛЯЕТСЯ - даже если не осталось участников
    // Это позволяет пользователям видеть историю и системные сообщения

    // Отправляем WebSocket события
    const remainingParticipantIds = chat.participants
      .filter(p => p.userId !== userId)
      .map(p => p.userId);
    
    // Для событийных чатов: отправляем обновление также покинувшему пользователю,
    // чтобы чат остался в его списке (он может видеть историю и системные сообщения)
    const allUserIdsToNotify = [...remainingParticipantIds];
    if (chat.type === 'EVENT' && chat.eventId) {
      // Проверяем, участвовал ли пользователь в событии (даже если покинул чат)
      const event = await this.prisma.event.findUnique({
        where: { id: chat.eventId },
        include: {
          memberships: {
            where: { userId },
          },
        },
      });
      
      // Если пользователь организатор или имеет membership - добавляем его в список для уведомления
      if (event && (event.organizerId === userId || event.memberships.length > 0)) {
        if (!allUserIdsToNotify.includes(userId)) {
          allUserIdsToNotify.push(userId);
        }
      }
    }
    
    if (remainingParticipantIds.length > 0) {
      this.websocketService.emitToChat(chat.id, 'message:new', systemMessage);
    }

    // Отправляем обновление всем пользователям, которые должны видеть чат
    if (allUserIdsToNotify.length > 0) {
      this.logger.debug(`[deleteChat] Sending chats:update to users: ${allUserIdsToNotify.join(', ')}, chatId: ${chatId}, chatType: ${chat.type}, eventId: ${chat.eventId}`);
      this.websocketService.emitToUsers(allUserIdsToNotify, 'chats:update', {});
    } else {
      this.logger.warn(`[deleteChat] No users to notify for chat ${chatId}`);
    }

    // Чат никогда не удаляется - всегда возвращаем success: true, chatDeleted: false
    this.logger.debug(`[deleteChat] Chat ${chatId} - user ${userId} left, chat remains, remainingParticipants: ${remainingParticipants.length}`);
    return { success: true, chatDeleted: false };
  }
}
