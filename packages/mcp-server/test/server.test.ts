import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createLogger } from '../src/logger.js';
import { createServer } from '../src/server.js';

// The contract a client sees. This connects a real client to a real server over
// an in-memory transport, so the tool list and its annotations are read the way
// an assistant reads them rather than asserted against the registration code.
//
// No database is touched: listing tools never runs a handler.

const user = { id: 1, name: 'Piotr', email: 'pior@example.test' };

const EXPECTED_TOOLS = [
  'search_recipes',
  'get_recipe',
  'get_recipes_by_tag',
  'get_favorites',
  'get_top_rated_recipes',
  'scale_recipe',
].sort();

let client: Client;

beforeAll(async () => {
  const { server } = createServer(user, createLogger('error'));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
});

describe('the tool surface', () => {
  it('registers exactly the six capabilities the PRD names for MCP v1', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(EXPECTED_TOOLS);
  });

  // The load-bearing assertion of ADR 0006. A write tool added later without
  // revisiting that decision fails here.
  it('marks every tool read-only', async () => {
    const { tools } = await client.listTools();
    const writable = tools.filter((tool) => tool.annotations?.readOnlyHint !== true);
    expect(writable.map((tool) => tool.name)).toEqual([]);
  });

  it('never accepts a user, so a tool cannot be pointed at another household member', async () => {
    const { tools } = await client.listTools();

    for (const tool of tools) {
      const properties = Object.keys(
        (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {},
      );
      expect(properties).not.toContain('userId');
      expect(properties).not.toContain('user');
      expect(properties).not.toContain('email');
    }
  });

  it('describes every tool, so a model can tell them apart', async () => {
    const { tools } = await client.listTools();

    for (const tool of tools) {
      expect(tool.description, `${tool.name} has no description`).toBeTruthy();
      expect(tool.description!.length).toBeGreaterThan(40);
    }
  });

  it('tells the model whose favorites it is reading', async () => {
    const { tools } = await client.listTools();
    const favorites = tools.find((tool) => tool.name === 'get_favorites');
    expect(favorites?.description).toContain(user.name);
  });

  it('bounds every result set, so one call cannot return the whole cookbook', async () => {
    const { tools } = await client.listTools();
    const listing = tools.filter((tool) =>
      ['search_recipes', 'get_favorites', 'get_top_rated_recipes', 'get_recipes_by_tag'].includes(
        tool.name,
      ),
    );

    expect(listing).toHaveLength(4);
    for (const tool of listing) {
      const limit = (
        tool.inputSchema as { properties?: Record<string, { maximum?: number }> }
      ).properties?.limit;
      expect(limit?.maximum, `${tool.name} does not cap its limit`).toBeLessThanOrEqual(50);
    }
  });
});
