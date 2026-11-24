import {
  IsEmail,
  IsJWT,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  password: string;
}

export class RegisterDto {
  @IsOptional()
  @IsString()
  @IsJWT()
  idToken?: string;

  @ValidateIf((o: RegisterDto) => !o.idToken)
  @IsNotEmpty()
  @IsEmail()
  email?: string;

  @ValidateIf((o: RegisterDto) => !o.idToken)
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  firstName: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  orgName?: string;
}

export class GoogleLoginDto {
  @IsOptional()
  @IsString()
  @IsJWT()
  idToken?: string;

  @IsOptional()
  @IsString()
  @IsJWT()
  googleIdToken?: string;

  @IsOptional()
  @IsString()
  googleAccessToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  orgName?: string;
}

export class SessionDto {
  @IsNotEmpty()
  @IsString()
  @IsJWT()
  idToken: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;
}

export class RefreshTokenDto {
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}
