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
  onSuccess: (savedItem: ValeItem | ValeItem[]) => void;
  series: SerieValeRef[];
  departamentosVale: DepartamentoValeRef[];
  onCatalogosChanged?: () => void;
  valeToEdit?: ValeItem | null;
}

type ModoRegistro = 'INDIVIDUAL' | 'MULTIPLE';

interface ValeCarritoItem {
  id: string;
  payload: CreateValeInput;
  serieLabel: string;
  lineaLabel: string;
  areaLabel?: AreaVale;
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
 * Modal de Creación y Edición de Vale de Material.
 * Soporta modo Individual y modo "Varios a la vez" (Carrito de captura rápida).
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
  const isValeDescontado = Boolean(isEditing && valeToEdit && valeToEdit.estado === 'DESCONTADO');
  const isValeCancelado = Boolean(isEditing && valeToEdit && valeToEdit.estado === 'CANCELADO');
  const isBloqueadoParaEdicion = isValeDescontado || isValeCancelado;

  // Modo de registro: Individual vs Varios a la vez
  const [modoRegistro, setModoRegistro] = useState<ModoRegistro>('INDIVIDUAL');

  // Carrito de vales en modo múltiple
  const [carrito, setCarrito] = useState<ValeCarritoItem[]>([]);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);

  // Protección contra descarte accidental
  const [showConfirmDescartar, setShowConfirmDescartar] = useState(false);
  const [guardandoProgreso, setGuardandoProgreso] = useState<{ actual: number; total: number } | null>(null);

  // Modo Serie: seleccionar existente vs crear nueva serie
  const [modoNuevaSerie, setModoNuevaSerie] = useState(false);
  const [serieId, setSerieId] = useState<string>('');
  const [nuevaSerie, setNuevaSerie] = useState<string>('');

  // Folio
  const [folio, setFolio] = useState<string>('');
  const folioInputRef = useRef<HTMLInputElement>(null);

  // Modo Línea: seleccionar existente (con buscador integrado) vs crear nueva línea
  const [modoNuevaLinea, setModoNuevaLinea] = useState(false);
  const [departamentoValeId, setDepartamentoValeId] = useState<string>('');
  const [nuevaLinea, setNuevaLinea] = useState<string>('');
  const [isLineaOpen, setIsLineaOpen] = useState(false);
  const [lineaSearch, setLineaSearch] = useState('');
  const [areaSeleccionada, setAreaSeleccionada] = useState<AreaVale | null>(null);
  const lineaSearchInputRef = useRef<HTMLInputElement>(null);

  // Fecha y Hora de solicitud (hora discreta)
  const [fechaSolicitud, setFechaSolicitud] = useState<string>('');
  const [tieneHoraSolicitud, setTieneHoraSolicitud] = useState<boolean>(false);
  const [horaSolicitud, setHoraSolicitud] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFormDisabled = isSubmitting || isBloqueadoParaEdicion;

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

  // Inicialización y limpieza al abrir / cambiar modo
  useEffect(() => {
    if (!isOpen) {
      setCarrito([]);
      setEditingCartItemId(null);
      setModoRegistro('INDIVIDUAL');
      setShowConfirmDescartar(false);
      setGuardandoProgreso(null);
      return;
    }

    setError(null);
    setModoNuevaSerie(false);
    setNuevaSerie('');
    setModoNuevaLinea(false);
    setNuevaLinea('');
    setIsLineaOpen(false);
    setLineaSearch('');

    if (valeToEdit) {
      setModoRegistro('INDIVIDUAL');
      setSerieId(String(valeToEdit.serieId));
      setFolio(valeToEdit.folio);
      setDepartamentoValeId(String(valeToEdit.departamentoValeId));
      setAreaSeleccionada(valeToEdit.area ?? null);
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
      setAreaSeleccionada(null);
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

  // Manejo de cierre seguro con interceptor si hay elementos en el carrito
  const handleRequestClose = () => {
    if (modoRegistro === 'MULTIPLE' && carrito.length > 0) {
      setShowConfirmDescartar(true);
      return;
    }
    onClose();
  };

  // Cambio de modo con confirmación si se perderían datos
  const handleCambiarModo = (nuevoModo: ModoRegistro) => {
    if (nuevoModo === modoRegistro) return;
    if (nuevoModo === 'INDIVIDUAL' && carrito.length > 0) {
      setShowConfirmDescartar(true);
      return;
    }
    setModoRegistro(nuevoModo);
    setError(null);
  };

  // Validador común de datos del formulario
  const validarCamposActuales = ():
    | {
        valid: true;
        payload: CreateValeInput;
        serieLabel: string;
        lineaLabel: string;
        areaLabel?: AreaVale;
      }
    | { valid: false; error: string } => {
    // 1. Serie
    let serieLabel = '';
    if (modoNuevaSerie) {
      const code = nuevaSerie.trim().toUpperCase();
      if (!code) {
        return { valid: false, error: 'Debes ingresar el código de la nueva serie.' };
      }
      if (!/^[A-Z0-9_ -]+$/.test(code)) {
        return { valid: false, error: 'La serie solo puede contener letras, números y guiones.' };
      }
      serieLabel = code;
    } else if (!serieId) {
      return { valid: false, error: 'Debes seleccionar una serie.' };
    } else {
      serieLabel = series.find((s) => s.id === Number(serieId))?.codigo || 'SERIE';
    }

    // 2. Folio
    const folioClean = folio.trim().toUpperCase();
    if (!folioClean) {
      return { valid: false, error: 'Debes ingresar el folio del vale.' };
    }
    if (!/^[A-Z0-9_/-]+$/.test(folioClean)) {
      return { valid: false, error: 'El folio solo puede contener letras, números y guiones.' };
    }

    // 3. Línea
    let lineaLabel = '';
    if (modoNuevaLinea) {
      const lineName = nuevaLinea.trim().toUpperCase();
      if (lineName.length < 2) {
        return { valid: false, error: 'El nombre de la nueva línea debe tener al menos 2 caracteres.' };
      }
      lineaLabel = lineName;
    } else if (!departamentoValeId) {
      return { valid: false, error: 'Debes seleccionar una línea.' };
    } else {
      lineaLabel = selectedLinea?.nombre || 'LÍNEA';
    }

    // 4. Fecha y Hora
    if (!fechaSolicitud) {
      return { valid: false, error: 'Debes ingresar la fecha de solicitud.' };
    }

    if (tieneHoraSolicitud && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(horaSolicitud.trim())) {
      return { valid: false, error: 'Ingresa una hora válida (HH:mm) o quita el campo de hora.' };
    }

    // Determinar si el departamento requiere selección explícita de área
    const requiereSeleccionArea = Boolean(
      modoNuevaLinea ||
        selectedLinea?.requiereSeleccionArea ||
        (!selectedLinea?.areaFija && departamentoValeId)
    );

    let areaFinal: AreaVale | undefined;
    if (requiereSeleccionArea) {
      if (!areaSeleccionada) {
        return {
          valid: false,
          error: modoNuevaLinea
            ? 'Por favor selecciona el área (BOTA, ACCESORIOS u OTRO) para la nueva línea.'
            : `El departamento "${selectedLinea?.nombre || 'seleccionado'}" requiere indicar si corresponde a BOTA, ACCESORIOS u OTRO.`,
        };
      }
      areaFinal = areaSeleccionada;
    } else {
      areaFinal = selectedLinea?.areaFija ?? (valeToEdit?.area ? valeToEdit.area : undefined);
    }

    const createPayload: CreateValeInput = {
      ...(modoNuevaSerie
        ? { nuevaSerie: nuevaSerie.trim().toUpperCase() }
        : { serieId: Number(serieId) }),
      folio: folioClean,
      ...(modoNuevaLinea
        ? { nuevoDepartamento: nuevaLinea.trim().toUpperCase() }
        : { departamentoValeId: Number(departamentoValeId) }),
      ...(areaFinal ? { area: areaFinal } : {}),
      fechaSolicitud,
      tieneHoraSolicitud,
      ...(tieneHoraSolicitud && horaSolicitud.trim() ? { horaSolicitud: horaSolicitud.trim() } : {}),
    };

    return {
      valid: true,
      payload: createPayload,
      serieLabel,
      lineaLabel,
      areaLabel: areaFinal,
    };
  };

  // Agregar al Carrito (Modo Múltiple)
  const handleAgregarAlCarrito = () => {
    setError(null);
    const validacion = validarCamposActuales();
    if (!validacion.valid) {
      setError(validacion.error);
      return;
    }

    // Verificar si ya existe en el carrito
    const existeEnCarrito = carrito.some(
      (item) =>
        item.serieLabel === validacion.serieLabel &&
        item.payload.folio.toUpperCase() === validacion.payload.folio.toUpperCase(),
    );

    if (existeEnCarrito) {
      setError(`Ya existe un vale con la serie ${validacion.serieLabel} y folio ${validacion.payload.folio} en la lista.`);
      return;
    }

    const nuevoItem: ValeCarritoItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      payload: validacion.payload,
      serieLabel: validacion.serieLabel,
      lineaLabel: validacion.lineaLabel,
      areaLabel: validacion.areaLabel,
    };

    setCarrito((prev) => [...prev, nuevoItem]);

    // Re-iniciar datos del vale para el siguiente registro (conservando fechaSolicitud)
    resetFormularioPreservandoFecha();
    setTimeout(() => {
      folioInputRef.current?.focus();
    }, 50);
  };

  // Re-iniciar campos del formulario preservando la fecha de solicitud
  const resetFormularioPreservandoFecha = () => {
    setFolio('');
    setSerieId(series.length === 1 ? String(series[0].id) : '');
    setModoNuevaSerie(false);
    setNuevaSerie('');
    setDepartamentoValeId('');
    setModoNuevaLinea(false);
    setNuevaLinea('');
    setIsLineaOpen(false);
    setLineaSearch('');
    setAreaSeleccionada(null);
    setTieneHoraSolicitud(false);
    setHoraSolicitud('');
  };

  // Cargar elemento del carrito para editarlo
  const handleEditarItem = (item: ValeCarritoItem) => {
    setError(null);
    setEditingCartItemId(item.id);

    if (item.payload.nuevaSerie) {
      setModoNuevaSerie(true);
      setNuevaSerie(item.payload.nuevaSerie);
      setSerieId('');
    } else {
      setModoNuevaSerie(false);
      setSerieId(item.payload.serieId ? String(item.payload.serieId) : '');
      setNuevaSerie('');
    }

    setFolio(item.payload.folio);

    if (item.payload.nuevoDepartamento) {
      setModoNuevaLinea(true);
      setNuevaLinea(item.payload.nuevoDepartamento);
      setDepartamentoValeId('');
    } else {
      setModoNuevaLinea(false);
      setDepartamentoValeId(item.payload.departamentoValeId ? String(item.payload.departamentoValeId) : '');
      setNuevaLinea('');
    }
    setAreaSeleccionada(item.payload.area ?? null);

    setFechaSolicitud(item.payload.fechaSolicitud);
    setTieneHoraSolicitud(Boolean(item.payload.tieneHoraSolicitud));
    setHoraSolicitud(item.payload.horaSolicitud || '');
  };

  // Guardar cambios del elemento editado en el carrito
  const handleActualizarEnCarrito = () => {
    if (!editingCartItemId) return;
    setError(null);

    const validacion = validarCamposActuales();
    if (!validacion.valid) {
      setError(validacion.error);
      return;
    }

    // Verificar si colisiona con otro elemento del carrito distinto a sí mismo
    const colision = carrito.some(
      (item) =>
        item.id !== editingCartItemId &&
        item.serieLabel === validacion.serieLabel &&
        item.payload.folio.toUpperCase() === validacion.payload.folio.toUpperCase(),
    );

    if (colision) {
      setError(`Ya existe otro vale con la serie ${validacion.serieLabel} y folio ${validacion.payload.folio} en la lista.`);
      return;
    }

    setCarrito((prev) =>
      prev.map((c) =>
        c.id === editingCartItemId
          ? {
              ...c,
              payload: validacion.payload,
              serieLabel: validacion.serieLabel,
              lineaLabel: validacion.lineaLabel,
              areaLabel: validacion.areaLabel,
            }
          : c,
      ),
    );

    setEditingCartItemId(null);
    resetFormularioPreservandoFecha();
  };

  // Cancelar edición de un elemento del carrito
  const handleCancelarEdicion = () => {
    setEditingCartItemId(null);
    resetFormularioPreservandoFecha();
    setError(null);
  };

  // Eliminar elemento del carrito
  const handleEliminarItem = (itemId: string) => {
    if (editingCartItemId === itemId) {
      setEditingCartItemId(null);
      resetFormularioPreservandoFecha();
    }
    setCarrito((prev) => prev.filter((item) => item.id !== itemId));
  };

  // Vaciar lista completa con confirmación interna
  const handleVaciarCarrito = () => {
    setCarrito([]);
    setEditingCartItemId(null);
    resetFormularioPreservandoFecha();
    setError(null);
  };

  // Guardar todos los vales del carrito (Submit múltiple)
  const handleGuardarCarrito = async () => {
    if (carrito.length === 0) return;
    setIsSubmitting(true);
    setError(null);

    let hubieronNuevosCatalogos = false;
    const itemsGuardados: ValeItem[] = [];
    const itemsPendientes = [...carrito];
    const itemsGuardadosIds: string[] = [];

    for (let i = 0; i < itemsPendientes.length; i++) {
      const item = itemsPendientes[i];
      setGuardandoProgreso({ actual: i + 1, total: itemsPendientes.length });

      try {
        const saved = await valesApi.createVale(item.payload);
        itemsGuardados.push(saved);
        itemsGuardadosIds.push(item.id);

        if (item.payload.nuevaSerie || item.payload.nuevoDepartamento) {
          hubieronNuevosCatalogos = true;
        }
      } catch (err) {
        // Remover del carrito los que ya se guardaron con éxito
        const restantes = itemsPendientes.filter((c) => !itemsGuardadosIds.includes(c.id));
        setCarrito(restantes);

        const msg = err instanceof Error ? err.message : 'Error al guardar el vale';
        setError(
          `Error al guardar vale "${item.payload.folio}": ${msg}. Los ${itemsGuardadosIds.length} vales anteriores ya se guardaron con éxito. Corrige este elemento para continuar.`,
        );
        setIsSubmitting(false);
        setGuardandoProgreso(null);

        if (hubieronNuevosCatalogos && onCatalogosChanged) {
          onCatalogosChanged();
        }
        return;
      }
    }

    // Todos se guardaron exitosamente
    setIsSubmitting(false);
    setGuardandoProgreso(null);
    setCarrito([]);

    if (hubieronNuevosCatalogos && onCatalogosChanged) {
      onCatalogosChanged();
    }
    if (itemsGuardados.length > 0) {
      onSuccess(itemsGuardados.length === 1 ? itemsGuardados[0] : itemsGuardados);
    }
    onClose();
  };

  // Submit modo individual (Guardar 1 solo vale)
  const handleSubmitIndividual = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const validacion = validarCamposActuales();
    if (!validacion.valid) {
      setError(validacion.error);
      return;
    }

    setIsSubmitting(true);
    try {
      let savedItem: ValeItem;
      const createdNewCatalogItem = modoNuevaSerie || modoNuevaLinea;

      if (isEditing && valeToEdit) {
        const updatePayload: UpdateValeInput = {
          ...(modoNuevaSerie
            ? { nuevaSerie: nuevaSerie.trim().toUpperCase() }
            : { serieId: Number(serieId) }),
          folio: validacion.payload.folio,
          ...(modoNuevaLinea
            ? { nuevoDepartamento: nuevaLinea.trim().toUpperCase() }
            : { departamentoValeId: Number(departamentoValeId) }),
          ...(validacion.areaLabel ? { area: validacion.areaLabel } : {}),
          fechaSolicitud,
          tieneHoraSolicitud,
          horaSolicitud: tieneHoraSolicitud ? horaSolicitud.trim() : null,
        };
        savedItem = await valesApi.updateVale(valeToEdit.id, updatePayload);
      } else {
        savedItem = await valesApi.createVale(validacion.payload);
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

  // Formulario de campos (reutilizado tanto en modo individual como múltiple)
  const renderCamposFormulario = () => (
    <div className="space-y-4">
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
              disabled={isFormDisabled}
              className="font-mono uppercase"
            />
          ) : (
            <Select
              id="serieId"
              value={serieId}
              onChange={(e) => setSerieId(e.target.value)}
              disabled={isFormDisabled}
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
            ref={folioInputRef}
            id="folio"
            type="text"
            placeholder="Ej. 00145"
            value={folio}
            onChange={(e) => setFolio(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && modoRegistro === 'MULTIPLE') {
                e.preventDefault();
                if (editingCartItemId) {
                  handleActualizarEnCarrito();
                } else {
                  handleAgregarAlCarrito();
                }
              }
            }}
            maxLength={30}
            disabled={isFormDisabled}
            className="font-mono uppercase"
          />
        </div>
      </div>

      {/* Fila 2: Línea con buscador integrado */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="lineaSelect">Línea</Label>
            {!modoNuevaLinea && selectedLinea?.areaFija && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-app-surface-muted text-text-secondary border border-border">
                Área: {selectedLinea.areaFija}
              </span>
            )}
          </div>
          {!isBloqueadoParaEdicion && (
            <button
              type="button"
              onClick={() => {
                setModoNuevaLinea((v) => {
                  const next = !v;
                  if (next) {
                    setAreaSeleccionada(null);
                  } else {
                    setAreaSeleccionada(selectedLinea?.areaFija ?? null);
                  }
                  return next;
                });
                setIsLineaOpen(false);
                setError(null);
              }}
              className="text-[11px] font-normal text-text-muted/80 hover:text-text-primary transition-colors cursor-pointer"
            >
              {modoNuevaLinea ? 'Usar existente' : '+ Nueva línea'}
            </button>
          )}
        </div>

        {modoNuevaLinea ? (
          <Input
            id="nuevaLinea"
            type="text"
            placeholder="Nombre de la línea..."
            value={nuevaLinea}
            onChange={(e) => setNuevaLinea(e.target.value.toUpperCase())}
            maxLength={60}
            disabled={isFormDisabled}
            className="uppercase"
          />
        ) : (
          <div className="w-full">
            <button
              id="lineaSelect"
              type="button"
              disabled={isFormDisabled}
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

            {isLineaOpen && (
              <div className="mt-1.5 w-full rounded-lg border border-border bg-app-surface shadow-xs overflow-hidden animate-in fade-in duration-100">
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
                            if (d.areaFija) {
                              setAreaSeleccionada(d.areaFija);
                            } else {
                              setAreaSeleccionada(
                                valeToEdit && valeToEdit.departamentoValeId === d.id
                                  ? (valeToEdit.area ?? null)
                                  : null,
                              );
                            }
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

      {/* Selector de Área condicional (para departamentos comodín como B7 o líneas nuevas) */}
      {(modoNuevaLinea || selectedLinea?.requiereSeleccionArea || (!selectedLinea?.areaFija && Boolean(departamentoValeId))) && (
        <div className="space-y-1.5 p-3 rounded-lg bg-cuadra-arena/40 border border-cuadra-marrone/20">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              <Icon name="category" size="14px" className="text-brand-primary" />
              Área <span className="text-status-error">*</span>
            </Label>
            <span className="text-[10px] text-text-muted">
              {modoNuevaLinea
                ? 'Indica a qué área pertenece la nueva línea'
                : `"${selectedLinea?.nombre}" requiere seleccionar su área`}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-0.5">
            {(['BOTA', 'ACCESORIOS', 'OTRO'] as const).map((area) => {
              const isSelected = areaSeleccionada === area;
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => setAreaSeleccionada(area)}
                  className={`py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-brand-primary text-white shadow-xs ring-2 ring-brand-primary/30'
                      : 'bg-app-surface text-text-secondary border border-border hover:bg-app-surface-muted hover:text-text-primary'
                  }`}
                >
                  {isSelected && <Icon name="check" size="13px" />}
                  <span>{area}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
              disabled={isFormDisabled}
            />
          </div>

          {tieneHoraSolicitud && (
            <div className="flex items-center gap-1 shrink-0">
              <Input
                id="horaSolicitud"
                type="time"
                value={horaSolicitud}
                onChange={(e) => setHoraSolicitud(e.target.value)}
                disabled={isFormDisabled}
                className="w-28 font-mono text-xs"
                title="Hora de solicitud"
              />
              <button
                type="button"
                onClick={() => {
                  setTieneHoraSolicitud(false);
                  setHoraSolicitud('');
                }}
                disabled={isFormDisabled}
                className="h-8 w-7 rounded-md inline-flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-cuadra-arena/50 transition-colors cursor-pointer"
                title="Quitar hora"
              >
                <Icon name="close" size="xs" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleRequestClose}
        className={modoRegistro === 'MULTIPLE' ? 'max-w-5xl' : 'max-w-lg'}
      >
        <ModalHeader
          title={
            isEditing
              ? 'Editar Vale'
              : modoRegistro === 'MULTIPLE'
                ? 'Registro de Vales'
                : 'Nuevo Vale'
          }
          onClose={handleRequestClose}
        />

        {/* Selector de Modo en la parte superior del modal */}
        {!isEditing && (
          <div className="flex items-center justify-between px-6 py-2.5 bg-cuadra-arena/30 border-b border-border/60">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Modo de captura
            </span>
            <div className="inline-flex rounded-lg p-0.5 bg-app-surface border border-border shadow-2xs">
              <button
                type="button"
                onClick={() => handleCambiarModo('INDIVIDUAL')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  modoRegistro === 'INDIVIDUAL'
                    ? 'bg-marca-primario text-white shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon name="description" size="14px" />
                Individual
              </button>
              <button
                type="button"
                onClick={() => handleCambiarModo('MULTIPLE')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  modoRegistro === 'MULTIPLE'
                    ? 'bg-marca-primario text-white shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon name="playlist_add" size="14px" />
                Varios a la vez
                {carrito.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-3xs font-mono bg-white text-marca-primario font-bold">
                    {carrito.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── MODO INDIVIDUAL ── */}
        {modoRegistro === 'INDIVIDUAL' && (
          <form
            onSubmit={handleSubmitIndividual}
            autoComplete="off"
            className="flex flex-col flex-1 overflow-hidden"
          >
            <ModalBody className="space-y-4">
              {isBloqueadoParaEdicion && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg border border-warning/30 bg-warning/10 text-warning-text text-xs">
                  <Icon name="lock" size="18px" className="mt-0.5 shrink-0 text-warning" />
                  <div className="space-y-1">
                    <p className="font-semibold text-warning-text">
                      {isValeCancelado ? 'Vale Cancelado' : 'Vale Finalizado (Descontado en Sistema)'}
                    </p>
                    <p className="text-2xs text-text-secondary leading-relaxed">
                      {isValeCancelado
                        ? 'No se pueden modificar los datos de un vale que ha sido cancelado.'
                        : 'Este vale ya fue descontado en el sistema en su totalidad. Para corregir o modificar sus datos, debe retroceder primero el descuento a PENDIENTE desde el módulo de Auditoría o Historial.'}
                    </p>
                  </div>
                </div>
              )}

              {renderCamposFormulario()}

              {error && (
                <p className="text-xs text-danger font-medium bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </ModalBody>

            <ModalFooter className="flex items-center justify-end gap-3">
              <Button type="button" variant="cancelar" onClick={handleRequestClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" variant="guardar" disabled={isSubmitting || isBloqueadoParaEdicion}>
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
        )}

        {/* ── MODO MÚLTIPLE (CARRITO) ── */}
        {modoRegistro === 'MULTIPLE' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <ModalBody className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 min-h-[400px]">
                {/* Columna Izquierda: Formulario de captura */}
                <div className="md:col-span-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-border/60 pb-5 md:pb-0 md:pr-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-border/40">
                      <span className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                        <Icon name="edit_note" size="16px" className="text-brand-primary" />
                        {editingCartItemId ? 'Modificar datos del vale' : 'Datos del vale'}
                      </span>

                      {editingCartItemId && (
                        <button
                          type="button"
                          onClick={handleCancelarEdicion}
                          className="text-2xs text-text-muted hover:text-danger cursor-pointer underline"
                        >
                          Cancelar edición
                        </button>
                      )}
                    </div>

                    {renderCamposFormulario()}

                    {error && (
                      <p className="text-xs text-danger font-medium bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
                        {error}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 mt-2">
                    <Button
                      type="button"
                      variant={editingCartItemId ? 'primary' : 'outline'}
                      onClick={editingCartItemId ? handleActualizarEnCarrito : handleAgregarAlCarrito}
                      className="w-full h-10 font-semibold"
                    >
                      <Icon
                        name={editingCartItemId ? 'check_circle' : 'add_circle'}
                        size="sm"
                        className="mr-1.5"
                      />
                      {editingCartItemId ? 'Actualizar en la lista' : 'Agregar a la lista'}
                    </Button>
                  </div>
                </div>

                {/* Columna Derecha: Lista acumulativa (Carrito) */}
                <div className="md:col-span-6 flex flex-col justify-between pl-0 md:pl-2">
                  <div className="space-y-2 flex flex-col flex-1">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                          <Icon name="shopping_cart" size="14px" className="text-brand-primary" />
                          Vales por registrar
                        </span>
                        <span className="text-3xs font-bold px-1.5 py-0.2 rounded-full bg-brand-primary/15 text-brand-primary font-mono">
                          {carrito.length}
                        </span>
                      </div>

                      {carrito.length > 0 && (
                        <button
                          type="button"
                          onClick={handleVaciarCarrito}
                          className="text-3xs text-text-muted/70 hover:text-danger cursor-pointer transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-danger/5"
                          title="Vaciar toda la lista"
                        >
                          <Icon name="delete_sweep" size="12px" />
                          Vaciar
                        </button>
                      )}
                    </div>

                    {/* Contenedor scrolleable de vales */}
                    <div className="flex-1 max-h-[380px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                      {carrito.length === 0 ? (
                        <div className="h-full min-h-[260px] flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-border/80 bg-cuadra-arena/10">
                          <div className="w-12 h-12 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center mb-3">
                            <Icon name="post_add" size="md" />
                          </div>
                          <p className="text-xs font-semibold text-text-primary">
                            La lista está vacía
                          </p>
                          <p className="text-2xs text-text-muted max-w-[240px] mt-1">
                            Captura los datos a la izquierda y presiona &quot;Agregar a la lista&quot; para acumular los vales.
                          </p>
                        </div>
                      ) : (
                        carrito.map((item, idx) => {
                          const isBeingEdited = editingCartItemId === item.id;
                          return (
                            <div
                              key={item.id}
                              className={`px-2.5 py-1.5 rounded-lg border transition-all text-xs ${
                                isBeingEdited
                                  ? 'bg-brand-primary/10 border-brand-primary ring-1 ring-brand-primary shadow-2xs'
                                  : 'bg-app-surface border-border hover:border-border-strong'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  {/* Fila 1: #, Serie · Folio, Área y Fecha */}
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-3xs font-mono font-bold px-1 py-0.2 rounded bg-cuadra-arena text-text-secondary shrink-0">
                                      #{idx + 1}
                                    </span>
                                    <span className="font-mono font-bold text-text-primary text-xs truncate">
                                      {item.serieLabel} · {item.payload.folio}
                                    </span>
                                    {item.areaLabel && (
                                      <span
                                        className={`text-3xs font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0 ${
                                          item.areaLabel === 'BOTA'
                                            ? 'bg-marca-primario/15 text-marca-primario'
                                            : 'bg-cuadra-oro/20 text-cuadra-oro'
                                        }`}
                                      >
                                        {item.areaLabel}
                                      </span>
                                    )}
                                    <span className="text-3xs text-text-muted font-mono ml-auto shrink-0 truncate">
                                      {item.payload.fechaSolicitud}
                                      {item.payload.tieneHoraSolicitud && item.payload.horaSolicitud && (
                                        <> · {item.payload.horaSolicitud}</>
                                      )}
                                    </span>
                                  </div>

                                  {/* Fila 2: Línea */}
                                  <p className="text-text-secondary truncate text-2xs leading-tight">
                                    {item.lineaLabel}
                                  </p>
                                </div>

                                {/* Acciones */}
                                <div className="flex items-center gap-0.5 shrink-0 pl-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditarItem(item)}
                                    title="Editar este vale"
                                    className="p-1 rounded text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-colors cursor-pointer"
                                  >
                                    <Icon name="edit" size="13px" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleEliminarItem(item.id)}
                                    title="Eliminar de la lista"
                                    className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                                  >
                                    <Icon name="delete" size="13px" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between border-t border-border/70 p-4">
              <div className="text-xs text-text-muted">
                {carrito.length > 0 ? (
                  <span>
                    Total acumulado:{' '}
                    <strong className="text-text-primary">
                      {carrito.length} vale{carrito.length === 1 ? '' : 's'}
                    </strong>
                  </span>
                ) : (
                  <span>Agrega vales a la lista para guardarlos en lote.</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button type="button" variant="cancelar" onClick={handleRequestClose} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="guardar"
                  onClick={handleGuardarCarrito}
                  disabled={carrito.length === 0 || isSubmitting}
                  className="min-w-36"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner size="18px" className="mr-2" />
                      {guardandoProgreso
                        ? `Guardando ${guardandoProgreso.actual}/${guardandoProgreso.total}...`
                        : 'Guardando...'}
                    </>
                  ) : (
                    <>
                      <Icon name="cloud_upload" size="sm" className="mr-1.5" />
                      Guardar todos ({carrito.length})
                    </>
                  )}
                </Button>
              </div>
            </ModalFooter>
          </div>
        )}
      </Modal>

      {/* Modal de confirmación para evitar pérdida accidental de datos */}
      {showConfirmDescartar && (
        <Modal
          isOpen={showConfirmDescartar}
          onClose={() => setShowConfirmDescartar(false)}
          className="max-w-md z-[110]"
        >
          <ModalHeader title="¿Descartar elementos?" onClose={() => setShowConfirmDescartar(false)} />
          <ModalBody className="py-4 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-2">
              <Icon name="warning" size="md" />
            </div>
            <p className="text-sm font-semibold text-text-primary">
              Tienes {carrito.length} vale{carrito.length === 1 ? '' : 's'} en la lista sin guardar.
            </p>
            <p className="text-xs text-text-muted">
              Si cierras la ventana ahora, se descartarán todos los vales que agregaste a la lista.
            </p>
          </ModalBody>
          <ModalFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDescartar(false)}>
              Continuar editando
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setShowConfirmDescartar(false);
                setCarrito([]);
                onClose();
              }}
            >
              Sí, descartar
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
