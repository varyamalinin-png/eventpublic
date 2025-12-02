import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('admin/moderation')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('users/:id/block')
  async blockUser(
    @Param('id') userId: string,
    @Request() req: any,
    @Body() body: { reason?: string },
  ) {
    return this.moderationService.blockUser(userId, req.user.id, body.reason);
  }

  @Post('users/:id/unblock')
  async unblockUser(@Param('id') userId: string, @Request() req: any) {
    return this.moderationService.unblockUser(userId, req.user.id);
  }

  @Delete('events/:id')
  async deleteEvent(@Param('id') eventId: string, @Request() req: any) {
    return this.moderationService.deleteEvent(eventId, req.user.id);
  }

  @Delete('events/:eventId/posts/:postId')
  async deletePost(
    @Param('eventId') eventId: string,
    @Param('postId') postId: string,
    @Request() req: any,
  ) {
    return this.moderationService.deletePost(eventId, postId, req.user.id);
  }

  @Delete('chats/:chatId/messages/:messageId')
  async deleteMessage(
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Request() req: any,
  ) {
    return this.moderationService.deleteMessage(chatId, messageId, req.user.id);
  }

  @Get('blocked-users')
  async getBlockedUsers() {
    return this.moderationService.getBlockedUsers();
  }
}

