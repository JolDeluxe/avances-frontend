import { useState, useEffect, useMemo, type ReactNode, type FormEvent } from 'react';
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
  { id: 'BOTA', label: 'BOTA' },
  { id: 'ACCESORIOS', label: 'ACCESORIOS' },
  { id: 'OTRO', label: 'OTRO' },
];

/** Metadatos amigables para presentar permisos comprensibles al SUPER_ADMIN */
const PERMISOS_INFO: Record<string, { nombre: string; descripcion: string; categoria: string }> = {
  // Vales de materia prima
  'vale:ver': {
    nombre: 'Ver Vales',
    descripcion: 'Consultar tableros, vales pendientes, detalle e historial',
    categoria: 'Vales de Materia Prima',
  },
  'vale:crear': {
    nombre: 'Crear Vales',
    descripcion: 'Registrar nuevos vales de materia prima en el sistema',
    categoria: 'Vales de Materia Prima',
  },
  'vale:editar': {
    nombre: 'Editar Vales',
    descripcion: 'Modificar datos operativos de un vale mientras esté Pendiente',
    categoria: 'Vales de Materia Prima',
  },
  'vale:separar': {
    nombre: 'Separar Vales',
    descripcion: 'Confirmar separación de materiales del vale en almacén',
    categoria: 'Vales de Materia Prima',
  },
  'vale:entregar': {
    nombre: 'Entregar Vales',
    descripcion: 'Registrar entrega física de materiales al departamento solicitante',
    categoria: 'Vales de Materia Prima',
  },
  'vale:cancelar': {
    nombre: 'Cancelar Vales',
    descripcion: 'Anular un vale no entregado (Pendiente/Separado) con motivo obligatorio',
    categoria: 'Vales de Materia Prima',
  },
  'vale:descontar': {
    nombre: 'Descontar Vales',
    descripcion: 'Auditar y validar el descuento contable de inventario en ERP',
    categoria: 'Vales de Materia Prima',
  },
  'vale:retroceder': {
    nombre: 'Retroceder Operación de Vales',
    descripcion: 'Regresar un paso operativo (Entregado → Separado o Separado → Pendiente)',
    categoria: 'Vales de Materia Prima',
  },
  'vale:retroceder_descuento': {
    nombre: 'Revertir Descuento de Vales',
    descripcion: 'Reabrir un vale Descontado de vuelta a Entregado en auditoría',
    categoria: 'Vales de Materia Prima',
  },

  // Listados de producción
  'listado:ver': {
    nombre: 'Ver Listados',
    descripcion: 'Consultar tableros, listados de producción y frentes de surtido',
    categoria: 'Listados de Producción',
  },
  'listado:crear': {
    nombre: 'Crear Listados',
    descripcion: 'Registrar o cargar nuevos listados de producción para surtido',
    categoria: 'Listados de Producción',
  },
  'listado:editar': {
    nombre: 'Editar Listados',
    descripcion: 'Modificar datos de un listado mientras esté en estado Pendiente',
    categoria: 'Listados de Producción',
  },
  'listado:separar': {
    nombre: 'Separar Listados',
    descripcion: 'Marcar frentes de listado como separados físicamente en almacén',
    categoria: 'Listados de Producción',
  },
  'listado:entregar': {
    nombre: 'Entregar Listados',
    descripcion: 'Registrar la entrega de frentes a las líneas de producción',
    categoria: 'Listados de Producción',
  },
  'listado:cancelar': {
    nombre: 'Cancelar Listados',
    descripcion: 'Anular un listado operativo con justificación antes de su entrega',
    categoria: 'Listados de Producción',
  },
  'listado:retroceder': {
    nombre: 'Retroceder Listados',
    descripcion: 'Regresar frentes a un estado previo para correcciones con motivo',
    categoria: 'Listados de Producción',
  },
  'listado:descontar': {
    nombre: 'Descontar Listados',
    descripcion: 'Validar y registrar el descuento final de inventario en ERP',
    categoria: 'Listados de Producción',
  },

  // Usuarios y accesos
  'usuario:ver': {
    nombre: 'Ver Usuarios',
    descripcion: 'Consultar el catálogo de usuarios, fichas y estados',
    categoria: 'Usuarios y Seguridad',
  },
  'usuario:crear': {
    nombre: 'Crear Usuarios',
    descripcion: 'Dar de alta nuevos usuarios y colaboradores en el sistema',
    categoria: 'Usuarios y Seguridad',
  },
  'usuario:editar': {
    nombre: 'Editar Usuarios',
    descripcion: 'Modificar perfiles, roles, líneas y departamentos de usuarios',
    categoria: 'Usuarios y Seguridad',
  },
  'usuario:eliminar': {
    nombre: 'Desactivar Usuarios',
    descripcion: 'Suspender o dar de baja lógicamente cuentas de usuario',
    categoria: 'Usuarios y Seguridad',
  },
  'usuario:password:ver': {
    nombre: 'Revelar Contraseña',
    descripcion: 'Capacidad administrativa reversible para soporte de contraseñas',
    categoria: 'Usuarios y Seguridad',
  },

  // Catálogos y Sistema
  'departamento:ver': {
    nombre: 'Ver Catálogos',
    descripcion: 'Consultar departamentos y líneas de producción activas',
    categoria: 'Catálogos y Sistema',
  },
  'departamento:administrar': {
    nombre: 'Administrar Líneas / Maquilas',
    descripcion: 'Crear, editar y organizar líneas de producción y maquilas',
    categoria: 'Catálogos y Sistema',
  },
  'rol:ver': {
    nombre: 'Ver Roles',
    descripcion: 'Consultar roles y permisos base del sistema',
    categoria: 'Catálogos y Sistema',
  },
  'permiso:ver': {
    nombre: 'Ver Permisos',
    descripcion: 'Consultar la matriz de capacidades y permisos',
    categoria: 'Catálogos y Sistema',
  },
  'permiso:administrar': {
    nombre: 'Administrar Permisos',
    descripcion: 'Asignar o modificar excepciones avanzadas de permisos',
    categoria: 'Catálogos y Sistema',
  },
  'registro_sistema:ver': {
    nombre: 'Ver Bitácora de Auditoría',
    descripcion: 'Consultar el registro de eventos y auditoría del sistema',
    categoria: 'Catálogos y Sistema',
  },
};

