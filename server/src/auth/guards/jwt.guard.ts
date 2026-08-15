import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const path = request.url || request.path;
    const authHeader = request.headers.authorization;
    console.log(`[JwtAuthGuard] Request to ${path}, hasAuth: ${!!authHeader}`);
    this.logger.log(`[JwtAuthGuard] Request to ${path}, hasAuth: ${!!authHeader}`);
    try {
      const result = await super.canActivate(context);
      const booleanResult = result instanceof Promise ? await result : (result as boolean);
      console.log(`[JwtAuthGuard] canActivate result: ${booleanResult}`);
      this.logger.log(`[JwtAuthGuard] canActivate result: ${booleanResult}`);
      return booleanResult;
    } catch (error) {
      console.error(`[JwtAuthGuard] Error:`, error);
      this.logger.error(`[JwtAuthGuard] Error:`, error);
      throw error;
    }
  }
}
