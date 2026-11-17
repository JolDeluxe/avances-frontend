import { useState, useEffect, useMemo, useRef, type ReactNode, type FormEvent } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@/components/ui/icon';
import { valesApi } from '../api/vales-api';
import type {
  AreaVale,
  CreateValeInput,
  DepartamentoValeRef,
  SerieValeRef,
  UpdateValeInput,
  ValeItem,
} from '../types/vales.types';

export interface ValeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedItem: ValeItem) => void;
  series: SerieValeRef[];
  departamentosVale: DepartamentoValeRef[];
  onCatalogosChanged?: () => void;
  valeToEdit?: ValeItem | null;
}

/**
 * Obtiene la fecha local actual en formato YYYY-MM-DD (sin desfase UTC).
 */
function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Infiere automáticamente el área operativa cuando se registra una línea nueva
 * o una línea sin área fija asignada, sin exponer selectores de área en el modal.
 */
function inferirAreaPorNombreLinea(nombreLinea: string): AreaVale {
  const upper = nombreLinea.trim().toUpperCase();
  if (
    upper.startsWith('ACC') ||
    upper.startsWith('BIL') ||
    upper.startsWith('BOL') ||
    upper.startsWith('CHA') ||
    upper.startsWith('CIN')
  ) {
    return 'ACCESORIOS';
  }
  return 'BOTA';
}

/**
 * Modal de Creación y Edición de Vale de Material.
 */
