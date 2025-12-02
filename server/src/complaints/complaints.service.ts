import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ComplaintStatus, ComplaintType } from '@prisma/client';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('ComplaintsService');

@Injectable()
export class ComplaintsService {
  constructor(private prisma: PrismaService) {}

  async createComplaint(userId: string, dto: CreateComplaintDto) {
    try {
      logger.info(`Creating complaint:`, { userId, dto });
      
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Проверяем, что событие или пользователь существуют
      if (dto.type === 'EVENT' && dto.reportedEventId) {
        const event = await this.prisma.event.findUnique({
          where: { id: dto.reportedEventId },
        });
        if (!event) {
          throw new NotFoundException('Event not found');
        }
      }

      if (dto.type === 'USER' && dto.reportedUserId) {
        const user = await this.prisma.user.findUnique({
          where: { id: dto.reportedUserId },
        });
        if (!user) {
          throw new NotFoundException('User not found');
        }
        // Нельзя пожаловаться на себя
        if (dto.reportedUserId === userId) {
          throw new ForbiddenException('Cannot report yourself');
        }
      }

      const result = await this.prisma.complaint.create({
        data: {
          type: dto.type as ComplaintType,
          reason: dto.reason,
          description: dto.description || null,
          reporterId: userId,
          reportedEventId: dto.reportedEventId || null,
          reportedUserId: dto.reportedUserId || null,
          status: ComplaintStatus.PENDING,
        },
        include: {
          reporter: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true,
            },
          },
          reportedUser: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true,
            },
          },
          reportedEvent: {
            select: {
              id: true,
              title: true,
              organizerId: true,
            },
          },
        },
      });
      
      logger.info(`Complaint created successfully: ${result.id}`);
      return result;
    } catch (error) {
      logger.error(`Error creating complaint:`, error);
      throw error;
    }
  }

  async getComplaints(userId: string, status?: ComplaintStatus) {
    // Пользователь может видеть только свои жалобы
    return this.prisma.complaint.findMany({
      where: {
        reporterId: userId,
        ...(status && { status }),
      },
      include: {
        reportedUser: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
        reportedEvent: {
          select: {
            id: true,
            title: true,
            organizerId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getComplaintsCountForUser(userId: string): Promise<number> {
    // Получаем количество жалоб, поданных на этого пользователя
    return this.prisma.complaint.count({
      where: {
        reportedUserId: userId,
      },
    });
  }

  // Админские методы
  async getAllComplaints(status?: ComplaintStatus) {
    return this.prisma.complaint.findMany({
      where: status ? { status } : undefined,
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
        reportedUser: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
        reportedEvent: {
          select: {
            id: true,
            title: true,
            organizerId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateComplaintStatus(
    complaintId: string,
    status: ComplaintStatus,
    adminResponse?: string,
    reviewedById?: string,
  ) {
    return this.prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status,
        adminResponse,
        reviewedById,
        reviewedAt: new Date(),
      },
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
        reportedUser: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
        reportedEvent: {
          select: {
            id: true,
            title: true,
            organizerId: true,
          },
        },
      },
    });
  }
}

