const CURRENT_YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="bg-app-surface border-t border-border py-3 px-4">
      <div className="text-center">
        <p className="text-xs text-text-muted font-lectura">
          <span className="font-semibold text-text-secondary">Manufacturera de Botas Cuadra</span> © {CURRENT_YEAR} · Materia Prima
        </p>
      </div>
    </footer>
  );
}
