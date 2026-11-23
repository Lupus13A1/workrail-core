// Extension point: connectors to external tools (GitHub, Slack, DBs, ...).
export interface ToolConnector {
  readonly name: string;
  listTools(): Promise<{ name: string; description?: string; inputSchema?: unknown }[]>;
  callTool(tool: string, args: Record<string, unknown>): Promise<unknown>;
}
export const TOOL_CONNECTORS = Symbol('TOOL_CONNECTORS');
