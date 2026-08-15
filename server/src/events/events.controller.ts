import { Body, Controller, Get, Param, Post, Query, UseGuards, Patch, Delete, Put, UseInterceptors, UploadedFile, BadRequestException, ValidationPipe, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EventsService } from './events.service';
import { EventProfilesService } from './event-profiles.service';
import { CreateEventDto } from './dto/create-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';
import { RequestUser } from '../shared/decorators/request-user.decorator';
import { StorageService } from '../storage/storage.service';
import { createLogger } from '../shared/utils/logger';
import { normalizePublicMediaUrl } from '../shared/public-site';
import type { Express } from 'express';

const logger = createLogger('EventsController');

/** Нормализует URL медиа (trycloudflare, старый домен iventapp.ru → iwent.ru). */
function normalizeEventMediaUrls(event: any): any {
  if (!event) return event;
  if (Array.isArray(event)) {
    return event.map(normalizeEventMediaUrls);
  }
  if (event.mediaUrl) {
    event.mediaUrl = normalizePublicMediaUrl(event.mediaUrl) ?? event.mediaUrl;
  }
  if (event.originalMediaUrl) {
    event.originalMediaUrl = normalizePublicMediaUrl(event.originalMediaUrl) ?? event.originalMediaUrl;
  }
  return event;
}

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly eventProfilesService: EventProfilesService,
    private readonly storageService: StorageService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @RequestUser('userId') userId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true })) createEventDto: CreateEventDto
  ) {
    try {
      logger.info(`📥 POST /events - Creating event for user: ${userId}`);
      logger.info(`DTO keys: ${Object.keys(createEventDto).join(', ')}`);
      logger.info(`DTO mediaUrl: ${createEventDto.mediaUrl ? (createEventDto.mediaUrl.substring(0, 50) + '...') : 'NOT SET'}`);
      logger.info(`DTO originalMediaUrl: ${createEventDto.originalMediaUrl ? (createEventDto.originalMediaUrl.substring(0, 50) + '...') : 'NOT SET'}`);
      logger.debug(`Full DTO: ${JSON.stringify(createEventDto, null, 2)}`);
      const result = await this.eventsService.create(userId, createEventDto);
      logger.info(`✅ Event created successfully: ${result?.id}`);
      return result;
    } catch (error: any) {
      logger.error(`❌ Error creating event: ${error?.message}`);
      logger.error(`Error stack: ${error?.stack}`);
      logger.error(`Error details: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async findAll(
    @Query('organizerId') organizerId?: string,
    @Query('upcoming') upcoming?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
    @RequestUser('userId') currentUserId?: string,
  ) {
    try {
      const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 50, 100) : undefined;
      logger.info(`📥 GET events, limit: ${parsedLimit}, cursor: ${cursor}, currentUserId: ${currentUserId}`);
      const result = await this.eventsService.findAll({
        organizerId,
        upcoming: upcoming === 'true',
        currentUserId,
        limit: parsedLimit,
        cursor,
      });
      logger.info(`Events retrieved: ${result?.length || 0} events`);
      return normalizeEventMediaUrls(result);
    } catch (error) {
      logger.error(`Error getting events: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/requests')
  async listRequests(@Param('id') id: string, @RequestUser('userId') userId: string) {
    try {
      logger.info(`📥 GET requests for eventId: ${id}, userId: ${userId}`);
      // userId теперь может быть как организатором, так и приглашенным пользователем
      const result = await this.eventsService.listPendingRequests(id, userId);
      logger.info(`Requests retrieved: ${result?.length || 0} requests`);
      return result;
    } catch (error) {
      logger.error(`Error getting requests: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  // 📥 ПОЛУЧЕНИЕ ЗАПРОСОВ ПОЛЬЗОВАТЕЛЯ (входящие и исходящие приглашения, а также исходящие join-запросы)
  @UseGuards(JwtAuthGuard)
  @Get('requests/user')
  async getUserRequests(
    @Query('type') type: 'incoming' | 'outgoing' | 'join',
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`📥 GET user requests, userId: ${userId}, type: ${type || 'incoming'}`);
      const result = await this.eventsService.getUserRequests(userId, type || 'incoming');
      logger.info(`User requests retrieved: ${result?.length || 0} requests`);
      return result;
    } catch (error) {
      logger.error(`Error getting user requests: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('recommended/for-user')
  async getRecommended(@RequestUser('userId') userId: string) {
    try {
      logger.info(`GET recommended events for userId: ${userId}`);
      const result = await this.eventsService.getRecommendedEvents(userId);
      logger.info(`Recommended events: ${result?.length || 0}`);
      return normalizeEventMediaUrls(result);
    } catch (error) {
      logger.error(`Error getting recommended events: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @RequestUser('userId') currentUserId?: string) {
    try {
      logger.info(`📥 GET event by id: ${id}, currentUserId: ${currentUserId}`);
      const result = await this.eventsService.findOne(id, currentUserId);
      logger.info(`Event retrieved: ${result ? result.id : 'not found'}`);
      return normalizeEventMediaUrls(result);
    } catch (error) {
      logger.error(`Error getting event: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  async join(@Param('id') id: string, @RequestUser('userId') userId: string) {
    try {
      logger.info(`📤 POST join event: ${id}, userId: ${userId}`);
      const result = await this.eventsService.requestToJoin(id, userId);
      logger.info(`Join request created successfully`);
      return result;
    } catch (error) {
      // Ошибка "Already requested or member" - это ожидаемая ситуация, не логируем как ERROR
      if (error instanceof BadRequestException && error.message?.includes('Already requested or member')) {
        logger.debug(`User ${userId} already requested or is a member of event ${id}`);
      } else {
        logger.error(`Error joining event: ${error?.message}`, error?.stack);
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/invite')
  async invite(
    @Param('id') id: string,
    @Body() body: { userId: string },
    @RequestUser('userId') organizerId: string,
  ) {
    try {
      logger.info(`📤 POST invite user to event: ${id}, organizerId: ${organizerId}, invitedUserId: ${body.userId}`);
      const result = await this.eventsService.inviteUser(id, organizerId, body.userId);
      logger.info(`User invited successfully`);
      return result;
    } catch (error) {
      logger.error(`Error inviting user: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':eventId/requests/:membershipId')
  async respond(
    @Param('eventId') eventId: string,
    @Param('membershipId') membershipId: string,
    @Query('accept') accept: string,
    @RequestUser('userId') userId: string,
  ) {
    try {
      const shouldAccept = accept === 'true';
      logger.info(`🔄 PATCH respond to request: ${eventId}, membershipId: ${membershipId}, userId: ${userId}, accept: ${shouldAccept}`);
      const result = await this.eventsService.respondToRequest(eventId, membershipId, userId, shouldAccept);
      logger.info(`Request responded successfully`);
      return result;
    } catch (error) {
      logger.error(`Error responding to request: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  // 🎯 ПРИНЯТИЕ ПРИГЛАШЕНИЯ
  @UseGuards(JwtAuthGuard)
  @Post('invitations/:membershipId/accept')
  async acceptInvitation(
    @Param('membershipId') membershipId: string,
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`✅ POST accept invitation: ${membershipId}, userId: ${userId}`);
      const result = await this.eventsService.acceptInvitation(membershipId, userId);
      logger.info(`Invitation accepted successfully`);
      return result;
    } catch (error) {
      logger.error(`Error accepting invitation: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  // ❌ ОТКЛОНЕНИЕ ПРИГЛАШЕНИЯ
  @UseGuards(JwtAuthGuard)
  @Post('invitations/:membershipId/reject')
  async rejectInvitation(
    @Param('membershipId') membershipId: string,
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`❌ POST reject invitation: ${membershipId}, userId: ${userId}`);
      const result = await this.eventsService.rejectInvitation(membershipId, userId);
      logger.info(`Invitation rejected successfully`);
      return result;
    } catch (error) {
      logger.error(`Error rejecting invitation: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  // 🚪 ОТМЕНА УЧАСТИЯ
  @UseGuards(JwtAuthGuard)
  @Delete(':eventId/participation/:membershipId')
  async cancelParticipation(
    @Param('eventId') eventId: string,
    @Param('membershipId') membershipId: string,
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`🗑️ DELETE participation: ${eventId}, membershipId: ${membershipId}, userId: ${userId}`);
      const result = await this.eventsService.cancelParticipation(eventId, membershipId, userId);
      logger.info(`Participation cancelled successfully`);
      return result;
    } catch (error) {
      logger.error(`Error cancelling participation: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  // 🚪 ОТМЕНА УЧАСТИЯ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ (без membershipId)
  @UseGuards(JwtAuthGuard)
  @Delete(':eventId/participation')
  async cancelMyParticipation(
    @Param('eventId') eventId: string,
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`🗑️ DELETE my participation: ${eventId}, userId: ${userId}`);
      const result = await this.eventsService.cancelMyParticipation(eventId, userId);
      logger.info(`Participation cancelled successfully, result:`, result);
      return result;
    } catch (error) {
      // Если ошибка "Membership not found", проверяем, не прошедшее ли событие
      // Для прошедших событий удаляем из профиля через EventProfilesService
      if (error instanceof BadRequestException && error.message === 'Membership not found') {
        logger.warn(`Membership not found, checking if event is past...`);
        try {
          // Пытаемся удалить пользователя из профиля через специальный метод
          // Это работает для прошедших событий, где membership может уже не существовать
          const profile = await this.eventProfilesService.getProfile(eventId);
          if (profile) {
            // Удаляем пользователя из participants через updateProfile
            // Сначала получаем текущих participants
            const currentParticipants = profile.participants?.map((p: any) => p.userId || p.user?.id).filter(Boolean) || [];
            const updatedParticipants = currentParticipants.filter((pid: string) => pid !== userId);
            
            logger.debug(`Updating profile participants, removing user: ${userId}`);
            logger.debug(`Current participants: ${currentParticipants.length}, after removal: ${updatedParticipants.length}`);
            
            // Обновляем профиль, удаляя пользователя
            // Нужно обновить через специальный метод, который удаляет из EventProfileParticipant
            const result = await this.eventProfilesService.removeParticipant(eventId, userId);
            
            // Если был удален последний участник - удаляем событие полностью
            if (result.shouldDeleteEvent) {
              logger.info(`🗑️ Последний участник удален, удаляем событие полностью`);
              try {
                await this.eventsService.cancelEvent(eventId, userId);
                logger.info(`Событие полностью удалено`);
                return { success: true, message: 'Event deleted (last participant removed)', eventDeleted: true };
              } catch (deleteError) {
                logger.error(`Ошибка при удалении события:`, deleteError);
              }
            }
            
            logger.info(`User removed from event profile for past event`);
            return { success: true, message: 'Removed from event profile' };
          }
          
          logger.info(`Profile not found, nothing to remove`);
          return { success: true, message: 'Profile not found, nothing to remove' };
        } catch (profileError) {
          logger.error(`Error removing from profile: ${profileError?.message}`, profileError?.stack);
          // Продолжаем с оригинальной ошибкой
        }
      }
      
      logger.error(`Error cancelling participation: ${error?.message}`, error?.stack);
      throw error;
    }
  }
  // 🗑️ ОТМЕНА СОБЫТИЯ (организатор, ≤2 участников)
  @UseGuards(JwtAuthGuard)
  @Delete(':eventId')
  async cancelEvent(
    @Param('eventId') eventId: string,
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`🗑️ DELETE event: ${eventId}, userId: ${userId}`);
      const result = await this.eventsService.cancelEvent(eventId, userId);
      logger.info(`Event cancelled successfully`);
      return result;
    } catch (error) {
      logger.error(`Error cancelling event: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  // 🚶‍♂️ ОТМЕНА УЧАСТИЯ ОРГАНИЗАТОРА (>2 участников)
  @UseGuards(JwtAuthGuard)
  @Delete(':eventId/organizer-participation')
  async cancelOrganizerParticipation(
    @Param('eventId') eventId: string,
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`🗑️ DELETE organizer participation: ${eventId}, userId: ${userId}`);
      const result = await this.eventsService.cancelOrganizerParticipation(eventId, userId);
      logger.info(`Organizer participation cancelled successfully`);
      return result;
    } catch (error) {
      logger.error(`Error cancelling organizer participation: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':eventId/transfer-organizer')
  async transferOrganizerRole(
    @Param('eventId') eventId: string,
    @RequestUser('userId') userId: string,
    @Body() body: { newOrganizerId: string },
  ) {
    try {
      logger.info(`📤 POST transfer organizer role: ${eventId}, from userId: ${userId}, to userId: ${body.newOrganizerId}`);
      const result = await this.eventsService.transferOrganizerRole(eventId, userId, body.newOrganizerId);
      logger.info(`Organizer role transferred successfully`);
      return result;
    } catch (error) {
      logger.error(`Error transferring organizer role: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  // ❌ ОТМЕНА ЗАПРОСА НА УЧАСТИЕ
  @UseGuards(JwtAuthGuard)
  @Delete('requests/:membershipId')
  async cancelJoinRequest(
    @Param('membershipId') membershipId: string,
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`🗑️ DELETE join request: ${membershipId}, userId: ${userId}`);
      const result = await this.eventsService.cancelJoinRequest(membershipId, userId);
      logger.info(`Join request cancelled successfully`);
      return result;
    } catch (error) {
      logger.error(`Error cancelling join request: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @Get(':id/members')
  async members(@Param('id') id: string) {
    try {
      logger.info(`📥 GET members for eventId: ${id}`);
      const result = await this.eventsService.listMembers(id);
      logger.info(`Members retrieved: ${result?.length || 0} members`);
      return result;
    } catch (error) {
      logger.error(`Error getting members: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('media')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      preservePath: false,
    }),
  )
  async uploadMedia(
    @UploadedFile() file: Express.Multer.File | undefined,
    @RequestUser('userId') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const publicUrl = await this.storageService.uploadEventMedia(userId, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalName: file.originalname,
    });

    return { url: publicUrl };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: any,
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`🔄 PATCH update event: ${id}, userId: ${userId}`);
      logger.debug(`Updates: ${JSON.stringify(updateEventDto, null, 2)}`);
      const result = await this.eventsService.update(id, userId, updateEventDto);
      logger.info(`Event updated successfully`);
      return result;
    } catch (error) {
      logger.error(`Error updating event: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':eventId/members/:memberUserId')
  async removeParticipant(
    @Param('eventId') eventId: string,
    @Param('memberUserId') memberUserId: string,
    @RequestUser('userId') organizerId: string,
  ) {
    try {
      logger.info(`🗑️ DELETE remove participant: ${eventId}, memberUserId: ${memberUserId}, organizerId: ${organizerId}`);
      const result = await this.eventsService.removeParticipant(eventId, organizerId, memberUserId);
      logger.info(`Participant removed successfully`);
      return result;
    } catch (error) {
      logger.error(`Error removing participant: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':eventId/personal-photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  async uploadPersonalPhoto(
    @Param('eventId') eventId: string,
    @UploadedFile() file: Express.Multer.File,
    @RequestUser('userId') userId: string,
    @Body() body?: { photoUrl?: string },
  ) {
    try {
      logger.info(`📤 POST upload personal photo: ${eventId}, userId: ${userId}`);
      // Вариант 1: пришёл файл — загружаем в хранилище и сохраняем его публичный URL
      if (file) {
        logger.debug(`File received: ${file.mimetype}, ${file.size} bytes`);
        const buffer = Buffer.from(file.buffer);
        const publicUrl = await this.storageService.uploadEventMedia(userId, {
          buffer,
          mimetype: file.mimetype,
          originalName: file.originalname,
        });
        logger.info(`File uploaded, URL: ${publicUrl}`);
        const result = await this.eventsService.setPersonalPhoto(eventId, userId, publicUrl);
        logger.info(`Personal photo set successfully`);
        return result;
      }
      // Вариант 2: пришёл готовый URL в JSON
      if (body?.photoUrl) {
        logger.debug(`Photo URL received: ${body.photoUrl}`);
        const result = await this.eventsService.setPersonalPhoto(eventId, userId, body.photoUrl);
        logger.info(`Personal photo set successfully`);
        return result;
      }
      // Иначе — нет данных
      logger.error(`No file or photoUrl provided`);
      throw new Error('No file or photoUrl provided');
    } catch (error) {
      logger.error(`Error uploading personal photo: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @Get(':eventId/personal-photos')
  async getPersonalPhotos(@Param('eventId') eventId: string) {
    try {
      logger.info(`📥 GET personal photos for eventId: ${eventId}`);
      const result = await this.eventsService.getPersonalPhotos(eventId);
      logger.info(`Personal photos retrieved: ${result?.length || 0} photos`);
      return result;
    } catch (error) {
      logger.error(`Error getting personal photos: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  // 🔄 ПРОДЛЕНИЕ РЕГУЛЯРНОГО СОБЫТИЯ
  @UseGuards(JwtAuthGuard)
  @Put(':eventId/extend')
  async extendRecurringEvent(
    @Param('eventId') eventId: string,
    @Body() body: {
      recurringType?: 'daily' | 'weekly' | 'monthly' | 'custom';
      recurringDays?: number[];
      recurringDayOfMonth?: number;
      recurringCustomDates?: string[];
    },
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`🔄 PUT extend recurring event: ${eventId}, userId: ${userId}`);
      logger.debug(`Body: ${JSON.stringify(body, null, 2)}`);
      const result = await this.eventsService.extendRecurringEvent(eventId, userId, body);
      logger.info(`Recurring event extended successfully`);
      return result;
    } catch (error) {
      logger.error(`Error extending recurring event: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  // 🏷️ ДОБАВЛЕНИЕ ПОЛЬЗОВАТЕЛЬСКИХ МЕТОК
  @UseGuards(JwtAuthGuard)
  @Post(':eventId/tags')
  async addTags(
    @Param('eventId') eventId: string,
    @Body() body: { tags: string[] },
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`🏷️ POST add tags: ${eventId}, userId: ${userId}, tags:`, body.tags);
      const result = await this.eventsService.addCustomTags(eventId, userId, body.tags);
      logger.info(`Tags added successfully`);
      return result;
    } catch (error) {
      logger.error(`Error adding tags: ${error?.message}`, error?.stack);
      console.error('[EventsController] ❌ Error stack:', error?.stack);
      throw error;
    }
  }

  // 🏷️ УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЬСКИХ МЕТОК
  @UseGuards(JwtAuthGuard)
  @Delete(':eventId/tags')
  async removeTags(
    @Param('eventId') eventId: string,
    @Body() body: { tags: string[] },
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`🗑️ DELETE remove tags: ${eventId}, userId: ${userId}, tags:`, body.tags);
      const result = await this.eventsService.removeCustomTags(eventId, userId, body.tags);
      logger.info(`Tags removed successfully`);
      return result;
    } catch (error) {
      logger.error(`Error removing tags: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  // 🏷️ ОБНОВЛЕНИЕ АВТОМАТИЧЕСКИХ МЕТОК
  @UseGuards(JwtAuthGuard)
  @Get(':eventId/refresh-tags')
  async refreshTags(
    @Param('eventId') eventId: string,
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`🔄 GET refresh tags: ${eventId}, userId: ${userId}`);
      const result = await this.eventsService.refreshAutoTags(eventId, userId);
      logger.info(`Tags refreshed successfully`);
      return result;
    } catch (error) {
      logger.error(`Error refreshing tags: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  // 📅 ПРИСОЕДИНЕНИЕ К РЕГУЛЯРНОМУ СОБЫТИЮ
  @UseGuards(JwtAuthGuard)
  @Post(':eventId/join-recurring')
  async joinRecurringEvent(
    @Param('eventId') eventId: string,
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`📤 POST join recurring event: ${eventId}, userId: ${userId}`);
      const result = await this.eventsService.joinRecurringEvent(eventId, userId);
      logger.info(`Joined recurring event successfully`);
      return result;
    } catch (error) {
      logger.error(`Error joining recurring event: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  // 📅 ОТМЕНА УЧАСТИЯ В РЕГУЛЯРНОМ СОБЫТИИ
  @UseGuards(JwtAuthGuard)
  @Delete(':eventId/participation-recurring')
  async cancelRecurringParticipation(
    @Param('eventId') eventId: string,
    @RequestUser('userId') userId: string,
  ) {
    try {
      logger.info(`🗑️ DELETE cancel recurring participation: ${eventId}, userId: ${userId}`);
      const result = await this.eventsService.cancelRecurringParticipation(eventId, userId);
      logger.info(`Recurring participation cancelled successfully`);
      return result;
    } catch (error) {
      logger.error(`Error cancelling recurring participation: ${error?.message}`, error?.stack);
      throw error;
    }
  }
}
