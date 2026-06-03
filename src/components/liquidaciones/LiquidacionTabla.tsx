import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import {
  Search, Plus, Eye, ChevronLeft, ChevronRight,
  Calculator, CheckCircle2, Clock, AlertTriangle, Activity
} from 'lucide-react';
import { getEstadoBadge, fmtCOP, numLiq } from './liquidacionUtils';
import { LiquidacionRecord } from './liquidacionTypes';

interface LiquidacionTablaProps {
  esVistaPropia: boolean;
  can: (perm: string) => boolean;
  liquidaciones: LiquidacionRecord[];
  loading: boolean;
  isSearching: boolean;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  filterEstado: string;
  setFilterEstado: (s: string) => void;
  filterTipo: string;
  setFilterTipo: (s: string) => void;
  filterDesde: string;
  setFilterDesde: (s: string) => void;
  filterHasta: string;
  setFilterHasta: (s: string) => void;
  filterRegDesde: string;
  setFilterRegDesde: (s: string) => void;
  filterRegHasta: string;
  setFilterRegHasta: (s: string) => void;
  dateRangeError: string;
  sortBy: any;
  setSortBy: (s: any) => void;
  pagActivas: LiquidacionRecord[];
  pagAnuladas: LiquidacionRecord[];
  currentPage: number;
  setCurrentPage: (n: number) => void;
  totalPagActivas: number;
  currentPageAnuladas: number;
  setCurrentPageAnuladas: (n: number) => void;
  totalPagAn: number;
  montoTotal: number;
  cantPagadas: number;
  cantPendientes: number;
  setIsCreateOpen: (b: boolean) => void;
  setSelectedItem: (item: any) => void;
  setIsDetailOpen: (b: boolean) => void;
  setIsAnularOpen: (b: boolean) => void;
}

