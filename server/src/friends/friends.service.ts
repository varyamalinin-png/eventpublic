import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isBlockedBetween } from '../shared/blocks';
import { WebSocketService } from '../ws/websocket.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketService: WebSocketService,
    private readonly notificationsService: NotificationsService,
  ) {}

  listFriends(userId: string) {
    return this.prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        status: FriendshipStatus.ACCEPTED,
      },
      include: {
        // gender — только в СВОЁМ списке друзей: по нему приглашение в событие
        // с ограничением по полу отсеивает неподходящих. Раньше клиенту было
        // не на что опереться, и «только для мужчин» предлагало всех подряд.
        requester: { select: { id: true, name: true, username: true, avatarUrl: true, gender: true } },
        addressee: { select: { id: true, name: true, username: true, avatarUrl: true, gender: true } },
      },
    });
  }

  /**
   * Друзья ЛЮБОГО пользователя, а не только свои.
   *
   * Экран списка друзей брал их из клиентской карты userFriendsMap, куда
   * попадают лишь те связи, о которых знает сам смотрящий, — поэтому в чужом
   * профиле список был пуст, даже когда счётчик показывал двоих.
   */
  async listUserFriends(userId: string) {
    const select = { id: true, name: true, username: true, avatarUrl: true };
    const links = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: { requester: { select }, addressee: { select } },
      orderBy: { createdAt: 'desc' },
    });

    // Одна и та же пара может лежать в базе дважды (A→B и B→A), поэтому
    // отсеиваем повторы по id — иначе один друг покажется двумя строками.
    const seen = new Set<string>();
    const friends: Array<{ id: string; name: string | null; username: string; avatarUrl: string | null }> = [];
    links.forEach(link => {
      const friend = link.requesterId === userId ? link.addressee : link.requester;
      if (!friend || seen.has(friend.id)) return;
      seen.add(friend.id);
      friends.push(friend);
    });
    return friends;
  }

  async addFriend(userId: string, friendId: string) {
    if (userId === friendId) {
      throw new BadRequestException('Нельзя добавить в друзья самого себя');
    }

    // С заблокированным дружбы нет — ни в ту, ни в другую сторону.
    if (await isBlockedBetween(this.prisma, userId, friendId)) {
      throw new ForbiddenException('This user is not available');
    }

    /**
     * Связей между двумя людьми в базе может оказаться ДВЕ: уникальность стоит
     * на паре (requesterId, addresseeId) в одном порядке, так что A→B и B→A
     * прекрасно уживаются. Раньше здесь был findFirst по дате, и более свежая
     * висящая заявка перекрывала уже существующую дружбу — принятую связь
     * просто не замечали. Поэтому берём все и предпочитаем принятую.
     */
    const links = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { id: true, name: true, username: true, avatarUrl: true } },
        addressee: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
    });

    const existing =
      links.find(link => link.status === FriendshipStatus.ACCEPTED) ?? links[0] ?? null;

    if (existing) {
      if (existing.status === FriendshipStatus.ACCEPTED) {
        return existing;
      }

      if (existing.requesterId === userId) {
        if (existing.status === FriendshipStatus.PENDING) {
          // Идемпотентно: повторный клик/двойной вызов до перерисовки кнопки
          // не должен считаться ошибкой — запрос уже существует и это ОК
          return existing;
        }
        if (existing.status === FriendshipStatus.REJECTED) {
          return this.prisma.friendship.update({
            where: { id: existing.id },
            data: { status: FriendshipStatus.PENDING },
            include: { requester: { select: { id: true, name: true, username: true, avatarUrl: true } }, addressee: { select: { id: true, name: true, username: true, avatarUrl: true } } },
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
            include: { requester: { select: { id: true, name: true, username: true, avatarUrl: true } }, addressee: { select: { id: true, name: true, username: true, avatarUrl: true } } },
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
        requester: { select: { id: true, name: true, username: true, avatarUrl: true } },
        addressee: { select: { id: true, name: true, username: true, avatarUrl: true } },
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

    /**
     * И запись уведомления.
     *
     * Раньше здесь было только WebSocket-событие: оно долетает лишь до
     * запущенного приложения и нигде не сохраняется. В ленте уведомлений
     * заявка в друзья не появлялась вовсе, и пуш по ней не уходил — вся
     * отправка пушей висит на createNotification.
     */
    void this.notificationsService
      .createNotification({
        userId: friendId,
        type: 'FRIEND_REQUEST',
        payload: {
          actorId: userId,
          actorName:
            friendship.requester?.name || friendship.requester?.username || undefined,
        },
      })
      .catch(() => undefined);

    return friendship;
  }

  /**
   * Удаление из друзей — и отмена своей висящей заявки тем же вызовом.
   *
   * Связь удаляется в любом статусе. Если это была моя заявка, у адресата в
   * ленте осталось бы «хочет добавить вас в друзья» на заявку, которой больше
   * нет, — такое уведомление убираем. Второй стороне шлём friend:request:status,
   * чтобы её списки друзей и заявок обновились сразу, а не при следующем запуске.
   */
  async removeFriend(userId: string, friendId: string) {
    const pendingFromMe = await this.prisma.friendship.findFirst({
      where: { requesterId: userId, addresseeId: friendId, status: FriendshipStatus.PENDING },
      select: { id: true },
    });

    await this.prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: userId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: userId },
        ],
      },
    });

    if (pendingFromMe) {
      await this.prisma.notification.deleteMany({
        where: {
          userId: friendId,
          type: 'FRIEND_REQUEST',
          payload: { path: ['actorId'], equals: userId },
        },
      });
    }

    this.websocketService.emitToUser(friendId, 'friend:request:status', {
      id: pendingFromMe?.id,
      requesterId: userId,
      addresseeId: friendId,
      status: pendingFromMe ? 'CANCELLED' : 'REMOVED',
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
          requester: { select: { id: true, name: true, username: true, avatarUrl: true } },
          addressee: { select: { id: true, name: true, username: true, avatarUrl: true } },
        },
      }),
      this.prisma.friendship.findMany({
        where: {
          requesterId: userId,
          status: FriendshipStatus.PENDING,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          requester: { select: { id: true, name: true, username: true, avatarUrl: true } },
          addressee: { select: { id: true, name: true, username: true, avatarUrl: true } },
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
        requester: { select: { id: true, name: true, username: true, avatarUrl: true } },
        addressee: { select: { id: true, name: true, username: true, avatarUrl: true } },
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

    // Тому, кто просился в друзья, — уведомление о принятой заявке. Раньше об
    // этом узнавали, только случайно открыв свой список друзей.
    if (accept) {
      void this.notificationsService
        .createNotification({
          userId: friendship.requesterId,
          type: 'FRIEND_REQUEST_ACCEPTED',
          payload: {
            actorId: friendship.addresseeId,
            actorName:
              updatedFriendship.addressee?.name || updatedFriendship.addressee?.username || undefined,
          },
        })
        .catch(() => undefined);
    }

    return updatedFriendship;
  }
}
