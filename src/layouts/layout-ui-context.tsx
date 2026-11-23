import { createContext, useState, type ReactNode } from 'react';
import { useAuditorCounts } from './hooks/use-auditor-counts';

export interface LayoutUIState {
  /** Sidebar expandido (desktop) */
  sidebarExpanded: boolean;
  toggleSidebar: () => void;
  /** Menú lateral móvil abierto */
  mobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  /** Modo pantalla completa para proyección en planta (oculta layout) */
  fullscreenMode: boolean;
  setFullscreenMode: (value: boolean) => void;
  /** Contadores de auditoría (registros listos para descontar en ERP) */
  listadosAuditoriaCount: number;
  valesAuditoriaCount: number;
  refreshAuditorCounts: () => Promise<void>;
}

// oxlint-disable-next-line react/only-export-components
export const LayoutUIContext = createContext<LayoutUIState | null>(null);

export function LayoutUIProvider({ children }: { children: ReactNode }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_expanded');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState(false);

  const { listadosAuditoriaCount, valesAuditoriaCount, refreshAuditorCounts } = useAuditorCounts();

  const toggleSidebar = () => {
    setSidebarExpanded((prev: boolean) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_expanded', JSON.stringify(next));
      } catch {
        // Ignorar si storage no está disponible
      }
      return next;
    });
  };

  return (
    <LayoutUIContext.Provider
      value={{
        sidebarExpanded,
        toggleSidebar,
        mobileMenuOpen,
        toggleMobileMenu: () => setMobileMenuOpen((v) => !v),
        closeMobileMenu: () => setMobileMenuOpen(false),
        fullscreenMode,
        setFullscreenMode,
        listadosAuditoriaCount,
        valesAuditoriaCount,
        refreshAuditorCounts,
      }}
    >
      {children}
    </LayoutUIContext.Provider>
  );
}
