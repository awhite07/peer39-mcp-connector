import { CreateCategoryInputSchema } from '../../peer39/validation.js';
import { createCategory } from '../../peer39/categories.js';
import { resolvePartnerId } from '../../peer39/partners.js';
import { readCredentialContext } from '../../peer39/credentials.js';
import { MissingPeer39SetupError } from '../../peer39/errors.js';
import { config } from '../../config.js';
import type { ToolDefinition } from './index.js';
import { errorResult, formatToolError, jsonResult } from './index.js';

export const createCategoryTool: ToolDefinition = {
  name: 'peer39_create_category',
  description: `Create a new Peer39 custom category and sync it to a connected DSP.

## When to use
The user wants to define a new contextual targeting or brand-safety list — keywords, URLs, mobile app bundle IDs, or CTV app identifiers — and have it activated in their DSP seat (Microsoft Advertising / Xandr, MediaMath, Verizon Media, Basis, etc.).

## Conversation order — ask the user these things, IN THIS ORDER. Do NOT ask everything at once.

1. **type** — what kind of category?
   - 2 = Keyword, 3 = URL, 5 = Mobile App, 6 = CTV App, 7 = Mobile App Keywords, 8 = CTV Keywords
2. **partnerId** (DSP) — which DSP or platform should this category sync to? Always ask the user. Do not fall back to a saved default.
   - Use this exact phrasing template, substituting the actual category type:
       _"Which DSP or platform do you want to build this <category-type> category for?"_
   - Accept either a slug like "the-trade-desk" / "xandr" / "basis" / "mediamath" or a numeric partner ID.
   - <category-type> should be the human-readable type name: "keyword", "URL", "mobile app", "CTV app", "mobile-app keyword", "CTV keyword". Don't say "type 2 keyword" — just "keyword".
3. **items** — the actual keywords / URLs / app IDs. Non-empty array; each ≤1024 chars.
   - Offer BOTH paths in your prompt. Use this phrasing pattern:
       _"Now, what <items> do you want in the category? Share them as a list and I'll set them up — **or** we can discuss the types of content / <items> that would fit best and brainstorm them together."_
     where <items> is "keywords", "URLs", "mobile app IDs", or "CTV app identifiers" depending on type.
   - If the user wants to brainstorm, propose 8–20 candidates based on their goal, present them as a numbered list, and let them edit (add / remove / refine) before locking in.
   - For keyword categories (type=2 only), you may also ask whether they want any items marked MUST_HAVE or EXCLUDE for boolean logic — but only if the user brings up that nuance. Default is REGULAR for all items.
4. **categoryName** — what should this be called? After they've given you the items, suggest a short name based on those items (≤120 chars, alphanumeric + space + "-" "&" "_" only) and confirm. Don't make them type a name from scratch unless they want to.

## Auto-filled — do NOT mention these to the user, do NOT offer them as "anything else you want to set"

- **expirationDate** — defaults to 6 months from today.
- **languageCodes** — defaults to ["All"] (Peer39 wildcard for "any language").
- **safeFrom** — defaults to false. Only meaningful for keyword categories. Don't mention it unless the user asks about safe-from / brand-safety inversion.
- **emailAddress** — handled silently by the server; do NOT mention or ask about email.
- **buyerId** — handled silently by the server; do NOT mention or ask about it.
- **system** — handled silently by the server; do NOT mention or ask about it.
- **description** — leave unset. Do NOT ask the user for a category description. The category name is the only label they need.
- **advertiserId, buyerName** — leave unset.

After step 4 (name confirmed) you have everything. Call this tool. Do NOT do a "before I create, is there anything else you want to set?" pass — that surfaces fields the user shouldn't have to think about.

## Types reference
2 = Keyword, 3 = URL, 5 = Mobile App, 6 = CTV App, 7 = Mobile App Keywords, 8 = CTV Keywords`,
  inputSchema: CreateCategoryInputSchema,
  async handler(ctx, rawArgs) {
    const parsed = CreateCategoryInputSchema.safeParse(rawArgs);
    if (!parsed.success) return errorResult(`Validation failed: ${parsed.error.message}`);
    const args = parsed.data;
    try {
      const creds = readCredentialContext(ctx.db, ctx.userSub);
      if (!creds) throw new MissingPeer39SetupError(ctx.userSub, `${config.publicUrl}/setup`);
      const buyerId = args.buyerId ?? creds.buyerId;
      const emailAddress = args.emailAddress ?? creds.userEmail;
      const partnerId = resolvePartnerId(args.partnerId);

      const res = await createCategory(ctx, {
        value: {
          buyerId,
          buyerName: args.buyerName,
          partner: {
            id: partnerId,
            ...(args.advertiserId ? { dspData: { advertiserId: args.advertiserId } } : {}),
          },
          categoryName: args.categoryName,
          safeFrom: args.safeFrom,
          emailAddress,
          expirationDate: args.expirationDate,
          items: args.items,
          ...(args.itemsTypes ? { itemsTypes: args.itemsTypes } : {}),
          type: args.type,
          ...(args.description !== undefined ? { description: args.description } : {}),
          languageCodes: args.languageCodes,
        },
      }, creds.system);
      return jsonResult(res);
    } catch (err) {
      return formatToolError(err);
    }
  },
};
