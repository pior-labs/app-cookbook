import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// An MCP client launches this server itself, from whatever working directory it
// happens to have, so the repository's `.env` files are located relative to this
// module rather than to `process.cwd()`. This mirrors `@cookbook/api`'s own env
// module, which the database connection goes on to read.
//
// No `override` here: a variable already present in the environment wins, so the
// `env` block in a client's configuration - which is where the acting user is
// normally set - beats the checked-in files.
loadEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
loadEnv({ path: fileURLToPath(new URL('../../../.env.local', import.meta.url)) });
loadEnv();

const environmentSchema = z.object({
  // Read by `@cookbook/api`'s own database module. It is validated here as well
  // so a missing connection string is reported as configuration at startup
  // rather than as a connection failure on the first tool call.
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_URL_FILE: z.string().min(1).optional(),

  // Which household member this server acts as. Per-user tools - favorites and
  // the caller's own ratings - answer for this person and no one else, and the
  // model cannot address another member's data because it never supplies an
  // identity (ADR 0006).
  // Optional here, and required below, so that "not set at all" gets the
  // sentence that says what to do rather than a schema message about an
  // undefined string.
  COOKBOOK_MCP_USER_EMAIL: z
    .string()
    .email('COOKBOOK_MCP_USER_EMAIL must be an email address.')
    .optional(),

  MCP_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type LogLevel = z.infer<typeof environmentSchema>['MCP_LOG_LEVEL'];

export interface McpEnv {
  userEmail: string;
  logLevel: LogLevel;
}

// Parsed lazily rather than at module load, so importing a tool module in a
// test does not require the whole environment to be present.
export function mcpEnv(): McpEnv {
  const parsed = environmentSchema.safeParse(process.env);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid MCP server configuration - ${detail}`);
  }

  const { DATABASE_URL, DATABASE_URL_FILE, COOKBOOK_MCP_USER_EMAIL, MCP_LOG_LEVEL } = parsed.data;

  if (!COOKBOOK_MCP_USER_EMAIL) {
    throw new Error(
      'Invalid MCP server configuration - set COOKBOOK_MCP_USER_EMAIL to the address of the household member this server acts as. Favorites and personal ratings answer for that person, so each member configures their own client with their own address.',
    );
  }

  if (!DATABASE_URL && !DATABASE_URL_FILE) {
    throw new Error(
      'Invalid MCP server configuration - set DATABASE_URL, or DATABASE_URL_FILE in production so the password stays server-managed.',
    );
  }

  return { userEmail: COOKBOOK_MCP_USER_EMAIL, logLevel: MCP_LOG_LEVEL };
}
