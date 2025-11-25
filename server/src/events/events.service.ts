import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventRole, MembershipStatus, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatsService } from '../chats/chats.service';
import { WebSocketService } from '../ws/websocket.service';
import { RecurringEventsService } from './recurring-events.service';
import { TagsService } from './tags.service';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('EventsService');

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly chatsService: ChatsService,
    private readonly websocketService: WebSocketService,
    private readonly recurringEventsService: RecurringEventsService,
    private readonly tagsService: TagsService,
  ) {}

  async create(organizerId: string, dto: CreateEventDto) {
    // Проверяем, не заблокирован ли пользователь
    const organizer = await this.prisma.user.findUnique({
      where: { id: organizerId },
    });

    if (!organizer) {
      throw new ForbiddenException('User not found');
    }

    if ((organizer as any).isBlocked) {
      throw new ForbiddenException('Blocked users cannot create events');
    }

    const {
      invitedUserIds,
      coordinates,
      isRecurring,
      recurringType,
      recurringDays,
      recurringDayOfMonth,
      recurringCustomDates,
      customTags,
      ageRestriction,
      genderRestriction,
      mediaType,
      mediaAspectRatio,
      targeting,
      originalMediaUrl,
      ...eventData
    } = dto;
    
    try {
      // Преобразуем recurringCustomDates в Date[]
      const customDatesArray = recurringCustomDates
        ? recurringCustomDates.map((d) => new Date(d))
        : undefined;

      // Метки - фильтруем дубликаты автоматических тегов из пользовательских
      // Автоматические теги: 'recurring', 'women_only', 'age_18_plus', 'starting_soon'
      const autoTagsToFilter = ['recurring', 'women_only', 'age_18_plus', 'starting_soon', 'регулярное', 'women only', '18+'];
      const filteredCustomTags = (customTags || []).filter(tag => {
        const normalizedTag = tag.toLowerCase().trim();
        return !autoTagsToFilter.some(autoTag => autoTag.toLowerCase().trim() === normalizedTag);
      });

      const event = await this.prisma.event.create({
        data: {
          organizer: {
            connect: { id: organizerId }
          },
          title: eventData.title,
          description: eventData.description || null,
          startTime: new Date(eventData.startTime),
          endTime: eventData.endTime ? new Date(eventData.endTime) : null,
          location: eventData.location || null,
          mediaUrl: eventData.mediaUrl || null,
          originalMediaUrl: originalMediaUrl || null,
          maxParticipants: eventData.maxParticipants,
          price: eventData.price || null,
          latitude: coordinates?.latitude ?? null,
          longitude: coordinates?.longitude ?? null,
          // Поля для регулярных событий
          isRecurring: isRecurring || false,
          recurringType: recurringType || null,
          recurringDays: recurringDays || [],
          recurringDayOfMonth: recurringDayOfMonth || null,
          recurringCustomDates: customDatesArray || [],
          // Метки
          customTags: filteredCustomTags,
          autoTags: [], // Будет заполнено автоматически
          // Дополнительные поля
          ageRestriction: ageRestriction || null,
          genderRestriction: Array.isArray(genderRestriction) ? genderRestriction : [],
          mediaType: mediaType || null,
          mediaAspectRatio: mediaAspectRatio || null,
          targeting: targeting || null,
          memberships: {
            create: [
              {
                userId: organizerId,
                role: EventRole.ORGANIZER,
                status: MembershipStatus.ACCEPTED,
              },
              // Create invitations for invited users
              ...(invitedUserIds?.map(userId => ({
                userId,
                role: EventRole.PARTICIPANT,
                status: MembershipStatus.PENDING,
                invitedBy: organizerId, // Mark as invitation
              })) || []),
            ],
          },
        } as any, // Временный workaround до обновления Prisma Client типов
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            bio: true,
            age: true,
            geoPosition: true,
          },
        },
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
        personalPhotos: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Отправляем WebSocket событие о создании нового события
    // Отправляем всем пользователям (событие может быть интересно всем)
    this.websocketService.emitToAll('event:created', {
      id: event.id,
      title: event.title,
      organizerId: event.organizerId,
      startTime: event.startTime,
      location: event.location,
      mediaUrl: event.mediaUrl,
      organizer: (event as any).organizer,
    });

    // Также подключаем организатора к комнате события
    await this.websocketService.joinEventRoom(organizerId, event.id);

    // Обновляем автоматические теги после создания события
    console.log(`[EventsService] Calling updateAutoTags for event ${event.id}`);
    const autoTagsResult = await this.tagsService.updateAutoTags(event.id);
    console.log(`[EventsService] updateAutoTags returned:`, autoTagsResult);

    // Если событие регулярное, создаем участие для организатора
    if (isRecurring) {
      await this.recurringEventsService.createOrUpdateParticipation(event.id, organizerId);
    }

    // Получаем обновленное событие с тегами
    const updatedEvent = await this.prisma.event.findUnique({
      where: { id: event.id },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            bio: true,
            age: true,
            geoPosition: true,
          },
        },
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
        personalPhotos: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Логируем теги для отладки
    if (updatedEvent) {
      const eventWithTags = updatedEvent as any;
      console.log(`[EventsService] Event ${eventWithTags.id} tags:`, {
        autoTags: eventWithTags.autoTags,
        customTags: eventWithTags.customTags,
      });
    }

    return updatedEvent;
    } catch (error) {
      console.error('[EventsService] Error creating event:', error);
      console.error('[EventsService] Error name:', error?.name);
      console.error('[EventsService] Error message:', error?.message);
      console.error('[EventsService] Error stack:', error?.stack);
      console.error('[EventsService] DTO received:', JSON.stringify(dto, null, 2));
      console.error('[EventsService] eventData:', JSON.stringify(eventData, null, 2));
      console.error('[EventsService] coordinates:', JSON.stringify(coordinates, null, 2));
      throw error;
    }
  }

  findAll(params: { upcoming?: boolean; organizerId?: string; currentUserId?: string }) {
    return this.prisma.event.findMany({
      where: {
        organizerId: params.organizerId,
        ...(params.upcoming ? { startTime: { gte: new Date() } } : {}),
      },
      orderBy: { startTime: 'asc' },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            bio: true,
            age: true,
            geoPosition: true,
          },
        },
        memberships: {
          where: {
            OR: [
              { status: MembershipStatus.ACCEPTED },
              // Include pending memberships for current user (incoming invitations)
              ...(params.currentUserId
                ? [{ userId: params.currentUserId, status: MembershipStatus.PENDING }]
                : []),
              // Include pending memberships where current user is organizer (outgoing invitations)
              ...(params.currentUserId
                ? [{ invitedBy: params.currentUserId, status: MembershipStatus.PENDING }]
                : []),
            ],
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
        personalPhotos: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  async findOne(id: string, currentUserId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            bio: true,
            age: true,
            geoPosition: true,
          },
        },
        memberships: {
          where: {
            OR: [
              { status: MembershipStatus.ACCEPTED },
              // Include pending memberships for current user (incoming invitations)
              ...(currentUserId
                ? [{ userId: currentUserId, status: MembershipStatus.PENDING }]
                : []),
              // Include pending memberships where current user is organizer (outgoing invitations)
              ...(currentUserId
                ? [{ invitedBy: currentUserId, status: MembershipStatus.PENDING }]
                : []),
            ],
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
        personalPhotos: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    return event;
  }

  async update(id: string, userId: string, dto: UpdateEventDto) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    if (event.organizerId !== userId) {
      throw new ForbiddenException('Only organizer can update event');
    }

    const {
      coordinates,
      isRecurring,
      recurringType,
      recurringDays,
      recurringDayOfMonth,
      recurringCustomDates,
      customTags,
      ageRestriction,
      genderRestriction,
      mediaType,
      mediaAspectRatio,
      targeting,
      ...eventData
    } = dto;
    
    // Определяем, какие поля изменились
    const changedFields: string[] = [];
    if (dto.location && dto.location !== event.location) {
      changedFields.push('место');
    }
    if (dto.startTime && new Date(dto.startTime).getTime() !== event.startTime.getTime()) {
      changedFields.push('время');
    }
    if (dto.title && dto.title !== event.title) {
      changedFields.push('название');
    }
    if (dto.description !== undefined && dto.description !== event.description) {
      changedFields.push('описание');
    }

    // Преобразуем recurringCustomDates в Date[]
    const customDatesArray = recurringCustomDates
      ? recurringCustomDates.map((d) => new Date(d))
      : undefined;
    
    const updatedEvent = await this.prisma.event.update({
      where: { id },
      data: {
        ...eventData,
        ...(coordinates ? {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        } : {}),
        // Поля для регулярных событий
        ...(isRecurring !== undefined ? { isRecurring } : {}),
        ...(recurringType !== undefined ? { recurringType } : {}),
        ...(recurringDays !== undefined ? { recurringDays } : {}),
        ...(recurringDayOfMonth !== undefined ? { recurringDayOfMonth } : {}),
        ...(customDatesArray !== undefined ? { recurringCustomDates: customDatesArray } : {}),
        // Метки
        ...(customTags !== undefined ? { customTags } : {}),
        // Дополнительные поля
        ...(ageRestriction !== undefined ? { ageRestriction } : {}),
        ...(genderRestriction !== undefined ? { genderRestriction } : {}),
        ...(mediaType !== undefined ? { mediaType } : {}),
        ...(mediaAspectRatio !== undefined ? { mediaAspectRatio } : {}),
        ...(targeting !== undefined ? { targeting } : {}),
      },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            bio: true,
            age: true,
            geoPosition: true,
          },
        },
        memberships: {
          where: { status: MembershipStatus.ACCEPTED },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Создаем уведомления для участников об изменении параметров
    if (changedFields.length > 0) {
      const organizer = updatedEvent.organizer;
      const changedFieldText = changedFields.join(', ');
      
      await this.notificationsService.notifyEventParticipants(
        id,
        userId,
        'EVENT_UPDATED' as NotificationType,
        {
          actorId: userId,
          actorName: organizer.name || organizer.username,
          changedField: changedFieldText,
        },
      );
    }

    // Отправляем WebSocket событие об обновлении события
    await this.websocketService.emitToEventParticipants(
      id,
      userId,
      'event:updated',
      {
        ...updatedEvent,
        changedFields,
      },
    );

    // Также отправляем всем пользователям (для обновления в лентах)
    this.websocketService.emitToAll('event:updated', {
      ...updatedEvent,
      changedFields,
    });

    return updatedEvent;
  }

  async remove(id: string, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    if (event.organizerId !== userId) {
      throw new ForbiddenException('Only organizer can delete event');
    }

    // Delete all memberships first (cascade)
    await this.prisma.eventMembership.deleteMany({ where: { eventId: id } });
    
    // Отправляем WebSocket событие об удалении события ПЕРЕД удалением
    // Отправляем всем участникам события
    await this.websocketService.emitToEventParticipants(
      id,
      userId,
      'event:deleted',
      { eventId: id },
    );

    // Также отправляем всем пользователям (для обновления в лентах)
    this.websocketService.emitToAll('event:deleted', { eventId: id });
    
    // Delete the event
    await this.prisma.event.delete({ where: { id } });
    
    return { success: true, eventId: id };
  }

  async removeParticipant(eventId: string, organizerId: string, memberUserId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    if (event.organizerId !== organizerId) {
      throw new ForbiddenException('Only organizer can remove participants');
    }

    const membership = await this.prisma.eventMembership.findUnique({
      where: { userId_eventId: { userId: memberUserId, eventId } },
    });
    if (!membership) {
      throw new BadRequestException('Membership not found');
    }
    if (membership.role === EventRole.ORGANIZER) {
      throw new BadRequestException('Cannot remove organizer');
    }

    return this.prisma.eventMembership.delete({
      where: { id: membership.id },
    });
  }

  async requestToJoin(eventId: string, userId: string) {
    // Проверяем, не заблокирован ли пользователь
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if ((user as any).isBlocked) {
      throw new ForbiddenException('Blocked users cannot join events');
    }
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new BadRequestException('Event not found');

    const existing = await this.prisma.eventMembership.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });

    if (existing) {
      if (existing.status === MembershipStatus.REJECTED) {
        return this.prisma.eventMembership.update({
          where: { id: existing.id },
          data: { status: MembershipStatus.PENDING },
        });
      }
      throw new BadRequestException('Already requested or member');
    }

    const membership = await this.prisma.eventMembership.create({
      data: {
        eventId,
        userId,
        role: EventRole.PARTICIPANT,
        status: MembershipStatus.PENDING,
      },
    });

    // Отправляем WebSocket событие о создании нового запроса на участие
    // Отправляем организатору события
    this.websocketService.emitToUser(event.organizerId, 'event:request:new', {
      eventId,
      membershipId: membership.id,
      userId,
      type: 'request',
    });

    // Также отправляем в комнату события
    await this.websocketService.emitToEventParticipants(
      eventId,
      userId,
      'event:request:new',
      {
        eventId,
        membershipId: membership.id,
        userId,
        type: 'request',
      },
    );

    return membership;
  }

  async respondToRequest(eventId: string, membershipId: string, organizerId: string, accept: boolean) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    if (event.organizerId !== organizerId) {
      throw new ForbiddenException();
    }

    const membership = await this.prisma.eventMembership.findUnique({ where: { id: membershipId } });
    if (!membership || membership.eventId !== eventId) {
      throw new BadRequestException('Membership not found for this event');
    }

    // Проверяем количество участников ДО обновления статуса
    const acceptedCountBefore = await this.prisma.eventMembership.count({
      where: {
        eventId,
        status: MembershipStatus.ACCEPTED,
      },
    });

    const updatedMembership = await this.prisma.eventMembership.update({
      where: { id: membershipId },
      data: { status: accept ? MembershipStatus.ACCEPTED : MembershipStatus.REJECTED },
    });

    // Если запрос был принят и это первый участник (организатор не считается)
    if (accept && acceptedCountBefore === 0) {
      // Создаем чат события автоматически с организатором и первым участником
      try {
        await this.chatsService.createEventChat(
          organizerId,
          eventId,
          [organizerId, membership.userId],
        );
        console.log(`[EventsService] Event chat created automatically for event ${eventId}`);
      } catch (error) {
        console.error(`[EventsService] Failed to create event chat:`, error);
        // Не прерываем выполнение, если создание чата не удалось
      }
    } else if (accept && acceptedCountBefore > 0) {
      // Если чат уже существует, добавляем нового участника
      try {
        const existingChat = await this.prisma.chat.findUnique({
          where: { eventId },
          include: { participants: true },
        });

        if (existingChat) {
          const isParticipant = existingChat.participants.some(
            p => p.userId === membership.userId,
          );
          if (!isParticipant) {
            await this.prisma.chatParticipant.create({
              data: {
                chatId: existingChat.id,
                userId: membership.userId,
              },
            });
            console.log(`[EventsService] Added participant ${membership.userId} to event chat`);
          }
        } else {
          // Если чат почему-то не существует, создаем его
          await this.chatsService.createEventChat(
            organizerId,
            eventId,
            [organizerId, membership.userId],
          );
          console.log(`[EventsService] Event chat created for event ${eventId} (late creation)`);
        }
      } catch (error) {
        console.error(`[EventsService] Failed to add participant to event chat:`, error);
        // Не прерываем выполнение
      }
    }

    // Отправляем WebSocket событие об обновлении статуса запроса
    await this.websocketService.emitToEventParticipants(
      eventId,
      organizerId,
      'event:request:updated',
      {
        eventId,
        membershipId: updatedMembership.id,
        userId: membership.userId,
        status: accept ? 'ACCEPTED' : 'REJECTED',
        type: 'request',
      },
    );
    
    // Отправляем пользователю, который отправил запрос
    this.websocketService.emitToUser(membership.userId, 'event:request:status', {
      eventId,
      membershipId: updatedMembership.id,
      status: accept ? 'ACCEPTED' : 'REJECTED',
      type: 'request',
    });

    // Подключаем пользователя к комнате события, если запрос принят
    if (accept) {
      await this.websocketService.joinEventRoom(membership.userId, eventId);
    }

    return updatedMembership;
  }

  // 🎯 ПРИНЯТИЕ ПРИГЛАШЕНИЯ (invited → accepted)
  async acceptInvitation(membershipId: string, userId: string) {
    const membership = await this.prisma.eventMembership.findUnique({
      where: { id: membershipId },
      include: { 
        event: true,
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!membership) {
      throw new BadRequestException('Invitation not found');
    }

    // Валидация
    if (membership.userId !== userId) {
      throw new ForbiddenException('Not your invitation');
    }
    if (membership.status !== MembershipStatus.PENDING) {
      throw new BadRequestException('Invitation already processed');
    }
    if (!membership.invitedBy) {
      throw new BadRequestException('Not an invitation');
    }

    const event = membership.event;
    const user = membership.user;

    // Проверка лимита участников
    const acceptedCountBefore = await this.prisma.eventMembership.count({
      where: {
        eventId: event.id,
        status: MembershipStatus.ACCEPTED,
      },
    });

    if (acceptedCountBefore >= event.maxParticipants) {
      throw new BadRequestException('Event is full');
    }

    // Транзакция обновления
    const updatedMembership = await this.prisma.$transaction(async (tx) => {
      // 1. Обновляем статус приглашения
      const updated = await tx.eventMembership.update({
        where: { id: membershipId },
        data: {
          status: MembershipStatus.ACCEPTED,
        },
      });

      // 2. Удаляем другие pending запросы пользователя на это событие
      await tx.eventMembership.deleteMany({
        where: {
          eventId: event.id,
          userId,
          status: MembershipStatus.PENDING,
          id: { not: membershipId }, // Не удаляем текущее приглашение
        },
      });

      return updated;
    });

    // Если это первый участник (организатор не считается), создаем чат события автоматически
    if (acceptedCountBefore === 0) {
      try {
        await this.chatsService.createEventChat(
          event.organizerId,
          event.id,
          [event.organizerId, userId],
        );
        console.log(`[EventsService] Event chat created automatically for event ${event.id} (via invitation)`);
      } catch (error) {
        console.error(`[EventsService] Failed to create event chat:`, error);
        // Не прерываем выполнение
      }
    } else {
      // Если чат уже существует, добавляем нового участника
      try {
        const existingChat = await this.prisma.chat.findUnique({
          where: { eventId: event.id },
          include: { participants: true },
        });

        if (existingChat) {
          const isParticipant = existingChat.participants.some(
            p => p.userId === userId,
          );
          if (!isParticipant) {
            await this.prisma.chatParticipant.create({
              data: {
                chatId: existingChat.id,
                userId: userId,
              },
            });
            console.log(`[EventsService] Added participant ${userId} to event chat (via invitation)`);
          }
        } else {
          // Если чат почему-то не существует, создаем его
          await this.chatsService.createEventChat(
            event.organizerId,
            event.id,
            [event.organizerId, userId],
          );
          console.log(`[EventsService] Event chat created for event ${event.id} (late creation via invitation)`);
        }
      } catch (error) {
        console.error(`[EventsService] Failed to add participant to event chat:`, error);
        // Не прерываем выполнение
      }
    }

    // Отправляем WebSocket событие о принятии приглашения
    await this.websocketService.emitToEventParticipants(
      event.id,
      userId,
      'event:request:updated',
      {
        eventId: event.id,
        membershipId: updatedMembership.id,
        userId,
        status: 'ACCEPTED',
        type: 'invitation',
      },
    );

    // Подключаем пользователя к комнате события
    await this.websocketService.joinEventRoom(userId, event.id);

    // Создаем уведомления для всех участников о присоединении нового участника
    await this.notificationsService.notifyEventParticipants(
      event.id,
      userId,
      'EVENT_PARTICIPANT_JOINED' as NotificationType,
      {
        actorId: userId,
        actorName: user.name || user.username,
      },
    );

    return updatedMembership;
  }

  // ❌ ОТКЛОНЕНИЕ ПРИГЛАШЕНИЯ (invited → rejected)
  async rejectInvitation(membershipId: string, userId: string) {
    const membership = await this.prisma.eventMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new BadRequestException('Invitation not found');
    }

    // Валидация
    if (membership.userId !== userId) {
      throw new ForbiddenException('Not your invitation');
    }
    if (membership.status !== MembershipStatus.PENDING) {
      throw new BadRequestException('Invitation already processed');
    }

    // Обновляем статус
    const updatedMembership = await this.prisma.eventMembership.update({
      where: { id: membershipId },
      data: {
        status: MembershipStatus.REJECTED,
      },
      include: {
        event: {
          select: { id: true, organizerId: true },
        },
      },
    });

    // Отправляем WebSocket событие об отклонении приглашения
    if (updatedMembership.event) {
      await this.websocketService.emitToEventParticipants(
        updatedMembership.event.id,
        userId,
        'event:request:updated',
        {
          eventId: updatedMembership.event.id,
          membershipId: updatedMembership.id,
          userId,
          status: 'REJECTED',
          type: 'invitation',
        },
      );

      // Отправляем организатору события
      this.websocketService.emitToUser(updatedMembership.event.organizerId, 'event:request:status', {
        eventId: updatedMembership.event.id,
        membershipId: updatedMembership.id,
        userId,
        status: 'REJECTED',
        type: 'invitation',
      });
    }

    return updatedMembership;
  }

  // 🚪 ОТМЕНА УЧАСТИЯ (accepted → non_member)
  async cancelParticipation(eventId: string, membershipId: string, userId: string) {
    const membership = await this.prisma.eventMembership.findUnique({
      where: { id: membershipId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!membership) {
      throw new BadRequestException('Membership not found');
    }
    if (membership.userId !== userId) {
      throw new ForbiddenException('Can only cancel own participation');
    }
    if (membership.eventId !== eventId) {
      throw new BadRequestException('Membership does not belong to this event');
    }
    if (membership.status !== MembershipStatus.ACCEPTED) {
      throw new BadRequestException('Can only cancel accepted participation');
    }

    const user = membership.user;

    // Создаем уведомления для всех участников об удалении участника (перед удалением)
    await this.notificationsService.notifyEventParticipants(
      eventId,
      userId,
      'EVENT_PARTICIPANT_LEFT' as NotificationType,
      {
        actorId: userId,
        actorName: user.name || user.username,
      },
    );

    // Удаляем membership
    return this.prisma.eventMembership.delete({
      where: { id: membershipId },
    });
  }

  // 🚪 ОТМЕНА УЧАСТИЯ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ БЕЗ ЯВНОГО membershipId
  async cancelMyParticipation(eventId: string, userId: string) {
    console.log('[EventsService] 🗑️ cancelMyParticipation: eventId:', eventId, 'userId:', userId);
    
    // СНАЧАЛА проверяем, прошедшее ли событие (это важно для обработки прошедших событий)
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      console.error('[EventsService] ❌ Event not found:', eventId);
      throw new BadRequestException('Event not found');
    }
    
    const isPastEvent = event && event.endTime ? new Date(event.endTime) < new Date() : false;
    console.log('[EventsService] Event found, isPastEvent:', isPastEvent, 'endTime:', event.endTime);
    
    const membership = await this.prisma.eventMembership.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    logger.debug(`Membership found: ${!!membership}, isPastEvent: ${isPastEvent}`);
    
    // Если membership не найден, но событие прошедшее - удаляем из профиля события
    if (!membership && isPastEvent) {
      logger.info(`Membership not found, but event is past - removing from event profile`);
      // Удаляем пользователя из профиля события (для Memories)
      const profile = await this.prisma.eventProfile.findUnique({
        where: { eventId },
        include: {
          participants: true,
        },
      });

      logger.debug(`Profile found: ${!!profile}, participants count: ${profile?.participants?.length || 0}`);

      // Если профиль не существует - удалять нечего, возвращаем успех
      if (!profile) {
        logger.info(`Profile not found for past event, nothing to remove`);
        return { success: true, message: 'Profile not found, nothing to remove' };
      }

      // Удаляем пользователя из participants профиля
      const deleted = await this.prisma.eventProfileParticipant.deleteMany({
        where: {
          profileId: profile.id,
          userId: userId,
        },
      });
      
      const remainingCount = profile.participants.length - deleted.count;
      logger.info(`User removed from event profile for past event, deleted: ${deleted.count}`);
      logger.info(`Remaining participants: ${remainingCount}`);
      
      // КРИТИЧЕСКИ ВАЖНО: Если участников стало 0 (или был 1 и его удалили) - удаляем событие полностью
      if (remainingCount === 0 || (profile.participants.length === 1 && deleted.count === 1)) {
        logger.info(`🗑️ Последний участник удален, удаляем событие полностью`);
        
        // Удаляем событие полностью через cancelEvent
        try {
          await this.cancelEvent(eventId, userId);
          logger.info(`Событие полностью удалено`);
          return { success: true, message: 'Event deleted (last participant removed)', eventDeleted: true };
        } catch (cancelError) {
          logger.error(`Ошибка при удалении события:`, cancelError);
          // Продолжаем с обычным удалением из профиля
        }
      }
      
      return { success: true, message: 'Removed from event profile', deletedCount: deleted.count };
    }
    
    // Если membership не найден и событие не прошедшее - ошибка
    if (!membership) {
      logger.error(`Membership not found and event is not past`);
      throw new BadRequestException('Membership not found');
    }
    if (membership.status !== MembershipStatus.ACCEPTED) {
      throw new BadRequestException('Only accepted membership can be cancelled');
    }

    const user = membership.user;

    // Удаляем пользователя из профиля события (если профиль существует)
    const profile = await this.prisma.eventProfile.findUnique({
      where: { eventId },
      include: {
        participants: true,
      },
    });

    if (profile) {
      const participantsBefore = profile.participants.length;
      
      const deleted = await this.prisma.eventProfileParticipant.deleteMany({
        where: {
          profileId: profile.id,
          userId: userId,
        },
      });
      
      const remainingCount = participantsBefore - deleted.count;
      logger.info(`User removed from event profile, remaining participants: ${remainingCount}`);
      
      // КРИТИЧЕСКИ ВАЖНО: Если участников стало 0 (или был 1 и его удалили) - удаляем событие полностью
      if (remainingCount === 0 || (participantsBefore === 1 && deleted.count === 1)) {
        logger.info(`🗑️ Последний участник удален, удаляем событие полностью`);
        
        // Удаляем событие полностью через cancelEvent
        try {
          await this.cancelEvent(eventId, userId);
          logger.info(`Событие полностью удалено`);
          return { success: true, message: 'Event deleted (last participant removed)', eventDeleted: true };
        } catch (cancelError) {
          logger.error(`Ошибка при удалении события:`, cancelError);
          // Продолжаем с обычным удалением из профиля
        }
      }
    }

    // Создаем уведомления для всех участников об удалении участника (перед удалением)
    await this.notificationsService.notifyEventParticipants(
      eventId,
      userId,
      'EVENT_PARTICIPANT_LEFT' as NotificationType,
      {
        actorId: userId,
        actorName: user.name || user.username,
      },
    );

    return this.prisma.eventMembership.delete({ where: { id: membership.id } });
  }
  // 🗑️ ОТМЕНА СОБЫТИЯ (organizer, ≤2 участников)
  async cancelEvent(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
        memberships: {
          where: { status: MembershipStatus.ACCEPTED },
        },
      },
    });

    if (!event) {
      throw new BadRequestException('Event not found');
    }

    // Валидация: для прошедших событий (Memories) разрешаем удаление организатору и участникам
    const isPast = event.startTime < new Date();
    const isOrganizer = event.organizerId === userId;
    const isParticipant = event.memberships.some(m => m.userId === userId && m.status === MembershipStatus.ACCEPTED);
    
    // КРИТИЧЕСКИ ВАЖНО: Проверяем также участников в EventProfile, так как для прошедших событий
    // может не быть активного membership, но пользователь может быть в профиле события
    let isProfileParticipant = false;
    if (isPast) {
      const profile = await this.prisma.eventProfile.findUnique({
        where: { eventId },
        include: {
          participants: true,
        },
      });
      if (profile) {
        isProfileParticipant = profile.participants.some(p => p.userId === userId);
      }
    }
    
    if (!isPast && !isOrganizer) {
      // Для будущих событий только организатор может отменить
      throw new ForbiddenException('Only organizer can cancel event');
    }
    
    // Для прошедших событий разрешаем удаление организатору, участнику или бывшему участнику профиля
    if (isPast && !isOrganizer && !isParticipant && !isProfileParticipant) {
      // Для прошедших событий (Memories) удаление разрешено только организатору или участнику
      throw new ForbiddenException('Only organizer or participant can delete past event');
    }

    const acceptedCount = event.memberships.length;
    const organizer = event.organizer;

    // Создаем уведомления для участников об отмене события (перед удалением)
    await this.notificationsService.notifyEventParticipants(
      eventId,
      userId,
      'EVENT_CANCELLED' as NotificationType,
      {
        actorId: userId,
        actorName: organizer.name || organizer.username,
      },
    );

    // Транзакция корректной отмены/удаления события с учётом внешних ключей
    return this.prisma.$transaction(async (tx) => {
      // 1) Переводим активные membership в REJECTED и удаляем все привязки по событию
      await tx.eventMembership.updateMany({
        where: { eventId, status: { in: [MembershipStatus.PENDING, MembershipStatus.ACCEPTED] } },
        data: { status: MembershipStatus.REJECTED },
      });
      await tx.eventMembership.deleteMany({ where: { eventId } });

      // 2) Удаляем персональные фото для события
      await tx.eventPersonalPhoto.deleteMany({ where: { eventId } });

      // 3) Обнуляем ссылку на событие в сообщениях (поле eventId опционально)
      await tx.message.updateMany({ where: { eventId }, data: { eventId: null } });

      // 4) Если есть связанный чат — удаляем его и зависимые записи
      const chat = await tx.chat.findUnique({ where: { eventId } });
      if (chat) {
        await tx.message.deleteMany({ where: { chatId: chat.id } });
        await tx.chatParticipant.deleteMany({ where: { chatId: chat.id } });
        await tx.folderChat.deleteMany({ where: { chatId: chat.id } });
        await tx.chat.delete({ where: { id: chat.id } });
      }

      // 5) Профиль события (EventProfile) привязан к Event с onDelete: Cascade — удалится вместе с событием.
      await tx.event.delete({ where: { id: eventId } });

      return { participantsAffected: acceptedCount };
    });
  }

  // 🚶‍♂️ ОТМЕНА УЧАСТИЯ ОРГАНИЗАТОРА (>2 участников)
  async cancelOrganizerParticipation(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
        memberships: {
          where: { status: MembershipStatus.ACCEPTED },
        },
      },
    });

    if (!event) {
      throw new BadRequestException('Event not found');
    }

    // Валидация
    if (event.organizerId !== userId) {
      throw new ForbiddenException('Not organizer');
    }

    const acceptedCount = event.memberships.length;
    if (acceptedCount <= 2) {
      throw new BadRequestException('Use cancelEvent for events with ≤2 participants');
    }

    const organizer = event.organizer;

    // Создаем уведомления для участников об отказе организатора от участия
    await this.notificationsService.notifyEventParticipants(
      eventId,
      userId,
      'EVENT_CANCELLED' as NotificationType,
      {
        actorId: userId,
        actorName: organizer.name || organizer.username,
      },
    );

    // Удаляем membership организатора, но оставляем событие
    const organizerMembership = await this.prisma.eventMembership.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    });

    if (organizerMembership) {
      await this.prisma.eventMembership.delete({
        where: { id: organizerMembership.id },
      });
    }

    // Обновляем событие - назначаем первого участника новым организатором
    // organizerId обязательное поле, поэтому нужно назначить нового организатора
    const firstParticipant = await this.prisma.eventMembership.findFirst({
      where: {
        eventId,
        status: MembershipStatus.ACCEPTED,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (firstParticipant) {
      // Устанавливаем первого участника как нового организатора
      await this.prisma.event.update({
        where: { id: eventId },
        data: {
          organizerId: firstParticipant.userId,
        },
      });
    } else {
      // Если нет участников — полностью удаляем событие, корректно очистив зависимости
      await this.prisma.$transaction(async (tx) => {
        await tx.eventMembership.deleteMany({ where: { eventId } });
        await tx.eventPersonalPhoto.deleteMany({ where: { eventId } });
        await tx.message.updateMany({ where: { eventId }, data: { eventId: null } });
        const chat = await tx.chat.findUnique({ where: { eventId } });
        if (chat) {
          await tx.message.deleteMany({ where: { chatId: chat.id } });
          await tx.chatParticipant.deleteMany({ where: { chatId: chat.id } });
          await tx.folderChat.deleteMany({ where: { chatId: chat.id } });
          await tx.chat.delete({ where: { id: chat.id } });
        }
        await tx.event.delete({ where: { id: eventId } });
      });
    }

    return { eventContinues: true };
  }

  // ❌ ОТМЕНА ЗАПРОСА НА УЧАСТИЕ (waiting → non_member)
  async cancelJoinRequest(membershipId: string, userId: string) {
    const membership = await this.prisma.eventMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new BadRequestException('Request not found');
    }

    // Валидация
    if (membership.userId !== userId) {
      throw new ForbiddenException('Not your request');
    }
    if (membership.status !== MembershipStatus.PENDING) {
      throw new BadRequestException('Request already processed');
    }
    if (membership.invitedBy) {
      throw new BadRequestException('Cannot cancel invitation, use reject instead');
    }

    // Удаляем запрос
    return this.prisma.eventMembership.delete({
      where: { id: membershipId },
    });
  }

  listMembers(eventId: string) {
    return this.prisma.eventMembership.findMany({
      where: { eventId, status: MembershipStatus.ACCEPTED },
      include: { user: true },
    });
  }

  async inviteUser(eventId: string, organizerId: string, invitedUserId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    if (event.organizerId !== organizerId) {
      throw new ForbiddenException('Only organizer can invite users');
    }

    const existing = await this.prisma.eventMembership.findUnique({
      where: { userId_eventId: { userId: invitedUserId, eventId } },
    });

    if (existing) {
      if (existing.status === MembershipStatus.REJECTED) {
        // Re-invite rejected user
        return this.prisma.eventMembership.update({
          where: { id: existing.id },
          data: {
            status: MembershipStatus.PENDING,
            invitedBy: organizerId,
          },
        });
      }
      throw new BadRequestException('User already invited or member');
    }

    return this.prisma.eventMembership.create({
      data: {
        eventId,
        userId: invitedUserId,
        role: EventRole.PARTICIPANT,
        status: MembershipStatus.PENDING,
        invitedBy: organizerId, // Mark as invitation
      },
    });
  }

  async listPendingRequests(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    
    // Если пользователь является организатором, возвращаем все pending запросы
    if (event.organizerId === userId) {
      return this.prisma.eventMembership.findMany({
        where: { eventId, status: MembershipStatus.PENDING },
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      });
    }
    
    // Если пользователь не организатор, возвращаем только его собственные pending запросы/приглашения
    return this.prisma.eventMembership.findMany({
      where: { 
        eventId, 
        userId,
        status: MembershipStatus.PENDING,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  // 📥 ПОЛУЧЕНИЕ ЗАПРОСОВ ПОЛЬЗОВАТЕЛЯ (входящие и исходящие приглашения)
  async getUserRequests(userId: string, type: 'incoming' | 'outgoing' = 'incoming') {
    let whereClause: any = {};

    if (type === 'incoming') {
      // Входящие запросы: приглашения мне (invitedBy не null и userId = текущий пользователь)
      whereClause = {
        userId,
        invitedBy: { not: null }, // Это приглашение
        status: { in: [MembershipStatus.PENDING, MembershipStatus.ACCEPTED] }, // Показываем принятые тоже
      };
    } else if (type === 'outgoing') {
      // Исходящие запросы: мои приглашения другим (invitedBy = текущий пользователь)
      whereClause = {
        invitedBy: userId,
        status: { in: [MembershipStatus.PENDING, MembershipStatus.ACCEPTED, MembershipStatus.REJECTED] }, // Показываем все статусы
      };
    }

    return this.prisma.eventMembership.findMany({
      where: whereClause,
      include: {
        event: {
          select: {
            id: true,
            title: true,
            mediaUrl: true,
            startTime: true,
            organizerId: true,
            organizer: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setPersonalPhoto(eventId: string, userId: string, photoUrl: string) {
    const membership = await this.prisma.eventMembership.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACCEPTED) {
      throw new ForbiddenException('Must be an accepted participant to set personal photo');
    }

    return this.prisma.eventPersonalPhoto.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { photoUrl },
      create: { eventId, userId, photoUrl },
    });
  }

  async getPersonalPhotos(eventId: string) {
    return this.prisma.eventPersonalPhoto.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  // 🔄 ПРОДЛЕНИЕ РЕГУЛЯРНОГО СОБЫТИЯ
  async extendRecurringEvent(
    eventId: string,
    userId: string,
    body: {
      recurringType?: 'daily' | 'weekly' | 'monthly' | 'custom';
      recurringDays?: number[];
      recurringDayOfMonth?: number;
      recurringCustomDates?: string[];
    },
  ) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    if (event.organizerId !== userId) {
      throw new ForbiddenException('Only organizer can extend event');
    }
    if (!(event as any).isRecurring) {
      throw new BadRequestException('Event is not recurring');
    }

    const customDatesArray = body.recurringCustomDates
      ? body.recurringCustomDates.map((d) => new Date(d))
      : undefined;

    const updatedEvent = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...(body.recurringType !== undefined ? { recurringType: body.recurringType as any } : {}),
        ...(body.recurringDays !== undefined ? { recurringDays: body.recurringDays as any } : {}),
        ...(body.recurringDayOfMonth !== undefined ? { recurringDayOfMonth: body.recurringDayOfMonth as any } : {}),
        ...(customDatesArray !== undefined ? { recurringCustomDates: customDatesArray as any } : {}),
      } as any,
    });

    // Обновляем участия всех активных участников
    const activeParticipations = await (this.prisma as any).userEventParticipation.findMany({
      where: {
        eventId,
        status: 'active',
      },
      select: { userId: true },
    });

    for (const participation of activeParticipations) {
      await this.recurringEventsService.createOrUpdateParticipation(eventId, participation.userId);
    }

    return updatedEvent;
  }

  // 🏷️ ДОБАВЛЕНИЕ ПОЛЬЗОВАТЕЛЬСКИХ МЕТОК
  async addCustomTags(eventId: string, userId: string, tags: string[]) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    if (event.organizerId !== userId) {
      throw new ForbiddenException('Only organizer can add tags');
    }

    const updatedTags = await this.tagsService.addCustomTags(eventId, tags);
    return { customTags: updatedTags };
  }

  // 🏷️ УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЬСКИХ МЕТОК
  async removeCustomTags(eventId: string, userId: string, tags: string[]) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    if (event.organizerId !== userId) {
      throw new ForbiddenException('Only organizer can remove tags');
    }

    const updatedTags = await this.tagsService.removeCustomTags(eventId, tags);
    return { customTags: updatedTags };
  }

  // 🏷️ ОБНОВЛЕНИЕ АВТОМАТИЧЕСКИХ МЕТОК
  async refreshAutoTags(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    if (event.organizerId !== userId) {
      throw new ForbiddenException('Only organizer can refresh tags');
    }

    const autoTags = await this.tagsService.updateAutoTags(eventId);
    return { autoTags };
  }

  // 📅 ПРИСОЕДИНЕНИЕ К РЕГУЛЯРНОМУ СОБЫТИЮ
  async joinRecurringEvent(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    if (!(event as any).isRecurring) {
      throw new BadRequestException('Event is not recurring');
    }

    // Проверяем, есть ли уже membership
    const membership = await this.prisma.eventMembership.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });

    if (!membership || membership.status !== MembershipStatus.ACCEPTED) {
      throw new ForbiddenException('Must be an accepted participant to join recurring event');
    }

    // Создаем или обновляем участие
    await this.recurringEventsService.createOrUpdateParticipation(eventId, userId);

    return { success: true };
  }

  // 📅 ОТМЕНА УЧАСТИЯ В РЕГУЛЯРНОМ СОБЫТИИ
  async cancelRecurringParticipation(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    if (!(event as any).isRecurring) {
      throw new BadRequestException('Event is not recurring');
    }

    await this.recurringEventsService.cancelParticipation(eventId, userId);

    return { success: true };
  }
}
