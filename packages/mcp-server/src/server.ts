import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Logger } from './logger.js';
import type { ActingUser } from './tools/helpers.js';
import { registerPreferenceTools } from './tools/preferences.js';
import { registerRecipeTools } from './tools/recipes.js';
import { registerScalingTools } from './tools/scaling.js';

// Building the server is separate from starting it so a test can construct one
// and speak to it over an in-memory transport without the process bootstrapping
// itself, reading configuration, or connecting stdio.
export function createServer(
  user: ActingUser,
  logger: Logger,
): { server: McpServer; tools: string[] } {
  const server = new McpServer(
    { name: 'cookbook', version: '0.1.0' },
    {
      // What the client shows the model before it picks a tool. These are the
      // things it would otherwise get wrong: that nothing here can write, that
      // favorites belong to one person while ratings are a household average,
      // and that a scaled amount is not an edit to the recipe.
      instructions: [
        `This is the Pior Labs Cookbook, a private household recipe collection. It is acting as ${user.name}.`,
        'Every tool is read-only: nothing here can create, edit, rate, favorite, or delete a recipe. Say so plainly if asked to change something.',
        'get_favorites answers for this one household member. Ratings returned by other tools are a household average across everyone who rated a recipe.',
        'Recipe ids come from the listing tools. Prefer search_recipes to guessing an id.',
        'Scaled ingredient amounts are a calculation for the requested serving count; the saved recipe keeps its own base servings.',
      ].join(' '),
    },
  );

  const tools = [
    ...registerRecipeTools(server, user, logger),
    ...registerPreferenceTools(server, user, logger),
    ...registerScalingTools(server, user, logger),
  ];

  return { server, tools };
}
