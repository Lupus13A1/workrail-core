import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { CreateMcpServerDto } from './dto/create-mcp-server.dto';
import { UpdateMcpServerDto } from './dto/update-mcp-server.dto';

/** Stored at: mcpServers/{uid}/{serverId} — owner-scoped. */
@Injectable()
export class McpServersService {
  constructor(private readonly firebase: FirebaseService) {}
  private col(uid: string) { return this.firebase.db.ref(`mcpServers/${uid}`); }

  async create(uid: string, dto: CreateMcpServerDto) {
    const ref = this.col(uid).push();
    const data = { ...clean(dto), id: ref.key, ownerId: uid, createdAt: Date.now(), updatedAt: Date.now() };
    await ref.set(data);
    return data;
  }

  async list(uid: string) {
    const snap = await this.col(uid).get();
    return snap.exists() ? Object.values(snap.val()) : [];
  }

  async get(uid: string, id: string) {
    const snap = await this.col(uid).child(id).get();
    if (!snap.exists()) throw new NotFoundException('MCP server not found');
    return snap.val();
  }

  async update(uid: string, id: string, dto: UpdateMcpServerDto) {
    await this.get(uid, id);
    await this.col(uid).child(id).update({ ...clean(dto), updatedAt: Date.now() });
    return this.get(uid, id);
  }

  async remove(uid: string, id: string) {
    await this.get(uid, id);
    await this.col(uid).child(id).remove();
    return { id, deleted: true };
  }
}

const clean = <T extends object>(o: T) => JSON.parse(JSON.stringify(o));
