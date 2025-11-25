import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('admin/statistics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('overview')
  async getOverview() {
    return this.statisticsService.getOverview();
  }

  @Get('users')
  async getUsersStatistics() {
    return this.statisticsService.getUsersStatistics();
  }

  @Get('events')
  async getEventsStatistics() {
    return this.statisticsService.getEventsStatistics();
  }

  @Get('activity')
  async getActivityStatistics(@Query('days') days?: string) {
    const daysNumber = days ? parseInt(days, 10) : 30;
    return this.statisticsService.getActivityStatistics(daysNumber);
  }
}

