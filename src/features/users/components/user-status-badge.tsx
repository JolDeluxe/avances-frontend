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

function getSegmentChip(label: string, variant: 'sky' | 'indigo' | 'amber' | 'emerald' | 'slate'): ReactNode {
  const styles: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-700 border-sky-200/90 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/90 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60',
    amber: 'bg-amber-50 text-amber-700 border-amber-200/90 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/90 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  };

  return (
    <span
      key={label}
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[variant]}`}
    >
      {label}
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

  if (code === 'ALMACENISTA' && tipoSurtidoAlmacen) {
    const raw = tipoSurtidoAlmacen.trim().toUpperCase();
    if (raw === 'TODOS') {
      return getSegmentChip('Todos', 'emerald');
    }

    const segments = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (segments.length === 0) return <span className="text-text-muted text-sm">—</span>;

    return (
      <div className="inline-flex flex-wrap items-center gap-1.5">
        {segments.map((seg) => {
          if (seg === 'DIRECTOS') return getSegmentChip('Directos', 'sky');
          if (seg === 'INDIRECTOS') return getSegmentChip('Indirectos', 'indigo');
          if (seg === 'BOLSAS') return getSegmentChip('Bolsas', 'amber');
          return getSegmentChip(seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase(), 'slate');
        })}
      </div>
    );
  }

  if (code === 'AUDITOR' && tipoMaterialAuditor) {
    const raw = tipoMaterialAuditor.trim().toUpperCase();
    if (raw === 'TODOS') {
      return getSegmentChip('Todos', 'emerald');
    }

    const segments = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (segments.length === 0) return <span className="text-text-muted text-sm">—</span>;

    return (
      <div className="inline-flex flex-wrap items-center gap-1.5">
        {segments.map((seg) => {
          if (seg === 'DIRECTOS') return getSegmentChip('Directos', 'sky');
          if (seg === 'INDIRECTOS') return getSegmentChip('Indirectos', 'indigo');
          if (seg === 'BOLSAS') return getSegmentChip('Bolsas', 'amber');
          return getSegmentChip(seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase(), 'slate');
        })}
      </div>
    );
  }

  if (code === 'SUPER_ADMIN' || code === 'ADMIN') {
    return getSegmentChip('Global', 'slate');
  }

  if (code === 'REGISTRADOR') {
    return getSegmentChip('Listados', 'emerald');
  }

  return <span className="text-text-muted text-sm">—</span>;
}
