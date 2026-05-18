import { DeleteCategoryInputSchema } from '../../peer39/validation.js';
import { deleteCategory } from '../../peer39/categories.js';
import { readCredentialContext } from '../../peer39/credentials.js';
import { MissingPeer39SetupError } from '../../peer39/errors.js';
import { config } from '../../config.js';
import type { ToolDefinition } from './index.js';
import { errorResult, formatToolError, jsonResult } from './index.js';

export const deleteCategoryTool: ToolDefinition = {
  name: 'peer39_delete_category',
  description: `Delete one or more Peer39 Custom Categories by ID. Batch operation — pass an array.

## CRITICAL
This is destructive and irreversible from the API. Confirm with the user before calling.

## Args
- categories (required): array of { partnerCategoryId, buyerId? }. buyerId falls back to the saved buyer ID per entry.

## Note
The underlying Peer39 endpoint uses HTTP PUT (not DELETE) and a batch body. This tool wraps that detail.`,
  inputSchema: DeleteCategoryInputSchema,
  async handler(ctx, rawArgs) {
    const parsed = DeleteCategoryInputSchema.safeParse(rawArgs);
    if (!parsed.success) return errorResult(`Validation failed: ${parsed.error.message}`);
    try {
      const creds = readCredentialContext(ctx.db, ctx.userSub);
      if (!creds) throw new MissingPeer39SetupError(ctx.userSub, `${config.publicUrl}/setup`);
      const entries = parsed.data.categories.map((c) => ({
        partnerCategoryId: c.partnerCategoryId,
        buyerId: c.buyerId ?? creds.buyerId,
      }));
      const res = await deleteCategory(ctx, { value: entries });
      return jsonResult(res);
    } catch (err) {
      return formatToolError(err);
    }
  },
};
