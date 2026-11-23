import { Body, Controller, Get, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/auth.decorators';
import type { AuthUser } from '../common/decorators/auth.decorators';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get() get(@CurrentUser() u: AuthUser) { return this.users.getOrCreate(u); }
  @Patch() update(@CurrentUser() u: AuthUser, @Body() dto: UpdateProfileDto) { return this.users.update(u.uid, dto); }
}
