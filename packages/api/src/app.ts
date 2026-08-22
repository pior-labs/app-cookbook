import { Hono, type MiddlewareHandler } from 'hono';
import postgres from 'postgres';
import { databaseConnection } from './env.js';
import type { AppEnv } from './middleware/context.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { requestContext } from './middleware/request-context.js';
import { recipesRoute } from './routes/recipes.js';

export const service = {
  name: 'Pior Labs Cookbook API',
  slug: 'cookbook',
  phase: 'Phase 1 — Core Cookbook',
  version: '0.1.0',
} as const;

export type { AppEnv, AppVariables } from './middleware/context.js';

export interface AppDependencies {
  // Authorization is deny-by-default for `/api/*`; the concrete session lookup
  // is injected so the boundary can be exercised without a live OAuth provider.
  requireAuth: MiddlewareHandler<AppEnv>;
  // OAuth initiation and callback. Public by design (technical design
  // section 6).
  authHandler?: (request: Request) => Response | Promise<Response>;
}

export function createApp(deps: AppDependencies) {
  const app = new Hono<AppEnv>();

  app.use('*', requestContext);

  app.get('/health', (c) => c.json({ status: 'ok', service: service.slug }));
  app.get('/api/health', (c) => c.json({ status: 'ok', service: service.slug }));
  app.get('/api', (c) => c.json(service));
  app.get('/api/readiness', async (c) => {
    const connection = databaseConnection();
    const client = postgres(connection.url, { ...connection.options, max: 1 });

    try {
      await client`select 1`;
      return c.json({ status: 'ready', service: service.slug, database: 'connected' });
    } catch (error) {
      console.error('Database readiness check failed', error);
      return c.json({ status: 'not_ready', service: service.slug, database: 'unavailable' }, 503);
    } finally {
      await client.end();
    }
  });

  const { authHandler } = deps;
  if (authHandler) {
    app.on(['GET', 'POST'], '/api/auth/*', (c) => authHandler(c.req.raw));
  }

  app.use('/api/*', deps.requireAuth);

  app.get('/api/hello', (c) =>
    c.json({
      message: 'Cookbook API is authenticated.',
      user: {
        id: c.get('userId'),
        email: c.get('userEmail'),
        name: c.get('userName'),
      },
    }),
  );

  app.route('/api/recipes', recipesRoute);

  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}

export type App = ReturnType<typeof createApp>;
