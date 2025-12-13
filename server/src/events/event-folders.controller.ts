import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Delete,
  Put,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventFoldersService } from './event-folders.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RequestUser } from '../shared/decorators/request-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('event-folders')
export class EventFoldersController {
  constructor(private readonly eventFoldersService: EventFoldersService) {}

  @Post()
  @UseInterceptors(FileInterceptor('coverPhoto'))
  create(
    @RequestUser('userId') userId: string,
    @Body() body: { name: string; description?: string },
    @UploadedFile() coverPhoto?: Express.Multer.File,
  ) {
    return this.eventFoldersService.create(userId, body.name, body.description, coverPhoto);
  }

  @Get()
  list(@RequestUser('userId') userId: string) {
    return this.eventFoldersService.list(userId);
  }

  @Get(':folderId')
  getById(@RequestUser('userId') userId: string, @Param('folderId') folderId: string) {
    return this.eventFoldersService.getById(userId, folderId);
  }

  @Post(':folderId/events/:eventId')
  addEvent(
    @RequestUser('userId') userId: string,
    @Param('folderId') folderId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.eventFoldersService.addEvent(userId, folderId, eventId);
  }

  @Delete(':folderId/events/:eventId')
  removeEvent(
    @RequestUser('userId') userId: string,
    @Param('folderId') folderId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.eventFoldersService.removeEvent(userId, folderId, eventId);
  }

  @Put(':folderId')
  @UseInterceptors(FileInterceptor('coverPhoto'))
  update(
    @RequestUser('userId') userId: string,
    @Param('folderId') folderId: string,
    @Body() body: { name?: string; description?: string },
    @UploadedFile() coverPhoto?: Express.Multer.File,
  ) {
    return this.eventFoldersService.update(userId, folderId, body.name, body.description, coverPhoto);
  }

  @Delete(':folderId')
  delete(@RequestUser('userId') userId: string, @Param('folderId') folderId: string) {
    return this.eventFoldersService.delete(userId, folderId);
  }
}
