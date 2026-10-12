import { useState, useEffect, type ReactNode } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { TIPO_FRENTE_CONFIG } from '@/config/status-config';
import type { ListadoItem, TipoFrenteMaterial } from '../types/listados.types';

export type BatchAccionOperativa = 'separar' | 'entregar' | 'descontar';

export interface ListadoBatchAccionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedListados: ListadoItem[];
  tipoFrente: TipoFrenteMaterial;
  availableFrentes?: TipoFrenteMaterial[];
  accion: BatchAccionOperativa;
  onConfirm: (opts: { tipoFrente: TipoFrenteMaterial; entregarTambien?: boolean; motivo?: string }) => Promise<void> | void;
  isSubmitting?: boolean;
}

/**
 * Modal estilizado y compacto para operaciones masivas (Batch)
 * en submódulo PENDIENTES (Separar/Entregar) y AUDITORÍA (Descontar de sistema).
 */
export function ListadoBatchAccionModal({
  isOpen,
  onClose,
  selectedListados,
  tipoFrente: initialTipoFrente,
  availableFrentes,
  accion,
  onConfirm,
  isSubmitting = false,
}: ListadoBatchAccionModalProps): ReactNode {
  // Determinar los frentes que realmente existen en los listados seleccionados
  const existingFrentesInSelection = Array.from(
    new Set(
      selectedListados.flatMap((item) => (item.frentes ?? []).map((f) => f.tipoFrente))
    )
  ) as TipoFrenteMaterial[];

  // Frentes candidatos a mostrar: intersección entre los permitidos al usuario y los que existen en los listados seleccionados
  const candidateFrentes = (
    availableFrentes && availableFrentes.length > 0
      ? availableFrentes.filter((f) => existingFrentesInSelection.includes(f))
      : existingFrentesInSelection
  );

  // Si ninguno coincide (caso raro), respaldo a candidateFrentes o availableFrentes o [initialTipoFrente]
  const effectiveAvailableFrentes = candidateFrentes.length > 0
    ? candidateFrentes
    : (availableFrentes && availableFrentes.length > 0 ? availableFrentes : [initialTipoFrente]);

  // Encontrar el mejor frente por defecto: aquél que tenga al menos 1 listado elegible para la acción
  const findDefaultFrente = (): TipoFrenteMaterial => {
    // 1. Probar el initialTipoFrente si existe en los efectivos y tiene elegibles
    const hasEligibleInFrente = (fKey: TipoFrenteMaterial) =>
      selectedListados.some((item) => {
        const f = item.frentes?.find((fr) => fr.tipoFrente === fKey);
        if (!f) return false;
        if (accion === 'separar') return f.estado === 'PENDIENTE';
        if (accion === 'entregar') return f.estado === 'SEPARADO';
        if (accion === 'descontar') return f.estado === 'ENTREGADO';
        return true;
      });

    if (effectiveAvailableFrentes.includes(initialTipoFrente) && hasEligibleInFrente(initialTipoFrente)) {
      return initialTipoFrente;
    }

    // 2. Buscar el primer frente de la lista efectiva que tenga elegibles
    const firstWithEligibles = effectiveAvailableFrentes.find(hasEligibleInFrente);
    if (firstWithEligibles) return firstWithEligibles;

    // 3. Si ninguno tiene elegibles para la acción, tomar el primer frente existente
    return effectiveAvailableFrentes[0] ?? initialTipoFrente;
  };

  const [selectedTipoFrente, setSelectedTipoFrente] = useState<TipoFrenteMaterial>(() => findDefaultFrente());
  const [entregarTambien, setEntregarTambien] = useState<boolean>(false);
  const [motivo, setMotivo] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSelectedTipoFrente(findDefaultFrente());
      setEntregarTambien(false);
      setMotivo('');
    }
  }, [isOpen, accion, initialTipoFrente, selectedListados]);

  if (!isOpen) return null;

  const isSeparar = accion === 'separar';
  const isEntregar = accion === 'entregar';
  const isDescontar = accion === 'descontar';
  const tipoFrente = selectedTipoFrente;
  const frenteConfig = TIPO_FRENTE_CONFIG[tipoFrente];

  // Listados elegibles según el estado actual del material seleccionado
  const eligibleListados = selectedListados.filter((item) => {
    const f = item.frentes?.find((fr) => fr.tipoFrente === tipoFrente);
    if (!f) return false;
    if (isSeparar) return f.estado === 'PENDIENTE';
    if (isEntregar) return f.estado === 'SEPARADO';
    if (isDescontar) return f.estado === 'ENTREGADO';
    return true;
  });

  const count = eligibleListados.length;
  const omittedCount = selectedListados.length - count;

  const handleConfirm = () => {
    if (count === 0) return;
    onConfirm({
      tipoFrente,
      entregarTambien: isSeparar ? entregarTambien : false,
      motivo: motivo.trim() || undefined,
    });
  };

  const modalTitle = isSeparar
    ? `Separar ${count} listados`
    : isEntregar
    ? `Entregar ${count} listados a producción`
    : `Descontar ${count} listados en sistema`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <ModalHeader title={modalTitle} onClose={onClose} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <ModalBody className="space-y-3.5 py-3">
          {/* Selector de material solo si existen 2 o más materiales presentes en los listados seleccionados */}
          {effectiveAvailableFrentes.length > 1 && (
            <div className="flex items-center gap-1.5 p-1 bg-app-surface-muted/80 rounded-lg border border-border">
              {effectiveAvailableFrentes.map((fKey) => {
                const isSelected = selectedTipoFrente === fKey;
                const conf = TIPO_FRENTE_CONFIG[fKey];
                return (
                  <button
                    key={fKey}
                    type="button"
                    onClick={() => setSelectedTipoFrente(fKey)}
                    className={`flex-1 py-1 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-app-surface text-brand-primary shadow-2xs border border-border'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {conf?.nombre ?? fKey}
                  </button>
                );
              })}
            </div>
          )}

          {/* Cabecera compacta del lote: Material y Conteo */}
          <div className="flex items-center justify-between gap-2 px-1 text-xs">
            <span className="font-semibold text-text-secondary">
              <strong className="text-text-primary">{frenteConfig?.nombre ?? tipoFrente}</strong>
            </span>
            <span className="text-2xs font-bold text-text-muted bg-cuadra-arena/50 px-2 py-0.5 rounded-full border border-border/60">
              {count} {count === 1 ? 'elegible' : 'elegibles'} {omittedCount > 0 ? `(${omittedCount} no aplican)` : ''}
            </span>
          </div>

          {/* Contenedor elegante de listados seleccionados */}
          <div className="rounded-lg border border-border bg-app-surface overflow-hidden shadow-2xs">
            <div className="px-3 py-1.5 bg-cuadra-arena/30 border-b border-border/70 flex items-center justify-between text-2xs">
              <span className="font-semibold text-text-secondary uppercase tracking-wider">
                Listas a procesar
              </span>
              <span className="font-mono font-bold text-text-primary">
                {count} {count === 1 ? 'lista' : 'listas'}
              </span>
            </div>

            <div className="max-h-36 overflow-y-auto divide-y divide-border/50 custom-scrollbar">
              {eligibleListados.length > 0 ? (
                eligibleListados.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-cuadra-arena/20 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-2xs font-mono text-text-muted w-4 shrink-0 text-right">
                        {idx + 1}.
                      </span>
                      <span className="font-mono font-bold text-text-primary truncate">
                        {item.numeroListado}
                      </span>
                    </div>
                    <span className="text-2xs text-text-secondary font-medium shrink-0 ml-2">
                      {item.lineaProduccion?.nombre ?? ''}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-text-muted italic">
                  Ninguno de los listados seleccionados se encuentra listo para esta acción en {frenteConfig?.nombre ?? tipoFrente}.
                </div>
              )}
            </div>
          </div>

          {omittedCount > 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-500/10 border border-amber-300/60 rounded-md p-1.5 leading-tight">
              {omittedCount} listado{omittedCount > 1 ? 's fueron omitidos' : ' fue omitido'} porque su estado en {frenteConfig?.nombre ?? tipoFrente} ya avanzó o no está pendiente para esta acción.
            </p>
          )}

          {/* Mensaje descriptivo conciso según acción */}
          {isSeparar && (
            <div className="space-y-3">
              <p className="text-xs text-text-secondary leading-relaxed">
                ¿Confirmas marcar <strong>{frenteConfig?.nombre ?? tipoFrente}</strong> como separados en almacén para los listados elegibles?
              </p>

              {/* Checkbox compacto y proporcionado */}
              <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-app-surface hover:bg-cuadra-arena/20 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={entregarTambien}
                  onChange={(e) => setEntregarTambien(e.target.checked)}
                  disabled={isSubmitting || count === 0}
                  className="rounded border-border text-brand-primary focus:ring-brand-primary h-4 w-4 shrink-0 cursor-pointer"
                />
                <span className="text-xs text-text-primary font-medium">
                  Marcar también como entregados a producción
                </span>
              </label>
            </div>
          )}

          {isEntregar && (
            <p className="text-xs text-text-secondary leading-relaxed">
              ¿Confirmas la entrega a producción de <strong>{frenteConfig?.nombre ?? tipoFrente}</strong>? Los listados seleccionados quedarán disponibles para validación de Auditoría.
            </p>
          )}

          {isDescontar && (
            <p className="text-xs text-text-secondary leading-relaxed">
              ¿Confirmas el descuento en sistema de <strong>{frenteConfig?.nombre ?? tipoFrente}</strong> para los listados elegibles?
            </p>
          )}
        </ModalBody>

        <ModalFooter className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant={isDescontar ? 'outline' : 'primary'}
            size="sm"
            onClick={handleConfirm}
            disabled={isSubmitting || count === 0}
            className={
              isDescontar
                ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600 gap-1.5'
                : isEntregar || entregarTambien
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5'
                : 'gap-1.5'
            }
          >
            {isSubmitting ? (
              <>
                <Spinner size="xs" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <Icon
                  name={isDescontar ? 'done_all' : isEntregar || entregarTambien ? 'local_shipping' : 'check'}
                  size="14px"
                  weight={700}
                />
                <span>
                  {isDescontar
                    ? `Descontar en sistema (${count})`
                    : isEntregar || entregarTambien
                    ? `Entregar a producción (${count})`
                    : `Separar (${count})`}
                </span>
              </>
            )}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
