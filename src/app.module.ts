import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { FirebaseModule } from './firebase/firebase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { McpModule } from './mcp/mcp.module';
import { Public } from './common/decorators/auth.decorators';

@Controller('health')
class HealthController {
  @Public() @Get() health() { return { status: 'ok' }; }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    FirebaseModule, AuthModule, UsersModule, McpModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
