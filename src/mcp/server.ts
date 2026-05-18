import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { DB } from '../db.js';
import { tools, toJsonSchema, type ToolCtx } from './tools/index.js';

export function buildServerForUser(ctx: ToolCtx): Server {
  const server = new Server(
    { name: 'peer39-mcp-connector', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: toJsonSchema(t.inputSchema) as Record<string, unknown>,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = tools.find((t) => t.name === req.params.name);
    if (!tool) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }],
      } as never;
    }
    const result = await tool.handler(ctx, req.params.arguments);
    return result as never;
  });

  return server;
}

export { tools };
export type { ToolCtx, DB };
