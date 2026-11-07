import { Controller, Get, Patch, Delete, Param, UseGuards, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RequestUser } from '../shared/decorators/request-user.decorator';

/** `?extended=1` — клиент знает новые типы уведомлений (сборка 4 и новее). */
const isOn = (value?: string) => value === '1' || value === 'true';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @RequestUser('userId') userId: string,
    @Query('includeRead') includeRead?: string,
    @Query('extended') extended?: string,
  ) {
    const includeReadBool = includeRead === 'true';
    return this.notificationsService.getUserNotifications(userId, includeReadBool, isOn(extended));
  }

  @Get('unread-count')
  async getUnreadCount(
    @RequestUser('userId') userId: string,
    @Query('extended') extended?: string,
  ) {
    const count = await this.notificationsService.getUnreadCount(userId, isOn(extended));
    return { count };
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') notificationId: string,
    @RequestUser('userId') userId: string,
  ) {
    await this.notificationsService.markAsRead(notificationId, userId);
    return { success: true };
  }

  @Patch('read-all')
  async markAllAsRead(@RequestUser('userId') userId: string) {
    await this.notificationsService.markAllAsRead(userId);
    return { success: true };
  }

  @Delete(':id')
  async deleteNotification(
    @Param('id') notificationId: string,
    @RequestUser('userId') userId: string,
  ) {
    await this.notificationsService.deleteNotification(notificationId, userId);
    return { success: true };
  }
}

