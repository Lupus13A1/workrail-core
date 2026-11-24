import * as bcrypt from 'bcrypt';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import * as crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { getInitialsAvatarUrl } from './image';
import {
  ObjectLiteral,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  DeepPartial,
} from 'typeorm';
// import { Users } from 'src/users-features/users/entities';
// import { UserCRUDService } from 'src/users-features/users/services';

dayjs.extend(utc);
dayjs.extend(timezone);

// --- Utility Method for Reuse ---
export async function saveOrUpdateEntity<T extends ObjectLiteral>(
  tx: EntityManager,
  entity: EntityTarget<T>,
  where: FindOptionsWhere<T>,
  data: DeepPartial<T>,
): Promise<T> {
  try {
    let existing = await tx.findOne<T>(entity, { where });
    if (existing) {
      Object.assign(existing, data);
    } else {
      existing = tx.create(entity, data);
    }
    if (!existing) {
      throw new BadRequestException(
        `Failed to create or find entity for ${entity instanceof Function ? entity.name : 'Entity'
        }`,
      );
    }
    return await tx.save(existing);
  } catch (err) {
    console.error(
      `[saveOrUpdate] Failed for ${entity instanceof Function ? entity.name : 'Entity'
      }:`,
      err,
    );
    throw new BadRequestException(
      `Failed to save ${entity instanceof Function ? entity.name : 'Entity'}`,
    );
  }
}

export async function hashPassword(password: string) {
  return await bcrypt.hash(password, 14);
}

export function generateMD5Hash(value: string): string {
  return crypto.createHash('md5').update(value).digest('hex');
}

export async function checkPassword(password: string, hash: string) {
  return await bcrypt.compare(password, hash);
}

export async function dateTimeNow() {
  const now = dayjs().tz('Asia/Bangkok');
  const today = now.toDate();

  return today;
}

export function generateCode(): string {
  let result = '';
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}

export function generateRandomUsername() {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let username = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    username += chars[randomIndex];
  }
  return username;
}

export function formatBranchCode(branchCode: number): string {
  return branchCode.toString().padStart(6, '0');
}

// export async function setAuthorDetails(
//   req: any,
//   dto: any,
//   userService: UserCRUDService,
//   action?: string,
// ): Promise<void> {
//   const usx = req.user as Users;

//   // Find the author by email (assuming the email comes from the authenticated user)
//   const author = await userService.findUserByUsernameOrEmail(usx.email);

//   if (!author) {
//     throw new BadRequestException('Author not found');
//   }

//   // Generate author name from profile
//   const authorName = `${author.profile.firstName} ${author.profile.lastName}`;


//   switch (action) {
//     case 'created':
//       dto.createdBy = authorName;
//       dto.createdById = author.id;
//       break;

//     case 'deleted':
//       dto.deletedBy = authorName;
//       dto.deletedById = author.id;
//       break;
//   }

//   dto.updatedBy = authorName;
//   dto.updatedById = author.id;
// }

// export async function setAuthorDetailsAdmin(
//   req: any,
//   dto: any,
//   userService: AdminUserService,
//   action?: string,
// ): Promise<void> {
//   const usx = req.user as Users;

//   // Find the author by email (assuming the email comes from the authenticated user)
//   const author = await userService.findUserByUsernameOrEmail(usx.email);

//   if (!author) {
//     throw new BadRequestException('Author not found');
//   }

//   // Generate author name from profile
//   const authorName = `${author.profile.firstName} ${author.profile.lastName}`;

//   // Set the relevant fields in the dto
//   dto.organizationId = author.organizationId;
//   dto.branchId = author.branchId;

//   switch (action) {
//     case 'created':
//       dto.createdBy = authorName;
//       dto.createdById = author.id;
//       break;

//     case 'deleted':
//       dto.deletedBy = authorName;
//       dto.deletedById = author.id;
//       break;
//   }

//   dto.updatedBy = authorName;
//   dto.updatedById = author.id;
// }

export function generateUniqueReqUid(appId: string, emId: string): string {
  return `${dayjs().format('YYMMDDHHmm')}${appId}${emId}`;
}

// export async function fetchGeoLocation(ip: string) {
//   try {
//     const response = await axios.get(`http://ip-api.com/json/${ip}`);
//     return response.data;
//   } catch (error) {
//     console.error('Error fetching geo-location data:', error.message);
//     return null;
//   }
// }

/** @deprecated use `getInitialsAvatarUrl` / `resolveImage` from `helper/image` */
export async function setDefaultImage(seed: string): Promise<string> {
  return getInitialsAvatarUrl(seed);
}

export async function generateSku(): Promise<string> {
  const prefix = 'MWHML-';

  const randomChars = Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase();

  return prefix + randomChars;
}