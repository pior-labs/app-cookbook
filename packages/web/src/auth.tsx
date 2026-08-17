import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  startSignIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

function errorMessage(payload: Record<string, unknown>, fallback: string): string {
  for (const key of ['message', 'error']) {
    const value = payload[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }

  return fallback;
}

function parseUser(payload: Record<string, unknown>): AuthUser | null {
  const value = payload.user;
  if (!value || typeof value !== 'object') return null;

  const user = value as Record<string, unknown>;
  const id = Number(user.id);
  if (!Number.isSafeInteger(id) || typeof user.name !== 'string' || typeof user.email !== 'string') {
    return null;
  }

  return { id, name: user.name, email: user.email };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/get-session', { credentials: 'include' });
      if (!response.ok) {
        setUser(null);
        return;
      }

      setUser(parseUser(await readJson(response)));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const startSignIn = useCallback(async () => {
    const response = await fetch('/api/auth/sign-in/oauth2', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'auth-pior', callbackURL: '/' }),
    });
    const payload = await readJson(response);

    if (!response.ok) {
      throw new Error(errorMessage(payload, `Could not start sign-in (${response.status}).`));
    }

    const redirectUrl = payload.url;
    if (typeof redirectUrl !== 'string') {
      throw new Error('The sign-in service did not return a redirect.');
    }

    window.location.assign(redirectUrl);
  }, []);

  const signOut = useCallback(async () => {
    const response = await fetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const payload = await readJson(response);

    if (!response.ok) {
      throw new Error(errorMessage(payload, `Could not sign out (${response.status}).`));
    }

    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, startSignIn, signOut, refreshSession }),
    [loading, refreshSession, signOut, startSignIn, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
