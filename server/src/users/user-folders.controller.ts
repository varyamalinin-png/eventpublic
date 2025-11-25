import { Body, Controller, Get, Param, Post, Delete, UseGuards } from '@nestjs/common';
import { UserFoldersService } from './user-folders.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RequestUser } from '../shared/decorators/request-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('user-folders')
export class UserFoldersController {
  constructor(private readonly userFoldersService: UserFoldersService) {}

  @Post()
  create(@RequestUser('userId') userId: string, @Body() body: { name: string }) {
    return this.userFoldersService.create(userId, body.name);
  }

  @Get()
  list(@RequestUser('userId') userId: string) {
    return this.userFoldersService.list(userId);
  }

  @Post(':folderId/users/:targetUserId')
  addUser(
    @RequestUser('userId') userId: string,
    @Param('folderId') folderId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.userFoldersService.addUser(userId, folderId, targetUserId);
  }

  @Delete(':folderId/users/:targetUserId')
  removeUser(
    @RequestUser('userId') userId: string,
    @Param('folderId') folderId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.userFoldersService.removeUser(userId, folderId, targetUserId);
  }

  @Delete(':folderId')
  delete(@RequestUser('userId') userId: string, @Param('folderId') folderId: string) {
    return this.userFoldersService.delete(userId, folderId);
  }
}

