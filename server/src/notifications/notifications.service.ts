import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { WebSocketService } from '../ws/websocket.service';
import { ApnsService } from './apns.service';
import { FcmService } from './fcm.service';
import { buildPushText } from './push-texts';

export interface CreateNotificationPayload {
  userId: string;
  type: NotificationType;
  payload: {
    eventId?: string;
    actorId?: string;
    actorName?: string;
    eventTitle?: string;
    eventMediaUrl?: string;
    eventDate?: string;
    eventTime?: string;
    changedField?: string; // 'location', 'time', 'date', etc.
    postId?: string;
    /** Первое фото публикации — превью в ленте для лайков и комментариев. */
    postPhotoUrl?: string;
    /** Начало комментария, чтобы в ленте и пуше было видно, что написали. */
    commentPreview?: string;
  };
}

/**
 * Типы, которых не знают сборки до 1.0.0 (4).
 *
 * Сборка 3 рисует незнакомый тип пустой строкой «Новое уведомление», а
 * уведомление из сокета кладёт в ленту как есть, без проверки типа. Поэтому
 * такие уведомления отдаются только клиенту, который сам попросил расширенный
 * набор (`GET /notifications?extended=1`), и по сокету приходят отдельным
 * событием `notification:created`, на которое старый клиент не подписан.
 * Пуш уходит всем: это готовый текст, рисовать его приложению не нужно.
 */
export const EXTENDED_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.FRIEND_REQUEST_ACCEPTED,
  NotificationType.EVENT_INVITE_DECLINED,
  NotificationType.EVENT_POST_LIKED,
  NotificationType.EVENT_POST_COMMENTED,
];

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketService: WebSocketService,
    private readonly apns: ApnsService,
    private readonly fcm: FcmService,
  ) {}

  /**
   * Создает уведомление для одного пользователя
   */
  async createNotification(data: CreateNotificationPayload) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        payload: data.payload as any,
      },
    });

    // Отправляем WebSocket событие о новом уведомлении. Новые типы — под
    // другим именем, чтобы сборка 3 их не подхватила (EXTENDED_NOTIFICATION_TYPES).
    const socketEvent = EXTENDED_NOTIFICATION_TYPES.includes(notification.type)
      ? 'notification:created'
      : 'notification:new';
    this.websocketService.emitToUser(data.userId, socketEvent, {
      id: notification.id,
      type: notification.type,
      payload: notification.payload,
      createdAt: notification.createdAt,
    });

    // И пуш — на все устройства пользователя. Одна точка на все виды
    // уведомлений: сюда сходятся и события, и заявки, и сообщения, поэтому
    // отдельно расставлять отправку по местам не нужно.
    //
    // Намеренно без await: пуш не должен задерживать (и тем более ронять)
    // действие, которое его породило. Ошибки гасятся внутри ApnsService.
    const pushText = (language: string) => buildPushText(data.type, data.payload, language);
    const pushData = {
      notificationId: notification.id,
      type: notification.type,
      eventId: data.payload.eventId,
      actorId: data.payload.actorId,
      // По тапу на пуш о лайке или комментарии открывается сама публикация.
      postId: data.payload.postId,
    };
    // Два адресата, но двойной отправки не будет: каждый сервис выбирает свои
    // токены по platform, и у человека с айфоном android-токенов попросту нет.
    void this.apns.sendToUser(data.userId, pushText, pushData);
    void this.fcm.sendToUser(data.userId, pushText, pushData);

    return notification;
  }

  /**
   * Создает уведомления для всех участников события (кроме указанного пользователя)
   */
  async notifyEventParticipants(
    eventId: string,
    excludeUserId: string,
    type: NotificationType,
    payload: CreateNotificationPayload['payload'],
  ) {
    // Получаем всех участников события
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        memberships: {
          where: {
            status: 'ACCEPTED',
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
        organizer: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    // Собираем всех участников (организатор + принятые участники)
    const participantIds = new Set<string>();
    participantIds.add(event.organizerId);
    event.memberships.forEach(m => participantIds.add(m.userId));

    // Исключаем указанного пользователя
    participantIds.delete(excludeUserId);

    // Извлекаем дату и время из startTime
    const eventDate = event.startTime ? event.startTime.toISOString().split('T')[0] : undefined;
    const eventTime = event.startTime
      ? new Date(event.startTime.getTime() + 3 * 60 * 60 * 1000)
          .toISOString()
          .slice(11, 16)
      : undefined;

    // Создаем уведомления для всех участников
    const notifications = Array.from(participantIds).map(userId =>
      this.createNotification({
        userId,
        type,
        payload: {
          ...payload,
          eventId,
          eventTitle: event.title,
          eventMediaUrl: event.mediaUrl || undefined,
          eventDate,
          eventTime,
        },
      }),
    );

    return Promise.all(notifications);
  }

  /**
   * Получает все уведомления пользователя.
   *
   * extended — клиент знает новые типы (сборка 4 и новее). Без этого флага они
   * не отдаются, см. EXTENDED_NOTIFICATION_TYPES.
   */
  async getUserNotifications(userId: string, includeRead: boolean = true, extended: boolean = false) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(includeRead ? {} : { readAt: null }),
        ...(extended ? {} : { type: { notIn: EXTENDED_NOTIFICATION_TYPES } }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Помечает уведомление как прочитанное
   */
  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId, // Проверяем, что уведомление принадлежит пользователю
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  /**
   * Помечает все уведомления пользователя как прочитанные
   */
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  /**
   * Получает количество непрочитанных уведомлений
   */
  async getUnreadCount(userId: string, extended: boolean = false) {
    return this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
        ...(extended ? {} : { type: { notIn: EXTENDED_NOTIFICATION_TYPES } }),
      },
    });
  }

  /**
   * Удаляет уведомление
   */
  async deleteNotification(notificationId: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId, // Проверяем, что уведомление принадлежит пользователю
      },
    });
  }
}

