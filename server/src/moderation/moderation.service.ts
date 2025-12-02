import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async blockUser(userId: string, adminId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'ADMIN' || user.role === 'SUPPORT') {
      throw new ForbiddenException('Cannot block admin or support users');
    }

    if ((user as any).isBlocked) {
      throw new BadRequestException('User is already blocked');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isBlocked: true,
        blockedAt: new Date(),
        blockedById: adminId,
        blockReason: reason,
      } as any,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        isBlocked: true,
        blockedAt: true,
        blockReason: true,
      } as any,
    });
  }

  async unblockUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!(user as any).isBlocked) {
      throw new BadRequestException('User is not blocked');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isBlocked: false,
        blockedAt: null,
        blockedById: null,
        blockReason: null,
      } as any,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        isBlocked: true,
      } as any,
    });
  }

  async deleteEvent(eventId: string, adminId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        memberships: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Удаляем событие и все связанные данные
    await this.prisma.$transaction(async (tx) => {
      // Удаляем memberships
      await tx.eventMembership.deleteMany({ where: { eventId } });
      
      // Удаляем personal photos
      await tx.eventPersonalPhoto.deleteMany({ where: { eventId } });
      
      // Удаляем messages, связанные с событием
      await tx.message.updateMany({ where: { eventId }, data: { eventId: null } });
      
      // Удаляем chat события
      const chat = await tx.chat.findUnique({ where: { eventId } });
      if (chat) {
        await tx.message.deleteMany({ where: { chatId: chat.id } });
        await tx.chatParticipant.deleteMany({ where: { chatId: chat.id } });
        await tx.folderChat.deleteMany({ where: { chatId: chat.id } });
        await tx.chat.delete({ where: { id: chat.id } });
      }
      
      // Удаляем event profile
      await tx.eventProfile.deleteMany({ where: { eventId } });
      
      // Удаляем complaints
      await tx.complaint.deleteMany({ where: { reportedEventId: eventId } });
      
      // Удаляем событие
      await tx.event.delete({ where: { id: eventId } });
    });

    return { success: true, eventId };
  }

  async deletePost(eventId: string, postId: string, adminId: string) {
    const post = await this.prisma.eventProfilePost.findUnique({
      where: { id: postId },
      include: {
        profile: {
          include: {
            event: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.eventId !== eventId) {
      throw new BadRequestException('Post does not belong to this event');
    }

    await this.prisma.eventProfilePost.delete({
      where: { id: postId },
    });

    return { success: true, postId };
  }

  async deleteMessage(chatId: string, messageId: string, adminId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.chatId !== chatId) {
      throw new BadRequestException('Message does not belong to this chat');
    }

    await this.prisma.message.delete({
      where: { id: messageId },
    });

    // Обновляем lastMessage в чате, если это было последнее сообщение
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (chat) {
      const newLastMessage = chat.messages[0];
      await this.prisma.chat.update({
        where: { id: chatId },
        data: {
          lastMessageId: newLastMessage?.id || null,
        },
      });
    }

    return { success: true, messageId };
  }

  async getBlockedUsers() {
    return this.prisma.user.findMany({
      where: { isBlocked: true } as any,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        isBlocked: true,
        blockedAt: true,
        blockReason: true,
        blockedById: true,
        createdAt: true,
      } as any,
      orderBy: {
        blockedAt: 'desc',
      } as any,
    });
  }
}

