import { z } from 'zod';

export const LANGUAGE_CODES = [
  'All',
  'sq', 'ar', 'bg', 'zh', 'hr', 'cs', 'da', 'nl', 'en', 'et', 'fi', 'fr',
  'de', 'el', 'he', 'hi', 'hu', 'ga', 'it', 'ja', 'ko', 'lv', 'lt', 'ms',
  'no', 'nb', 'nn', 'fa', 'pl', 'pt', 'ro', 'ru', 'sr', 'sk', 'sl', 'es',
  'sv', 'ta', 'th', 'tr', 'vi',
] as const;

export const LanguageCodeSchema = z.enum(LANGUAGE_CODES);

export const URL_EXAMPLES_LANGUAGES = ['all', ...LANGUAGE_CODES.filter((c) => c !== 'All')] as const;
export const UrlExampleLanguageSchema = z.enum(URL_EXAMPLES_LANGUAGES);

export const CategoryTypeSchema = z.union([
  z.literal(2),
  z.literal(3),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
]).describe('2=Keyword, 3=URL, 5=Mobile App, 6=CTV App, 7=Mobile App Keywords, 8=CTV Keywords');

export const ItemsTypeSchema = z.enum(['REGULAR', 'MUST_HAVE', 'EXCLUDE']);

export const CategoryNameSchema = z.string()
  .min(1, 'categoryName must be at least 1 char')
  .max(120, 'Category name max 120 chars')
  .regex(/^[a-zA-Z0-9\s\-&_]+$/, 'Category name may only contain alphanumeric, whitespace, "-", "&", "_"');

export const ItemSchema = z.string().min(1).max(1024, 'Each item max 1024 chars');
export const ItemsArraySchema = z.array(ItemSchema).min(1, 'items must contain at least one entry');

export const EmailSchema = z.string().email();

export const ExpirationDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expirationDate must be YYYY-MM-DD')
  .refine((d) => {
    const date = new Date(d + 'T00:00:00Z').getTime();
    if (Number.isNaN(date)) return false;
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneYear = 365 * oneDay;
    return date >= now - oneDay && date <= now + oneYear + oneDay;
  }, 'expirationDate must be today through 1 year from now');

export const PartnerIdInputSchema = z.union([
  z.number().int().positive(),
  z.string().min(1),
]);

function defaultExpirationDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
}

export const CreateCategoryInputSchema = z.object({
  type: CategoryTypeSchema,
  partnerId: PartnerIdInputSchema,
  items: ItemsArraySchema,
  itemsTypes: z.array(ItemsTypeSchema).optional(),
  categoryName: CategoryNameSchema,
  safeFrom: z.boolean().default(false),
  emailAddress: EmailSchema.optional(),
  expirationDate: ExpirationDateSchema.optional().default(defaultExpirationDate),
  languageCodes: z.array(LanguageCodeSchema).min(1).default(['All']),
  description: z.string().optional(),
  advertiserId: z.string().optional(),
  buyerName: z.string().optional(),
  buyerId: z.number().int().positive().optional(),
}).refine(
  (v) => !v.itemsTypes || v.itemsTypes.length === v.items.length,
  { message: 'itemsTypes length must equal items length when provided', path: ['itemsTypes'] },
).refine(
  (v) => !v.itemsTypes || v.type === 2,
  { message: 'itemsTypes is only valid for keyword categories (type=2)', path: ['itemsTypes'] },
);

export const GetCategoryInputSchema = z.object({
  accountCategoryId: z.number().int().positive(),
  partnerId: PartnerIdInputSchema.optional(),
  buyerId: z.number().int().positive().optional(),
});

export const ListCategoriesInputSchema = z.object({
  buyer: z.array(z.number().int().positive()).optional(),
  partner: z.array(z.number().int().positive()).optional(),
  max: z.number().int().min(1).max(999).optional(),
  start: z.number().int().min(0).optional(),
  sort: z.string().optional(),
  filterProperty: z.string().optional(),
  filterValue: z.string().optional(),
  filterRange: z.string().optional(),
});

export const UpdateCategoryDetailsInputSchema = z.object({
  partnerCategoryId: z.number().int().positive(),
  expirationDate: ExpirationDateSchema.optional(),
  emailAddress: EmailSchema.optional(),
  categoryName: CategoryNameSchema.optional(),
  type: CategoryTypeSchema.optional(),
  description: z.string().optional(),
  partnerId: PartnerIdInputSchema.optional(),
  buyerId: z.number().int().positive().optional(),
  languageCodes: z.array(LanguageCodeSchema).optional(),
});

export const UpdateCategoryItemsInputSchema = z.object({
  partnerCategoryId: z.number().int().positive(),
  partnerId: PartnerIdInputSchema.optional(),
  buyerId: z.number().int().positive().optional(),
  items: ItemsArraySchema,
  itemsTypes: z.array(ItemsTypeSchema).optional(),
  append: z.boolean().optional(),
}).refine(
  (v) => !v.itemsTypes || v.itemsTypes.length === v.items.length,
  { message: 'itemsTypes length must equal items length when provided', path: ['itemsTypes'] },
);

export const UpdateCategoryInputSchema = z.object({
  partnerCategoryId: z.number().int().positive(),
  buyerId: z.number().int().positive().optional(),
  partnerId: PartnerIdInputSchema.optional(),
  categoryName: CategoryNameSchema.optional(),
  type: CategoryTypeSchema.optional(),
  items: ItemsArraySchema.optional(),
  itemsTypes: z.array(ItemsTypeSchema).optional(),
  safeFrom: z.boolean().optional(),
  emailAddress: EmailSchema.optional(),
  expirationDate: ExpirationDateSchema.optional(),
  languageCodes: z.array(LanguageCodeSchema).optional(),
  description: z.string().optional(),
  advertiserId: z.string().optional(),
}).refine(
  (v) => !v.itemsTypes || !v.items || v.itemsTypes.length === v.items.length,
  { message: 'itemsTypes length must equal items length when both are provided', path: ['itemsTypes'] },
);

export const DeleteCategoryInputSchema = z.object({
  categories: z.array(z.object({
    partnerCategoryId: z.number().int().positive(),
    buyerId: z.number().int().positive().optional(),
  })).min(1, 'categories must contain at least one entry'),
});

export const GetUrlExamplesInputSchema = z.object({
  languages: z.array(UrlExampleLanguageSchema).min(1),
  partners: z.array(z.number().int().positive()).min(1),
  items: z.array(z.object({
    phrase: z.string().min(1),
    type: ItemsTypeSchema,
  })).min(1),
});

export const CheckSetupInputSchema = z.object({}).strict();

export const SetupFormSchema = z.object({
  username: z.string().min(1, 'username required'),
  password: z.string().min(1, 'password required'),
  buyerId: z.coerce.number().int().positive('buyerId must be a positive integer'),
  system: z.string().min(1, 'system required'),
  userEmail: EmailSchema,
});
