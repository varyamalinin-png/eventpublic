import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like JwtAuthGuard, but never rejects the request. Populates request.user
 * when a valid token is present, leaves it undefined otherwise — for
 * endpoints (e.g. the public event feed) that personalize results for
 * logged-in viewers but must also work for anonymous ones.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    return user || undefined;
  }
}
