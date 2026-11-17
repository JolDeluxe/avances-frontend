import { useState, useEffect, type ReactNode, type FormEvent } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { usersApi } from '../api/users-api';
import type {
  UsuarioItem,
  CreateUserInput,
  UpdateUserInput,
  RolSimple,
  DepartamentoSimple,
  LineaProduccionSimple,
  DepartamentoValeCatalogSimple,
  PermisoSimple,
  AreaValeAuth,
  AccionExcepcionPermiso,
} from '../types/users.types';

import { useAuth } from '@/features/auth/hooks/use-auth';

export interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UsuarioItem | null; // If null => create mode, else edit mode
  roles: RolSimple[];
  departamentos: DepartamentoSimple[];
  permisos?: PermisoSimple[];
  onSuccess: () => void;
}

const AREAS_VALE_OPTIONS: Array<{ id: AreaValeAuth; label: string }> = [
  { id: 'BOTA', label: 'Área Bota' },
  { id: 'ACCESORIOS', label: 'Área Accesorios' },
  { id: 'OTRO', label: 'Área Otro' },
];

export function UserFormModal({
  isOpen,
  onClose,
  user,
  roles,
  departamentos,
  permisos = [],
  onSuccess,
}: UserFormModalProps): ReactNode {
  const { currentUser } = useAuth();
  const isSuperAdminUser = currentUser?.rol === 'SUPER_ADMIN';

  // Si no es SUPER_ADMIN, excluir rigurosamente el rol SUPER_ADMIN de las opciones
  const availableRoles = isSuperAdminUser
    ? roles
    : roles.filter((r) => r.codigo !== 'SUPER_ADMIN');

  const isEditing = Boolean(user);

  const [nombre, setNombre] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rolId, setRolId] = useState<number>(0);
  const [departamentoId, setDepartamentoId] = useState<number | undefined>(undefined);
  const [frentesSurtido, setFrentesSurtido] = useState<string[]>([]);
  const [frentesAuditor, setFrentesAuditor] = useState<string[]>([]);
  const [lineasAsignadas, setLineasAsignadas] = useState<number[]>([]);

  // Alcance acumulativo del módulo VALES
  const [areasVale, setAreasVale] = useState<AreaValeAuth[]>([]);
  const [departamentosValeIds, setDepartamentosValeIds] = useState<number[]>([]);

  // Excepciones de permisos individuales (CONCEDER / DENEGAR)
  const [excepcionesMap, setExcepcionesMap] = useState<Record<number, AccionExcepcionPermiso>>({});
  const [showExcepciones, setShowExcepciones] = useState<boolean>(false);

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Available lines based on selected department
  const availableLines: (LineaProduccionSimple & { area?: string })[] = departamentoId
    ? departamentos.find((d) => d.id === departamentoId)?.lineasProduccion || []
    : departamentos.flatMap((d) => d.lineasProduccion || []);

  // Available departamentos operativos de Vales based on selected department
  const availableDepartamentosVale: DepartamentoValeCatalogSimple[] = departamentoId
    ? departamentos.find((d) => d.id === departamentoId)?.departamentosVale || []
    : departamentos.flatMap((d) => d.departamentosVale || []);

  const selectedRole = availableRoles.find((r) => r.id === rolId);
  const isAlmacenista = selectedRole?.codigo === 'ALMACENISTA';
  const isAuditor = selectedRole?.codigo === 'AUDITOR';

  // Sync form values on open / change user
  useEffect(() => {
    if (isOpen) {
      if (user) {
        setNombre(user.nombre);
        setPassword('');
        setRolId(user.rol.id);
        setDepartamentoId(user.departamento?.id);
        if (user.tipoSurtidoAlmacen) {
          const list = user.tipoSurtidoAlmacen.split(',').map((s) => s.trim().toUpperCase());
          if (list.includes('TODOS')) {
            setFrentesSurtido(['DIRECTOS', 'INDIRECTOS', 'BOLSAS']);
          } else {
            setFrentesSurtido(list.filter((s) => ['DIRECTOS', 'INDIRECTOS', 'BOLSAS'].includes(s)));
          }
        } else {
          setFrentesSurtido([]);
        }
        if (user.tipoMaterialAuditor) {
          const listAud = user.tipoMaterialAuditor.split(',').map((s) => s.trim().toUpperCase());
          if (listAud.includes('TODOS')) {
            setFrentesAuditor(['DIRECTOS', 'INDIRECTOS', 'BOLSAS']);
          } else {
            setFrentesAuditor(listAud.filter((s) => ['DIRECTOS', 'INDIRECTOS', 'BOLSAS'].includes(s)));
          }
        } else {
          setFrentesAuditor([]);
        }
        const activeLinesIds = new Set(availableLines.map((l) => l.id));
        setLineasAsignadas(
          user.lineasAsignadas
            ? user.lineasAsignadas.filter((l) => activeLinesIds.has(l.id)).map((l) => l.id)
            : [],
        );

        setAreasVale(user.areasVale ?? []);
        setDepartamentosValeIds(
          user.departamentosValeAsignados ? user.departamentosValeAsignados.map((d) => d.id) : [],
        );

        // Cargar detalle completo del usuario para hidratar excepciones de permisos si existen
        setExcepcionesMap({});
        setShowExcepciones(false);
        usersApi
          .getUserById(user.id)
          .then((res) => {
            if (res.success && res.data) {
              if (res.data.areasVale) setAreasVale(res.data.areasVale);
              if (res.data.departamentosValeAsignados) {
                setDepartamentosValeIds(res.data.departamentosValeAsignados.map((d) => d.id));
              }
              if (res.data.excepcionesPermiso && res.data.excepcionesPermiso.length > 0) {
                const map: Record<number, AccionExcepcionPermiso> = {};
                res.data.excepcionesPermiso.forEach((exc) => {
                  map[exc.permisoId] = exc.accion;
                });
                setExcepcionesMap(map);
                setShowExcepciones(true);
              }
            }
          })
          .catch(() => {
            // Silencioso: conserva datos base de la fila
          });
      } else {
        setNombre('');
        setPassword('');
        const defaultRol = availableRoles.find((r) => r.codigo !== 'SUPER_ADMIN') || availableRoles[0];
        setRolId(defaultRol?.id || 0);

        const defaultDeptoId = currentUser?.departamentoId || departamentos[0]?.id;
        setDepartamentoId(defaultDeptoId);

        if (defaultRol?.codigo === 'ALMACENISTA') {
          setFrentesSurtido(['DIRECTOS']);
          setFrentesAuditor([]);
        } else if (defaultRol?.codigo === 'AUDITOR') {
          setFrentesAuditor(['DIRECTOS', 'INDIRECTOS', 'BOLSAS']);
          setFrentesSurtido([]);
        } else {
          setFrentesSurtido([]);
          setFrentesAuditor([]);
        }
        setLineasAsignadas([]);
        setAreasVale([]);
        setDepartamentosValeIds([]);
        setExcepcionesMap({});
        setShowExcepciones(false);
      }
      setShowPassword(false);
      setIsSubmitting(false);
      setError(null);
    }
  }, [isOpen, user?.id]);

  const handleRoleChange = (newRolId: number) => {
    setRolId(newRolId);
    const newRole = roles.find((r) => r.id === newRolId);
    if (newRole?.codigo === 'ALMACENISTA') {
      if (frentesSurtido.length === 0) setFrentesSurtido(['DIRECTOS']);
      setFrentesAuditor([]);
    } else if (newRole?.codigo === 'AUDITOR') {
      if (frentesAuditor.length === 0) setFrentesAuditor(['DIRECTOS', 'INDIRECTOS', 'BOLSAS']);
      setFrentesSurtido([]);
    } else {
      setFrentesSurtido([]);
      setFrentesAuditor([]);
      setLineasAsignadas([]);
      setAreasVale([]);
      setDepartamentosValeIds([]);
    }
  };

  const handleToggleFrente = (frente: string) => {
    setFrentesSurtido((prev) => {
      const next = prev.includes(frente) ? prev.filter((f) => f !== frente) : [...prev, frente];
      if (next.length === 1 && next[0] === 'BOLSAS') {
        const lineasBotaIds = new Set(
          availableLines.filter((l) => l.area === 'BOTA').map((l) => l.id),
        );
        setLineasAsignadas((prevLineas) => prevLineas.filter((id) => !lineasBotaIds.has(id)));
      }
      return next;
    });
  };

  const handleToggleFrenteAuditor = (frente: string) => {
    setFrentesAuditor((prev) =>
      prev.includes(frente) ? prev.filter((f) => f !== frente) : [...prev, frente],
    );
  };

  const handleToggleLinea = (id: number) => {
    setLineasAsignadas((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleToggleAreaVale = (area: AreaValeAuth) => {
    setAreasVale((prev) =>
      prev.includes(area) ? prev.filter((item) => item !== area) : [...prev, area],
    );
  };

  const handleToggleDeptoVale = (id: number) => {
    setDepartamentosValeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleCyclePermisoExcepcion = (permiso: PermisoSimple, isBase: boolean) => {
    setExcepcionesMap((prev) => {
      const current = prev[permiso.id];
      const next = { ...prev };
      if (isBase) {
        // Si el rol ya lo incluye por defecto: alternar entre Heredado (undefined) y DENEGAR
        if (current === 'DENEGAR') {
          delete next[permiso.id];
        } else {
          next[permiso.id] = 'DENEGAR';
        }
      } else {
        // Si el rol NO lo incluye por defecto: alternar entre No asignado (undefined) y CONCEDER
        if (current === 'CONCEDER') {
          delete next[permiso.id];
        } else {
          next[permiso.id] = 'CONCEDER';
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (isAlmacenista && frentesSurtido.length === 0) {
      setError('Seleccione al menos un tipo de surtido.');
      setIsSubmitting(false);
      return;
    }

    if (isAuditor && frentesAuditor.length === 0) {
      setError('Seleccione al menos un tipo de material.');
      setIsSubmitting(false);
      return;
    }

    const soloBolsas = frentesSurtido.length === 1 && frentesSurtido[0] === 'BOLSAS';
    let lineasValidas = lineasAsignadas;
    if (isAlmacenista && soloBolsas) {
      const lineasBotaIds = new Set(
        availableLines.filter((l) => l.area === 'BOTA').map((l) => l.id),
      );
      lineasValidas = lineasAsignadas.filter((id) => !lineasBotaIds.has(id));
      if (lineasValidas.length !== lineasAsignadas.length) {
        setLineasAsignadas(lineasValidas);
      }
    }

    try {
      const lineas = isAlmacenista ? lineasValidas : [];
      const tipoSurtidoCalculado = isAlmacenista
        ? frentesSurtido.length === 3
          ? 'TODOS'
          : frentesSurtido.join(',')
        : null;

      const tipoMaterialAuditorCalculado = isAuditor
        ? frentesAuditor.length === 3
          ? 'TODOS'
          : frentesAuditor.join(',')
        : null;

      const activeDeptoValeIdsSet = new Set(availableDepartamentosVale.map((d) => d.id));
      const deptosValeValidos = isAlmacenista
        ? departamentosValeIds.filter((id) => activeDeptoValeIdsSet.has(id))
        : [];
      const areasValeValidas = isAlmacenista ? areasVale : [];

      const excepcionesArray = Object.entries(excepcionesMap).map(([permIdStr, accion]) => ({
        permisoId: Number(permIdStr),
        accion,
      }));

      if (isEditing && user) {
        const payload: UpdateUserInput = {
          nombre: nombre.trim(),
          rolId,
          departamentoId: departamentoId || undefined,
          tipoSurtidoAlmacen: tipoSurtidoCalculado,
          tipoMaterialAuditor: tipoMaterialAuditorCalculado,
          lineaProduccionIds: lineas,
          lineasAsignadas: lineas,
          areasVale: areasValeValidas,
          departamentosValeIds: deptosValeValidos,
          excepciones: excepcionesArray,
        };
        if (password && password.trim() !== '') {
          payload.password = password.trim();
        }

        const res = await usersApi.updateUser(user.id, payload);
        if (res.success) {
          onSuccess();
          onClose();
        } else {
          setError(res.message || 'Error al actualizar el usuario.');
        }
      } else {
        const payload: CreateUserInput = {
          nombre: nombre.trim(),
          password: password && password.trim() !== '' ? password.trim() : undefined,
          rolId,
          departamentoId: departamentoId || undefined,
          tipoSurtidoAlmacen: tipoSurtidoCalculado,
          tipoMaterialAuditor: tipoMaterialAuditorCalculado,
          lineaProduccionIds: lineas,
          lineasAsignadas: lineas,
          areasVale: areasValeValidas,
          departamentosValeIds: deptosValeValidos,
          excepciones: excepcionesArray.length > 0 ? excepcionesArray : undefined,
        };

        const res = await usersApi.createUser(payload);
        if (res.success) {
          onSuccess();
          onClose();
        } else {
          setError(res.message || 'Error al crear el usuario.');
        }
      }
    } catch (err: unknown) {
      const apiErr = err as { body?: { message?: string; errors?: Array<{ message: string }> } };
      if (apiErr?.body?.errors && Array.isArray(apiErr.body.errors)) {
        const det = apiErr.body.errors.map((e) => e.message).join('. ');
        setError(`${apiErr.body.message || 'Error de validación'}: ${det}`);
      } else if (apiErr?.body?.message) {
        setError(apiErr.body.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error inesperado al guardar usuario.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const permisosBaseRol = new Set(selectedRole?.permisosBase ?? []);
  const excepcionesCount = Object.keys(excepcionesMap).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-xl">
      <ModalHeader
        title={isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col flex-1 overflow-hidden">
        {/* Fake inputs to prevent browser autofill heuristics */}
        <input type="text" style={{ display: 'none' }} aria-hidden="true" />
        <input type="password" style={{ display: 'none' }} aria-hidden="true" />
        <ModalBody className="space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
          <p className="text-xs text-text-secondary -mt-2">
            {isEditing
              ? 'Modifica los datos del usuario, rol de permisos, departamento y segmentación operativa.'
              : 'Completa la información para dar de alta a un nuevo integrante del sistema.'}
          </p>

          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre Completo</Label>
            <Input
              id="nombre"
              name="user_fullname_field"
              type="text"
              required
              autoComplete="off"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          {/* Password (Optional on edit, mandatory on create) */}
          <div className="space-y-1.5">
            <Label htmlFor="password">
              {isEditing ? 'Contraseña (dejar en blanco para conservar)' : 'Contraseña'}
            </Label>

            <div className="relative">
              <Input
                id="password"
                name="user_password_field"
                autoComplete="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEditing ? '••••••••' : 'Mínimo 6 caracteres'}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted hover:text-text-primary transition-colors"
                title={showPassword ? 'Ocultar' : 'Mostrar'}
              >
                <Icon name={showPassword ? 'visibility_off' : 'visibility'} size="xs" />
              </button>
            </div>
          </div>

          {/* Role & Department Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rol">Rol del Sistema</Label>
              <Select
                id="rol"
                value={rolId}
                onChange={(e) => handleRoleChange(Number(e.target.value))}
                required
              >
                {availableRoles.map((r) => {
                  let label = r.nombre;
                  if (r.codigo === 'ADMIN') label = 'Administrador';
                  else if (r.codigo === 'REGISTRADOR') label = 'Registrador';
                  else if (r.codigo === 'ALMACENISTA') label = 'Almacenistas';
                  else if (r.codigo === 'AUDITOR') label = 'Auditor';
                  else if (r.codigo === 'SUPER_ADMIN') label = 'Super Admin';

                  return (
                    <option key={r.id} value={r.id}>
                      {label}
                    </option>
                  );
                })}
              </Select>
            </div>

            {/* Departamento solo se muestra si el usuario logueado es SUPER_ADMIN */}
            {isSuperAdminUser && (
              <div className="space-y-1.5">
                <Label htmlFor="departamento">Departamento</Label>
                <Select
                  id="departamento"
                  value={departamentoId || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDepartamentoId(val ? Number(val) : undefined);
                  }}
                  required
                >
                  <option value="">Seleccionar departamento...</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          {/* Segmentación para ALMACENISTA */}
          {isAlmacenista && (
            <div className="space-y-2 p-3.5 bg-cuadra-arena/30 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Tipo de Surtido Autorizado (Listados) *
                </Label>
                <span className="text-2xs text-text-muted">
                  {frentesSurtido.length} seleccionado(s)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'DIRECTOS', label: 'Directos' },
                  { id: 'INDIRECTOS', label: 'Indirectos' },
                  { id: 'BOLSAS', label: 'Bolsas' },
                ].map((frente) => {
                  const isChecked = frentesSurtido.includes(frente.id);
                  return (
                    <label
                      key={frente.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-marca-primario/10 border-marca-primario/30 text-marca-primario font-medium'
                          : 'bg-app-surface border-border text-text-secondary hover:bg-app-surface-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleFrente(frente.id)}
                        className="rounded border-border text-marca-primario focus:ring-marca-primario/25 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span>{frente.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Segmentación para AUDITOR */}
          {isAuditor && (
            <div className="space-y-2 p-3.5 bg-cuadra-arena/30 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Tipo de Material Autorizado *
                </Label>
                <span className="text-2xs text-text-muted">
                  {frentesAuditor.length} seleccionado(s)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'DIRECTOS', label: 'Directos' },
                  { id: 'INDIRECTOS', label: 'Indirectos' },
                  { id: 'BOLSAS', label: 'Bolsas' },
                ].map((frente) => {
                  const isChecked = frentesAuditor.includes(frente.id);
                  return (
                    <label
                      key={frente.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-marca-primario/10 border-marca-primario/30 text-marca-primario font-medium'
                          : 'bg-app-surface border-border text-text-secondary hover:bg-app-surface-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleFrenteAuditor(frente.id)}
                        className="rounded border-border text-marca-primario focus:ring-marca-primario/25 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span>{frente.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Líneas Asignadas solo para ALMACENISTA */}
          {isAlmacenista && (
            <div className="space-y-3 p-3.5 bg-cuadra-arena/30 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Líneas de Producción Autorizadas (Listados)
                </Label>
                <span className="text-2xs text-text-muted">
                  {lineasAsignadas.length} seleccionada(s)
                </span>
              </div>

              {availableLines.length > 0 ? (
                (() => {
                  const lineasBota = availableLines.filter((l) => l.area === 'BOTA');
                  const lineasAccesorios = availableLines.filter((l) => l.area !== 'BOTA');
                  const soloBolsas = frentesSurtido.length === 1 && frentesSurtido[0] === 'BOLSAS';

                  const renderLineItem = (linea: LineaProduccionSimple & { area?: string }) => {
                    const isChecked = lineasAsignadas.includes(linea.id);
                    const isBota = linea.area === 'BOTA';
                    const isBlockedForBolsas = soloBolsas && isBota;

                    return (
                      <label
                        key={linea.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs transition-colors ${
                          isBlockedForBolsas
                            ? 'opacity-40 cursor-not-allowed bg-app-surface border-border text-text-muted'
                            : isChecked
                              ? 'bg-marca-primario/10 border-marca-primario/30 text-marca-primario font-medium cursor-pointer'
                              : 'bg-app-surface border-border text-text-secondary hover:bg-app-surface-muted cursor-pointer'
                        }`}
                        title={
                          isBlockedForBolsas
                            ? 'Incompatible: Surtido exclusivo de BOLSAS no permite líneas de área BOTA'
                            : undefined
                        }
                      >
                        <input
                          type="checkbox"
                          checked={isChecked && !isBlockedForBolsas}
                          disabled={isBlockedForBolsas}
                          onChange={() => handleToggleLinea(linea.id)}
                          className="rounded border-border text-marca-primario focus:ring-marca-primario/25 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span className="truncate">{linea.nombre}</span>
                        {isBlockedForBolsas && (
                          <span className="ml-auto text-3xs font-mono text-danger">(BOTA)</span>
                        )}
                      </label>
                    );
                  };

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Columna 1: Área BOTA */}
                      <div className="p-2.5 rounded-lg border border-border/80 bg-app-surface/60 space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-border/60">
                          <span className="text-2xs font-semibold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-marca-primario inline-block"></span>
                            Área Bota
                          </span>
                          <span className="text-3xs text-text-muted">
                            {lineasBota.filter((l) => lineasAsignadas.includes(l.id)).length} / {lineasBota.length}
                          </span>
                        </div>
                        {lineasBota.length > 0 ? (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {lineasBota.map(renderLineItem)}
                          </div>
                        ) : (
                          <p className="text-2xs text-text-muted italic py-1">Sin líneas de Bota</p>
                        )}
                      </div>

                      {/* Columna 2: Área ACCESORIOS */}
                      <div className="p-2.5 rounded-lg border border-border/80 bg-app-surface/60 space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-border/60">
                          <span className="text-2xs font-semibold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cuadra-oro inline-block"></span>
                            Área Accesorios
                          </span>
                          <span className="text-3xs text-text-muted">
                            {lineasAccesorios.filter((l) => lineasAsignadas.includes(l.id)).length} / {lineasAccesorios.length}
                          </span>
                        </div>
                        {lineasAccesorios.length > 0 ? (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {lineasAccesorios.map(renderLineItem)}
                          </div>
                        ) : (
                          <p className="text-2xs text-text-muted italic py-1">Sin líneas de Accesorios</p>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <p className="text-xs text-text-muted italic">
                  {departamentoId
                    ? 'No hay líneas de producción configuradas en este departamento.'
                    : 'Selecciona un departamento para ver sus líneas de producción.'}
                </p>
              )}
            </div>
          )}

          {/* Alcance Acumulativo del Módulo VALES para ALMACENISTA */}
          {isAlmacenista && (
            <div className="space-y-3 p-3.5 bg-cuadra-arena/30 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold text-text-primary uppercase tracking-wider block">
                    Alcance Operativo de Vales (Acumulativo)
                  </Label>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Puedes autorizar áreas completas y/o departamentos individuales adicionales.
                  </p>
                </div>
                <span className="text-2xs font-mono text-text-muted shrink-0">
                  {areasVale.length} área(s) · {departamentosValeIds.length} depto(s)
                </span>
              </div>

              {/* 1. Áreas completas de Vales */}
              <div className="space-y-1.5">
                <span className="text-2xs font-semibold uppercase tracking-wider text-text-secondary block">
                  Áreas completas autorizadas
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {AREAS_VALE_OPTIONS.map((areaOpt) => {
                    const isChecked = areasVale.includes(areaOpt.id);
                    return (
                      <label
                        key={areaOpt.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-marca-primario/10 border-marca-primario/30 text-marca-primario font-medium'
                            : 'bg-app-surface border-border text-text-secondary hover:bg-app-surface-muted'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleAreaVale(areaOpt.id)}
                          className="rounded border-border text-marca-primario focus:ring-marca-primario/25 h-3.5 w-3.5 cursor-pointer"
                        />
                        <span>{areaOpt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 2. Departamentos Operativos Individuales de Vales */}
              {availableDepartamentosVale.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-text-secondary block">
                    Departamentos operativos específicos
                  </span>
                  {(() => {
                    const deptosBota = availableDepartamentosVale.filter((d) => d.areaFija === 'BOTA');
                    const deptosAcc = availableDepartamentosVale.filter(
                      (d) => d.areaFija === 'ACCESORIOS' || d.requiereSeleccionArea || d.areaFija === 'OTRO',
                    );

                    const renderDeptoItem = (depto: DepartamentoValeCatalogSimple) => {
                      const isChecked = departamentosValeIds.includes(depto.id);
                      return (
                        <label
                          key={depto.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-marca-primario/10 border-marca-primario/30 text-marca-primario font-medium'
                              : 'bg-app-surface border-border text-text-secondary hover:bg-app-surface-muted'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleDeptoVale(depto.id)}
                            className="rounded border-border text-marca-primario focus:ring-marca-primario/25 h-3.5 w-3.5 cursor-pointer"
                          />
                          <span className="truncate">{depto.nombre}</span>
                          {depto.requiereSeleccionArea && (
                            <span className="ml-auto text-3xs font-mono px-1 py-0.2 rounded bg-amber-500/15 text-amber-700">
                              Área por vale
                            </span>
                          )}
                        </label>
                      );
                    };

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-2.5 rounded-lg border border-border/80 bg-app-surface/60 space-y-2">
                          <div className="flex items-center justify-between pb-1 border-b border-border/60">
                            <span className="text-2xs font-semibold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-marca-primario inline-block"></span>
                              Deptos. Bota
                            </span>
                            <span className="text-3xs text-text-muted">
                              {deptosBota.filter((d) => departamentosValeIds.includes(d.id)).length} / {deptosBota.length}
                            </span>
                          </div>
                          {deptosBota.length > 0 ? (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                              {deptosBota.map(renderDeptoItem)}
                            </div>
                          ) : (
                            <p className="text-2xs text-text-muted italic py-1">Sin departamentos</p>
                          )}
                        </div>

                        <div className="p-2.5 rounded-lg border border-border/80 bg-app-surface/60 space-y-2">
                          <div className="flex items-center justify-between pb-1 border-b border-border/60">
                            <span className="text-2xs font-semibold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-cuadra-oro inline-block"></span>
                              Deptos. Accesorios / Otros
                            </span>
                            <span className="text-3xs text-text-muted">
                              {deptosAcc.filter((d) => departamentosValeIds.includes(d.id)).length} / {deptosAcc.length}
                            </span>
                          </div>
                          {deptosAcc.length > 0 ? (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                              {deptosAcc.map(renderDeptoItem)}
                            </div>
                          ) : (
                            <p className="text-2xs text-text-muted italic py-1">Sin departamentos</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Excepciones de Permisos Efectivos por Usuario */}
          {permisos.length > 0 && selectedRole?.codigo !== 'SUPER_ADMIN' && (
            <div className="rounded-xl border border-border bg-app-surface overflow-hidden">
              <button
                type="button"
                onClick={() => setShowExcepciones((prev) => !prev)}
                className="w-full px-3.5 py-2.5 bg-cuadra-arena/25 hover:bg-cuadra-arena/40 flex items-center justify-between text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Icon name="tune" size="xs" className="text-brand-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Permisos Efectivos y Excepciones
                  </span>
                  {excepcionesCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-2xs font-bold bg-brand-primary/15 text-brand-primary">
                      {excepcionesCount} excepción(es)
                    </span>
                  )}
                </div>
                <Icon
                  name={showExcepciones ? 'expand_less' : 'expand_more'}
                  size="sm"
                  className="text-text-muted"
                />
              </button>

              {showExcepciones && (
                <div className="p-3.5 space-y-3 border-t border-border/60">
                  <p className="text-[11px] text-text-muted">
                    Haz clic en un permiso para conceder un permiso adicional al rol o denegar uno heredado.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {permisos.map((permiso) => {
                      const isBase = permisosBaseRol.has(permiso.codigo);
                      const exc = excepcionesMap[permiso.id];
                      const isEffective = (isBase && exc !== 'DENEGAR') || exc === 'CONCEDER';

                      return (
                        <button
                          key={permiso.id}
                          type="button"
                          onClick={() => handleCyclePermisoExcepcion(permiso, isBase)}
                          className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                            exc === 'CONCEDER'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold'
                              : exc === 'DENEGAR'
                              ? 'bg-danger/10 border-danger/30 text-danger line-through'
                              : isEffective
                              ? 'bg-app-surface-muted/60 border-border text-text-primary'
                              : 'bg-app-surface border-border/60 text-text-muted hover:text-text-secondary'
                          }`}
                          title={permiso.descripcion}
                        >
                          <span className="font-mono text-[11px] truncate">{permiso.codigo}</span>
                          <span className="text-[10px] uppercase font-bold shrink-0">
                            {exc === 'CONCEDER'
                              ? '+ Concedido'
                              : exc === 'DENEGAR'
                              ? '− Denegado'
                              : isBase
                              ? 'Rol base'
                              : 'Inactivo'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-danger font-medium">{error}</p>}
        </ModalBody>

        {/* Form Actions */}
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
              'Actualizar Usuario'
            ) : (
              'Crear Usuario'
            )}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
