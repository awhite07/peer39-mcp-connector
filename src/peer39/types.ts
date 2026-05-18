export type CategoryType = 2 | 3 | 5 | 6 | 7 | 8;
// 2=Keyword, 3=URL, 5=Mobile App, 6=CTV App, 7=Mobile App Keywords, 8=CTV Keywords

export type ItemsType = 'REGULAR' | 'MUST_HAVE' | 'EXCLUDE';

export interface PartnerObject {
  id: number;
  name?: string;
  dspData?: { advertiserId?: string };
}

export interface CreateCategoryRequest {
  value: {
    buyerId: number;
    buyerName?: string;
    partner: PartnerObject;
    categoryName: string;
    safeFrom: boolean;
    emailAddress: string;
    expirationDate: string;
    items: string[];
    itemsTypes?: ItemsType[];
    type: CategoryType;
    description?: string;
    languageCodes: string[];
  };
}

export interface UpdateBasicDetailsRequest {
  value: {
    partnerCategoryId: number;
    buyerId: number;
    partnerId: number;
    categoryName?: string;
    type?: CategoryType;
    description?: string;
    emailAddress?: string;
    expirationDate?: string;
    languageCodes?: string[];
  };
}

export interface UpdateItemsRequest {
  value: {
    partnerCategoryId: number;
    buyerId: number;
    partnerId: number;
    items: string[];
    itemsTypes?: ItemsType[];
    append: boolean;
  };
}

export interface UpdateAllCategoryRequest {
  value: {
    partnerCategoryId: number;
    buyerId: number;
    partner: PartnerObject;
    categoryName?: string;
    type?: CategoryType;
    items?: string[];
    itemsTypes?: ItemsType[];
    safeFrom?: boolean;
    emailAddress?: string;
    expirationDate?: string;
    languageCodes?: string[];
    description?: string;
  };
}

export interface DeleteCategoryEntry {
  partnerCategoryId: number;
  buyerId: number;
}

export interface DeleteCategoryRequest {
  value: DeleteCategoryEntry[];
}

export interface CategoryValue {
  partnerCategoryId?: number;
  accountCategoryId?: number;
  buyerId?: number;
  buyerName?: string;
  partner?: PartnerObject;
  categoryName?: string;
  safeFrom?: boolean;
  emailAddress?: string;
  expirationDate?: string;
  items?: string[];
  itemsTypes?: ItemsType[];
  type?: CategoryType;
  description?: string;
  languageCodes?: string[];
  status?: string;
  [key: string]: unknown;
}

export interface CategoryResponse {
  value: CategoryValue | null;
  code: number;
  description: string | null;
  message: string;
}

export interface ListCategoriesQuery {
  buyer?: number[];
  partner?: number[];
  max?: number;
  start?: number;
  sort?: string;
  filterProperty?: string;
  filterValue?: string;
  filterRange?: string;
}

export interface ListCategoriesResponseValue {
  message?: string;
  code?: number;
  result?: CategoryValue[];
  total?: number;
}

export interface ListCategoriesResponse {
  value: ListCategoriesResponseValue | null;
  code: number;
  description: string | null;
  message: string;
}

export interface DeleteCategoryResponse {
  code: number;
  message: string;
  description?: string | null;
}

export interface UrlExamplesItem {
  phrase: string;
  type: ItemsType;
}

export interface UrlExamplesRequest {
  languages: string[];
  partners: number[];
  items: UrlExamplesItem[];
}

export interface UrlExamplesResponse {
  urlExamples?: string[];
  [key: string]: unknown;
}

export interface LoginResponse {
  result: { sessionId: string };
  expirationInSeconds: number;
}

export interface CachedToken {
  sessionId: string;
  expiresAt: number;
}