export function LiquidacionTabla({
  esVistaPropia, can, liquidaciones, loading, isSearching,
  searchTerm, setSearchTerm, filterEstado, setFilterEstado,
  filterTipo, setFilterTipo, filterDesde, setFilterDesde,
  filterHasta, setFilterHasta, filterRegDesde, setFilterRegDesde,
  filterRegHasta, setFilterRegHasta, dateRangeError,
  sortBy, setSortBy, pagActivas, pagAnuladas,
  currentPage, setCurrentPage, totalPagActivas,
  currentPageAnuladas, setCurrentPageAnuladas, totalPagAn,
  montoTotal, cantPagadas, cantPendientes,
  setIsCreateOpen, setSelectedItem, setIsDetailOpen, setIsAnularOpen
}: LiquidacionTablaProps) {

  return (
    <div className="space-y-6">
      {/* ── KPIs ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Calculator className="w-5 h-5" /></div>
            <div><p className="text-sm font-medium text-slate-500">Total Liquidado</p>
              <h3 className="text-xl font-bold text-slate-900">{fmtCOP(montoTotal)}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><CheckCircle2 className="w-5 h-5" /></div>
            <div><p className="text-sm font-medium text-slate-500">Pagadas</p>
              <h3 className="text-xl font-bold text-slate-900">{cantPagadas}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Clock className="w-5 h-5" /></div>
            <div><p className="text-sm font-medium text-slate-500">En proceso</p>
              <h3 className="text-xl font-bold text-slate-900">{cantPendientes}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-slate-50 text-slate-600 rounded-xl"><Activity className="w-5 h-5" /></div>
            <div><p className="text-sm font-medium text-slate-500">Total Registros</p>
              <h3 className="text-xl font-bold text-slate-900">{liquidaciones.length}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm bg-white overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-600" /> Liquidaciones {esVistaPropia && 'de mi cuenta'}
              </CardTitle>
            </div>
            {!esVistaPropia && can('liquidacion') && (
              <Button onClick={() => setIsCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                <Plus className="w-4 h-4 mr-2" /> Nueva Liquidación
              </Button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-3 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input placeholder={esVistaPropia ? "Buscar..." : "Nombre asociado, N°, cédula..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-white" />
              {isSearching && <div className="absolute right-3 top-3 w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />}
            </div>
            <div className="md:col-span-2">
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Todos los estados" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos los estados</SelectItem>
                  <SelectItem value="En proceso">En proceso</SelectItem>
                  <SelectItem value="Pagada">Pagada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Cualquier tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Cualquier tipo</SelectItem>
                  <SelectItem value="retiro">Retiro Definitivo</SelectItem>
                  <SelectItem value="parcial">Retiro Parcial</SelectItem>
                  <SelectItem value="cruce">Cruce de Cuentas</SelectItem>
                  <SelectItem value="fallecimiento">Fallecimiento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!esVistaPropia && (
              <div className="md:col-span-3 flex flex-col">
                <div className="flex gap-2">
                  <Input type="date" title="Creado desde" value={filterRegDesde} onChange={(e) => setFilterRegDesde(e.target.value)} className="bg-white text-xs" />
                  <Input type="date" title="Creado hasta" value={filterRegHasta} onChange={(e) => setFilterRegHasta(e.target.value)} className="bg-white text-xs" />
                </div>
                {dateRangeError && <span className="text-[10px] text-red-500 mt-1">{dateRangeError}</span>}
              </div>
            )}
            <div className="md:col-span-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fecha_desc">Más recientes (Corte)</SelectItem>
                  <SelectItem value="fecha_asc">Más antiguos (Corte)</SelectItem>
                  <SelectItem value="monto_desc">Mayor monto</SelectItem>
                  <SelectItem value="monto_asc">Menor monto</SelectItem>
                  <SelectItem value="estado_az">Estado (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">Liquidación</TableHead>
                  {!esVistaPropia && <TableHead className="font-semibold text-slate-600">Asociado</TableHead>}
                  <TableHead className="font-semibold text-slate-600">Fechas</TableHead>
                  <TableHead className="font-semibold text-slate-600">Tipo</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Total a Pagar</TableHead>
                  <TableHead className="text-center font-semibold text-slate-600">Estado</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="h-32 text-center text-slate-500">Cargando liquidaciones...</TableCell></TableRow>
                ) : pagActivas.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-32 text-center text-slate-500">No se encontraron liquidaciones.</TableCell></TableRow>
                ) : (
                  pagActivas.map((liq) => (
                    <TableRow key={liq.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell>
                        <div className="font-medium text-slate-900">{numLiq(liq.id)}</div>
                        <div className="text-xs text-slate-500 mt-1 line-clamp-1" title={liq.motivo}>{liq.motivo || 'Sin motivo'}</div>
                      </TableCell>
                      {!esVistaPropia && (
                        <TableCell>
                          <div className="font-medium text-slate-900">{liq.asociado}</div>
                          <div className="text-xs text-slate-500">{liq.cedula}</div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="text-sm">Corte: <span className="font-medium">{liq.fechaCorte}</span></div>
                        <div className="text-xs text-slate-500">Reg: {new Date(liq.createdAt).toLocaleDateString()}</div>
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="bg-slate-100 text-slate-700 font-normal">{liq.tipo}</Badge></TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">{fmtCOP(liq.montoFinal)}</TableCell>
                      <TableCell className="text-center">{getEstadoBadge(liq.estado, liq.anulado)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => { setSelectedItem(liq); setIsDetailOpen(true); }}>
                          <Eye className="w-4 h-4 mr-1" /> Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación Activas */}
          {totalPagActivas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
              <span className="text-sm text-slate-500">Página {currentPage} de {totalPagActivas}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.min(totalPagActivas, currentPage + 1))} disabled={currentPage === totalPagActivas}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {pagAnuladas.length > 0 && (
        <Card className="border-0 shadow-sm bg-white overflow-hidden opacity-75">
          <CardHeader className="border-b border-red-100 bg-red-50/30 pb-4">
            <CardTitle className="text-lg font-bold text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Liquidaciones Anuladas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-red-50/50">
                  <TableRow>
                    <TableHead className="font-semibold text-red-800">Liquidación</TableHead>
                    {!esVistaPropia && <TableHead className="font-semibold text-red-800">Asociado</TableHead>}
                    <TableHead className="font-semibold text-red-800">Corte</TableHead>
                    <TableHead className="text-right font-semibold text-red-800">Total a Pagar</TableHead>
                    <TableHead className="text-center font-semibold text-red-800">Estado</TableHead>
                    <TableHead className="text-right font-semibold text-red-800">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagAnuladas.map((liq) => (
                    <TableRow key={liq.id} className="hover:bg-red-50/30 transition-colors">
                      <TableCell><div className="font-medium text-slate-900">{numLiq(liq.id)}</div></TableCell>
                      {!esVistaPropia && (
                        <TableCell>
                          <div className="font-medium text-slate-900">{liq.asociado}</div>
                          <div className="text-xs text-slate-500">{liq.cedula}</div>
                        </TableCell>
                      )}
                      <TableCell><div className="text-sm font-medium">{liq.fechaCorte}</div></TableCell>
                      <TableCell className="text-right font-bold text-slate-600 line-through">{fmtCOP(liq.montoFinal)}</TableCell>
                      <TableCell className="text-center">{getEstadoBadge(liq.estado, liq.anulado)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => { setSelectedItem(liq); setIsDetailOpen(true); }}>
                          <Eye className="w-4 h-4 mr-1" /> Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalPagAn > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-red-100 bg-red-50/30">
                <span className="text-sm text-red-500">Página {currentPageAnuladas} de {totalPagAn}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPageAnuladas(Math.max(1, currentPageAnuladas - 1))} disabled={currentPageAnuladas === 1} className="border-red-200 text-red-600 hover:bg-red-100"><ChevronLeft className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPageAnuladas(Math.min(totalPagAn, currentPageAnuladas + 1))} disabled={currentPageAnuladas === totalPagAn} className="border-red-200 text-red-600 hover:bg-red-100"><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
