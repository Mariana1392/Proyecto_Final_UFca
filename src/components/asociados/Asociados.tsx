import { useState, useEffect, useRef } from 'react';
import { useAsociados }  from './useAsociados';
import { useAuditoria }  from './useAuditoria';
import { useRetiro }     from './useRetiro';
import { usePagos }      from './usePagos';
import { AsociadoDialogCrear }    from './AsociadoDialogCrear';
import { AsociadoDialogEditar }   from './AsociadoDialogEditar';
import { AsociadoDialogEliminar } from './AsociadoDialogEliminar';
import { AsociadoDialogEstado }   from './AsociadoDialogEstado';
import { AsociadoDialogPago }     from './AsociadoDialogPago';
import { AsociadoDialogRetiro }   from './AsociadoDialogRetiro';
import { AsociadoDialogDetalle }  from './AsociadoDialogDetalle';
import { formatCurrency, formatDate, getEstadoBadgeColor } from './asociadosUtils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import {
  Search, Plus, ChevronLeft, ChevronRight,
  Edit, Trash2, Mail, Phone, User, Users, Calendar, AlertTriangle,
  DollarSign, CreditCard, PartyPopper, TrendingUp, Clock, CheckCircle2,
  XCircle, Info, FileText, MapPin, History, ChevronDown, ChevronUp,
  Upload, AlertCircle, LogOut,
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import MiPerfil from '../MiPerfil';

import { supabase } from '../../lib/supabase';
import { asociadosApi, ahorroPermanenteApi, ahorroVoluntarioApi, creditosApi } from '../../lib/api';
import type { UserRole } from '../../contexts/AuthContext';


interface AsociadosProps {
  onViewDetails: (id: string) => void;
  userRole?: UserRole | null;
  userData?: any;
}

