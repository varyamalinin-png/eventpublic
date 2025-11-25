import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecurringEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Расчет дат событий на основе паттерна повторения
   */
  calculateOccurrences(
    type: 'daily' | 'weekly' | 'monthly' | 'custom',
    startDate: Date,
    endDate?: Date,
    options?: {
      daysOfWeek?: number[];
      dayOfMonth?: number;
      customDates?: Date[];
    },
  ): Date[] {
    const occurrences: Date[] = [];
    const now = new Date();
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = endDate
      ? new Date(endDate)
      : new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000); // По умолчанию год вперед
    end.setHours(23, 59, 59, 999);

    switch (type) {
      case 'daily':
        return this.calculateDaily(start, end);

      case 'weekly':
        if (!options?.daysOfWeek || options.daysOfWeek.length === 0) {
          return [];
        }
        return this.calculateWeekly(start, end, options.daysOfWeek);

      case 'monthly':
        if (!options?.dayOfMonth) {
          return [];
        }
        return this.calculateMonthly(start, end, options.dayOfMonth);

      case 'custom':
        if (!options?.customDates || options.customDates.length === 0) {
          return [];
        }
        return options.customDates
          .map((d) => new Date(d))
          .filter((d) => d >= start && d <= end)
          .sort((a, b) => a.getTime() - b.getTime());

      default:
        return [];
    }
  }

  /**
   * Расчет ежедневных событий
   */
  private calculateDaily(start: Date, end: Date): Date[] {
    const occurrences: Date[] = [];
    const current = new Date(start);

    while (current <= end) {
      occurrences.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return occurrences;
  }

  /**
   * Расчет еженедельных событий
   */
  private calculateWeekly(start: Date, end: Date, daysOfWeek: number[]): Date[] {
    const occurrences: Date[] = [];
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (daysOfWeek.includes(dayOfWeek)) {
        occurrences.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    return occurrences;
  }

  /**
   * Расчет ежемесячных событий
   */
  private calculateMonthly(start: Date, end: Date, dayOfMonth: number): Date[] {
    const occurrences: Date[] = [];
    const current = new Date(start);

    // Устанавливаем первый месяц на нужный день
    if (current.getDate() <= dayOfMonth) {
      current.setDate(dayOfMonth);
    } else {
      current.setMonth(current.getMonth() + 1);
      current.setDate(dayOfMonth);
    }

    while (current <= end) {
      // Проверяем, что день месяца существует в этом месяце
      const lastDayOfMonth = new Date(
        current.getFullYear(),
        current.getMonth() + 1,
        0,
      ).getDate();

      if (dayOfMonth <= lastDayOfMonth) {
        occurrences.push(new Date(current));
      }

      // Переходим к следующему месяцу
      current.setMonth(current.getMonth() + 1);
    }

    return occurrences;
  }

  /**
   * Обновление счетчика оставшихся дат
   */
  async updateRemainingCount(eventId: string): Promise<number> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        isRecurring: true,
        recurringType: true,
        startTime: true,
        recurringDays: true,
        recurringDayOfMonth: true,
        recurringCustomDates: true,
      },
    });

    if (!event || !event.isRecurring) {
      return 0;
    }

    const now = new Date();
    let futureDates: Date[] = [];

    if (event.recurringType === 'custom' && event.recurringCustomDates) {
      futureDates = event.recurringCustomDates.filter((date) => date > now);
    } else {
      // Пересчитываем даты для других типов
      const occurrences = this.calculateOccurrences(
        event.recurringType as any,
        event.startTime,
        undefined,
        {
          daysOfWeek: event.recurringDays || undefined,
          dayOfMonth: event.recurringDayOfMonth || undefined,
        },
      );
      futureDates = occurrences.filter((date) => date > now);
    }

    return futureDates.length;
  }

  /**
   * Проверка и перемещение события в Memories (если все даты прошли)
   */
  async checkAndMoveToMemories(eventId: string): Promise<boolean> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        isRecurring: true,
        recurringType: true,
        startTime: true,
        recurringDays: true,
        recurringDayOfMonth: true,
        recurringCustomDates: true,
      },
    });

    if (!event || !event.isRecurring) {
      return false;
    }

    const now = new Date();
    let hasFutureDates = false;

    if (event.recurringType === 'custom' && event.recurringCustomDates) {
      hasFutureDates = event.recurringCustomDates.some((date) => date > now);
    } else {
      // Для daily события всегда есть будущие даты
      if (event.recurringType === 'daily') {
        hasFutureDates = true;
      } else {
        // Пересчитываем даты для других типов
        const occurrences = this.calculateOccurrences(
          event.recurringType as any,
          event.startTime,
          undefined,
          {
            daysOfWeek: event.recurringDays || undefined,
            dayOfMonth: event.recurringDayOfMonth || undefined,
          },
        );
        hasFutureDates = occurrences.some((date) => date > now);
      }
    }

    if (!hasFutureDates) {
      // Обновляем статус участия пользователей
      await this.prisma.userEventParticipation.updateMany({
        where: {
          eventId,
          status: 'active',
        },
        data: {
          status: 'completed',
        },
      });

      return true;
    }

    return false;
  }

  /**
   * Получение всех дат события для пользователя
   */
  async getUserParticipationDates(
    eventId: string,
    userId: string,
  ): Promise<Date[]> {
    const participation = await this.prisma.userEventParticipation.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    });

    if (!participation) {
      return [];
    }

    return participation.participationDates;
  }

  /**
   * Создание или обновление участия пользователя в регулярном событии
   */
  async createOrUpdateParticipation(
    eventId: string,
    userId: string,
  ): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        isRecurring: true,
        recurringType: true,
        startTime: true,
        recurringDays: true,
        recurringDayOfMonth: true,
        recurringCustomDates: true,
      },
    });

    if (!event || !event.isRecurring) {
      return;
    }

    // Для ежедневных событий не сохраняем все даты (их слишком много - 365+),
    // вместо этого используем пустой массив, так как для daily логика проще - они всегда активны
    let participationDates: Date[] = [];
    
    if (event.recurringType === 'daily') {
      // Для ежедневных событий не сохраняем даты - они всегда активны
      participationDates = [];
    } else {
      // Для других типов регулярных событий рассчитываем все даты
      const occurrences = this.calculateOccurrences(
        event.recurringType as any,
        event.startTime,
        undefined,
        {
          daysOfWeek: event.recurringDays || undefined,
          dayOfMonth: event.recurringDayOfMonth || undefined,
          customDates: event.recurringCustomDates || undefined,
        },
      );
      participationDates = occurrences;
    }

    // Создаем или обновляем участие
    await this.prisma.userEventParticipation.upsert({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      create: {
        userId,
        eventId,
        participationDates: participationDates,
        status: 'active',
      },
      update: {
        participationDates: participationDates,
        status: 'active',
        cancelledAt: null,
      },
    });
  }

  /**
   * Отмена участия в регулярном событии
   */
  async cancelParticipation(eventId: string, userId: string): Promise<void> {
    const participation = await this.prisma.userEventParticipation.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    });

    if (!participation) {
      return;
    }

    const now = new Date();
    const pastDates = participation.participationDates.filter((date) => date <= now);
    const futureDates = participation.participationDates.filter((date) => date > now);

    // Оставляем только прошедшие даты, удаляем будущие
    await this.prisma.userEventParticipation.update({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      data: {
        participationDates: pastDates,
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    });
  }
}

