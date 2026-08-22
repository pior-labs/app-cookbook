import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { genericOAuth } from 'better-auth/plugins';
import { db, schema } from './db/index.js';
import { appEnv } from './env.js';

const env = appEnv();

export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
  trustedOrigins: env.betterAuthTrustedOrigins,
  secret: env.betterAuthSecret,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      ...schema,
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: env.centralAuth.providerId,
          discoveryUrl: env.centralAuth.discoveryUrl,
          issuer: env.centralAuth.issuer,
          requireIssuerValidation: true,
          clientId: env.centralAuth.clientId,
          clientSecret: env.centralAuth.clientSecret,
          scopes: ['openid', 'profile', 'email', 'offline_access'],
          pkce: true,
          accessType: 'offline',
          mapProfileToUser: (profile) => ({
            name: profile.name,
            email: profile.email,
            emailVerified: Boolean(profile.email_verified),
          }),
        },
      ],
    }),
  ],
  advanced: {
    // Development apps share localhost:5173 one at a time. Cookies outlive the
    // dev server, so namespace Cookbook cookies to prevent cross-app collisions.
    cookiePrefix: 'cookbook',
    database: {
      generateId: 'serial',
    },
  },
  user: {
    modelName: 'users',
  },
  session: {
    modelName: 'sessions',
  },
  account: {
    modelName: 'accounts',
    accountLinking: {
      enabled: true,
      trustedProviders: [env.centralAuth.providerId],
    },
  },
  verification: {
    modelName: 'verifications',
  },
});

export type Auth = typeof auth;
