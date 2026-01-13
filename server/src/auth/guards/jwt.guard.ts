import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const path = request.url || request.path;
    const authHeader = request.headers.authorization;
    console.log(`[JwtAuthGuard] Request to ${path}, hasAuth: ${!!authHeader}`);
    this.logger.log(`[JwtAuthGuard] Request to ${path}, hasAuth: ${!!authHeader}`);
    try {
      const result = await super.canActivate(context);
      console.log(`[JwtAuthGuard] canActivate result: ${result}`);
      this.logger.log(`[JwtAuthGuard] canActivate result: ${result}`);
      return result;
    } catch (error) {
      console.error(`[JwtAuthGuard] Error:`, error);
      this.logger.error(`[JwtAuthGuard] Error:`, error);
      throw error;
    }
  }
}
