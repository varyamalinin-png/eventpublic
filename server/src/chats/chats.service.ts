import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { MembershipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isBlockedBetween } from '../shared/blocks';
import { CreateMessageDto } from './dto/create-message.dto';
import { WebSocketService } from '../ws/websocket.service';
import { ApnsService } from '../notifications/apns.service';
import { FcmService } from '../notifications/fcm.service';

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketService: WebSocketService,
    private readonly apnsService: ApnsService,
    private readonly fcmService: FcmService,
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
        participants: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } } },
        lastMessage: { include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } } },
        event: {
          include: {
            organizer: { select: { id: true, name: true, username: true, avatarUrl: true } },
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
    
    /**
     * Затем — события, где пользователь ПРИНЯТЫЙ участник.
     *
     * Статус здесь обязателен. Заявка на участие создаёт ту же строку
     * EventMembership со статусом PENDING, поэтому без фильтра чат события
     * появлялся в списке сообщений сразу после нажатия «GO» — до того, как
     * организатор вообще увидел заявку. И оставался там после отказа
     * (REJECTED) и после выхода из события (CANCELLED).
     */
    const participatedEvents = await this.prisma.eventMembership.findMany({
      where: {
        userId,
        status: MembershipStatus.ACCEPTED,
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
        participants: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } } },
        lastMessage: { include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } } },
        event: {
          include: {
            organizer: { select: { id: true, name: true, username: true, avatarUrl: true } },
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

  async addReaction(chatId: string, messageId: string, userId: string, emoji: string) {
    const reaction = await this.prisma.messageReaction.upsert({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
      create: { messageId, userId, emoji },
      update: {},
    });

    // Emit WebSocket event
    this.websocketService.emitToChat(chatId, 'message:reaction', {
      chatId,
      messageId,
      userId,
      emoji,
      action: 'add',
    });

    return reaction;
  }

  async removeReaction(chatId: string, messageId: string, userId: string, emoji: string) {
    await this.prisma.messageReaction.deleteMany({
      where: { messageId, userId, emoji },
    });

    // Emit WebSocket event
    this.websocketService.emitToChat(chatId, 'message:reaction', {
      chatId,
      messageId,
      userId,
      emoji,
      action: 'remove',
    });
  }

  async listMessages(userId: string, chatId: string, cursor?: string, limit: number = 50) {
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
                // Только принятые: по заявке в статусе PENDING переписку
                // события читать нельзя.
                where: { userId, status: MembershipStatus.ACCEPTED },
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

        if (!isOrganizer && !hasMembership) {
          throw new ForbiddenException('Access denied to chat messages');
        }
      } else {
        throw new ForbiddenException('Access denied to chat messages');
      }
    }

    // Clamp limit to a reasonable range
    const take = Math.min(Math.max(limit, 1), 200);

    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor
        ? { skip: 1, cursor: { id: cursor } }
        : {}),
      include: {
        sender: { select: { id: true, name: true, username: true, avatarUrl: true } },
        reactions: true,
      },
    });
  }

  async createMessage(userId: string, chatId: string, dto: CreateMessageDto) {
    /**
     * В личный чат с заблокированным писать нельзя — ни ему мне, ни мне ему.
     * Событийные чаты не трогаем: там люди вместе на событии, и блокировка
     * решается выходом из события, а не тишиной в общем чате.
     */
    const chatForBlockCheck = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        type: true,
        participants: { select: { userId: true } },
        event: {
          select: {
            organizerId: true,
            memberships: {
              where: { userId, status: MembershipStatus.ACCEPTED },
              select: { id: true },
            },
          },
        },
      },
    });

    /**
     * Писать может только тот, кто в чате состоит, — а для событийного чата
     * ещё и организатор или принятый участник, даже если из самого чата он
     * вышел. Проверки здесь не было вовсе: зная id чата, отправить сообщение
     * мог кто угодно, включая человека с неподтверждённой заявкой.
     */
    if (!chatForBlockCheck) {
      throw new ForbiddenException('Chat not found');
    }
    const isChatParticipant = chatForBlockCheck.participants.some(
      participant => participant.userId === userId,
    );
    const isEventMember =
      chatForBlockCheck.event != null &&
      (chatForBlockCheck.event.organizerId === userId ||
        chatForBlockCheck.event.memberships.length > 0);
    if (!isChatParticipant && !isEventMember) {
      throw new ForbiddenException('You are not a participant of this chat');
    }

    if (chatForBlockCheck.type === 'PERSONAL') {
      const other = chatForBlockCheck.participants
        .map(participant => participant.userId)
        .find(id => id !== userId);
      if (other && (await isBlockedBetween(this.prisma, userId, other))) {
        throw new ForbiddenException('Messaging is not available for this user');
      }
    }

    const message = await this.prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        content: dto.content,
        eventId: dto.eventId,
        postId: dto.postId,
      },
      include: {
        sender: { select: { id: true, name: true, username: true, avatarUrl: true } },
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
        event: { select: { title: true } },
      },
    });
    
    if (chat) {
      const participantIds = chat.participants.map(p => p.userId);
      this.websocketService.emitToUsers(participantIds, 'chats:update', {});
      // Пуш не ждём: он не должен задерживать ответ отправителю.
      void this.pushNewMessage(chat, message, participantIds, userId);
    }

    return message;
  }

  /**
   * Пуш о новом сообщении — всем участникам чата, кроме автора.
   *
   * Сообщения не создают запись в ленте уведомлений (там их было бы слишком
   * много), поэтому общая воронка NotificationsService.createNotification их
   * не видит — и пушей о сообщениях не было вовсе. Отправляем напрямую.
   */
  private async pushNewMessage(
    chat: { id: string; type: string; name?: string | null; event?: { title: string } | null },
    message: {
      content: string | null;
      eventId?: string | null;
      postId?: string | null;
      sender?: { name?: string | null; username?: string | null } | null;
    },
    participantIds: string[],
    senderId: string,
  ) {
    const recipients = participantIds.filter(id => id !== senderId);
    if (recipients.length === 0) return;

    const who = message.sender?.name || message.sender?.username || '';
    const raw = (message.content || '').trim();
    const preview = raw.length > 140 ? `${raw.slice(0, 137)}…` : raw;
    const isEventChat = chat.type === 'EVENT';

    const buildMessageText = (language: string) => {
      const en = language === 'en';
      const fallback = en ? 'New message' : 'Новое сообщение';
      const body =
        preview ||
        (message.postId
          ? en ? 'Shared a post' : 'Поделился(ась) публикацией'
          : message.eventId
            ? en ? 'Shared an event' : 'Поделился(ась) событием'
            : fallback);
      if (isEventChat) {
        return {
          title: chat.event?.title || chat.name || 'iwent',
          body: who ? `${who}: ${body}` : body,
        };
      }
      return { title: who || fallback, body };
    };
    const messageData = { type: 'MESSAGE', chatId: chat.id };

    // iOS и Android: каждый сервис берёт только свои токены по platform.
    await Promise.all(
      recipients.flatMap(recipientId => [
        this.apnsService.sendToUser(recipientId, buildMessageText, messageData),
        this.fcmService.sendToUser(recipientId, buildMessageText, messageData),
      ]),
    ).catch(error => this.logger.warn(`Пуш о сообщении не отправлен: ${(error as Error).message}`));
  }

  async markMessagesAsRead(userId: string, chatId: string) {
    const unread = await this.prisma.message.findMany({
      where: {
        chatId,
        senderId: { not: userId },
        NOT: { readBy: { has: userId } },
      },
      select: { id: true },
    });

    if (unread.length === 0) return { updated: 0 };

    await this.prisma.message.updateMany({
      where: { id: { in: unread.map(m => m.id) } },
      data: { readBy: { push: userId } },
    });

    this.websocketService.emitToChat(chatId, 'messages:read', {
      chatId,
      userId,
      messageIds: unread.map(m => m.id),
    });

    return { updated: unread.length };
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
          participants: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } } },
          lastMessage: { include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } } },
          event: {
            include: {
              organizer: { select: { id: true, name: true, username: true, avatarUrl: true } },
            },
          },
        },
      });
    }

    // Создаем новый чат
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { organizer: { select: { id: true, name: true, username: true, avatarUrl: true } } },
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
        participants: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } } },
        event: {
          include: {
            organizer: { select: { id: true, name: true, username: true, avatarUrl: true } },
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
          participants: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } } },
          lastMessage: { include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } } },
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
        participants: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } } },
        lastMessage: { include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } } },
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
              where: { userId, status: MembershipStatus.ACCEPTED },
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
        // Языконезависимый маркер, а не готовый текст: клиент подставляет
        // формулировку из своей локали. Раньше здесь лежала русская фраза,
        // и в английском интерфейсе она такой и оставалась — текст сообщения
        // хранится в базе, поменять его постфактум нельзя.
        // Формат: [[sys:<событие>]]<данные>. Старые записи клиент
        // распознаёт по прежнему русскому тексту (см. utils/systemMessage.ts).
        content: `[[sys:left_chat]]${userName}`,
      },
      include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } },
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
            where: { userId, status: MembershipStatus.ACCEPTED },
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
