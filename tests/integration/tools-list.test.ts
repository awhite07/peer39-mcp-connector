import { describe, it, expect } from 'vitest';
import { tools } from '../../src/mcp/server.js';

describe('tool registry', () => {
  it('exposes the expected tool names', () => {
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'peer39_check_setup',
      'peer39_create_category',
      'peer39_delete_category',
      'peer39_get_category',
      'peer39_get_url_examples',
      'peer39_list_categories',
      'peer39_update_category',
      'peer39_update_category_details',
      'peer39_update_category_items',
    ]);
  });

  it('every tool has a non-empty description and Zod schema', () => {
    for (const t of tools) {
      expect(t.name.startsWith('peer39_')).toBe(true);
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.inputSchema).toBeDefined();
    }
  });
});
