import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('WebSocketService');

@Injectable()
export class WebSocketService {
  private server: Server | null = null;

  constructor(private readonly prisma: PrismaService) {}

  setServer(server: Server) {
    this.server = server;
  }

  /**
   * Отправляет событие конкретному пользователю
   */
  emitToUser(userId: string, event: string, data: any) {
    if (!this.server) {
      logger.warn(`Server not initialized`);
      return;
    }
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Отправляет событие всем пользователям в комнате чата
   */
  emitToChat(chatId: string, event: string, data: any) {
    if (!this.server) {
      logger.warn(`Server not initialized`);
      return;
    }
    this.server.to(`chat:${chatId}`).emit(event, data);
  }

  /**
   * Отправляет событие всем пользователям
   */
  emitToAll(event: string, data: any) {
    if (!this.server) {
      logger.warn(`Server not initialized`);
      return;
    }
    this.server.emit(event, data);
  }

  /**
   * Отправляет событие нескольким пользователям
   */
  emitToUsers(userIds: string[], event: string, data: any) {
    if (!this.server) {
      logger.warn(`Server not initialized`);
      return;
    }
    userIds.forEach(userId => {
      this.server?.to(`user:${userId}`).emit(event, data);
    });
  }

  /**
   * Отправляет событие всем участникам события
   */
  async emitToEventParticipants(eventId: string, excludeUserId: string | null, event: string, data: any) {
    if (!this.server) {
      logger.warn(`Server not initialized`);
      return;
    }
    
    // Отправляем в комнату события
    this.server.to(`event:${eventId}`).emit(event, data);
    
    // Получаем участников и отправляем им индивидуально
    try {
      const eventData = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: {
          memberships: {
            where: { status: 'ACCEPTED' },
            select: { userId: true },
          },
        },
      });

      if (eventData) {
        const participantIds = new Set<string>();
        participantIds.add(eventData.organizerId);
        eventData.memberships.forEach(m => participantIds.add(m.userId));
        if (excludeUserId) {
          participantIds.delete(excludeUserId);
        }
        
        participantIds.forEach(userId => {
          this.server?.to(`user:${userId}`).emit(event, data);
        });
      }
    } catch (error) {
      logger.error(`Error emitting to event participants:`, error);
    }
  }

  /**
   * Подключает пользователя к комнате события
   */
  async joinEventRoom(userId: string, eventId: string) {
    if (!this.server) return;
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    sockets.forEach(socket => {
      socket.join(`event:${eventId}`);
    });
  }

  /**
   * Отключает пользователя от комнаты события
   */
  async leaveEventRoom(userId: string, eventId: string) {
    if (!this.server) return;
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    sockets.forEach(socket => {
      socket.leave(`event:${eventId}`);
    });
  }
}
