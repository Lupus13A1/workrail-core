import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseService } from '../firebase/firebase.service';
import { Role } from '../common/role.enum';
import { AuthTokens, FirebaseIdentityClient } from './firebase-identity.client';
import { GoogleLoginDto, LoginDto, RegisterDto, SessionDto } from './dto/auth.dto';
import { buildAvatarSeed, isBlankImage, isDefaultInitialsAvatar, resolveImage } from '../helper/image';
import {
  UserRecord,
  buildDefaultOrg,
  buildUserRecord,
  defaultOrgName,
  newId,
  splitName,
} from '../helper/user-profile';

interface ProfileHints {
  firstName?: string;
  lastName?: string;
  orgName?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly identity: FirebaseIdentityClient,
  ) {}

  // ---------------------------------------------------------------------------
  // Email / Password
  // ---------------------------------------------------------------------------

  async login(dto: LoginDto) {
    const tokens = await this.identity.signInWithPassword(dto.email, dto.password);
    const decoded = await this.verify(tokens.idToken);
    return this.buildSession(decoded, {}, tokens);
  }

  async register(dto: RegisterDto) {
    const hints: ProfileHints = { firstName: dto.firstName, lastName: dto.lastName, orgName: dto.orgName };

    // Client already called createUserWithEmailAndPassword -> just sync profile + default org.
    if (dto.idToken) {
      const decoded = await this.verify(dto.idToken);
      if (decoded.firebase?.sign_in_provider !== 'password') {
        throw new BadRequestException({
          code: 'INVALID_SIGN_IN_PROVIDER',
          message: 'idToken must come from an Email/Password account',
        });
      }
      try {
        await this.firebase.auth.updateUser(decoded.uid, { displayName: `${dto.firstName} ${dto.lastName}` });
      } catch (err) {
        throw this.mapAdminError(err);
      }
      return this.buildSession(decoded, hints);
    }

    // Server-side signup.
    this.identity.assertConfigured(); // fail before creating the account if we cannot issue tokens
    let uid: string;
    try {
      ({ uid } = await this.firebase.auth.createUser({
        email: dto.email!,
        password: dto.password!,
        displayName: `${dto.firstName} ${dto.lastName}`,
        emailVerified: false,
      }));
    } catch (err: any) {
      throw this.mapAdminError(err);
    }

    try {
      const tokens = await this.identity.signInWithPassword(dto.email!, dto.password!);
      const decoded = await this.verify(tokens.idToken);
      return await this.buildSession(decoded, hints, tokens);
    } catch (err) {
      // Roll back so the user can retry with the same email.
      await this.firebase.auth.deleteUser(uid).catch(() => undefined);
      await this.firebase.db.ref(`users/${uid}`).remove().catch(() => undefined);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Google (Third-Party Login) — login and register are the same call
  // ---------------------------------------------------------------------------

  async google(dto: GoogleLoginDto) {
    const provided = [dto.idToken, dto.googleIdToken, dto.googleAccessToken].filter(Boolean).length;
    if (provided !== 1) {
      throw new BadRequestException({
        code: 'INVALID_GOOGLE_CREDENTIAL_COUNT',
        message: 'Provide exactly one of idToken, googleIdToken or googleAccessToken',
      });
    }

    let tokens: AuthTokens | undefined;
    let idToken = dto.idToken;
    if (!idToken) {
      tokens = await this.identity.signInWithGoogle({
        idToken: dto.googleIdToken,
        accessToken: dto.googleAccessToken,
      });
      idToken = tokens.idToken;
    }

    const decoded = await this.verify(idToken);
    if (decoded.firebase?.sign_in_provider !== 'google.com') {
      throw new BadRequestException({
        code: 'INVALID_SIGN_IN_PROVIDER',
        message: 'idToken must come from Google Sign-In',
      });
    }
    return this.buildSession(decoded, { orgName: dto.orgName }, tokens);
  }

  // ---------------------------------------------------------------------------
  // Session / tokens
  // ---------------------------------------------------------------------------

  /** Sync any Firebase ID token (Email/Password or Google) obtained by the client SDK. */
  async session(dto: SessionDto) {
    const decoded = await this.verify(dto.idToken);
    return this.buildSession(decoded, { firstName: dto.firstName, lastName: dto.lastName });
  }

  refresh(refreshToken: string) {
    return this.identity.refresh(refreshToken);
  }

  async logout(uid: string) {
    try {
      await this.firebase.auth.revokeRefreshTokens(uid);
      return { success: true };
    } catch (err) {
      throw this.mapAdminError(err);
    }
  }

  async setRole(uid: string, role: Role) {
    try {
      await this.firebase.auth.setCustomUserClaims(uid, { role });
      await this.firebase.auth.revokeRefreshTokens(uid); // force re-login to pick up new claims
      return { uid, role };
    } catch (err) {
      throw this.mapAdminError(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async verify(idToken: string): Promise<DecodedIdToken> {
    try {
      return await this.firebase.verifyIdToken(idToken);
    } catch (err: any) {
      const code = err?.code as string | undefined;
      if (code === 'auth/id-token-expired') {
        throw new UnauthorizedException({
          code: 'TOKEN_EXPIRED',
          message: 'Firebase ID token has expired, please refresh your token',
        });
      }
      if (code === 'auth/id-token-revoked') {
        throw new UnauthorizedException({
          code: 'TOKEN_REVOKED',
          message: 'Firebase ID token has been revoked, please sign in again',
        });
      }
      if (code === 'auth/user-disabled') {
        throw new UnauthorizedException({
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

  /**
   * Creates `/users/{uid}` + Default Organization on first sign-in (atomic via transaction),
   * otherwise records the provider / last login. Returns `{ user, activeOrg, orgs, isNewUser, tokens? }`.
   */
  private async buildSession(decoded: DecodedIdToken, hints: ProfileHints, tokens?: AuthTokens) {
    const { uid } = decoded;
    const provider = decoded.firebase?.sign_in_provider ?? 'unknown';
    const now = Date.now();
    const userRef = this.firebase.db.ref(`users/${uid}`);

    const { firstName, lastName } = this.resolveName(decoded, hints);
    const orgId = newId('org');
    const draft = buildUserRecord({
      uid,
      email: decoded.email,
      firstName,
      lastName,
      photoURL: decoded.picture,
      authProviders: [provider],
      orgId,
      now,
    });

    const tx = await userRef.transaction((current) => (current === null ? draft : undefined));
    const isNewUser = tx.committed;
    let user: UserRecord;

    if (isNewUser) {
      user = draft;
      const orgName = hints.orgName ?? defaultOrgName(draft.firstName);
      await this.firebase.db.ref(`orgs/${orgId}`).update(buildDefaultOrg(orgId, uid, orgName, now));
    } else {
      user = tx.snapshot.val() as UserRecord;
      const providers = Array.from(new Set([...(user.authProviders ?? []), provider]));
      const patch: Partial<UserRecord> = { authProviders: providers, lastLoginAt: now };
      // Fill a missing avatar; upgrade the DiceBear fallback when the provider (e.g. Google) has a real picture.
      if (isBlankImage(user.photoURL) || (isDefaultInitialsAvatar(user.photoURL) && !isBlankImage(decoded.picture))) {
        patch.photoURL = resolveImage(decoded.picture, buildAvatarSeed(user.fullName, user.email));
      }
      await userRef.update(patch);
      user = { ...user, ...patch };
    }

    const orgs = await this.loadOrgs(user.orgs ?? {});
    const activeOrg = orgs.find((o) => o.id === user.activeOrgId) ?? orgs[0] ?? null;

    return {
      user: { ...user, emailVerified: decoded.email_verified ?? false, role: (decoded.role as Role) ?? Role.User },
      activeOrg,
      orgs,
      isNewUser,
      ...(tokens && { tokens: { idToken: tokens.idToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn } }),
    };
  }

  private async loadOrgs(memberships: UserRecord['orgs']) {
    const entries = Object.entries(memberships);
    const infos = await Promise.all(entries.map(([id]) => this.firebase.db.ref(`orgs/${id}/info`).get()));
    return entries
      .map(([id, m], i) => {
        const info = infos[i].val();
        return info ? { id, name: info.name, slug: info.slug, role: m.role, joinedAt: m.joinedAt } : null;
      })
      .filter((o): o is NonNullable<typeof o> => o !== null);
  }

  private resolveName(decoded: DecodedIdToken, hints: ProfileHints) {
    const fromToken = splitName(decoded.name as string | undefined);
    return {
      firstName: hints.firstName || fromToken.firstName,
      lastName: hints.lastName || fromToken.lastName,
    };
  }

  private mapAdminError(err: any) {
    switch (err?.code) {
      case 'auth/email-already-exists':
        return new ConflictException({ code: 'EMAIL_EXISTS', message: 'Email is already registered' });
      case 'auth/invalid-email':
        return new BadRequestException({ code: 'INVALID_EMAIL', message: 'Email address is invalid' });
      case 'auth/invalid-password':
        return new BadRequestException({ code: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters' });
      case 'auth/user-not-found':
        return new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User account not found' });
      case 'auth/uid-already-exists':
        return new ConflictException({ code: 'UID_EXISTS', message: 'User ID already exists' });
      default:
        this.logger.error(err);
        return new BadRequestException({ code: 'AUTH_ADMIN_ERROR', message: 'Unable to complete authentication action' });
    }
  }
}
