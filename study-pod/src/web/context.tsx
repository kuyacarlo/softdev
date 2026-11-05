import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type AppConfig, type SessionUser } from './api';

interface AppState {
  config: AppConfig;
  user: SessionUser | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [cfg, me] = await Promise.all([
        api.get<AppConfig>('/api/config'),
        api.get<{ user: SessionUser | null }>('/api/auth/me'),
      ]);
      setConfig(cfg);
      setUser(me.user);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (error) {
    return (
      <main>
        <div className="alert error">
          <p>{error}</p>
        </div>
      </main>
    );
  }
  if (!config) return null;
  return <Ctx.Provider value={{ config, user, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
