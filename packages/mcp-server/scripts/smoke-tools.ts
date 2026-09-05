import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// End-to-end smoke check: launch the real server as a subprocess, speak MCP to
// it over stdio, and call every tool.
//
// This exercises what a unit test cannot - that the process starts, that the
// transport framing is intact, and that nothing writes to stdout except the
// protocol. A server that logs to stdout by mistake fails here and nowhere
// else.
//
// It reads the development database, so it needs COOKBOOK_MCP_USER_EMAIL set to
// a real household member:
//
//   COOKBOOK_MCP_USER_EMAIL=you@example.com pnpm --filter @cookbook/mcp-server smoke

const serverEntry = fileURLToPath(new URL('../src/index.ts', import.meta.url));

function text(result: unknown): string {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n');
}

function heading(label: string): void {
  console.log(`\n${'='.repeat(70)}\n${label}\n${'='.repeat(70)}`);
}

async function main() {
  if (!process.env.COOKBOOK_MCP_USER_EMAIL) {
    throw new Error('Set COOKBOOK_MCP_USER_EMAIL to a Cookbook user before running the smoke check.');
  }

  // Launched through this Node with tsx's loader rather than through `npx`,
  // which resolves differently depending on the working directory the client
  // happens to have.
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', serverEntry],
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: process.env as Record<string, string>,
    stderr: 'inherit',
  });

  const client = new Client({ name: 'cookbook-smoke', version: '0.1.0' });
  await client.connect(transport);

  heading('Tools registered');
  const { tools } = await client.listTools();
  for (const tool of tools) {
    const readOnly = tool.annotations?.readOnlyHint === true ? 'read-only' : 'NOT READ-ONLY';
    console.log(`- ${tool.name} (${readOnly})`);
  }

  // The read-only claim is the point of ADR 0006, so the smoke check asserts it
  // rather than only printing it.
  const writable = tools.filter((tool) => tool.annotations?.readOnlyHint !== true);
  if (writable.length > 0) {
    throw new Error(`Tools not marked read-only: ${writable.map((t) => t.name).join(', ')}`);
  }

  heading('search_recipes (no filters)');
  const all = await client.callTool({ name: 'search_recipes', arguments: { limit: 5 } });
  console.log(text(all));

  // Pull a real id out of the search so the rest of the checks run against a
  // recipe that actually exists in this database.
  const firstId = (
    all as { structuredContent?: { recipes?: { id: number; baseServings?: number }[] } }
  ).structuredContent?.recipes?.[0]?.id;

  heading('search_recipes (free text "chicken")');
  console.log(text(await client.callTool({ name: 'search_recipes', arguments: { query: 'chicken' } })));

  heading('get_favorites');
  console.log(text(await client.callTool({ name: 'get_favorites', arguments: {} })));

  heading('get_top_rated_recipes');
  console.log(text(await client.callTool({ name: 'get_top_rated_recipes', arguments: { minRating: 1 } })));

  heading('get_recipes_by_tag (a tag that does not exist)');
  console.log(
    text(await client.callTool({ name: 'get_recipes_by_tag', arguments: { tags: ['no-such-tag'] } })),
  );

  if (firstId != null) {
    heading(`get_recipe (${firstId})`);
    console.log(text(await client.callTool({ name: 'get_recipe', arguments: { recipeId: firstId } })));

    heading(`scale_recipe (${firstId} to 3 servings)`);
    console.log(
      text(await client.callTool({ name: 'scale_recipe', arguments: { recipeId: firstId, servings: 3 } })),
    );

    heading(`get_recipe (${firstId}, scaled to 12)`);
    console.log(
      text(await client.callTool({ name: 'get_recipe', arguments: { recipeId: firstId, servings: 12 } })),
    );
  } else {
    console.log('\nNo recipes in this database; skipped the single-recipe checks.');
  }

  heading('get_recipe (a recipe that does not exist)');
  console.log(text(await client.callTool({ name: 'get_recipe', arguments: { recipeId: 999_999 } })));

  await client.close();
  console.log('\nSmoke check complete.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
