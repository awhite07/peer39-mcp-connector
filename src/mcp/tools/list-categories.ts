import { ListCategoriesInputSchema } from '../../peer39/validation.js';
import { listCategories } from '../../peer39/categories.js';
import { readCredentialContext } from '../../peer39/credentials.js';
import { MissingPeer39SetupError } from '../../peer39/errors.js';
import { config } from '../../config.js';
import type { ToolDefinition } from './index.js';
import { errorResult, formatToolError, jsonResult } from './index.js';

export const listCategoriesTool: ToolDefinition = {
  name: 'peer39_list_categories',
  description: `List Peer39 Custom Categories for the configured buyer (or one you pass explicitly).

## When to use
The user wants to see which custom categories exist on their account, optionally filtered.

## Defaults & gotchas
- If no \`buyer\` is passed, falls back to the saved buyer ID from the user's setup.
- Peer39 API quirk: server-side defaults are \`start=50\` and \`max=0\`, which return zero results. **Always pass \`start: 0\` and \`max\` (e.g. \`max: 50\`) explicitly** unless you have a reason not to.

## Args
- buyer (optional): array of buyer IDs; defaults to [savedBuyerId]
- partner (optional): array of partner IDs
- max (optional, 1–999): page size
- start (optional, >= 0): offset
- sort, filterProperty, filterValue, filterRange: passed through unchanged`,
  inputSchema: ListCategoriesInputSchema,
  async handler(ctx, rawArgs) {
    const parsed = ListCategoriesInputSchema.safeParse(rawArgs);
    if (!parsed.success) return errorResult(`Validation failed: ${parsed.error.message}`);
    try {
      const creds = readCredentialContext(ctx.db, ctx.userSub);
      if (!creds) throw new MissingPeer39SetupError(ctx.userSub, `${config.publicUrl}/setup`);
      let buyer = parsed.data.buyer;
      if (!buyer || buyer.length === 0) buyer = [creds.buyerId];

      const res = await listCategories(ctx, {
        buyer,
        partner: parsed.data.partner,
        max: parsed.data.max,
        start: parsed.data.start,
        sort: parsed.data.sort,
        filterProperty: parsed.data.filterProperty,
        filterValue: parsed.data.filterValue,
        filterRange: parsed.data.filterRange,
      });
      return jsonResult(res);
    } catch (err) {
      return formatToolError(err);
    }
  },
};
