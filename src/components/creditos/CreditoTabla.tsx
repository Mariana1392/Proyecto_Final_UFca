import { CreditCard, FileText, Edit, Trash2, Banknote, ShieldAlert, Landmark } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { toast } from 'sonner';
import { TIPOS_CREDITO } from '../../lib/constants';
import { formatCurrency } from '../../lib/formatters';
import { getEstadoBadge } from './creditoHelpers';
import { generateCreditoPDF } from '../utils/pdfGenerator';
import { pagosCreditoApi } from '../../lib/api';
import type { CreditosHook } from './useCreditos';

interface CreditoTablaProps {
  list: any[];
  isAnulados?: boolean;
  hook: CreditosHook;
}

export default function CreditoTabla({ list, isAnulados = false, hook }: CreditoTablaProps) {
  const {
    esVistaPropia,
    setSelectedItem,
    setIsDetailDialogOpen,
    setLoadingHistorialDetalle,
    setHistorialDetalle,
    setIsDesembolsoOpen,
    setDesembolsoFecha,
    setDesembolsoReferencia,
    setDesembolsoArchivo,
    handleOpenCreate,
    handleOpenAnular,
    handleOpenHardDelete,
    handleOpenPago,
  } = hook;

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asociado</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Tasa anual</TableHead>
            <TableHead>Plazo</TableHead>
            <TableHead>Cuota mensual</TableHead>
            <TableHead>Saldo</TableHead>
            <TableHead>Aprobación</TableHead>
            <TableHead>Soporte</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="py-14 text-center">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <CreditCard className="size-10" />
                  <p>{isAnulados ? 'No hay créditos anulados' : 'No hay créditos registrados'}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : list.map((c) => (
            <TableRow key={c.id} className="cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={async () => {
                setSelectedItem(c);
                setIsDetailDialogOpen(true);
                // Cargar historial real de pagos
                setLoadingHistorialDetalle(true);
                try {
                  const pagos = await pagosCreditoApi.getByCredito(c.id);
                  setHistorialDetalle(pagos ?? []);
                } catch { setHistorialDetalle([]); }
                finally { setLoadingHistorialDetalle(false); }
              }}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${isAnulados ? 'bg-slate-100' : 'bg-blue-50'}`}>
                    <CreditCard className={`size-4 ${isAnulados ? 'text-slate-500' : 'text-blue-600'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{c.asociado}</p>
                    <p className="text-xs text-slate-400">{c.cedula}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px] whitespace-nowrap">
                  {TIPOS_CREDITO.find(t => t.value === c.tipo)?.label ?? 'Libre inversión'}
                </Badge>
              </TableCell>
              <TableCell><p className="font-semibold text-slate-900">{formatCurrency(c.monto)}</p></TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  {c.tasaInteres > 0 ? `${c.tasaInteres}%` : '—'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">{c.plazo} m.</Badge>
              </TableCell>
              <TableCell><p className="text-slate-600">{formatCurrency(c.cuotaMensual)}</p></TableCell>
              <TableCell><p className="font-medium text-blue-700">{formatCurrency(c.saldo)}</p></TableCell>
              <TableCell>
                {isAnulados
                  ? <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Anulado</Badge>
                  : getEstadoBadge(c.estadoAprobacion)}
              </TableCell>
              <TableCell>
                {c.descripcionSoporte || c.urlDocumento ? (
                  <div className="flex items-center gap-1 text-xs text-emerald-600">
                    <FileText className="size-3" />
                    <span>Adjunto</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex gap-1.5 justify-end">
                  {!isAnulados && esVistaPropia && c.saldo > 0 && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      title="Pagar cuota"
                      onClick={() => handleOpenPago(c)}
                    >
                      <Banknote className="size-3.5" /> Pagar
                    </Button>
                  )}
                  {!isAnulados && !esVistaPropia && (
                    <>
                      {(c.estadoAprobacion === 'aprobado' || c.estadoAprobacion === 'activo') && !c.fechaDesembolso && (
                        <Button
                          variant="outline" size="sm"
                          title="Registrar desembolso"
                          className="hover:bg-indigo-50 border-indigo-200"
                          onClick={() => {
                            setSelectedItem(c);
                            setDesembolsoFecha(new Date().toISOString().split('T')[0]);
                            setDesembolsoReferencia('');
                            setDesembolsoArchivo(null);
                            setIsDesembolsoOpen(true);
                          }}
                        >
                          <Landmark className="size-4 text-indigo-600" />
                        </Button>
                      )}
                      <Button variant="outline" size="sm" title="Editar"
                        onClick={() => handleOpenCreate(c)}>
                        <Edit className="size-4" />
                      </Button>
                      <Button variant="outline" size="sm" title="Anular crédito"
                        onClick={() => handleOpenAnular(c)}>
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </>
                  )}
                  {isAnulados && !esVistaPropia && (
                    <Button
                      variant="outline" size="sm"
                      title="Eliminar definitivamente"
                      className="hover:bg-red-50 border-red-200"
                      onClick={() => handleOpenHardDelete(c)}
                    >
                      <ShieldAlert className="size-4 text-red-600" />
                    </Button>
                  )}
                  <Button variant="outline" size="sm" title="Descargar certificado"
                    className="hover:bg-emerald-50"
                    onClick={() => {
                      const ok = generateCreditoPDF({
                        id:               c.id,
                        tipo:             c.tipo,
                        asociado:         c.asociado,
                        cedula:           c.cedula,
                        monto:            c.monto,
                        plazo:            c.plazo,
                        tasaInteres:      c.tasaInteres,
                        cuotaMensual:     c.cuotaMensual,
                        saldo:            c.saldo,
                        fechaDesembolso:  c.fechaDesembolso,
                        estadoAprobacion: c.estadoAprobacion,
                        descripcionSoporte: c.descripcionSoporte,
                        anulado:          c.anulado,
                        motivoAnulacion:  c.motivoAnulacion,
                        motivoEstadoCambio: c.motivoEstadoCambio,
                      });
                      if (ok) toast.success('PDF descargado');
                      else toast.error('Error al generar el PDF');
                    }}>
                    <FileText className="size-4 text-emerald-600" />
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
