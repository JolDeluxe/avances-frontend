import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { authState } from '@/lib/api/http-client';
import { authApi } from '@/features/auth/api/auth-api';
import type { UsuarioAuth, LoginCredentials, BackendUsuarioPayload } from '@/features/auth/types/auth.types';

export interface AuthContextValue {
  user: UsuarioAuth | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_STORAGE_KEY = 'mp_user_cache';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UsuarioAuth | null>(() => {
    try {
      const cached = localStorage.getItem(USER_STORAGE_KEY);
      if (!cached) return null;
      const parsed = JSON.parse(cached) as UsuarioAuth;
      if (parsed && typeof parsed.rol === 'object' && parsed.rol !== null) {
        parsed.rol = (parsed.rol as { codigo?: string }).codigo || '';
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sincronizar datos no sensibles del usuario para persistencia de interfaz
  const persistUser = useCallback((userData: BackendUsuarioPayload | UsuarioAuth | null) => {
    if (!userData) {
      setUser(null);
      localStorage.removeItem(USER_STORAGE_KEY);
      return;
    }

    const normalizedRole =
      typeof userData.rol === 'object' && userData.rol !== null
        ? (userData.rol as { codigo?: string }).codigo
        : typeof userData.rol === 'string'
        ? userData.rol
        : undefined;

    const normalizedRolId =
      userData.rolId ??
      (typeof userData.rol === 'object' && userData.rol !== null
        ? (userData.rol as { id?: number }).id
        : undefined);

    const normalizedUser: UsuarioAuth = {
      ...userData,
      rol: normalizedRole,
      rolId: normalizedRolId,
    };

    setUser(normalizedUser);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalizedUser));
  }, []);

  // Cierre de sesión local y remoto
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Si falla la petición de red, se purga de todos modos el estado local
    } finally {
      authState.setAccessToken(null);
      persistUser(null);
    }
  }, [persistUser]);

  // Intento de refresco de sesión usando la cookie HttpOnly
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const response = await authApi.refresh();
      if (response.success && response.data?.accessToken) {
        authState.setAccessToken(response.data.accessToken);
        if (response.data.usuario) {
          const fullUser = response.data.usuario as UsuarioAuth;
          persistUser(fullUser);
        }
        return true;
      }
      return false;
    } catch {
      authState.setAccessToken(null);
      persistUser(null);
      return false;
    }
  }, [persistUser]);

  // Inicio de sesión
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<boolean> => {
      const response = await authApi.login(credentials);
      if (response.success && response.data?.accessToken && response.data?.usuario) {
        authState.setAccessToken(response.data.accessToken);
        persistUser(response.data.usuario);
        return true;
      }
      return false;
    },
    [persistUser],
  );

  // Hidratación inicial al montar la aplicación
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        await refreshSession();
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [refreshSession]);

  // Escuchar eventos globales del cliente HTTP
  useEffect(() => {
    const handleSessionExpired = () => {
      authState.setAccessToken(null);
      persistUser(null);
    };

    const handleTokenRefreshed = (e: Event) => {
      const customEvent = e as CustomEvent<{ token: string; user?: UsuarioAuth }>;
      if (customEvent.detail.user) {
        persistUser(customEvent.detail.user);
      }
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    window.addEventListener('auth:token-refreshed', handleTokenRefreshed);

    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
      window.removeEventListener('auth:token-refreshed', handleTokenRefreshed);
    };
  }, [persistUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user && authState.getAccessToken()),
        isLoading,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook de acceso al contexto de sesión
// oxlint-disable-next-line react/only-export-components
export function useAuthSession(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthSession debe ser usado dentro de un <AuthProvider>');
  }
  return context;
}
