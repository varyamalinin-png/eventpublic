import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserFoldersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, name: string) {
    return this.prisma.userFolder.create({
      data: {
        ownerId,
        name: name.trim(),
      },
      include: {
        userIds: {
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

  async list(ownerId: string) {
    return this.prisma.userFolder.findMany({
      where: { ownerId },
      include: {
        userIds: {
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
      orderBy: { createdAt: 'desc' },
    });
  }

  async addUser(ownerId: string, folderId: string, targetUserId: string) {
    const folder = await this.prisma.userFolder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }
    if (folder.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized');
    }

    return this.prisma.userFolderUser.upsert({
      where: { folderId_userId: { folderId, userId: targetUserId } },
      update: {},
      create: {
        folderId,
        userId: targetUserId,
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
  }

  async removeUser(ownerId: string, folderId: string, targetUserId: string) {
    const folder = await this.prisma.userFolder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }
    if (folder.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized');
    }

    return this.prisma.userFolderUser.delete({
      where: { folderId_userId: { folderId, userId: targetUserId } },
    });
  }

  async delete(ownerId: string, folderId: string) {
    const folder = await this.prisma.userFolder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }
    if (folder.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized');
    }

    return this.prisma.userFolder.delete({ where: { id: folderId } });
  }
}

