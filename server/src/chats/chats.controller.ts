import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RequestUser } from '../shared/decorators/request-user.decorator';
import { CreateMessageDto } from './dto/create-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get()
  async list(@RequestUser('userId') userId: string) {
    console.log(`[ChatsController] GET /chats called for userId: ${userId}`);
    console.log(`[ChatsController] Calling listChatsForUser...`);
    try {
      const result = await this.chatsService.listChatsForUser(userId);
      console.log(`[ChatsController] listChatsForUser returned, result length: ${Array.isArray(result) ? result.length : 'not array'}`);
      return result;
    } catch (error) {
      console.error(`[ChatsController] Error in listChatsForUser:`, error);
      throw error;
    }
  }

  @Get(':chatId/messages')
  listMessages(@RequestUser('userId') userId: string, @Param('chatId') chatId: string) {
    return this.chatsService.listMessages(userId, chatId);
  }

  @Post(':chatId/messages')
  sendMessage(
    @RequestUser('userId') userId: string,
    @Param('chatId') chatId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.chatsService.createMessage(userId, chatId, dto);
  }

  @Post('events/:eventId')
  createEventChat(
    @RequestUser('userId') userId: string,
    @Param('eventId') eventId: string,
    @Body() body: { participantIds: string[] },
  ) {
    return this.chatsService.createEventChat(userId, eventId, body.participantIds);
  }

  @Post('personal')
  createPersonalChat(
    @RequestUser('userId') userId: string,
    @Body() body: { otherUserId: string },
  ) {
    return this.chatsService.createPersonalChat(userId, body.otherUserId);
  }

  @Delete(':chatId')
  async deleteChat(
    @RequestUser('userId') userId: string,
    @Param('chatId') chatId: string,
    @Body() body?: { leaveEvent?: boolean },
  ) {
    return this.chatsService.deleteChat(userId, chatId, body?.leaveEvent || false);
  }
}
