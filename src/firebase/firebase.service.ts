import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { Database, getDatabase } from 'firebase-admin/database';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (getApps().length) {
      this.app = getApp();
      return;
    }
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    const credential =
      projectId && clientEmail && privateKey
        ? cert({ projectId, clientEmail, privateKey })
        : applicationDefault(); // GOOGLE_APPLICATION_CREDENTIALS
    this.app = initializeApp({
      credential,
      databaseURL: this.config.getOrThrow<string>('FIREBASE_DATABASE_URL'),
    });
    this.logger.log('Firebase Admin initialized');
  }

  get auth(): Auth { return getAuth(this.app); }
  get db(): Database { return getDatabase(this.app); }

  /** Verify a Firebase ID token (checkRevoked = true). Works for Google, GitHub, Apple, etc. */
  verifyIdToken(token: string) {
    return this.auth.verifyIdToken(token, true);
  }
}
