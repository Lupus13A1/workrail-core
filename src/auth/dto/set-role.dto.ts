import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { Role } from '../../common/role.enum';

export class SetRoleDto {
  @IsString() @IsNotEmpty() uid: string;
  @IsEnum(Role) role: Role;
}
