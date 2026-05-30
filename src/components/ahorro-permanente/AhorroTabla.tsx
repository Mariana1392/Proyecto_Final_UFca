// ── AhorroTabla.tsx ───────────────────────────────────────────────────────────
// Tabla de ahorros permanentes (activos o anulados). Incluye:
//   · Fila de auditoría desplegable por ahorro
//   · Botones de acción inline (Aporte, Editar, Anular, PDF, Switch de estado)
// Usado por AhorroPermanente.tsx tanto para la pestaña "activos" como "anulados".

import { Fragment } from 'react';
import {
  Plus, Edit, Ban, PiggyBank, FileText, Loader2, ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { formatCurrency } from '../../lib/formatters';
import type { UserRole } from '../../contexts/AuthContext';

interface AhorroTablaProps {
  // Datos
  ahorrosList:        any[];
  isAnulados:         boolean;
  userRole?:          UserRole | null;
  searchTerm:         string;
  setSearchTerm:      (v: string) => void;

  // Callbacks de acciones
  handleOpenDetail:       (ahorro: any) => void;
  handleOpenCreateDialog: (item?: any) => void;
  handleOpenPdfDialog:    (ahorro: any) => void;
  openAporteDialog:       (ahorro: any) => void;
  openAnularDialog:       (ahorro: any) => void;
  openToggleEstadoDialog: (ahorro: any) => void;

  // Auditoría
  cargarAuditoria:    (id: string) => void;
  expandedAhorroId:   string | null;
  auditoriaPorAhorro: Record<string, any[]>;
  loadingAuditoria:   string | null;

  // Paginación
  totalPages: number;
  currentPage: number;
  setCurrentPage: (p: number) => void;
  startIndex: number;
  endIndex: number;
  totalCount: number;
}

export default function AhorroTabla({
  ahorrosList, isAnulados, userRole, searchTerm, setSearchTerm,
  handleOpenDetail, handleOpenCreateDialog, handleOpenPdfDialog,
  openAporteDialog, openAnularDialog, openToggleEstadoDialog,
  cargarAuditoria, expandedAhorroId, auditoriaPorAhorro, loadingAuditoria,
  totalPages, currentPage, setCurrentPage, startIndex, endIndex, totalCount,
}: AhorroTablaProps) {
  return (
    <div className="space-y-4">
      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asociado</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Saldo actual</TableHead>
              <TableHead>Cuota mensual</TableHead>
              <TableHead>Fecha inicio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ahorrosList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-16">
                  <div className="flex flex-col items-center justify-center text-center">
                    <PiggyBank className="size-10 text-slate-300 mb-3" />
                    {searchTerm ? (
                      <>
                        <p className="text-slate-500">
                          No se encontraron resultados para{' '}
                          <span className="font-semibold">"{searchTerm}"</span>
                        </p>
                        <Button variant="link" size="sm" onClick={() => setSearchTerm('')}>
                          Limpiar búsqueda
                        </Button>
                      </>
                    ) : isAnulados ? (
                      <p className="text-slate-500">No hay ahorros anulados</p>
                    ) : (
                      <p className="text-slate-500">No hay ahorros permanentes registrados</p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              ahorrosList.map((ahorro) => (
                <Fragment key={ahorro.id}>
                  {/* ── Fila principal ──────────────────────────────────── */}
                  <TableRow
                    className={`cursor-pointer hover:bg-slate-50 transition-colors ${
                      !ahorro.estado && !ahorro.anulado ? 'bg-slate-50 opacity-80' : ''
                    }`}
                    onClick={() => handleOpenDetail(ahorro)}
                  >
                    {/* Nombre */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${
                          isAnulados
                            ? 'bg-slate-100'
                            : ahorro.estado
                              ? 'bg-emerald-100'
                              : 'bg-yellow-50'
                        }`}>
                          <PiggyBank className={`size-4 ${
                            isAnulados
                              ? 'text-slate-600'
                              : ahorro.estado
                                ? 'text-emerald-600'
                                : 'text-yellow-500'
                          }`} />
                        </div>
                        <p className="text-slate-900">{ahorro.asociado}</p>
                      </div>
                    </TableCell>

                    {/* Cédula */}
                    <TableCell>
                      <p className="text-slate-600">{ahorro.cedula}</p>
                    </TableCell>

                    {/* Saldo */}
                    <TableCell>
                      <p className="text-slate-900 font-medium">
                        {formatCurrency(Number(ahorro.montoAhorrado) || 0)}
                      </p>
                    </TableCell>

                    {/* Cuota */}
                    <TableCell>
                      <p className="text-slate-600">{formatCurrency(ahorro.cuotaMensual)}</p>
                    </TableCell>

                    {/* Fecha inicio */}
                    <TableCell>
                      <p className="text-slate-600">{ahorro.fechaInicio}</p>
                    </TableCell>

                    {/* Estado */}
                    <TableCell>
                      {isAnulados ? (
                        <Badge variant="secondary" className="bg-red-100 text-red-700">Anulado</Badge>
                      ) : userRole === 'admin' ? (
                        <Switch
                          checked={ahorro.estado}
                          onCheckedChange={() => openToggleEstadoDialog(ahorro)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <Badge
                          variant={ahorro.estado ? 'default' : 'secondary'}
                          className={ahorro.estado ? 'bg-emerald-600' : ''}
                        >
                          {ahorro.estado ? 'Activo' : 'Inactivo'}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Acciones */}
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2 justify-end items-center">
                        {/* Registrar Aporte */}
                        {!isAnulados && userRole === 'admin' && ahorro.estado && (
                          <Button
                            size="sm"
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            title="Registrar aporte"
                            onClick={() => openAporteDialog(ahorro)}
                          >
                            <Plus className="size-3.5" />
                            Aporte
                          </Button>
                        )}

                        {/* Auditoría desplegable */}
                        <Button
                          variant="ghost" size="sm"
                          title="Ver historial"
                          className={`hover:bg-slate-100 ${
                            expandedAhorroId === ahorro.id ? 'bg-slate-100' : ''
                          }`}
                          onClick={() => cargarAuditoria(ahorro.id)}
                        >
                          {loadingAuditoria === ahorro.id
                            ? <Loader2 className="size-4 animate-spin text-slate-500" />
                            : <ChevronDown className={`size-4 text-slate-500 transition-transform ${
                                expandedAhorroId === ahorro.id ? 'rotate-180' : ''
                              }`} />
                          }
                        </Button>

                        {/* Editar */}
                        {!isAnulados && userRole === 'admin' && ahorro.estado && (
                          <Button
                            variant="outline" size="sm" title="Editar"
                            onClick={() => handleOpenCreateDialog(ahorro)}
                          >
                            <Edit className="size-4" />
                          </Button>
                        )}

                        {/* Anular */}
                        {!isAnulados && userRole === 'admin' && ahorro.estado && (
                          <Button
                            variant="outline" size="sm" title="Anular"
                            onClick={() => openAnularDialog(ahorro)}
                          >
                            <Ban className="size-4 text-red-600" />
                          </Button>
                        )}

                        {/* PDF */}
                        <Button
                          variant="outline" size="sm"
                          title="Descargar extracto PDF"
                          className="hover:bg-emerald-50"
                          onClick={() => handleOpenPdfDialog(ahorro)}
                        >
                          <FileText className="size-4 text-emerald-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* ── Fila de auditoría desplegable ───────────────────── */}
                  {expandedAhorroId === ahorro.id && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7} className="p-0 border-t-0">
                        <div className="bg-slate-50 border-t border-b border-slate-200 px-6 py-3">
                          {(auditoriaPorAhorro[ahorro.id] ?? []).length === 0 ? (
                            <p className="text-sm text-slate-400 py-1">
                              Sin movimientos registrados aún.
                            </p>
                          ) : (
                            <div>
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                                Historial de movimientos
                              </p>
                              <div className="divide-y divide-slate-100">
                                {(auditoriaPorAhorro[ahorro.id] ?? []).map((mov: any) => (
                                  <div
                                    key={mov.id}
                                    className="flex items-center justify-between py-2 text-sm gap-4"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <span className="shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                        Aporte
                                      </span>
                                      <span className="text-slate-600 truncate">
                                        {mov.descripcion || '—'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-6 shrink-0 text-right">
                                      {mov.monto > 0 && (
                                        <span className="font-medium text-emerald-700">
                                          +{formatCurrency(mov.monto)}
                                        </span>
                                      )}
                                      <span className="text-slate-400 text-xs w-24">
                                        {mov.fecha_pago}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
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

      {/* ── Paginación ─────────────────────────────────────────────────────── */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Mostrando {totalCount === 0 ? 0 : startIndex + 1} a{' '}
            {Math.min(endIndex, totalCount)} de {totalCount} registros
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <Button
                key={p}
                variant={currentPage === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentPage(p)}
                className={currentPage === p ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                {p}
              </Button>
            ))}
            <Button
              variant="outline" size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
