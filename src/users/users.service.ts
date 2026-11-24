import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import type { AuthUser } from '../common/decorators/auth.decorators';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { buildAvatarSeed, isDefaultInitialsAvatar, resolveImage } from '../helper/image';

@Injectable()
export class UsersService {
  constructor(private readonly firebase: FirebaseService) {}
  private ref(uid: string) { return this.firebase.db.ref(`users/${uid}`); }

  async getOrCreate(u: AuthUser) {
    const snap = await this.ref(u.uid).get();
    if (snap.exists()) return snap.val();
    const displayName = u.name ?? null;
    const profile = {
      uid: u.uid, email: u.email ?? null, displayName,
      photoURL: resolveImage(u.picture, buildAvatarSeed(displayName, u.email)),
      createdAt: Date.now(),
    };
    await this.ref(u.uid).set(profile);
    return profile;
  }

  async update(uid: string, dto: UpdateProfileDto) {
    const patch: Record<string, unknown> = { ...dto, updatedAt: Date.now() };
    const needsAvatar = 'photoURL' in dto || dto.displayName !== undefined;
    if (needsAvatar) {
      const current = (await this.ref(uid).get()).val() ?? {};
      const name = dto.displayName ?? current.fullName ?? current.displayName;
      const seed = buildAvatarSeed(name, current.email);
      if ('photoURL' in dto) {
        // Sent but empty -> fall back to DiceBear initials.
        patch.photoURL = resolveImage(dto.photoURL, seed);
      } else if (isDefaultInitialsAvatar(current.photoURL)) {
        // Renamed while still on the default avatar -> regenerate initials.
        patch.photoURL = resolveImage(null, seed);
      }
    }
    await this.ref(uid).update(patch);
    return (await this.ref(uid).get()).val();
  }
}
