import { request, type RequestCtx } from './client.js';
import type {
  CategoryResponse,
  CreateCategoryRequest,
  DeleteCategoryRequest,
  DeleteCategoryResponse,
  ListCategoriesQuery,
  ListCategoriesResponse,
  UpdateAllCategoryRequest,
  UpdateBasicDetailsRequest,
  UpdateItemsRequest,
  UrlExamplesRequest,
  UrlExamplesResponse,
} from './types.js';

export async function getCategory(
  ctx: RequestCtx,
  accountCategoryId: number,
  partnerId: number,
  buyerId: number,
): Promise<CategoryResponse> {
  return request<CategoryResponse>(ctx, {
    method: 'GET',
    path: `/api/external/customcategories/${accountCategoryId}`,
    query: { partner: partnerId, buyer: buyerId },
  });
}

export async function listCategories(
  ctx: RequestCtx,
  query: ListCategoriesQuery,
): Promise<ListCategoriesResponse> {
  return request<ListCategoriesResponse>(ctx, {
    method: 'GET',
    path: '/api/external/customcategories',
    query: {
      buyer: query.buyer,
      partner: query.partner,
      max: query.max,
      start: query.start,
      sort: query.sort,
      filterProperty: query.filterProperty,
      filterValue: query.filterValue,
      filterRange: query.filterRange,
    },
  });
}

export async function createCategory(
  ctx: RequestCtx,
  req: CreateCategoryRequest,
  systemHeader: string,
): Promise<CategoryResponse> {
  return request<CategoryResponse>(ctx, {
    method: 'POST',
    path: '/api/external/customcategories',
    body: req,
    extraHeaders: { system: systemHeader },
  });
}

export async function updateBasicDetails(
  ctx: RequestCtx,
  req: UpdateBasicDetailsRequest,
): Promise<CategoryResponse> {
  return request<CategoryResponse>(ctx, {
    method: 'PUT',
    path: '/api/external/customcategories/updateBasicDetails',
    body: req,
  });
}

export async function updateItems(
  ctx: RequestCtx,
  req: UpdateItemsRequest,
): Promise<CategoryResponse> {
  return request<CategoryResponse>(ctx, {
    method: 'POST',
    path: '/api/external/customcategories/items',
    body: req,
  });
}

export async function updateCategory(
  ctx: RequestCtx,
  req: UpdateAllCategoryRequest,
): Promise<CategoryResponse> {
  return request<CategoryResponse>(ctx, {
    method: 'PUT',
    path: '/api/external/customcategories',
    body: req,
  });
}

export async function deleteCategory(
  ctx: RequestCtx,
  req: DeleteCategoryRequest,
): Promise<DeleteCategoryResponse> {
  return request<DeleteCategoryResponse>(ctx, {
    method: 'PUT',
    path: '/api/external/customcategories/delete',
    body: req,
  });
}

export async function getUrlExamples(
  ctx: RequestCtx,
  req: UrlExamplesRequest,
): Promise<UrlExamplesResponse> {
  return request<UrlExamplesResponse>(ctx, {
    method: 'POST',
    path: '/api/external/prediction/urlexamples',
    body: req,
    expectErrorCode: false,
  });
}
