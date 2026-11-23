import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { Role } from '../common/role.enum';

@Injectable()
export class AuthService {
  constructor(private readonly firebase: FirebaseService) {}

  async setRole(uid: string, role: Role) {
    await this.firebase.auth.setCustomUserClaims(uid, { role });
    await this.firebase.auth.revokeRefreshTokens(uid); // force re-login to pick up new claims
    return { uid, role };
  }
}
