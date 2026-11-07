import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildEventVisibilityWhere } from '../events/event-visibility';
import { blockedUserIds } from '../shared/blocks';

export interface SearchEventsParams {
  q?: string;
  location?: string;
  dateFrom?: Date;
  dateTo?: Date;
  organizerId?: string;
  limit?: number;
  offset?: number;
}

export interface SearchUsersParams {
  q?: string;
  limit?: number;
  offset?: number;
  /** Кто ищет — нужен, чтобы убрать из выдачи заблокированных. */
  viewerId?: string;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchEvents(params: SearchEventsParams & { viewerId?: string }) {
    const {
      q,
      location,
      dateFrom,
      dateTo,
      organizerId,
      limit = 20,
      offset = 0,
      viewerId,
    } = params;

    const where: any = {
      // Исключаем заблокированных организаторов
      organizer: {
        isBlocked: false,
      } as any,
      /**
       * И настройку видимости — раньше поиск её не знал вовсе и отдавал
       * события «только я» и «только друзьям» кому угодно. Условие кладём в
       * AND: OR у этого запроса уже занят поиском по тексту.
       *
       * Ручка без авторизации, поэтому зритель здесь всегда анонимный: ему
       * доступны только по-настоящему открытые события.
       */
      AND: [await buildEventVisibilityWhere(this.prisma, viewerId)],
    };

    // Поиск по тексту (название, описание)
    if (q) {
      where.OR = [
        {
          title: {
            contains: q,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: q,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Фильтр по локации
    if (location) {
      where.location = {
        contains: location,
        mode: 'insensitive',
      };
    }

    // Фильтр по дате
    if (dateFrom || dateTo) {
      where.startTime = {};
      if (dateFrom) {
        where.startTime.gte = dateFrom;
      }
      if (dateTo) {
        where.startTime.lte = dateTo;
      }
    }

    // Фильтр по организатору
    if (organizerId) {
      where.organizerId = organizerId;
    }

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: {
          organizer: {
            select: {
              id: true,
              username: true,
              name: true,
              avatarUrl: true,
            },
          },
          memberships: {
            where: {
              status: 'ACCEPTED',
            },
            select: {
              userId: true,
            },
          },
          _count: {
            select: {
              memberships: {
                where: {
                  status: 'ACCEPTED',
                },
              },
            },
          },
        },
        orderBy: {
          startTime: 'asc',
        },
        take: limit,
        skip: offset,
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      events: events.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        latitude: event.latitude,
        longitude: event.longitude,
        mediaUrl: event.mediaUrl,
        maxParticipants: event.maxParticipants,
        price: event.price,
        organizer: event.organizer,
        participantsCount: event._count.memberships,
        createdAt: event.createdAt,
      })),
      total,
      limit,
      offset,
    };
  }

  async searchUsers(params: SearchUsersParams) {
    const { q, limit = 20, offset = 0, viewerId } = params;

    // isBlocked — это блокировка модератором. Отдельно убираем тех, с кем у
    // ищущего личная блокировка (в любую сторону), и его самого.
    const hidden = await blockedUserIds(this.prisma, viewerId);

    const where: any = {
      isBlocked: false,
      ...(hidden.length > 0 ? { id: { notIn: hidden } } : {}),
    } as any;

    // Поиск по тексту (username, name, bio)
    if (q) {
      where.OR = [
        {
          username: {
            contains: q,
            mode: 'insensitive',
          },
        },
        {
          name: {
            contains: q,
            mode: 'insensitive',
          },
        },
        {
          bio: {
            contains: q,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
          bio: true,
          age: true,
          geoPosition: true,
          _count: {
            select: {
              organizedEvents: true,
              memberships: {
                where: {
                  status: 'ACCEPTED',
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        age: user.age,
        geoPosition: user.geoPosition,
        eventsCount: user._count.organizedEvents,
        participationsCount: user._count.memberships,
      })),
      total,
      limit,
      offset,
    };
  }

  async globalSearch(q: string, limit: number = 10, viewerId?: string) {
    if (!q || q.length < 2) {
      return {
        events: [],
        users: [],
      };
    }

    const globalHidden = await blockedUserIds(this.prisma, viewerId);

    const [events, users] = await Promise.all([
      this.prisma.event.findMany({
        where: {
          organizer: {
            isBlocked: false,
          } as any,
          // Видимость: без этого глобальный поиск показывал скрытые события.
          AND: [await buildEventVisibilityWhere(this.prisma, viewerId)],
          OR: [
            {
              title: {
                contains: q,
                mode: 'insensitive',
              },
            },
            {
              description: {
                contains: q,
                mode: 'insensitive',
              },
            },
          ],
        },
        include: {
          organizer: {
            select: {
              id: true,
              username: true,
              name: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              memberships: {
                where: {
                  status: 'ACCEPTED',
                },
              },
            },
          },
        },
        orderBy: {
          startTime: 'asc',
        },
        take: limit,
      }),
      this.prisma.user.findMany({
        where: {
          isBlocked: false,
          ...(globalHidden.length > 0 ? { id: { notIn: globalHidden } } : {}),
          OR: [
            {
              username: {
                contains: q,
                mode: 'insensitive',
              },
            },
            {
              name: {
                contains: q,
                mode: 'insensitive',
              },
            },
          ],
        } as any,
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
          bio: true,
        },
        take: limit,
      }),
    ]);

    return {
      events: events.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        location: event.location,
        mediaUrl: event.mediaUrl,
        organizer: event.organizer,
        participantsCount: event._count.memberships,
      })),
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      })),
    };
  }
}

