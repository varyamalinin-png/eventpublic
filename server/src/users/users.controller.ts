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
    return this.usersService.findById(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
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
