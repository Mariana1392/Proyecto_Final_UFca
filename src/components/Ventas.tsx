import { useState, useEffect, Fragment } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Search, Filter, Plus, ChevronLeft, ChevronRight,
  Edit, Trash2, ShoppingCart, Calendar,
  XCircle, FileText, ChevronDown, ChevronUp,
  TrendingUp, ArrowDown, ArrowUp, Clock, User2
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';

import { supabase } from '../lib/supabase';
import { ventasApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function Ventas() {
  const { user: authUser } = useAuth();
  const [searchTerm, setSearchTerm]                   = useState('');
  const [filtroProducto, setFiltroProducto]           = useState('todos');
  const [filtroFecha, setFiltroFecha]                 = useState('');
  const [activeTab, setActiveTab]                     = useState('activas');
  const [sortOrder, setSortOrder]                     = useState<'desc' | 'asc'>('desc');
  const [expandedRows, setExpandedRows]               = useState<Set<string>>(new Set());
  const [isReporteOpen, setIsReporteOpen]             = useState(false);
  const [reporteDesde, setReporteDesde]               = useState('');
  const [reporteHasta, setReporteHasta]               = useState('');
  const [currentPage, setCurrentPage]                 = useState(1);
  const [currentPageAnuladas, setCurrentPageAnuladas] = useState(1);
  const [isDetailDialogOpen, setIsDetailDialogOpen]   = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen]       = useState(false);
  const [isAnularDialogOpen, setIsAnularDialogOpen]   = useState(false);
  const [isEliminarDialogOpen, setIsEliminarDialogOpen] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion]           = useState('');
  const [isNuevaVentaOpen, setIsNuevaVentaOpen]       = useState(false);
  const [selectedItem, setSelectedItem]               = useState<any>(null);
  const itemsPerPage = 10;

  const [ventas, setVentas]         = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [guardando, setGuardando]   = useState(false);

  // ── Catálogos para el formulario de nueva venta ───────────────────────────
  const [catalogoEventos, setCatalogoEventos]     = useState<any[]>([]);
  const [catalogoUsuarios, setCatalogoUsuarios]   = useState<any[]>([]);
  const [catalogoProductos, setCatalogoProductos] = useState<any[]>([]);

  // ── Formulario nueva venta ────────────────────────────────────────────────
  const emptyVenta = { evento_id: '', usuario_id: '', metodoPago: 'efectivo', notas: '' };
  const [formVenta, setFormVenta]           = useState(emptyVenta);
  const [itemsVenta, setItemsVenta]         = useState<{ producto_id: string; nombre: string; cantidad: number; precio_unit: number; subtotal: number }[]>([]);
  const [productoSelId, setProductoSelId]   = useState('');
  const [cantidadItem, setCantidadItem]     = useState(1);

  useEffect(() => { cargarVentas(); cargarCatalogos(); }, []);

  async function cargarCatalogos() {
    const [{ data: evs }, { data: usrs }, { data: prods }] = await Promise.all([
      supabase.from('eventos').select('id, titulo, fecha').in('estado', ['programado', 'en_curso']).order('fecha'),
      supabase.from('usuarios').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('productos').select('id, nombre, precio_venta').eq('estado', 'Disponible').order('nombre'),
    ]);
    setCatalogoEventos(evs || []);
    setCatalogoUsuarios(usrs || []);
    setCatalogoProductos(prods || []);
  }

  // ── Carrito ───────────────────────────────────────────────────────────────
  const [ultimoAgregado, setUltimoAgregado] = useState<string | null>(null);

  const productoPreview = catalogoProductos.find(p => p.id === productoSelId) ?? null;

  function agregarItemVenta() {
    if (!productoSelId) {
      toast.error('Selecciona un producto antes de agregar');
      return;
    }
    const cantidad = Math.floor(cantidadItem);
    if (!cantidad || cantidad < 1) {
      toast.error('La cantidad debe ser un número entero mayor a 0');
      return;
    }
    if (cantidad > 999) {
      toast.error('La cantidad máxima por producto es 999');
      return;
    }
    const prod = catalogoProductos.find(p => p.id === productoSelId);
    if (!prod) return;

    const existe = itemsVenta.find(i => i.producto_id === productoSelId);
    if (existe) {
      setItemsVenta(prev => prev.map(i =>
        i.producto_id === productoSelId
          ? { ...i, cantidad: i.cantidad + cantidad, subtotal: (i.cantidad + cantidad) * i.precio_unit }
          : i
      ));
      toast.success(`+${cantidad} unidad${cantidad > 1 ? 'es' : ''} de "${prod.nombre}" añadidas`);
    } else {
      setItemsVenta(prev => [...prev, {
        producto_id: prod.id,
        nombre:      prod.nombre,
        cantidad,
        precio_unit: prod.precio_venta,
        subtotal:    cantidad * prod.precio_venta,
      }]);
      toast.success(`"${prod.nombre}" añadido al carrito`);
    }
    setUltimoAgregado(prod.id);
    setTimeout(() => setUltimoAgregado(null), 1500);
    setProductoSelId('');
    setCantidadItem(1);
  }

  function quitarItemVenta(producto_id: string) {
    setItemsVenta(prev => prev.filter(i => i.producto_id !== producto_id));
  }

  function editarCantidadItem(producto_id: string, nuevaCantidad: number) {
    const cantidad = Math.floor(nuevaCantidad);
    if (cantidad < 1 || cantidad > 999) return;
    setItemsVenta(prev => prev.map(i =>
      i.producto_id === producto_id
        ? { ...i, cantidad, subtotal: cantidad * i.precio_unit }
        : i
    ));
  }

  const totalVenta = itemsVenta.reduce((s, i) => s + i.subtotal, 0);

  // ── Guardar nueva venta ───────────────────────────────────────────────────
  async function handleGuardarVenta() {
    // CA-01: todos los campos requeridos
    if (!formVenta.evento_id)  { toast.error('Selecciona el evento en el que se realiza la venta'); return; }
    if (!formVenta.usuario_id) { toast.error('Selecciona el usuario comprador para continuar'); return; }
    // CA-02: al menos un producto en el carrito
    if (itemsVenta.length === 0) { toast.error('Agrega al menos un producto al carrito antes de registrar la venta'); return; }
    // CA-01: total válido
    if (totalVenta <= 0) { toast.error('El total de la venta debe ser mayor a cero'); return; }
    setGuardando(true);
    try {
      // 1. Crear cabecera de venta
      const { data: ventaData, error: ventaErr } = await supabase
        .from('ventas')
        .insert({
          evento_id:   formVenta.evento_id,
          usuario_id:  formVenta.usuario_id,
          fecha:       fechaLocalHoy(),
          subtotal:    totalVenta,
          descuento:   0,
          total:       totalVenta,
          estado:      'completada',
          metodo_pago: formVenta.metodoPago,
          notas:       formVenta.notas || null,
          created_by:  authUser?.id ?? null,
        })
        .select()
        .single();
      if (ventaErr) throw ventaErr;

      // 2. Insertar detalle
      const detalle = itemsVenta.map(i => ({
        venta_id:        ventaData.id,
        producto_id:     i.producto_id,
        cantidad:        i.cantidad,
        precio_unitario: i.precio_unit,
        subtotal:        i.subtotal,
      }));
      const { error: detErr } = await supabase.from('ventas_detalle').insert(detalle);
      if (detErr) throw detErr;

      toast.success('Venta registrada exitosamente');
      setIsNuevaVentaOpen(false);
      setFormVenta(emptyVenta);
      setItemsVenta([]);
      cargarVentas();
    } catch (err: any) {
      toast.error('Error al registrar venta: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function cargarVentas() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ventas')
        .select(`
          *,
          evento:eventos!evento_id(titulo, fecha),
          comprador:usuarios!usuario_id(nombre),
          creador:usuarios!created_by(nombre),
          anulador:usuarios!anulado_por(nombre),
          ventas_detalle(*, productos(nombre))
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const mapeadas = (data || []).map((v: any) => {
        const detalle   = v.ventas_detalle || [];
        const productos = detalle.map((d: any) => d.productos?.nombre ?? 'Producto').join(', ');
        const cantidad  = detalle.reduce((s: number, d: any) => s + (d.cantidad || 0), 0);
        return {
          id:          v.id,
          cliente:     v.comprador?.nombre ?? 'Sin nombre',
          usuario_id:  v.usuario_id,
          evento:      v.evento?.titulo ?? 'Sin evento',
          evento_fecha: v.evento?.fecha  ?? '',
          fecha:       v.fecha ? v.fecha.slice(0, 10) : null,
          createdAt:   v.created_at,
          creadoPor:   v.creador?.nombre ?? 'Sistema',
          productos:   productos || 'Sin productos',
          cantidad,
          total:       v.total,
          metodoPago:  v.metodo_pago ?? 'Efectivo',
          estado:      v.estado === 'completada' ? 'Completado'
                     : v.estado === 'pendiente'  ? 'Pendiente'
                     : v.estado,
          pedido:      `VEN-${v.id.slice(0, 6).toUpperCase()}`,
          anulado:           v.estado === 'anulada',
          motivoAnulacion:   v.motivo_anulacion ?? null,
          anuladoAt:         v.anulado_at       ?? null,
          anuladoPorNombre:  v.anulador?.nombre ?? null,
          detalle,
          notas:             v.notas,
        };
      });
      setVentas(mapeadas);
    } catch (err: any) {
      toast.error('Error al cargar ventas: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Fecha local YYYY-MM-DD (evita desfase de zona horaria UTC vs Colombia)
  const fechaLocalHoy = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Normaliza cualquier valor de fecha a YYYY-MM-DD en hora local
  const normalizarFecha = (val: string | null | undefined): string => {
    if (!val) return '';
    // Si ya es YYYY-MM-DD puro, devolverlo tal cual
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    // Si tiene hora (ISO completo), convertir a fecha local
    try {
      const d = new Date(val);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch { return val.slice(0, 10); }
  };

  // Categorías de productos para el filtro
  const CATEGORIAS_PRODUCTO: Record<string, string[]> = {
    'comida':  ['perro caliente', 'hamburguesa'],
    'bebida':  ['agua', 'gaseosa', 'licor'],
  };

  const aplicarFiltros = (lista: any[]) => lista.filter(v => {
    const term = searchTerm.toLowerCase();

    // Fecha normalizada de la venta (YYYY-MM-DD en hora local)
    const fechaVenta = normalizarFecha(v.fecha) || normalizarFecha(v.createdAt);

    // Criterio 1: busca por comprador, producto, N° venta o fecha
    const coincideTexto = !term ||
      v.cliente.toLowerCase().includes(term) ||
      v.productos.toLowerCase().includes(term) ||
      v.pedido.toLowerCase().includes(term) ||
      fechaVenta.includes(term);

    // Criterio 2: filtro por tipo de producto
    const coincideProducto = filtroProducto === 'todos' || (() => {
      const prods = v.productos.toLowerCase();
      const palabras = CATEGORIAS_PRODUCTO[filtroProducto] ?? [filtroProducto];
      return palabras.some((p: string) => prods.includes(p));
    })();

    // Criterio fecha: compara fecha local normalizada con el selector de fecha
    const coincideFecha = !filtroFecha || fechaVenta === filtroFecha;

    return coincideTexto && coincideProducto && coincideFecha;
  });

  const ventasActivas          = ventas.filter(v => !v.anulado);
  const ventasAnuladas         = ventas.filter(v =>  v.anulado);
  const filteredVentas         = aplicarFiltros(ventasActivas);
  const filteredVentasAnuladas = aplicarFiltros(ventasAnuladas);

  // CA-06: auto-switch pestaña cuando la búsqueda solo tiene resultado en una pestaña
  useEffect(() => {
    if (!searchTerm.trim()) return;
    const enActivas  = filteredVentas.length > 0;
    const enAnuladas = filteredVentasAnuladas.length > 0;
    if (enActivas && !enAnuladas) setActiveTab('activas');
    if (enAnuladas && !enActivas) setActiveTab('anuladas');
  }, [searchTerm, filteredVentas.length, filteredVentasAnuladas.length]);

  // Ordenar por fecha de registro
  const sortVentas = (list: any[]) =>
    [...list].sort((a, b) => {
      const da = a.createdAt ?? a.fecha ?? '';
      const db = b.createdAt ?? b.fecha ?? '';
      return sortOrder === 'desc' ? db.localeCompare(da) : da.localeCompare(db);
    });

  const sortedVentas         = sortVentas(filteredVentas);
  const sortedVentasAnuladas = sortVentas(filteredVentasAnuladas);

  // Toggle auditoría desplegable
  const toggleRow = (id: string) => setExpandedRows(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Reporte por periodo — las anuladas NUNCA se incluyen en totales financieros
  const ventasEnPeriodo = ventas.filter(v => {
    if (!reporteDesde && !reporteHasta) return true;
    const f = v.fecha ?? '';
    if (reporteDesde && f < reporteDesde) return false;
    if (reporteHasta && f > reporteHasta) return false;
    return true;
  });
  // Fuente única: ventas efectivas del periodo (excluye anuladas)
  const ventasEfectivasEnPeriodo = ventasEnPeriodo.filter(v => !v.anulado);
  const ventasAnuladasEnPeriodo  = ventasEnPeriodo.filter(v =>  v.anulado);

  const reporteTotalIngresos = ventasEfectivasEnPeriodo.reduce((s, v) => s + (v.total || 0), 0);
  const reportePorMetodo     = ventasEfectivasEnPeriodo.reduce((acc: Record<string, number>, v) => {
    const m = v.metodoPago ?? 'Efectivo';
    acc[m] = (acc[m] ?? 0) + (v.total || 0);
    return acc;
  }, {});

  const totalPages      = Math.max(1, Math.ceil(sortedVentas.length / itemsPerPage));
  const startIndex      = (currentPage - 1) * itemsPerPage;
  const endIndex        = startIndex + itemsPerPage;
  const currentVentas   = sortedVentas.slice(startIndex, endIndex);

  const totalPagesAnuladas    = Math.max(1, Math.ceil(sortedVentasAnuladas.length / itemsPerPage));
  const startIndexAnuladas    = (currentPageAnuladas - 1) * itemsPerPage;
  const endIndexAnuladas      = startIndexAnuladas + itemsPerPage;
  const currentVentasAnuladas = sortedVentasAnuladas.slice(startIndexAnuladas, endIndexAnuladas);

  // CA-03: suma total financiera del listado activo (todas las páginas, no solo la visible)
  const sumaListadoActivas  = sortedVentas.reduce((s, v) => s + (v.total || 0), 0);
  const sumaListadoAnuladas = sortedVentasAnuladas.reduce((s, v) => s + (v.total || 0), 0);

  // Paginación inteligente: muestra máx 7 botones con "..." cuando hay muchas páginas
  const buildPageRange = (current: number, total: number): (number | '...')[] => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const getEstadoColor = (estado: string) => {
    const c: Record<string, string> = {
      'Completado': 'bg-emerald-100 text-emerald-700',
      'Pendiente':  'bg-amber-100 text-amber-700',
      'En proceso': 'bg-blue-100 text-blue-700',
      'Cancelado':  'bg-red-100 text-red-700',
    };
    return c[estado] || 'bg-slate-100 text-slate-700';
  };

  const generateVentaPDF = (pdfData: {
    numeroVenta: string;
    fecha: string;
    cliente: string;
    evento: string;
    evento_fecha: string;
    creadoPor: string;
    registradoEl: string;
    notas: string;
    anulado: boolean;
    motivoAnulacion: string;
    anuladoAt: string;
    anuladoPorNombre: string;
    productos: { nombre: string; cantidad: number; precioUnitario: number; subtotal: number }[];
    subtotal: number;
    descuento: number;
    iva: number;
    total: number;
    metodoPago: string;
    estado: string;
  }): boolean => {
    // Validar datos mínimos antes de generar
    if (!pdfData.numeroVenta) { toast.error('No se puede generar la factura: falta el número de venta'); return false; }
    if (!pdfData.cliente)     { toast.error('No se puede generar la factura: falta el nombre del cliente'); return false; }
    if (!pdfData.productos || pdfData.productos.length === 0) { toast.error('No se puede generar la factura: la venta no tiene productos registrados'); return false; }
    if (!pdfData.total || pdfData.total <= 0) { toast.error('No se puede generar la factura: el total de la venta es inválido'); return false; }

    let doc: jsPDF | null = null;
    try {
      doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW  = doc.internal.pageSize.getWidth();
      const pageH  = doc.internal.pageSize.getHeight();
      const margin = 15;
      const colR   = pageW - margin;

      // ── Encabezado ──────────────────────────────────────────────
      const headerColor: [number, number, number] = pdfData.anulado ? [185, 28, 28] : [5, 150, 105];
      doc.setFillColor(...headerColor);
      doc.rect(0, 0, pageW, 32, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('UFCA — Factura de Venta', margin, 13);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`N° ${pdfData.numeroVenta}   ·   Fecha: ${pdfData.fecha ?? '—'}`, margin, 22);
      // Estado en esquina superior derecha
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(pdfData.anulado ? 'ANULADA' : pdfData.estado.toUpperCase(), colR, 13, { align: 'right' });

      let y = 42;

      // ── Bloque: Información general ─────────────────────────────
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, y - 5, pageW - margin * 2, 34, 2, 2, 'F');

      doc.setTextColor(71, 85, 105);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('CLIENTE', margin + 3, y);
      doc.text('EVENTO', margin + 70, y);
      doc.text('FECHA EVENTO', margin + 130, y);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(pdfData.cliente,      margin + 3,   y + 6);
      doc.text(pdfData.evento || '—', margin + 70,  y + 6);
      doc.text(pdfData.evento_fecha || '—', margin + 130, y + 6);

      doc.setTextColor(71, 85, 105);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('MÉTODO DE PAGO', margin + 3, y + 16);
      doc.text('REGISTRADO POR', margin + 70, y + 16);
      doc.text('REGISTRADO EL', margin + 130, y + 16);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(pdfData.metodoPago || '—', margin + 3,   y + 22);
      doc.text(pdfData.creadoPor  || '—', margin + 70,  y + 22);
      const fechaRegistro = pdfData.registradoEl
        ? new Date(pdfData.registradoEl).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
        : (pdfData.fecha || '—');
      doc.text(fechaRegistro, margin + 130, y + 22);

      y += 44;

      // ── Tabla de productos ───────────────────────────────────────
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Detalle de productos', margin, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [['Producto', 'Cantidad', 'Precio unitario', 'Subtotal']],
        body: pdfData.productos.map(p => [
          p.nombre,
          String(p.cantidad),
          formatCurrency(p.precioUnitario),
          formatCurrency(p.subtotal),
        ]),
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [71, 85, 105],
          fontStyle: 'bold',
          fontSize: 9,
        },
        bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right', fontStyle: 'bold' },
        },
        margin: { left: margin, right: margin },
        theme: 'grid',
      });

      // ── Totales ──────────────────────────────────────────────────
      let yAfter = (doc as any).lastAutoTable.finalY + 6;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Subtotal:', colR - 60, yAfter);
      doc.text(formatCurrency(pdfData.subtotal), colR, yAfter, { align: 'right' });

      if (pdfData.descuento > 0) {
        yAfter += 6;
        doc.text('Descuento:', colR - 60, yAfter);
        doc.text(`- ${formatCurrency(pdfData.descuento)}`, colR, yAfter, { align: 'right' });
      }

      // Total final
      yAfter += 8;
      const totalColor: [number, number, number] = pdfData.anulado ? [185, 28, 28] : [5, 150, 105];
      doc.setFillColor(...totalColor);
      doc.roundedRect(colR - 65, yAfter - 5, 65, 12, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL:', colR - 58, yAfter + 3);
      doc.text(formatCurrency(pdfData.total), colR - 3, yAfter + 3, { align: 'right' });

      yAfter += 18;

      // ── Notas ────────────────────────────────────────────────────
      if (pdfData.notas && pdfData.notas.trim()) {
        doc.setFillColor(254, 243, 199); // amber-100
        doc.roundedRect(margin, yAfter, pageW - margin * 2, 18, 2, 2, 'F');
        doc.setTextColor(120, 53, 15);   // amber-900
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('NOTAS', margin + 3, yAfter + 5);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(pdfData.notas.slice(0, 180), margin + 3, yAfter + 12);
        yAfter += 24;
      }

      // ── Sección de anulación (solo si está anulada) ──────────────
      if (pdfData.anulado) {
        doc.setDrawColor(185, 28, 28);
        doc.setFillColor(254, 242, 242); // red-50
        doc.roundedRect(margin, yAfter, pageW - margin * 2, 38, 2, 2, 'FD');

        doc.setTextColor(185, 28, 28);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('⚠ REGISTRO DE ANULACIÓN', margin + 4, yAfter + 8);

        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(185, 28, 28);
        doc.text('ANULADO EL', margin + 4, yAfter + 17);
        doc.text('ANULADO POR', margin + 80, yAfter + 17);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(127, 29, 29); // red-900
        const fechaAnulacion = pdfData.anuladoAt
          ? new Date(pdfData.anuladoAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
          : '—';
        doc.text(fechaAnulacion, margin + 4, yAfter + 24);
        doc.text(pdfData.anuladoPorNombre || '—', margin + 80, yAfter + 24);

        if (pdfData.motivoAnulacion) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(185, 28, 28);
          doc.text('MOTIVO', margin + 4, yAfter + 33);
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(127, 29, 29);
          doc.text(pdfData.motivoAnulacion.slice(0, 200), margin + 25, yAfter + 33);
        }
      }

      // ── Pie de página ────────────────────────────────────────────
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Generado por el sistema UFCA', margin, pageH - 10);
      doc.text(new Date().toLocaleString('es-CO'), colR, pageH - 10, { align: 'right' });

      // Solo guardar si el documento se construyó correctamente
      const pdfBytes = doc.output('arraybuffer');
      if (!pdfBytes || pdfBytes.byteLength < 100) {
        toast.error('El PDF generado está vacío o corrupto. Intenta de nuevo.');
        return false;
      }
      doc.save(`${pdfData.numeroVenta}.pdf`);
      return true;
    } catch (err: any) {
      // No llegar a doc.save() — el archivo no se descarga
      const msg = err?.message ?? 'Error desconocido';
      toast.error(`No se pudo generar la factura: ${msg}`);
      return false;
    }
  };

  const handleAnular = async () => {
    if (!selectedItem) return;
    if (!motivoAnulacion.trim()) { toast.error('Debes indicar el motivo de anulación'); return; }
    if (!authUser?.id) { toast.error('No se pudo identificar el usuario. Vuelve a iniciar sesión.'); return; }
    try {
      const ahora = new Date().toISOString();
      await ventasApi.anular(selectedItem.id, motivoAnulacion.trim(), authUser.id);
      setVentas(prev => prev.map(v =>
        v.id === selectedItem.id
          ? { ...v, anulado: true, motivoAnulacion: motivoAnulacion.trim(), anuladoAt: ahora, anuladoPorNombre: authUser.nombre }
          : v
      ));
      toast.success(`Venta "${selectedItem.pedido}" anulada exitosamente`);
      setMotivoAnulacion('');
      setIsAnularDialogOpen(false);
      setSelectedItem(null);
    } catch (err: any) {
      toast.error('Error al anular venta: ' + err.message);
    }
  };

  const handleEliminarDefinitivo = async () => {
    if (!selectedItem) return;
    try {
      await supabase.from('ventas').delete().eq('id', selectedItem.id);
      setVentas(prev => prev.filter(v => v.id !== selectedItem.id));
      toast.success(`Venta "${selectedItem.pedido}" eliminada permanentemente`);
    } catch (err: any) {
      toast.error('Error al eliminar venta: ' + err.message);
    }
    setIsEliminarDialogOpen(false);
    setSelectedItem(null);
  };

  const [editForm, setEditForm] = useState({ metodoPago: '', notas: '' });

  const handleEdit = async () => {
    if (!selectedItem) return;
    try {
      const { error } = await supabase
        .from('ventas')
        .update({
          metodo_pago: editForm.metodoPago || selectedItem.metodoPago,
          notas:       editForm.notas !== undefined ? editForm.notas : selectedItem.notas,
        })
        .eq('id', selectedItem.id);
      if (error) throw error;
      setVentas(prev => prev.map(v => v.id === selectedItem.id
        ? { ...v, metodoPago: editForm.metodoPago || selectedItem.metodoPago, notas: editForm.notas }
        : v
      ));
      toast.success('Venta actualizada correctamente');
      setIsEditDialogOpen(false);
      setSelectedItem(null);
    } catch (err: any) {
      toast.error('Error al actualizar venta: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando ventas...</p>
        </div>
      </div>
    );
  }

  const renderTable = (ventasList: any[], isAnuladas: boolean = false, expanded: Set<string> = expandedRows, toggle: (id: string) => void = toggleRow) => (
    <>
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-slate-800 transition-colors font-medium"
                  onClick={() => { setSortOrder(o => o === 'desc' ? 'asc' : 'desc'); setCurrentPage(1); setCurrentPageAnuladas(1); }}
                  title={sortOrder === 'desc' ? 'Más reciente primero — clic para invertir' : 'Más antiguo primero — clic para invertir'}
                >
                  Fecha
                  {sortOrder === 'desc' ? <ArrowDown className="size-3.5 text-emerald-600" /> : <ArrowUp className="size-3.5 text-emerald-600" />}
                </button>
              </TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Método de pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ventasList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                  {isAnuladas ? 'No hay ventas anuladas' : 'No hay ventas registradas'}
                </TableCell>
              </TableRow>
            ) : (
              ventasList.map((venta) => (
                <Fragment key={venta.id}>
                <TableRow
                  className={`cursor-pointer hover:bg-blue-50/50 transition-colors ${expanded.has(venta.id) ? 'bg-slate-50' : ''}`}
                  onClick={() => { setSelectedItem(venta); setIsDetailDialogOpen(true); }}
                >
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={e => { e.stopPropagation(); toggle(venta.id); }}
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                        title={expanded.has(venta.id) ? 'Cerrar auditoría' : 'Ver auditoría'}
                      >
                        {expanded.has(venta.id)
                          ? <ChevronUp className="size-4" />
                          : <ChevronDown className="size-4" />}
                      </button>
                      <Badge variant="outline" className="font-mono text-xs">
                        {venta.pedido}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-pink-100 shrink-0">
                        <Calendar className="size-4 text-pink-600" />
                      </div>
                      <div>
                        <p className="text-slate-800 text-sm leading-tight">{venta.evento}</p>
                        <p className="text-slate-400 text-xs">{venta.evento_fecha}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${isAnuladas ? 'bg-slate-100' : 'bg-blue-100'}`}>
                        <ShoppingCart className={`size-4 ${isAnuladas ? 'text-slate-600' : 'text-blue-600'}`} />
                      </div>
                      <p className="text-slate-900">{venta.cliente}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-600">{venta.fecha}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-600">{venta.productos}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">
                      {venta.cantidad} items
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-900">{formatCurrency(venta.total)}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{venta.metodoPago}</Badge>
                  </TableCell>
                  <TableCell>
                    {isAnuladas ? (
                      <Badge className="bg-red-100 text-red-700">
                        Anulada
                      </Badge>
                    ) : (
                      <Badge className={getEstadoColor(venta.estado)}>
                        {venta.estado}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-2 justify-end">
                      {!isAnuladas && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={e => { e.stopPropagation(); setSelectedItem(venta); setEditForm({ metodoPago: venta.metodoPago ?? '', notas: venta.notas ?? '' }); setIsEditDialogOpen(true); }}
                            title="Editar venta"
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={e => { e.stopPropagation(); setSelectedItem(venta); setIsAnularDialogOpen(true); }}
                            title="Anular venta"
                          >
                            <XCircle className="size-4 text-amber-600" />
                          </Button>
                        </>
                      )}
                      {isAnuladas && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={e => { e.stopPropagation(); setSelectedItem(venta); setIsEliminarDialogOpen(true); }}
                          title="Eliminar permanentemente"
                        >
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={e => {
                          e.stopPropagation();
                          const pdfData = {
                            numeroVenta:      venta.pedido,
                            fecha:            venta.fecha,
                            cliente:          venta.cliente,
                            evento:           venta.evento,
                            evento_fecha:     venta.evento_fecha,
                            creadoPor:        venta.creadoPor,
                            registradoEl:     venta.createdAt,
                            notas:            venta.notas ?? '',
                            anulado:          venta.anulado,
                            motivoAnulacion:  venta.motivoAnulacion ?? '',
                            anuladoAt:        venta.anuladoAt        ?? '',
                            anuladoPorNombre: venta.anuladoPorNombre ?? '',
                            productos: venta.detalle?.length > 0
                              ? venta.detalle.map((d: any) => ({
                                  nombre: d.productos?.nombre ?? 'Producto',
                                  cantidad: d.cantidad,
                                  precioUnitario: d.precio_unitario ?? 0,
                                  subtotal: d.subtotal,
                                }))
                              : [{ nombre: venta.productos, cantidad: venta.cantidad, precioUnitario: venta.total / Math.max(venta.cantidad, 1), subtotal: venta.total }],
                            subtotal:   venta.total,
                            descuento:  0,
                            iva:        0,
                            total:      venta.total,
                            metodoPago: venta.metodoPago,
                            estado:     venta.estado,
                          };
                          const success = generateVentaPDF(pdfData);
                          if (success) toast.success('Factura descargada correctamente');
                        }}
                        title="Descargar factura"
                        className="hover:bg-emerald-50"
                      >
                        <FileText className="size-4 text-emerald-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {/* Fila de auditoría desplegable */}
                {expanded.has(venta.id) && (
                  <TableRow className={venta.anulado ? 'bg-red-50 border-t-0' : 'bg-slate-50 border-t-0'}>
                    <TableCell colSpan={10} className="py-0">
                      <div className={`px-4 py-4 ml-6 space-y-3 border-l-4 ${venta.anulado ? 'border-red-400' : 'border-emerald-400'}`}>

                        {/* ── Registro de creación ─────────────────────── */}
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Registro de la transacción</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div className="flex items-start gap-2">
                            <Clock className="size-4 text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs text-slate-500">Registrado el</p>
                              <p className="text-slate-800 font-medium">
                                {venta.createdAt
                                  ? new Date(venta.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                                  : venta.fecha}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <User2 className="size-4 text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs text-slate-500">Registrado por</p>
                              <p className="text-slate-800 font-medium">{venta.creadoPor}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Calendar className="size-4 text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs text-slate-500">Evento</p>
                              <p className="text-slate-800 font-medium">{venta.evento}{venta.evento_fecha ? ` · ${venta.evento_fecha}` : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <ShoppingCart className="size-4 text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs text-slate-500">Método de pago</p>
                              <p className="text-slate-800 font-medium">{venta.metodoPago}</p>
                            </div>
                          </div>
                        </div>

                        {/* ── Registro de anulación ────────────────────── */}
                        {venta.anulado && (
                          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 space-y-2">
                            <p className="text-xs font-bold text-red-700 uppercase tracking-wide flex items-center gap-1.5">
                              <XCircle className="size-3.5" /> Registro de anulación
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="flex items-start gap-2">
                                <Clock className="size-4 text-red-400 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-xs text-red-500">Fecha y hora</p>
                                  <p className="text-red-800 font-semibold">
                                    {venta.anuladoAt
                                      ? new Date(venta.anuladoAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                                      : '—'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <User2 className="size-4 text-red-400 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-xs text-red-500">Anulado por</p>
                                  <p className="text-red-800 font-semibold">{venta.anuladoPorNombre ?? '—'}</p>
                                </div>
                              </div>
                            </div>
                            {venta.motivoAnulacion && (
                              <div className="border-t border-red-200 pt-2">
                                <p className="text-xs text-red-500 mb-0.5">Motivo</p>
                                <p className="text-sm text-red-800">{venta.motivoAnulacion}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Productos ────────────────────────────────── */}
                        {venta.detalle && venta.detalle.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1.5">Detalle de productos</p>
                            <div className="rounded border border-slate-200 overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-white text-slate-500">
                                  <tr>
                                    <th className="text-left px-3 py-1.5">Producto</th>
                                    <th className="text-center px-3 py-1.5">Cant.</th>
                                    <th className="text-right px-3 py-1.5">Precio unit.</th>
                                    <th className="text-right px-3 py-1.5">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {venta.detalle.map((d: any, idx: number) => (
                                    <tr key={idx} className="border-t border-slate-100">
                                      <td className="px-3 py-1.5 text-slate-700">{d.productos?.nombre ?? 'Producto'}</td>
                                      <td className="px-3 py-1.5 text-center text-slate-700">{d.cantidad}</td>
                                      <td className="px-3 py-1.5 text-right text-slate-700">{formatCurrency(d.precio_unitario ?? 0)}</td>
                                      <td className="px-3 py-1.5 text-right font-semibold text-slate-800">{formatCurrency(d.subtotal ?? 0)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className={`border-t border-slate-200 ${venta.anulado ? 'bg-red-50' : 'bg-emerald-50'}`}>
                                  <tr>
                                    <td colSpan={3} className="px-3 py-1.5 text-right text-slate-600 font-semibold">Total</td>
                                    <td className={`px-3 py-1.5 text-right font-bold ${venta.anulado ? 'text-red-600 line-through' : 'text-emerald-700'}`}>
                                      {formatCurrency(venta.total)}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Notas (solo ventas no anuladas) */}
                        {!venta.anulado && venta.notas && (
                          <p className="text-xs text-slate-500">
                            <span className="font-semibold">Notas:</span> {venta.notas}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">Gestión de Ventas</h1>
            <p className="text-slate-600">Administra las ventas realizadas</p>
          </div>
          <div className="flex gap-2">
            {authUser && (
              <Button variant="outline" className="gap-2" onClick={() => setIsReporteOpen(true)}>
                <TrendingUp className="size-4 text-emerald-600" />
                Generar reporte
              </Button>
            )}
          {/* Botón de Nueva venta eliminado: la creación de ventas debe ser gestión centralizada */}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <CardTitle>Lista de Ventas</CardTitle>
                <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                  {/* Búsqueda por comprador, producto o fecha */}
                  <div className="relative flex-1 sm:flex-none sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input
                      placeholder="Comprador, producto, N° venta…"
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                        setCurrentPageAnuladas(1);
                      }}
                    />
                  </div>
                  {/* Filtro por tipo de producto */}
                  <Select value={filtroProducto} onValueChange={v => { setFiltroProducto(v); setCurrentPage(1); setCurrentPageAnuladas(1); }}>
                    <SelectTrigger className="w-36">
                      <Filter className="size-4 mr-1 text-slate-400" />
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="comida">Comida</SelectItem>
                      <SelectItem value="bebida">Bebida</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Filtro por fecha */}
                  <Input
                    type="date"
                    className="w-40"
                    value={filtroFecha}
                    onChange={e => { setFiltroFecha(e.target.value); setCurrentPage(1); setCurrentPageAnuladas(1); }}
                    title="Filtrar por fecha"
                  />
                  {/* Limpiar filtros */}
                  {(searchTerm || filtroProducto !== 'todos' || filtroFecha) && (
                    <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700 px-2" onClick={() => { setSearchTerm(''); setFiltroProducto('todos'); setFiltroFecha(''); setCurrentPage(1); setCurrentPageAnuladas(1); }}>
                      <XCircle className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
              {/* Criterio 3: resumen rápido de resultados filtrados */}
              {(searchTerm || filtroProducto !== 'todos' || filtroFecha) && (
                <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm">
                  <span className="text-slate-500">Resultados:</span>
                  <span className="font-semibold text-slate-700">{sortedVentas.length + sortedVentasAnuladas.length} ventas encontradas</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500">Total activas:</span>
                  <span className="font-semibold text-emerald-700">{formatCurrency(sortedVentas.reduce((s, v) => s + (v.total || 0), 0))}</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* CA-05: pestañas controladas con conteo independiente por cada una */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="activas" className="gap-2">
                  <ShoppingCart className="size-4" />
                  Ventas Activas ({sortedVentas.length})
                </TabsTrigger>
                <TabsTrigger value="anuladas" className="gap-2">
                  <XCircle className="size-4" />
                  Ventas Anuladas ({sortedVentasAnuladas.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="activas" className="space-y-4">
                {renderTable(currentVentas, false, expandedRows, toggleRow)}

                {/* CA-03: suma total financiera siempre visible */}
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    {sortedVentas.length > 0 ? (
                      <>
                        <span>
                          Mostrando <strong>{sortedVentas.length === 0 ? 0 : startIndex + 1}–{Math.min(endIndex, sortedVentas.length)}</strong> de <strong>{sortedVentas.length}</strong> ventas
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="flex items-center gap-1">
                          Ordenado por fecha
                          {sortOrder === 'desc'
                            ? <><ArrowDown className="size-3.5 text-emerald-600" /><span className="text-xs text-slate-500">más reciente primero</span></>
                            : <><ArrowUp   className="size-3.5 text-emerald-600" /><span className="text-xs text-slate-500">más antiguo primero</span></>}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400">Sin ventas registradas</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-700 font-medium">Total listado:</span>
                    <span className="text-base font-bold text-emerald-700">{formatCurrency(sumaListadoActivas)}</span>
                  </div>
                </div>

                {/* Paginación inteligente */}
                {sortedVentas.length > 0 && (
                  <div className="flex justify-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="size-4" />
                    </Button>
                    {buildPageRange(currentPage, totalPages).map((page, idx) =>
                      page === '...'
                        ? <span key={`dots-${idx}`} className="px-2 py-1 text-slate-400 text-sm self-center">…</span>
                        : <Button
                            key={page}
                            variant={currentPage === page ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(page as number)}
                            className={currentPage === page ? 'bg-emerald-600 hover:bg-emerald-700 min-w-[32px]' : 'min-w-[32px]'}
                          >{page}</Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="anuladas" className="space-y-4">
                {renderTable(currentVentasAnuladas, true, expandedRows, toggleRow)}

                {sortedVentasAnuladas.length > 0 && (
                  <>
                    {/* Suma del listado de anuladas */}
                    <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                      <span className="text-sm text-slate-600">
                        Mostrando <strong>{startIndexAnuladas + 1}–{Math.min(endIndexAnuladas, sortedVentasAnuladas.length)}</strong> de <strong>{sortedVentasAnuladas.length}</strong> ventas anuladas
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600 font-medium">Monto anulado:</span>
                        <span className="text-base font-bold text-red-600 line-through">{formatCurrency(sumaListadoAnuladas)}</span>
                      </div>
                    </div>

                    {/* Paginación anuladas */}
                    <div className="flex justify-center gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPageAnuladas(p => Math.max(1, p - 1))} disabled={currentPageAnuladas === 1}>
                        <ChevronLeft className="size-4" />
                      </Button>
                      {buildPageRange(currentPageAnuladas, totalPagesAnuladas).map((page, idx) =>
                        page === '...'
                          ? <span key={`dots-a-${idx}`} className="px-2 py-1 text-slate-400 text-sm self-center">…</span>
                          : <Button
                              key={page}
                              variant={currentPageAnuladas === page ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setCurrentPageAnuladas(page as number)}
                              className={currentPageAnuladas === page ? 'bg-emerald-600 hover:bg-emerald-700 min-w-[32px]' : 'min-w-[32px]'}
                            >{page}</Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setCurrentPageAnuladas(p => Math.min(totalPagesAnuladas, p + 1))} disabled={currentPageAnuladas === totalPagesAnuladas}>
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Detalles */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {selectedItem && (
            <>
              {/* Header con color */}
              <div className={`px-6 pt-6 pb-4 rounded-t-lg ${selectedItem.anulado ? 'bg-red-50 border-b border-red-100' : 'bg-emerald-50 border-b border-emerald-100'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono text-sm font-bold border-slate-400 text-slate-700">
                        {selectedItem.pedido}
                      </Badge>
                      <Badge className={selectedItem.anulado ? 'bg-red-100 text-red-700' : getEstadoColor(selectedItem.estado)}>
                        {selectedItem.anulado ? 'Anulada' : selectedItem.estado}
                      </Badge>
                    </div>
                    <p className="text-slate-500 text-sm">{selectedItem.fecha}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 mb-0.5">Total de la venta</p>
                    <p className={`text-3xl font-bold ${selectedItem.anulado ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatCurrency(selectedItem.total)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Evento y comprador */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-pink-50 border border-pink-100 rounded-xl p-4 flex items-start gap-3">
                    <div className="p-2 bg-pink-100 rounded-lg shrink-0">
                      <Calendar className="size-4 text-pink-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Evento</p>
                      <p className="text-slate-800 font-semibold text-sm leading-tight">{selectedItem.evento}</p>
                      {selectedItem.evento_fecha && <p className="text-xs text-slate-400 mt-0.5">{selectedItem.evento_fecha}</p>}
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                      <User2 className="size-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Comprador</p>
                      <p className="text-slate-800 font-semibold text-sm">{selectedItem.cliente}</p>
                    </div>
                  </div>
                </div>

                {/* Método de pago y auditoría */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Método de pago</p>
                    <p className="text-slate-800 font-semibold capitalize">{selectedItem.metodoPago}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Total items</p>
                    <p className="text-slate-800 font-semibold">{selectedItem.cantidad} productos</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Registrado por</p>
                    <p className="text-slate-800 font-semibold text-sm truncate">{selectedItem.creadoPor}</p>
                  </div>
                </div>

                {/* Tabla de productos */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <ShoppingCart className="size-4 text-emerald-600" />
                    Productos de la venta
                  </p>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                        <tr>
                          <th className="text-left px-4 py-2.5">Producto</th>
                          <th className="text-center px-4 py-2.5">Cant.</th>
                          <th className="text-right px-4 py-2.5">Precio unit.</th>
                          <th className="text-right px-4 py-2.5">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedItem.detalle && selectedItem.detalle.length > 0
                          ? selectedItem.detalle.map((d: any, idx: number) => (
                              <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-4 py-3 font-medium text-slate-800">{d.productos?.nombre ?? 'Producto'}</td>
                                <td className="px-4 py-3 text-center">
                                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">{d.cantidad}</Badge>
                                </td>
                                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(d.precio_unitario ?? 0)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(d.subtotal ?? 0)}</td>
                              </tr>
                            ))
                          : (
                              <tr className="border-t border-slate-100">
                                <td className="px-4 py-3 text-slate-500">{selectedItem.productos}</td>
                                <td className="px-4 py-3 text-center">{selectedItem.cantidad}</td>
                                <td className="px-4 py-3 text-right">—</td>
                                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(selectedItem.total)}</td>
                              </tr>
                            )
                        }
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200">
                        <tr className={selectedItem.anulado ? 'bg-red-50' : 'bg-emerald-50'}>
                          <td colSpan={3} className="px-4 py-3 text-right font-bold text-slate-700">Total</td>
                          <td className={`px-4 py-3 text-right font-bold text-lg ${selectedItem.anulado ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatCurrency(selectedItem.total)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Auditoría de anulación */}
                {selectedItem.anulado && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 space-y-3">
                    <p className="text-xs font-bold text-red-700 uppercase tracking-wide flex items-center gap-1.5">
                      <XCircle className="size-3.5" /> Auditoría de anulación
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-start gap-2">
                        <Clock className="size-4 text-red-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-red-500">Fecha y hora</p>
                          <p className="text-red-800 font-medium">
                            {selectedItem.anuladoAt
                              ? new Date(selectedItem.anuladoAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                              : '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <User2 className="size-4 text-red-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-red-500">Anulado por</p>
                          <p className="text-red-800 font-medium">{selectedItem.anuladoPorNombre ?? '—'}</p>
                        </div>
                      </div>
                    </div>
                    {selectedItem.motivoAnulacion && (
                      <div className="border-t border-red-200 pt-2">
                        <p className="text-xs text-red-500 mb-1">Motivo</p>
                        <p className="text-sm text-red-800">{selectedItem.motivoAnulacion}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Notas (ventas no anuladas) */}
                {!selectedItem.anulado && selectedItem.notas && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                    <FileText className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-amber-700 font-semibold mb-0.5">Notas</p>
                      <p className="text-sm text-amber-800">{selectedItem.notas}</p>
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                {selectedItem.createdAt && (
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Clock className="size-3.5" />
                    Registrada el {new Date(selectedItem.createdAt).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}
                  </p>
                )}
              </div>

              <div className="px-6 pb-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>Cerrar</Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                  onClick={() => {
                    const pdfData = {
                      numeroVenta:      selectedItem.pedido,
                      fecha:            selectedItem.fecha,
                      cliente:          selectedItem.cliente,
                      evento:           selectedItem.evento,
                      evento_fecha:     selectedItem.evento_fecha,
                      creadoPor:        selectedItem.creadoPor,
                      registradoEl:     selectedItem.createdAt,
                      notas:            selectedItem.notas ?? '',
                      anulado:          selectedItem.anulado,
                      motivoAnulacion:  selectedItem.motivoAnulacion ?? '',
                      anuladoAt:        selectedItem.anuladoAt        ?? '',
                      anuladoPorNombre: selectedItem.anuladoPorNombre ?? '',
                      productos: selectedItem.detalle?.length > 0
                        ? selectedItem.detalle.map((d: any) => ({ nombre: d.productos?.nombre ?? 'Producto', cantidad: d.cantidad, precioUnitario: d.precio_unitario ?? 0, subtotal: d.subtotal }))
                        : [{ nombre: selectedItem.productos, cantidad: selectedItem.cantidad, precioUnitario: selectedItem.total / Math.max(selectedItem.cantidad, 1), subtotal: selectedItem.total }],
                      subtotal:   selectedItem.total,
                      descuento:  0,
                      iva:        0,
                      total:      selectedItem.total,
                      metodoPago: selectedItem.metodoPago,
                      estado:     selectedItem.estado,
                    };
                    const ok = generateVentaPDF(pdfData);
                    if (ok) toast.success('Factura descargada');
                  }}
                >
                  <FileText className="size-4" /> Descargar factura
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={open => {
        setIsEditDialogOpen(open);
        if (!open) setSelectedItem(null);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="size-5 text-slate-600" />
              Editar venta
            </DialogTitle>
            <DialogDescription>
              Solo se puede modificar el método de pago y las notas de una venta registrada.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 py-2">
              {/* Resumen no editable */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Venta</p>
                  <p className="font-semibold text-slate-800">{selectedItem.pedido}</p>
                  <p className="text-sm text-slate-500">{selectedItem.cliente} · {selectedItem.fecha}</p>
                </div>
                <p className="text-emerald-700 font-bold text-lg">{formatCurrency(selectedItem.total)}</p>
              </div>

              {/* Método de pago */}
              <div className="space-y-1.5">
                <Label>Método de pago</Label>
                <Select
                  value={editForm.metodoPago || selectedItem.metodoPago}
                  onValueChange={v => setEditForm(p => ({ ...p, metodoPago: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="nequi">Nequi / Daviplata</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notas */}
              <div className="space-y-1.5">
                <Label>Notas u observaciones</Label>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  placeholder="Observaciones opcionales..."
                  value={editForm.notas !== undefined ? editForm.notas : (selectedItem.notas ?? '')}
                  onChange={e => setEditForm(p => ({ ...p, notas: e.target.value }))}
                  maxLength={300}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setSelectedItem(null); }}>
              Cancelar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={handleEdit}>
              <Edit className="size-4" />
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog para Anular */}
      <Dialog open={isAnularDialogOpen} onOpenChange={open => { setIsAnularDialogOpen(open); if (!open) { setMotivoAnulacion(''); setSelectedItem(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <XCircle className="size-5 text-amber-600" />
              Anular venta
            </DialogTitle>
            <DialogDescription>
              Esta acción marcará la venta como anulada y no podrá revertirse fácilmente.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 py-1">
              {/* Resumen de la venta */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 font-medium">Venta a anular</p>
                  <p className="text-slate-800 font-semibold">{selectedItem.pedido}</p>
                  <p className="text-slate-500 text-sm">{selectedItem.cliente} · {selectedItem.fecha}</p>
                </div>
                <p className="text-amber-700 font-bold text-lg">{formatCurrency(selectedItem.total)}</p>
              </div>

              {/* Campo de motivo — obligatorio */}
              <div className="space-y-1.5">
                <Label htmlFor="motivo-anulacion">
                  Motivo de anulación <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="motivo-anulacion"
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  placeholder="Ej: Error en el registro, producto devuelto, cobro duplicado..."
                  value={motivoAnulacion}
                  onChange={e => setMotivoAnulacion(e.target.value)}
                  maxLength={300}
                />
                <p className="text-xs text-slate-400 text-right">{motivoAnulacion.length}/300</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsAnularDialogOpen(false); setMotivoAnulacion(''); setSelectedItem(null); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleAnular}
              disabled={!motivoAnulacion.trim()}
              className="bg-amber-600 hover:bg-amber-700 gap-2"
            >
              <XCircle className="size-4" />
              Confirmar anulación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: Nueva Venta ────────────────────────────────── */}
      <Dialog open={isNuevaVentaOpen} onOpenChange={open => { setIsNuevaVentaOpen(open); if (!open) { setFormVenta(emptyVenta); setItemsVenta([]); setProductoSelId(''); setCantidadItem(1); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShoppingCart className="size-5 text-emerald-600" /> Registrar Nueva Venta</DialogTitle>
            <DialogDescription>Completa los datos para registrar una nueva venta al sistema.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">

            {/* Evento — obligatorio según lógica de negocio */}
            <div className="space-y-1.5">
              <Label>Evento <span className="text-red-500">*</span></Label>
              <Select value={formVenta.evento_id} onValueChange={v => setFormVenta(p => ({ ...p, evento_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar evento activo..." /></SelectTrigger>
                <SelectContent>
                  {catalogoEventos.length === 0
                    ? <SelectItem value="__none__" disabled>No hay eventos activos — crea uno en Eventos</SelectItem>
                    : catalogoEventos.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.titulo} · {e.fecha}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
              {catalogoEventos.length === 0 && (
                <p className="text-xs text-amber-600">No hay eventos en curso. Ve al módulo Eventos y crea o activa uno.</p>
              )}
            </div>

            {/* Usuario + método de pago */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Usuario (comprador) <span className="text-red-500">*</span></Label>
                <Select value={formVenta.usuario_id} onValueChange={v => setFormVenta(p => ({ ...p, usuario_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar usuario..." /></SelectTrigger>
                  <SelectContent>
                    {catalogoUsuarios.map(u => <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Método de pago</Label>
                <Select value={formVenta.metodoPago} onValueChange={v => setFormVenta(p => ({ ...p, metodoPago: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="nequi">Nequi / Daviplata</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Agregar productos */}
            <div className="space-y-3">
              <Label>Productos <span className="text-red-500">*</span></Label>

              {/* Selector + cantidad + botón */}
              <div className="flex gap-2 items-start">
                <div className="flex-1 space-y-1">
                  <Select value={productoSelId} onValueChange={v => { setProductoSelId(v); setCantidadItem(1); }}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar producto…" /></SelectTrigger>
                    <SelectContent>
                      {catalogoProductos.length === 0
                        ? <SelectItem value="__none__" disabled>No hay productos disponibles</SelectItem>
                        : catalogoProductos.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nombre} — {formatCurrency(p.precio_venta)}
                            </SelectItem>
                          ))
                      }
                    </SelectContent>
                  </Select>
                  {/* Vista previa del precio unitario */}
                  {productoPreview && (
                    <p className="text-xs text-emerald-700 font-medium pl-1">
                      Precio unitario: <span className="font-bold">{formatCurrency(productoPreview.precio_venta)}</span>
                      {cantidadItem > 1 && (
                        <span className="ml-2 text-slate-500">
                          · Subtotal: <span className="font-bold text-emerald-700">{formatCurrency(productoPreview.precio_venta * cantidadItem)}</span>
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Controles de cantidad */}
                <div className="flex items-center border rounded-md overflow-hidden shrink-0">
                  <button
                    type="button"
                    className="px-2.5 py-2 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-40"
                    onClick={() => setCantidadItem(q => Math.max(1, q - 1))}
                    disabled={cantidadItem <= 1}
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={cantidadItem}
                    onChange={e => setCantidadItem(Math.max(1, Math.min(999, parseInt(e.target.value) || 1)))}
                    className="w-12 text-center text-sm border-x py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    className="px-2.5 py-2 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-40"
                    onClick={() => setCantidadItem(q => Math.min(999, q + 1))}
                    disabled={cantidadItem >= 999}
                  >+</button>
                </div>

                <Button
                  type="button"
                  onClick={agregarItemVenta}
                  disabled={!productoSelId}
                  className="bg-emerald-600 hover:bg-emerald-700 shrink-0 gap-1.5"
                >
                  <Plus className="size-4" /> Agregar
                </Button>
              </div>

              {/* Carrito */}
              {itemsVenta.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-lg py-6 text-center text-slate-400 text-sm">
                  <ShoppingCart className="size-8 mx-auto mb-2 opacity-30" />
                  El carrito está vacío — selecciona un producto y haz clic en Agregar
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-3 py-2">Producto</th>
                        <th className="text-center px-3 py-2">Cantidad</th>
                        <th className="text-right px-3 py-2">Precio unit.</th>
                        <th className="text-right px-3 py-2">Subtotal</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsVenta.map(i => (
                        <tr
                          key={i.producto_id}
                          className={`border-t transition-colors duration-700 ${ultimoAgregado === i.producto_id ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-3 py-2.5 font-medium text-slate-800">{i.nombre}</td>
                          <td className="px-3 py-2.5 text-center">
                            {/* Cantidad editable en carrito */}
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                className="size-5 rounded text-slate-400 hover:bg-slate-200 flex items-center justify-center text-xs font-bold"
                                onClick={() => editarCantidadItem(i.producto_id, i.cantidad - 1)}
                                disabled={i.cantidad <= 1}
                              >−</button>
                              <span className="w-8 text-center font-semibold text-slate-700">{i.cantidad}</span>
                              <button
                                type="button"
                                className="size-5 rounded text-slate-400 hover:bg-slate-200 flex items-center justify-center text-xs font-bold"
                                onClick={() => editarCantidadItem(i.producto_id, i.cantidad + 1)}
                                disabled={i.cantidad >= 999}
                              >+</button>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-500">{formatCurrency(i.precio_unit)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-slate-800">{formatCurrency(i.subtotal)}</td>
                          <td className="px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => quitarItemVenta(i.producto_id)}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                              title="Eliminar del carrito"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                      <tr>
                        <td colSpan={3} className="px-3 py-2.5 text-right font-semibold text-slate-600">
                          {itemsVenta.length} producto{itemsVenta.length > 1 ? 's' : ''} · Total:
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-emerald-700 text-base">{formatCurrency(totalVenta)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label>Notas u observaciones</Label>
              <Input value={formVenta.notas} onChange={e => setFormVenta(p => ({ ...p, notas: e.target.value }))} placeholder="Observaciones opcionales..." />
            </div>
          </div>

          {/* CA-03: resumen de total antes de confirmar */}
          {itemsVenta.length > 0 && (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
              <span className="text-sm text-emerald-700 font-medium">Total a cobrar</span>
              <span className="text-xl font-bold text-emerald-700">{formatCurrency(totalVenta)}</span>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsNuevaVentaOpen(false)} disabled={guardando}>Cancelar</Button>
            <Button onClick={handleGuardarVenta} disabled={guardando} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              {guardando ? <><div className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Guardando...</> : <><FileText className="size-4" /> Registrar venta</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Reporte de Ventas ──────────────────────────── */}
      <Dialog open={isReporteOpen} onOpenChange={setIsReporteOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-emerald-600" />
              Reporte de Ventas por Periodo
            </DialogTitle>
            <DialogDescription>Selecciona el rango de fechas para generar el reporte de ingresos.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Selección de periodo */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Desde</Label>
                <Input type="date" value={reporteDesde} onChange={e => setReporteDesde(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Hasta</Label>
                <Input type="date" value={reporteHasta} onChange={e => setReporteHasta(e.target.value)} />
              </div>
            </div>

            {/* Aviso: anuladas excluidas */}
            {ventasAnuladasEnPeriodo.length > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                <XCircle className="size-3.5 shrink-0" />
                <span>
                  <strong>{ventasAnuladasEnPeriodo.length} venta{ventasAnuladasEnPeriodo.length > 1 ? 's' : ''} anulada{ventasAnuladasEnPeriodo.length > 1 ? 's' : ''}</strong> excluida{ventasAnuladasEnPeriodo.length > 1 ? 's' : ''} de todos los totales financieros.
                </span>
              </div>
            )}

            {/* Resumen del periodo */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-center">
                <p className="text-xs text-emerald-600 font-medium">Ventas efectivas</p>
                <p className="text-2xl font-bold text-emerald-700">{ventasEfectivasEnPeriodo.length}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-center">
                <p className="text-xs text-blue-600 font-medium">Ingresos totales</p>
                <p className="text-lg font-bold text-blue-700">{formatCurrency(reporteTotalIngresos)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-center">
                <p className="text-xs text-red-500 font-medium">Anuladas (no cuentan)</p>
                <p className="text-2xl font-bold text-red-500">{ventasAnuladasEnPeriodo.length}</p>
              </div>
            </div>

            {/* Desglose por método de pago */}
            {Object.keys(reportePorMetodo).length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Ingresos por método de pago</p>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2">Método</th>
                        <th className="text-right px-4 py-2">Total recaudado</th>
                        <th className="text-right px-4 py-2">% del total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(reportePorMetodo).map(([metodo, monto]) => (
                        <tr key={metodo} className="border-t border-slate-100">
                          <td className="px-4 py-2 capitalize text-slate-700">{metodo}</td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-800">{formatCurrency(monto as number)}</td>
                          <td className="px-4 py-2 text-right text-slate-500">
                            {reporteTotalIngresos > 0 ? Math.round(((monto as number) / reporteTotalIngresos) * 100) : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-emerald-50 border-t border-slate-200">
                      <tr>
                        <td className="px-4 py-2 font-semibold text-slate-700">Total</td>
                        <td className="px-4 py-2 text-right font-bold text-emerald-700">{formatCurrency(reporteTotalIngresos)}</td>
                        <td className="px-4 py-2 text-right font-bold text-emerald-700">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Lista de ventas efectivas del periodo */}
            {ventasEfectivasEnPeriodo.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Ventas efectivas incluidas en el reporte</p>
                <div className="rounded-lg border border-slate-200 overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">N° Venta</th>
                        <th className="text-left px-3 py-2">Fecha</th>
                        <th className="text-left px-3 py-2">Comprador</th>
                        <th className="text-left px-3 py-2">Evento</th>
                        <th className="text-right px-3 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ventasEfectivasEnPeriodo.map(v => (
                        <tr key={v.id} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 font-mono text-slate-600">{v.pedido}</td>
                          <td className="px-3 py-1.5 text-slate-600">{v.fecha}</td>
                          <td className="px-3 py-1.5 text-slate-700">{v.cliente}</td>
                          <td className="px-3 py-1.5 text-slate-600 truncate max-w-[120px]">{v.evento}</td>
                          <td className="px-3 py-1.5 text-right font-semibold text-slate-800">{formatCurrency(v.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsReporteOpen(false)}>Cerrar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              onClick={() => {
                const filas = ventasEfectivasEnPeriodo.map(v => `
                  <tr>
                    <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${v.pedido}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${v.fecha}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${v.cliente}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${v.evento}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${v.metodoPago}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatCurrency(v.total)}</td>
                  </tr>`).join('');
                const metodosRows = Object.entries(reportePorMetodo).map(([m, t]) =>
                  `<tr><td style="padding:6px 8px">${m}</td><td style="padding:6px 8px;text-align:right">${formatCurrency(t as number)}</td></tr>`).join('');
                const notaAnuladas = ventasAnuladasEnPeriodo.length > 0
                  ? `<p style="font-size:12px;color:#dc2626;margin:0 0 16px 0">* ${ventasAnuladasEnPeriodo.length} venta(s) anulada(s) excluidas de este reporte y de los totales financieros.</p>`
                  : '';
                const html = `<html><head><title>Reporte de Ventas</title>
                  <style>body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}h1{color:#059669}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:#f1f5f9;padding:8px;text-align:left;font-size:12px;color:#475569}td{font-size:13px}</style>
                </head><body>
                  <h1>Reporte de Ventas — UFCA</h1>
                  <p style="color:#475569;font-size:14px">Periodo: ${reporteDesde || 'inicio'} al ${reporteHasta || 'hoy'}</p>
                  ${notaAnuladas}
                  <div style="display:flex;gap:24px;margin:16px 0">
                    <div style="background:#d1fae5;border-radius:8px;padding:12px 20px;text-align:center"><p style="font-size:12px;color:#065f46;margin:0">Ventas efectivas</p><p style="font-size:24px;font-weight:bold;color:#065f46;margin:0">${ventasEfectivasEnPeriodo.length}</p></div>
                    <div style="background:#dbeafe;border-radius:8px;padding:12px 20px;text-align:center"><p style="font-size:12px;color:#1e40af;margin:0">Ingresos totales</p><p style="font-size:24px;font-weight:bold;color:#1e40af;margin:0">${formatCurrency(reporteTotalIngresos)}</p></div>
                  </div>
                  <h2 style="font-size:14px;color:#475569">Por método de pago</h2>
                  <table><thead><tr><th>Método</th><th style="text-align:right">Total</th></tr></thead><tbody>${metodosRows}</tbody></table>
                  <h2 style="font-size:14px;color:#475569">Detalle de ventas efectivas</h2>
                  <table><thead><tr><th>N°</th><th>Fecha</th><th>Comprador</th><th>Evento</th><th style="text-align:right">Método</th><th style="text-align:right">Total</th></tr></thead><tbody>${filas}</tbody></table>
                  <p style="text-align:right;font-size:16px;font-weight:bold;color:#059669">Total general: ${formatCurrency(reporteTotalIngresos)}</p>
                </body></html>`;
                const w = window.open('', '_blank');
                if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
              }}
            >
              <FileText className="size-4" />
              Imprimir / Exportar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog para Eliminar Permanentemente */}
      <AlertDialog open={isEliminarDialogOpen} onOpenChange={setIsEliminarDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar venta permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La venta será eliminada permanentemente del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedItem(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEliminarDefinitivo} className="bg-red-600 hover:bg-red-700">
              Eliminar permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