const CATEGORIAS_ORDEN = [
  'Vales de Materia Prima',
  'Listados de Producción',
  'Usuarios y Seguridad',
  'Catálogos y Sistema',
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
  const [modoLineas, setModoLineas] = useState<'TODAS' | 'ESPECIFICAS'>('TODAS');

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
        if (user.lineasAsignadas && user.lineasAsignadas.length > 0) {
          const activeLinesIds = new Set(availableLines.map((l) => l.id));
          const filtered = user.lineasAsignadas
            .filter((l) => activeLinesIds.has(l.id))
            .map((l) => l.id);
          setLineasAsignadas(filtered);
          setModoLineas(filtered.length > 0 ? 'ESPECIFICAS' : 'TODAS');
        } else {
          setLineasAsignadas([]);
          setModoLineas('TODAS');
        }

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
        setModoLineas('TODAS');
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
    setAreasVale((prev) => {
      const isSelecting = !prev.includes(area);
      const nextAreas = isSelecting ? [...prev, area] : prev.filter((item) => item !== area);

      // Si se está activando un área completa, limpiar los departamentos individuales de esa área
      if (isSelecting) {
        setDepartamentosValeIds((prevDeptos) =>
          prevDeptos.filter((deptoId) => {
            const depto = availableDepartamentosVale.find((d) => d.id === deptoId);
            if (!depto) return true;
            if (area === 'BOTA' && depto.areaFija === 'BOTA') return false;
            if (area === 'ACCESORIOS' && depto.areaFija === 'ACCESORIOS') return false;
            if (
              area === 'OTRO' &&
              (depto.areaFija === 'OTRO' ||
                depto.requiereSeleccionArea ||
                (!depto.areaFija && depto.areaFija !== 'BOTA' && depto.areaFija !== 'ACCESORIOS'))
            ) {
              return false;
            }
            return true;
          }),
        );
      }

      return nextAreas;
    });
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
      const lineas = isAlmacenista ? (modoLineas === 'TODAS' ? [] : lineasValidas) : [];
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

  // Agrupar permisos por categorías comprensibles
  const permisosPorCategoria = useMemo(() => {
    const map: Record<string, PermisoSimple[]> = {};
    permisos.forEach((p) => {
      const meta = PERMISOS_INFO[p.codigo];
      const cat = meta?.categoria || (p.modulo ? p.modulo.toUpperCase() : 'Catálogos y Sistema');
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    });
    return map;
  }, [permisos]);

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
                  else if (r.codigo === 'VISUALIZADOR') label = 'Visualizador';

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
            <div className="space-y-2.5 p-3.5 bg-cuadra-arena/30 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Líneas de Producción (Listados)
                </Label>
                <span className="text-2xs text-text-muted">
                  {modoLineas === 'TODAS'
                    ? 'Acceso global (todas)'
                    : `${lineasAsignadas.length} seleccionada(s)`}
                </span>
              </div>

              {/* Selector de modo: Todas vs Específicas */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModoLineas('TODAS');
                    setLineasAsignadas([]);
                  }}
                  className={`py-1.5 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer text-center ${
                    modoLineas === 'TODAS'
                      ? 'bg-marca-primario/10 border-marca-primario/30 text-marca-primario font-semibold'
                      : 'bg-app-surface border-border text-text-secondary hover:bg-app-surface-muted'
                  }`}
                >
                  Todas las líneas
                </button>
                <button
                  type="button"
                  onClick={() => setModoLineas('ESPECIFICAS')}
                  className={`py-1.5 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer text-center ${
                    modoLineas === 'ESPECIFICAS'
                      ? 'bg-marca-primario/10 border-marca-primario/30 text-marca-primario font-semibold'
                      : 'bg-app-surface border-border text-text-secondary hover:bg-app-surface-muted'
                  }`}
                >
                  Líneas específicas
                </button>
              </div>

              {modoLineas === 'TODAS' ? (
                <p className="text-2xs text-text-muted italic px-1">
                  Acceso sin restricción para surtir en todas las líneas de producción activas.
                </p>
              ) : availableLines.length > 0 ? (
                (() => {
                  const lineasBota = availableLines.filter((l) => l.area === 'BOTA');
                  const lineasAccesorios = availableLines.filter((l) => l.area !== 'BOTA');
                  const soloBolsas = frentesSurtido.length === 1 && frentesSurtido[0] === 'BOLSAS';

                  return (
                    <div className="space-y-2 pt-1 border-t border-border/50">
                      {lineasBota.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between pb-1">
                            <span className="text-3xs font-semibold uppercase tracking-wider text-text-secondary">
                              Área Bota
                            </span>
                            <span className="text-3xs text-text-muted">
                              {lineasBota.filter((l) => lineasAsignadas.includes(l.id)).length} / {lineasBota.length}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {lineasBota.map((linea) => {
                              const isChecked = lineasAsignadas.includes(linea.id);
                              const isBlocked = soloBolsas;
                              return (
                                <button
                                  key={linea.id}
                                  type="button"
                                  disabled={isBlocked}
                                  onClick={() => handleToggleLinea(linea.id)}
                                  className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                                    isBlocked
                                      ? 'opacity-40 cursor-not-allowed bg-app-surface border border-border text-text-muted'
                                      : isChecked
                                      ? 'bg-marca-primario/15 border border-marca-primario/30 text-marca-primario font-medium'
                                      : 'bg-app-surface border border-border text-text-secondary hover:bg-app-surface-muted'
                                  }`}
                                >
                                  {isChecked ? '✓ ' : ''}{linea.nombre}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {lineasAccesorios.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between pb-1 pt-1">
                            <span className="text-3xs font-semibold uppercase tracking-wider text-text-secondary">
                              Área Accesorios
                            </span>
                            <span className="text-3xs text-text-muted">
                              {lineasAccesorios.filter((l) => lineasAsignadas.includes(l.id)).length} / {lineasAccesorios.length}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {lineasAccesorios.map((linea) => {
                              const isChecked = lineasAsignadas.includes(linea.id);
                              return (
                                <button
                                  key={linea.id}
                                  type="button"
                                  onClick={() => handleToggleLinea(linea.id)}
                                  className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                                    isChecked
                                      ? 'bg-marca-primario/15 border border-marca-primario/30 text-marca-primario font-medium'
                                      : 'bg-app-surface border border-border text-text-secondary hover:bg-app-surface-muted'
                                  }`}
                                >
                                  {isChecked ? '✓ ' : ''}{linea.nombre}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <p className="text-xs text-text-muted italic">
                  No hay líneas de producción configuradas en este departamento.
                </p>
              )}
            </div>
          )}

          {/* Autorización de Vales para ALMACENISTA */}
          {isAlmacenista && (
            <div className="space-y-3 p-3.5 bg-cuadra-arena/30 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-text-primary uppercase tracking-wider block">
                  AUTORIZACIÓN DE VALES
                </Label>
                <span className="text-2xs font-mono text-text-muted shrink-0">
                  {areasVale.length} área(s) · {departamentosValeIds.length} depto(s)
                </span>
              </div>

              {/* 1. Áreas de Vales */}
              <div className="space-y-1.5">
                <span className="text-2xs font-semibold uppercase tracking-wider text-text-secondary block">
                  Áreas
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

              {/* 2. Departamentos Específicos: Selector Limpio + Chips */}
              {availableDepartamentosVale.length > 0 && (() => {
                const showBota = !areasVale.includes('BOTA');
                const showAcc = !areasVale.includes('ACCESORIOS');
                const showOtro = !areasVale.includes('OTRO');

                // Si todas las áreas están seleccionadas, las áreas cubren todo
                if (!showBota && !showAcc && !showOtro) {
                  return (
                    <p className="text-2xs text-text-muted italic pt-1 border-t border-border/50">
                      Todas las áreas de vales seleccionadas (acceso total a departamentos).
                    </p>
                  );
                }

                // Deptos que aún pueden ser asignados individualmente
                const eligibleDeptos = availableDepartamentosVale.filter((d) => {
                  const isBota = d.areaFija === 'BOTA';
                  const isAcc = d.areaFija === 'ACCESORIOS';
                  const isOtro =
                    d.areaFija === 'OTRO' ||
                    d.requiereSeleccionArea ||
                    (!d.areaFija && d.areaFija !== 'BOTA');
                  if (isBota && !showBota) return false;
                  if (isAcc && !showAcc) return false;
                  if (isOtro && !showOtro) return false;
                  return true;
                });

                const deptosBota = eligibleDeptos.filter((d) => d.areaFija === 'BOTA');
                const deptosAccYOtros = eligibleDeptos.filter((d) => d.areaFija !== 'BOTA');

                const selectedDeptos = availableDepartamentosVale.filter((d) =>
                  departamentosValeIds.includes(d.id),
                );

                const handleSelectDepto = (e: React.ChangeEvent<HTMLSelectElement>) => {
                  const val = Number(e.target.value);
                  if (val && !departamentosValeIds.includes(val)) {
                    setDepartamentosValeIds((prev) => [...prev, val]);
                  }
                  e.target.value = '';
                };

                const handleRemoveDepto = (id: number) => {
                  setDepartamentosValeIds((prev) => prev.filter((dId) => dId !== id));
                };

                return (
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-semibold uppercase tracking-wider text-text-secondary block">
                        Departamentos Específicos (Opcional)
                      </span>
                      {selectedDeptos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setDepartamentosValeIds([])}
                          className="text-3xs text-danger hover:underline cursor-pointer"
                        >
                          Quitar todos ({selectedDeptos.length})
                        </button>
                      )}
                    </div>

                    {/* Selector desplegable limpio */}
                    <div className="relative">
                      <select
                        value=""
                        onChange={handleSelectDepto}
                        className="w-full h-9 px-3 text-xs bg-app-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-marca-primario/30 cursor-pointer"
                      >
                        <option value="">+ Seleccionar departamento para autorizar...</option>
                        {deptosBota.length > 0 && (
                          <optgroup label="Área BOTA">
                            {deptosBota.map((d) => (
                              <option
                                key={d.id}
                                value={d.id}
                                disabled={departamentosValeIds.includes(d.id)}
                              >
                                {departamentosValeIds.includes(d.id) ? '✓ ' : ''}{d.nombre}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {deptosAccYOtros.length > 0 && (
                          <optgroup label="Área ACCESORIOS / OTROS">
                            {deptosAccYOtros.map((d) => (
                              <option
                                key={d.id}
                                value={d.id}
                                disabled={departamentosValeIds.includes(d.id)}
                              >
                                {departamentosValeIds.includes(d.id) ? '✓ ' : ''}{d.nombre}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {/* Chips de departamentos seleccionados */}
                    {selectedDeptos.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {selectedDeptos.map((d) => (
                          <span
                            key={d.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-app-surface border border-border text-text-primary shadow-2xs"
                          >
                            <span>{d.nombre}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveDepto(d.id)}
                              className="text-text-muted hover:text-danger text-xs font-bold leading-none cursor-pointer p-0.5"
                              title={`Quitar ${d.nombre}`}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-2xs text-text-muted italic">
                        Sin departamentos individuales asignados (acceso regido por las áreas de arriba).
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Permisos Efectivos por Usuario (Exclusivo para SUPER_ADMIN) */}
          {isSuperAdminUser && permisos.length > 0 && selectedRole?.codigo !== 'SUPER_ADMIN' && (
            <div className="rounded-xl border border-border bg-app-surface overflow-hidden">
              <button
                type="button"
                onClick={() => setShowExcepciones((prev) => !prev)}
                className="w-full px-3.5 py-2.5 bg-cuadra-arena/25 hover:bg-cuadra-arena/40 flex items-center justify-between text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Icon name="tune" size="xs" className="text-brand-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                    Permisos
                  </span>
                  {excepcionesCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-2xs font-mono font-bold bg-brand-primary text-white leading-none">
                      {excepcionesCount}
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
                <div className="p-3.5 space-y-4 border-t border-border/60 bg-app-surface/50">
                  <p className="text-[11px] text-text-muted">
                    Haz clic en una capacidad para otorgar un permiso adicional al rol (<span className="text-emerald-700 font-bold">+ Concedido</span>) o revocar uno heredado (<span className="text-danger font-bold line-through">− Denegado</span>).
                  </p>

                  <div className="space-y-4 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                    {CATEGORIAS_ORDEN.filter((cat) => permisosPorCategoria[cat]?.length).map((cat) => {
                      const items = permisosPorCategoria[cat] || [];
                      return (
                        <div key={cat} className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-text-secondary pb-1 border-b border-border/50">
                            <Icon
                              name={
                                cat.includes('Vales')
                                  ? 'receipt_long'
                                  : cat.includes('Listados')
                                  ? 'assignment'
                                  : cat.includes('Usuarios')
                                  ? 'group'
                                  : 'settings'
                              }
                              size="13px"
                              className="text-brand-primary"
                            />
                            <span>{cat}</span>
                            <span className="text-3xs text-text-muted ml-auto font-mono">
                              {items.filter((p) => {
                                const isBase = permisosBaseRol.has(p.codigo);
                                const exc = excepcionesMap[p.id];
                                return (isBase && exc !== 'DENEGAR') || exc === 'CONCEDER';
                              }).length} / {items.length} activos
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {items.map((permiso) => {
                              const info = PERMISOS_INFO[permiso.codigo];
                              const nombreAmigable = info?.nombre || permiso.nombre || permiso.codigo;
                              const descripcionAmigable = info?.descripcion || permiso.descripcion;
                              const isBase = permisosBaseRol.has(permiso.codigo);
                              const exc = excepcionesMap[permiso.id];
                              const isEffective = (isBase && exc !== 'DENEGAR') || exc === 'CONCEDER';

                              return (
                                <button
                                  key={permiso.id}
                                  type="button"
                                  onClick={() => handleCyclePermisoExcepcion(permiso, isBase)}
                                  className={`flex flex-col text-left p-2.5 rounded-xl border transition-all cursor-pointer select-none space-y-1 ${
                                    exc === 'CONCEDER'
                                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-100 shadow-2xs ring-1 ring-emerald-500/30'
                                      : exc === 'DENEGAR'
                                      ? 'bg-danger/10 border-danger/30 text-danger opacity-80 line-through'
                                      : isEffective
                                      ? 'bg-app-surface border-border/80 text-text-primary hover:border-brand-primary/50'
                                      : 'bg-app-surface/50 border-border/40 text-text-muted hover:border-border hover:text-text-secondary'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-1.5 w-full">
                                    <span className="text-xs font-bold text-text-primary leading-tight">
                                      {nombreAmigable}
                                    </span>
                                    <span
                                      className={`text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-full shrink-0 tracking-wide ${
                                        exc === 'CONCEDER'
                                          ? 'bg-emerald-600 text-white'
                                          : exc === 'DENEGAR'
                                          ? 'bg-danger text-white'
                                          : isBase
                                          ? 'bg-brand-primary/15 text-brand-primary'
                                          : 'bg-cuadra-arena text-text-muted border border-border/70'
                                      }`}
                                    >
                                      {exc === 'CONCEDER'
                                        ? '+ Concedido'
                                        : exc === 'DENEGAR'
                                        ? '− Denegado'
                                        : isBase
                                        ? 'Rol base'
                                        : 'Inactivo'}
                                    </span>
                                  </div>

                                  <p className="text-[11px] text-text-secondary leading-snug line-clamp-2">
                                    {descripcionAmigable}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
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
