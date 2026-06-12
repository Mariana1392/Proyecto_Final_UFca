import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/formatters';
import { TIPOS_CREDITO } from '../../lib/constants';
import { calcularCuota, FilaAmortizacion } from './creditoHelpers';

// Mapa tipo de crédito → clave en tabla configuracion
const TIPO_A_CLAVE: Record<string, string> = {
  libre_inversion: 'tasa_libre_inversion',
  educacion:       'tasa_educacion',
  vivienda:        'tasa_vivienda',
  calamidad:       'tasa_calamidad',
};

export interface UseCreditosSolicitudesParams {
  setCreditos: React.Dispatch<React.SetStateAction<any[]>>;
  userData?: any;
  /** Lifted from orchestrator so cargarDatos can update the same state */
  setSolicitudesCredito: React.Dispatch<React.SetStateAction<any[]>>;
  /** Lifted from orchestrator so cargarDatos can update the same state */
  setMisSolicitudes: React.Dispatch<React.SetStateAction<any[]>>;
}

export function useCreditosSolicitudes({
  setCreditos,
  userData,
  setSolicitudesCredito,
  setMisSolicitudes,
}: UseCreditosSolicitudesParams) {
  const [isSolicitudDialogOpen, setIsSolicitudDialogOpen] = useState(false);
  const [totalAhorros, setTotalAhorros]     = useState<number>(0);
  const [solMonto, setSolMonto]             = useState('');
  const [solTipo, setSolTipo]               = useState('libre_inversion');
  const [solPlazo, setSolPlazo]             = useState('');
  const [solTasa, setSolTasa]               = useState('');
  const [solDestino, setSolDestino]         = useState('');
  const [solObs, setSolObs]                 = useState('');
  const [savingSolicitud, setSavingSolicitud] = useState(false);
  const [isSolSimOpen, setIsSolSimOpen]       = useState(false);
  const [tablaSolSim, setTablaSolSim]         = useState<FilaAmortizacion[]>([]);
  const [isRechazarSolOpen, setIsRechazarSolOpen]             = useState(false);
  const [solicitudSeleccionada, setSolicitudSeleccionada]     = useState<any>(null);
  const [notaRechazoSol, setNotaRechazoSol]                   = useState('');
  const [savingRechazarSol, setSavingRechazarSol]             = useState(false);
  const [solBanco, setSolBanco]               = useState('');
  const [solTipoCuenta, setSolTipoCuenta]     = useState('ahorros');
  const [solNumeroCuenta, setSolNumeroCuenta] = useState('');
  const [tasasParametrizadas, setTasasParametrizadas] = useState<Record<string, number>>({});
  // Documentos adjuntos a la solicitud (Mejora F)
  const [solDocCartaLaboral, setSolDocCartaLaboral] = useState<File | null>(null);
  const [solDocCedula, setSolDocCedula]             = useState<File | null>(null);

  // Cargar tasas desde configuracion (al montar Y cada vez que se abre el dialog)
  useEffect(() => {
    const claves = Object.values(TIPO_A_CLAVE);
    supabase.from('configuracion').select('clave, valor').in('clave', claves)
      .then(({ data }) => {
        const mapa: Record<string, number> = {};
        (data ?? []).forEach((r: any) => { mapa[r.clave] = parseFloat(r.valor) || 0; });
        setTasasParametrizadas(mapa);
        // Aplicar tasa para el tipo actualmente seleccionado
        const clave = TIPO_A_CLAVE[solTipo] ?? 'tasa_libre_inversion';
        const tasa  = mapa[clave] ?? 0;
        setSolTasa(tasa > 0 ? String(tasa) : '');
      });

    // Cargar total de ahorros del asociado al abrir el dialog
    if (isSolicitudDialogOpen && userData?.id) {
      supabase.from('cuentas_ahorro')
        .select('monto_ahorrado')
        .eq('asociado_id', userData.id)
        .eq('estado', 'activo')
        .then(({ data }) => {
          const sum = (data || []).reduce((acc: number, curr: any) => acc + (curr.monto_ahorrado || 0), 0);
          setTotalAhorros(sum);
        });
    }
  }, [isSolicitudDialogOpen, userData?.id]); // se recarga cada vez que el dialog abre/cierra

  // Cuando cambia el tipo, actualizar la tasa automáticamente
  const handleSolTipoChange = (tipo: string) => {
    setSolTipo(tipo);
    const clave = TIPO_A_CLAVE[tipo];
    const tasa  = clave ? (tasasParametrizadas[clave] ?? 0) : 0;
    setSolTasa(tasa > 0 ? String(tasa) : '');
  };

  const parseMonto = (v: string) => parseInt(v.replace(/\./g, '').replace(/[^\d]/g, ''), 10) || 0;

  const handleSolicitarCredito = async () => {
    const monto = parseMonto(solMonto);
    if (!monto || monto <= 0)      { toast.error('Ingresa un monto válido'); return; }
    const plazo = parseInt(solPlazo) || 0;
    if (plazo <= 0)                { toast.error('El plazo debe ser mayor a 0 meses'); return; }

    if (monto > totalAhorros) {
      toast.error(`El monto solicitado excede el total de tus ahorros (${formatCurrency(totalAhorros)}).`);
      return;
    }

    setSavingSolicitud(true);
    try {
      const { data: periodoData } = await supabase
        .from('periodos')
        .select('id')
        .eq('estado', 'activo')
        .maybeSingle();
      const periodoId = periodoData?.id ?? null;

      const tasa  = parseFloat(solTasa) || 0;
      const cuota = calcularCuota(monto, tasa, plazo);

      // Construir observaciones incluyendo datos bancarios si los ingresó
      const parteDestino  = solDestino.trim();
      const parteObs      = solObs.trim();
      const parteBancaria = [
        solBanco.trim()        && `Banco: ${solBanco.trim()}`,
        solTipoCuenta          && `Tipo de cuenta: ${solTipoCuenta}`,
        solNumeroCuenta.trim() && `N° cuenta: ${solNumeroCuenta.trim()}`,
      ].filter(Boolean).join(' · ');

      const observacionesFinal = [parteDestino, parteObs, parteBancaria]
        .filter(Boolean).join('\n') || null;

      const { data, error } = await supabase
        .from('creditos')
        .insert({
          asociado_id:    userData?.id,
          tipo:           solTipo,
          monto,
          plazo_meses:    plazo,
          tasa_interes:   tasa,
          cuota_mensual:  cuota,
          saldo:          monto,
          estado:         'pendiente',
          observaciones:  observacionesFinal,
          anulado:        false,
        })
        .select('*')
        .single();

      if (error) throw error;

      // ── Subir documentos a Supabase Storage (Mejora F) ──────────────────
      const uploadDoc = async (file: File, tipo: 'carta-laboral' | 'cedula') => {
        const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
        const path = `${userData?.id}/${data.id}-${tipo}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('creditos-docs')
          .upload(path, file, { cacheControl: '3600', upsert: true });
        if (upErr) { console.warn(`[uploadDoc] No se pudo subir ${tipo}:`, upErr.message); return null; }
        const { data: urlData } = supabase.storage.from('creditos-docs').getPublicUrl(path);
        return { tipo, url: urlData.publicUrl, nombre: file.name };
      };

      const docResultados = await Promise.all([
        solDocCartaLaboral ? uploadDoc(solDocCartaLaboral, 'carta-laboral') : Promise.resolve(null),
        solDocCedula        ? uploadDoc(solDocCedula,        'cedula')        : Promise.resolve(null),
      ]);
      const docsAdjuntos = docResultados.filter(Boolean);

      if (docsAdjuntos.length > 0) {
        void supabase.from('creditos')
          .update({ documentos_adjuntos: docsAdjuntos })
          .eq('id', data.id);
      }

      const nuevaCred = {
        id:                 data.id,
        asociado:           userData?.nombre ?? '',
        cedula:             userData?.cedula ?? '',
        asociado_id:        data.asociado_id,
        tipo:               data.tipo,
        monto:              data.monto,
        tasaInteres:        data.tasa_interes ?? 0,
        plazo:              data.plazo_meses,
        cuotaMensual:       data.cuota_mensual,
        saldo:              data.saldo,
        fechaDesembolso:    null,
        estadoAprobacion:   'pendiente',
        descripcionSoporte: data.observaciones ?? '',
        urlDocumento:       '',
        estado:             'pendiente',
        anulado:            false,
        motivoAnulacion:    '',
        fechaEstadoCambio:  '',
        motivoEstadoCambio: '',
        createdAt:          data.created_at,
      };
      setCreditos(prev => [nuevaCred, ...prev]);

      supabase.from('notificaciones').insert({
        titulo:      '📋 Nueva solicitud de crédito',
        mensaje:     `${userData?.nombre ?? 'Un asociado'} solicitó un crédito por ${formatCurrency(monto)} a ${plazo} meses (${TIPOS_CREDITO.find(t => t.value === solTipo)?.label ?? solTipo}). Destino: ${solDestino.trim()}.`,
        tipo:        'solicitud_credito',
        leida:       false,
        para_admin:  true,
        usuario_id:  userData?.id,   // usuario_id (no asociado_id) — compatible con RLS
      }).then(() => {}, () => {});

      toast.success('✅ Solicitud enviada al administrador', {
        description: 'Recibirás una notificación cuando sea revisada.',
      });
      setIsSolicitudDialogOpen(false);
      setSolMonto(''); setSolTipo('libre_inversion'); setSolPlazo('');
      setSolTasa(''); setSolDestino(''); setSolObs('');
      setSolDocCartaLaboral(null); setSolDocCedula(null);
    } catch (err: any) {
      toast.error('Error al enviar la solicitud: ' + err.message);
    } finally {
      setSavingSolicitud(false);
    }
  };

  const handlePonerEnRevision = async (sol: any) => {
    try {
      const ahora = new Date().toISOString();
      await supabase
        .from('creditos')
        .update({
          estado:               'en_revision',
          fecha_estado_cambio:  ahora,
          motivo_estado_cambio: 'Solicitud puesta en revisión por el administrador',
        })
        .eq('id', sol.id);

      await supabase.from('notificaciones').insert({
        usuario_id:  sol.asociadoId,   // usuario_id — el auth.uid() del asociado
        tipo:        'solicitud_credito',
        titulo:      '🔍 Tu solicitud está en revisión',
        mensaje:     `Tu solicitud de crédito por ${formatCurrency(sol.monto)} está siendo revisada por el administrador.`,
        leida:       false,
      });

      setSolicitudesCredito(prev => prev.map(s =>
        s.id === sol.id
          ? { ...s, estadoAprobacion: 'en_revision', estado: 'en_revision' }
          : s
      ));
      setCreditos(prev => prev.map(c =>
        c.id === sol.id
          ? { ...c, estadoAprobacion: 'en_revision', estado: 'en_revision' }
          : c
      ));

      toast.success(`🔍 Solicitud de ${sol.asociado} puesta en revisión`);
    } catch (err: any) {
      toast.error('Error al actualizar la solicitud: ' + err.message);
    }
  };

  const handleAprobarSolicitudCredito = async (sol: any, tipoInteres: 'simple' | 'compuesto' = 'compuesto') => {
    try {
      const ahora = new Date().toISOString();
      const tasa  = sol.tasaInteres || 0;
      const cuota = tipoInteres === 'simple'
        ? (tasa > 0 ? Math.round(sol.monto / sol.plazoMeses + sol.monto * (Math.pow(1 + tasa / 100, 1 / 12) - 1)) : Math.round(sol.monto / sol.plazoMeses))
        : calcularCuota(sol.monto, tasa, sol.plazoMeses);

      const { data: creditoData, error: creditoErr } = await supabase
        .from('creditos')
        .update({
          estado:               'aprobado',
          tipo_interes:         tipoInteres,
          cuota_mensual:        cuota,
          fecha_estado_cambio:  ahora,
          motivo_estado_cambio: 'Aprobado por administrador',
        })
        .eq('id', sol.id)
        .select()
        .single();

      if (creditoErr) throw creditoErr;

      await supabase.from('notificaciones').insert({
        usuario_id:  sol.asociadoId,
        tipo:        'solicitud_credito',
        titulo:      '✅ Solicitud de crédito aprobada',
        mensaje:     `Tu solicitud de crédito por ${formatCurrency(sol.monto)} fue aprobada.`,
        leida:       false,
      });

      setSolicitudesCredito(prev => prev.filter(s => s.id !== sol.id));
      setCreditos(prev => prev.map(c =>
        c.id === sol.id
          ? { ...c, estado: 'aprobado', estadoAprobacion: 'aprobado', fechaEstadoCambio: ahora, motivoEstadoCambio: 'Aprobado por administrador' }
          : c
      ));

      toast.success(`✅ Solicitud de ${sol.asociado} aprobada`, {
        description: `Crédito de ${formatCurrency(sol.monto)} creado y listo para desembolso.`,
      });
    } catch (err: any) {
      toast.error('Error al aprobar la solicitud: ' + err.message);
    }
  };

  const handleRechazarSolicitudCredito = async () => {
    if (!solicitudSeleccionada) return;
    if (!notaRechazoSol.trim())  { toast.error('Escribe el motivo del rechazo'); return; }
    setSavingRechazarSol(true);
    try {
      const ahora = new Date().toISOString();
      await supabase
        .from('creditos')
        .update({
          estado:               'rechazado',
          fecha_estado_cambio:  ahora,
          motivo_estado_cambio: notaRechazoSol.trim(),
        })
        .eq('id', solicitudSeleccionada.id);

      await supabase.from('notificaciones').insert({
        usuario_id:  solicitudSeleccionada.asociadoId,
        tipo:        'solicitud_credito',
        titulo:      '❌ Solicitud de crédito rechazada',
        mensaje:     `Tu solicitud de crédito por ${formatCurrency(solicitudSeleccionada.monto)} fue rechazada. Motivo: ${notaRechazoSol.trim()}`,
        leida:       false,
      });

      setSolicitudesCredito(prev => prev.filter(s => s.id !== solicitudSeleccionada.id));
      toast.success('Solicitud rechazada y asociado notificado.');
      setIsRechazarSolOpen(false);
      setSolicitudSeleccionada(null);
      setNotaRechazoSol('');
    } catch (err: any) {
      toast.error('Error al rechazar la solicitud: ' + err.message);
    } finally {
      setSavingRechazarSol(false);
    }
  };

  return {
    isSolicitudDialogOpen, setIsSolicitudDialogOpen,
    totalAhorros,
    solMonto, setSolMonto,
    solTipo, setSolTipo,
    solPlazo, setSolPlazo,
    solTasa, setSolTasa,
    solDestino, setSolDestino,
    solObs, setSolObs,
    savingSolicitud,
    isSolSimOpen, setIsSolSimOpen,
    tablaSolSim, setTablaSolSim,
    isRechazarSolOpen, setIsRechazarSolOpen,
    solicitudSeleccionada, setSolicitudSeleccionada,
    notaRechazoSol, setNotaRechazoSol,
    savingRechazarSol,
    solBanco, setSolBanco,
    solTipoCuenta, setSolTipoCuenta,
    solNumeroCuenta, setSolNumeroCuenta,
    tasasParametrizadas,
    solDocCartaLaboral, setSolDocCartaLaboral,
    solDocCedula, setSolDocCedula,
    handleSolTipoChange,
    handleSolicitarCredito,
    handlePonerEnRevision,
    handleAprobarSolicitudCredito,
    handleRechazarSolicitudCredito,
  };
}