export function ValeFormModal({
  isOpen,
  onClose,
  onSuccess,
  series,
  departamentosVale,
  onCatalogosChanged,
  valeToEdit,
}: ValeFormModalProps): ReactNode {
  const isEditing = Boolean(valeToEdit);

  // Modo Serie: seleccionar existente vs crear nueva serie
  const [modoNuevaSerie, setModoNuevaSerie] = useState(false);
  const [serieId, setSerieId] = useState<string>('');
  const [nuevaSerie, setNuevaSerie] = useState<string>('');

  // Folio
  const [folio, setFolio] = useState<string>('');

  // Modo Línea: seleccionar existente (con buscador integrado) vs crear nueva línea
  const [modoNuevaLinea, setModoNuevaLinea] = useState(false);
  const [departamentoValeId, setDepartamentoValeId] = useState<string>('');
  const [nuevaLinea, setNuevaLinea] = useState<string>('');
  const [isLineaOpen, setIsLineaOpen] = useState(false);
  const [lineaSearch, setLineaSearch] = useState('');
  const lineaSearchInputRef = useRef<HTMLInputElement>(null);

  // Fecha y Hora de solicitud (hora discreta)
  const [fechaSolicitud, setFechaSolicitud] = useState<string>('');
  const [tieneHoraSolicitud, setTieneHoraSolicitud] = useState<boolean>(false);
  const [horaSolicitud, setHoraSolicitud] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Línea seleccionada actualmente en el catálogo
  const selectedLinea = useMemo(() => {
    if (modoNuevaLinea || !departamentoValeId) return null;
    return departamentosVale.find((d) => d.id === Number(departamentoValeId)) ?? null;
  }, [modoNuevaLinea, departamentoValeId, departamentosVale]);

  // Filtrado de líneas por el buscador integrado
  const lineasFiltradas = useMemo(() => {
    const q = lineaSearch.trim().toUpperCase();
    if (!q) return departamentosVale;
    return departamentosVale.filter((d) => d.nombre.toUpperCase().includes(q));
  }, [departamentosVale, lineaSearch]);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setModoNuevaSerie(false);
    setNuevaSerie('');
    setModoNuevaLinea(false);
    setNuevaLinea('');
    setIsLineaOpen(false);
    setLineaSearch('');

    if (valeToEdit) {
      setSerieId(String(valeToEdit.serieId));
      setFolio(valeToEdit.folio);
      setDepartamentoValeId(String(valeToEdit.departamentoValeId));
      setFechaSolicitud(valeToEdit.fechaSolicitud ? valeToEdit.fechaSolicitud.slice(0, 10) : '');
      const rawIso = valeToEdit.fechaSolicitud ?? '';
      const horaExtraida =
        valeToEdit.horaSolicitud ??
        (valeToEdit.tieneHoraSolicitud && rawIso.includes('T') ? rawIso.slice(11, 16) : '');
      const hasHora = Boolean(valeToEdit.tieneHoraSolicitud && horaExtraida);
      setTieneHoraSolicitud(hasHora);
      setHoraSolicitud(hasHora ? horaExtraida : '');
    } else {
      setSerieId(series.length === 1 ? String(series[0].id) : '');
      setFolio('');
      setDepartamentoValeId('');
      setFechaSolicitud(getTodayDateString());
      setTieneHoraSolicitud(false);
      setHoraSolicitud('');
    }
  }, [isOpen, valeToEdit, series]);

  useEffect(() => {
    if (isLineaOpen) {
      setTimeout(() => {
        lineaSearchInputRef.current?.focus();
      }, 30);
    }
  }, [isLineaOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Validar Serie
    if (modoNuevaSerie) {
      const code = nuevaSerie.trim().toUpperCase();
      if (!code) {
        setError('Debes ingresar el código de la nueva serie.');
        return;
      }
      if (!/^[A-Z0-9_ -]+$/.test(code)) {
        setError('La serie solo puede contener letras, números y guiones.');
        return;
      }
    } else if (!serieId) {
      setError('Debes seleccionar una serie.');
      return;
    }

    // 2. Validar Folio
    const folioClean = folio.trim().toUpperCase();
    if (!folioClean) {
      setError('Debes ingresar el folio del vale.');
      return;
    }
    if (!/^[A-Z0-9_/-]+$/.test(folioClean)) {
      setError('El folio solo puede contener letras, números y guiones.');
      return;
    }

    // 3. Validar Línea
    if (modoNuevaLinea) {
      if (nuevaLinea.trim().length < 2) {
        setError('El nombre de la nueva línea debe tener al menos 2 caracteres.');
        return;
      }
    } else if (!departamentoValeId) {
      setError('Debes seleccionar una línea.');
      return;
    }

    // 4. Validar Fecha y Hora
    if (!fechaSolicitud) {
      setError('Debes ingresar la fecha de solicitud.');
      return;
    }

    if (tieneHoraSolicitud && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(horaSolicitud.trim())) {
      setError('Ingresa una hora válida (HH:mm) o quita el campo de hora.');
      return;
    }

    // Resolver área automáticamente si es nueva línea o requiereSeleccionArea
    const autoArea: AreaVale | undefined = modoNuevaLinea
      ? inferirAreaPorNombreLinea(nuevaLinea)
      : selectedLinea?.requiereSeleccionArea
        ? valeToEdit?.area ?? inferirAreaPorNombreLinea(selectedLinea.nombre)
        : undefined;

    setIsSubmitting(true);
    try {
      let savedItem: ValeItem;
      const createdNewCatalogItem = modoNuevaSerie || modoNuevaLinea;

      if (isEditing && valeToEdit) {
        const updatePayload: UpdateValeInput = {
          ...(modoNuevaSerie
            ? { nuevaSerie: nuevaSerie.trim().toUpperCase() }
            : { serieId: Number(serieId) }),
          folio: folioClean,
          ...(modoNuevaLinea
            ? { nuevoDepartamento: nuevaLinea.trim().toUpperCase() }
            : { departamentoValeId: Number(departamentoValeId) }),
          ...(autoArea ? { area: autoArea } : {}),
          fechaSolicitud,
          tieneHoraSolicitud,
          horaSolicitud: tieneHoraSolicitud ? horaSolicitud.trim() : null,
        };
        savedItem = await valesApi.updateVale(valeToEdit.id, updatePayload);
      } else {
        const createPayload: CreateValeInput = {
          ...(modoNuevaSerie
            ? { nuevaSerie: nuevaSerie.trim().toUpperCase() }
            : { serieId: Number(serieId) }),
          folio: folioClean,
          ...(modoNuevaLinea
            ? { nuevoDepartamento: nuevaLinea.trim().toUpperCase() }
            : { departamentoValeId: Number(departamentoValeId) }),
          ...(autoArea ? { area: autoArea } : {}),
          fechaSolicitud,
          tieneHoraSolicitud,
          ...(tieneHoraSolicitud && horaSolicitud.trim()
            ? { horaSolicitud: horaSolicitud.trim() }
            : {}),
        };
        savedItem = await valesApi.createVale(createPayload);
      }

      if (createdNewCatalogItem && onCatalogosChanged) {
        onCatalogosChanged();
      }
      onSuccess(savedItem);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el vale.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
      <ModalHeader title={isEditing ? 'Editar Vale' : 'Nuevo Vale'} onClose={onClose} />

      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        className="flex flex-col flex-1 overflow-hidden"
      >
        <ModalBody className="space-y-4">
          {/* Fila 1: Serie + Folio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="serieId">Serie</Label>
                <button
                  type="button"
                  onClick={() => {
                    setModoNuevaSerie((v) => !v);
                    setError(null);
                  }}
                  className="text-[11px] font-normal text-text-muted/80 hover:text-text-primary transition-colors cursor-pointer"
                >
                  {modoNuevaSerie ? 'Usar existente' : '+ Nueva serie'}
                </button>
              </div>

              {modoNuevaSerie ? (
                <Input
                  id="nuevaSerie"
                  type="text"
                  placeholder="Ej. KABTM"
                  value={nuevaSerie}
                  onChange={(e) => setNuevaSerie(e.target.value.toUpperCase())}
                  maxLength={20}
                  disabled={isSubmitting}
                  className="font-mono uppercase"
                />
              ) : (
                <Select
                  id="serieId"
                  value={serieId}
                  onChange={(e) => setSerieId(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">Selecciona serie...</option>
                  {series.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.codigo}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="folio">Folio</Label>
              <Input
                id="folio"
                type="text"
                placeholder="Ej. 00145"
                value={folio}
                onChange={(e) => setFolio(e.target.value.toUpperCase())}
                maxLength={30}
                disabled={isSubmitting}
                className="font-mono uppercase"
              />
            </div>
          </div>

          {/* Fila 2: Línea con buscador integrado 100% adaptado dentro del modal */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="lineaSelect">Línea</Label>
              <button
                type="button"
                onClick={() => {
                  setModoNuevaLinea((v) => !v);
                  setIsLineaOpen(false);
                  setError(null);
                }}
                className="text-[11px] font-normal text-text-muted/80 hover:text-text-primary transition-colors cursor-pointer"
              >
                {modoNuevaLinea ? 'Usar existente' : '+ Nueva línea'}
              </button>
            </div>

            {modoNuevaLinea ? (
              <Input
                id="nuevaLinea"
                type="text"
                placeholder="Nombre de la línea..."
                value={nuevaLinea}
                onChange={(e) => setNuevaLinea(e.target.value.toUpperCase())}
                maxLength={60}
                disabled={isSubmitting}
                className="uppercase"
              />
            ) : (
              <div className="w-full">
                {/* Botón disparador del select adaptable */}
                <button
                  id="lineaSelect"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsLineaOpen((prev) => !prev)}
                  className={`w-full h-10 px-3 rounded-lg border text-left text-sm flex items-center justify-between transition-colors cursor-pointer bg-app-surface ${
                    isLineaOpen
                      ? 'border-brand-primary ring-1 ring-brand-primary'
                      : 'border-border hover:border-border-strong'
                  }`}
                >
                  <span
                    className={`truncate ${
                      selectedLinea ? 'text-text-primary font-medium' : 'text-text-muted'
                    }`}
                  >
                    {selectedLinea ? selectedLinea.nombre : 'Selecciona una línea...'}
                  </span>
                  <Icon
                    name={isLineaOpen ? 'expand_less' : 'expand_more'}
                    size="sm"
                    className="text-text-muted shrink-0 ml-2"
                  />
                </button>

                {/* Panel desplegable integrado al flujo del modal (nunca se corta y se adapta 100%) */}
                {isLineaOpen && (
                  <div className="mt-1.5 w-full rounded-lg border border-border bg-app-surface shadow-xs overflow-hidden animate-in fade-in duration-100">
                    {/* Buscador interno */}
                    <div className="p-2 border-b border-border/70 bg-app-surface-muted/40">
                      <div className="relative flex items-center">
                        <Icon
                          name="search"
                          size="xs"
                          className="absolute left-2.5 text-text-muted pointer-events-none"
                        />
                        <input
                          ref={lineaSearchInputRef}
                          type="text"
                          value={lineaSearch}
                          onChange={(e) => setLineaSearch(e.target.value)}
                          placeholder="Buscar línea..."
                          className="w-full h-8 pl-8 pr-7 rounded-md border border-border bg-app-surface text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary"
                        />
                        {lineaSearch && (
                          <button
                            type="button"
                            onClick={() => setLineaSearch('')}
                            className="absolute right-2 text-text-muted hover:text-text-primary cursor-pointer"
                          >
                            <Icon name="close" size="12px" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Lista de líneas (únicamente el nombre de la línea) */}
                    <div className="max-h-40 overflow-y-auto divide-y divide-border/40 custom-scrollbar">
                      {lineasFiltradas.length > 0 ? (
                        lineasFiltradas.map((d) => {
                          const isSelected = Number(departamentoValeId) === d.id;
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                setDepartamentoValeId(String(d.id));
                                setIsLineaOpen(false);
                                setLineaSearch('');
                              }}
                              className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-brand-primary/10 text-brand-primary font-bold'
                                  : 'text-text-primary hover:bg-cuadra-arena/40'
                              }`}
                            >
                              <span className="truncate">{d.nombre}</span>
                              {isSelected && (
                                <Icon
                                  name="check"
                                  size="14px"
                                  className="text-brand-primary shrink-0 ml-2"
                                />
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-3 py-4 text-center text-xs text-text-muted">
                          No se encontraron líneas con &quot;{lineaSearch}&quot;
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fila 3: Fecha de Solicitud + Hora ultra discreta */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="fechaSolicitud">Fecha de Solicitud</Label>
              {!tieneHoraSolicitud && (
                <button
                  type="button"
                  onClick={() => {
                    setTieneHoraSolicitud(true);
                    if (!horaSolicitud) {
                      const now = new Date();
                      const hh = String(now.getHours()).padStart(2, '0');
                      const mm = String(now.getMinutes()).padStart(2, '0');
                      setHoraSolicitud(`${hh}:${mm}`);
                    }
                  }}
                  className="text-[11px] font-normal text-text-muted/75 hover:text-text-secondary transition-colors cursor-pointer"
                >
                  + Agregar hora
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  id="fechaSolicitud"
                  type="date"
                  value={fechaSolicitud}
                  onChange={(e) => setFechaSolicitud(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {tieneHoraSolicitud && (
                <div className="flex items-center gap-1 shrink-0">
                  <Input
                    id="horaSolicitud"
                    type="time"
                    value={horaSolicitud}
                    onChange={(e) => setHoraSolicitud(e.target.value)}
                    disabled={isSubmitting}
                    className="w-28 font-mono text-xs"
                    title="Hora de solicitud"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setTieneHoraSolicitud(false);
                      setHoraSolicitud('');
                    }}
                    disabled={isSubmitting}
                    className="h-8 w-7 rounded-md inline-flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-cuadra-arena/50 transition-colors cursor-pointer"
                    title="Quitar hora"
                  >
                    <Icon name="close" size="xs" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Error de API */}
          {error && (
            <p className="text-xs text-danger font-medium bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </ModalBody>

        <ModalFooter className="flex items-center justify-end gap-3">
          <Button type="button" variant="cancelar" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="guardar" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner size="18px" className="mr-2" />
                Guardando...
              </>
            ) : isEditing ? (
              'Actualizar Vale'
            ) : (
              'Crear Vale'
            )}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
