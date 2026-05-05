import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { authApi, LoginResponse } from '../api/auth';
import { setAccessToken } from '../api/client';

interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'operator';
  must_change_password: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<LoginResponse['user']>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Try to restore session on mount
  useEffect(() => {
    const tryRefresh = async () => {
      try {
        const { data } = await authApi.refresh();
        setAccessToken(data.access_token);
        // Decode user from token
        const payload = JSON.parse(atob(data.access_token.split('.')[1]!)) as {
          userId: string;
          username: string;
          role: 'admin' | 'operator';
        };
        setUser({
          id: payload.userId,
          username: payload.username,
          email: '',
          role: payload.role,
          must_change_password: false,
        });
      } catch {
        setUser(null);
        setAccessToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    tryRefresh();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await authApi.login(username, password);
    setAccessToken(data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, logoutAll }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
