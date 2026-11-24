import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, validateSync } from 'class-validator';

export class EnvVars {
  @IsOptional() @IsString() PORT?: string;
  @IsOptional() @IsString() CORS_ORIGINS?: string;
  @IsString() @IsNotEmpty() FIREBASE_DATABASE_URL: string;
  @IsOptional() @IsString() FIREBASE_PROJECT_ID?: string;
  @IsOptional() @IsString() FIREBASE_CLIENT_EMAIL?: string;
  @IsOptional() @IsString() FIREBASE_PRIVATE_KEY?: string;
  @IsOptional() @IsString() GOOGLE_APPLICATION_CREDENTIALS?: string;
  /** Firebase Web API Key — required for /auth/login, server-side /auth/register, /auth/google (raw Google token), /auth/refresh */
  @IsOptional() @IsString() FIREBASE_WEB_API_KEY?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const env = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length) throw new Error(`Invalid environment: ${errors.toString()}`);
  return env;
}
