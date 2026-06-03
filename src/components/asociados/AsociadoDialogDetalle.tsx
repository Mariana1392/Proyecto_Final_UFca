import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  User, Mail, Phone, MapPin, Calendar, DollarSign, CreditCard,
  Users, PartyPopper, History, AlertTriangle, TrendingUp, Clock,
  CheckCircle2, XCircle, Info,
} from 'lucide-react';
import { formatCurrency, formatDate } from './asociadosUtils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asociado: any;
  tab: string;
  setTab: (t: string) => void;
  auditoriaAsociado: any[];
  loadingAuditoria: boolean;
  onClose: () => void;
}

export function AsociadoDialogDetalle({
  open, onOpenChange, asociado, tab, setTab,
  auditoriaAsociado, loadingAuditoria, onClose,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b border-slate-200 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-slate-900 mb-1 flex items-center gap-2">
                <User className="size-5 text-emerald-600" />
                Detalle Completo: {asociado?.nombre}
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                Información personal, financiera y participación en eventos
              </DialogDescription>
            </div>
            {asociado && (
              <Badge className={asociado.estado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                {asociado.estado ? 'Activo' : 'Inactivo'}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {asociado && (
          <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="info"     className="gap-1 text-xs"><Info className="size-3" /> Info</TabsTrigger>
              <TabsTrigger value="ahorros"  className="gap-1 text-xs"><DollarSign className="size-3" /> Ahorros</TabsTrigger>
              <TabsTrigger value="creditos" className="gap-1 text-xs"><CreditCard className="size-3" /> Créditos</TabsTrigger>
              <TabsTrigger value="referidos" className="gap-1 text-xs"><Users className="size-3" /> Referidos</TabsTrigger>
              <TabsTrigger value="eventos"  className="gap-1 text-xs"><PartyPopper className="size-3" /> Eventos</TabsTrigger>
              <TabsTrigger value="historial" className="gap-1 text-xs"><History className="size-3" /> Historial</TabsTrigger>
            </TabsList>

            {/* ── INFO ── */}
            <TabsContent value="info" className="flex-1 overflow-y-auto mt-4 space-y-4">
              <div className="bg-slate-50 p-5 rounded-lg space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <User className="size-5 text-emerald-600" />Datos Personales
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-slate-500 text-xs">Nombre Completo</Label><p className="font-medium mt-1">{asociado.nombre}</p></div>
                  <div><Label className="text-slate-500 text-xs">Cédula</Label><p className="font-medium mt-1">{asociado.cedula}</p></div>
                  <div><Label className="text-slate-500 text-xs">Email</Label><p className="font-medium mt-1 flex items-center gap-1"><Mail className="size-3 text-slate-400" />{asociado.email}</p></div>
                  <div><Label className="text-slate-500 text-xs">Teléfono</Label><p className="font-medium mt-1 flex items-center gap-1"><Phone className="size-3 text-slate-400" />{asociado.telefono}</p></div>
                  <div className="col-span-2"><Label className="text-slate-500 text-xs">Dirección</Label><p className="font-medium mt-1 flex items-center gap-1"><MapPin className="size-3 text-slate-400" />{asociado.direccion}</p></div>
                  <div><Label className="text-slate-500 text-xs">Fecha de Ingreso</Label><p className="font-medium mt-1 flex items-center gap-1"><Calendar className="size-3 text-slate-400" />{formatDate(asociado.fechaIngreso)}</p></div>
                  <div>
                    <Label className="text-slate-500 text-xs">Estado actual</Label>
                    <div className="mt-1">
                      <Badge className={asociado.estado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                        {asociado.estado ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              {!asociado.estado && (
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
                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(asociado.totalAhorros || 0)}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg text-center">
                    <p className="text-xs text-slate-500 mb-1">Total Créditos</p>
                    <p className="text-xl font-bold text-blue-600">{formatCurrency(asociado.totalCreditos || 0)}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── AHORROS ── */}
            <TabsContent value="ahorros" className="flex-1 overflow-y-auto mt-4">
              {!asociado.estado && (
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
              {asociado.ahorros?.length > 0 ? (
                <div className="space-y-4">
                  {asociado.ahorros.map((ahorro: any) => (
                    <div key={ahorro.id} className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-100 rounded-lg"><DollarSign className="size-5 text-emerald-600" /></div>
                          <h4 className="font-semibold text-slate-900">{ahorro.tipo}</h4>
                        </div>
                        <Badge className={ahorro.estado === 'Activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>{ahorro.estado}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div><p className="text-xs text-slate-500">Monto</p><p className="font-semibold">{formatCurrency(ahorro.monto)}</p></div>
                        <div><p className="text-xs text-slate-500">Saldo</p><p className="font-semibold text-emerald-600">{formatCurrency(ahorro.saldo)}</p></div>
                      </div>
                    </div>
                  ))}
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                    <p className="text-sm text-emerald-800"><span className="font-semibold">Total acumulado:</span> {formatCurrency(asociado.totalAhorros || 0)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"><DollarSign className="size-10 text-slate-400" /></div>
                  <h3 className="text-slate-900 mb-1">Sin cuentas de ahorro</h3>
                  <p className="text-sm text-slate-500">Este asociado aún no tiene cuentas de ahorro registradas</p>
                </div>
              )}
            </TabsContent>

            {/* ── CRÉDITOS ── */}
            <TabsContent value="creditos" className="flex-1 overflow-y-auto mt-4">
              {!asociado.estado && (
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
              {asociado.creditos?.length > 0 ? (
                <div className="space-y-4">
                  {asociado.creditos.map((credito: any) => (
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
                        <div><p className="text-xs text-slate-500">Monto Desembolsado</p><p className="font-semibold">{formatCurrency(credito.monto)}</p></div>
                        <div><p className="text-xs text-slate-500">Saldo Actual</p><p className="font-semibold text-blue-600">{formatCurrency(credito.saldo)}</p></div>
                        <div><p className="text-xs text-slate-500">Cuota Mensual</p><p className="font-medium text-slate-700">{formatCurrency(credito.cuota)}</p></div>
                        <div><p className="text-xs text-slate-500">Plazo</p><p className="font-medium text-slate-700">{credito.plazo}</p></div>
                      </div>
                    </div>
                  ))}
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800"><span className="font-semibold">Saldo total activo:</span> {formatCurrency(asociado.totalCreditos || 0)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"><CreditCard className="size-10 text-slate-400" /></div>
                  <h3 className="text-slate-900 mb-1">Sin créditos</h3>
                  <p className="text-sm text-slate-500">Este asociado no tiene créditos registrados</p>
                </div>
              )}
            </TabsContent>

            {/* ── REFERIDOS ── */}
            <TabsContent value="referidos" className="flex-1 overflow-y-auto mt-4">
              {!asociado.estado && (
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
              {asociado.referidos?.length > 0 ? (
                <div className="space-y-4">
                  {asociado.referidos.map((referido: any, i: number) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 rounded-lg"><User className="size-5 text-purple-600" /></div>
                          <div>
                            <h4 className="font-semibold text-slate-900">{referido.nombre}</h4>
                            <p className="text-sm text-slate-500">Referido el {formatDate(referido.fechaReferido)}</p>
                          </div>
                        </div>
                        <Badge className={referido.estadoReferido === 'Aprobado' ? 'bg-emerald-100 text-emerald-700' : referido.estadoReferido === 'En proceso' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>
                          {referido.estadoReferido}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div><p className="text-xs text-slate-500">Cédula</p><p className="font-medium">{referido.cedula}</p></div>
                        <div><p className="text-xs text-slate-500">Teléfono</p><p className="font-medium">{referido.telefono}</p></div>
                        <div><p className="text-xs text-slate-500">Bonificación</p><p className="font-semibold text-emerald-600">{formatCurrency(referido.bonificacion)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Users className="size-10 text-slate-400" /></div>
                  <h3 className="text-slate-900 mb-1">Sin referidos</h3>
                  <p className="text-sm text-slate-500">Este asociado aún no ha referido a ninguna persona</p>
                </div>
              )}
            </TabsContent>

            {/* ── EVENTOS ── */}
            <TabsContent value="eventos" className="flex-1 overflow-y-auto mt-4">
              {!asociado.estado && (
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
              {asociado.eventos?.length > 0 ? (
                <div className="space-y-4">
                  {asociado.eventos.map((evento: any) => (
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
                          {evento.participacion === 'Asistió'
                            ? <span className="flex items-center gap-1"><CheckCircle2 className="size-3" />Asistió</span>
                            : <span className="flex items-center gap-1"><XCircle className="size-3" />No asistió</span>}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"><PartyPopper className="size-10 text-slate-400" /></div>
                  <h3 className="text-slate-900 mb-1">Sin eventos registrados</h3>
                  <p className="text-sm text-slate-500">Este asociado no tiene participación en eventos registrada</p>
                </div>
              )}
            </TabsContent>

            {/* ── HISTORIAL ── */}
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
                            reg.accion?.includes('CREACIÓN')   ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            reg.accion?.includes('EDICIÓN')    ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            reg.accion?.includes('ESTADO')     ? 'bg-purple-50 text-purple-700 border-purple-200' :
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
          <Button variant="outline" onClick={onClose} className="w-full">Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
