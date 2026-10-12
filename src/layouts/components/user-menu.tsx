import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/ui/icon';
import { ROUTES } from '@/app/router/route-paths';

interface UserMenuUser {
  nombre?: string;
  usuario?: string;
  rol?: string;
  imagen?: string;
}

interface UserMenuProps {
  user: UserMenuUser | null;
  onLogout: () => void;
}

/**
 * Menú de usuario para el navbar (desktop).
 * Idéntico en colores, bordes y estilos a 04_Proyecto_Mantenimiento:
 * - Avatar: bg-marca-secundario border border-marca-secundario/20
 * - Nombre: text-marca-primario
 * - Icono perfil: text-marca-acento
 * - Focus ring: focus:ring-marca-secundario/30
 */
export function UserMenu({ user, onLogout }: UserMenuProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleProfile = () => {
    navigate(ROUTES.LISTADOS);
    setIsOpen(false);
  };

  const displayName = user?.nombre ?? 'Usuario';
  const displayRole = user?.rol ? user.rol.replace(/_/g, ' ').toLowerCase() : 'Rol';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="
          cursor-pointer
          flex items-center gap-2 px-3 py-2 rounded-sm
          hover:bg-slate-100 transition-colors
          focus:outline-none focus:ring-2 focus:ring-marca-secundario/30
        "
      >
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-marca-primario">
            {displayName}
          </p>
          <p className="text-xs text-slate-500 capitalize">
            {displayRole}
          </p>
        </div>

        <div className="w-10 h-10 rounded-full bg-marca-secundario flex items-center justify-center overflow-hidden border border-marca-secundario/20 shrink-0 shadow-sm">
          {user?.imagen && !imageFailed ? (
            <img
              src={user.imagen}
              alt={`Avatar de ${displayName}`}
              className="w-full h-full object-cover animate-in fade-in duration-300"
              onError={() => setImageFailed(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <Icon name="person" className="text-white" size="24px" />
          )}
        </div>

        <Icon
          name={isOpen ? 'expand_less' : 'expand_more'}
          className="text-slate-600 transition-transform duration-200"
          size="20px"
        />
      </button>

      {isOpen && (
        <div className="
          absolute right-0 mt-2 w-56
          bg-white rounded-sm shadow-lg border border-slate-200
          z-50 animate-in fade-in slide-in-from-top-2 duration-200
        ">
          <div className="sm:hidden px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-sm">
            <p className="text-sm font-semibold text-marca-primario">
              {displayName}
            </p>
            {user?.usuario && (
              <p className="text-xs text-slate-500 mt-1 truncate">@{user.usuario}</p>
            )}
          </div>

          <div className="py-1">
            <button
              onClick={handleProfile}
              className="
                cursor-pointer
                w-full px-4 py-2 text-left text-sm font-medium
                hover:bg-slate-50 transition-colors
                flex items-center gap-3 text-slate-700
              "
            >
              <Icon name="account_circle" size="20px" className="text-marca-acento" />
              <span>Ver Perfil</span>
            </button>

            <button
              onClick={onLogout}
              className="
                cursor-pointer
                w-full px-4 py-2 text-left text-sm font-medium
                hover:bg-red-50 transition-colors
                flex items-center gap-3 text-red-600
              "
            >
              <Icon name="logout" size="20px" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
