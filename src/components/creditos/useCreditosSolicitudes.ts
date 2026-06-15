import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/formatters';
import { TIPOS_CREDITO } from '../../lib/constants';
import { calcularCuota, calcularCuotaSimple, FilaAmortizacion } from './creditoHelpers';

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
  const [solBancoSeleccionado, setSolBancoSeleccionado] = useState('');
  const [solBancoSubSeleccionado, setSolBancoSubSeleccionado] = useState('');
  const [solTipoCuenta, setSolTipoCuenta]     = useState('ahorros');
  const [solNumeroCuenta, setSolNumeroCuenta] = useState('');
  const [solTipoDesembolso, setSolTipoDesembolso] = useState<'efectivo' | 'transferencia'>('transferencia');
  const [tasasParametrizadas, setTasasParametrizadas] = useState<Record<string, number>>({});
  // Documentos adjuntos a la solicitud (Mejora F)
  const [solDocCartaLaboral, setSolDocCartaLaboral] = useState<File | null>(null);
  const [solDocCedula, setSolDocCedula]             = useState<File | null>(null);
  // Referido: el crédito puede ser para el asociado o para un referido (persona externa)
  const [solEsParaReferido, setSolEsParaReferido]   = useState(false);
  const [solReferidoNombre, setSolReferidoNombre]   = useState('');
  const [asocIngresoMensual, setAsocIngresoMensual] = useState<number>(0);

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

      // Fetch monthly income from solicitudes_asociados
      const query = supabase.from('solicitudes_asociados').select('ingreso_mensual');
      if (userData.cedula) {
        query.eq('cedula', userData.cedula);
      } else {
        query.eq('usuario_id', userData.id);
      }
      query.order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.ingreso_mensual) {
            setAsocIngresoMensual(parseFloat(data.ingreso_mensual) || 0);
          } else {
            setAsocIngresoMensual(0);
          }
        })
        .catch(() => setAsocIngresoMensual(0));
    }
  }, [isSolicitudDialogOpen, userData?.id, userData?.cedula]); // se recarga cada vez que el dialog abre/cierra

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
    if (plazo > 12)                { toast.error('El plazo máximo permitido es de 12 meses'); return; }
    if (solEsParaReferido && !solReferidoNombre.trim()) {
      toast.error('Ingresa el nombre del referido'); return;
    }

    if (solTipoDesembolso === 'transferencia') {
      if (!solBanco.trim()) { toast.error('Ingresa el nombre del banco'); return; }
      if (!solNumeroCuenta.trim()) { toast.error('Ingresa el número de cuenta'); return; }
    }

    // ── Validar Reglas de Negocio ──
    const { data: historialCreditos, error: errHistorial } = await supabase
      .from('creditos')
      .select('id, estado, anulado, created_at, fecha_estado_cambio')
      .eq('asociado_id', userData?.id);

    if (errHistorial) {
      toast.error('Error verificando historial de créditos', { description: errHistorial.message });
      return;
    }

    const now = new Date();
    
    // 1. Penalizaciones por rechazo (48h) o anulación (7 días)
    let penalizado = false;
    let mensajePenalizacion = '';

    for (const c of (historialCreditos || [])) {
      const fechaBaseStr = c.fecha_estado_cambio || c.created_at;
      // Tratar de parsear fecha, si falla usar created_at
      const fechaReferencia = new Date(fechaBaseStr).getTime() ? new Date(fechaBaseStr) : new Date(c.created_at);
      const diffHoras = (now.getTime() - fechaReferencia.getTime()) / (1000 * 60 * 60);

      if (c.anulado) {
        if (diffHoras < (24 * 7)) {
          penalizado = true;
          mensajePenalizacion = 'Tienes un crédito anulado recientemente. Debes esperar 7 días desde la anulación para solicitar uno nuevo.';
          break;
        }
      } else if (c.estado === 'rechazado') {
        if (diffHoras < 48) {
          penalizado = true;
          mensajePenalizacion = 'Tu última solicitud fue rechazada. Debes esperar 48 horas para volver a intentarlo.';
          break;
        }
      }
    }

    if (penalizado) {
      toast.error('Operación no permitida', { description: mensajePenalizacion });
      return;
    }

    // 2. Límite de 3 solicitudes (créditos) por mes calendario
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const solicitudesDelMes = (historialCreditos || []).filter(c => new Date(c.created_at) >= startOfMonth);
    if (solicitudesDelMes.length >= 3) {
      toast.error('Límite mensual alcanzado', { description: 'Has alcanzado el límite máximo de 3 solicitudes de crédito por mes.' });
      return;
    }

    // 3. Validar que no tenga ya un crédito activo (misma regla que el administrador) - Solo si no es para un referido
    if (!solEsParaReferido) {
      const tieneActivo = (historialCreditos || []).some(c => 
        !c.anulado && ['pendiente', 'aprobado', 'desembolsado', 'en_mora', 'en_revision'].includes(c.estado)
      );
      if (tieneActivo) {
        toast.error('Operación no permitida', { description: 'Ya cuentas con un crédito activo o en trámite. Debes cancelar el crédito actual antes de solicitar uno nuevo.' });
        return;
      }
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
      const esSimple = !solEsParaReferido;
      const cuota = esSimple ? calcularCuotaSimple(monto, tasa, plazo) : calcularCuota(monto, tasa, plazo);

      // Construir observaciones incluyendo tipo de desembolso y datos bancarios si aplica
      const parteDestino  = solDestino.trim();
      const parteObs      = solObs.trim();
      const parteDesembolso = `Tipo de desembolso: ${solTipoDesembolso === 'efectivo' ? 'Efectivo' : 'Transferencia'}`;
      const parteBancaria = solTipoDesembolso === 'transferencia' ? [
        solBanco.trim()        && `Banco: ${solBanco.trim()}`,
        solTipoCuenta          && `Tipo de cuenta: ${solTipoCuenta}`,
        solNumeroCuenta.trim() && `N° cuenta: ${solNumeroCuenta.trim()}`,
      ].filter(Boolean).join(' · ') : '';

      const observacionesFinal = [parteDestino, parteObs, parteDesembolso, parteBancaria]
        .filter(Boolean).join('\n') || null;

      const { data, error } = await supabase
        .from('creditos')
        .insert({
          asociado_id:       userData?.id,
          tipo:              solTipo,
          monto,
          plazo_meses:       plazo,
          tasa_interes:      tasa,
          cuota_mensual:     cuota,
          saldo:             monto,
          estado:            'pendiente',
          observaciones:     observacionesFinal,
          anulado:           false,
          referido_nombre:   solEsParaReferido && solReferidoNombre.trim() ? solReferidoNombre.trim() : null,
          tipo_interes:      esSimple ? 'simple' : 'compuesto',
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
      setSolEsParaReferido(false); setSolReferidoNombre('');
      setSolBanco(''); setSolBancoSeleccionado(''); setSolBancoSubSeleccionado(''); setSolTipoCuenta('ahorros'); setSolNumeroCuenta('');
      setSolTipoDesembolso('transferencia');
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

  const handleAprobarSolicitudCredito = async (
    sol: any, 
    tipoInteres: 'simple' | 'compuesto' = 'compuesto',
    montoAprobado?: number,
    tasaAprobada?: number,
    plazoAprobado?: number
  ) => {
    try {
      const ahora = new Date().toISOString();
      const finalMonto = montoAprobado !== undefined ? montoAprobado : sol.monto;
      const finalTasa  = tasaAprobada !== undefined ? tasaAprobada : (sol.tasaInteres || 0);
      const finalPlazo = plazoAprobado !== undefined ? plazoAprobado : sol.plazoMeses;

      const r = finalTasa > 0 ? (Math.pow(1 + finalTasa / 100, 1 / 12) - 1) : 0;
      const cuota = tipoInteres === 'simple'
        ? (finalTasa > 0 ? Math.round(finalMonto / finalPlazo + finalMonto * r) : Math.round(finalMonto / finalPlazo))
        : calcularCuota(finalMonto, finalTasa, finalPlazo);

      const { data: creditoData, error: creditoErr } = await supabase
        .from('creditos')
        .update({
          estado:               'simulacion',
          monto:                finalMonto,
          plazo_meses:          finalPlazo,
          tasa_interes:         finalTasa,
          tipo_interes:         tipoInteres,
          cuota_mensual:        cuota,
          saldo:                finalMonto,
          fecha_estado_cambio:  ahora,
          motivo_estado_cambio: 'Aprobado con condiciones por administrador — pendiente de aceptación del asociado',
        })
        .eq('id', sol.id)
        .select()
        .single();

      if (creditoErr) throw creditoErr;

      await supabase.from('notificaciones').insert({
        usuario_id:  sol.asociadoId,
        tipo:        'solicitud_credito',
        titulo:      '✅ Solicitud de crédito aprobada',
        mensaje:     `Su crédito fue aprobado. Revise las condiciones y la tabla de amortización definitiva.`,
        leida:       false,
      });

      setSolicitudesCredito(prev => prev.filter(s => s.id !== sol.id));
      setCreditos(prev => prev.map(c =>
        c.id === sol.id
          ? {
              ...c,
              estado: 'simulacion',
              estadoAprobacion: 'simulacion',
              monto: finalMonto,
              plazo: finalPlazo,
              tasaInteres: finalTasa,
              tipoInteres: tipoInteres,
              cuotaMensual: cuota,
              saldo: finalMonto,
              fechaEstadoCambio: ahora,
              motivoEstadoCambio: 'Aprobado con condiciones por administrador',
            }
          : c
      ));

      toast.success(`✅ Solicitud de ${sol.asociado} aprobada con condiciones`, {
        description: `Enviada al asociado para su aceptación por un monto de ${formatCurrency(finalMonto)}.`,
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
    solBancoSeleccionado, setSolBancoSeleccionado,
    solBancoSubSeleccionado, setSolBancoSubSeleccionado,
    solTipoCuenta, setSolTipoCuenta,
    solNumeroCuenta, setSolNumeroCuenta,
    solTipoDesembolso, setSolTipoDesembolso,
    tasasParametrizadas,
    solDocCartaLaboral, setSolDocCartaLaboral,
    solDocCedula, setSolDocCedula,
    solEsParaReferido, setSolEsParaReferido,
    solReferidoNombre, setSolReferidoNombre,
    asocIngresoMensual,
    handleSolTipoChange,
    handleSolicitarCredito,
    handlePonerEnRevision,
    handleAprobarSolicitudCredito,
    handleRechazarSolicitudCredito,
  };
}
