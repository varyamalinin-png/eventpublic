import { Injectable, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Express } from 'express';
import { UpdateUserDto } from './dto/update-user.dto';
import { StorageService } from '../storage/storage.service';
import * as argon2 from 'argon2';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        name: true,
        bio: true,
        age: true,
        dateOfBirth: true,
        gender: true,
        showAge: true,
        geoPosition: true,
        avatarUrl: true,
        settings: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({
      where: { googleId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        name: true,
        bio: true,
        age: true,
        dateOfBirth: true,
        gender: true,
        showAge: true,
        geoPosition: true,
        avatarUrl: true,
        settings: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createUser(data: {
    email: string;
    username: string;
    passwordHash?: string | null;
    name?: string;
    avatarUrl?: string;
    emailVerified?: boolean;
    googleId?: string | null;
    accountType?: 'personal' | 'business';
  }) {
    try {
      return await this.prisma.user.create({
        data,
        select: {
          id: true,
          email: true,
          emailVerified: true,
          username: true,
          name: true,
          bio: true,
          age: true,
          dateOfBirth: true,
          gender: true,
          showAge: true,
          geoPosition: true,
          avatarUrl: true,
          settings: true,
          googleId: true,
          accountType: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email or username already taken');
      }
      throw error;
    }
  }

  async updateProfile(id: string, data: UpdateUserDto) {
    try {
      const updateData: any = { ...data };
      // Преобразуем dateOfBirth из строки в Date, если она есть
      if (updateData.dateOfBirth && typeof updateData.dateOfBirth === 'string') {
        updateData.dateOfBirth = new Date(updateData.dateOfBirth);
      }
      return await this.prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          emailVerified: true,
          username: true,
          name: true,
          bio: true,
          age: true,
          dateOfBirth: true,
          gender: true,
          showAge: true,
          geoPosition: true,
          avatarUrl: true,
          settings: true,
          googleId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Field must be unique');
      }
      throw error;
    }
  }

  async markEmailVerified(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        name: true,
        bio: true,
        age: true,
        dateOfBirth: true,
        gender: true,
        showAge: true,
        geoPosition: true,
        avatarUrl: true,
        settings: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async verifyUserByEmailOrId(email: string, id: string) {
    const result = await this.prisma.user.updateMany({
      where: {
        OR: [{ email }, { id }],
        emailVerified: false,
      },
      data: {
        emailVerified: true,
      },
    });

    const users = await this.prisma.user.findMany({
      where: {
        OR: [{ email }, { id }],
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
      },
    });

    return {
      updated: result.count,
      users,
    };
  }

  async updateAvatarFromUpload(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Файл обязателен');
    }
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Поддерживаются только изображения');
    }
    if (file.size > this.storage.getMaxFileSizeBytes()) {
      throw new BadRequestException('Файл слишком большой');
    }

    const avatarUrl = await this.storage.uploadUserAvatar(userId, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalName: file.originalname ?? 'avatar',
    });

    return this.updateProfile(userId, { avatarUrl });
  }

  async removeAvatar(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        name: true,
        bio: true,
        age: true,
        dateOfBirth: true,
        gender: true,
        showAge: true,
        geoPosition: true,
        avatarUrl: true,
        settings: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updatePassword(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        name: true,
        bio: true,
        age: true,
        dateOfBirth: true,
        gender: true,
        showAge: true,
        geoPosition: true,
        avatarUrl: true,
        settings: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async ensureUniqueUsername(base: string) {
    const sanitized = base.toLowerCase().replace(/[^a-z0-9_\.]/g, '');
    let candidate = sanitized || `user${Date.now()}`;
    let counter = 1;
    while (true) {
      const existing = await this.findByUsername(candidate);
      if (!existing) {
        return candidate;
      }
      candidate = `${sanitized}_${counter}`;
      counter += 1;
    }
  }

  async linkGoogleAccount(userId: string, googleId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        googleId,
        emailVerified: true,
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        name: true,
        bio: true,
        age: true,
        dateOfBirth: true,
        gender: true,
        showAge: true,
        geoPosition: true,
        avatarUrl: true,
        settings: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async searchByUsername(query: string) {
    if (!query || query.length < 2) {
      return [];
    }
    const hasBlockedField = await this.hasBlockedField();
    return this.prisma.user.findMany({
      where: {
        username: {
          contains: query,
          mode: 'insensitive',
        },
        // Исключаем заблокированных пользователей из поиска
        ...(hasBlockedField ? { isBlocked: false } : {}),
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatarUrl: true,
        bio: true,
      },
      take: 20,
    });
  }

  // Вспомогательный метод для проверки наличия поля isBlocked
  private async hasBlockedField(): Promise<boolean> {
    try {
      // Попытка выполнить запрос с проверкой поля isBlocked
      await this.prisma.$queryRaw`SELECT "isBlocked" FROM "User" LIMIT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async changeEmail(userId: string, dto: ChangeEmailDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Проверяем текущий пароль
    const isValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Проверяем, не занят ли новый email
    const existing = await this.findByEmail(dto.email);
    if (existing && existing.id !== userId) {
      throw new ConflictException('Email already taken');
    }

    // Обновляем email и сбрасываем верификацию
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.email,
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        name: true,
        bio: true,
        age: true,
        dateOfBirth: true,
        gender: true,
        showAge: true,
        geoPosition: true,
        avatarUrl: true,
        settings: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Проверяем текущий пароль
    const isValid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!isValid) {
      throw new UnauthorizedException('Invalid current password');
    }

    // Хешируем новый пароль
    const newPasswordHash = await argon2.hash(dto.newPassword);
    return this.updatePassword(userId, newPasswordHash);
  }

  async deleteAllUsers() {
    const count = await this.prisma.user.count();
    const result = await this.prisma.user.deleteMany({});
    return {
      count: result.count,
      totalBefore: count,
    };
  }
}
