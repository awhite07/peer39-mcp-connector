import { config } from '../../config.js';
import { CheckSetupInputSchema } from '../../peer39/validation.js';
import { partnerIdToName } from '../../peer39/partners.js';
import { readCredentialContext } from '../../peer39/credentials.js';
import type { ToolDefinition } from './index.js';

export const checkSetupTool: ToolDefinition = {
  name: 'peer39_check_setup',
  description: `Report whether the user has completed Peer39 setup on this Connector — buyer ID, system name, work email — and what to do next.

## When to use
- The user asks "is my Peer39 stuff configured?"
- A previous tool failed with a "please complete setup" message and the user wants to see status.

## Returns
A short markdown report. Never returns the saved username or password.`,
  inputSchema: CheckSetupInputSchema,
  async handler(ctx) {
    const creds = readCredentialContext(ctx.db, ctx.userSub);
    const lines: string[] = ['# Peer39 MCP Connector — setup status', ''];
    if (!creds) {
      lines.push(`- ✗ **Peer39 credentials**: NOT SET`);
      lines.push(`- ✗ **Buyer ID**: not set`);
      lines.push(`- ✗ **System name**: not set`);
      lines.push(`- ✗ **Work email**: not set`);
      lines.push('');
      lines.push(`Complete setup at ${config.publicUrl}/setup before using any other tool.`);
    } else {
      lines.push(`- ✓ **Peer39 credentials**: encrypted at rest`);
      lines.push(`- ✓ **Buyer ID**: ${creds.buyerId}`);
      lines.push(`- ✓ **System name**: \`${creds.system}\``);
      lines.push(`- ✓ **Work email**: ${creds.userEmail}`);
      lines.push('');
      lines.push(`To update any of these, visit ${config.publicUrl}/setup.`);
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  },
};

// Unused, but exported so partnerIdToName has a consumer if needed in future.
void partnerIdToName;
