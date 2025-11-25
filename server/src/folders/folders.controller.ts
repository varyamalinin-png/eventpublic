import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FoldersService } from './folders.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RequestUser } from '../shared/decorators/request-user.decorator';
import { CreateFolderDto } from './dto/create-folder.dto';
import { AddChatToFolderDto } from './dto/add-chat.dto';

@UseGuards(JwtAuthGuard)
@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  create(@RequestUser('userId') userId: string, @Body() dto: CreateFolderDto) {
    return this.foldersService.create(userId, dto);
  }

  @Get()
  list(@RequestUser('userId') userId: string) {
    return this.foldersService.list(userId);
  }

  @Post(':folderId/chats')
  addChat(
    @RequestUser('userId') userId: string,
    @Param('folderId') folderId: string,
    @Body() dto: AddChatToFolderDto,
  ) {
    return this.foldersService.addChat(userId, folderId, dto.chatId);
  }

  @Delete(':folderId/chats/:chatId')
  removeChat(
    @RequestUser('userId') userId: string,
    @Param('folderId') folderId: string,
    @Param('chatId') chatId: string,
  ) {
    return this.foldersService.removeChat(userId, folderId, chatId);
  }
}
