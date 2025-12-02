import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { WebSocketService } from './websocket.service';
import { PrismaService } from '../prisma/prisma.service';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('RealtimeGateway');

interface SocketAuthPayload {
  sub: string;
  username: string;
}

@Injectable()
@WebSocketGateway({ 
  namespace: '/ws', 
  cors: { origin: '*' },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly websocketService: WebSocketService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    // Инициализируем сервер в WebSocket сервисе после инициализации Gateway
    this.websocketService.setServer(server);
    logger.info(`RealtimeGateway initialized`);
  }

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers['authorization'];
      if (!token || typeof token !== 'string') {
        throw new UnauthorizedException();
      }
      const parsedToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      const payload = await this.jwtService.verifyAsync<SocketAuthPayload>(parsedToken);
      socket.data.userId = payload.sub;
      socket.data.username = payload.username;
      
      // Подключаем пользователя к его персональной комнате
      socket.join(`user:${payload.sub}`);
      
      // Получаем чаты пользователя и подключаем его к комнатам чатов
      const chats = await this.prisma.chat.findMany({
        where: {
          participants: {
            some: { userId: payload.sub },
          },
        },
      });
      chats.forEach((chat) => {
        socket.join(`chat:${chat.id}`);
      });

      // Получаем события пользователя (где он участник или организатор) и подключаем к комнатам
      const userEvents = await this.prisma.event.findMany({
        where: {
          OR: [
            { organizerId: payload.sub },
            {
              memberships: {
                some: { userId: payload.sub },
              },
            },
          ],
        },
        select: { id: true },
      });
      userEvents.forEach((event) => {
        socket.join(`event:${event.id}`);
      });

      logger.info(`WebSocket connected: ${payload.username} (${payload.sub})`);
    } catch (error: any) {
      // Обрабатываем истекшие токены более мягко
      if (error?.name === 'TokenExpiredError' || error?.message?.includes('jwt expired')) {
        // Не логируем как ошибку - это нормальная ситуация
        logger.debug(`WebSocket connection rejected: token expired for socket ${socket.id}`);
      } else {
        // Для других ошибок логируем как ошибку
        logger.error(`WebSocket connection error:`, error);
      }
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const userId = socket.data.userId;
    if (userId) {
      logger.info(`WebSocket disconnected: ${userId}`);
    }
  }

  /**
   * Отправляет событие конкретному пользователю (используется из сервисов)
   */
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Отправляет событие всем участникам события
   */
  emitToEvent(eventId: string, event: string, data: any) {
    this.server.to(`event:${eventId}`).emit(event, data);
  }

  /**
   * Отправляет событие всем пользователям
   */
  emitToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  /**
   * Подключает пользователя к комнате чата
   */
  @SubscribeMessage('chat:join')
  async joinChat(@MessageBody() body: { chatId: string }, @ConnectedSocket() client: Socket) {
    if (!client.data.userId) {
      throw new UnauthorizedException();
    }
    const room = `chat:${body.chatId}`;
    // Проверяем, не подключен ли уже пользователь к этой комнате
    const rooms = Array.from(client.rooms);
    if (!rooms.includes(room)) {
      client.join(room);
      logger.debug(`User ${client.data.userId} joined chat room: ${body.chatId}`);
    }
    return { joined: body.chatId };
  }

  /**
   * Подключает пользователя к комнате события
   */
  @SubscribeMessage('event:join')
  async joinEvent(@MessageBody() body: { eventId: string }, @ConnectedSocket() client: Socket) {
    if (!client.data.userId) {
      throw new UnauthorizedException();
    }
    const room = `event:${body.eventId}`;
    // Проверяем, не подключен ли уже пользователь к этой комнате
    const rooms = Array.from(client.rooms);
    if (!rooms.includes(room)) {
      client.join(room);
      logger.debug(`User ${client.data.userId} joined event room: ${body.eventId}`);
    }
    return { joined: body.eventId };
  }
}

