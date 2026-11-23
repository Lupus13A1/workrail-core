import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { McpServersService } from './mcp-servers.service';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { AuthUser } from '../../common/decorators/auth.decorators';
import { CreateMcpServerDto } from './dto/create-mcp-server.dto';
import { UpdateMcpServerDto } from './dto/update-mcp-server.dto';

@Controller('mcp/servers')
export class McpServersController {
  constructor(private readonly servers: McpServersService) {}
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateMcpServerDto) { return this.servers.create(u.uid, dto); }
  @Get() list(@CurrentUser() u: AuthUser) { return this.servers.list(u.uid); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.servers.get(u.uid, id); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateMcpServerDto) { return this.servers.update(u.uid, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.servers.remove(u.uid, id); }
}
