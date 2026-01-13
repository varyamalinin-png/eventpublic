import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Автоматическое обновление системных меток события
   */
  async updateAutoTags(eventId: string): Promise<string[]> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        startTime: true,
        ageRestriction: true,
        genderRestriction: true,
        isRecurring: true,
        isMassEvent: true,
      },
    });

    if (!event) {
      console.log(`[TagsService] Event ${eventId} not found`);
      return [];
    }

    const autoTags: string[] = [];

    // Women only
    // Проверяем, что genderRestriction - это массив с одним элементом 'female'
    // genderRestriction может быть null (не указано), [] (пустой массив), или ['female'] (только женщины)
    const isWomenOnly = 
      Array.isArray(event.genderRestriction) &&
      event.genderRestriction.length === 1 &&
      event.genderRestriction[0] === 'female';
    
    if (isWomenOnly) {
      autoTags.push('women_only');
    }

    // 18+
    if (event.ageRestriction && typeof event.ageRestriction === 'object') {
      const ageRestriction = event.ageRestriction as { min?: number; max?: number };
      if (ageRestriction.min && ageRestriction.min >= 18) {
        autoTags.push('age_18_plus');
      }
    }

    // Starting soon (менее 2 часов до начала)
    const timeUntilEvent = event.startTime.getTime() - Date.now();
    const twoHoursInMs = 2 * 60 * 60 * 1000;
    if (timeUntilEvent < twoHoursInMs && timeUntilEvent > 0) {
      autoTags.push('starting_soon');
    }

    // Recurring
    if (event.isRecurring) {
      autoTags.push('recurring');
    }

    // Mass event (массовое событие)
    const isMassEvent = (event as any).isMassEvent;
    if (isMassEvent) {
      autoTags.push('массовое');
      console.log(`[TagsService] Event ${eventId} is mass event, added "массовое" tag`);
    } else {
      console.log(`[TagsService] Event ${eventId} isMassEvent: ${isMassEvent}`);
    }

    // Обновляем метки в базе данных
    await this.prisma.event.update({
      where: { id: eventId },
      data: { autoTags },
    });

    console.log(`[TagsService] Updated autoTags for event ${eventId}:`, autoTags);
    return autoTags;
  }

  /**
   * Добавление пользовательских меток
   */
  async addCustomTags(eventId: string, tags: string[]): Promise<string[]> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { customTags: true },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    const existingTags = (event.customTags || []) as string[];
    const newTags = tags.filter((tag) => !existingTags.includes(tag));
    const updatedTags = [...existingTags, ...newTags];

    await this.prisma.event.update({
      where: { id: eventId },
      data: { customTags: updatedTags },
    });

    return updatedTags;
  }

  /**
   * Удаление пользовательских меток
   */
  async removeCustomTags(eventId: string, tags: string[]): Promise<string[]> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { customTags: true },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    const existingTags = (event.customTags || []) as string[];
    const updatedTags = existingTags.filter((tag) => !tags.includes(tag));

    await this.prisma.event.update({
      where: { id: eventId },
      data: { customTags: updatedTags },
    });

    return updatedTags;
  }

  /**
   * Получение всех меток события (автоматические + пользовательские)
   */
  async getAllTags(eventId: string): Promise<{
    autoTags: string[];
    customTags: string[];
  }> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        autoTags: true,
        customTags: true,
      },
    });

    if (!event) {
      return { autoTags: [], customTags: [] };
    }

    return {
      autoTags: (event.autoTags || []) as string[],
      customTags: (event.customTags || []) as string[],
    };
  }
}

