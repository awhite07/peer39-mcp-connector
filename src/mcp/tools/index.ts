import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { DB } from '../../db.js';
import { MissingPeer39SetupError, Peer39ApiError } from '../../peer39/errors.js';

export interface ToolCtx {
  userSub: string;
  db: DB;
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodTypeAny;
  handler: (ctx: ToolCtx, args: unknown) => Promise<ToolResult>;
}

export function toJsonSchema(schema: ZodTypeAny): ReturnType<typeof zodToJsonSchema> {
  return zodToJsonSchema(schema, { target: 'jsonSchema7' });
}

export function errorResult(text: string): ToolResult {
  return { isError: true, content: [{ type: 'text', text }] };
}

export function jsonResult(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

export function formatToolError(err: unknown): ToolResult {
  if (err instanceof MissingPeer39SetupError) return errorResult(err.message);
  if (err instanceof Peer39ApiError) return errorResult(`Peer39 error ${err.code}: ${err.message}`);
  if (err instanceof Error) return errorResult(`Unexpected error: ${err.message}`);
  return errorResult(`Unexpected error: ${String(err)}`);
}

import { createCategoryTool } from './create-category.js';
import { listCategoriesTool } from './list-categories.js';
import { getCategoryTool } from './get-category.js';
import { updateCategoryDetailsTool } from './update-category-details.js';
import { updateCategoryItemsTool } from './update-category-items.js';
import { updateCategoryTool } from './update-category.js';
import { deleteCategoryTool } from './delete-category.js';
import { getUrlExamplesTool } from './get-url-examples.js';
import { checkSetupTool } from './check-setup.js';

export const tools: ToolDefinition[] = [
  checkSetupTool,
  getCategoryTool,
  listCategoriesTool,
  createCategoryTool,
  updateCategoryDetailsTool,
  updateCategoryItemsTool,
  updateCategoryTool,
  deleteCategoryTool,
  getUrlExamplesTool,
];
