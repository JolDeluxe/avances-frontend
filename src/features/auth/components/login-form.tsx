import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { authApi } from '../api/auth-api';
import type { UsuarioLoginItem } from '../types/auth.types';

export interface LoginFormProps {
  loading: boolean;
  backendError: string | null;
  onSubmit: (usuario: string, password: string) => Promise<void>;
  onClearError?: () => void;
}

export function LoginForm({
  loading,
  backendError,
  onSubmit,
  onClearError,
}: LoginFormProps) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [usuariosList, setUsuariosList] = useState<UsuarioLoginItem[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadUsuarios() {
      try {
        setLoadingUsuarios(true);
        const res = await authApi.getUsuariosLogin();
        if (isMounted && res.success && res.data) {
          setUsuariosList(res.data);
        }
      } catch {
        // En caso de fallo de red, se mantendrá vacío
      } finally {
        if (isMounted) setLoadingUsuarios(false);
      }
    }
    loadUsuarios();
    return () => {
      isMounted = false;
    };
  }, []);

  const usuarioError = submitted && !usuario.trim()
    ? 'Debes seleccionar tu nombre de usuario'
    : null;

  const passwordError = submitted && (!password || password.length < 6)
    ? 'La contraseña debe tener al menos 6 caracteres'
    : null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);

    if (!usuario.trim() || !password || password.length < 6) {
      return;
    }

    await onSubmit(usuario.trim(), password);
  };

  const handleUsuarioChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setUsuario(e.target.value);
    if (backendError && onClearError) onClearError();
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (backendError && onClearError) onClearError();
  };

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300">
      <h2 className="fuente-titulos text-3xl font-bold mb-6 text-center text-brand-primary uppercase tracking-widest">
        Iniciar Sesión
      </h2>

      {/* Alerta de Error de Negocio / Backend */}
      {backendError && (
        <div
          role="alert"
          className="mb-6 p-4 bg-danger-subtle border-l-4 border-danger rounded-r-md flex items-center gap-3 text-danger-text text-sm font-medium shadow-xs"
        >
          <Icon name="error" size="20px" fill className="text-danger shrink-0" />
          <span>{backendError}</span>
        </div>
      )}

      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        {/* Selector de Usuario (por Nombre) */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="usuario" error={Boolean(usuarioError)} className="flex items-center gap-2">
            <Icon name="person" size="18px" /> USUARIO
          </Label>
          <Select
            id="usuario"
            name="usuario"
            value={usuario}
            onChange={handleUsuarioChange}
            error={Boolean(usuarioError)}
            helperText={usuarioError ?? undefined}
            disabled={loading || loadingUsuarios}
          >
            <option value="">
              {loadingUsuarios ? 'Cargando usuarios...' : 'Selecciona tu nombre'}
            </option>
            {usuariosList.map((u) => (
              <option key={u.id} value={u.usuario}>
                {u.nombre}
              </option>
            ))}
          </Select>
        </div>

        {/* Campo Contraseña */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="password" error={Boolean(passwordError)} className="flex items-center gap-2">
            <Icon name="lock" size="18px" /> CONTRASEÑA
          </Label>
          <Input
            id="password"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={handlePasswordChange}
            error={Boolean(passwordError)}
            helperText={passwordError ?? undefined}
            disabled={loading}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          isLoading={loading}
          className="mt-3 py-3 w-full"
        >
          Entrar al Sistema
        </Button>
      </form>
    </div>
  );
}