export default function Asociados({ onViewDetails, userRole, userData }: AsociadosProps) {
  // ── UI state (solo lo que queda en el componente) ────────────────────────
  const [searchTerm, setSearchTerm]                         = useState('');
  const [currentPage, setCurrentPage]                       = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen]         = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen]             = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen]         = useState(false);
  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [deleteJustification, setDeleteJustification]       = useState('');
  const [isToggleEstadoDialogOpen, setIsToggleEstadoDialogOpen] = useState(false);
  const [isReferidosDialogOpen, setIsReferidosDialogOpen]   = useState(false);
  const [isDetalleDialogOpen, setIsDetalleDialogOpen]       = useState(false);
  const [selectedAsociado, setSelectedAsociado]             = useState<any>(null);
  const [detalleTab, setDetalleTab]                         = useState('info');
  const [filterEstado, setFilterEstado]                     = useState('');
  const [showAuditoria, setShowAuditoria]                   = useState(false);
  const [auditoriaFilter, setAuditoriaFilter]               = useState<string>('all');
  const [showSearchSugg, setShowSearchSugg]                 = useState(false);
  const searchRef   = useRef<HTMLDivElement>(null);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    nombre: '', cedula: '', telefono: '', email: '', direccion: '', fechaIngreso: ''
  });

  // ── Hooks extraídos ──────────────────────────────────────────────────────
  const {
    asociados, setAsociados, asociadosRef,
    loading, usuarioActualId, usuarioActualNombre,
    cargarAsociados,
  } = useAsociados();

  const {
    auditoriaGlobal, auditoriaAsociado, loadingAuditoria,
    registrarAuditoria, cargarAuditoriaAsociado, cargarAuditoriaGlobal,
    clearAuditoriaAsociado,
  } = useAuditoria(asociadosRef);

  const {
    isRetiroOpen, setIsRetiroOpen,
    retiroAsociado, retirando, retiroStatus,
    abrirRetiro, handleDesactivarCuenta,
  } = useRetiro(setAsociados);

  const {
    pendientesPago,
    isPagoConfirmDialogOpen, setIsPagoConfirmDialogOpen,
    solicitudPagoSeleccionada, setSolicitudPagoSeleccionada,
    comprobante, setComprobante,
    savingConfirmPago,
    cargarPendientesPago, handleConfirmarPago,
  } = usePagos();

  // ── Efectos ──────────────────────────────────────────────────────────────
  useEffect(() => {
    cargarAsociados().then(snap => { if (snap?.length) cargarAuditoriaGlobal(snap); });
    cargarPendientesPago();
  }, []);

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
      // Tras la migración, el asociado ES el usuario: actualizamos directamente en usuarios
      const { error: estadoErr } = await supabase.from('usuarios').update({
        activo: nuevoEstado,
        estado_cuenta: nuevoEstadoDB,
      }).eq('id', id);
      if (estadoErr) throw estadoErr;

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
          estado: nuevoEstado,
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
      // Obtener rol_id de 'asociado' para asignarlo al nuevo usuario
      const { data: rolAsoc } = await supabase
        .from('roles').select('id').eq('nombre', 'asociado').limit(1).maybeSingle();

      const { data: nuevoData, error: insertErr } = await supabase
        .from('usuarios')
        .insert({
          nombre:        formData.nombre.trim(),
          cedula:        formData.cedula.trim(),
          telefono:      formData.telefono.trim(),
          email:         formData.email.trim(),
          direccion:     formData.direccion.trim(),
          fecha_ingreso: formData.fechaIngreso,
          estado_cuenta: 'activo',
          activo:        true,
          rol_id:        rolAsoc?.id ?? null,
        })
        .select('id, nombre, cedula, telefono, email, direccion, fecha_ingreso')
        .single();
      if (insertErr) throw insertErr;
      const nuevo = nuevoData!;

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
      // Tras la migración, el asociado ES el usuario — actualizar directamente en usuarios
      const { error: editErr } = await supabase.from('usuarios').update({
        telefono:  formData.telefono.trim(),
        email:     formData.email.trim(),
        direccion: formData.direccion.trim(),
      }).eq('id', selectedAsociado.id);
      if (editErr) throw editErr;

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
              telefono:  formData.telefono.trim(),
              email:     formData.email.trim(),
              direccion: formData.direccion.trim(),
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

      // Tras la migración el asociado ES el usuario — eliminamos directamente de usuarios
      // Primero intentar eliminar de auth (RPC), luego el registro de usuarios
      try {
        await supabase.rpc('eliminar_usuario_auth', { user_id: asociado.id });
      } catch {
        // Si la función Auth falla, continuamos igual
      }
      const { error: delErr } = await supabase.from('usuarios').delete().eq('id', asociado.id);
      if (delErr) throw delErr;

      setAsociados(prev => prev.filter(a => a.id !== asociado.id));
      cargarAuditoriaGlobal();

      toast.success('🗑️ Asociado Eliminado Permanentemente', {
        description: `"${asociado.nombre}" ha sido eliminado del sistema el ${fechaEliminacion}.`
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
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
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

        {/* ── Pendientes de pago de activación ─────────────────────────── */}
        {pendientesPago.length > 0 && (
          <Card className="border-amber-300 bg-amber-50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-xl">
                  <AlertCircle className="size-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-base text-amber-900">
                    Pendientes de pago de activación ({pendientesPago.length})
                  </CardTitle>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Estos asociados fueron aprobados y esperan confirmación de pago para activar su cuenta.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendientesPago.map(sol => (
                  <div key={sol.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-amber-200 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <User className="size-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{sol.nombres} {sol.apellidos}</p>
                        <p className="text-xs text-slate-500">CC {sol.cedula}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          {sol.telefono && <span className="flex items-center gap-1"><Phone className="size-3" />{sol.telefono}</span>}
                          {sol.email    && <span className="flex items-center gap-1"><Mail  className="size-3" />{sol.email}</span>}
                        </div>
                        <p className="text-xs text-amber-700 mt-1">
                          Solicitud: {new Date(sol.fecha_solicitud).toLocaleDateString('es-CO')}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 flex-shrink-0"
                      onClick={() => { setSolicitudPagoSeleccionada(sol); setComprobante(null); setIsPagoConfirmDialogOpen(true); }}
                    >
                      <CheckCircle2 className="size-4" /> Confirmar pago
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
                                  {asociado.estado && asociado.estadoAhorroPerm?.estado === 'en_mora' && (
                                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 animate-pulse" title={asociado.estadoAhorroPerm.mensaje}>
                                      En Mora
                                    </Badge>
                                  )}
                                  {asociado.estado && asociado.estadoAhorroPerm?.estado === 'plazo_vencido' && (
                                    <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-500" title={asociado.estadoAhorroPerm.mensaje}>
                                      Candidato a Retiro
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
                              {/* Botón Retirar — solo para asociados activos */}
                              {asociado.estado && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  title="Iniciar proceso de retiro del asociado"
                                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                                  onClick={() => abrirRetiro(asociado)}
                                >
                                  <LogOut className="size-4" />
                                </Button>
                              )}
                              {(() => {
                                const deleteStatus = canDeleteAsociado(asociado);
                                return (
                                  <Button
                                    variant="outline"
                                    size="sm"
                              onClick={() => {
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
      <AsociadoDialogCrear
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        formData={formData}
        setFormData={setFormData}
        onConfirm={handleCreateAsociado}
      />

      <AsociadoDialogEditar
        open={isEditDialogOpen}
        onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) setSelectedAsociado(null); }}
        asociado={selectedAsociado}
        formData={formData}
        setFormData={setFormData}
        onConfirm={handleEditAsociado}
      />

      <AsociadoDialogEliminar
        openAdvertencia={isDeleteDialogOpen}
        onOpenChangeAdvertencia={setIsDeleteDialogOpen}
        openConfirm={isDeleteConfirmDialogOpen}
        onOpenChangeConfirm={setIsDeleteConfirmDialogOpen}
        asociado={selectedAsociado}
        deleteJustification={deleteJustification}
        setDeleteJustification={setDeleteJustification}
        onPrimeraConfirmacion={handleDeleteAsociado}
        onConfirmFinal={handleConfirmDeleteAsociado}
        onCancelar={() => { setSelectedAsociado(null); setDeleteJustification(''); }}
      />



      <AsociadoDialogEstado
        open={isToggleEstadoDialogOpen}
        onOpenChange={(open) => { setIsToggleEstadoDialogOpen(open); if (!open) setSelectedAsociado(null); }}
        asociado={selectedAsociado}
        onConfirm={handleToggleEstado}
      />

      <AsociadoDialogDetalle
        open={isDetalleDialogOpen}
        onOpenChange={(open) => {
          setIsDetalleDialogOpen(open);
          if (!open) { setSelectedAsociado(null); setDetalleTab('info'); clearAuditoriaAsociado(); }
        }}
        asociado={selectedAsociado}
        tab={detalleTab}
        setTab={setDetalleTab}
        auditoriaAsociado={auditoriaAsociado}
        loadingAuditoria={loadingAuditoria}
        onClose={() => { setIsDetalleDialogOpen(false); setSelectedAsociado(null); setDetalleTab('info'); clearAuditoriaAsociado(); }}
      />

            <AsociadoDialogPago
        open={isPagoConfirmDialogOpen}
        onOpenChange={(open) => { if (!open) { setIsPagoConfirmDialogOpen(false); setSolicitudPagoSeleccionada(null); setComprobante(null); } }}
        solicitud={solicitudPagoSeleccionada}
        comprobante={comprobante}
        setComprobante={setComprobante}
        saving={savingConfirmPago}
        onConfirm={handleConfirmarPago}
      />

      <AsociadoDialogRetiro
        open={isRetiroOpen}
        onOpenChange={setIsRetiroOpen}
        asociado={retiroAsociado}
        status={retiroStatus}
        retirando={retirando}
        onDesactivar={handleDesactivarCuenta}
        onActualizar={() => retiroAsociado && abrirRetiro(retiroAsociado)}
      />

      </div>
    </div>
  );
}