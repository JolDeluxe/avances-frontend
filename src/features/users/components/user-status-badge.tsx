import { type ReactNode } from 'react';
import type {
  EstadoUsuario,
  TipoSurtidoAlmacen,
  TipoMaterialAuditor,
} from '../types/users.types';

export function UserStatusBadge({ estado }: { estado: EstadoUsuario }): ReactNode {
  const isActivo = estado === 'ACTIVO';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
        isActivo
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
          : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          isActivo ? 'bg-emerald-500 shadow-xs' : 'bg-slate-400 dark:bg-slate-500'
        }`}
      />
      <span>{isActivo ? 'Activo' : 'Inactivo'}</span>
    </span>
  );
}

const ROL_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    badgeClass: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30',
  },
  ADMIN: {
    label: 'Administrador',
    badgeClass: 'bg-cuadra-miel/15 text-cuadra-miel-hover dark:text-amber-300 border-cuadra-miel/30',
  },
  ALMACENISTA: {
    label: 'Almacenista',
    badgeClass: 'bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/25',
  },
  AUDITOR: {
    label: 'Auditor',
    badgeClass: 'bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-500/25',
  },
  REGISTRADOR: {
    label: 'Registrador',
    badgeClass: 'bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/25',
  },
};

export function UserRoleBadge({ rolCodigo }: { rolCodigo?: string }): ReactNode {
  const code = (rolCodigo || '').toUpperCase();
  const config = ROL_CONFIG[code] || {
    label: rolCodigo || 'Sin rol',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${config.badgeClass}`}
    >
      {config.label}
    </span>
  );
}
export function UserSegmentacionBadge({
  tipoSurtidoAlmacen,
  tipoMaterialAuditor,
  rolCodigo,
}: {
  tipoSurtidoAlmacen?: TipoSurtidoAlmacen | null;
  tipoMaterialAuditor?: TipoMaterialAuditor | null;
  rolCodigo?: string;
}): ReactNode {
  const code = (rolCodigo || '').toUpperCase();

  const getCleanLabels = (): string[] => {
    if (code === 'ALMACENISTA' && tipoSurtidoAlmacen) {
      const raw = tipoSurtidoAlmacen.trim().toUpperCase();
      if (raw === 'TODOS') return ['Directos', 'Indirectos', 'Bolsas'];
      return raw
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .map((seg) => {
          if (seg === 'DIRECTOS') return 'Directos';
          if (seg === 'INDIRECTOS') return 'Indirectos';
          if (seg === 'BOLSAS') return 'Bolsas';
          return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase();
        });
    }

    if (code === 'AUDITOR' && tipoMaterialAuditor) {
      const raw = tipoMaterialAuditor.trim().toUpperCase();
      if (raw === 'TODOS') return ['Directos', 'Indirectos', 'Bolsas'];
      return raw
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .map((seg) => {
          if (seg === 'DIRECTOS') return 'Directos';
          if (seg === 'INDIRECTOS') return 'Indirectos';
          if (seg === 'BOLSAS') return 'Bolsas';
          return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase();
        });
    }

    if (code === 'SUPER_ADMIN' || code === 'ADMIN') {
      return ['Acceso Total'];
    }

    if (code === 'REGISTRADOR') {
      return ['Captura y Registro'];
    }

    return [];
  };

  const labels = getCleanLabels();

  if (labels.length === 0) {
    return <span className="text-text-muted text-xs">—</span>;
  }

  return (
    <ul className="space-y-0.5 py-1 text-xs">
      {labels.map((lbl) => (
        <li
          key={lbl}
          className="flex items-center gap-1.5 text-text-primary font-medium leading-tight"
        >
          <span className="w-1 h-1 rounded-full bg-text-muted shrink-0" />
          <span>{lbl}</span>
        </li>
      ))}
    </ul>
  );
}
