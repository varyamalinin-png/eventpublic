import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WebSocketService } from '../ws/websocket.service';

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketService: WebSocketService,
  ) {}

  listFriends(userId: string) {
    return this.prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        status: FriendshipStatus.ACCEPTED,
      },
      include: {
        requester: true,
        addressee: true,
      },
    });
  }

  async addFriend(userId: string, friendId: string) {
    if (userId === friendId) {
      throw new BadRequestException('Нельзя добавить в друзья самого себя');
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      if (existing.status === FriendshipStatus.ACCEPTED) {
        return existing;
      }

      if (existing.requesterId === userId) {
        if (existing.status === FriendshipStatus.PENDING) {
          throw new BadRequestException('Запрос уже отправлен и ожидает ответа');
        }
        if (existing.status === FriendshipStatus.REJECTED) {
          return this.prisma.friendship.update({
            where: { id: existing.id },
            data: { status: FriendshipStatus.PENDING },
            include: { requester: true, addressee: true },
          });
        }
      }

      if (existing.addresseeId === userId) {
        if (existing.status === FriendshipStatus.PENDING) {
          throw new BadRequestException('Вам уже отправили запрос. Подтвердите его.');
        }
        if (existing.status === FriendshipStatus.REJECTED) {
          return this.prisma.friendship.update({
            where: { id: existing.id },
            data: {
              requesterId: userId,
              addresseeId: friendId,
              status: FriendshipStatus.PENDING,
            },
            include: { requester: true, addressee: true },
          });
        }
      }

      throw new BadRequestException('Невозможно создать запрос в друзья');
    }

    const friendship = await this.prisma.friendship.create({
      data: {
        requesterId: userId,
        addresseeId: friendId,
        status: FriendshipStatus.PENDING,
      },
      include: {
        requester: true,
        addressee: true,
      },
    });

    // Отправляем WebSocket событие о новом запросе в друзья
    this.websocketService.emitToUser(friendId, 'friend:request:new', {
      id: friendship.id,
      requesterId: userId,
      addresseeId: friendId,
      status: 'PENDING',
      requester: friendship.requester,
    });

    return friendship;
  }

  async removeFriend(userId: string, friendId: string) {
    await this.prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: userId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: userId },
        ],
      },
    });
  }

  async listRequests(userId: string) {
    const [incoming, outgoing] = await Promise.all([
      this.prisma.friendship.findMany({
        where: {
          addresseeId: userId,
          status: FriendshipStatus.PENDING,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          requester: true,
          addressee: true,
        },
      }),
      this.prisma.friendship.findMany({
        where: {
          requesterId: userId,
          status: FriendshipStatus.PENDING,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          requester: true,
          addressee: true,
        },
      }),
    ]);

    return { incoming, outgoing };
  }

  async respondToRequest(userId: string, requestId: string, accept: boolean) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: requestId },
    });

    if (!friendship) {
      throw new NotFoundException('Friend request not found');
    }

    if (friendship.addresseeId !== userId) {
      throw new ForbiddenException('Вы не можете обработать этот запрос');
    }

    if (friendship.status !== FriendshipStatus.PENDING) {
      throw new BadRequestException('Запрос уже обработан');
    }

    const updatedFriendship = await this.prisma.friendship.update({
      where: { id: requestId },
      data: {
        status: accept ? FriendshipStatus.ACCEPTED : FriendshipStatus.REJECTED,
      },
      include: {
        requester: true,
        addressee: true,
      },
    });

    // Отправляем WebSocket событие об обновлении статуса запроса в друзья
    const status = accept ? 'ACCEPTED' : 'REJECTED';
    
    // Отправляем запросившему пользователю
    this.websocketService.emitToUser(friendship.requesterId, 'friend:request:status', {
      id: updatedFriendship.id,
      requesterId: friendship.requesterId,
      addresseeId: friendship.addresseeId,
      status,
      addressee: updatedFriendship.addressee,
    });

    // Отправляем адресату
    this.websocketService.emitToUser(friendship.addresseeId, 'friend:request:status', {
      id: updatedFriendship.id,
      requesterId: friendship.requesterId,
      addresseeId: friendship.addresseeId,
      status,
      requester: updatedFriendship.requester,
    });

    return updatedFriendship;
  }
}
