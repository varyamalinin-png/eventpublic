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
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EventFoldersService } from './event-folders.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RequestUser } from '../shared/decorators/request-user.decorator';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('EventFoldersController');

@UseGuards(JwtAuthGuard)
@Controller('event-folders')
export class EventFoldersController {
  constructor(private readonly eventFoldersService: EventFoldersService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('coverPhoto', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      preservePath: false,
    }),
  )
  create(
    @RequestUser('userId') userId: string,
    @Body() body: { name: string; description?: string },
    @UploadedFile() coverPhoto?: Express.Multer.File,
    @Req() req: any,
  ) {
    try {
      logger.info(`📤 POST /event-folders, userId: ${userId}`);
      const contentType = req.headers['content-type'] || 'not set';
      logger.debug(`Request Content-Type: ${contentType}`);
      logger.debug(`Multer file: ${coverPhoto ? `yes (${coverPhoto.mimetype}, ${coverPhoto.size} bytes, ${coverPhoto.originalname})` : 'no'}`);
      logger.debug(`Request body keys: ${Object.keys(req.body || {}).join(', ')}`);
      
      if (!coverPhoto && req.body && Object.keys(req.body).length > 0 && contentType.includes('multipart/form-data')) {
        logger.warn(`⚠️ Body parser обработал multipart/form-data! Body keys: ${Object.keys(req.body).join(', ')}`);
      }
      
      return this.eventFoldersService.create(userId, body.name, body.description, coverPhoto);
    } catch (error: any) {
      logger.error(`Error creating folder: ${error?.message}`, error?.stack);
      throw error;
    }
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
