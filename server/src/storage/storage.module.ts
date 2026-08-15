import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { ImageOptimizerService } from './image-optimizer.service';

@Module({
  imports: [ConfigModule],
  controllers: [StorageController],
  providers: [StorageService, ImageOptimizerService],
  exports: [StorageService],
})
export class StorageModule {}

