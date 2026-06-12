// ── AhorroVoluntarioTabla.tsx ────────────────────────────────────────────────
// Tabla de ahorros voluntarios con paginación y estado vacío.

import { Wallet, FileText, Edit, Ban, ChevronLeft, ChevronRight, X, PlusCircle, ArrowUpCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatCurrency } from '../../lib/formatters';
import type { UserRole } from '../../contexts/AuthContext';

interface AhorroVoluntarioTablaProps {
  ahorrosList:      any[];
  isAnulados:       boolean;
  userRole?:        UserRole | null;
  // Eventos
  onOpenDetail:     (ahorro: any) => void;
  onDeposito:       (ahorro: any) => void;
  onRetiro:         (ahorro: any) => void;
  onEdit:           (ahorro: any) => void;
  onAnular:         (ahorro: any) => void;
  onToggleEstado:   (ahorro: any) => void;
  onOpenPDF:        (ahorro: any) => void;
  // Estado vacío
  hayFiltros:       boolean;
  limpiarFiltros:   () => void;
  hasAnyActive:     boolean;
}

interface PaginationProps {
  totalPages: number;
  currentPage: number;
  setCurrentPage: (p: number) => void;
  startIndex: number;
  endIndex: number;
  totalCount: number;
}

export function AhorroVoluntarioPaginacion({
  totalPages, currentPage, setCurrentPage, startIndex, endIndex, totalCount,
}: PaginationProps) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-slate-600">
        Mostrando {totalCount === 0 ? 0 : startIndex + 1} a {Math.min(endIndex, totalCount)} de {totalCount} registros
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
          <ChevronLeft className="size-4" />
        </Button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <Button
            key={p}
            variant={currentPage === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrentPage(p)}
            className={currentPage === p ? 'bg-purple-600 hover:bg-purple-700' : ''}
          >
            {p}
          </Button>
        ))}
        <Button variant="outline" size="sm"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export default function AhorroVoluntarioTabla({
  ahorrosList, isAnulados, userRole,
  onOpenDetail, onDeposito, onRetiro, onEdit, onAnular, onToggleEstado, onOpenPDF,
  hayFiltros, limpiarFiltros, hasAnyActive,
}: AhorroVoluntarioTablaProps) {

  const renderEmptyState = () => (
    <TableRow>
      <TableCell colSpan={6} className="py-16">
        <div className="flex flex-col items-center justify-center text-center">
          <Wallet className="size-10 text-slate-300 mb-3" />
          {isAnulados ? (
            <p className="text-slate-500">No hay ahorros voluntarios anulados</p>
          ) : !hasAnyActive ? (
            <>
              <h3 className="text-slate-700 mb-1">No hay ahorros voluntarios registrados</h3>
              <p className="text-sm text-slate-400">Aún no se han registrado ahorros voluntarios en el sistema</p>
            </>
          ) : hayFiltros ? (
            <>
              <h3 className="text-slate-700 mb-1">No se encontraron resultados</h3>
              <p className="text-sm text-slate-400 mb-3">No existen ahorros con los criterios ingresados</p>
              <Button variant="outline" size="sm" onClick={limpiarFiltros} className="gap-2">
                <X className="size-3" /> Limpiar filtros
              </Button>
            </>
          ) : (
            <p className="text-slate-500">No se encontraron ahorros voluntarios</p>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asociado</TableHead>
            <TableHead>Cédula</TableHead>
            <TableHead>Monto ahorrado</TableHead>
            <TableHead>Fecha registro</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ahorrosList.length === 0 ? renderEmptyState() : ahorrosList.map(ahorro => (
            <TableRow
              key={ahorro.id}
              className={`cursor-pointer hover:bg-slate-50 transition-colors ${ahorro.estado !== 'activo' && !ahorro.anulado ? 'opacity-75' : ''}`}
              onClick={() => onOpenDetail(ahorro)}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${isAnulados ? 'bg-slate-100' : ahorro.estado === 'activo' ? 'bg-purple-100' : 'bg-yellow-50'}`}>
                    <Wallet className={`size-4 ${isAnulados ? 'text-slate-600' : ahorro.estado === 'activo' ? 'text-purple-600' : 'text-yellow-500'}`} />
                  </div>
                  <p className="text-slate-900">{ahorro.asociado}</p>
                </div>
              </TableCell>
              <TableCell><p className="text-slate-600">{ahorro.cedula}</p></TableCell>
              <TableCell><p className="text-slate-900 font-medium">{formatCurrency(ahorro.montoAhorrado)}</p></TableCell>
              <TableCell><p className="text-slate-600">{ahorro.fechaInicio}</p></TableCell>
              <TableCell>
                {isAnulados ? (
                  <Badge variant="secondary" className="bg-red-100 text-red-700">Anulado</Badge>
                ) : userRole === 'admin' ? (
                  <Switch
                    checked={ahorro.estado === 'activo'}
                    onCheckedChange={() => onToggleEstado(ahorro)}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <Badge
                    variant={ahorro.estado === 'activo' ? 'default' : 'secondary'}
                    className={ahorro.estado === 'activo' ? 'bg-emerald-600' : ''}
                  >
                    {ahorro.estado === 'activo' ? 'Activo' : 'Inactivo'}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                <div className="flex gap-2 justify-end">
                  {!isAnulados && userRole === 'admin' && ahorro.estado === 'activo' && (
                    <>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
                        title="Registrar depósito"
                        onClick={() => onDeposito(ahorro)}
                      >
                        <PlusCircle className="size-4" />
                        Depositar
                      </Button>
                      {ahorro.montoAhorrado > 0 && (
                        <Button
                          size="sm"
                          className="gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                          title="Retirar saldo total"
                          onClick={() => onRetiro(ahorro)}
                        >
                          <ArrowUpCircle className="size-4" />
                          Retirar
                        </Button>
                      )}
                      <Button variant="outline" size="sm" title="Editar" onClick={() => onEdit(ahorro)}>
                        <Edit className="size-4" />
                      </Button>
                      <Button variant="outline" size="sm" title="Anular" onClick={() => onAnular(ahorro)}>
                        <Ban className="size-4 text-red-600" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline" size="sm" title="Ver certificado PDF"
                    className="hover:bg-purple-50"
                    onClick={() => onOpenPDF(ahorro)}
                  >
                    <FileText className="size-4 text-purple-600" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
