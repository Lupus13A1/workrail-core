import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser, Roles } from '../common/decorators/auth.decorators';
import type { AuthUser } from '../common/decorators/auth.decorators';
import { Role } from '../common/role.enum';
import { SetRoleDto } from './dto/set-role.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Identity from the verified Firebase ID token. */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return {
      uid: user.uid, email: user.email, name: user.name, picture: user.picture,
      provider: user.firebase?.sign_in_provider, role: user.role,
    };
  }

  @Post('role')
  @Roles(Role.Admin)
  setRole(@Body() dto: SetRoleDto) {
    return this.auth.setRole(dto.uid, dto.role);
  }
}
