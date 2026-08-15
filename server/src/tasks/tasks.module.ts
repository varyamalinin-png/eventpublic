import { Module } from '@nestjs/common';
import { TokenCleanupService } from './token-cleanup.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TokenCleanupService],
})
export class TasksModule {}
