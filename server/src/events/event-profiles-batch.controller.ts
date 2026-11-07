import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EventProfilesService } from './event-profiles.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RequestUser } from '../shared/decorators/request-user.decorator';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('EventProfilesBatchController');

/**
 * Пакетная выдача профилей событий.
 *
 * Живёт под отдельным префиксом `event-profiles`, а не рядом с
 * `events/:eventId/profile`, намеренно: путь вида `events/profiles` совпал бы
 * по форме с `events/:id` из EventsController, и какой из маршрутов победит,
 * зависело бы от порядка регистрации контроллеров. Отдельный префикс
 * исключает этот вопрос.
 */
@Controller('event-profiles')
export class EventProfilesBatchController {
  /** Потолок на один запрос: и от случайного гигантского списка, и от злого умысла. */
  private static readonly MAX_IDS = 200;

  constructor(private readonly eventProfilesService: EventProfilesService) {}

  /**
   * Лента меморис. Собирается на сервере — см. EventProfilesService.getFeed.
   */
  @UseGuards(JwtAuthGuard)
  @Get('feed')
  async getFeed(
    @RequestUser('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsed = Number(limit);
    logger.info(`Лента меморис: userId=${userId}, cursor=${cursor ?? '-'}`);
    return this.eventProfilesService.getFeed(
      userId,
      Number.isFinite(parsed) && parsed > 0 ? parsed : 30,
      cursor || undefined,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('batch')
  async getMany(@Query('ids') ids?: string) {
    const eventIds = (ids ?? '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

    if (!eventIds.length) return [];

    if (eventIds.length > EventProfilesBatchController.MAX_IDS) {
      throw new BadRequestException(
        `Too many ids: ${eventIds.length}, max ${EventProfilesBatchController.MAX_IDS}`,
      );
    }

    const profiles = await this.eventProfilesService.getProfilesByEventIds(eventIds);
    logger.info(`Batch profiles: requested ${eventIds.length}, found ${profiles.length}`);
    return profiles;
  }
}
