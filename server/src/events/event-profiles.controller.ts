import { Body, Controller, Get, Param, Post, Patch, UseGuards, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createLogger } from '../shared/utils/logger';
import { memoryStorage } from 'multer';
import { EventProfilesService } from './event-profiles.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RequestUser } from '../shared/decorators/request-user.decorator';
import { CreateEventProfileDto } from './dto/create-event-profile.dto';
import { CreateEventProfilePostDto } from './dto/create-event-profile-post.dto';
import { StorageService } from '../storage/storage.service';

const logger = createLogger('EventProfilesController');

@Controller('events/:eventId/profile')
export class EventProfilesController {
  constructor(
    private readonly eventProfilesService: EventProfilesService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getProfile(@Param('eventId') eventId: string, @RequestUser('userId') userId: string) {
    try {
      logger.info(`📥 GET profile for eventId: ${eventId}, user: ${userId}`);
      const result = await this.eventProfilesService.getProfile(eventId);
      logger.info(`Profile retrieved successfully: ${result ? 'found' : 'not found'}`);
      
      // Профиль события доступен ВСЕМ для просмотра
      // Редактирование доступно только участникам (проверяется в методах PATCH/POST/DELETE)
      return result;
    } catch (error) {
      logger.error(`Error getting profile: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createProfile(
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventProfileDto,
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`📤 POST create profile for eventId: ${eventId}, userId: ${userId}`);
      logger.debug(`DTO: ${JSON.stringify(dto, null, 2)}`);
      const result = await this.eventProfilesService.createProfile(eventId, userId, dto);
      logger.info(`Profile created successfully: ${result?.id}`);
      return result;
    } catch (error) {
      logger.error(`Error creating profile: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch()
  async updateProfile(
    @Param('eventId') eventId: string,
    @Body() updates: Partial<CreateEventProfileDto>,
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`🔄 PATCH update profile for eventId: ${eventId}, userId: ${userId}`);
      logger.debug(`Updates: ${JSON.stringify(updates, null, 2)}`);
      const result = await this.eventProfilesService.updateProfile(eventId, userId, updates);
      logger.info(`Profile updated successfully`);
      return result;
    } catch (error) {
      logger.error(`Error updating profile: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @Get('posts')
  async getPosts(@Param('eventId') eventId: string) {
    try {
      logger.info(`📥 GET posts for eventId: ${eventId}`);
      const result = await this.eventProfilesService.getPosts(eventId);
      logger.info(`Posts retrieved: ${result?.length || 0} posts`);
      return result;
    } catch (error) {
      logger.error(`Error getting posts: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async addPost(
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventProfilePostDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`📤 POST add post for eventId: ${eventId}, userId: ${userId}`);
      logger.debug(`DTO: ${JSON.stringify(dto, null, 2)}`);
      logger.debug(`File received: ${file ? `yes (${file.mimetype}, ${file.size} bytes)` : 'no'}`);
      
      // Если пришел файл, загружаем в сторедж и подставляем публичный URL
      if (file && file.buffer && file.mimetype) {
        logger.info(`📤 Uploading file to storage...`);
        const publicUrl = await this.storageService.uploadEventMedia(userId, {
          buffer: file.buffer,
          mimetype: file.mimetype,
          originalName: file.originalname || 'memory-photo.jpg',
        });
        logger.info(`File uploaded, URL: ${publicUrl}`);
        dto.photoUrl = publicUrl;
        // Дополнительно, если content пуст - заполняем им тоже для обратной совместимости
        if (!dto.content) {
          dto.content = publicUrl;
        }
      }
      
      const result = await this.eventProfilesService.addPost(eventId, userId, dto);
      logger.info(`Post added successfully: ${result?.id}`);
      return result;
    } catch (error) {
      logger.error(`Error adding post: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('posts/:postId')
  async updatePost(
    @Param('eventId') eventId: string,
    @Param('postId') postId: string,
    @Body() updates: Partial<CreateEventProfilePostDto>,
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`🔄 PATCH update post for eventId: ${eventId}, postId: ${postId}, userId: ${userId}`);
      logger.debug(`Updates: ${JSON.stringify(updates, null, 2)}`);
      const result = await this.eventProfilesService.updatePost(eventId, postId, userId, updates);
      logger.info(`Post updated successfully`);
      return result;
    } catch (error) {
      logger.error(`Error updating post: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:postId')
  async deletePost(
    @Param('eventId') eventId: string,
    @Param('postId') postId: string,
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`🗑️ DELETE post for eventId: ${eventId}, postId: ${postId}, userId: ${userId}`);
      const result = await this.eventProfilesService.deletePost(eventId, postId, userId);
      logger.info(`Post deleted successfully`);
      return result;
    } catch (error) {
      logger.error(`Error deleting post: ${error?.message}`, error?.stack);
      throw error;
    }
  }
}

