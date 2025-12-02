import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [totalUsers, totalEvents, totalComplaints, totalMessages] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.event.count(),
      this.prisma.complaint.count(),
      this.prisma.message.count(),
    ]);

    const [activeUsers, blockedUsers] = await Promise.all([
      this.prisma.user.count({ where: { isBlocked: false } as any }),
      this.prisma.user.count({ where: { isBlocked: true } as any }),
    ]);

    const [upcomingEvents, pastEvents] = await Promise.all([
      this.prisma.event.count({ where: { startTime: { gte: new Date() } } }),
      this.prisma.event.count({ where: { startTime: { lt: new Date() } } }),
    ]);

    const [pendingComplaints, resolvedComplaints] = await Promise.all([
      this.prisma.complaint.count({ where: { status: 'PENDING' } }),
      this.prisma.complaint.count({ where: { status: { in: ['RESOLVED', 'REJECTED'] } } }),
    ]);

    const recentUsers = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // последние 30 дней
        },
      },
    });

    const recentEvents = await this.prisma.event.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // последние 30 дней
        },
      },
    });

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        blocked: blockedUsers,
        recent: recentUsers, // за последние 30 дней
      },
      events: {
        total: totalEvents,
        upcoming: upcomingEvents,
        past: pastEvents,
        recent: recentEvents, // за последние 30 дней
      },
      complaints: {
        total: totalComplaints,
        pending: pendingComplaints,
        resolved: resolvedComplaints,
      },
      messages: {
        total: totalMessages,
      },
    };
  }

  async getUsersStatistics() {
    const [totalUsers, activeUsers, blockedUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isBlocked: false } as any }),
      this.prisma.user.count({ where: { isBlocked: true } as any }),
    ]);

    const [admins, support, regularUsers] = await Promise.all([
      this.prisma.user.count({ where: { role: 'ADMIN' } }),
      this.prisma.user.count({ where: { role: 'SUPPORT' } }),
      this.prisma.user.count({ where: { role: 'USER' } }),
    ]);

    const [verifiedUsers, unverifiedUsers] = await Promise.all([
      this.prisma.user.count({ where: { emailVerified: true } }),
      this.prisma.user.count({ where: { emailVerified: false } }),
    ]);

    // Статистика по активности (пользователи с событиями)
    const usersWithEvents = await this.prisma.user.count({
      where: {
        OR: [
          { organizedEvents: { some: {} } },
          { memberships: { some: {} } },
        ],
      },
    });

    // Статистика по периодам регистрации
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [usersLast7Days, usersLast30Days, usersLast90Days] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: last7Days } } }),
      this.prisma.user.count({ where: { createdAt: { gte: last30Days } } }),
      this.prisma.user.count({ where: { createdAt: { gte: last90Days } } }),
    ]);

    return {
      total: totalUsers,
      active: activeUsers,
      blocked: blockedUsers,
      byRole: {
        admin: admins,
        support: support,
        user: regularUsers,
      },
      byVerification: {
        verified: verifiedUsers,
        unverified: unverifiedUsers,
      },
      activeUsers: usersWithEvents,
      registrations: {
        last7Days: usersLast7Days,
        last30Days: usersLast30Days,
        last90Days: usersLast90Days,
      },
    };
  }

  async getEventsStatistics() {
    const [totalEvents, upcomingEvents, pastEvents] = await Promise.all([
      this.prisma.event.count(),
      this.prisma.event.count({ where: { startTime: { gte: new Date() } } }),
      this.prisma.event.count({ where: { startTime: { lt: new Date() } } }),
    ]);

    // События с участниками
    const eventsWithParticipants = await this.prisma.event.count({
      where: {
        memberships: {
          some: {
            status: 'ACCEPTED',
          },
        },
      },
    });

    // Среднее количество участников на событие
    const eventsWithMembers = await this.prisma.event.findMany({
      include: {
        memberships: {
          where: {
            status: 'ACCEPTED',
          },
        },
      },
    });

    const totalParticipants = eventsWithMembers.reduce((sum, event) => sum + event.memberships.length, 0);
    const averageParticipants = totalEvents > 0 ? totalParticipants / totalEvents : 0;

    // Статистика по периодам создания
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [eventsLast7Days, eventsLast30Days, eventsLast90Days] = await Promise.all([
      this.prisma.event.count({ where: { createdAt: { gte: last7Days } } }),
      this.prisma.event.count({ where: { createdAt: { gte: last30Days } } }),
      this.prisma.event.count({ where: { createdAt: { gte: last90Days } } }),
    ]);

    // Топ организаторов
    const topOrganizers = await this.prisma.user.findMany({
      where: {
        organizedEvents: {
          some: {},
        },
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatarUrl: true,
        _count: {
          select: {
            organizedEvents: true,
          },
        },
      },
      orderBy: {
        organizedEvents: {
          _count: 'desc',
        },
      },
      take: 10,
    });

    return {
      total: totalEvents,
      upcoming: upcomingEvents,
      past: pastEvents,
      withParticipants: eventsWithParticipants,
      averageParticipants: Math.round(averageParticipants * 100) / 100,
      created: {
        last7Days: eventsLast7Days,
        last30Days: eventsLast30Days,
        last90Days: eventsLast90Days,
      },
      topOrganizers: topOrganizers.map(org => ({
        id: org.id,
        username: org.username,
        name: org.name,
        avatarUrl: org.avatarUrl,
        eventsCount: org._count.organizedEvents,
      })),
    };
  }

  async getActivityStatistics(days: number = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [newUsers, newEvents, newMessages, newComplaints] = await Promise.all([
      this.prisma.user.count({
        where: {
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.event.count({
        where: {
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.message.count({
        where: {
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.complaint.count({
        where: {
          createdAt: { gte: startDate },
        },
      }),
    ]);

    // Активные пользователи (создали событие или отправили сообщение)
    const activeUsers = await this.prisma.user.count({
      where: {
        OR: [
          {
            organizedEvents: {
              some: {
                createdAt: { gte: startDate },
              },
            },
          },
          {
            messages: {
              some: {
                createdAt: { gte: startDate },
              },
            },
          },
        ],
      },
    });

    return {
      period: days,
      newUsers,
      newEvents,
      newMessages,
      newComplaints,
      activeUsers,
    };
  }
}

