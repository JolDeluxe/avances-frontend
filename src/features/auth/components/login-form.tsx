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

  // Orden de precedencia por rol solicitado:
  // 1. ADMIN
  // 2. AUDITOR
  // 3. REGISTRADOR
  // 4. ALMACENISTA
  // 5. SUPER_ADMIN (hasta el final)
  const getRolPriority = (u: UsuarioLoginItem): number => {
    const codigoRol = u.rol?.codigo?.toUpperCase();
    if (codigoRol === 'SUPER_ADMIN' || u.usuario === 'admin' || u.nombre.toLowerCase().includes('super')) {
      return 99; // Siempre al final
    }
    switch (codigoRol) {
      case 'ADMIN':
        return 1;
      case 'AUDITOR':
        return 2;
      case 'REGISTRADOR':
        return 3;
      case 'ALMACENISTA':
        return 4;
      default:
        return 10;
    }
  };

  // Obtener estilo/color distintivo por rol (sin agregar texto del rol)
  const getOptionStyle = (u: UsuarioLoginItem): { className: string; style?: React.CSSProperties } => {
    const codigoRol = u.rol?.codigo?.toUpperCase();
    if (codigoRol === 'SUPER_ADMIN' || u.usuario === 'admin' || u.nombre.toLowerCase().includes('super')) {
      // Gris tenue para semi-ocultarlo pero manteniéndolo seleccionable
      return {
        className: 'text-gray-400 font-normal',
        style: { color: '#9ca3af', fontWeight: '400', opacity: 0.75 },
      };
    }
    switch (codigoRol) {
      case 'ADMIN':
        // Azul petróleo / sobrio elegante
        return {
          className: 'text-blue-700 font-semibold',
          style: { color: '#1d4ed8', fontWeight: '600' },
        };
      case 'AUDITOR':
        // Púrpura / auditoría
        return {
          className: 'text-purple-700 font-semibold',
          style: { color: '#7e22ce', fontWeight: '600' },
        };
      case 'REGISTRADOR':
        // Esmeralda / teal
        return {
          className: 'text-emerald-700 font-semibold',
          style: { color: '#047857', fontWeight: '600' },
        };
      case 'ALMACENISTA':
        // Ámbar / naranja de operaciones
        return {
          className: 'text-amber-700 font-medium',
          style: { color: '#b45309', fontWeight: '500' },
        };
      default:
        return {
          className: 'text-gray-700',
        };
    }
  };

  const usuariosOrdenados = [...usuariosList].sort((a, b) => {
    const pA = getRolPriority(a);
    const pB = getRolPriority(b);
    if (pA !== pB) return pA - pB;
    return a.nombre.localeCompare(b.nombre, 'es');
  });

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
        {/* Selector de Usuario (por Nombre) con botón de refrescar lista */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="usuario" error={Boolean(usuarioError)} className="flex items-center gap-2">
              <Icon name="person" size="18px" /> USUARIO
            </Label>
            <button
              type="button"
              onClick={async () => {
                try {
                  setLoadingUsuarios(true);
                  if ('serviceWorker' in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    regs.forEach((r) => void r.update());
                  }
                  const res = await authApi.getUsuariosLogin();
                  if (res.success && res.data) {
                    setUsuariosList(res.data);
                  }
                } finally {
                  setLoadingUsuarios(false);
                }
              }}
              title="Recargar usuarios y verificar actualización"
              disabled={loadingUsuarios}
              className="group flex items-center gap-1 text-xs text-text-muted hover:text-marca-primario transition-colors disabled:opacity-50"
            >
              <Icon
                name="refresh"
                size="16px"
                className={`transition-transform duration-500 ${loadingUsuarios ? 'animate-spin text-marca-primario' : 'group-hover:rotate-180'}`}
              />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
          <Select
            id="usuario"
            name="usuario"
            value={usuario}
            onChange={handleUsuarioChange}
            error={Boolean(usuarioError)}
            helperText={usuarioError ?? undefined}
            disabled={loading || loadingUsuarios}
          >
            <option value="" className="text-gray-500">
              {loadingUsuarios ? 'Cargando usuarios...' : 'Selecciona tu nombre'}
            </option>
            {usuariosOrdenados.map((u) => {
              const opt = getOptionStyle(u);
              return (
                <option
                  key={u.id}
                  value={u.usuario}
                  className={opt.className}
                  style={opt.style}
                >
                  {u.nombre}
                </option>
              );
            })}
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
