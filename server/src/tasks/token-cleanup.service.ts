import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleExpiredTokenCleanup() {
    const now = new Date();
    this.logger.log('Starting expired token cleanup...');

    const [emailTokens, passwordTokens, refreshTokens] = await Promise.all([
      this.prisma.emailVerificationToken.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
    ]);

    this.logger.log(
      `Expired token cleanup complete: ` +
      `${emailTokens.count} email verification, ` +
      `${passwordTokens.count} password reset, ` +
      `${refreshTokens.count} refresh tokens removed`,
    );
  }
}
