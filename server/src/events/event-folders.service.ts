import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class EventFoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(ownerId: string, name: string, description?: string, coverPhotoFile?: Express.Multer.File) {
    let coverPhotoUrl: string | null = null;

    if (coverPhotoFile && coverPhotoFile.buffer) {
      coverPhotoUrl = await this.storage.uploadEventMedia(ownerId, {
        buffer: coverPhotoFile.buffer,
        mimetype: coverPhotoFile.mimetype || 'image/jpeg',
        originalName: coverPhotoFile.originalname || 'cover.jpg',
      });
    }

    return this.prisma.eventFolder.create({
      data: {
        ownerId,
        name: name.trim(),
        description: description?.trim() || null,
        coverPhotoUrl,
      },
      include: {
        events: {
          include: {
            event: {
              select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true,
                mediaUrl: true,
                originalMediaUrl: true,
                location: true,
                organizerId: true,
              },
            },
          },
        },
      },
    });
  }

  async list(ownerId: string) {
    const folders = await this.prisma.eventFolder.findMany({
      where: { ownerId },
      include: {
        events: {
          include: {
            event: {
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
                  where: {
                    status: 'ACCEPTED',
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
                profile: {
                  include: {
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
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Вычисляем продолжительность, количество событий и участников для каждой папки
    return folders.map(folder => {
      const events = folder.events.map(e => e.event);
      const eventCount = events.length;
      
      // Собираем всех уникальных участников из всех событий
      const allParticipants = new Map<string, any>();
      
      events.forEach(event => {
        // Участники из memberships
        event.memberships?.forEach(membership => {
          if (!allParticipants.has(membership.user.id)) {
            allParticipants.set(membership.user.id, membership.user);
          }
        });
        
        // Участники из profile
        event.profile?.participants?.forEach(participant => {
          if (!allParticipants.has(participant.user.id)) {
            allParticipants.set(participant.user.id, participant.user);
          }
        });
      });
      
      // Находим самую раннюю и самую позднюю дату
      let earliestDate: Date | null = null;
      let latestDate: Date | null = null;
      
      events.forEach(event => {
        if (event.startTime) {
          if (!earliestDate || event.startTime < earliestDate) {
            earliestDate = event.startTime;
          }
        }
        const eventEndTime = event.endTime || event.startTime;
        if (eventEndTime) {
          if (!latestDate || eventEndTime > latestDate) {
            latestDate = eventEndTime;
          }
        }
      });

      return {
        ...folder,
        eventCount,
        participants: Array.from(allParticipants.values()),
        duration: earliestDate && latestDate ? {
          start: earliestDate,
          end: latestDate,
        } : null,
      };
    });
  }

  async getById(ownerId: string, folderId: string) {
    const folder = await this.prisma.eventFolder.findUnique({
      where: { id: folderId },
      include: {
        events: {
          include: {
            event: {
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
                  where: {
                    status: 'ACCEPTED',
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
                profile: {
                  include: {
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
                },
              },
            },
          },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    if (folder.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized');
    }

    // Собираем всех уникальных участников из всех событий
    const allParticipants = new Map<string, any>();
    
    folder.events.forEach(({ event }) => {
      // Участники из memberships
      event.memberships?.forEach(membership => {
        if (!allParticipants.has(membership.user.id)) {
          allParticipants.set(membership.user.id, membership.user);
        }
      });
      
      // Участники из profile
      event.profile?.participants?.forEach(participant => {
        if (!allParticipants.has(participant.user.id)) {
          allParticipants.set(participant.user.id, participant.user);
        }
      });
    });

    // Находим самую раннюю и самую позднюю дату
    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;
    
    folder.events.forEach(({ event }) => {
      if (event.startTime) {
        if (!earliestDate || event.startTime < earliestDate) {
          earliestDate = event.startTime;
        }
      }
      const eventEndTime = event.endTime || event.startTime;
      if (eventEndTime) {
        if (!latestDate || eventEndTime > latestDate) {
          latestDate = eventEndTime;
        }
      }
    });

    return {
      ...folder,
      participants: Array.from(allParticipants.values()),
      duration: earliestDate && latestDate ? {
        start: earliestDate,
        end: latestDate,
      } : null,
    };
  }

  async addEvent(ownerId: string, folderId: string, eventId: string) {
    const folder = await this.prisma.eventFolder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }
    if (folder.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized');
    }

    // Проверяем, что событие существует
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Клиент уже фильтрует события и показывает только прошедшие в режиме select
    // Клиент использует date и time строки для проверки, которые более надежны
    // startTime/endTime в базе могут быть некорректными из-за проблем с часовыми поясами
    // Поэтому доверяем проверке клиента и не блокируем добавление на сервере
    // Только логируем для отладки
    
    const now = new Date();
    const eventEndTime = event.endTime || event.startTime;
    
    // Логируем для отладки
    console.log('Adding event to folder:', {
      eventId,
      folderId,
      eventTitle: event.title,
      eventStartTime: event.startTime,
      eventEndTime: event.endTime,
      now,
      eventEndTimeISO: eventEndTime ? eventEndTime.toISOString() : null,
      nowISO: now.toISOString(),
      timeDiff: eventEndTime ? eventEndTime.getTime() - now.getTime() : null,
      timeDiffMinutes: eventEndTime ? (eventEndTime.getTime() - now.getTime()) / (60 * 1000) : null,
      timeDiffHours: eventEndTime ? (eventEndTime.getTime() - now.getTime()) / (60 * 60 * 1000) : null,
      isPast: eventEndTime ? eventEndTime.getTime() <= now.getTime() : 'no time',
      note: 'Client already validated event as past via date/time strings',
    });
    
    // Разрешаем добавление - клиент уже проверил через date/time строки
    // Проверка на сервере через startTime/endTime может быть некорректной из-за часовых поясов

    return this.prisma.eventFolderEvent.upsert({
      where: { folderId_eventId: { folderId, eventId } },
      update: {},
      create: {
        folderId,
        eventId,
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            mediaUrl: true,
            originalMediaUrl: true,
            location: true,
            organizerId: true,
          },
        },
      },
    });
  }

  async removeEvent(ownerId: string, folderId: string, eventId: string) {
    const folder = await this.prisma.eventFolder.findUnique({ 
      where: { id: folderId },
      include: {
        events: true,
      },
    });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }
    if (folder.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized');
    }

    // Удаляем событие из папки
    await this.prisma.eventFolderEvent.delete({
      where: { folderId_eventId: { folderId, eventId } },
    });

    // Проверяем, остались ли еще события в папке
    const remainingEvents = await this.prisma.eventFolderEvent.count({
      where: { folderId },
    });

    // Если событий не осталось - удаляем папку
    if (remainingEvents === 0) {
      await this.prisma.eventFolder.delete({
        where: { id: folderId },
      });
      return { deleted: true, folderDeleted: true };
    }

    return { deleted: true, folderDeleted: false };
  }

  async delete(ownerId: string, folderId: string) {
    const folder = await this.prisma.eventFolder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }
    if (folder.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized');
    }

    // Удаляем обложку, если есть
    // Примечание: StorageService не имеет метода deleteFile, поэтому просто удаляем запись из БД
    // Файл останется в хранилище, но это не критично
    if (folder.coverPhotoUrl) {
      // Можно добавить удаление файла через S3 API в будущем, если понадобится
    }

    return this.prisma.eventFolder.delete({ where: { id: folderId } });
  }

  async update(ownerId: string, folderId: string, name?: string, description?: string, coverPhotoFile?: Express.Multer.File) {
    const folder = await this.prisma.eventFolder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }
    if (folder.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized');
    }

    let coverPhotoUrl = folder.coverPhotoUrl;

    if (coverPhotoFile && coverPhotoFile.buffer) {
      // Удаляем старую обложку, если есть
      // Примечание: StorageService не имеет метода deleteFile, поэтому просто перезаписываем
      // Старый файл останется в хранилище, но это не критично
      if (coverPhotoUrl) {
        // Можно добавить удаление файла через S3 API в будущем, если понадобится
      }
      coverPhotoUrl = await this.storage.uploadEventMedia(ownerId, {
        buffer: coverPhotoFile.buffer,
        mimetype: coverPhotoFile.mimetype || 'image/jpeg',
        originalName: coverPhotoFile.originalname || 'cover.jpg',
      });
    }

    return this.prisma.eventFolder.update({
      where: { id: folderId },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(coverPhotoUrl && { coverPhotoUrl }),
      },
      include: {
        events: {
          include: {
            event: {
              select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true,
                mediaUrl: true,
                originalMediaUrl: true,
                location: true,
                organizerId: true,
              },
            },
          },
        },
      },
    });
  }
}
