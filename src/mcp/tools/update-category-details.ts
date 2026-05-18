import { UpdateCategoryDetailsInputSchema } from '../../peer39/validation.js';
import { updateBasicDetails } from '../../peer39/categories.js';
import { resolvePartnerId } from '../../peer39/partners.js';
import { readCredentialContext } from '../../peer39/credentials.js';
import { MissingPeer39SetupError } from '../../peer39/errors.js';
import { config } from '../../config.js';
import type { ToolDefinition } from './index.js';
import { errorResult, formatToolError, jsonResult } from './index.js';

export const updateCategoryDetailsTool: ToolDefinition = {
  name: 'peer39_update_category_details',
  description: `Update a Custom Category's metadata (name, type, description, language codes, expiration, email). Does NOT touch the items list — use peer39_update_category_items for that, or peer39_update_category for an all-in-one update.

## Args
- partnerCategoryId (required): numeric ID of the category to update
- partnerId (required): DSP partner ID or friendly name
- buyerId (optional): falls back to saved default
- categoryName, type, description, expirationDate, emailAddress, languageCodes: any subset to change`,
  inputSchema: UpdateCategoryDetailsInputSchema,
  async handler(ctx, rawArgs) {
    const parsed = UpdateCategoryDetailsInputSchema.safeParse(rawArgs);
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
      const res = await updateBasicDetails(ctx, {
        value: {
          partnerCategoryId: args.partnerCategoryId,
          buyerId,
          partnerId,
          ...(args.categoryName !== undefined ? { categoryName: args.categoryName } : {}),
          ...(args.type !== undefined ? { type: args.type } : {}),
          ...(args.description !== undefined ? { description: args.description } : {}),
          ...(args.emailAddress !== undefined ? { emailAddress: args.emailAddress } : {}),
          ...(args.expirationDate !== undefined ? { expirationDate: args.expirationDate } : {}),
          ...(args.languageCodes !== undefined ? { languageCodes: args.languageCodes } : {}),
        },
      });
      return jsonResult(res);
    } catch (err) {
      return formatToolError(err);
    }
  },
};
