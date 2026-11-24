import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export enum McpTransport {
  Stdio = 'stdio',
  Sse = 'sse',
  StreamableHttp = 'streamable-http',
}

export class CreateMcpServerDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsNotEmpty()
  @IsEnum(McpTransport)
  transport: McpTransport;

  // stdio transport
  @ValidateIf((o) => o.transport === McpTransport.Stdio)
  @IsNotEmpty()
  @IsString()
  command?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  args?: string[];

  @IsOptional()
  @IsObject()
  env?: Record<string, string>;

  // http transports
  @ValidateIf((o) => o.transport !== McpTransport.Stdio)
  @IsUrl({ require_tld: false })
  url?: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}
