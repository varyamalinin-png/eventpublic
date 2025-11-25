import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFolderDto } from './dto/create-folder.dto';

@Injectable()
export class FoldersService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateFolderDto) {
    return this.prisma.folder.create({
      data: {
        ownerId: userId,
        name: dto.name,
      },
    });
  }

  list(userId: string) {
    return this.prisma.folder.findMany({
      where: { ownerId: userId },
      include: {
        chats: {
          include: {
            chat: {
              include: {
                participants: { include: { user: true } },
                lastMessage: { include: { sender: true } },
                event: { include: { organizer: true } },
              },
            },
          },
        },
      },
    });
  }

  private async ensureOwnership(folderId: string, ownerId: string) {
    const folder = await this.prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }
    if (folder.ownerId !== ownerId) {
      throw new ForbiddenException('You cannot modify this folder');
    }
    return folder;
  }

  async addChat(userId: string, folderId: string, chatId: string) {
    await this.ensureOwnership(folderId, userId);

    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!participant) {
      throw new ForbiddenException('You must be a member of the chat to add it to a folder');
    }

    await this.prisma.folderChat.upsert({
      where: { folderId_chatId: { folderId, chatId } },
      update: {},
      create: { folderId, chatId },
    });

    return this.list(userId);
  }

  async removeChat(userId: string, folderId: string, chatId: string) {
    await this.ensureOwnership(folderId, userId);

    await this.prisma.folderChat.delete({
      where: { folderId_chatId: { folderId, chatId } },
    });

    return this.list(userId);
  }
}
