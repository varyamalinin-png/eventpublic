import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserFoldersService } from './user-folders.service';
import { UserFoldersController } from './user-folders.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  providers: [UsersService, UserFoldersService],
  controllers: [UsersController, UserFoldersController],
  exports: [UsersService, UserFoldersService],
})
export class UsersModule {}
