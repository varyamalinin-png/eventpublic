import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { WebSocketService } from '../ws/websocket.service';

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
  };
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketService: WebSocketService,
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

    // Отправляем WebSocket событие о новом уведомлении
    this.websocketService.emitToUser(data.userId, 'notification:new', {
      id: notification.id,
      type: notification.type,
      payload: notification.payload,
      createdAt: notification.createdAt,
    });

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
    const eventTime = event.startTime ? event.startTime.toISOString().slice(11, 16) : undefined;

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
   * Получает все уведомления пользователя
   */
  async getUserNotifications(userId: string, includeRead: boolean = true) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(includeRead ? {} : { readAt: null }),
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
  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
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

