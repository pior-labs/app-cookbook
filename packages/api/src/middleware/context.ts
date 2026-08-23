// The Hono environment shared by every middleware, route, and handler. Keeping
// it in one place lets the auth and request-context middleware be typed against
// the same context the application is built with.

export interface RequestContextVariables {
  requestId: string;
}

export interface AuthVariables {
  userId: number;
  userEmail: string;
  userName: string;
}

export type AppVariables = AuthVariables & RequestContextVariables;

export interface AppEnv {
  Variables: AppVariables;
}
