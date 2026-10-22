import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { currentRefreshToken, hasTokens, onUnauthorized, setTokens } from '../api/client';
import { Auth } from '../api/endpoints';
import type { Me, TokenPair } from '../api/types';

interface AuthState {
  user: Me | null;
  /** true tant que la session stockée n'a pas été vérifiée auprès de l'API */
  loading: boolean;
  login: (email: string, password: string) => Promise<Me>;
  register: (name: string, email: string, password: string) => Promise<Me>;
  /** Recharge /me (ex. après la création de l'église, l'utilisateur devient Church Admin). */
  reload: () => Promise<Me | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** La réponse de login inclut le nom de l'église ; /me non. On normalise sur la forme de /me. */
const fromPair = (pair: TokenPair): Me => {
  const { staff, ...rest } = pair.user;
  return { ...rest, staff: staff ? { id: staff.id, churchId: staff.churchId, role: staff.role } : null };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(hasTokens());

  const reload = useCallback(async () => {
    if (!hasTokens()) {
      setUser(null);
      return null;
    }
    try {
      const me = await Auth.me();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    onUnauthorized(() => setUser(null));
    if (hasTokens()) void reload().finally(() => setLoading(false));
  }, [reload]);

  const accept = useCallback((pair: TokenPair) => {
    setTokens({ accessToken: pair.accessToken, refreshToken: pair.refreshToken });
    const me = fromPair(pair);
    setUser(me);
    return me;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      reload,
      login: async (email, password) => accept(await Auth.login(email, password)),
      register: async (name, email, password) => accept(await Auth.register(name, email, password)),
      logout: async () => {
        const rt = currentRefreshToken();
        setTokens(null);
        setUser(null);
        if (rt) await Auth.logout(rt).catch(() => undefined);
      },
    }),
    [user, loading, reload, accept],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors de AuthProvider');
  return ctx;
}

/** Page d'accueil selon le rôle. */
export function homeFor(user: Me | null): string {
  if (!user) return '/connexion';
  if (user.platformRole === 'SUPER_ADMIN') return '/super/eglises';
  if (user.staff?.role === 'ADMIN') return '/eglise';
  if (user.staff?.role === 'PREACHER') return '/predicateur';
  return '/inscription';
}
