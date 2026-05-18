import { GetCategoryInputSchema } from '../../peer39/validation.js';
import { getCategory } from '../../peer39/categories.js';
import { resolvePartnerId } from '../../peer39/partners.js';
import { readCredentialContext } from '../../peer39/credentials.js';
import { MissingPeer39SetupError } from '../../peer39/errors.js';
import { config } from '../../config.js';
import type { ToolDefinition } from './index.js';
import { errorResult, formatToolError, jsonResult } from './index.js';

export const getCategoryTool: ToolDefinition = {
  name: 'peer39_get_category',
  description: `Fetch a single Peer39 Custom Category by its numeric ID.

## When to use
The user wants the details of one category — its items, language codes, partner, expiration, status, etc.

## Args
- accountCategoryId (required): numeric category ID
- partnerId (required): DSP partner ID or friendly name (e.g. "the-trade-desk")
- buyerId (optional): Peer39 buyer account ID; falls back to the user's saved buyer ID`,
  inputSchema: GetCategoryInputSchema,
  async handler(ctx, rawArgs) {
    const parsed = GetCategoryInputSchema.safeParse(rawArgs);
    if (!parsed.success) return errorResult(`Validation failed: ${parsed.error.message}`);
    try {
      const creds = readCredentialContext(ctx.db, ctx.userSub);
      if (!creds) throw new MissingPeer39SetupError(ctx.userSub, `${config.publicUrl}/setup`);
      const buyerId = parsed.data.buyerId ?? creds.buyerId;
      if (parsed.data.partnerId === undefined) {
        return errorResult('partnerId is required — pass a DSP name (e.g. "the-trade-desk") or numeric partner ID.');
      }
      const partnerId = resolvePartnerId(parsed.data.partnerId);
      const res = await getCategory(ctx, parsed.data.accountCategoryId, partnerId, buyerId);
      return jsonResult(res);
    } catch (err) {
      return formatToolError(err);
    }
  },
};
