import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildEventVisibilityWhere } from './event-visibility';
import { isBlockedBetween } from '../shared/blocks';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventRole, MembershipStatus, NotificationType, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatsService } from '../chats/chats.service';
import { WebSocketService } from '../ws/websocket.service';
import { RecurringEventsService } from './recurring-events.service';
import { TagsService } from './tags.service';
import { createLogger } from '../shared/utils/logger';
import { normalizePublicMediaUrl } from '../shared/public-site';

const logger = createLogger('EventsService');

@Injectable()
export class EventsService {
  private normalizeMediaUrl(url: string | null | undefined): string | null {
    return normalizePublicMediaUrl(url);
  }
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
      isMassEvent,
      customTags,
      ageRestriction,
      genderRestriction,
      mediaType,
      mediaAspectRatio,
      targeting,
      originalMediaUrl,
      visibility,
      ...eventData
    } = dto;
    
    try {
      // Преобразуем recurringCustomDates в Date[]
      const customDatesArray = recurringCustomDates
        ? recurringCustomDates.map((d) => new Date(d))
        : undefined;

      // Метки - фильтруем дубликаты автоматических тегов из пользовательских
      // Автоматические теги: 'recurring', 'women_only', 'men_only', 'age_18_plus', 'starting_soon', 'массовое'
      const autoTagsToFilter = ['recurring', 'women_only', 'men_only', 'age_18_plus', 'starting_soon', 'массовое', 'регулярное', 'women only', 'men only', '18+'];
      const filteredCustomTags = (customTags || []).filter(tag => {
        const normalizedTag = tag.toLowerCase().trim();
        return !autoTagsToFilter.some(autoTag => autoTag.toLowerCase().trim() === normalizedTag);
      });

      /**
       * Приглашения при создании идут не через inviteUser, а прямо здесь,
       * поэтому те же правила повторяем: не зовём тех, кто не подходит под
       * ограничение по полу, и тех, от кого событие скрыто настройками
       * видимости. Иначе «только для мужчин» уходило женщинам, а человек из
       * списка «все, кроме» получал приглашение и видел событие.
       */
      const allowedInviteeIds = await this.filterInvitees(
        organizerId,
        invitedUserIds || [],
        genderRestriction,
        visibility,
      );

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
          // Поле для массового события
          isMassEvent: isMassEvent || false,
          // Метки
          customTags: filteredCustomTags,
          autoTags: [], // Будет заполнено автоматически
          // Дополнительные поля
          ageRestriction: ageRestriction || null,
          genderRestriction: Array.isArray(genderRestriction) ? genderRestriction : [],
          mediaType: mediaType || null,
          mediaAspectRatio: mediaAspectRatio || null,
          targeting: targeting || null,
          visibility: visibility ? { type: visibility.type, excludedUsers: visibility.excludedUsers || [] } : null,
          memberships: {
            create: [
              {
                userId: organizerId,
                role: EventRole.ORGANIZER,
                status: MembershipStatus.ACCEPTED,
              },
              // Create invitations for invited users
              ...(allowedInviteeIds.map(userId => ({
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
        isMassEvent: eventWithTags.isMassEvent,
        hasMassEventTag: eventWithTags.autoTags?.includes('массовое'),
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

  async findAll(params: { upcoming?: boolean; organizerId?: string; currentUserId?: string; limit?: number; cursor?: string }) {
    // ВАЖНО: этот метод — единственный источник данных для клиентской ленты
    // (GLOB и FRIENDS вкладки, календарь, профильные сетки — всё фильтруется
    // из одного и того же полного списка на клиенте). Поэтому наличие
    // currentUserId само по себе НЕ должно сужать выборку до "мои события" —
    // единственный параметр, сужающий по организатору, это organizerId.
    const andConditions: any[] = [];

    if (params.organizerId) {
      andConditions.push({ organizerId: params.organizerId });
    }

    if (params.upcoming) {
      andConditions.push({ startTime: { gte: new Date() } });
    }

    // Видимость (visibility) применяем только когда смотрим не свой профиль —
    // свои и уже присоединённые события всегда видны, вне зависимости от настройки.
    const viewerId = params.currentUserId;
    const isOwnProfile = !!(params.organizerId && params.organizerId === viewerId);
    if (!isOwnProfile) {
      // Условие вынесено в buildEventVisibilityWhere: тем же правилом теперь
      // пользуются рекомендации и поиск, которые раньше не фильтровали ничего.
      andConditions.push(await buildEventVisibilityWhere(this.prisma, viewerId));
    }

    const whereCondition: any = andConditions.length > 0 ? { AND: andConditions } : {};

    return this.prisma.event.findMany({
      where: whereCondition,
      orderBy: { startTime: 'asc' },
      ...(params.limit ? { take: params.limit } : {}),
      ...(params.cursor ? { skip: 1, cursor: { id: params.cursor } } : {}),
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

    // Логируем теги для отладки
    if (event) {
      const eventWithTags = event as any;
      console.log(`[EventsService] findOne Event ${eventWithTags.id}:`, {
        autoTags: eventWithTags.autoTags,
        customTags: eventWithTags.customTags,
        isMassEvent: eventWithTags.isMassEvent,
        hasMassEventTag: eventWithTags.autoTags?.includes('массовое'),
      });
    }

    if (event && !(await this.isEventVisibleToViewer(event, currentUserId))) {
      // Не отличаем "не найдено" от "нет доступа" — иначе прямой ID
      // раскрывал бы сам факт существования приватного события.
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  // Та же логика видимости, что и в findAll(), но для одного уже
  // загруженного события — используется findOne(), чтобы прямой переход
  // по ссылке/ID не обходил настройку visibility (карта, диплинки, шаринг).
  private async isEventVisibleToViewer(event: { organizerId: string; visibility: any; memberships?: { userId: string }[] }, viewerId?: string): Promise<boolean> {
    const visibility = event.visibility as { type?: string; excludedUsers?: string[] } | null;
    if (!visibility || !visibility.type || visibility.type === 'all') return true;
    if (viewerId && viewerId === event.organizerId) return true;
    if (viewerId && event.memberships?.some(m => m.userId === viewerId)) return true;

    if (visibility.type === 'only_me') return false;
    if (visibility.type === 'all_except_excluded') {
      return !viewerId || !(visibility.excludedUsers || []).includes(viewerId);
    }
    if (visibility.type === 'me_and_excluded') {
      return !!viewerId && (visibility.excludedUsers || []).includes(viewerId);
    }
    if (visibility.type === 'friends' || visibility.type === 'all_except_friends') {
      if (!viewerId) return visibility.type === 'all_except_friends';
      const friendship = await this.prisma.friendship.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: viewerId, addresseeId: event.organizerId },
            { requesterId: event.organizerId, addresseeId: viewerId },
          ],
        },
        select: { id: true },
      });
      const isFriend = !!friendship;
      return visibility.type === 'friends' ? isFriend : !isFriend;
    }
    return true;
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
      isMassEvent,
      customTags,
      ageRestriction,
      genderRestriction,
      mediaType,
      mediaAspectRatio,
      targeting,
      visibility,
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
        // Поле для массового события
        ...(isMassEvent !== undefined ? { isMassEvent } : {}),
        // Метки
        ...(customTags !== undefined ? { customTags } : {}),
        // Дополнительные поля
        ...(ageRestriction !== undefined ? { ageRestriction } : {}),
        ...(genderRestriction !== undefined ? { genderRestriction } : {}),
        ...(mediaType !== undefined ? { mediaType } : {}),
        ...(mediaAspectRatio !== undefined ? { mediaAspectRatio } : {}),
        ...(targeting !== undefined ? { targeting } : {}),
        ...(visibility !== undefined ? { visibility: { type: visibility.type, excludedUsers: visibility.excludedUsers || [] } } : {}),
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


    // Обновляем автоматические теги после обновления события
    // (особенно важно, если изменились isRecurring, isMassEvent, ageRestriction, genderRestriction)
    console.log(`[EventsService] Calling updateAutoTags for updated event ${id}`);
    await this.tagsService.updateAutoTags(id);

    // Получаем обновленное событие с актуальными тегами после updateAutoTags
    const finalEvent = await this.prisma.event.findUnique({
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
      ...(finalEvent || updatedEvent),
      changedFields,
    });

    return finalEvent || updatedEvent;
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

    // К организатору, с которым есть блокировка, не вступаем.
    if (await isBlockedBetween(this.prisma, userId, event.organizerId)) {
      throw new ForbiddenException('This event is not available');
    }

    /**
     * Ограничение по полу проверяется здесь, а не только в интерфейсе.
     *
     * Раньше «только женщины» было просто меткой на карточке: сервер
     * genderRestriction не читал вовсе, и вступить мог кто угодно. Пол, не
     * указанный в профиле, не отсекаем — он в регистрации необязателен, и
     * иначе такие события оказались бы закрыты для большинства людей.
     */
    if (!this.fitsGenderRestriction(event.genderRestriction, (user as any).gender)) {
      throw new ForbiddenException('This event is limited by gender');
    }

    // Check event capacity before allowing join
    const currentCount = await this.prisma.eventMembership.count({
      where: { eventId, status: { in: [MembershipStatus.ACCEPTED, MembershipStatus.PENDING] } },
    });
    if (event.maxParticipants && currentCount >= event.maxParticipants) {
      throw new BadRequestException('Event is full');
    }

    const existing = await this.prisma.eventMembership.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });

    if (existing) {
      if (existing.status === MembershipStatus.REJECTED) {
        // Если событие массовое - сразу ACCEPTED, иначе PENDING
        const newStatus = (event as any).isMassEvent ? MembershipStatus.ACCEPTED : MembershipStatus.PENDING;
        return this.prisma.eventMembership.update({
          where: { id: existing.id },
          data: { status: newStatus },
        });
      }
      throw new BadRequestException('Already requested or member');
    }

    // Если событие массовое - сразу ACCEPTED, иначе PENDING
    const initialStatus = (event as any).isMassEvent ? MembershipStatus.ACCEPTED : MembershipStatus.PENDING;

    const membership = await this.prisma.eventMembership.create({
      data: {
        eventId,
        userId,
        role: EventRole.PARTICIPANT,
        status: initialStatus,
      },
    });

    // Проверяем количество принятых участников ДО добавления нового (организатор не считается)
    const acceptedCountBefore = await this.prisma.eventMembership.count({
      where: {
        eventId,
        status: MembershipStatus.ACCEPTED,
        userId: { not: event.organizerId }, // Исключаем организатора
      },
    });

    // Если событие массовое и участник сразу принят - создаем чат и отправляем уведомления
    if ((event as any).isMassEvent && membership.status === MembershipStatus.ACCEPTED) {
      // Если это первый участник (организатор не считается), создаем чат события автоматически
      if (acceptedCountBefore === 0) {
        try {
          await this.chatsService.createEventChat(
            event.organizerId,
            eventId,
            [event.organizerId, userId],
          );
          console.log(`[EventsService] Event chat created automatically for mass event ${eventId}`);
        } catch (error) {
          console.error(`[EventsService] Failed to create event chat for mass event:`, error);
          // Не прерываем выполнение
        }
      } else {
        // Если чат уже существует, добавляем нового участника
        try {
          const existingChat = await this.prisma.chat.findUnique({
            where: { eventId },
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
              console.log(`[EventsService] Added participant ${userId} to event chat (mass event)`);
            }
          } else {
            // Если чат почему-то не существует, создаем его
            await this.chatsService.createEventChat(
              event.organizerId,
              eventId,
              [event.organizerId, userId],
            );
            console.log(`[EventsService] Event chat created for mass event ${eventId} (late creation)`);
          }
        } catch (error) {
          console.error(`[EventsService] Failed to add participant to event chat (mass event):`, error);
          // Не прерываем выполнение
        }
      }

      // Для массовых событий - участник сразу принят, отправляем уведомление организатору
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, username: true, avatarUrl: true },
      });
      if (user) {
        await this.notificationsService.createNotification({
          userId: event.organizerId,
          type: NotificationType.EVENT_PARTICIPANT_JOINED,
          payload: {
            eventId,
            actorId: userId,
            actorName: user.name || user.username,
            eventTitle: event.title,
            eventMediaUrl: event.mediaUrl || undefined,
          },
        });
      }
      
      this.websocketService.emitToUser(event.organizerId, 'event:participant:joined', {
        eventId,
        membershipId: membership.id,
        userId,
        type: 'participation',
      });
      
      // Отправляем уведомление участнику о принятии
      this.websocketService.emitToUser(userId, 'event:joined', {
        eventId,
        membershipId: membership.id,
      });
    } else {
      // Персистентное уведомление организатору о новой заявке — раньше для
      // обычных (не массовых) событий уходил только WebSocket-евент, и если
      // организатор не был online в этот момент, заявка терялась бесследно.
      await this.notificationsService.createNotification({
        userId: event.organizerId,
        type: NotificationType.EVENT_JOIN_REQUEST,
        payload: {
          eventId,
          actorId: userId,
          actorName: user.name || user.username,
          eventTitle: event.title,
          eventMediaUrl: event.mediaUrl || undefined,
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
    }

    // Также отправляем в комнату события
    await this.websocketService.emitToEventParticipants(
      eventId,
      userId,
      membership.status === MembershipStatus.ACCEPTED ? 'event:joined' : 'event:request:new',
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

    // Проверяем количество участников ДО обновления статуса (организатор не считается)
    const acceptedCountBefore = await this.prisma.eventMembership.count({
      where: {
        eventId,
        status: MembershipStatus.ACCEPTED,
        userId: { not: organizerId }, // Исключаем организатора
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

    // Персистентное уведомление участнику о принятии заявки — раньше уходил
    // только WebSocket-евент ('event:request:status'), и если участник не
    // был online в момент принятия, он никогда не узнавал об этом.
    if (accept) {
      const organizer = await this.prisma.user.findUnique({
        where: { id: organizerId },
        select: { name: true, username: true },
      });
      await this.notificationsService.createNotification({
        userId: membership.userId,
        type: NotificationType.EVENT_REQUEST_ACCEPTED,
        payload: {
          eventId,
          actorId: organizerId,
          actorName: organizer?.name || organizer?.username,
          eventTitle: event.title,
          eventMediaUrl: event.mediaUrl || undefined,
        },
      });
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
          select: { id: true, organizerId: true, title: true, mediaUrl: true },
        },
        user: { select: { name: true, username: true } },
      },
    });

    // Отправляем WebSocket событие об отклонении приглашения
    if (updatedMembership.event) {
      // Тому, кто приглашал, — уведомление об отказе. Раньше отказ не оставлял
      // следа вовсе: приглашение молча пропадало из «Исходящих».
      if (membership.invitedBy) {
        void this.notificationsService
          .createNotification({
            userId: membership.invitedBy,
            type: 'EVENT_INVITE_DECLINED' as NotificationType,
            payload: {
              actorId: userId,
              actorName:
                updatedMembership.user?.name || updatedMembership.user?.username || undefined,
              eventId: updatedMembership.event.id,
              eventTitle: updatedMembership.event.title,
              eventMediaUrl: updatedMembership.event.mediaUrl || undefined,
            },
          })
          .catch(() => undefined);
      }

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

    // Удаляем пользователя из чата события с системным сообщением
    await this.removeUserFromEventChat(eventId, userId, user.name || user.username || 'Пользователь');

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

      // Получаем данные пользователя для уведомлений
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, username: true },
      });
      
      // Помечаем выход, а не удаляем строку: участники события (и организатор)
      // должны видеть в списке и тех, кто вышел — с пометкой. Для остальных
      // такие строки отфильтровываются при чтении профиля.
      const deleted = await this.prisma.eventProfileParticipant.updateMany({
        where: {
          profileId: profile.id,
          userId: userId,
          leftAt: null,
        },
        data: { leftAt: new Date() },
      });
      
      const remainingCount = profile.participants.filter(p => !p.leftAt).length - deleted.count;
      logger.info(`User marked as left in event profile for past event, updated: ${deleted.count}`);
      logger.info(`Remaining participants: ${remainingCount}`);
      
      // КРИТИЧЕСКИ ВАЖНО: Для прошедших событий НЕ применяем правило удаления по количеству участников
      // Правило удаления события по количеству участников применяется ТОЛЬКО для предстоящих событий
      // Для прошедших событий (Memories) событие остается для других участников, просто удаленный участник исключается из списка
      logger.info(`Для прошедшего события не применяем правило удаления по количеству участников - событие остается для других участников`);
      
      // Получаем список оставшихся участников ДО удаления (из исходного профиля)
      const remainingParticipantIds = profile.participants
        .filter(p => p.userId !== userId && !p.leftAt)
        .map(p => p.userId);
      
      // КРИТИЧЕСКИ ВАЖНО: Отправляем WebSocket уведомление другим участникам о том, что список участников обновился
      // Это нужно, чтобы другие участники (например, nastya) видели обновленный список участников
      if (remainingParticipantIds.length > 0) {
        logger.info(`Отправляем WebSocket уведомление оставшимся участникам: ${remainingParticipantIds.length}`);
        
        // Отправляем уведомление через EventProfile participants (не через EventMembership, т.к. для прошедших событий membership может не существовать)
        await this.websocketService.emitToUsers(
          remainingParticipantIds,
          'event:profile:participant_removed',
          {
            eventId,
            removedUserId: userId,
            removedUserName: user?.name || user?.username || 'Пользователь',
            remainingParticipants: remainingParticipantIds,
          },
        );
        
        // Также отправляем обновление профиля события, чтобы клиент перезагрузил список участников
        await this.websocketService.emitToUsers(
          remainingParticipantIds,
          'event:profile:updated',
          { eventId },
        );
      }
      
      await this.removeEventFromOwnFolders(eventId, userId);

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

    // Проверяем, является ли событие прошедшим (ДО удаления из профиля, чтобы использовать в логике)
    const eventForCheck = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { startTime: true },
    });
    const isPastEventCheck = eventForCheck && eventForCheck.startTime < new Date();

    // Удаляем пользователя из профиля события (если профиль существует)
    const profile = await this.prisma.eventProfile.findUnique({
      where: { eventId },
      include: {
        participants: true,
      },
    });

    if (profile) {
      const participantsBefore = profile.participants.filter(p => !p.leftAt).length;
      
      // Пометка «вышел» вместо удаления строки — список участников события
      // должен помнить всех, кто в нём был (см. EventProfileParticipant.leftAt).
      const deleted = await this.prisma.eventProfileParticipant.updateMany({
        where: {
          profileId: profile.id,
          userId: userId,
          leftAt: null,
        },
        data: { leftAt: new Date() },
      });
      
      const remainingCount = participantsBefore - deleted.count;
      logger.info(`User marked as left in event profile, remaining participants: ${remainingCount}, isPastEvent: ${isPastEventCheck}`);
      
      // КРИТИЧЕСКИ ВАЖНО: Правило удаления события по количеству участников применяется ТОЛЬКО для предстоящих событий
      // Для прошедших событий (Memories) событие остается для других участников, просто удаленный участник исключается из списка
      if (!isPastEventCheck) {
        // Для предстоящих событий: если участников стало 0 (или был 1 и его удалили) - удаляем событие полностью
      if (remainingCount === 0 || (participantsBefore === 1 && deleted.count === 1)) {
          logger.info(`🗑️ Последний участник удален из предстоящего события, удаляем событие полностью`);
        
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
      } else {
        logger.info(`Для прошедшего события не применяем правило удаления по количеству участников - событие остается для других участников`);
        
        // Для прошедших событий отправляем WebSocket уведомления другим участникам
        if (profile && remainingCount > 0) {
          const remainingParticipantIds = profile.participants
            .filter(p => p.userId !== userId && !p.leftAt)
            .map(p => p.userId);
          
          logger.info(`Отправляем WebSocket уведомление оставшимся участникам прошедшего события: ${remainingParticipantIds.length}`);
          
          // Отправляем уведомление об удалении участника
          await this.websocketService.emitToUsers(
            remainingParticipantIds,
            'event:profile:participant_removed',
            {
              eventId,
              removedUserId: userId,
              removedUserName: user.name || user.username || 'Пользователь',
              remainingParticipants: remainingParticipantIds,
            },
          );
          
          // Также отправляем обновление профиля события
          await this.websocketService.emitToUsers(
            remainingParticipantIds,
            'event:profile:updated',
            { eventId },
          );
        }
      }
    }

    // Создаем уведомления для всех участников об удалении участника (перед удалением)
    // ТОЛЬКО для предстоящих событий (для прошедших уже отправили выше)
    if (!isPastEvent) {
    await this.notificationsService.notifyEventParticipants(
      eventId,
      userId,
      'EVENT_PARTICIPANT_LEFT' as NotificationType,
      {
        actorId: userId,
        actorName: user.name || user.username,
      },
    );
    }

    // Удаляем пользователя из чата события с системным сообщением
    await this.removeUserFromEventChat(eventId, userId, user.name || user.username || 'Пользователь');

    await this.removeEventFromOwnFolders(eventId, userId);

    return this.prisma.eventMembership.delete({ where: { id: membership.id } });
  }

  /**
   * Вышел из события — убираем его из СВОИХ папок.
   *
   * Папка событий — личная подборка; держать в ней событие, из которого
   * человек вышел, нечего. Раньше запись оставалась, и карточка так и висела
   * в папке после нажатия «удалить». Чужие папки не трогаем.
   */
  private async removeEventFromOwnFolders(eventId: string, userId: string) {
    try {
      const folders = await this.prisma.eventFolder.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });
      if (folders.length === 0) return;
      await this.prisma.eventFolderEvent.deleteMany({
        where: { eventId, folderId: { in: folders.map(f => f.id) } },
      });
    } catch (error) {
      logger.warn(`Не удалось убрать событие из папок пользователя: ${error?.message}`);
    }
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

    // КРИТИЧЕСКИ ВАЖНО: Считаем всех участников (ACCEPTED), включая организатора
    // Если участников <= 2 (организатор + 1 участник), событие полностью удаляется
    const acceptedCount = event.memberships.length; // Уже фильтруется по ACCEPTED
    const totalParticipants = acceptedCount; // Организатор уже включен в memberships как ACCEPTED ORGANIZER
    
    logger.info(`[cancelEvent] Событие ${eventId}: участников (ACCEPTED) = ${acceptedCount}, должно быть удалено: ${acceptedCount <= 2 ? 'ДА' : 'НЕТ'}`);
    
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
      logger.info(`[cancelEvent] Начинаем транзакцию удаления события ${eventId}`);
      
      // 1) Переводим активные membership в REJECTED и удаляем все привязки по событию
      const updatedMemberships = await tx.eventMembership.updateMany({
        where: { eventId, status: { in: [MembershipStatus.PENDING, MembershipStatus.ACCEPTED] } },
        data: { status: MembershipStatus.REJECTED },
      });
      logger.info(`[cancelEvent] Обновлено memberships: ${updatedMemberships.count}`);
      
      const deletedMemberships = await tx.eventMembership.deleteMany({ where: { eventId } });
      logger.info(`[cancelEvent] Удалено memberships: ${deletedMemberships.count}`);

      // 2) Удаляем персональные фото для события
      const deletedPhotos = await tx.eventPersonalPhoto.deleteMany({ where: { eventId } });
      logger.info(`[cancelEvent] Удалено персональных фото: ${deletedPhotos.count}`);

      // 3) Обнуляем ссылку на событие в сообщениях (поле eventId опционально)
      const updatedMessages = await tx.message.updateMany({ where: { eventId }, data: { eventId: null } });
      logger.info(`[cancelEvent] Обновлено сообщений: ${updatedMessages.count}`);

      // 4) Если есть связанный чат — удаляем его и зависимые записи
      const chat = await tx.chat.findUnique({ where: { eventId } });
      if (chat) {
        await tx.message.deleteMany({ where: { chatId: chat.id } });
        await tx.chatParticipant.deleteMany({ where: { chatId: chat.id } });
        await tx.folderChat.deleteMany({ where: { chatId: chat.id } });
        await tx.chat.delete({ where: { id: chat.id } });
        logger.info(`[cancelEvent] Удален чат: ${chat.id}`);
      } else {
        logger.info(`[cancelEvent] Чат не найден для события ${eventId}`);
      }

      // 5) Профиль события (EventProfile) привязан к Event с onDelete: Cascade — удалится вместе с событием.
      const deletedEvent = await tx.event.delete({ where: { id: eventId } });
      logger.info(`[cancelEvent] Событие удалено: ${eventId}, affected: ${deletedEvent ? '1' : '0'}`);

      // 6) Отправляем WebSocket событие об удалении события ВНУТРИ транзакции, но после удаления
      // Это гарантирует, что событие действительно удалено из базы данных
      try {
        await this.websocketService.emitToEventParticipants(
          eventId,
          userId,
          'event:deleted',
          { eventId },
        );
        // Также отправляем всем пользователям (для обновления в лентах)
        this.websocketService.emitToAll('event:deleted', { eventId });
        logger.info(`[cancelEvent] WebSocket событие отправлено для события ${eventId}`);
      } catch (wsError) {
        logger.error(`[cancelEvent] Ошибка отправки WebSocket события:`, wsError);
        // Не прерываем транзакцию из-за ошибки WebSocket
      }

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

    // Удаляем проверку на количество участников - теперь всегда можно отменить участие организатора
    // (если организатор единственный участник, используется cancelEvent)

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

  // 👤 ПЕРЕДАЧА РОЛИ ОРГАНИЗАТОРА
  /**
   * Передать роль организатора.
   *
   * Роль переходит СРАЗУ, согласия принимающего не требуется — он лишь получает
   * уведомление о том, что стал организатором. Промежуточная заявка с
   * «принять/отклонить» была лишним шагом: организатор в этот момент уже вышел
   * из события, и пока адресат не ответил, событие оставалось без хозяина.
   *
   * Записи OrganizerTransfer больше не создаются. Прежние висящие заявки
   * закрываем здесь же, чтобы они не всплывали в уведомлениях.
   */
  async requestOrganizerTransfer(eventId: string, currentOrganizerId: string, newOrganizerId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizer: { select: { id: true, name: true, username: true } },
      },
    });
    if (!event) throw new BadRequestException('Event not found');
    if (event.organizerId !== currentOrganizerId) {
      throw new ForbiddenException('Only the organizer can transfer the role');
    }
    if (newOrganizerId === currentOrganizerId) {
      throw new BadRequestException('Cannot transfer the role to yourself');
    }

    const result = await this.transferOrganizerRole(eventId, currentOrganizerId, newOrganizerId);

    await this.prisma.organizerTransfer.updateMany({
      where: { eventId, toUserId: newOrganizerId, status: 'PENDING' },
      data: { status: 'ACCEPTED' },
    });

    // Уведомления рассылает transferOrganizerRole — второй раз не пишем.

    this.websocketService.emitToUser(newOrganizerId, 'event:organizer_transfer:status', {
      eventId,
      fromUserId: currentOrganizerId,
      status: 'ACCEPTED',
    });

    return result;
  }

  /** Все ожидающие меня предложения стать организатором. */
  async listOrganizerTransfers(userId: string) {
    return this.prisma.organizerTransfer.findMany({
      where: { toUserId: userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        event: { select: { id: true, title: true, organizerId: true } },
      },
    });
  }

  /** Принять или отклонить предложение стать организатором. */
  async respondToOrganizerTransfer(transferId: string, userId: string, accept: boolean) {
    const transfer = await this.prisma.organizerTransfer.findUnique({
      where: { id: transferId },
    });
    if (!transfer) throw new BadRequestException('Transfer not found');
    if (transfer.toUserId !== userId) {
      throw new ForbiddenException('This transfer is addressed to another user');
    }
    if (transfer.status !== 'PENDING') {
      return transfer;
    }

    if (!accept) {
      const rejected = await this.prisma.organizerTransfer.update({
        where: { id: transferId },
        data: { status: 'REJECTED' },
      });
      this.websocketService.emitToUser(transfer.fromUserId, 'event:organizer_transfer:status', {
        id: transferId,
        eventId: transfer.eventId,
        status: 'REJECTED',
      });
      return rejected;
    }

    // Согласие — только теперь роль действительно переходит.
    await this.transferOrganizerRole(transfer.eventId, transfer.fromUserId, userId);
    const accepted = await this.prisma.organizerTransfer.update({
      where: { id: transferId },
      data: { status: 'ACCEPTED' },
    });
    this.websocketService.emitToUser(transfer.fromUserId, 'event:organizer_transfer:status', {
      id: transferId,
      eventId: transfer.eventId,
      status: 'ACCEPTED',
    });
    return accepted;
  }

  async transferOrganizerRole(eventId: string, currentOrganizerId: string, newOrganizerId: string) {
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

    if (!event) {
      throw new BadRequestException('Event not found');
    }

    // Валидация: только текущий организатор может передать роль
    if (event.organizerId !== currentOrganizerId) {
      throw new ForbiddenException('Only current organizer can transfer role');
    }

    // Проверяем, что новый организатор является участником события
    const newOrganizerMembership = event.memberships.find(m => m.userId === newOrganizerId);
    if (!newOrganizerMembership) {
      throw new BadRequestException('New organizer must be a participant of the event');
    }

    // Проверяем, что новый организатор не является текущим организатором
    if (newOrganizerId === currentOrganizerId) {
      throw new BadRequestException('Cannot transfer role to yourself');
    }

    // Выполняем передачу роли в транзакции
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Обновляем событие - назначаем нового организатора
      await tx.event.update({
        where: { id: eventId },
        data: {
          organizerId: newOrganizerId,
        },
      });

      // 2. Обновляем роли в memberships
      const oldOrganizerMembership = await tx.eventMembership.findUnique({
        where: {
          userId_eventId: {
            userId: currentOrganizerId,
            eventId,
          },
        },
      });

      // Прежний организатор выходит из события — ровно то, что обещает окно
      // передачи роли («Передать роль и выйти из события»). Раньше он тут
      // оставался обычным участником: клиент прятал событие как будто его
      // владелец из него вышел, сервер держал его в участниках, и после
      // ближайшей синхронизации событие возвращалось в его же профиль.
      if (oldOrganizerMembership) {
        await tx.eventMembership.delete({ where: { id: oldOrganizerMembership.id } });
      }

      // И из списка участников профиля события — с пометкой «вышел»,
      // строку не удаляем (см. EventProfileParticipant.leftAt).
      const profile = await tx.eventProfile.findUnique({ where: { eventId } });
      if (profile) {
        await tx.eventProfileParticipant.updateMany({
          where: { profileId: profile.id, userId: currentOrganizerId, leftAt: null },
          data: { leftAt: new Date() },
        });
      }

      // Новый организатор получает роль ORGANIZER
      await tx.eventMembership.update({
        where: { id: newOrganizerMembership.id },
        data: {
          role: EventRole.ORGANIZER,
        },
      });

      // 3. Отправляем уведомления
      const newOrganizer = newOrganizerMembership.user;
      await this.notificationsService.notifyEventParticipants(
        eventId,
        currentOrganizerId,
        'EVENT_ORGANIZER_TRANSFERRED' as NotificationType,
        {
          actorId: currentOrganizerId,
          actorName: event.organizer.name || event.organizer.username,
          eventId,
        },
      );

      // Отдельного уведомления новому организатору тут нет: notifyEventParticipants
      // выше уже написал всем участникам, кроме самого отправителя, и новый
      // организатор среди них. Раньше их было два, а с учётом такого же вызова
      // в requestOrganizerTransfer — три одинаковых подряд.

      // 4. Отправляем WebSocket события
      await this.websocketService.emitToEventParticipants(
        eventId,
        currentOrganizerId,
        'event:organizer_transferred',
        {
          eventId,
          oldOrganizerId: currentOrganizerId,
          newOrganizerId,
          newOrganizerName: newOrganizer.name || newOrganizer.username,
        },
      );

      // Также отправляем всем пользователям (для обновления в лентах)
      this.websocketService.emitToAll('event:updated', {
        eventId,
        organizerId: newOrganizerId,
      });

      return {
        success: true,
        eventId,
        newOrganizerId,
        newOrganizerName: newOrganizer.name || newOrganizer.username,
      };
    });

    // Чат правим уже вне транзакции: метод ходит в базу сам и внутри tx
    // держал бы вложенное соединение.
    try {
      const oldOrganizer = event.organizer;
      await this.removeUserFromEventChat(
        eventId,
        currentOrganizerId,
        oldOrganizer?.name || oldOrganizer?.username || 'Пользователь',
      );
    } catch (error) {
      logger.warn(`Не удалось убрать прежнего организатора из чата события: ${error?.message}`);
    }

    return result;
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
      include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
    });
  }

  /** Кого из приглашённых можно звать с учётом пола и видимости события. */
  private async filterInvitees(
    organizerId: string,
    inviteeIds: string[],
    genderRestriction: string[] | null | undefined,
    visibility: { type?: string; excludedUsers?: string[] } | null | undefined,
  ): Promise<string[]> {
    const unique = Array.from(new Set(inviteeIds)).filter(id => id !== organizerId);
    if (unique.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, gender: true },
    });
    const genderById = new Map(users.map(u => [u.id, u.gender]));

    const excluded = new Set(
      visibility?.type === 'all_except_excluded' ? visibility.excludedUsers || [] : [],
    );
    let friendIds = new Set<string>();
    if (visibility?.type === 'all_except_friends') {
      const links = await this.prisma.friendship.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ requesterId: organizerId }, { addresseeId: organizerId }],
        },
        select: { requesterId: true, addresseeId: true },
      });
      friendIds = new Set(
        links.map(link => (link.requesterId === organizerId ? link.addresseeId : link.requesterId)),
      );
    }

    return unique.filter(
      id =>
        genderById.has(id) &&
        this.fitsGenderRestriction(genderRestriction, genderById.get(id)) &&
        !excluded.has(id) &&
        !friendIds.has(id),
    );
  }

  /** Подходит ли человек под ограничение по полу. Пустое ограничение и неуказанный пол — подходит. */
  private fitsGenderRestriction(restriction: string[] | null | undefined, gender: string | null | undefined): boolean {
    if (!Array.isArray(restriction) || restriction.length === 0) return true;
    if (!gender) return true;
    return restriction.includes(gender);
  }

  async inviteUser(eventId: string, organizerId: string, invitedUserId: string) {
    // Приглашать заблокированного нельзя.
    if (await isBlockedBetween(this.prisma, organizerId, invitedUserId)) {
      throw new ForbiddenException('This user is not available');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { organizer: { select: { id: true, name: true, username: true } } },
    });
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    if (event.organizerId !== organizerId) {
      throw new ForbiddenException('Only organizer can invite users');
    }

    const invitee = await this.prisma.user.findUnique({
      where: { id: invitedUserId },
      select: { gender: true },
    });
    if (!this.fitsGenderRestriction(event.genderRestriction, invitee?.gender)) {
      throw new BadRequestException('This event is limited by gender');
    }

    /**
     * Нельзя одновременно спрятать событие от человека и позвать его.
     *
     * Членство (в том числе приглашение) делает событие видимым всегда — так
     * задумано, иначе приглашённый не увидел бы приглашения. Поэтому раньше
     * человек из списка «все, кроме» получал приглашение и видел событие,
     * хотя организатор его от этого человека скрыл.
     */
    const visibility = (event.visibility as any) || null;
    if (
      visibility?.type === 'all_except_excluded' &&
      Array.isArray(visibility.excludedUsers) &&
      visibility.excludedUsers.includes(invitedUserId)
    ) {
      throw new BadRequestException('This user is hidden from the event');
    }
    if (visibility?.type === 'all_except_friends') {
      const friendship = await this.prisma.friendship.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: organizerId, addresseeId: invitedUserId },
            { requesterId: invitedUserId, addresseeId: organizerId },
          ],
        },
        select: { id: true },
      });
      if (friendship) {
        throw new BadRequestException('This user is hidden from the event');
      }
    }

    const existing = await this.prisma.eventMembership.findUnique({
      where: { userId_eventId: { userId: invitedUserId, eventId } },
    });

    if (existing) {
      if (existing.status === MembershipStatus.REJECTED) {
        // Re-invite rejected user
        const reinvited = await this.prisma.eventMembership.update({
          where: { id: existing.id },
          data: {
            status: MembershipStatus.PENDING,
            invitedBy: organizerId,
          },
        });
        await this.notifyInvitedUser(event, organizerId, invitedUserId);
        return reinvited;
      }
      throw new BadRequestException('User already invited or member');
    }

    const membership = await this.prisma.eventMembership.create({
      data: {
        eventId,
        userId: invitedUserId,
        role: EventRole.PARTICIPANT,
        status: MembershipStatus.PENDING,
        invitedBy: organizerId, // Mark as invitation
      },
    });

    await this.notifyInvitedUser(event, organizerId, invitedUserId);
    return membership;
  }

  /**
   * Уведомление о приглашении на событие.
   *
   * Раньше приглашение существовало только как запись EventMembership: узнать
   * о нём можно было, лишь открыв раздел заявок. Ни уведомления в ленте, ни
   * пуша не приходило — вся отправка пушей висит на createNotification.
   */
  private async notifyInvitedUser(
    event: { id: string; title: string; organizer?: { name: string | null; username: string } | null },
    organizerId: string,
    invitedUserId: string,
  ) {
    try {
      await this.notificationsService.createNotification({
        userId: invitedUserId,
        type: 'EVENT_INVITE' as NotificationType,
        payload: {
          actorId: organizerId,
          actorName: event.organizer?.name || event.organizer?.username || undefined,
          eventId: event.id,
          eventTitle: event.title,
        },
      });
    } catch {
      // Приглашение уже создано — уведомление его не отменяет.
    }
  }

  /**
   * Все заявки на участие во ВСЕХ моих событиях — одним запросом.
   *
   * Клиент собирал их поштучно: на каждое организованное событие свой
   * GET /events/:id/requests, все параллельно. На 36 событиях это 36
   * одновременных запросов при каждой синхронизации и при каждом событии
   * сокета. Часть из них упиралась в ограничитель частоты и молча падала
   * (клиент ловит ошибку и возвращает пустой массив) — и заявка на участие
   * просто не доезжала до экрана уведомлений. Кнопок «принять/отклонить»
   * при этом не появлялось вовсе: показывать было нечего.
   */
  async listOrganizerPendingRequests(userId: string) {
    return this.prisma.eventMembership.findMany({
      where: {
        status: MembershipStatus.PENDING,
        event: { organizerId: userId },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        event: { select: { id: true, organizerId: true } },
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

  // 📥 ПОЛУЧЕНИЕ ЗАПРОСОВ ПОЛЬЗОВАТЕЛЯ (входящие и исходящие приглашения, а также исходящие join-запросы)
  async getUserRequests(userId: string, type: 'incoming' | 'outgoing' | 'join' = 'incoming') {
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
    } else if (type === 'join') {
      // Исходящие join-запросы: мои запросы на участие в событиях (где я НЕ организатор)
      // invitedBy = null означает, что это не приглашение, а запрос на участие
      whereClause = {
        userId,
        invitedBy: null, // Это не приглашение, а join-запрос
        status: { in: [MembershipStatus.PENDING, MembershipStatus.ACCEPTED, MembershipStatus.REJECTED] }, // Показываем все статусы
        // Исключаем события, где пользователь является организатором
        event: {
          organizerId: { not: userId },
        },
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

  async getRecommendedEvents(userId: string) {
    // 1. Get user's past events to understand their interests (tags, locations)
    const userMemberships = await this.prisma.eventMembership.findMany({
      where: { userId, status: MembershipStatus.ACCEPTED },
      select: { eventId: true },
    });
    const userEventIds = userMemberships.map(m => m.eventId);

    const userEvents = userEventIds.length > 0
      ? await this.prisma.event.findMany({
          where: { id: { in: userEventIds } },
          select: { customTags: true, autoTags: true, location: true },
        })
      : [];

    // Collect user's preferred tags
    const userTags = new Set<string>();
    userEvents.forEach(e => {
      (e.customTags || []).forEach(t => userTags.add(t));
      (e.autoTags || []).forEach(t => userTags.add(t));
    });

    // 2. Get user's friends
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId, status: 'ACCEPTED' },
          { addresseeId: userId, status: 'ACCEPTED' },
        ],
      },
      select: { requesterId: true, addresseeId: true },
    });
    const friendIds = friendships.map(f =>
      f.requesterId === userId ? f.addresseeId : f.requesterId,
    );

    // 3. Get upcoming events
    const upcomingEvents = await this.prisma.event.findMany({
      where: {
        startTime: { gte: new Date() },
        id: { notIn: userEventIds }, // Exclude events user already joined
        // Рекомендации обходили настройку видимости целиком: сюда попадали и
        // события «только друзьям», и «только я» — кому угодно.
        ...(await buildEventVisibilityWhere(this.prisma, userId)),
      },
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
      orderBy: { startTime: 'asc' },
      take: 100, // Limit candidate pool
    });

    // 4. Score each event
    const scoredEvents = upcomingEvents.map(event => {
      let score = 0;

      // Check if friends are attending (highest signal)
      const friendsAttending = event.memberships.filter(m => friendIds.includes(m.userId));
      score += friendsAttending.length * 10;

      // Check if organizer is a friend
      if (friendIds.includes(event.organizerId)) {
        score += 5;
      }

      // Check tag overlap
      const eventTags = [...(event.customTags || []), ...(event.autoTags || [])];
      const tagOverlap = eventTags.filter(t => userTags.has(t)).length;
      score += tagOverlap * 3;

      // Check location overlap
      if (event.location) {
        const locationMatch = userEvents.some(ue => ue.location && ue.location === event.location);
        if (locationMatch) score += 2;
      }

      return { event, score, friendsAttending: friendsAttending.map(m => m.user) };
    });

    // 5. Sort by score and return top 10
    scoredEvents.sort((a, b) => b.score - a.score);

    return scoredEvents
      .filter(s => s.score > 0)
      .slice(0, 10)
      .map(s => ({
        ...s.event,
        recommendationScore: s.score,
        friendsAttending: s.friendsAttending,
      }));
  }

  async setPersonalPhoto(eventId: string, userId: string, photoUrl: string) {
    const membership = await this.prisma.eventMembership.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACCEPTED) {
      throw new ForbiddenException('Must be an accepted participant to set personal photo');
    }

    const result = await this.prisma.eventPersonalPhoto.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { photoUrl },
      create: { eventId, userId, photoUrl },
    });

    // Отправляем WebSocket событие об обновлении персонального фото
    // Это уведомит других участников события об изменении
    try {
      // Получаем обновленное событие с персональными фото для отправки
      const updatedEvent = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: {
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

      if (updatedEvent) {
        // Отправляем обновление события всем участникам
        await this.websocketService.emitToEventParticipants(
          eventId,
          userId,
          'event:updated',
          {
            id: updatedEvent.id,
            personalPhotos: updatedEvent.personalPhotos,
            updatedField: 'personalPhoto',
            updatedBy: userId,
          },
        );
      }
    } catch (error) {
      // Логируем ошибку, но не прерываем выполнение
      console.error('Failed to emit WebSocket event for personal photo update:', error);
    }

    return result;
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

  // 🚪 УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ ИЗ ЧАТА СОБЫТИЯ С СИСТЕМНЫМ СООБЩЕНИЕМ
  private async removeUserFromEventChat(eventId: string, userId: string, userName: string) {
    try {
      const chat = await this.prisma.chat.findUnique({
        where: { eventId },
        include: { participants: true },
      });

      if (!chat) {
        logger.debug(`Chat not found for event ${eventId}, skipping chat removal`);
        return;
      }

      const participant = chat.participants.find(p => p.userId === userId);
      if (!participant) {
        logger.debug(`User ${userId} is not a participant of chat ${chat.id}`);
        return;
      }

      // Создаем системное сообщение о выходе из события
      const systemMessage = await this.prisma.message.create({
        data: {
          chatId: chat.id,
          senderId: userId,
          content: `${userName} покинул(а) событие`,
        },
        include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } },
      });

      await this.prisma.chat.update({
        where: { id: chat.id },
        data: { lastMessageId: systemMessage.id, updatedAt: new Date() },
      });

      // Удаляем пользователя из участников чата
      await this.prisma.chatParticipant.delete({
        where: { chatId_userId: { chatId: chat.id, userId: userId } },
      });

      const remainingParticipantIds = chat.participants
        .filter(p => p.userId !== userId)
        .map(p => p.userId);
      
      if (remainingParticipantIds.length > 0) {
        this.websocketService.emitToChat(chat.id, 'message:new', systemMessage);
        this.websocketService.emitToUsers(remainingParticipantIds, 'chats:update', {});
      }

      logger.info(`User ${userId} removed from event chat ${chat.id}, system message sent`);
    } catch (error) {
      logger.error(`Error removing user from event chat:`, error);
    }
  }

  /**
   * Личная видимость ПРОШЕДШЕГО события.
   *
   * Настройка касается только «меморис» самого человека: кто увидит это
   * событие, зайдя в ЕГО профиль. У других участников того же события своя
   * настройка (или её нет — и тогда у них событие видно всем).
   *
   * 'all' — строку удаляем, это состояние по умолчанию.
   */
  async setMemoryVisibility(eventId: string, userId: string, visibility: string) {
    const allowed = ['all', 'friends', 'only_me'];
    if (!allowed.includes(visibility)) {
      throw new BadRequestException('Unknown visibility');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizerId: true },
    });
    if (!event) {
      throw new BadRequestException('Event not found');
    }

    // Настраивать может только тот, у кого это событие вообще есть в профиле.
    let isMember = event.organizerId === userId;
    if (!isMember) {
      const membership = await this.prisma.eventMembership.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });
      isMember = membership?.status === MembershipStatus.ACCEPTED;
    }
    if (!isMember) {
      const profile = await this.prisma.eventProfile.findUnique({
        where: { eventId },
        select: { id: true },
      });
      if (profile) {
        const row = await this.prisma.eventProfileParticipant.findUnique({
          where: { profileId_userId: { profileId: profile.id, userId } },
        });
        isMember = !!row && !row.leftAt;
      }
    }
    if (!isMember) {
      throw new ForbiddenException('Only a participant can change memory visibility');
    }

    if (visibility === 'all') {
      await this.prisma.eventMemoryVisibility.deleteMany({ where: { eventId, userId } });
      return { eventId, visibility: 'all' };
    }

    await this.prisma.eventMemoryVisibility.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { visibility },
      create: { eventId, userId, visibility },
    });
    return { eventId, visibility };
  }

  /**
   * Что зритель должен знать о личных настройках чужого профиля.
   *
   * Себе отдаём сами настройки — по ним рисуются значки на мини-карточках.
   * Чужому — только список событий, которые ему показывать нельзя; сами
   * настройки не раскрываем.
   */
  async getMemoryVisibility(ownerId: string, viewerId: string) {
    const rows = await this.prisma.eventMemoryVisibility.findMany({
      where: { userId: ownerId },
      select: { eventId: true, visibility: true },
    });

    if (ownerId === viewerId) {
      return { settings: rows, hiddenEventIds: [] as string[] };
    }

    const onlyMe = rows.filter(r => r.visibility === 'only_me').map(r => r.eventId);
    const friendsOnly = rows.filter(r => r.visibility === 'friends').map(r => r.eventId);

    let viewerIsFriend = false;
    if (friendsOnly.length > 0 && viewerId) {
      const link = await this.prisma.friendship.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: ownerId, addresseeId: viewerId },
            { requesterId: viewerId, addresseeId: ownerId },
          ],
        },
        select: { id: true },
      });
      viewerIsFriend = !!link;
    }

    return {
      settings: [] as Array<{ eventId: string; visibility: string }>,
      hiddenEventIds: viewerIsFriend ? onlyMe : [...onlyMe, ...friendsOnly],
    };
  }
}
