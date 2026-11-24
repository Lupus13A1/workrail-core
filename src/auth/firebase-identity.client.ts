import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AuthTokens {
  idToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface IdentitySignInResult extends AuthTokens {
  uid: string;
}

const IDENTITY_URL = 'https://identitytoolkit.googleapis.com/v1';
const SECURE_TOKEN_URL = 'https://securetoken.googleapis.com/v1/token';

/**
 * Thin wrapper around the Firebase Auth REST API (Identity Toolkit).
 * Firebase Admin SDK cannot verify passwords or exchange OAuth credentials,
 * so password / Google sign-in from the backend goes through this client.
 * Requires FIREBASE_WEB_API_KEY (Project settings > General > Web API Key).
 */
@Injectable()
export class FirebaseIdentityClient {
  private readonly logger = new Logger(FirebaseIdentityClient.name);

  constructor(private readonly config: ConfigService) {}

  /** Throws early (before side effects) if the Web API key is missing. */
  assertConfigured(): void {
    void this.apiKey;
  }

  async signInWithPassword(email: string, password: string): Promise<IdentitySignInResult> {
    const res = await this.post(`${IDENTITY_URL}/accounts:signInWithPassword`, {
      email,
      password,
      returnSecureToken: true,
    });
    return this.toResult(res);
  }

  /** Exchange a raw Google OAuth credential (id_token or access_token) for a Firebase session. */
  async signInWithGoogle(credential: { idToken?: string; accessToken?: string }): Promise<IdentitySignInResult> {
    const postBody = new URLSearchParams({ providerId: 'google.com' });
    if (credential.idToken) postBody.set('id_token', credential.idToken);
    if (credential.accessToken) postBody.set('access_token', credential.accessToken);
    const res = await this.post(`${IDENTITY_URL}/accounts:signInWithIdp`, {
      postBody: postBody.toString(),
      requestUri: 'http://localhost',
      returnSecureToken: true,
      returnIdpCredential: true,
    });
    return this.toResult(res);
  }

  async refresh(refreshToken: string): Promise<IdentitySignInResult> {
    const res = await this.request(
      `${SECURE_TOKEN_URL}?key=${encodeURIComponent(this.apiKey)}`,
      new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
      'application/x-www-form-urlencoded',
    );
    return {
      uid: res.user_id,
      idToken: res.id_token,
      refreshToken: res.refresh_token,
      expiresIn: Number(res.expires_in),
    };
  }

  // ---------------------------------------------------------------------------

  private get apiKey(): string {
    const key = this.config.get<string>('FIREBASE_WEB_API_KEY');
    if (!key) throw new ServiceUnavailableException('FIREBASE_WEB_API_KEY is not configured');
    return key;
  }

  private toResult(res: any): IdentitySignInResult {
    return {
      uid: res.localId,
      idToken: res.idToken,
      refreshToken: res.refreshToken,
      expiresIn: Number(res.expiresIn),
    };
  }

  private post(url: string, body: Record<string, unknown>) {
    return this.request(`${url}?key=${encodeURIComponent(this.apiKey)}`, JSON.stringify(body), 'application/json');
  }

  private async request(url: string, body: string, contentType: string): Promise<any> {
    let response: Response;
    try {
      response = await fetch(url, { method: 'POST', headers: { 'Content-Type': contentType }, body });
    } catch (err) {
      this.logger.error(`Firebase Auth REST request failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Authentication service unavailable');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw this.mapError(data?.error?.message ?? 'UNKNOWN');
    return data;
  }

  /** Firebase REST errors look like "WEAK_PASSWORD : Password should be at least 6 characters". */
  private mapError(raw: string): HttpException {
    const code = raw.split(' : ')[0].trim();
    switch (code) {
      case 'EMAIL_NOT_FOUND':
      case 'INVALID_PASSWORD':
      case 'INVALID_LOGIN_CREDENTIALS':
        return new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
      case 'USER_DISABLED':
        return new ForbiddenException({ code: 'USER_DISABLED', message: 'This account has been disabled' });
      case 'TOO_MANY_ATTEMPTS_TRY_LATER':
        return new HttpException(
          { code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts, please try again later' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      case 'EMAIL_EXISTS':
        return new ConflictException({ code: 'EMAIL_EXISTS', message: 'Email is already registered' });
      case 'WEAK_PASSWORD':
        return new BadRequestException({ code: 'WEAK_PASSWORD', message: 'Password is too weak' });
      case 'OPERATION_NOT_ALLOWED':
        return new ForbiddenException({ code: 'PROVIDER_DISABLED', message: 'This sign-in method is disabled' });
      case 'INVALID_IDP_RESPONSE':
      case 'INVALID_ID_TOKEN':
        return new UnauthorizedException({ code: 'INVALID_GOOGLE_CREDENTIAL', message: 'Invalid Google credential' });
      case 'TOKEN_EXPIRED':
      case 'INVALID_REFRESH_TOKEN':
      case 'USER_NOT_FOUND':
        return new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Session expired, please sign in again' });
      default:
        this.logger.error(`Unexpected Firebase Auth error: ${raw}`);
        return new BadRequestException({ code: 'AUTH_ERROR', message: 'Authentication failed' });
    }
  }
}
