import { UpdateCategoryInputSchema } from '../../peer39/validation.js';
import { updateCategory } from '../../peer39/categories.js';
import { resolvePartnerId } from '../../peer39/partners.js';
import { readCredentialContext } from '../../peer39/credentials.js';
import { MissingPeer39SetupError } from '../../peer39/errors.js';
import { config } from '../../config.js';
import type { ToolDefinition } from './index.js';
import { errorResult, formatToolError, jsonResult } from './index.js';

export const updateCategoryTool: ToolDefinition = {
  name: 'peer39_update_category',
  description: `"Update all" — replace the entire definition of a Custom Category in one call (name, type, items, items types, safeFrom, email, expiration, language codes, description, advertiser ID).

## When to use
You want to make several changes at once. For a single-field tweak, prefer peer39_update_category_details or peer39_update_category_items so you don't accidentally clobber other fields.

## Args
- partnerCategoryId (required): numeric ID of the category to update
- partnerId (required): DSP partner ID or friendly name
- buyerId (optional): falls back to saved default
- Any of: categoryName, type, items, itemsTypes, safeFrom, emailAddress, expirationDate, languageCodes, description, advertiserId`,
  inputSchema: UpdateCategoryInputSchema,
  async handler(ctx, rawArgs) {
    const parsed = UpdateCategoryInputSchema.safeParse(rawArgs);
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
      const res = await updateCategory(ctx, {
        value: {
          partnerCategoryId: args.partnerCategoryId,
          buyerId,
          partner: {
            id: partnerId,
            ...(args.advertiserId ? { dspData: { advertiserId: args.advertiserId } } : {}),
          },
          ...(args.categoryName !== undefined ? { categoryName: args.categoryName } : {}),
          ...(args.type !== undefined ? { type: args.type } : {}),
          ...(args.items !== undefined ? { items: args.items } : {}),
          ...(args.itemsTypes !== undefined ? { itemsTypes: args.itemsTypes } : {}),
          ...(args.safeFrom !== undefined ? { safeFrom: args.safeFrom } : {}),
          ...(args.emailAddress !== undefined ? { emailAddress: args.emailAddress } : {}),
          ...(args.expirationDate !== undefined ? { expirationDate: args.expirationDate } : {}),
          ...(args.languageCodes !== undefined ? { languageCodes: args.languageCodes } : {}),
          ...(args.description !== undefined ? { description: args.description } : {}),
        },
      });
      return jsonResult(res);
    } catch (err) {
      return formatToolError(err);
    }
  },
};
