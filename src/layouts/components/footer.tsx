import { APP_VERSION } from '@/config/app-version';

const CURRENT_YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="bg-app-surface border-t border-border py-2.5 px-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted font-lectura">
        <p>
          <span className="font-semibold text-text-secondary">Manufacturera de Botas Cuadra</span> © {CURRENT_YEAR} · Almacén MBC
        </p>
        <span className="font-codigo text-[11px] font-semibold text-text-muted bg-cuadra-arena/60 dark:bg-cuadra-arena/10 px-2 py-0.5 rounded border border-border/60 tracking-wider">
          {APP_VERSION}
        </span>
      </div>
    </footer>
  );
}
