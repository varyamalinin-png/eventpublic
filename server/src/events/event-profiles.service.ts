import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventProfileDto } from './dto/create-event-profile.dto';
import { CreateEventProfilePostDto } from './dto/create-event-profile-post.dto';
import { MembershipStatus, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { logger } from '../shared/utils/logger';

@Injectable()
export class EventProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getProfile(eventId: string) {
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
              time: event.startTime.toISOString().slice(11, 16),
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
      
      return profile;
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
            time: event.startTime.toISOString().slice(11, 16),
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
      const isParticipant = await this.prisma.eventProfileParticipant.findUnique({
        where: { profileId_userId: { profileId: profile.id, userId } },
      });

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
            time: event.startTime.toISOString().slice(11, 16),
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

      // Проверяем, что пользователь является участником профиля
      const isParticipant = await this.prisma.eventProfileParticipant.findUnique({
        where: { profileId_userId: { profileId: profile.id, userId } },
      });
      if (!isParticipant) {
        logger.error(`User is not a profile participant`);
        throw new ForbiddenException('Must be a profile participant to add posts');
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
      const isParticipant = await this.prisma.eventProfileParticipant.findUnique({
        where: { profileId_userId: { profileId: post.profileId, userId } },
      });
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
      return comment;
    } catch (error) {
      logger.error(`Error adding comment: ${error?.message}`, error?.stack);
      throw error;
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

      const participantsBefore = profile.participants.length;
      
      // Удаляем пользователя из participants
      const deleted = await this.prisma.eventProfileParticipant.deleteMany({
        where: {
          profileId: profile.id,
          userId: userId,
        },
      });

      const remainingCount = participantsBefore - deleted.count;
      logger.info(`Participant removed, deleted: ${deleted.count}, remaining: ${remainingCount}`);
      
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

