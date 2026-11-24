import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseIdentityClient } from './firebase-identity.client';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    FirebaseIdentityClient,
    { provide: APP_GUARD, useClass: FirebaseAuthGuard }, // secure by default; use @Public() to opt out
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
