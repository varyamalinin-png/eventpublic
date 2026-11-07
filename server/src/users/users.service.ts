import { Injectable, ConflictException, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { Friendship, FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Express } from 'express';
import { UpdateUserDto } from './dto/update-user.dto';
import { StorageService } from '../storage/storage.service';
import * as argon2 from 'argon2';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private normalizeLegacyPublicUrl(url: string | null) {
    if (!url) return url;
    return url.replace('://www.iventapp.ru', '://iwent.ru').replace('://iventapp.ru', '://iwent.ru');
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        name: true,
        bio: true,
        age: true,
        dateOfBirth: true,
        gender: true,
        showAge: true,
        geoPosition: true,
        avatarUrl: true,
        settings: true,
        googleId: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return user;
    return { ...user, avatarUrl: this.normalizeLegacyPublicUrl(user.avatarUrl) };
  }

  /**
   * Профиль для показа другому пользователю.
   *
   * Кроме самих полей отдаёт две вещи, которые клиент раньше вычислял сам и
   * систематически ошибался:
   *
   * - friendsCount — сколько у человека друзей НА САМОМ ДЕЛЕ. Клиент считал
   *   это по своей карте друзей, а туда попадают только те связи, о которых
   *   знает сам смотрящий (по сути — «дружит ли он со мной»), поэтому в чужом
   *   профиле стояло 0 или 1 независимо от реальности.
   *
   * - friendshipStatus — в каких мы отношениях с этим человеком. Клиент
   *   складывал ответ из трёх своих списков (друзья, входящие, исходящие), и
   *   стоило одному из них отстать — кнопка показывала «+» тому, кто уже
   *   в друзьях, или после «принять» снова превращалась в «+».
   *
   * Связей между двумя людьми в базе может быть ДВЕ (A→B и B→A: уникальность
   * стоит на паре в одном порядке), поэтому смотрим все и предпочитаем
   * принятую — иначе более свежая, но висящая заявка перекрывает уже
   * существующую дружбу.
   */
  async getPublicProfile(id: string, viewerId?: string) {
    const user = await this.findById(id);
    if (!user) return user;

    const friendsCount = await this.prisma.friendship.count({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: id }, { addresseeId: id }],
      },
    });

    const links: Friendship[] =
      viewerId && viewerId !== id
        ? await this.prisma.friendship.findMany({
            where: {
              OR: [
                { requesterId: viewerId, addresseeId: id },
                { requesterId: id, addresseeId: viewerId },
              ],
            },
          })
        : [];

    let friendshipStatus: 'none' | 'friends' | 'outgoing' | 'incoming' = 'none';
    let friendRequestId: string | null = null;

    const accepted = links.find(link => link.status === FriendshipStatus.ACCEPTED);
    if (accepted) {
      friendshipStatus = 'friends';
    } else {
      const incoming = links.find(
        link => link.status === FriendshipStatus.PENDING && link.addresseeId === viewerId,
      );
      const outgoing = links.find(
        link => link.status === FriendshipStatus.PENDING && link.requesterId === viewerId,
      );
      if (incoming) {
        friendshipStatus = 'incoming';
        friendRequestId = incoming.id;
      } else if (outgoing) {
        friendshipStatus = 'outgoing';
        friendRequestId = outgoing.id;
      }
    }

    // Блокировка. Флаг один: для интерфейса неважно, кто кого заблокировал —
    // контент скрыт в обе стороны. Отдельно отдаём blockedByMe, потому что
    // снять блокировку может только тот, кто её поставил.
    let isBlocked = false;
    let blockedByMe = false;
    if (viewerId && viewerId !== id) {
      const blocks = await this.prisma.userBlock.findMany({
        where: {
          OR: [
            { blockerId: viewerId, blockedId: id },
            { blockerId: id, blockedId: viewerId },
          ],
        },
        select: { blockerId: true },
      });
      isBlocked = blocks.length > 0;
      blockedByMe = blocks.some(block => block.blockerId === viewerId);
    }

    return { ...user, friendsCount, friendshipStatus, friendRequestId, isBlocked, blockedByMe };
  }

  /**
   * Заблокировать пользователя.
   *
   * Заодно рвём дружбу и все висящие заявки в обе стороны: держать их после
   * блокировки бессмысленно, а всплыть они могут в самый неподходящий момент.
   */
  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: blockedId },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });

    await this.prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: blockerId, addresseeId: blockedId },
          { requesterId: blockedId, addresseeId: blockerId },
        ],
      },
    });

    return { blocked: true };
  }

  async unblockUser(blockerId: string, blockedId: string) {
    await this.prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
    return { blocked: false };
  }

  /** Список тех, кого заблокировал я (снять блокировку может только автор). */
  async listBlockedUsers(userId: string) {
    const rows = await this.prisma.userBlock.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        blocked: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });
    return rows.map(row => ({ ...row.blocked, blockedAt: row.createdAt }));
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({
      where: { googleId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        name: true,
        bio: true,
        age: true,
        dateOfBirth: true,
        gender: true,
        showAge: true,
        geoPosition: true,
        avatarUrl: true,
        settings: true,
        googleId: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createUser(data: {
    email: string;
    username: string;
    phone?: string | null;
    passwordHash?: string | null;
    name?: string;
    avatarUrl?: string;
    emailVerified?: boolean;
    googleId?: string | null;
    accountType?: 'personal' | 'business';
  }) {
    try {
      return await this.prisma.user.create({
        data,
        select: {
          id: true,
          email: true,
          emailVerified: true,
          username: true,
          name: true,
          bio: true,
          age: true,
          dateOfBirth: true,
          gender: true,
          showAge: true,
          geoPosition: true,
          avatarUrl: true,
          settings: true,
          googleId: true,
          accountType: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email or username already taken');
      }
      throw error;
    }
  }

  async updateProfile(id: string, data: UpdateUserDto) {
    try {
      const updateData: any = { ...data };
      if ('avatarUrl' in updateData) {
        updateData.avatarUrl = this.normalizeLegacyPublicUrl(updateData.avatarUrl ?? null);
      }
      
      // КРИТИЧЕСКИ ВАЖНО: Защита от установки username в пустую строку или "user"
      // Если username передан, но он пустой или равен "user", не обновляем его
      if ('username' in updateData) {
        if (!updateData.username || updateData.username.trim() === '' || updateData.username === 'user') {
          delete updateData.username; // Не обновляем username, если он пустой или "user"
        }
      }
      
      // Преобразуем dateOfBirth из строки в Date, если она есть
      if (updateData.dateOfBirth && typeof updateData.dateOfBirth === 'string') {
        /**
         * Дата рождения — календарный день, а не момент времени.
         *
         * Клиент присылает «YYYY-MM-DD», и мы кладём его на ПОЛДЕНЬ по UTC:
         * тогда в любом часовом поясе от UTC−11 до UTC+11 это тот же самый
         * день. Раньше сюда приходил toISOString() локальной полуночи, и дата
         * гуляла на сутки в зависимости от пояса устройства и того, как её
         * потом читали.
         */
        const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(updateData.dateOfBirth);
        updateData.dateOfBirth = dayOnly
          ? new Date(Date.UTC(Number(dayOnly[1]), Number(dayOnly[2]) - 1, Number(dayOnly[3]), 12))
          : new Date(updateData.dateOfBirth);
      }
      const user = await this.prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          emailVerified: true,
          username: true,
          name: true,
          bio: true,
          age: true,
          dateOfBirth: true,
          gender: true,
          showAge: true,
          geoPosition: true,
          avatarUrl: true,
          settings: true,
          googleId: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return { ...user, avatarUrl: this.normalizeLegacyPublicUrl(user.avatarUrl) };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Field must be unique');
      }
      throw error;
    }
  }

  async markEmailVerified(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        name: true,
        bio: true,
        age: true,
        dateOfBirth: true,
        gender: true,
        showAge: true,
        geoPosition: true,
        avatarUrl: true,
        settings: true,
        googleId: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async verifyUserByEmailOrId(email: string, id: string) {
    const result = await this.prisma.user.updateMany({
      where: {
        OR: [{ email }, { id }],
        emailVerified: false,
      },
      data: {
        emailVerified: true,
      },
    });

    const users = await this.prisma.user.findMany({
      where: {
        OR: [{ email }, { id }],
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
      },
    });

    return {
      updated: result.count,
      users,
    };
  }

  async updateAvatarFromUpload(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Файл обязателен');
    }
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Поддерживаются только изображения');
    }
    if (file.size > this.storage.getMaxFileSizeBytes()) {
      throw new BadRequestException('Файл слишком большой');
    }

    const avatarUrl = await this.storage.uploadUserAvatar(userId, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalName: file.originalname ?? 'avatar',
    });

    return this.updateProfile(userId, { avatarUrl });
  }

  async removeAvatar(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        name: true,
        bio: true,
        age: true,
        dateOfBirth: true,
        gender: true,
        showAge: true,
        geoPosition: true,
        avatarUrl: true,
        settings: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updatePassword(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        name: true,
        bio: true,
        age: true,
        dateOfBirth: true,
        gender: true,
        showAge: true,
        geoPosition: true,
        avatarUrl: true,
        settings: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async ensureUniqueUsername(base: string) {
    const sanitized = base.toLowerCase().replace(/[^a-z0-9_\.]/g, '');
    let candidate = sanitized || `user${Date.now()}`;
    let counter = 1;
    while (true) {
      const existing = await this.findByUsername(candidate);
      if (!existing) {
        return candidate;
      }
      candidate = `${sanitized}_${counter}`;
      counter += 1;
    }
  }

  async linkGoogleAccount(userId: string, googleId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        googleId,
        emailVerified: true,
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        name: true,
        bio: true,
        age: true,
        dateOfBirth: true,
        gender: true,
        showAge: true,
        geoPosition: true,
        avatarUrl: true,
        settings: true,
        googleId: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async searchByUsername(query: string) {
    if (!query || query.length < 2) {
      return [];
    }
    const hasBlockedField = await this.hasBlockedField();
    return this.prisma.user.findMany({
      where: {
        username: {
          contains: query,
          mode: 'insensitive',
        },
        // Исключаем заблокированных пользователей из поиска
        ...(hasBlockedField ? { isBlocked: false } : {}),
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatarUrl: true,
        bio: true,
      },
      take: 20,
    });
  }

  // Вспомогательный метод для проверки наличия поля isBlocked
  private async hasBlockedField(): Promise<boolean> {
    try {
      // Попытка выполнить запрос с проверкой поля isBlocked
      await this.prisma.$queryRaw`SELECT "isBlocked" FROM "User" LIMIT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async changeEmail(userId: string, dto: ChangeEmailDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Проверяем текущий пароль
    const isValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Проверяем, не занят ли новый email
    const existing = await this.findByEmail(dto.email);
    if (existing && existing.id !== userId) {
      throw new ConflictException('Email already taken');
    }

    // Обновляем email и сбрасываем верификацию
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.email,
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        name: true,
        bio: true,
        age: true,
        dateOfBirth: true,
        gender: true,
        showAge: true,
        geoPosition: true,
        avatarUrl: true,
        settings: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Проверяем текущий пароль
    const isValid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!isValid) {
      throw new UnauthorizedException('Invalid current password');
    }

    // Хешируем новый пароль
    const newPasswordHash = await argon2.hash(dto.newPassword);
    return this.updatePassword(userId, newPasswordHash);
  }

  /**
   * Полное удаление аккаунта вместе со всеми данными.
   *
   * Требование App Store 5.1.1(v): если приложение позволяет завести аккаунт,
   * оно обязано давать удалить его ИЗ приложения. Отсылка «напишите в
   * поддержку», которая была здесь раньше, для проверки не годится.
   *
   * Почему всё расписано руками, а не через onDelete: Cascade. У большинства
   * связей с User каскада в схеме нет, а добавлять его — это ALTER TABLE на
   * полутора десятках внешних ключей на живой базе без истории миграций
   * (см. CLAUDE.md §2.2). Явная транзакция ничего не меняет в схеме и
   * полностью под нашим контролем.
   *
   * Порядок важен: сначала то, что ссылается, потом то, на что ссылаются.
   * Отдельно отмечены два места, где обычный «удалить по userId» ломается:
   *  - Chat.lastMessageId ссылается на Message, поэтому ссылку надо обнулить
   *    ДО удаления сообщений;
   *  - Message.postId ссылается на пост без каскада, поэтому сообщения,
   *    указывающие на удаляемые посты, надо убрать раньше самих постов.
   */
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // События, где пользователь организатор: они удаляются вместе с ним.
    const organizedEvents = await this.prisma.event.findMany({
      where: { organizerId: userId },
      select: { id: true },
    });
    const eventIds = organizedEvents.map((event) => event.id);

    // Чаты, которые исчезнут: чаты его событий и личные переписки с ним.
    const eventChats = eventIds.length
      ? await this.prisma.chat.findMany({
          where: { eventId: { in: eventIds } },
          select: { id: true },
        })
      : [];
    const personalChats = await this.prisma.chat.findMany({
      where: { type: 'PERSONAL', participants: { some: { userId } } },
      select: { id: true },
    });
    const chatIds = [
      ...new Set([...eventChats, ...personalChats].map((chat) => chat.id)),
    ];

    // Посты, которые исчезнут: написанные им и лежащие в его событиях.
    const doomedPosts = await this.prisma.eventProfilePost.findMany({
      where: {
        OR: [
          { authorId: userId },
          ...(eventIds.length ? [{ eventId: { in: eventIds } }] : []),
        ],
      },
      select: { id: true },
    });
    const postIds = doomedPosts.map((post) => post.id);

    // Media is stored in object storage separately from Postgres. Delete the
    // uploader-scoped files first so a successful account deletion does not
    // leave publicly reachable profile/event uploads behind. If storage refuses
    // deletion, abort before removing the account rows so the request can be
    // retried instead of reporting a partial success.
    await this.storage.deleteUserMedia(userId);

    await this.prisma.$transaction(async (tx) => {
      // 1. Снимаем ссылку «последнее сообщение» — иначе удаление сообщений
      //    упрётся во внешний ключ Chat.lastMessageId.
      await tx.chat.updateMany({
        where: {
          OR: [
            ...(chatIds.length ? [{ id: { in: chatIds } }] : []),
            { lastMessage: { senderId: userId } },
          ],
        },
        data: { lastMessageId: null },
      });

      // 2. Сообщения: его собственные, все сообщения удаляемых чатов и те,
      //    что ссылаются на удаляемые события и посты.
      await tx.message.deleteMany({
        where: {
          OR: [
            { senderId: userId },
            ...(chatIds.length ? [{ chatId: { in: chatIds } }] : []),
            ...(eventIds.length ? [{ eventId: { in: eventIds } }] : []),
            ...(postIds.length ? [{ postId: { in: postIds } }] : []),
          ],
        },
      });

      // 3. Чаты и всё, что к ним прицеплено.
      await tx.chatParticipant.deleteMany({
        where: {
          OR: [
            { userId },
            ...(chatIds.length ? [{ chatId: { in: chatIds } }] : []),
          ],
        },
      });
      if (chatIds.length) {
        await tx.folderChat.deleteMany({ where: { chatId: { in: chatIds } } });
      }
      await tx.personalChatKey.deleteMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
      });
      if (chatIds.length) {
        await tx.chat.deleteMany({ where: { id: { in: chatIds } } });
      }

      // 4. Папки чатов пользователя.
      const folders = await tx.folder.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });
      if (folders.length) {
        await tx.folderChat.deleteMany({
          where: { folderId: { in: folders.map((folder) => folder.id) } },
        });
        await tx.folder.deleteMany({ where: { ownerId: userId } });
      }

      // 5. Посты и комментарии. Комментарии к удаляемым постам уходят
      //    каскадом, отдельно убираем его комментарии под чужими постами.
      await tx.postComment.deleteMany({ where: { authorId: userId } });
      if (postIds.length) {
        await tx.eventProfilePost.deleteMany({ where: { id: { in: postIds } } });
      }
      await tx.eventProfileParticipant.deleteMany({ where: { userId } });

      // 6. Участие в событиях и личные фото событий.
      await tx.eventPersonalPhoto.deleteMany({
        where: {
          OR: [
            { userId },
            ...(eventIds.length ? [{ eventId: { in: eventIds } }] : []),
          ],
        },
      });
      await tx.eventMembership.deleteMany({
        where: {
          OR: [
            { userId },
            ...(eventIds.length ? [{ eventId: { in: eventIds } }] : []),
          ],
        },
      });
      await tx.userEventParticipation.deleteMany({ where: { userId } });

      // 7. Социальный граф, уведомления, жалобы, токены.
      await tx.friendship.deleteMany({
        where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.complaint.deleteMany({
        where: {
          OR: [
            { reporterId: userId },
            { reportedUserId: userId },
            ...(eventIds.length ? [{ reportedEventId: { in: eventIds } }] : []),
          ],
        },
      });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.emailVerificationToken.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });

      // 8. Папки пользователей и папки событий.
      await tx.userFolderUser.deleteMany({ where: { userId } });
      await tx.userFolder.deleteMany({ where: { ownerId: userId } });
      if (eventIds.length) {
        await tx.eventFolderEvent.deleteMany({
          where: { eventId: { in: eventIds } },
        });
      }
      await tx.eventFolder.deleteMany({ where: { ownerId: userId } });

      // 9. Сами события (профили событий уходят каскадом).
      if (eventIds.length) {
        await tx.event.deleteMany({ where: { id: { in: eventIds } } });
      }

      // 10. И наконец аккаунт.
      await tx.user.delete({ where: { id: userId } });
    });

    return { deleted: true, events: eventIds.length, chats: chatIds.length };
  }

  /**
   * Сохраняет токен устройства. Уникален сам токен, а не пара
   * (пользователь, токен): если на телефоне сменили аккаунт, запись должна
   * переехать на нового владельца, иначе пуши продолжат уходить прежнему.
   */
  async savePushToken(
    userId: string,
    dto: { token: string; platform: string; language?: string },
  ) {
    await this.prisma.pushToken.upsert({
      where: { token: dto.token },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
        language: dto.language ?? 'en',
      },
      update: {
        userId,
        platform: dto.platform,
        language: dto.language ?? 'en',
      },
    });
    return { ok: true };
  }

  async deleteAllUsers() {
    const count = await this.prisma.user.count();
    const result = await this.prisma.user.deleteMany({});
    return {
      count: result.count,
      totalBefore: count,
    };
  }
}
