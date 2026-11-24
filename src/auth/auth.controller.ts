import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser, Public, Roles } from '../common/decorators/auth.decorators';
import type { AuthUser } from '../common/decorators/auth.decorators';
import { Role } from '../common/role.enum';
import { SetRoleDto } from './dto/set-role.dto';
import { GoogleLoginDto, LoginDto, RefreshTokenDto, RegisterDto, SessionDto } from './dto/auth.dto';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Basic JWT shape check (`header.payload.signature`) to reject obviously malformed ID tokens upfront. */
const JWT_SHAPE_REGEX = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly auth: AuthService) {}

  /** Email/Password sign-up (server-side, or sync after client createUserWithEmailAndPassword). */
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.execute('register', async () => {
      this.assertBodyPresent(dto);

      if (!dto.firstName?.trim() || !dto.lastName?.trim()) {
        throw new BadRequestException({
          code: 'INVALID_NAME',
          message: 'firstName and lastName are required and cannot be blank',
        });
      }

      const hasIdToken = Boolean(dto.idToken?.trim());
      const hasEmailOrPassword = Boolean(dto.email?.trim() || dto.password);

      if (hasIdToken && hasEmailOrPassword) {
        throw new BadRequestException({
          code: 'AMBIGUOUS_REGISTER_PAYLOAD',
          message: 'Provide either idToken (client-side signup) OR email and password (server-side signup), not both',
        });
      }

      if (hasIdToken) {
        dto.idToken = dto.idToken!.trim();
        this.assertValidJwtFormat(dto.idToken, 'idToken');
      } else {
        const email = dto.email?.trim().toLowerCase();
        if (!email || !EMAIL_REGEX.test(email)) {
          throw new BadRequestException({
            code: 'INVALID_EMAIL',
            message: 'A valid email address is required for registration',
          });
        }
        if (!dto.password || dto.password.length < 8) {
          throw new BadRequestException({
            code: 'WEAK_PASSWORD',
            message: 'Password is required and must be at least 8 characters long',
          });
        }
        dto.email = email;
      }

      dto.firstName = dto.firstName.trim();
      dto.lastName = dto.lastName.trim();
      if (dto.orgName) dto.orgName = dto.orgName.trim();

      return await this.auth.register(dto);
    });
  }

  /** Email/Password sign-in. */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.execute('login', async () => {
      this.assertBodyPresent(dto);

      const email = dto.email?.trim().toLowerCase();
      if (!email || !EMAIL_REGEX.test(email)) {
        throw new BadRequestException({
          code: 'INVALID_EMAIL',
          message: 'A valid email address is required',
        });
      }
      if (!dto.password || !dto.password.trim()) {
        throw new BadRequestException({
          code: 'MISSING_PASSWORD',
          message: 'Password is required',
        });
      }
      dto.email = email;

      return await this.auth.login(dto);
    });
  }

  /** Google sign-in / sign-up (creates the account + default org on first login). */
  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async google(@Body() dto: GoogleLoginDto) {
    return this.execute('google', async () => {
      this.assertBodyPresent(dto);

      const provided = [dto.idToken, dto.googleIdToken, dto.googleAccessToken].filter(
        (v) => typeof v === 'string' && v.trim().length > 0,
      );

      if (provided.length === 0) {
        throw new BadRequestException({
          code: 'MISSING_GOOGLE_CREDENTIAL',
          message: 'Provide one of idToken, googleIdToken, or googleAccessToken',
        });
      }
      if (provided.length > 1) {
        throw new BadRequestException({
          code: 'AMBIGUOUS_GOOGLE_CREDENTIAL',
          message: 'Provide physical credential using only one of idToken, googleIdToken, or googleAccessToken',
        });
      }

      if (dto.idToken) this.assertValidJwtFormat(dto.idToken, 'idToken');
      if (dto.googleIdToken) this.assertValidJwtFormat(dto.googleIdToken, 'googleIdToken');

      return await this.auth.google(dto);
    });
  }

  /** Sync any Firebase ID token obtained by the client SDK (any provider). */
  @Public()
  @Post('session')
  @HttpCode(HttpStatus.OK)
  async session(@Body() dto: SessionDto) {
    return this.execute('session', async () => {
      this.assertBodyPresent(dto);

      if (!dto.idToken?.trim()) {
        throw new BadRequestException({
          code: 'MISSING_ID_TOKEN',
          message: 'idToken is required',
        });
      }
      this.assertValidJwtFormat(dto.idToken, 'idToken');

      return await this.auth.session(dto);
    });
  }

  /** Exchange a refresh token for a new ID token. */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.execute('refresh', async () => {
      this.assertBodyPresent(dto);

      const token = dto.refreshToken?.trim();
      if (!token || token.length < 10) {
        throw new BadRequestException({
          code: 'INVALID_REFRESH_TOKEN',
          message: 'A valid refreshToken is required',
        });
      }

      return await this.auth.refresh(token);
    });
  }

  /** Revoke all refresh tokens of the current user. */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: AuthUser) {
    return this.execute('logout', async () => {
      this.assertAuthenticatedUser(user);
      return await this.auth.logout(user.uid);
    });
  }

  /** Identity from the verified Firebase ID token. */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.execute('me', () => {
      this.assertAuthenticatedUser(user);
      return {
        uid: user.uid,
        email: user.email ?? null,
        name: user.name ?? null,
        picture: user.picture ?? null,
        provider: user.firebase?.sign_in_provider ?? null,
        role: user.role ?? Role.User,
      };
    });
  }

  @Post('role')
  @Roles(Role.Admin)
  async setRole(@CurrentUser() user: AuthUser, @Body() dto: SetRoleDto) {
    return this.execute('setRole', async () => {
      this.assertAuthenticatedUser(user);
      this.assertBodyPresent(dto);

      const targetUid = dto.uid?.trim();
      if (!targetUid) {
        throw new BadRequestException({
          code: 'INVALID_UID',
          message: 'Target user uid is required',
        });
      }
      if (!Object.values(Role).includes(dto.role)) {
        throw new BadRequestException({
          code: 'INVALID_ROLE',
          message: `role must be one of: ${Object.values(Role).join(', ')}`,
        });
      }
      if (targetUid === user.uid && dto.role !== Role.Admin) {
        throw new BadRequestException({
          code: 'SELF_ROLE_DEMOTION_FORBIDDEN',
          message: 'Cannot remove your own admin role',
        });
      }

      return await this.auth.setRole(targetUid, dto.role);
    });
  }

  // ---------------------------------------------------------------------------
  // Upfront Validation & Centralized Controller Error Boundary
  // ---------------------------------------------------------------------------

  private assertBodyPresent(dto: unknown): void {
    if (!dto || typeof dto !== 'object') {
      throw new BadRequestException({
        code: 'INVALID_REQUEST_BODY',
        message: 'Request body is required and must be a valid JSON object',
      });
    }
  }

  private assertValidJwtFormat(token: string, fieldName: string): void {
    if (!JWT_SHAPE_REGEX.test(token.trim())) {
      throw new BadRequestException({
        code: 'MALFORMED_TOKEN',
        message: `${fieldName} is not a valid JWT format`,
      });
    }
  }

  private assertAuthenticatedUser(user: AuthUser | undefined | null): asserts user is AuthUser {
    if (!user || !user.uid) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authenticated user context is missing or invalid',
      });
    }
  }

  /**
   * Executes controller logic within a unified error boundary:
   * - Preserves known NestJS `HttpException`s (400, 401, 403, 404, 409, 429, 503) with clear `code` & `message`.
   * - Catches unexpected errors and translates them into a safe 500 response without leaking internals.
   */
  private async execute<T>(action: string, handler: () => Promise<T> | T): Promise<T> {
    try {
      return await handler();
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`[AuthController.${action}] Unexpected error`, (err as Error)?.stack ?? err);
      throw new InternalServerErrorException({
        code: 'AUTH_INTERNAL_ERROR',
        message: 'An unexpected error occurred while processing the authentication request',
      });
    }
  }
}
