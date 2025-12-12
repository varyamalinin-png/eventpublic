import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtAccessSecret'),
    });
  }

  async validate(payload: { sub: string; username: string }) {
    // Загружаем роль пользователя из базы данных
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true },
    });

    return { 
      id: payload.sub, 
      userId: payload.sub, 
      username: payload.username,
      role: user?.role || 'USER',
    };
  }
}
