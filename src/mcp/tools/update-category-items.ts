import { UpdateCategoryItemsInputSchema } from '../../peer39/validation.js';
import { updateItems } from '../../peer39/categories.js';
import { resolvePartnerId } from '../../peer39/partners.js';
import { readCredentialContext } from '../../peer39/credentials.js';
import { MissingPeer39SetupError } from '../../peer39/errors.js';
import { config } from '../../config.js';
import type { ToolDefinition } from './index.js';
import { errorResult, formatToolError, jsonResult } from './index.js';

export const updateCategoryItemsTool: ToolDefinition = {
  name: 'peer39_update_category_items',
  description: `Modify the items list (keywords / URLs / app IDs) of an existing Custom Category.

## CRITICAL: append behavior
By default this **APPENDS** new items to the existing list (\`append: true\`). To **REPLACE** the entire list, pass \`append: false\` — this is destructive.

Note: the Peer39 API itself defaults \`append=false\` (replace). This MCP server inverts the default for safety because accidental replacement is the worst failure mode.

## Args
- partnerCategoryId (required): numeric ID of the category
- items (required): non-empty array of items to add (or replace with, if append=false). Each ≤1024 chars.
- itemsTypes (optional): per-item REGULAR/MUST_HAVE/EXCLUDE. Length must equal items length.
- append (optional, default true): true = append; false = replace.
- partnerId (required), buyerId (optional, falls back to saved default).`,
  inputSchema: UpdateCategoryItemsInputSchema,
  async handler(ctx, rawArgs) {
    const parsed = UpdateCategoryItemsInputSchema.safeParse(rawArgs);
    if (!parsed.success) return errorResult(`Validation failed: ${parsed.error.message}`);
    const args = parsed.data;
    try {
      const creds = readCredentialContext(ctx.db, ctx.userSub);
      if (!creds) throw new MissingPeer39SetupError(ctx.userSub, `${config.publicUrl}/setup`);
      const buyerId = args.buyerId ?? creds.buyerId;
      if (args.partnerId === undefined) {
        return errorResult('partnerId is required — pass a DSP name (e.g. "the-trade-desk") or numeric partner ID.');
      }
      const partnerId = resolvePartnerId(args.partnerId);
      const append = args.append === undefined ? true : args.append;
      const res = await updateItems(ctx, {
        value: {
          partnerCategoryId: args.partnerCategoryId,
          buyerId,
          partnerId,
          items: args.items,
          ...(args.itemsTypes ? { itemsTypes: args.itemsTypes } : {}),
          append,
        },
      });
      if (append === false) {
        return {
          content: [
            { type: 'text', text: `[warning] append=false → existing items list was REPLACED.\n\n${JSON.stringify(res, null, 2)}` },
          ],
        };
      }
      return jsonResult(res);
    } catch (err) {
      return formatToolError(err);
    }
  },
};
