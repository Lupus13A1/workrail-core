import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseService } from '../../firebase/firebase.service';
import { IS_PUBLIC_KEY } from '../../common/decorators/auth.decorators';
import { Role } from '../../common/role.enum';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebase: FirebaseService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException({
        code: 'MISSING_AUTH_HEADER',
        message: 'Missing Authorization header (expected: Bearer <token>)',
      });
    }
    const [scheme, token] = authHeader.trim().split(/\s+/);
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException({
        code: 'INVALID_AUTH_HEADER',
        message: 'Invalid Authorization header format (expected: Bearer <token>)',
      });
    }
    try {
      const decoded = await this.firebase.verifyIdToken(token);
      req.user = { ...decoded, role: (decoded.role as Role) ?? Role.User };
      return true;
    } catch (err: any) {
      const code = err?.code as string | undefined;
      if (code === 'auth/id-token-expired') {
        throw new UnauthorizedException({
          code: 'TOKEN_EXPIRED',
          message: 'Firebase ID token has expired',
        });
      }
      if (code === 'auth/id-token-revoked') {
        throw new UnauthorizedException({
          code: 'TOKEN_REVOKED',
          message: 'Firebase ID token has been revoked, please sign in again',
        });
      }
      if (code === 'auth/user-disabled') {
        throw new ForbiddenException({
          code: 'USER_DISABLED',
          message: 'This user account has been disabled',
        });
      }
      throw new UnauthorizedException({
        code: 'INVALID_ID_TOKEN',
        message: 'Invalid or expired Firebase ID token',
      });
    }
  }
}
