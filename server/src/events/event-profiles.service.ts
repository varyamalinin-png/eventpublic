import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventProfileDto } from './dto/create-event-profile.dto';
import { CreateEventProfilePostDto } from './dto/create-event-profile-post.dto';
import { MembershipStatus, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { logger } from '../shared/utils/logger';

/** photoUrls лежит JSON-ом: массивом или (у старых записей) строкой с массивом. */
function firstPhotoUrl(value: unknown): string | undefined {
  let list: unknown = value;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(list)) return undefined;
  const first = list.find(item => typeof item === 'string' && item.length > 0);
  return typeof first === 'string' ? first : undefined;
}

@Injectable()
export class EventProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Профили сразу для набора событий — ОДНИМ запросом.
   *
   * Экран профиля и раздел мемориса запрашивали профиль каждого прошедшего
   * события отдельно и параллельно. На боевых данных это под сотню HTTP-запросов
   * при каждом открытии экрана: они упирались в ограничитель частоты, отдавали
   * 429 и оставляли экраны пустыми.
   *
   * В отличие от getProfile здесь профиль НЕ создаётся на лету: пакетная
   * загрузка не должна порождать записи. Событиям без профиля просто не будет
   * ключа в ответе, и клиент при необходимости добирает их поштучно.
   */
  /**
   * Лента меморис — готовая, собранная на сервере.
   *
   * Раньше её собирал клиент: тянул все свои события, отбирал прошедшие,
   * запрашивал профили всех этих событий пачкой и уже потом фильтровал посты по
   * дружбе и участию. Цепочка длинная, и обрыв на любом звене давал пустой
   * экран — при том что посты в базе есть. Плюс лента не могла показать пост на
   * ПРЕДСТОЯЩЕМ событии: клиент запрашивал профили только прошедших.
   *
   * Здесь то же правило видимости, но одним запросом: свои посты, посты друзей
   * и посты в событиях, где я участник или организатор.
   */
  async getFeed(userId: string, limit = 30, cursor?: string) {
    const authorSelect = { id: true, name: true, username: true, avatarUrl: true };

    const [friendships, memberships, organized] = await Promise.all([
      this.prisma.friendship.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
        select: { requesterId: true, addresseeId: true },
      }),
      this.prisma.eventMembership.findMany({
        where: { userId, status: 'ACCEPTED' },
        select: { eventId: true },
      }),
      this.prisma.event.findMany({
        where: { organizerId: userId },
        select: { id: true },
      }),
    ]);

    const friendIds = friendships.map(link =>
      link.requesterId === userId ? link.addresseeId : link.requesterId,
    );
    const eventIds = Array.from(
      new Set([...memberships.map(m => m.eventId), ...organized.map(e => e.id)]),
    );

    const take = Math.min(Math.max(limit, 1), 50);
    const posts = await this.prisma.eventProfilePost.findMany({
      where: {
        OR: [
          { authorId: userId },
          { authorId: { in: friendIds } },
          { eventId: { in: eventIds } },
        ],
      },
      include: {
        author: { select: authorSelect },
        comments: {
          include: { author: { select: authorSelect } },
          orderBy: { createdAt: 'asc' },
        },
        profile: { select: { eventId: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = posts.length > take;
    return {
      posts: hasMore ? posts.slice(0, take) : posts,
      nextCursor: hasMore ? posts[take - 1].id : null,
    };
  }

  async getProfilesByEventIds(eventIds: string[]) {
    if (!eventIds.length) return [];

    return this.prisma.eventProfile.findMany({
      where: { eventId: { in: eventIds } },
      include: {
        posts: {
          include: {
            author: {
              select: { id: true, name: true, username: true, avatarUrl: true },
            },
            comments: {
              include: {
                author: {
                  select: { id: true, name: true, username: true, avatarUrl: true },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        participants: {
          // Вышедшие сюда не попадают: этим списком клиент решает, кому
          // показывать событие в «меморис».
          where: { leftAt: null },
          include: {
            user: {
              select: { id: true, name: true, username: true, avatarUrl: true },
            },
          },
        },
      },
    });
  }

  /**
   * Профиль события.
   *
   * `viewerId` нужен только для списка вышедших: полный состав, включая тех,
   * кто из события вышел, видят лишь его участники и организатор. Всем
   * остальным отдаём только тех, кто остался.
   */
  async getProfile(eventId: string, viewerId?: string) {
    try {
      logger.info(`📥 Getting profile for eventId: ${eventId}`);
      let profile = await this.prisma.eventProfile.findUnique({
        where: { eventId },
        include: {
          posts: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  avatarUrl: true,
                },
              },
              comments: {
                include: {
                  author: {
                    select: {
                      id: true,
                      name: true,
                      username: true,
                      avatarUrl: true,
                    },
                  },
                },
                orderBy: { createdAt: 'asc' },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          participants: {
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
      
      // КРИТИЧЕСКИ ВАЖНО: Если профиль не найден - создаем его автоматически (для любых событий)
      if (!profile) {
        const event = await this.prisma.event.findUnique({ where: { id: eventId } });
        if (!event) {
          logger.error(`Event not found: ${eventId}`);
          throw new NotFoundException('Event not found');
        }
        
        logger.info(`Profile not found, creating automatically for event: ${eventId}`);
          
          // Получаем всех принятых участников события
          const acceptedMemberships = await this.prisma.eventMembership.findMany({
            where: {
              eventId,
              status: MembershipStatus.ACCEPTED,
            },
          });
          const participantIds = [event.organizerId, ...acceptedMemberships.map(m => m.userId)];
          const uniqueParticipantIds = Array.from(new Set(participantIds));
          logger.debug(`Creating profile with ${uniqueParticipantIds.length} participants`);
          
        try {
          profile = await this.prisma.eventProfile.create({
            data: {
              eventId,
              name: event.title,
              description: event.description || '',
              date: event.startTime.toISOString().split('T')[0],
              // Горячий фикс часового пояса: считаем, что startTime хранится в UTC,
              // а пользователю нужно локальное время (UTC+3, Москва)
              time: new Date(event.startTime.getTime() + 3 * 60 * 60 * 1000)
                .toISOString()
                .slice(11, 16),
              location: event.location || '',
              avatar: event.originalMediaUrl || event.mediaUrl || null,
              participants: {
                create: uniqueParticipantIds.map(participantId => ({
                  userId: participantId,
                })),
              },
            },
              include: {
                posts: {
                  include: {
                    author: {
                      select: {
                        id: true,
                        name: true,
                        username: true,
                        avatarUrl: true,
                      },
                    },
                  comments: {
                    include: {
                      author: {
                        select: {
                          id: true,
                          name: true,
                          username: true,
                          avatarUrl: true,
                        },
                      },
                    },
                    orderBy: { createdAt: 'asc' },
                  },
                  },
                  orderBy: { createdAt: 'desc' },
                },
                participants: {
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
          logger.info(`Profile created automatically: ${profile.id} with ${(profile as any).participants?.length || 0} participants`);
        } catch (createError: any) {
          logger.error(`Error creating profile automatically: ${createError?.message}`, createError?.stack);
          // Если ошибка из-за того, что профиль уже существует (race condition), пытаемся получить его снова
          if (createError?.code === 'P2002') {
            logger.info(`Profile was created by another request, fetching again...`);
            profile = await this.prisma.eventProfile.findUnique({
              where: { eventId },
              include: {
                posts: {
                  include: {
                    author: {
                      select: {
                        id: true,
                        name: true,
                        username: true,
                        avatarUrl: true,
                      },
                    },
                    comments: {
                      include: {
                        author: {
                          select: {
                            id: true,
                            name: true,
                            username: true,
                            avatarUrl: true,
                          },
                        },
                      },
                      orderBy: { createdAt: 'asc' },
                    },
                  },
                  orderBy: { createdAt: 'desc' },
                },
                participants: {
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
          } else {
            throw createError;
          }
        }
      }
      
      if (!profile) {
        logger.error(`Profile not found and could not be created for eventId: ${eventId}`);
        throw new NotFoundException('Event profile not found');
      }
      
      logger.info(`Profile retrieved: found with ${(profile as any).posts?.length || 0} posts`);
      
      // Преобразуем JSON поля в массивы для каждого поста
      if ((profile as any).posts) {
        profile.posts = profile.posts.map(post => {
          // Преобразуем photoUrls из JSON в массив
          let photoUrlsArray: string[] | null = null;
          if (post.photoUrls) {
            if (Array.isArray(post.photoUrls)) {
              photoUrlsArray = post.photoUrls as string[];
            } else if (typeof post.photoUrls === 'string') {
              try {
                photoUrlsArray = JSON.parse(post.photoUrls);
              } catch {
                photoUrlsArray = null;
              }
            } else {
              try {
                photoUrlsArray = JSON.parse(JSON.stringify(post.photoUrls));
              } catch {
                photoUrlsArray = null;
              }
            }
          }
          
          // Преобразуем captions из JSON в массив
          let captionsArray: string[] | null = null;
          if (post.captions) {
            if (Array.isArray(post.captions)) {
              captionsArray = post.captions as string[];
            } else if (typeof post.captions === 'string') {
              try {
                captionsArray = JSON.parse(post.captions);
              } catch {
                captionsArray = null;
              }
            } else {
              try {
                captionsArray = JSON.parse(JSON.stringify(post.captions));
              } catch {
                captionsArray = null;
              }
            }
          }
          
          return {
            ...post,
            photoUrls: photoUrlsArray,
            captions: captionsArray,
          };
        });
      }
      
      let allParticipants: any[] = (profile as any).participants ?? [];

      const eventOwner = await this.prisma.event.findUnique({
        where: { id: eventId },
        select: { organizerId: true },
      });

      /**
       * Состав чинится сам.
       *
       * Строки участников профиля заводятся один раз — при его создании. Если
       * человек присоединился позже или роль организатора перешла другому,
       * строки у него нет вовсе, и он не считается участником прошедшего
       * события: событие пропадает из его «меморис». Дописываем недостающих по
       * членствам — но ТОЛЬКО тем, у кого строки нет совсем. У вышедшего
       * строка есть, с пометкой leftAt, и трогать её нельзя.
       */
      const shouldBeThere = new Set<string>();
      if (eventOwner?.organizerId) shouldBeThere.add(eventOwner.organizerId);
      const acceptedMembers = await this.prisma.eventMembership.findMany({
        where: { eventId, status: MembershipStatus.ACCEPTED },
        select: { userId: true },
      });
      acceptedMembers.forEach(m => shouldBeThere.add(m.userId));

      const knownIds = new Set(allParticipants.map(p => p.userId));
      const missingIds = [...shouldBeThere].filter(id => !knownIds.has(id));
      if (missingIds.length > 0) {
        logger.info(`Дописываем ${missingIds.length} участников профиля события ${eventId}`);
        await this.prisma.eventProfileParticipant.createMany({
          data: missingIds.map(userId => ({ profileId: profile.id, userId })),
          skipDuplicates: true,
        });
        allParticipants = await this.prisma.eventProfileParticipant.findMany({
          where: { profileId: profile.id },
          include: {
            user: { select: { id: true, name: true, username: true, avatarUrl: true } },
          },
        });
      }

      /**
       * Вернувшимся снимаем пометку.
       *
       * Выход помечается, а не удаляется (leftAt), поэтому человек, который
       * вышел и потом вступил заново, иначе так и остался бы «вышедшим».
       * Сверяемся с членством в событии — оно и есть источник правды.
       * Проверка стоит под условием: помеченных строк почти нигде нет, и
       * лишнего запроса на каждое чтение профиля не хочется.
       */
      const markedIds = allParticipants.filter(p => p.leftAt).map(p => p.userId);
      if (markedIds.length > 0) {
        const rejoined = await this.prisma.eventMembership.findMany({
          where: { eventId, userId: { in: markedIds }, status: MembershipStatus.ACCEPTED },
          select: { userId: true },
        });
        if (rejoined.length > 0) {
          const rejoinedIds = rejoined.map(m => m.userId);
          await this.prisma.eventProfileParticipant.updateMany({
            where: { profileId: profile.id, userId: { in: rejoinedIds } },
            data: { leftAt: null },
          });
          allParticipants.forEach(p => {
            if (rejoinedIds.includes(p.userId)) p.leftAt = null;
          });
        }
      }

      const stayed = allParticipants.filter(p => !p.leftAt);
      const left = allParticipants.filter(p => p.leftAt);

      // Строго по составу: организатор тоже стоит в участниках (выше об этом
      // заботится самопочинка), а вышедший — даже если он числится
      // организатором события — участником уже не считается.
      const viewerIsMember = !!viewerId && stayed.some(p => p.userId === viewerId);

      return {
        ...(profile as any),
        participants: stayed,
        // Вышедшие — только своим. Для остальных поле пустое, а не скрытое:
        // клиенту проще не гадать, есть оно в ответе или нет.
        formerParticipants: viewerIsMember ? left : [],
      };
    } catch (error) {
      logger.error(`Error getting profile: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  async createProfile(eventId: string, userId: string, dto: CreateEventProfileDto) {
    try {
      logger.info(`📤 Creating profile for eventId: ${eventId}, userId: ${userId}`);
      
      const event = await this.prisma.event.findUnique({ where: { id: eventId } });
      if (!event) {
        logger.error(`Event not found: ${eventId}`);
        throw new NotFoundException('Event not found');
      }
      logger.debug(`Event found: ${event.id}`);

      // Проверяем, что пользователь является участником события (организатор или принятый участник)
      const isOrganizer = event.organizerId === userId;
      logger.debug(`Is organizer: ${isOrganizer}`);
      
      const membership = await this.prisma.eventMembership.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });
      const isParticipant = membership && membership.status === MembershipStatus.ACCEPTED;
      logger.debug(`Is participant: ${isParticipant}, membership status: ${membership?.status}`);

      if (!isOrganizer && !isParticipant) {
        logger.error(`User is not authorized to create profile`);
        throw new ForbiddenException('Must be an accepted participant or organizer to create profile');
      }

      const existing = await this.prisma.eventProfile.findUnique({ where: { eventId } });
      if (existing) {
        logger.error(`Profile already exists: ${eventId}`);
        throw new BadRequestException('Profile already exists');
      }

      // Получаем всех принятых участников события
      const acceptedMemberships = await this.prisma.eventMembership.findMany({
        where: {
          eventId,
          status: MembershipStatus.ACCEPTED,
        },
      });
      const participantIds = [event.organizerId, ...acceptedMemberships.map(m => m.userId)];
      const uniqueParticipantIds = Array.from(new Set(participantIds));
      logger.debug(`Participants count: ${uniqueParticipantIds.length}`);

      const profile = await this.prisma.eventProfile.create({
        data: {
          eventId,
          ...dto,
          participants: {
            create: uniqueParticipantIds.map(participantId => ({
              userId: participantId,
            })),
          },
        },
        include: {
          posts: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          participants: {
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

      logger.info(`Profile created successfully: ${profile.id}`);
      return profile;
    } catch (error) {
      logger.error(`Error creating profile: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  async updateProfile(eventId: string, userId: string, updates: Partial<CreateEventProfileDto>) {
    try {
      logger.info(`🔄 Updating profile for eventId: ${eventId}, userId: ${userId}`);
      logger.debug(`Updates: ${JSON.stringify(updates, null, 2)}`);
      
      let profile = await this.prisma.eventProfile.findUnique({ where: { eventId } });
      
      // Если профиль не существует, создаем его автоматически
      if (!profile) {
        logger.info(`Profile not found, creating automatically...`);
        const event = await this.prisma.event.findUnique({ where: { id: eventId } });
        if (!event) {
          logger.error(`Event not found: ${eventId}`);
          throw new NotFoundException('Event not found');
        }
        
        // Создаем профиль автоматически
        const acceptedMemberships = await this.prisma.eventMembership.findMany({
          where: {
            eventId,
            status: MembershipStatus.ACCEPTED,
          },
        });
        const participantIds = [event.organizerId, ...acceptedMemberships.map(m => m.userId)];
        const uniqueParticipantIds = Array.from(new Set(participantIds));
        logger.debug(`Creating profile with ${uniqueParticipantIds.length} participants`);
        
        profile = await this.prisma.eventProfile.create({
          data: {
            eventId,
            name: event.title,
            description: event.description || '',
            date: event.startTime.toISOString().split('T')[0],
            time: new Date(event.startTime.getTime() + 3 * 60 * 60 * 1000)
              .toISOString()
              .slice(11, 16),
            location: event.location || '',
            participants: {
              create: uniqueParticipantIds.map(participantId => ({
                userId: participantId,
              })),
            },
          },
        });
        logger.info(`Profile created automatically: ${profile.id}`);
      }

      const event = await this.prisma.event.findUnique({ where: { id: eventId } });
      if (!event) {
        logger.error(`Event not found: ${eventId}`);
        throw new NotFoundException('Event not found');
      }

      // Только организатор или участник профиля может обновлять
      const isOrganizer = event.organizerId === userId;
      const participantRow = await this.prisma.eventProfileParticipant.findUnique({
        where: { profileId_userId: { profileId: profile.id, userId } },
      });
      // Вышедший из события правки вносить не может.
      const isParticipant = !!participantRow && !participantRow.leftAt;

      if (!isOrganizer && !isParticipant) {
        logger.error(`User not authorized to update profile`);
        throw new ForbiddenException('Not authorized to update profile');
      }

      const result = await this.prisma.eventProfile.update({
        where: { eventId },
        data: updates,
        include: {
          posts: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          participants: {
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
      
      logger.info(`Profile updated successfully`);
      return result;
    } catch (error) {
      logger.error(`Error updating profile: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  async getPosts(eventId: string) {
    try {
      logger.info(`📥 Getting posts for eventId: ${eventId}`);
      const profile = await this.prisma.eventProfile.findUnique({ where: { eventId } });
      if (!profile) {
        logger.debug(`Profile not found, returning empty array`);
        return [];
      }

      const posts = await this.prisma.eventProfilePost.findMany({
        where: { eventId },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true,
            },
          },
          comments: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      
      logger.info(`Posts retrieved: ${posts.length}`);
      
      // Преобразуем JSON поля в массивы для каждого поста
      const postsWithArrays = posts.map(post => {
        // Преобразуем photoUrls из JSON в массив
        let photoUrlsArray: string[] | null = null;
        if (post.photoUrls) {
          if (Array.isArray(post.photoUrls)) {
            photoUrlsArray = post.photoUrls as string[];
          } else if (typeof post.photoUrls === 'string') {
            try {
              photoUrlsArray = JSON.parse(post.photoUrls);
            } catch {
              photoUrlsArray = null;
            }
          } else {
            // Prisma возвращает JSON как объект
            try {
              photoUrlsArray = JSON.parse(JSON.stringify(post.photoUrls));
            } catch {
              photoUrlsArray = null;
            }
          }
        }
        
        // Преобразуем captions из JSON в массив
        let captionsArray: string[] | null = null;
        if (post.captions) {
          if (Array.isArray(post.captions)) {
            captionsArray = post.captions as string[];
          } else if (typeof post.captions === 'string') {
            try {
              captionsArray = JSON.parse(post.captions);
            } catch {
              captionsArray = null;
            }
          } else {
            // Prisma возвращает JSON как объект
            try {
              captionsArray = JSON.parse(JSON.stringify(post.captions));
            } catch {
              captionsArray = null;
            }
          }
        }
        
        return {
          ...post,
          photoUrls: photoUrlsArray,
          captions: captionsArray,
        };
      });
      
      // Логируем структуру постов для отладки
      postsWithArrays.forEach((post, index) => {
        logger.debug(`Post ${index + 1}:`, {
          id: post.id,
          hasPhotoUrl: !!post.photoUrl,
          hasPhotoUrls: !!post.photoUrls,
          photoUrlsType: typeof post.photoUrls,
          photoUrlsValue: post.photoUrls,
          photoUrlsLength: Array.isArray(post.photoUrls) ? post.photoUrls.length : 0,
          hasCaptions: !!post.captions,
          captionsType: typeof post.captions,
          captionsValue: post.captions,
          captionsLength: Array.isArray(post.captions) ? post.captions.length : 0,
        });
      });
      
      return postsWithArrays;
    } catch (error) {
      logger.error(`Error getting posts: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  async addPost(eventId: string, userId: string, dto: CreateEventProfilePostDto) {
    try {
      logger.info(`📤 Adding post for eventId: ${eventId}, userId: ${userId}`);
      logger.debug(`DTO: ${JSON.stringify(dto, null, 2)}`);
      
      let profile = await this.prisma.eventProfile.findUnique({ where: { eventId } });
      
      // Если профиль не существует, создаем его автоматически
      if (!profile) {
        logger.info(`Profile not found, creating automatically...`);
        const event = await this.prisma.event.findUnique({ where: { id: eventId } });
        if (!event) {
          logger.error(`Event not found: ${eventId}`);
          throw new NotFoundException('Event not found');
        }
        
        // Создаем профиль автоматически
        const acceptedMemberships = await this.prisma.eventMembership.findMany({
          where: {
            eventId,
            status: MembershipStatus.ACCEPTED,
          },
        });
        const participantIds = [event.organizerId, ...acceptedMemberships.map(m => m.userId)];
        const uniqueParticipantIds = Array.from(new Set(participantIds));
        logger.debug(`Creating profile with ${uniqueParticipantIds.length} participants`);
        
        profile = await this.prisma.eventProfile.create({
          data: {
            eventId,
            name: event.title,
            description: event.description || '',
            date: event.startTime.toISOString().split('T')[0],
            time: new Date(event.startTime.getTime() + 3 * 60 * 60 * 1000)
              .toISOString()
              .slice(11, 16),
            location: event.location || '',
            participants: {
              create: uniqueParticipantIds.map(participantId => ({
                userId: participantId,
              })),
            },
          },
        });
        logger.info(`Profile created automatically: ${profile.id}`);
      }

      // Разрешаем добавлять посты к любым событиям (как прошедшим, так и будущим)
      // Проверка на прошедшее событие убрана, так как теперь можно добавлять посты к будущим событиям

      // Проверяем, что пользователь является участником профиля.
      //
      // ВАЖНО: организатор события допускается всегда. Организатор далеко не
      // всегда попадает в EventProfileParticipant (у профилей, созданных
      // раньше, список участников бывает вообще пустым) — и из-за этого
      // автор события не мог добавить меморис-пост к собственному событию:
      // фото уже загружалось в хранилище, а сам пост отклонялся с
      // «Must be a profile participant to add posts».
      const eventOwner = await this.prisma.event.findUnique({
        where: { id: eventId },
        select: { organizerId: true },
      });
      const isOrganizer = eventOwner?.organizerId === userId;
      const participantRow = isOrganizer
        ? null
        : await this.prisma.eventProfileParticipant.findUnique({
            where: { profileId_userId: { profileId: profile.id, userId } },
          });
      // Вышедший из события участником больше не считается: строка осталась,
      // но у неё проставлен leftAt (см. EventProfileParticipant).
      const isParticipant = isOrganizer || (!!participantRow && !participantRow.leftAt);
      if (!isParticipant) {
        logger.error(`User is not a profile participant`);
        throw new ForbiddenException('Must be a profile participant to add posts');
      }

      // Организатора, которого не оказалось в списке участников профиля,
      // дописываем — чтобы дальше он считался участником штатно.
      if (isOrganizer) {
        await this.prisma.eventProfileParticipant.upsert({
          where: { profileId_userId: { profileId: profile.id, userId } },
          create: { profileId: profile.id, userId },
          update: { leftAt: null },
        });
      }
      logger.debug(`User is authorized to add post`);

      // Получаем данные автора для уведомлений
      const author = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true,
        },
      });
      logger.debug(`Author found: ${author ? author.username : 'not found'}`);

      // Подготавливаем данные для сохранения
      const postData: any = {
        eventId,
        profileId: profile.id,
        authorId: userId,
        content: dto.content || null, // Может быть пустым для постов с каруселью
        photoUrl: dto.photoUrl || null, // Для карусели может быть null
      };

      // Если есть массив photoUrls, сохраняем его как JSON (приоритет над photoUrl)
      if (dto.photoUrls && Array.isArray(dto.photoUrls) && dto.photoUrls.length > 0) {
        postData.photoUrls = dto.photoUrls as any; // Prisma автоматически конвертирует массив в JSON
        logger.debug(`Saving photoUrls: ${JSON.stringify(dto.photoUrls)}`);
        // Если есть photoUrls, не устанавливаем photoUrl (для карусели)
        postData.photoUrl = null;
      }

      // Если есть массив captions, сохраняем его как JSON
      if (dto.captions && Array.isArray(dto.captions) && dto.captions.length > 0) {
        postData.captions = dto.captions as any; // Prisma автоматически конвертирует массив в JSON
        logger.debug(`Saving captions: ${JSON.stringify(dto.captions)}`);
      }

      logger.debug(`Creating post with data:`, {
        hasPhotoUrl: !!postData.photoUrl,
        hasPhotoUrls: !!postData.photoUrls,
        photoUrlsCount: Array.isArray(postData.photoUrls) ? postData.photoUrls.length : 0,
        hasCaptions: !!postData.captions,
        captionsCount: Array.isArray(postData.captions) ? postData.captions.length : 0,
        content: postData.content,
      });

      const post = await this.prisma.eventProfilePost.create({
        data: postData,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      });
      
      // Преобразуем JSON поля в массивы для возврата
      let photoUrlsArray: string[] | null = null;
      if (post.photoUrls) {
        if (Array.isArray(post.photoUrls)) {
          photoUrlsArray = post.photoUrls as string[];
        } else if (typeof post.photoUrls === 'string') {
          try {
            photoUrlsArray = JSON.parse(post.photoUrls);
          } catch {
            photoUrlsArray = null;
          }
        } else {
          // Prisma возвращает JSON как объект
          try {
            photoUrlsArray = JSON.parse(JSON.stringify(post.photoUrls));
          } catch {
            photoUrlsArray = null;
          }
        }
      }
      
      let captionsArray: string[] | null = null;
      if (post.captions) {
        if (Array.isArray(post.captions)) {
          captionsArray = post.captions as string[];
        } else if (typeof post.captions === 'string') {
          try {
            captionsArray = JSON.parse(post.captions);
          } catch {
            captionsArray = null;
          }
        } else {
          // Prisma возвращает JSON как объект
          try {
            captionsArray = JSON.parse(JSON.stringify(post.captions));
          } catch {
            captionsArray = null;
          }
        }
      }

      logger.info(`Post created: ${post.id}`, {
        hasPhotoUrl: !!post.photoUrl,
        hasPhotoUrls: !!photoUrlsArray,
        photoUrlsType: typeof photoUrlsArray,
        photoUrlsValue: photoUrlsArray,
        photoUrlsLength: Array.isArray(photoUrlsArray) ? photoUrlsArray.length : 0,
      });

      // Создаем уведомления для всех участников о добавлении поста
      if (author) {
        logger.debug(`📬 Sending notifications...`);
        await this.notificationsService.notifyEventParticipants(
          eventId,
          userId,
          'EVENT_POST_ADDED' as NotificationType,
          {
            actorId: userId,
            actorName: author.name || author.username,
            postId: post.id,
          },
        );
        logger.info(`Notifications sent`);
      }

      // Логируем что возвращаем
      logger.debug(`Returning post:`, {
        id: post.id,
        hasPhotoUrl: !!post.photoUrl,
        hasPhotoUrls: !!photoUrlsArray,
        photoUrlsType: typeof photoUrlsArray,
        photoUrlsValue: photoUrlsArray,
        photoUrlsLength: Array.isArray(photoUrlsArray) ? photoUrlsArray.length : 0,
        hasCaptions: !!captionsArray,
        captionsType: typeof captionsArray,
        captionsValue: captionsArray,
        captionsLength: Array.isArray(captionsArray) ? captionsArray.length : 0,
      });
      
      // Возвращаем пост с преобразованными JSON полями
      return {
        ...post,
        photoUrls: photoUrlsArray,
        captions: captionsArray,
      };
    } catch (error) {
      logger.error(`Error adding post: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  async addComment(eventId: string, postId: string, userId: string, content: string) {
    try {
      logger.info(`📤 Adding comment for postId: ${postId}, userId: ${userId}`);
      
      const post = await this.prisma.eventProfilePost.findUnique({ 
        where: { id: postId },
        include: { profile: true }
      });
      
      if (!post || post.eventId !== eventId) {
        throw new NotFoundException('Post not found');
      }

      // Проверяем, что пользователь является участником профиля
      const commenterRow = await this.prisma.eventProfileParticipant.findUnique({
        where: { profileId_userId: { profileId: post.profileId, userId } },
      });
      const isParticipant = !!commenterRow && !commenterRow.leftAt;
      if (!isParticipant) {
        throw new ForbiddenException('Must be a profile participant to add comments');
      }

      const comment = await this.prisma.postComment.create({
        data: {
          postId,
          authorId: userId,
          content,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      });

      logger.info(`Comment created: ${comment.id}`);
      void this.notifyPostAuthor(NotificationType.EVENT_POST_COMMENTED, postId, userId, content);
      return comment;
    } catch (error) {
      logger.error(`Error adding comment: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  async toggleLike(postId: string, userId: string) {
    const post = await this.prisma.eventProfilePost.findUnique({ where: { id: postId }, select: { likes: true } });
    if (!post) throw new NotFoundException('Post not found');
    const likes = post.likes || [];
    const hasLiked = likes.includes(userId);
    await this.prisma.eventProfilePost.update({
      where: { id: postId },
      data: { likes: hasLiked ? likes.filter(id => id !== userId) : [...likes, userId] },
    });
    if (!hasLiked) {
      void this.notifyPostAuthor(NotificationType.EVENT_POST_LIKED, postId, userId);
    }
    return { liked: !hasLiked, likesCount: hasLiked ? likes.length - 1 : likes.length + 1 };
  }

  /**
   * Уведомление автору публикации о лайке или комментарии.
   *
   * Раньше ни то, ни другое уведомлений не порождало: об отклике автор узнавал,
   * только открыв публикацию. Себе не пишем. Лайк можно снять и поставить
   * снова — за тот же лайк повторно не пишем, иначе сердечком можно было бы
   * засыпать человека пушами.
   */
  private async notifyPostAuthor(
    type: NotificationType,
    postId: string,
    actorId: string,
    commentText?: string,
  ) {
    try {
      const post = await this.prisma.eventProfilePost.findUnique({
        where: { id: postId },
        select: { authorId: true, eventId: true, photoUrl: true, photoUrls: true },
      });
      if (!post || post.authorId === actorId) return;

      if (type === NotificationType.EVENT_POST_LIKED) {
        const already = await this.prisma.notification.findFirst({
          where: {
            userId: post.authorId,
            type,
            AND: [
              { payload: { path: ['postId'], equals: postId } },
              { payload: { path: ['actorId'], equals: actorId } },
            ],
          },
          select: { id: true },
        });
        if (already) return;
      }

      const [actor, event] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: actorId },
          select: { name: true, username: true },
        }),
        this.prisma.event.findUnique({
          where: { id: post.eventId },
          select: { title: true, mediaUrl: true },
        }),
      ]);

      const preview = commentText?.trim().replace(/\s+/g, ' ');
      await this.notificationsService.createNotification({
        userId: post.authorId,
        type,
        payload: {
          actorId,
          actorName: actor?.name || actor?.username || undefined,
          eventId: post.eventId,
          eventTitle: event?.title,
          eventMediaUrl: event?.mediaUrl || undefined,
          postId,
          postPhotoUrl: firstPhotoUrl(post.photoUrls) || post.photoUrl || undefined,
          commentPreview: preview
            ? preview.length > 100
              ? `${preview.slice(0, 99)}…`
              : preview
            : undefined,
        },
      });
    } catch (error) {
      logger.warn(`Не удалось уведомить автора публикации ${postId}: ${(error as Error)?.message}`);
    }
  }

  async updatePost(eventId: string, postId: string, userId: string, updates: Partial<CreateEventProfilePostDto>) {
    try {
      logger.info(`🔄 Updating post for eventId: ${eventId}, postId: ${postId}, userId: ${userId}`);
      logger.debug(`Updates: ${JSON.stringify(updates, null, 2)}`);
      
      const post = await this.prisma.eventProfilePost.findUnique({ where: { id: postId } });
      if (!post || post.eventId !== eventId) {
        logger.error(`Post not found: ${postId}`);
        throw new NotFoundException('Post not found');
      }

      if (post.authorId !== userId) {
        logger.error(`User is not the author of the post`);
        throw new ForbiddenException('Can only update own posts');
      }

      const result = await this.prisma.eventProfilePost.update({
        where: { id: postId },
        data: updates,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      });
      
      logger.info(`Post updated successfully`);
      return result;
    } catch (error) {
      logger.error(`Error updating post: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  async deletePost(eventId: string, postId: string, userId: string) {
    try {
      logger.info(`🗑️ Deleting post for eventId: ${eventId}, postId: ${postId}, userId: ${userId}`);
      
      const post = await this.prisma.eventProfilePost.findUnique({ where: { id: postId } });
      if (!post || post.eventId !== eventId) {
        logger.error(`Post not found: ${postId}`);
        throw new NotFoundException('Post not found');
      }

      if (post.authorId !== userId) {
        logger.error(`User is not the author of the post`);
        throw new ForbiddenException('Can only delete own posts');
      }

      const result = await this.prisma.eventProfilePost.delete({ where: { id: postId } });
      logger.info(`Post deleted successfully`);
      return result;
    } catch (error) {
      logger.error(`Error deleting post: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  async removeParticipant(eventId: string, userId: string) {
    try {
      logger.info(`🗑️ Removing participant: ${userId} from event: ${eventId}`);
      
      const profile = await this.prisma.eventProfile.findUnique({
        where: { eventId },
        include: {
          participants: true,
        },
      });

      if (!profile) {
        logger.info(`Profile not found for event: ${eventId}`);
        return { success: true, message: 'Profile not found, nothing to remove' };
      }

      const participantsBefore = profile.participants.filter(p => !p.leftAt).length;
      
      // Помечаем выход, строку не удаляем: список участников события помнит
      // всех, кто в нём был (см. EventProfileParticipant.leftAt).
      const deleted = await this.prisma.eventProfileParticipant.updateMany({
        where: {
          profileId: profile.id,
          userId: userId,
          leftAt: null,
        },
        data: { leftAt: new Date() },
      });

      const remainingCount = participantsBefore - deleted.count;
      logger.info(`Participant marked as left, updated: ${deleted.count}, remaining: ${remainingCount}`);
      
      // КРИТИЧЕСКИ ВАЖНО: Если участников стало 0 - удаляем событие полностью
      if (remainingCount === 0 || (participantsBefore === 1 && deleted.count === 1)) {
        logger.info(`🗑️ Последний участник удален, нужно удалить событие полностью`);
        // Возвращаем флаг, что нужно удалить событие
        return { success: true, deletedCount: deleted.count, shouldDeleteEvent: true, eventId };
      }
      
      return { success: true, deletedCount: deleted.count };
    } catch (error) {
      logger.error(`Error removing participant: ${error?.message}`, error?.stack);
      throw error;
    }
  }
}

