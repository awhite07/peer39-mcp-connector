import { GetUrlExamplesInputSchema } from '../../peer39/validation.js';
import { getUrlExamples } from '../../peer39/categories.js';
import { readCredentialContext } from '../../peer39/credentials.js';
import { MissingPeer39SetupError } from '../../peer39/errors.js';
import { config } from '../../config.js';
import type { ToolDefinition } from './index.js';
import { errorResult, formatToolError, jsonResult } from './index.js';

export const getUrlExamplesTool: ToolDefinition = {
  name: 'peer39_get_url_examples',
  description: `Preview which URLs Peer39 would classify as matching a set of phrases — useful for validating a planned **web keyword category** before creating it.

## When to use
ONLY for **web keyword categories (type 2)** — i.e. categories that match webpage content by keyword. URL examples are not meaningful for other category types:
- type 3 (URL): items are already URLs; nothing to preview.
- type 5 (Mobile App) and type 6 (CTV App): apps don't have URL pages to match.
- type 7 (Mobile App Keywords) and type 8 (CTV Keywords): these match app metadata, not the open web — URL previews don't apply.

If the user asks for a URL preview while planning a non-type-2 category, tell them the preview is only meaningful for web keyword categories and don't call this tool. If they want to validate a CTV or mobile-app keyword set, suggest creating a small test category and listing it back, or talking with their Peer39 integration manager about app-side validation tools.

## Args
- languages (required): array of language codes. The wildcard here is lowercase "all" (not "All" like the category endpoints).
- partners (required): array of numeric partner IDs.
- items (required): array of { phrase, type } where type ∈ REGULAR | MUST_HAVE | EXCLUDE.

## Returns
The raw \`urlExamples\` payload from Peer39 (this endpoint does NOT return a \`code\` field, so the standard error mapping is skipped).`,
  inputSchema: GetUrlExamplesInputSchema,
  async handler(ctx, rawArgs) {
    const parsed = GetUrlExamplesInputSchema.safeParse(rawArgs);
    if (!parsed.success) return errorResult(`Validation failed: ${parsed.error.message}`);
    try {
      const creds = readCredentialContext(ctx.db, ctx.userSub);
      if (!creds) throw new MissingPeer39SetupError(ctx.userSub, `${config.publicUrl}/setup`);
      const res = await getUrlExamples(ctx, {
        languages: parsed.data.languages,
        partners: parsed.data.partners,
        items: parsed.data.items,
      });
      return jsonResult(res);
    } catch (err) {
      return formatToolError(err);
    }
  },
};
