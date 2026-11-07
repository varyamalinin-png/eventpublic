import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';
import { RequestUser } from '../shared/decorators/request-user.decorator';
import { sanitizeEventsForGuest } from '../events/guest-sanitize';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // Эндпоинт публичный (без него не работал бы поиск у гостя), поэтому
  // анониму отдаём гостевую выдачу — без точных даты и места.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('events')
  async searchEvents(
    @RequestUser('userId') viewerId: string | undefined,
    @Query('q') q?: string,
    @Query('location') location?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('organizerId') organizerId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const results = await this.searchService.searchEvents({
      q,
      location,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      organizerId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    if (viewerId) return results;
    // Поиск возвращает обёртку { events, total, limit, offset } — чистим элементы.
    return { ...results, events: sanitizeEventsForGuest((results as any).events ?? []) };
  }

  // Поиск людей — под авторизацией: без неё не отсеять заблокированных.
  @Get('users')
  @UseGuards(JwtAuthGuard)
  async searchUsers(
    @RequestUser('userId') viewerId: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.searchService.searchUsers({
      q,
      viewerId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('global')
  @UseGuards(JwtAuthGuard)
  async globalSearch(
    @RequestUser('userId') userId: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.searchService.globalSearch(q || '', limitNumber, userId);
  }
}

