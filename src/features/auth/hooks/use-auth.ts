import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuthSession } from '@/app/providers/auth-provider';
import { ROUTES } from '@/app/router/route-paths';
import type { LoginCredentials } from '../types/auth.types';
import { ApiError } from '@/lib/api/http-client';

export function useAuth() {
  const navigate = useNavigate();
  const session = useAuthSession();
  const [loading, setLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<boolean> => {
      setLoading(true);
      setBackendError(null);

      try {
        const success = await session.login(credentials);
        if (success) {
          navigate(ROUTES.LISTADOS);
          return true;
        }
        setBackendError('Credenciales incorrectas');
        return false;
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setBackendError(err.body?.message || 'Credenciales incorrectas o error en el servidor');
        } else if (err instanceof Error) {
          setBackendError(err.message);
        } else {
          setBackendError('Error inesperado al intentar iniciar sesión');
        }
        return false;
      } finally {
        setLoading(false);
      }
    },
    [navigate, session],
  );

  return {
    login,
    logout: session.logout,
    loading,
    backendError,
    setBackendError,
    currentUser: session.user,
    isAuthenticated: session.isAuthenticated,
    isLoadingSession: session.isLoading,
  };
}
