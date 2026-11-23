import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import type { AuthUser } from '../common/decorators/auth.decorators';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly firebase: FirebaseService) {}
  private ref(uid: string) { return this.firebase.db.ref(`users/${uid}`); }

  async getOrCreate(u: AuthUser) {
    const snap = await this.ref(u.uid).get();
    if (snap.exists()) return snap.val();
    const profile = {
      uid: u.uid, email: u.email ?? null, displayName: u.name ?? null,
      photoURL: u.picture ?? null, createdAt: Date.now(),
    };
    await this.ref(u.uid).set(profile);
    return profile;
  }

  async update(uid: string, dto: UpdateProfileDto) {
    await this.ref(uid).update({ ...dto, updatedAt: Date.now() });
    return (await this.ref(uid).get()).val();
  }
}
