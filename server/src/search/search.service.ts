import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchEvents(params: SearchEventsParams) {
    const {
      q,
      location,
      dateFrom,
      dateTo,
      organizerId,
      limit = 20,
      offset = 0,
    } = params;

    const where: any = {
      // Исключаем заблокированных организаторов
      organizer: {
        isBlocked: false,
      } as any,
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
    const { q, limit = 20, offset = 0 } = params;

    const where: any = {
      isBlocked: false, // Не показываем заблокированных пользователей
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

  async globalSearch(q: string, limit: number = 10) {
    if (!q || q.length < 2) {
      return {
        events: [],
        users: [],
      };
    }

    const [events, users] = await Promise.all([
      this.prisma.event.findMany({
        where: {
          organizer: {
            isBlocked: false,
          } as any,
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

