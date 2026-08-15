import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatsService } from './chats.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtService } from '@nestjs/jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';

interface SocketAuthPayload {
  sub: string;
  username: string;
}

@Injectable()
@WebSocketGateway({ namespace: '/ws/chats', cors: { origin: '*' } })
export class ChatsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly chatsService: ChatsService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers['authorization'];
      if (!token || typeof token !== 'string') {
        throw new UnauthorizedException();
      }
      const parsedToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      const payload = await this.jwtService.verifyAsync<SocketAuthPayload>(parsedToken);
      socket.data.userId = payload.sub;
      socket.join(`user:${payload.sub}`);

      const chats = await this.chatsService.listChatsForUser(payload.sub);
      chats.forEach((chat) => socket.join(`chat:${chat.id}`));
    } catch (error) {
      socket.disconnect(true);
    }
  }

  @SubscribeMessage('chat:join')
  async joinChat(@MessageBody() body: { chatId: string }, @ConnectedSocket() client: Socket) {
    if (!client.data.userId) {
      throw new UnauthorizedException();
    }
    client.join(`chat:${body.chatId}`);
    return { joined: body.chatId };
  }

  @SubscribeMessage('message:send')
  async handleMessage(
    @MessageBody() payload: { chatId: string; dto: CreateMessageDto },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      throw new UnauthorizedException();
    }
    const message = await this.chatsService.createMessage(userId, payload.chatId, payload.dto);
    return message;
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @MessageBody() body: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!client.data.userId) return;
    client.to(`chat:${body.chatId}`).emit('typing:start', {
      chatId: body.chatId,
      userId: client.data.userId,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @MessageBody() body: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!client.data.userId) return;
    client.to(`chat:${body.chatId}`).emit('typing:stop', {
      chatId: body.chatId,
      userId: client.data.userId,
    });
  }

  @SubscribeMessage('message:reaction')
  async handleReaction(
    @MessageBody() payload: { chatId: string; messageId: string; emoji: string; action: 'add' | 'remove' },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      throw new UnauthorizedException();
    }
    if (payload.action === 'add') {
      return this.chatsService.addReaction(payload.chatId, payload.messageId, userId, payload.emoji);
    } else {
      await this.chatsService.removeReaction(payload.chatId, payload.messageId, userId, payload.emoji);
      return { success: true };
    }
  }

  @SubscribeMessage('messages:read')
  async handleMessagesRead(
    @MessageBody() body: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!client.data.userId) return;
    return this.chatsService.markMessagesAsRead(client.data.userId, body.chatId);
  }
}
