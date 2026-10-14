import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/ui/icon';
import { ROUTES } from '@/app/router/route-paths';
import { useLayoutUI } from '../use-layout-ui';

interface MobileHeaderProps {
  user: { nombre?: string; usuario?: string; rol?: string; imagen?: string } | null;
  onLogout: () => void;
  /** Mostrar botón hamburguesa (cuando hay > 5 módulos) */
  showBurger?: boolean;
}

/**
 * Header móvil institucional (estilo Cuadra 04):
 * - Avatar: bg-marca-secundario
 * - Logo Cuadra prominente
 * - Menú desplegable con gradient institucional idéntico a 04
 */
export function MobileHeader({ user, onLogout, showBurger = false }: MobileHeaderProps) {
  const navigate = useNavigate();
  const { toggleMobileMenu } = useLayoutUI();
  const [profileOpen, setProfileOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const displayName = user?.nombre ?? 'Usuario';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  return (
    <header className="px-4 py-3 relative">
      <div className="flex items-center justify-between">

        {/* IZQUIERDA: Avatar con menú de usuario */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="w-10 h-10 rounded-full bg-marca-secundario flex items-center justify-center overflow-hidden border-2 border-transparent focus:border-white/50 transition-all shadow-sm active:scale-95 outline-none cursor-pointer"
            aria-label="Menú de usuario"
          >
            {user?.imagen && !imageFailed ? (
              <img
                src={user.imagen}
                alt="Perfil"
                className="w-full h-full object-cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <Icon name="person" className="text-white" size="24px" />
            )}
          </button>

          {profileOpen && (
            <div
              className="absolute left-0 mt-3 w-64 z-50 animate-in fade-in slide-in-from-top-2 duration-300 flex flex-col overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(72, 43, 44, 0.95), rgba(45, 25, 26, 0.98))',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 20px 40px -10px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.2)',
                borderRadius: '20px',
              }}
            >
              <div className="relative z-10 px-5 py-5 border-b border-white/10">
                <p className="text-[15px] font-bold text-white leading-tight drop-shadow-md">{displayName}</p>
                {user?.usuario && (
                  <p className="text-xs text-white/60 mt-1 truncate font-medium">@{user.usuario}</p>
                )}
                {user?.rol && (
                  <div className="mt-3">
                    <span className="inline-block px-3 py-1 bg-white/10 text-white/90 text-[10px] font-black uppercase tracking-widest rounded-full border border-white/10 shadow-xs">
                      {user.rol.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
              </div>

              <div className="relative z-10 p-2 flex flex-col gap-1">
                <button
                  onClick={() => { navigate(ROUTES.LISTADOS); setProfileOpen(false); }}
                  className="w-full px-4 py-3 text-left text-sm font-semibold hover:bg-white/10 active:bg-white/20 transition-all flex items-center gap-3 text-white/90 rounded-xl outline-none cursor-pointer"
                >
                  <Icon name="account_circle" size="20px" className="text-white/80" />
                  <span>Ver Listados</span>
                </button>
                <button
                  onClick={onLogout}
                  className="w-full px-4 py-3 text-left text-sm font-bold hover:bg-red-500/20 active:bg-red-500/30 transition-all flex items-center gap-3 text-red-100/90 rounded-xl outline-none cursor-pointer"
                >
                  <Icon name="logout" size="20px" className="text-red-300" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CENTRO: Logo Cuadra prominente */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <button
            onClick={() => navigate(ROUTES.LISTADOS)}
            className="outline-none active:scale-95 transition-transform select-none block cursor-pointer"
            aria-label="Ir a Listados"
          >
            <img
              src="/img/01_Cuadra.webp"
              alt="Almacén MBC"
              className="h-9 sm:h-10 w-auto object-contain drop-shadow-xs"
            />
          </button>
        </div>

        {/* DERECHA: Hamburguesa condicional */}
        <div className="flex items-center gap-2">
          {showBurger && (
            <button
              onClick={toggleMobileMenu}
              className="w-10 h-10 rounded-lg hover:bg-slate-100 active:scale-95 transition-all text-marca-primario flex items-center justify-center outline-none cursor-pointer"
              aria-label="Menú de navegación"
            >
              <Icon name="menu" size="26px" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
