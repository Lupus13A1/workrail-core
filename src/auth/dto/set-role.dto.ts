import {
  IsEnum,
  IsNotEmpty,
  IsString,
} from 'class-validator';
import { Role } from '../../common/role.enum';

export class SetRoleDto {
  @IsNotEmpty()
  @IsString()
  uid: string;

  @IsNotEmpty()
  @IsEnum(Role)
  role: Role;
}
