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
                participants: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } } },
                lastMessage: { include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } } },
                event: { include: { organizer: { select: { id: true, name: true, username: true, avatarUrl: true } } } },
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

  /**
   * Доступен ли человеку этот чат.
   *
   * Проверка должна совпадать с тем, что отдаёт список чатов
   * (ChatsService.listChatsForUser): туда попадают не только чаты, где есть
   * строка ChatParticipant, но и чаты СОБЫТИЙ, которые человек организует или
   * в которых состоит — даже если из самого чата он вышел. Раньше здесь
   * требовалась только строка участника, поэтому половина видимых в
   * приложении чатов молча отваливалась с 403 при добавлении в папку: чат в
   * списке есть, а в папку не кладётся.
   */
  private async canUseChat(userId: string, chatId: string) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (participant) return true;

    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { eventId: true, event: { select: { organizerId: true } } },
    });
    if (!chat?.eventId) return false;
    if (chat.event?.organizerId === userId) return true;

    const membership = await this.prisma.eventMembership.findUnique({
      where: { userId_eventId: { userId, eventId: chat.eventId } },
    });
    return !!membership;
  }

  async addChat(userId: string, folderId: string, chatId: string) {
    await this.ensureOwnership(folderId, userId);

    if (!(await this.canUseChat(userId, chatId))) {
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
