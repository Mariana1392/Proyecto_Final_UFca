import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { 
  Search, Plus, ChevronLeft, ChevronRight,
  Edit, Trash2, Mail, Phone, User, Users, Calendar, AlertTriangle,
  DollarSign, CreditCard, PartyPopper, TrendingUp, Clock, CheckCircle2,
  XCircle, Info, FileText, MapPin, History, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import MiPerfil from './MiPerfil';

import { supabase } from '../lib/supabase';
import { asociadosApi, ahorroPermanenteApi, ahorroVoluntarioApi, creditosApi, eventosApi } from '../lib/api';

interface AsociadosProps {
  onViewDetails: (id: string) => void;
  userRole?: 'admin' | 'asociado' | null;
  userData?: any;
}

export default function Asociados({ onViewDetails, userRole, userData }: AsociadosProps) {
  // ── All hooks must be declared unconditionally (React Rules of Hooks) ──────
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [deleteJustification, setDeleteJustification] = useState('');
  const [isToggleEstadoDialogOpen, setIsToggleEstadoDialogOpen] = useState(false);
  const [isReferidosDialogOpen, setIsReferidosDialogOpen] = useState(false);
  const [isDetalleDialogOpen, setIsDetalleDialogOpen] = useState(false);
  const [selectedAsociado, setSelectedAsociado] = useState<any>(null);
  const [detalleTab, setDetalleTab] = useState('info');
  const [filterEstado, setFilterEstado] = useState('');
  const [showAuditoria, setShowAuditoria] = useState(false);
  const [auditoriaFilter, setAuditoriaFilter] = useState<string>('all');
  const [showSearchSugg, setShowSearchSugg] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    nombre: '',
    cedula: '',
    telefono: '',
    email: '',
    direccion: '',
    fechaIngreso: ''
  });

  const [asociados, setAsociados] = useState<any[]>([]);
  const asociadosRef = useRef<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usuarioActualId, setUsuarioActualId] = useState<string | null>(null);
  const [usuarioActualNombre, setUsuarioActualNombre] = useState('Administrador');
  const [auditoriaGlobal, setAuditoriaGlobal] = useState<any[]>([]);
  const [auditoriaAsociado, setAuditoriaAsociado] = useState<any[]>([]);
  const [loadingAuditoria, setLoadingAuditoria] = useState(false);

  useEffect(() => {
    cargarAsociados();
  }, []);

  // Mantener ref sincronizada para usarla dentro de funciones async
  useEffect(() => {
    asociadosRef.current = asociados;
  }, [asociados]);

  // Cerrar sugerencias al hacer clic fuera del buscador
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchSugg(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Helper: mapear fila de auditoria a objeto UI ────────────────────────
  function mapearFilaAuditoria(r: any, asociadosActuales?: any[]) {
    // detalle puede ser objeto JSONB { descripcion, admin, fecha } o string legado
    let detalleStr = '—';
    let usuario = 'Sistema';
    if (r.detalle && typeof r.detalle === 'object') {
      detalleStr = r.detalle.descripcion || '—';
      usuario    = r.detalle.admin || 'Sistema';
    } else if (typeof r.detalle === 'string') {
      detalleStr = r.detalle;
      const match = r.detalle.match(/Por:\s*([^|]+)/);
      usuario = match ? match[1].trim() : 'Sistema';
    }
    // Buscar nombre del asociado en el estado local
    const asociadoLocal = (asociadosActuales || []).find((a: any) => a.id === r.registro_id);
    return {
      id:             r.id,
      registroId:     r.registro_id,
      fecha:          new Date(r.created_at).toLocaleString('es-CO'),
      accion:         r.accion,
      detalle:        detalleStr,
      usuario,
      asociadoNombre: asociadoLocal?.nombre || '(eliminado)',
      asociadoCedula: asociadoLocal?.cedula || '—',
      tipo:           r.accion.toLowerCase().includes('estado')    ? 'estado'
                    : r.accion.toLowerCase().includes('edic')       ? 'edicion'
                    : r.accion.toLowerCase().includes('elim')       ? 'eliminacion'
                    : 'creacion',
    };
  }

  // ── Helper: registrar en tabla auditoria ─────────────────────────────────
  async function registrarAuditoria(
    asociadoId: string,
    accion: string,
    descripcion: string,
    adminNombre: string,
    adminId?: string | null,
  ) {
    const { error } = await supabase.from('auditoria').insert({
      tabla:       'asociados',
      registro_id: asociadoId,
      usuario_id:  adminId ?? null,
      accion,
      detalle: {
        descripcion,
        admin: adminNombre,
        fecha: new Date().toISOString(),
      },
    });
    if (error) {
      toast.error('Error al guardar auditoría: ' + error.message);
    }
  }

  // ── Helper: cargar auditoría de un asociado desde la BD ──────────────────
  async function cargarAuditoriaAsociado(id: string) {
    setLoadingAuditoria(true);
    try {
      const { data, error } = await supabase
        .from('auditoria')
        .select('id, registro_id, accion, detalle, created_at')
        .eq('tabla', 'asociados')
        .eq('registro_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAuditoriaAsociado((data || []).map((r: any) => mapearFilaAuditoria(r)));
    } catch (err: any) {
      toast.error('Error al cargar historial: ' + err.message);
      setAuditoriaAsociado([]);
    } finally {
      setLoadingAuditoria(false);
    }
  }

  // ── Helper: cargar auditoría global de asociados desde la BD ─────────────
  async function cargarAuditoriaGlobal(asociadosSnap?: any[]) {
    try {
      // Sin JOIN para evitar errores de relación en PostgREST
      const { data, error } = await supabase
        .from('auditoria')
        .select('id, registro_id, accion, detalle, created_at')
        .eq('tabla', 'asociados')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      // Usa el snapshot pasado o el state actual (para llamadas posteriores)
      const snap = asociadosSnap ?? asociadosRef.current;
      setAuditoriaGlobal((data || []).map((r: any) => mapearFilaAuditoria(r, snap)));
    } catch (err: any) {
      toast.error('Error al cargar auditoría: ' + err.message);
    }
  }

  async function cargarAsociados() {
    try {
      setLoading(true);

      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUsuarioActualId(user.id);
        const { data: perfil } = await supabase
          .from('usuarios').select('nombre').eq('id', user.id).single();
        if (perfil?.nombre) setUsuarioActualNombre(perfil.nombre);
      }

      // Cargar asociados registrados
      const { data, error } = await supabase
        .from('asociados')
        .select(`
          *,
          ahorros(id, monto_ahorrado, cuota_mensual, fecha_inicio, estado, anulado, tipo),
          creditos(id, monto, saldo, cuota_mensual, fecha_desembolso, plazo_meses, estado, anulado),
          referidos:asociados!referido_por_id(id, nombre, cedula, fecha_ingreso, estado)
        `)
        .order('nombre');

      if (error) throw error;

      // Buscar usuarios con rol 'asociado' que no tienen asociado_id vinculado
      // y crearles automáticamente el registro en asociados
      const { data: usuariosSinAsociado } = await supabase
        .from('usuarios')
        .select('id, nombre, email, identificacion, activo')
        .is('asociado_id', null)
        .eq('activo', true)
        .in('rol_id',
          // Obtener el ID del rol asociado
          (await supabase.from('roles').select('id').eq('nombre', 'asociado')).data?.map((r: any) => r.id) || []
        );

      for (const usu of (usuariosSinAsociado || [])) {
        if (!usu.identificacion) continue;
        // Verificar si ya existe un asociado con esa cédula (evitar duplicado)
        const yaExiste = (data || []).some((a: any) => a.cedula === usu.identificacion);
        if (yaExiste) {
          // Solo vincular: actualizar asociado_id en usuarios
          const asociadoExistente = (data || []).find((a: any) => a.cedula === usu.identificacion);
          if (asociadoExistente) {
            await supabase.from('usuarios').update({ asociado_id: asociadoExistente.id }).eq('id', usu.id);
          }
          continue;
        }
        // Crear registro en asociados con los datos disponibles
        const { data: nuevoAsoc, error: insertErr } = await supabase
          .from('asociados')
          .insert({
            nombre:        usu.nombre,
            cedula:        usu.identificacion,
            email:         usu.email,
            telefono:      'Sin registro',
            direccion:     'Sin registro',
            fecha_ingreso: new Date().toISOString().split('T')[0],
            estado:        'activo',
          })
          .select('id')
          .single();
        if (!insertErr && nuevoAsoc) {
          // Vincular usuario con el nuevo asociado
          await supabase.from('usuarios').update({ asociado_id: nuevoAsoc.id }).eq('id', usu.id);
        }
      }

      // Recargar asociados después de crear los faltantes
      const { data: dataFinal, error: errorFinal } = await supabase
        .from('asociados')
        .select(`
          *,
          ahorros(id, monto_ahorrado, cuota_mensual, fecha_inicio, estado, anulado, tipo),
          creditos(id, monto, saldo, cuota_mensual, fecha_desembolso, plazo_meses, estado, anulado),
          referidos:asociados!referido_por_id(id, nombre, cedula, fecha_ingreso, estado)
        `)
        .order('nombre');

      if (errorFinal) throw errorFinal;
      // Usar los datos finales (con los nuevos asociados incluidos)
      const dataParaMapear = dataFinal || data || [];

      const asociadosMapeados = dataParaMapear.map((a: any) => ({
        id: a.id,
        nombre: a.nombre,
        cedula: a.cedula,
        telefono: a.telefono || '',
        email: a.email || '',
        direccion: a.direccion || '',
        modificadoPor: a.modificado_por || null,
        fechaModificacion: a.fecha_modificacion
          ? new Date(a.fecha_modificacion).toLocaleString('es-CO') : null,
        fechaCambioEstado: a.fecha_cambio_estado
          ? new Date(a.fecha_cambio_estado).toLocaleString('es-CO') : null,
        fechaIngreso: a.fecha_ingreso,
        // DB guarda 'activo'/'inactivo'/'suspendido'; internamente usamos boolean
        estado: a.estado === 'activo',
        tieneCreditos: (a.creditos || []).some((c: any) => !c.anulado && c.saldo > 0),
        referidos: (a.referidos || []).map((r: any) => ({
          nombre: r.nombre,
          cedula: r.cedula,
          fechaReferido: r.fecha_ingreso,
          estadoReferido: r.estado === 'activo' ? 'Aprobado' : 'Inactivo',
          bonificacion: 50000,
        })),
        ahorros: (a.ahorros || []).map((ah: any) => ({
          id: ah.id,
          tipo: ah.tipo === 'permanente' ? 'Ahorro Permanente' : 'Ahorro Voluntario',
          monto: ah.monto_ahorrado,
          saldo: ah.monto_ahorrado,
          fechaInicio: ah.fecha_inicio,
          estado: ah.anulado ? 'Anulado' : (ah.estado ? 'Activo' : 'Inactivo'),
        })),
        creditos: (a.creditos || []).map((c: any) => ({
          id: c.id,
          tipo: 'Crédito',
          monto: c.monto,
          saldo: c.saldo,
          saldoPendiente: c.saldo,
          cuota: c.cuota_mensual,
          fechaDesembolso: c.fecha_desembolso,
          plazo: `${c.plazo_meses} meses`,
          estado: c.anulado ? 'Anulado' : (c.estado ? 'Activo' : 'Inactivo'),
        })),
        eventos: [],
        totalAhorros: (a.ahorros || []).reduce((sum: number, ah: any) => sum + (ah.monto_ahorrado || 0), 0),
        totalCreditos: (a.creditos || [])
          .filter((c: any) => !c.anulado)
          .reduce((sum: number, c: any) => sum + (c.saldo || 0), 0),
        // Auditoria se carga por separado al abrir el detalle
        historialAuditoria: [],
      }));

      setAsociados(asociadosMapeados);
      // Cargar auditoría global pasando los asociados ya mapeados
      cargarAuditoriaGlobal(asociadosMapeados);
    } catch (error: any) {
      toast.error('Error al cargar asociados: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredAsociados = asociados.filter(asociado => {
    const term = searchTerm.toLowerCase();
    const matchSearch = !term ||
      asociado.nombre.toLowerCase().includes(term) ||
      asociado.cedula.includes(searchTerm) ||
      (asociado.email || '').toLowerCase().includes(term) ||
      (asociado.telefono || '').includes(searchTerm) ||
      (asociado.direccion || '').toLowerCase().includes(term);
    const matchEstado = !filterEstado ||
      (filterEstado === 'activo'   && asociado.estado  === true) ||
      (filterEstado === 'inactivo' && asociado.estado === false);
    return matchSearch && matchEstado;
  });

  const canDeleteAsociado = (asociado: any) => {
    if (asociado.estado) {
      return { canDelete: false, reason: '❌ No se puede eliminar: Asociado ACTIVO. Primero debe desactivarlo.' };
    }
    const tieneCreditosConSaldo = asociado.creditos?.some((c: any) => (c.saldoPendiente || 0) > 0);
    if (tieneCreditosConSaldo) {
      const n = asociado.creditos?.filter((c: any) => (c.saldoPendiente || 0) > 0).length;
      return { canDelete: false, reason: `❌ No se puede eliminar: Tiene ${n} crédito(s) con saldo pendiente.` };
    }
    const tieneAhorrosConSaldo = asociado.ahorros?.some((a: any) => (a.saldo || 0) > 0);
    if (tieneAhorrosConSaldo) {
      const total = asociado.ahorros?.filter((a: any) => (a.saldo || 0) > 0).reduce((s: number, a: any) => s + (a.saldo || 0), 0);
      return { canDelete: false, reason: `❌ No se puede eliminar: Tiene saldos en ahorro (${formatCurrency(total)}).` };
    }
    const tieneProductosActivos = asociado.creditos?.some((c: any) => c.estado === 'Activo') ||
                                  asociado.ahorros?.some((a: any) => a.estado === 'Activo');
    if (tieneProductosActivos) {
      return { canDelete: false, reason: '❌ No se puede eliminar: Tiene productos financieros activos.' };
    }
    return { canDelete: true, reason: '✅ Eliminar asociado permanentemente (Sin saldos ni productos activos)' };
  };

  const totalPages = Math.ceil(filteredAsociados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAsociados = filteredAsociados.slice(startIndex, endIndex);

  const handleToggleEstado = async (id: string) => {
    const asociado = asociados.find(a => a.id === id);
    if (!asociado) return;

    if (asociado.estado) {
      const tieneCreditosActivos = asociado.creditos?.some((c: any) => c.estado === 'Activo');
      const tieneAhorrosActivos = asociado.ahorros?.some((a: any) => a.estado === 'Activo');
      if (tieneCreditosActivos || tieneAhorrosActivos) {
        const advertencias = [];
        if (tieneCreditosActivos) advertencias.push('créditos activos');
        if (tieneAhorrosActivos) advertencias.push('cuentas de ahorro activas');
        toast.warning(`Advertencia: El asociado tiene ${advertencias.join(' y ')}`, {
          description: 'Aunque se puede desactivar, asegúrese de que todas las obligaciones estén resueltas.'
        });
      }
    }

    const nuevoEstado = !asociado.estado;
    const nuevoEstadoDB = nuevoEstado ? 'activo' : 'inactivo';
    const adminNombre = usuarioActualNombre || userData?.name || userData?.nombre || 'Administrador';
    const fechaCambioEstado = new Date().toLocaleString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    try {
      const { error: estadoErr } = await supabase.from('asociados').update({
        estado:              nuevoEstadoDB,
        fecha_cambio_estado: new Date().toISOString(),
        modificado_por:      adminNombre,
      }).eq('id', id);
      if (estadoErr) throw estadoErr;

      // Sincronizar estado en la tabla usuarios si existe un usuario vinculado a este asociado
      try {
        await supabase
          .from('usuarios')
          .update({ activo: nuevoEstado })
          .eq('asociado_id', id);
      } catch {
        // Si no hay usuario vinculado o falla la sincronización, no bloquear el flujo.
      }

      // Guardar en auditoría con usuario y fecha
      await registrarAuditoria(
        id,
        'CAMBIO DE ESTADO',
        `Estado cambiado de "${asociado.estado ? 'Activo' : 'Inactivo'}" a "${nuevoEstado ? 'Activo' : 'Inactivo'}" por ${adminNombre} el ${fechaCambioEstado}`,
        adminNombre,
        usuarioActualId,
      );

      setAsociados(prev => prev.map(a =>
        a.id === id ? {
          ...a,
          estado:            nuevoEstado,
          fechaCambioEstado: fechaCambioEstado,
          modificadoPor:     adminNombre,
        } : a
      ));

      // Refrescar auditoría si el detalle del asociado está abierto
      if (selectedAsociado?.id === id) {
        await cargarAuditoriaAsociado(id);
      }
      cargarAuditoriaGlobal();

      toast.success(`Asociado "${asociado.nombre}" ${nuevoEstado ? 'activado' : 'desactivado'} exitosamente`, {
        description: `Cambio registrado el ${fechaCambioEstado} por ${adminNombre}`
      });
    } catch (error: any) {
      toast.error('Error al cambiar estado: ' + error.message);
    }

    setIsToggleEstadoDialogOpen(false);
    setSelectedAsociado(null);
  };

  const handleCreateAsociado = async () => {
    if (!formData.nombre.trim()) { toast.error('Error: El nombre completo es obligatorio'); return; }
    if (!formData.cedula.trim()) { toast.error('Error: La cédula es obligatoria'); return; }
    if (!formData.email.trim()) { toast.error('Error: El email es obligatorio'); return; }
    if (!formData.telefono.trim()) { toast.error('Error: El teléfono es obligatorio'); return; }
    if (!formData.direccion.trim()) { toast.error('Error: La dirección es obligatoria'); return; }
    if (!formData.fechaIngreso) { toast.error('Error: La fecha de ingreso es obligatoria'); return; }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      toast.error('Error: El formato del email no es válido. Debe contener @ y un dominio válido.');
      return;
    }

    const cedulaDuplicada = asociados.some(a => a.cedula === formData.cedula.trim());
    if (cedulaDuplicada) {
      toast.error('Error: Identificación duplicada', {
        description: `Ya existe un asociado con la cédula "${formData.cedula}".`
      });
      return;
    }
    const emailDuplicado = asociados.some(a => a.email.toLowerCase() === formData.email.trim().toLowerCase());
    if (emailDuplicado) {
      toast.error('Error: Email duplicado', {
        description: `Ya existe un asociado con el email "${formData.email}".`
      });
      return;
    }

    const telefonoRegex = /^\+?[\d\s()-]{8,}$/;
    if (!telefonoRegex.test(formData.telefono.trim())) {
      toast.error('Error: El formato del teléfono no es válido. Debe contener al menos 8 dígitos.');
      return;
    }

    try {
      const nuevo = await asociadosApi.create({
        nombre:        formData.nombre.trim(),
        cedula:        formData.cedula.trim(),
        telefono:      formData.telefono.trim(),
        email:         formData.email.trim(),
        direccion:     formData.direccion.trim(),
        fecha_ingreso: formData.fechaIngreso,
        estado:        'activo',
      });

      const adminNombreCreate = usuarioActualNombre || userData?.name || 'Administrador';
      await registrarAuditoria(
        nuevo.id,
        'CREACIÓN',
        `Asociado "${nuevo.nombre}" (Cédula: ${nuevo.cedula}) registrado en el sistema por ${adminNombreCreate}`,
        adminNombreCreate,
        usuarioActualId,
      );

      const nuevoMapeado = {
        id: nuevo.id,
        nombre: nuevo.nombre,
        cedula: nuevo.cedula,
        telefono: nuevo.telefono || '',
        email: nuevo.email || '',
        direccion: nuevo.direccion || '',
        fechaIngreso: nuevo.fecha_ingreso,
        estado: true,
        tieneCreditos: false,
        referidos: [],
        ahorros: [],
        creditos: [],
        eventos: [],
        totalAhorros: 0,
        totalCreditos: 0,
        historialAuditoria: [],
      };

      setAsociados(prev => [...prev, nuevoMapeado]);
      cargarAuditoriaGlobal();
      setSearchTerm('');
      setCurrentPage(1);

      toast.success('✓ Asociado registrado exitosamente', {
        description: `${formData.nombre} ha sido registrado con estado ACTIVO.`
      });

      setIsCreateDialogOpen(false);
      setFormData({ nombre: '', cedula: '', telefono: '', email: '', direccion: '', fechaIngreso: '' });
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Error: Ya existe un asociado con esa cédula o email.');
      } else {
        toast.error('Error al crear asociado: ' + error.message);
      }
    }
  };

  const handleEditAsociado = async () => {
    if (!selectedAsociado) { toast.error('Error: No se ha seleccionado ningún asociado'); setIsEditDialogOpen(false); return; }
    if (!formData.email.trim()) { toast.error('❌ Error: El email es obligatorio'); return; }
    if (!formData.telefono.trim()) { toast.error('❌ Error: El teléfono es obligatorio'); return; }
    if (!formData.direccion.trim()) { toast.error('❌ Error: La dirección es obligatoria'); return; }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      toast.error('❌ Error: El formato del email no es válido.');
      return;
    }
    const emailDuplicado = asociados.some(a =>
      a.email.toLowerCase() === formData.email.trim().toLowerCase() && a.id !== selectedAsociado.id
    );
    if (emailDuplicado) {
      toast.error(`❌ Error: Ya existe otro asociado con el email "${formData.email}".`);
      return;
    }
    const telefonoRegex = /^\+?[\d\s()-]{8,}$/;
    if (!telefonoRegex.test(formData.telefono.trim())) {
      toast.error('❌ Error: El formato del teléfono no es válido.');
      return;
    }

    const cambios = [];
    if (selectedAsociado.email !== formData.email.trim())
      cambios.push(`Email: "${selectedAsociado.email}" → "${formData.email.trim()}"`);
    if (selectedAsociado.telefono !== formData.telefono.trim())
      cambios.push(`Teléfono: "${selectedAsociado.telefono}" → "${formData.telefono.trim()}"`);
    if (selectedAsociado.direccion !== formData.direccion.trim())
      cambios.push(`Dirección: "${selectedAsociado.direccion}" → "${formData.direccion.trim()}"`);

    if (cambios.length === 0) {
      toast.info('ℹ️ No se detectaron cambios', { description: 'Los datos son idénticos a los registrados.' });
      setIsEditDialogOpen(false);
      setSelectedAsociado(null);
      return;
    }

    const fechaModificacion = new Date().toLocaleString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const adminNombreEdit = usuarioActualNombre || userData?.name || 'Administrador';

    try {
      const { error: editErr } = await supabase.from('asociados').update({
        telefono:           formData.telefono.trim(),
        email:              formData.email.trim(),
        direccion:          formData.direccion.trim(),
        modificado_por:     adminNombreEdit,
        fecha_modificacion: new Date().toISOString(),
      }).eq('id', selectedAsociado.id);
      if (editErr) throw editErr;

      // Sincronizar datos hacia la tabla usuarios si existe un usuario vinculado
      await supabase.from('usuarios').update({
        email:    formData.email.trim(),
        telefono: formData.telefono.trim(),
        direccion: formData.direccion.trim(),
      }).eq('asociado_id', selectedAsociado.id);

      await registrarAuditoria(
        selectedAsociado.id,
        'EDICIÓN',
        `Datos actualizados por ${adminNombreEdit} el ${fechaModificacion}: ${cambios.join(' | ')}`,
        adminNombreEdit,
        usuarioActualId,
      );

      setAsociados(prev => prev.map(a =>
        a.id === selectedAsociado.id
          ? {
              ...a,
              telefono:          formData.telefono.trim(),
              email:             formData.email.trim(),
              direccion:         formData.direccion.trim(),
              modificadoPor:     adminNombreEdit,
              fechaModificacion: fechaModificacion,
            }
          : a
      ));

      // Refrescar auditoría si el detalle está abierto
      if (selectedAsociado?.id) {
        await cargarAuditoriaAsociado(selectedAsociado.id);
      }
      cargarAuditoriaGlobal();

      toast.success('✅ Información de contacto actualizada', {
        description: `Datos de "${selectedAsociado.nombre}" actualizados el ${fechaModificacion} por ${adminNombreEdit}`
      });
    } catch (error: any) {
      toast.error('Error al actualizar asociado: ' + error.message);
    }

    setIsEditDialogOpen(false);
    setSelectedAsociado(null);
  };

  const handleDeleteAsociado = () => {
    const asociado = selectedAsociado;
    if (asociado.estado) {
      toast.error('❌ Eliminación NO Permitida', { description: 'No se puede eliminar un asociado ACTIVO.' });
      setIsDeleteDialogOpen(false); setSelectedAsociado(null); return;
    }
    const tieneCreditosConSaldo = asociado.creditos?.some((c: any) => (c.saldoPendiente || 0) > 0);
    if (tieneCreditosConSaldo) {
      const n = asociado.creditos?.filter((c: any) => (c.saldoPendiente || 0) > 0).length;
      toast.error('❌ Eliminación NO Permitida - Créditos Pendientes', {
        description: `El asociado tiene ${n} crédito(s) con saldo pendiente.`, duration: 5000
      });
      setIsDeleteDialogOpen(false); setSelectedAsociado(null); return;
    }
    const tieneAhorrosConSaldo = asociado.ahorros?.some((a: any) => (a.saldo || 0) > 0);
    if (tieneAhorrosConSaldo) {
      const total = asociado.ahorros?.filter((a: any) => (a.saldo || 0) > 0).reduce((s: number, a: any) => s + (a.saldo || 0), 0);
      toast.error('❌ Eliminación NO Permitida - Saldos en Ahorro', {
        description: `El asociado tiene saldo total de ${formatCurrency(total)}.`, duration: 5000
      });
      setIsDeleteDialogOpen(false); setSelectedAsociado(null); return;
    }
    const tieneProductosActivos = asociado.creditos?.some((c: any) => c.estado === 'Activo') ||
                                  asociado.ahorros?.some((a: any) => a.estado === 'Activo');
    if (tieneProductosActivos) {
      toast.error('❌ Eliminación NO Permitida - Productos Activos', {
        description: 'Debe cerrar TODOS los productos antes de eliminar.', duration: 5000
      });
      setIsDeleteDialogOpen(false); setSelectedAsociado(null); return;
    }
    setIsDeleteDialogOpen(false);
    setIsDeleteConfirmDialogOpen(true);
  };

  const handleConfirmDeleteAsociado = async () => {
    if (!deleteJustification.trim()) {
      toast.error('❌ Justificación Obligatoria', { description: 'Debe proporcionar una justificación.' });
      return;
    }
    if (deleteJustification.trim().length < 20) {
      toast.error('❌ Justificación Muy Corta', { description: 'La justificación debe tener al menos 20 caracteres.' });
      return;
    }

    const asociado = selectedAsociado;
    const adminNombreDelete = usuarioActualNombre || userData?.name || 'Administrador';
    const fechaEliminacion = new Date().toLocaleString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    try {
      // Guardar auditoría ANTES de eliminar (la FK se pondrá NULL luego por ON DELETE SET NULL)
      await registrarAuditoria(
        asociado.id,
        'ELIMINACIÓN PERMANENTE',
        `Asociado "${asociado.nombre}" (Cédula: ${asociado.cedula}) eliminado permanentemente por ${adminNombreDelete} el ${fechaEliminacion}. Justificación: ${deleteJustification.trim()}`,
        adminNombreDelete,
        usuarioActualId,
      );

      // Buscar el usuario vinculado a este asociado ANTES de eliminar el asociado
      const { data: usuarioVinculado } = await supabase
        .from('usuarios')
        .select('id')
        .eq('asociado_id', asociado.id)
        .maybeSingle();

      // Eliminar el registro de asociados
      await asociadosApi.delete(asociado.id);

      // Si había un usuario vinculado, eliminarlo también de usuarios y de Auth
      if (usuarioVinculado?.id) {
        await supabase.from('usuarios').delete().eq('id', usuarioVinculado.id);
        try {
          await supabase.rpc('eliminar_usuario_auth', { user_id: usuarioVinculado.id });
        } catch {
          // Si la función Auth falla, el registro de usuarios ya fue eliminado
        }
      }

      setAsociados(prev => prev.filter(a => a.id !== asociado.id));
      cargarAuditoriaGlobal();

      toast.success('🗑️ Asociado Eliminado Permanentemente', {
        description: `"${asociado.nombre}" ha sido eliminado del sistema el ${fechaEliminacion}${usuarioVinculado ? ' junto con su cuenta de usuario' : ''}.`
      });
    } catch (error: any) {
      toast.error('Error al eliminar asociado: ' + error.message);
    }

    setIsDeleteConfirmDialogOpen(false);
    setDeleteJustification('');
    setSelectedAsociado(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const getAllAuditoriaRecords = () => auditoriaGlobal;

  // ── Vista asociado: solo su perfil personal ──────────────────────────────
  if (userRole === 'asociado') {
    return <MiPerfil userData={userData} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando asociados...</p>
        </div>
      </div>
    );
  }

  const filteredAuditoriaRecords = getAllAuditoriaRecords().filter(record => {
    if (auditoriaFilter === 'all') return true;
    return record.registroId === auditoriaFilter;
  });

  const getEstadoBadgeColor = (estado: string) => {
    switch (estado) {
      case 'Aprobado':
        return 'bg-emerald-100 text-emerald-700';
      case 'En proceso':
        return 'bg-yellow-100 text-yellow-700';
      case 'Rechazado':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">Gestión de Asociados</h1>
            <p className="text-slate-600">Administra la información de los asociados del fondo</p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline"
              className={`gap-2 ${showAuditoria ? 'bg-slate-100' : ''}`}
              onClick={() => setShowAuditoria(!showAuditoria)}
            >
              <History className="size-4" />
              {showAuditoria ? 'Ocultar' : 'Ver'} Auditoría
              {showAuditoria ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
            <Button 
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setFormData({
                  nombre: '',
                  cedula: '',
                  telefono: '',
                  email: '',
                  direccion: '',
                  fechaIngreso: ''
                });
                setIsCreateDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              Nuevo asociado
            </Button>
          </div>
        </div>

        {/* Layout de dos columnas */}
        <div className={`grid gap-6 transition-all duration-300 ${showAuditoria ? 'grid-cols-[1fr,400px]' : 'grid-cols-1'}`}>
          {/* Columna Principal: Lista de Asociados */}
          <div>
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                <div>
                  <CardTitle>Lista de Asociados</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    {filteredAsociados.length} asociado(s) encontrado(s)
                    {(filterEstado || searchTerm) && (
                      <button
                        onClick={() => { setFilterEstado(''); setSearchTerm(''); setCurrentPage(1); }}
                        className="ml-2 text-emerald-600 hover:underline text-xs"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                {/* ── Buscador con autocompletado ── */}
                <div className="relative flex-1 sm:max-w-xs" ref={searchRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none z-10" />
                  {searchTerm && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10"
                      onClick={() => { setSearchTerm(''); setCurrentPage(1); setShowSearchSugg(false); }}
                    >
                      <XCircle className="size-4" />
                    </button>
                  )}
                  <Input
                    placeholder="Buscar por nombre, cédula, email o teléfono..."
                    className="pl-10 pr-8"
                    value={searchTerm}
                    autoComplete="off"
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                      setShowSearchSugg(e.target.value.trim().length > 0);
                    }}
                    onFocus={() => { if (searchTerm.trim().length > 0) setShowSearchSugg(true); }}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setShowSearchSugg(false); } }}
                  />
                  {/* ── Sugerencias ── */}
                  {showSearchSugg && (() => {
                    const term = searchTerm.toLowerCase().trim();
                    const sugs = asociados
                      .filter(a =>
                        a.nombre.toLowerCase().includes(term) ||
                        a.cedula.includes(searchTerm.trim()) ||
                        (a.email || '').toLowerCase().includes(term) ||
                        (a.telefono || '').includes(searchTerm.trim())
                      )
                      .slice(0, 7);
                    if (!sugs.length) return (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-3 text-sm text-slate-500 text-center">
                        Sin resultados para "{searchTerm}"
                      </div>
                    );
                    return (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                        <p className="text-[11px] text-slate-400 px-3 pt-2 pb-1 border-b border-slate-100 font-medium uppercase tracking-wider">
                          Asociados encontrados
                        </p>
                        {sugs.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 flex items-center justify-between gap-3 group transition-colors"
                            onMouseDown={() => {
                              setSearchTerm(s.nombre);
                              setCurrentPage(1);
                              setShowSearchSugg(false);
                            }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`p-1.5 rounded-md shrink-0 ${s.estado ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                                <User className={`size-3.5 ${s.estado ? 'text-emerald-600' : 'text-slate-400'}`} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 group-hover:text-emerald-700 truncate">{s.nombre}</p>
                                <p className="text-[11px] text-slate-400 truncate">{s.email || s.telefono || '—'}</p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-xs text-slate-500 font-mono">{s.cedula}</p>
                              {!s.estado && (
                                <span className="text-[10px] text-red-500 font-medium">Inactivo</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <Select value={filterEstado || 'todos'} onValueChange={(v) => { setFilterEstado(v === 'todos' ? '' : v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    <SelectItem value="activo">Activos</SelectItem>
                    <SelectItem value="inactivo">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {currentAsociados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Users className="size-10 text-slate-400" />
                </div>
                {(searchTerm || filterEstado) ? (
                  <>
                    <h3 className="text-slate-900 mb-2">No se encontraron asociados</h3>
                    <p className="text-sm text-slate-500 max-w-md mb-3">
                      {searchTerm
                        ? <>No hay asociados que coincidan con <span className="font-semibold">"{searchTerm}"</span></>
                        : <>No hay asociados con estado <span className="font-semibold">{filterEstado}</span></>
                      }
                    </p>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => { setSearchTerm(''); setFilterEstado(''); setCurrentPage(1); }}
                      className="gap-2"
                    >
                      Limpiar filtros
                    </Button>
                  </>
                ) : asociados.length === 0 ? (
                  <>
                    <h3 className="text-slate-900 mb-2">No existen asociados en el sistema</h3>
                    <p className="text-sm text-slate-500 max-w-md mb-3">
                      Aún no hay asociados registrados. Comienza registrando el primer asociado.
                    </p>
                    <Button
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        setFormData({ nombre: '', cedula: '', telefono: '', email: '', direccion: '', fechaIngreso: '' });
                        setIsCreateDialogOpen(true);
                      }}
                    >
                      <Plus className="size-4" />
                      Registrar primer asociado
                    </Button>
                  </>
                ) : (
                  <>
                    <h3 className="text-slate-900 mb-2">No se encontraron asociados</h3>
                    <p className="text-sm text-slate-500 max-w-md">
                      Ajusta los filtros para ver resultados.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asociado</TableHead>
                        <TableHead>Cédula</TableHead>
                        <TableHead>Contacto</TableHead>
                        <TableHead>Fecha ingreso</TableHead>
                        <TableHead>Referidos</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentAsociados.map((asociado) => (
                        <TableRow 
                          key={asociado.id}
                          className={`cursor-pointer hover:bg-slate-50 ${!asociado.estado ? 'bg-slate-50 opacity-75' : ''}`}
                          onClick={() => {
                            setSelectedAsociado(asociado);
                            setAuditoriaAsociado([]);
                            setIsDetalleDialogOpen(true);
                            cargarAuditoriaAsociado(asociado.id);
                          }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${asociado.estado ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                                <User className={`size-4 ${asociado.estado ? 'text-emerald-600' : 'text-slate-500'}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className={`font-semibold ${asociado.estado ? 'text-slate-900' : 'text-slate-600'}`}>
                                    {asociado.nombre}
                                  </p>
                                  {!asociado.estado && (
                                    <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                      Inactivo
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-500">{asociado.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-slate-600">{asociado.cedula}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1 text-slate-600">
                                <Phone className="size-3" />
                                <span className="text-sm">{asociado.telefono}</span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-600">
                                <Mail className="size-3" />
                                <span className="text-sm">{asociado.email}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-slate-600">{asociado.fechaIngreso}</p>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div 
                              className="flex items-center gap-2 cursor-pointer hover:bg-purple-50 rounded-lg p-2 -m-2 transition-colors"
                              onClick={() => {
                                if (asociado.referidos.length > 0) {
                                  setSelectedAsociado(asociado);
                                  setIsReferidosDialogOpen(true);
                                }
                              }}
                              title={asociado.referidos.length > 0 ? "Click para ver detalles de referidos" : "Sin referidos"}
                            >
                              <div className="p-2 bg-purple-100 rounded-lg">
                                <Users className="size-3 text-purple-600" />
                              </div>
                              <div>
                                <p className="text-slate-900">{asociado.referidos.length}</p>
                                <p className="text-xs text-slate-500">
                                  {asociado.referidos.length === 0 ? 'Sin referidos' : 
                                   asociado.referidos.length === 1 ? '1 referido' : 
                                   `${asociado.referidos.length} referidos`}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={asociado.estado}
                                onCheckedChange={() => {
                                  setSelectedAsociado(asociado);
                                  setIsToggleEstadoDialogOpen(true);
                                }}
                              />
                              <span className="text-sm text-slate-600">
                                {asociado.estado ? 'Activo' : 'Inactivo'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2 justify-end">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedAsociado(asociado);
                                  setFormData({
                                    nombre: asociado.nombre,
                                    cedula: asociado.cedula,
                                    telefono: asociado.telefono,
                                    email: asociado.email,
                                    direccion: asociado.direccion,
                                    fechaIngreso: asociado.fechaIngreso
                                  });
                                  setIsEditDialogOpen(true);
                                }}
                                title="Editar información de contacto (Email, Teléfono, Dirección)"
                              >
                                <Edit className="size-4" />
                              </Button>
                              {(() => {
                                const deleteStatus = canDeleteAsociado(asociado);
                                return (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                              onClick={async () => {
                                    // Verificar si existen pedidos asociados antes de intentar eliminar
                                    try {
                                      const { data: pedidos } = await supabase.from('pedidos').select('id')
                                        .eq('asociado_id', asociado.id)
                                        .eq('estado', 'pendiente')
                                        .limit(1);
                                      if (pedidos && pedidos.length > 0) {
                                        toast.error('No se puede eliminar: el asociado tiene pedidos pendientes de entrega.');
                                        return;
                                      }
                                    } catch (e) {
                                      // Si falla, proceed con la lógica existente (pero mejor bloquear)
                                    }
                                    setSelectedAsociado(asociado);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                    title={deleteStatus.reason}
                                    disabled={!deleteStatus.canDelete}
                                    className={!deleteStatus.canDelete ? 'opacity-50 cursor-not-allowed' : ''}
                                  >
                                    <Trash2 className={`size-4 ${!deleteStatus.canDelete ? 'text-slate-400' : 'text-red-600'}`} />
                                  </Button>
                                );
                              })()}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Paginación */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-slate-600">
                    Mostrando {startIndex + 1} a {Math.min(endIndex, filteredAsociados.length)} de {filteredAsociados.length} asociados
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className={currentPage === page ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      >
                        {page}
                      </Button>
                    ))}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
          </div>

          {/* Panel de Auditoría */}
          {showAuditoria && (
            <div className="space-y-4">
              <Card className="sticky top-6">
                <CardHeader className="border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-slate-100 rounded-lg">
                        <History className="size-5 text-slate-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Registro de Auditoría</CardTitle>
                        <p className="text-xs text-slate-500 mt-0.5">Historial completo de cambios</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Label className="text-xs text-slate-500 mb-2 block">Filtrar por asociado</Label>
                    <select
                      value={auditoriaFilter}
                      onChange={(e) => setAuditoriaFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="all">Todos los asociados ({auditoriaGlobal.length} registros)</option>
                      {asociados.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.nombre} ({auditoriaGlobal.filter((r: any) => r.registroId === a.id).length})
                        </option>
                      ))}
                    </select>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
                    {filteredAuditoriaRecords.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {filteredAuditoriaRecords.map((registro: any, index: number) => {
                          const getColorByTipo = (tipo: string) => {
                            switch (tipo) {
                              case 'creacion': return 'text-emerald-600 bg-emerald-50';
                              case 'edicion': return 'text-blue-600 bg-blue-50';
                              case 'estado': return 'text-purple-600 bg-purple-50';
                              case 'credito': return 'text-orange-600 bg-orange-50';
                              case 'ahorro': return 'text-green-600 bg-green-50';
                              case 'referido': return 'text-pink-600 bg-pink-50';
                              default: return 'text-slate-600 bg-slate-50';
                            }
                          };
                          
                          return (
                            <div key={`${registro.id}-${index}`} className="p-4 hover:bg-slate-50 transition-colors">
                              {auditoriaFilter === 'all' && (
                                <div className="flex items-center gap-2 mb-2">
                                  <User className="size-3 text-slate-400" />
                                  <span className="text-xs font-medium text-slate-700">{registro.asociadoNombre}</span>
                                  <span className="text-xs text-slate-400">•</span>
                                  <span className="text-xs text-slate-500">{registro.asociadoCedula}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${getColorByTipo(registro.tipo)}`}>
                                  {registro.accion}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mb-2 line-clamp-2">{registro.detalle}</p>
                              <div className="flex items-center justify-between text-xs text-slate-400">
                                <div className="flex items-center gap-1">
                                  <Clock className="size-3" />
                                  <span>{registro.fecha}</span>
                                </div>
                                <span className="flex items-center gap-1">
                                  <User className="size-3" />
                                  {registro.usuario}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                          <History className="size-8 text-slate-400" />
                        </div>
                        <h3 className="text-sm font-medium text-slate-900 mb-1">Sin registros</h3>
                        <p className="text-xs text-slate-500">
                          No hay cambios registrados para el filtro seleccionado
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

      {/* Modal Crear Asociado */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Asociado</DialogTitle>
            <DialogDescription>
              Completa la información del nuevo asociado
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo *</Label>
              <Input 
                id="nombre" 
                placeholder="Ej: María González Pérez"
                value={formData.nombre}
                onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cedula">Cédula *</Label>
              <Input 
                id="cedula" 
                placeholder="1.123.456.789"
                value={formData.cedula}
                onChange={(e) => setFormData(prev => ({ ...prev, cedula: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="maria@email.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono *</Label>
              <Input 
                id="telefono" 
                placeholder="+57 300 123 4567"
                value={formData.telefono}
                onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="direccion">Dirección *</Label>
              <Input 
                id="direccion" 
                placeholder="Calle 123 #45-67"
                value={formData.direccion}
                onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaIngreso">Fecha de ingreso *</Label>
              <Input 
                id="fechaIngreso" 
                type="date"
                value={formData.fechaIngreso}
                onChange={(e) => setFormData(prev => ({ ...prev, fechaIngreso: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleCreateAsociado}
            >
              Registrar asociado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Asociado */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Información del Asociado</DialogTitle>
            <DialogDescription>
              Solo puedes actualizar: correo electrónico, teléfono y dirección. Los campos de identificación están bloqueados por seguridad.
            </DialogDescription>
          </DialogHeader>
          {selectedAsociado && (
            <div className="space-y-4 py-4">
              <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
                <p className="text-sm text-blue-900">
                  <strong>🔒 Campos Bloqueados:</strong> Nombre, Apellidos y Cédula no pueden ser modificados por razones de seguridad y trazabilidad.
                  <br />
                  <strong>✅ Campos Editables:</strong> Correo Electrónico, Teléfono y Dirección.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-nombre" className="flex items-center gap-2">
                    Nombre completo *
                    <span className="text-xs text-slate-500 font-normal">(🔒 Bloqueado)</span>
                  </Label>
                  <Input 
                    id="edit-nombre" 
                    value={formData.nombre}
                    disabled
                    className="bg-slate-100 cursor-not-allowed text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-cedula" className="flex items-center gap-2">
                    Cédula *
                    <span className="text-xs text-slate-500 font-normal">(🔒 Bloqueado)</span>
                  </Label>
                  <Input 
                    id="edit-cedula" 
                    value={formData.cedula}
                    disabled
                    className="bg-slate-100 cursor-not-allowed text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email" className="flex items-center gap-2">
                    Email *
                    <span className="text-xs text-emerald-600 font-normal">(✅ Editable)</span>
                  </Label>
                  <Input 
                    id="edit-email" 
                    type="email" 
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="border-emerald-300 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-telefono" className="flex items-center gap-2">
                    Teléfono *
                    <span className="text-xs text-emerald-600 font-normal">(✅ Editable)</span>
                  </Label>
                  <Input 
                    id="edit-telefono" 
                    value={formData.telefono}
                    onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
                    className="border-emerald-300 focus:ring-emerald-500"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="edit-direccion" className="flex items-center gap-2">
                    Dirección *
                    <span className="text-xs text-emerald-600 font-normal">(✅ Editable)</span>
                  </Label>
                  <Input 
                    id="edit-direccion" 
                    value={formData.direccion}
                    onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))}
                    className="border-emerald-300 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-fechaIngreso" className="flex items-center gap-2">
                    Fecha de ingreso *
                    <span className="text-xs text-slate-500 font-normal">(🔒 Bloqueado)</span>
                  </Label>
                  <Input 
                    id="edit-fechaIngreso" 
                    type="date" 
                    value={formData.fechaIngreso}
                    disabled
                    className="bg-slate-100 cursor-not-allowed text-slate-500"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setSelectedAsociado(null);
            }}>
              Cancelar
            </Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleEditAsociado}
            >
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PRIMER DIÁLOGO: Advertencia de Eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="size-6" />
              ⚠️ ELIMINACIÓN PERMANENTE - Primera Confirmación
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded">
                <p className="text-red-900 font-semibold mb-2">
                  Está a punto de ELIMINAR PERMANENTEMENTE al asociado:
                </p>
                <div className="bg-white p-3 rounded border border-red-200 mt-2">
                  <p className="text-slate-900"><strong>Nombre:</strong> {selectedAsociado?.nombre}</p>
                  <p className="text-slate-900"><strong>Cédula:</strong> {selectedAsociado?.cedula}</p>
                  <p className="text-slate-900"><strong>Estado:</strong> <span className={selectedAsociado?.estado ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>{selectedAsociado?.estado ? 'ACTIVO' : 'INACTIVO'}</span></p>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-300 p-4 rounded">
                <p className="text-yellow-900 font-semibold mb-2">⚠️ CRITERIOS DE ELIMINACIÓN:</p>
                <ul className="text-sm text-yellow-800 space-y-2 ml-4 list-disc">
                  <li><strong>Solo asociados INACTIVOS</strong> pueden ser eliminados</li>
                  <li><strong>NO debe tener créditos con saldo pendiente</strong></li>
                  <li><strong>NO debe tener cuentas de ahorro con saldo</strong></li>
                  <li><strong>NO debe tener productos activos</strong> en el sistema</li>
                  <li>Esta acción <strong>NO SE PUEDE DESHACER</strong></li>
                </ul>
              </div>
              <p className="text-slate-600 text-sm italic">
                ℹ️ Si continúa, se le solicitará proporcionar una <strong>justificación obligatoria</strong> en el siguiente paso.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedAsociado(null);
              setDeleteJustification('');
            }}>
              ❌ Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAsociado}
              className="bg-orange-600 hover:bg-orange-700"
            >
              ⚠️ Continuar con Eliminación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SEGUNDO DIÁLOGO: Confirmación Final con Justificación */}
      <AlertDialog open={isDeleteConfirmDialogOpen} onOpenChange={setIsDeleteConfirmDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="size-6" />
              🔴 CONFIRMACIÓN FINAL - Justificación Obligatoria
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div className="bg-red-100 border-l-4 border-red-700 p-4 rounded">
                <p className="text-red-900 font-bold mb-2">
                  ⚠️ ÚLTIMA ADVERTENCIA - Esta acción es IRREVERSIBLE
                </p>
                <p className="text-red-800">
                  Está a punto de eliminar permanentemente a <strong>"{selectedAsociado?.nombre}"</strong> del sistema.
                </p>
              </div>
              <div className="space-y-3">
                <Label htmlFor="justification" className="text-slate-900 font-semibold">
                  📝 Justificación de Eliminación (Obligatorio - mínimo 20 caracteres):
                </Label>
                <textarea
                  id="justification"
                  value={deleteJustification}
                  onChange={(e) => setDeleteJustification(e.target.value)}
                  placeholder="Ejemplo: Asociado retirado voluntariamente el 15/01/2025. Todas las obligaciones financieras liquidadas."
                  className="w-full min-h-[120px] p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                  maxLength={500}
                />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {deleteJustification.length}/500 caracteres
                    {deleteJustification.length > 0 && deleteJustification.length < 20 && (
                      <span className="text-red-600 ml-2">⚠️ Se requieren al menos 20 caracteres</span>
                    )}
                  </span>
                  {deleteJustification.length >= 20 && (
                    <span className="text-emerald-600">✓ Justificación válida</span>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteConfirmDialogOpen(false);
              setDeleteJustification('');
              setSelectedAsociado(null);
            }}>
              ❌ Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDeleteAsociado}
              className="bg-red-600 hover:bg-red-700"
              disabled={!deleteJustification.trim() || deleteJustification.trim().length < 20}
            >
              🗑️ ELIMINAR PERMANENTEMENTE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Detalle de Referidos */}
      <Dialog open={isReferidosDialogOpen} onOpenChange={setIsReferidosDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b border-slate-200 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-slate-900 mb-1">
                  Referidos de {selectedAsociado?.nombre}
                </DialogTitle>
                <DialogDescription className="text-slate-500">
                  Personas que han sido referidas al sistema UFCA
                </DialogDescription>
              </div>
              {selectedAsociado && selectedAsociado.referidos.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 rounded-full">
                  <Users className="size-4 text-purple-600" />
                  <span className="text-sm text-purple-700">
                    {selectedAsociado.referidos.length} {selectedAsociado.referidos.length === 1 ? 'referido' : 'referidos'}
                  </span>
                </div>
              )}
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-6">
            {selectedAsociado && selectedAsociado.referidos.length > 0 ? (
              <div className="space-y-4">
                {selectedAsociado.referidos.map((referido: any, index: number) => (
                  <div 
                    key={index} 
                    className="group bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-purple-300 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-50 rounded-xl">
                          <User className="size-6 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <h4 className="text-slate-900">{referido.nombre}</h4>
                            <Badge className={getEstadoBadgeColor(referido.estadoReferido)}>
                              {referido.estadoReferido}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-slate-600">{referido.cedula}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="size-4 text-slate-400" />
                              <span className="text-slate-600">{referido.telefono}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-slate-600">{formatDate(referido.fechaReferido)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-emerald-600">{formatCurrency(referido.bonificacion)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Users className="size-10 text-slate-400" />
                </div>
                <h3 className="text-slate-900 mb-1">Sin referidos registrados</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Este asociado aún no ha referido a ninguna persona al sistema UFCA
                </p>
              </div>
            )}
          </div>

          {selectedAsociado && selectedAsociado.referidos.length > 0 && (
            <div className="border-t border-slate-200 pt-4 mt-4">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600 mb-1">Total referidos</p>
                  <p className="text-xl text-slate-900">{selectedAsociado.referidos.length}</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-lg">
                  <p className="text-sm text-emerald-700 mb-1">Aprobados</p>
                  <p className="text-xl text-emerald-600">
                    {selectedAsociado.referidos.filter((r: any) => r.estadoReferido === 'Aprobado').length}
                  </p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700 mb-1">Total bonificaciones</p>
                  <p className="text-xl text-blue-600">
                    {formatCurrency(
                      selectedAsociado.referidos.reduce((sum: number, r: any) => sum + r.bonificacion, 0)
                    )}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsReferidosDialogOpen(false); setSelectedAsociado(null); }} className="w-full">
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}

          {selectedAsociado && selectedAsociado.referidos.length === 0 && (
            <DialogFooter className="border-t border-slate-200 pt-4">
              <Button variant="outline" onClick={() => { setIsReferidosDialogOpen(false); setSelectedAsociado(null); }} className="w-full">
                Cerrar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Cambiar Estado */}
      <AlertDialog open={isToggleEstadoDialogOpen} onOpenChange={setIsToggleEstadoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {selectedAsociado?.estado ? (
                <><AlertTriangle className="size-5 text-orange-600" />¿Desactivar asociado?</>
              ) : (
                <><CheckCircle2 className="size-5 text-emerald-600" />¿Activar asociado?</>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Estás a punto de {selectedAsociado?.estado ? 'desactivar' : 'activar'} al asociado <strong>"{selectedAsociado?.nombre}"</strong>.
              </p>
              {selectedAsociado?.estado ? (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                  <p className="text-sm text-red-800 font-semibold mb-2">⛔ Al desactivar, el asociado NO podrá:</p>
                  <ul className="text-sm text-red-700 space-y-1 ml-4 list-disc">
                    <li>Solicitar nuevos créditos</li>
                    <li>Abrir cuentas de ahorro</li>
                    <li>Registrar referidos</li>
                    <li>Participar en eventos</li>
                  </ul>
                </div>
              ) : (
                <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded">
                  <p className="text-sm text-emerald-800 font-semibold mb-2">✅ Al activar, el asociado recuperará:</p>
                  <ul className="text-sm text-emerald-700 space-y-1 ml-4 list-disc">
                    <li>Acceso completo a todas las operaciones</li>
                    <li>Capacidad de solicitar créditos</li>
                    <li>Apertura de cuentas de ahorro</li>
                    <li>Registro de referidos y participación en eventos</li>
                  </ul>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedAsociado(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleToggleEstado(selectedAsociado?.id)}
              className={selectedAsociado?.estado ? 'bg-orange-600 hover:bg-orange-700' : 'bg-emerald-600 hover:bg-emerald-700'}
            >
              {selectedAsociado?.estado ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Detalle Asociado */}
      <Dialog open={isDetalleDialogOpen} onOpenChange={(open: boolean) => {
        setIsDetalleDialogOpen(open);
        if (!open) { setSelectedAsociado(null); setDetalleTab('info'); setAuditoriaAsociado([]); }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b border-slate-200 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-slate-900 mb-1 flex items-center gap-2">
                  <User className="size-5 text-emerald-600" />
                  Detalle Completo: {selectedAsociado?.nombre}
                </DialogTitle>
                <DialogDescription className="text-slate-500">
                  Información personal, financiera y participación en eventos
                </DialogDescription>
              </div>
              {selectedAsociado && (
                <Badge className={selectedAsociado.estado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                  {selectedAsociado.estado ? 'Activo' : 'Inactivo'}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {selectedAsociado && (
            <Tabs value={detalleTab} onValueChange={setDetalleTab} className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid grid-cols-6 w-full">
                <TabsTrigger value="info" className="gap-1 text-xs"><Info className="size-3" /> Info</TabsTrigger>
                <TabsTrigger value="ahorros" className="gap-1 text-xs"><DollarSign className="size-3" /> Ahorros</TabsTrigger>
                <TabsTrigger value="creditos" className="gap-1 text-xs"><CreditCard className="size-3" /> Créditos</TabsTrigger>
                <TabsTrigger value="referidos" className="gap-1 text-xs"><Users className="size-3" /> Referidos</TabsTrigger>
                <TabsTrigger value="eventos" className="gap-1 text-xs"><PartyPopper className="size-3" /> Eventos</TabsTrigger>
                <TabsTrigger value="historial" className="gap-1 text-xs"><History className="size-3" /> Historial</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="flex-1 overflow-y-auto mt-4 space-y-4">
                <div className="bg-slate-50 p-5 rounded-lg space-y-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <User className="size-5 text-emerald-600" />Datos Personales
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label className="text-slate-500 text-xs">Nombre Completo</Label><p className="font-medium mt-1">{selectedAsociado.nombre}</p></div>
                    <div><Label className="text-slate-500 text-xs">Cédula</Label><p className="font-medium mt-1">{selectedAsociado.cedula}</p></div>
                    <div><Label className="text-slate-500 text-xs">Email</Label><p className="font-medium mt-1 flex items-center gap-1"><Mail className="size-3 text-slate-400" />{selectedAsociado.email}</p></div>
                    <div><Label className="text-slate-500 text-xs">Teléfono</Label><p className="font-medium mt-1 flex items-center gap-1"><Phone className="size-3 text-slate-400" />{selectedAsociado.telefono}</p></div>
                    <div className="col-span-2"><Label className="text-slate-500 text-xs">Dirección</Label><p className="font-medium mt-1 flex items-center gap-1"><MapPin className="size-3 text-slate-400" />{selectedAsociado.direccion}</p></div>
                    <div><Label className="text-slate-500 text-xs">Fecha de Ingreso</Label><p className="font-medium mt-1 flex items-center gap-1"><Calendar className="size-3 text-slate-400" />{formatDate(selectedAsociado.fechaIngreso)}</p></div>
                    <div>
                      <Label className="text-slate-500 text-xs">Estado actual</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge className={selectedAsociado.estado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                          {selectedAsociado.estado ? 'Activo' : 'Inactivo'}
                        </Badge>
                        {selectedAsociado.fechaCambioEstado && (
                          <span className="text-xs text-slate-400">desde {selectedAsociado.fechaCambioEstado}</span>
                        )}
                      </div>
                    </div>
                    {selectedAsociado.fechaModificacion && (
                      <div className="col-span-2 pt-2 border-t border-slate-200">
                        <Label className="text-slate-500 text-xs">Última modificación</Label>
                        <p className="font-medium mt-1 text-sm flex items-center gap-2">
                          <Clock className="size-3 text-slate-400" />
                          {selectedAsociado.fechaModificacion}
                          {selectedAsociado.modificadoPor && (
                            <span className="text-slate-500 text-xs">— por <strong>{selectedAsociado.modificadoPor}</strong></span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {!selectedAsociado.estado && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="size-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-red-900 mb-1">Asociado Inactivo - Operaciones Restringidas</h4>
                        <p className="text-sm text-red-700">Este asociado NO puede realizar nuevas operaciones.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gradient-to-br from-emerald-50 to-blue-50 p-5 rounded-lg">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="size-5 text-emerald-600" />Resumen Financiero
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-lg text-center">
                      <p className="text-xs text-slate-500 mb-1">Total Ahorros</p>
                      <p className="text-xl font-bold text-emerald-600">{formatCurrency(selectedAsociado.totalAhorros || 0)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg text-center">
                      <p className="text-xs text-slate-500 mb-1">Total Créditos</p>
                      <p className="text-xl font-bold text-blue-600">{formatCurrency(selectedAsociado.totalCreditos || 0)}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="ahorros" className="flex-1 overflow-y-auto mt-4">
                {!selectedAsociado.estado && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="size-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-yellow-900 mb-1">⛔ Apertura de Ahorros No Disponible</h4>
                        <p className="text-sm text-yellow-700">Los asociados inactivos no pueden abrir nuevas cuentas de ahorro.</p>
                      </div>
                    </div>
                  </div>
                )}
                {selectedAsociado.ahorros && selectedAsociado.ahorros.length > 0 ? (
                  <div className="space-y-4">
                    {selectedAsociado.ahorros.map((ahorro: any) => (
                      <div key={ahorro.id} className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-lg"><DollarSign className="size-5 text-emerald-600" /></div>
                            <div>
                              <h4 className="font-semibold text-slate-900">{ahorro.tipo}</h4>
                              <p className="text-sm text-slate-500">Apertura: {formatDate(ahorro.fechaInicio)}</p>
                            </div>
                          </div>
                          <Badge className={ahorro.estado === 'Activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>{ahorro.estado}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div><p className="text-xs text-slate-500">Monto</p><p className="font-semibold text-slate-900">{formatCurrency(ahorro.monto)}</p></div>
                          <div><p className="text-xs text-slate-500">Saldo</p><p className="font-semibold text-emerald-600">{formatCurrency(ahorro.saldo)}</p></div>
                        </div>
                      </div>
                    ))}
                    <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                      <p className="text-sm text-emerald-800"><span className="font-semibold">Total acumulado:</span> {formatCurrency(selectedAsociado.totalAhorros || 0)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"><DollarSign className="size-10 text-slate-400" /></div>
                    <h3 className="text-slate-900 mb-1">Sin cuentas de ahorro</h3>
                    <p className="text-sm text-slate-500 max-w-sm">Este asociado aún no tiene cuentas de ahorro registradas</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="creditos" className="flex-1 overflow-y-auto mt-4">
                {!selectedAsociado.estado && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="size-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-yellow-900 mb-1">⛔ Solicitud de Créditos No Disponible</h4>
                        <p className="text-sm text-yellow-700">Los asociados inactivos no pueden solicitar nuevos créditos.</p>
                      </div>
                    </div>
                  </div>
                )}
                {selectedAsociado.creditos && selectedAsociado.creditos.length > 0 ? (
                  <div className="space-y-4">
                    {selectedAsociado.creditos.map((credito: any) => (
                      <div key={credito.id} className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg"><CreditCard className="size-5 text-blue-600" /></div>
                            <div>
                              <h4 className="font-semibold text-slate-900">{credito.tipo}</h4>
                              <p className="text-sm text-slate-500">Desembolso: {formatDate(credito.fechaDesembolso)}</p>
                            </div>
                          </div>
                          <Badge className={credito.estado === 'Activo' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}>{credito.estado}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div><p className="text-xs text-slate-500">Monto Desembolsado</p><p className="font-semibold text-slate-900">{formatCurrency(credito.monto)}</p></div>
                          <div><p className="text-xs text-slate-500">Saldo Actual</p><p className="font-semibold text-blue-600">{formatCurrency(credito.saldo)}</p></div>
                          <div><p className="text-xs text-slate-500">Cuota Mensual</p><p className="font-medium text-slate-700">{formatCurrency(credito.cuota)}</p></div>
                          <div><p className="text-xs text-slate-500">Plazo</p><p className="font-medium text-slate-700">{credito.plazo}</p></div>
                        </div>
                      </div>
                    ))}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800"><span className="font-semibold">Saldo total activo:</span> {formatCurrency(selectedAsociado.totalCreditos || 0)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"><CreditCard className="size-10 text-slate-400" /></div>
                    <h3 className="text-slate-900 mb-1">Sin créditos</h3>
                    <p className="text-sm text-slate-500 max-w-sm">Este asociado no tiene créditos registrados</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="referidos" className="flex-1 overflow-y-auto mt-4">
                {!selectedAsociado.estado && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="size-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-yellow-900 mb-1">⛔ Registro de Referidos No Disponible</h4>
                        <p className="text-sm text-yellow-700">Los asociados inactivos no pueden registrar nuevos referidos.</p>
                      </div>
                    </div>
                  </div>
                )}
                {selectedAsociado.referidos && selectedAsociado.referidos.length > 0 ? (
                  <div className="space-y-4">
                    {selectedAsociado.referidos.map((referido: any, index: number) => (
                      <div key={index} className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg"><User className="size-5 text-purple-600" /></div>
                            <div>
                              <h4 className="font-semibold text-slate-900">{referido.nombre}</h4>
                              <p className="text-sm text-slate-500">Referido el {formatDate(referido.fechaReferido)}</p>
                            </div>
                          </div>
                          <Badge className={referido.estadoReferido === 'Aprobado' ? 'bg-emerald-100 text-emerald-700' : referido.estadoReferido === 'En proceso' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>{referido.estadoReferido}</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-4">
                          <div><p className="text-xs text-slate-500">Cédula</p><p className="font-medium text-slate-700">{referido.cedula}</p></div>
                          <div><p className="text-xs text-slate-500">Teléfono</p><p className="font-medium text-slate-700">{referido.telefono}</p></div>
                          <div><p className="text-xs text-slate-500">Bonificación</p><p className="font-semibold text-emerald-600">{formatCurrency(referido.bonificacion)}</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Users className="size-10 text-slate-400" /></div>
                    <h3 className="text-slate-900 mb-1">Sin referidos</h3>
                    <p className="text-sm text-slate-500 max-w-sm">Este asociado aún no ha referido a ninguna persona</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="eventos" className="flex-1 overflow-y-auto mt-4">
                {!selectedAsociado.estado && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="size-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-yellow-900 mb-1">⛔ Participación en Eventos No Disponible</h4>
                        <p className="text-sm text-yellow-700">Los asociados inactivos no pueden participar en nuevos eventos.</p>
                      </div>
                    </div>
                  </div>
                )}
                {selectedAsociado.eventos && selectedAsociado.eventos.length > 0 ? (
                  <div className="space-y-4">
                    {selectedAsociado.eventos.map((evento: any) => (
                      <div key={evento.id} className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-lg"><PartyPopper className="size-5 text-orange-600" /></div>
                            <div>
                              <h4 className="font-semibold text-slate-900">{evento.nombre}</h4>
                              <p className="text-sm text-slate-500">{formatDate(evento.fecha)}</p>
                            </div>
                          </div>
                          <Badge className={evento.participacion === 'Asistió' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                            {evento.participacion === 'Asistió' ? <span className="flex items-center gap-1"><CheckCircle2 className="size-3" />Asistió</span> : <span className="flex items-center gap-1"><XCircle className="size-3" />No asistió</span>}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"><PartyPopper className="size-10 text-slate-400" /></div>
                    <h3 className="text-slate-900 mb-1">Sin eventos registrados</h3>
                    <p className="text-sm text-slate-500 max-w-sm">Este asociado no tiene participación en eventos registrada</p>
                  </div>
                )}
              </TabsContent>

              {/* Tab: Historial de cambios */}
              <TabsContent value="historial" className="flex-1 overflow-y-auto mt-4">
                <div className="space-y-3">
                  {loadingAuditoria ? (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mr-2" />
                      Cargando historial...
                    </div>
                  ) : auditoriaAsociado.length > 0 ? (
                    auditoriaAsociado.map((reg: any, i: number) => (
                      <div key={reg.id ?? i} className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="p-2 bg-slate-200 rounded shrink-0 mt-0.5">
                          <History className="size-3 text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline" className={`text-xs ${
                              reg.accion?.includes('CREACIÓN') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              reg.accion?.includes('EDICIÓN')  ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              reg.accion?.includes('ESTADO')   ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              reg.accion?.includes('ELIMINACIÓN') ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-slate-50 text-slate-700 border-slate-200'
                            }`}>
                              {reg.accion}
                            </Badge>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock className="size-3" />{reg.fecha}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700">
                            {typeof reg.detalle === 'string' ? reg.detalle : reg.detalle?.descripcion ?? '—'}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">Por: <strong>{reg.usuario}</strong></p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <History className="size-10 text-slate-300 mb-3" />
                      <p className="text-sm text-slate-500">Sin historial de cambios registrado</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="border-t border-slate-200 pt-4 mt-4">
            <Button variant="outline" onClick={() => { setIsDetalleDialogOpen(false); setSelectedAsociado(null); setDetalleTab('info'); }} className="w-full">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
