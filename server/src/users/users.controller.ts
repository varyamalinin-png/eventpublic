import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PushTokenDto } from './dto/push-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RequestUser } from '../shared/decorators/request-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@RequestUser('userId') userId: string) {
    // Через getPublicProfile, чтобы свой профиль тоже получал настоящее число
    // друзей: на вкладке профиля счётчик считался по локальному состоянию и
    // оставался нулём, если синхронизация не успела или не прошла.
    return this.usersService.getPublicProfile(userId, userId);
  }

  /**
   * Заблокированные — маршрут объявлен ДО `@Get(':id')`, иначе Nest примет
   * 'me' за идентификатор пользователя.
   */
  @Get('me/blocked')
  listBlocked(@RequestUser('userId') userId: string) {
    return this.usersService.listBlockedUsers(userId);
  }

  @Post(':id/block')
  block(@Param('id') id: string, @RequestUser('userId') userId: string) {
    return this.usersService.blockUser(userId, id);
  }

  @Delete(':id/block')
  unblock(@Param('id') id: string, @RequestUser('userId') userId: string) {
    return this.usersService.unblockUser(userId, id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @RequestUser('userId') viewerId: string) {
    // Профиль чужого человека отдаём вместе со статусом дружбы и настоящим
    // числом друзей — клиенту эти две вещи самому не собрать (см.
    // UsersService.getPublicProfile).
    return this.usersService.getPublicProfile(id, viewerId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @RequestUser('userId') userId: string) {
    if (userId !== id) {
      throw new ForbiddenException();
    }
    return this.usersService.updateProfile(id, updateUserDto);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  uploadAvatar(@UploadedFile() file: Express.Multer.File, @RequestUser('userId') userId: string) {
    return this.usersService.updateAvatarFromUpload(userId, file);
  }

  /**
   * Удаление собственного аккаунта. Требование App Store 5.1.1(v): удалить
   * аккаунт должно быть можно ИЗ приложения, а не письмом в поддержку.
   * Маршрут объявлен ДО `@Delete(':id')`-подобных, чтобы 'me' не съел
   * параметрический путь.
   */
  /**
   * Регистрация токена устройства для пушей. Клиент шлёт его при каждом
   * входе: токен APNs может смениться, а аккаунт на устройстве — тем более.
   */
  @Post('me/push-token')
  registerPushToken(
    @RequestUser('userId') userId: string,
    @Body() dto: PushTokenDto,
  ) {
    return this.usersService.savePushToken(userId, dto);
  }

  @Delete('me')
  deleteMe(@RequestUser('userId') userId: string) {
    return this.usersService.deleteAccount(userId);
  }

  @Delete('me/avatar')
  removeAvatar(@RequestUser('userId') userId: string) {
    return this.usersService.removeAvatar(userId);
  }

  @Get('search')
  searchUsers(@Query('username') username?: string) {
    if (!username) {
      return [];
    }
    return this.usersService.searchByUsername(username);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/change-email')
  changeEmail(@RequestUser('userId') userId: string, @Body() dto: ChangeEmailDto) {
    return this.usersService.changeEmail(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/change-password')
  changePassword(@RequestUser('userId') userId: string, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(userId, dto);
  }
}
