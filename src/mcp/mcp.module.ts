import { Module } from '@nestjs/common';
import { McpServersController } from './servers/mcp-servers.controller';
import { McpServersService } from './servers/mcp-servers.service';

@Module({ controllers: [McpServersController], providers: [McpServersService], exports: [McpServersService] })
export class McpModule {}
