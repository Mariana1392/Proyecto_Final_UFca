// @ts-nocheck — archivo Deno (Edge Function), no Node.
// Supabase Edge Function: recordatorio-activacion
//
// Detecta asociados aprobados hace 10+ horas que nunca han ingresado al sistema
// y les envía un email de recordatorio con un nuevo link de acceso via Resend.
//
// Deploy: supabase functions deploy recordatorio-activacion
// Cron:   cada hora via pg_cron (ver SQL al final de este archivo)

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Variables de entorno ─────────────────────────────────────────────────────
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY    = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL        = Deno.env.get('FROM_EMAIL') ?? 'noreply@ufca.app';
const APP_URL           = Deno.env.get('APP_URL') ?? 'https://interfaz-web-profesional-ufca-9.vercel.app';
const CRON_SECRET       = Deno.env.get('CRON_SECRET') ?? '';

const FROM_NAME = 'UFCA – Unión Familiar de Crédito y Ahorro';

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── HTML del email recordatorio ───────────────────────────────────────────────
function buildHtmlRecordatorio(nombre: string, enlace: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Recordatorio – Activa tu cuenta UFCA</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f7f6">
<tr><td align="center" style="padding:20px 12px;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

    <!-- HEADER -->
    <tr>
      <td bgcolor="#1a5c3a" style="border-radius:12px 12px 0 0;padding:28px 20px;text-align:center;">
        <p style="margin:0;color:#e8c547;font-size:26px;font-weight:900;letter-spacing:5px;font-family:Arial,sans-serif;">UFCA</p>
        <p style="margin:5px 0 0;color:#a7d9b8;font-size:10px;letter-spacing:2px;font-family:Arial,sans-serif;">UNIÓN FAMILIAR DE CRÉDITO Y AHORRO</p>
      </td>
    </tr>

    <!-- BODY -->
    <tr>
      <td bgcolor="#ffffff" style="border:1px solid #e0e0e0;border-top:none;padding:28px 20px;">

        <!-- Ícono reloj -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="padding-bottom:12px;">
              <div style="width:60px;height:60px;border-radius:50%;background:#fff8e1;text-align:center;line-height:60px;font-size:28px;">⏰</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:4px;">
              <p style="margin:0;color:#1a3c2e;font-size:20px;font-weight:700;font-family:Arial,sans-serif;">Tu cuenta te está esperando</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <p style="margin:0;color:#6b7280;font-size:13px;font-family:Arial,sans-serif;">Notamos que aún no has ingresado al sistema</p>
            </td>
          </tr>
        </table>

        <!-- Texto -->
        <p style="margin:0 0 8px;color:#374151;font-size:15px;font-family:Arial,sans-serif;">Hola <strong>${nombre}</strong>,</p>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7;font-family:Arial,sans-serif;">
          Tu solicitud de ingreso a <strong>UFCA</strong> fue aprobada, pero notamos que aún no has creado tu contraseña ni ingresado al sistema.
          <br><br>
          Te enviamos un <strong>nuevo enlace de acceso</strong> para que puedas completar tu registro:
        </p>

        <!-- Caja CTA -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid #f59e0b;border-radius:10px;margin-bottom:20px;background:#fffbeb;">
          <tr>
            <td style="padding:18px 16px;">
              <p style="margin:0 0 6px;color:#92400e;font-weight:700;font-size:13px;font-family:Arial,sans-serif;">⚡ Accede ahora antes de que expire</p>
              <p style="margin:0 0 14px;color:#78350f;font-size:13px;line-height:1.5;font-family:Arial,sans-serif;">
                Este enlace es válido por <strong>24 horas</strong> y es de un solo uso.
              </p>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td bgcolor="#1a5c3a" style="border-radius:8px;padding:14px 28px;">
                          <a href="${enlace}"
                             style="color:#e8c547;font-size:14px;font-weight:bold;
                                    text-decoration:none;font-family:Arial,sans-serif;
                                    white-space:nowrap;">
                            Crear mi contrase&#241;a e ingresar &#8594;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Info -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0fdf4" style="border-radius:10px;margin-bottom:16px;">
          <tr>
            <td style="padding:16px;">
              <p style="margin:0 0 10px;color:#065f46;font-weight:700;font-size:13px;font-family:Arial,sans-serif;">Como asociado tendrás acceso a:</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="50%" style="color:#374151;font-size:13px;padding:3px 0;font-family:Arial,sans-serif;">&#9989; Ahorro permanente</td>
                  <td width="50%" style="color:#374151;font-size:13px;padding:3px 0;font-family:Arial,sans-serif;">&#9989; Ahorro voluntario</td>
                </tr>
                <tr>
                  <td style="color:#374151;font-size:13px;padding:3px 0;font-family:Arial,sans-serif;">&#9989; Créditos con bajas tasas</td>
                  <td style="color:#374151;font-size:13px;padding:3px 0;font-family:Arial,sans-serif;">&#9989; Eventos exclusivos</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.5;font-family:Arial,sans-serif;">
          Si no solicitaste ingresar a UFCA, puedes ignorar este correo.<br>
          Si tienes dudas, comunícate con nosotros.
        </p>

      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td bgcolor="#1a5c3a" style="border-radius:0 0 12px 12px;padding:14px;text-align:center;">
        <p style="margin:0;color:#a7d9b8;font-size:11px;font-family:Arial,sans-serif;">&#169; ${year} UFCA &#8212; Unión Familiar de Crédito y Ahorro</p>
      </td>
    </tr>

  </table>
</td></tr>
</table>

</body>
</html>`;
}

// ── Handler principal ─────────────────────────────────────────────────────────
serve(async (req) => {
  // Verificar autorización (llamada desde pg_cron con secret)
  const auth = req.headers.get('Authorization') ?? '';
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    // 1. Buscar solicitudes aprobadas hace 10h+ donde el usuario no ha ingresado
    const hace10h = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
    const hace72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(); // máx 3 días

    const { data: solicitudes, error: solErr } = await supabaseAdmin
      .from('solicitudes_asociados')
      .select('id, nombres, apellidos, email, usuario_id, fecha_resolucion, recordatorio_enviado_at')
      .eq('estado', 'pendiente_activacion')
      .not('email', 'is', null)
      .lte('fecha_resolucion', hace10h)      // aprobada hace 10h+
      .gte('fecha_resolucion', hace72h)      // no más de 3 días (evitar spam)
      .or('recordatorio_enviado_at.is.null,recordatorio_enviado_at.lte.' + hace72h); // no enviado aún

    if (solErr) throw new Error(`Error al consultar solicitudes: ${solErr.message}`);
    if (!solicitudes?.length) {
      return new Response(JSON.stringify({ ok: true, procesados: 0, mensaje: 'Sin pendientes' }), { status: 200 });
    }

    const resultados: any[] = [];

    for (const sol of solicitudes) {
      try {
        // 2. Verificar que el usuario no ha ingresado nunca
        if (sol.usuario_id) {
          const { data: usr } = await supabaseAdmin
            .from('usuarios')
            .select('ultimo_acceso')
            .eq('id', sol.usuario_id)
            .maybeSingle();
          if (usr?.ultimo_acceso) {
            // Ya ingresó — actualizar estado de solicitud a aprobada
            await supabaseAdmin
              .from('solicitudes_asociados')
              .update({ estado: 'aprobada' })
              .eq('id', sol.id);
            continue;
          }
        }

        const nombre = `${sol.nombres} ${sol.apellidos}`.trim();

        // 3. Generar link de acceso
        // Si ya tiene cuenta (abrió el link pero no completó) → recovery
        // Si nunca abrió el link → nuevo invite
        let enlace = '';

        if (sol.usuario_id) {
          const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: sol.email,
            options: { redirectTo: `${APP_URL}/?bienvenido=1` },
          });
          if (linkErr) throw new Error(linkErr.message);
          enlace = linkData?.properties?.action_link ?? '';
        } else {
          const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
            type: 'invite',
            email: sol.email,
            options: {
              redirectTo: `${APP_URL}/?bienvenido=1`,
              data: { nombre, rol: 'asociado' },
            },
          });
          if (linkErr) throw new Error(linkErr.message);
          enlace = linkData?.properties?.action_link ?? '';
        }

        if (!enlace) throw new Error('No se pudo generar el enlace');

        // 4. Enviar email via Resend
        const html = buildHtmlRecordatorio(nombre, enlace);

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from:    `${FROM_NAME} <${FROM_EMAIL}>`,
            to:      [sol.email],
            subject: '⏰ UFCA — Aún no has ingresado al sistema',
            html,
          }),
        });

        if (!resendRes.ok) {
          const err = await resendRes.json();
          throw new Error(`Resend error: ${JSON.stringify(err)}`);
        }

        // 5. Marcar recordatorio enviado
        await supabaseAdmin
          .from('solicitudes_asociados')
          .update({ recordatorio_enviado_at: new Date().toISOString() })
          .eq('id', sol.id);

        resultados.push({ email: sol.email, nombre, estado: 'enviado' });

      } catch (err: any) {
        console.error(`[recordatorio] Error con ${sol.email}:`, err.message);
        resultados.push({ email: sol.email, estado: 'error', error: err.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, procesados: resultados.length, resultados }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[recordatorio-activacion] Error general:', err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
});

/*
─────────────────────────────────────────────────────────────────────────────
SETUP EN SUPABASE (ejecutar en SQL Editor):

1. Agregar columna de control en solicitudes_asociados:
   ALTER TABLE solicitudes_asociados
   ADD COLUMN IF NOT EXISTS recordatorio_enviado_at timestamptz;

2. Habilitar extensiones (si no están activas):
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   CREATE EXTENSION IF NOT EXISTS pg_net;

3. Crear job de cron (cada hora):
   SELECT cron.schedule(
     'recordatorio-activacion-cron',
     '0 * * * *',
     $$
     SELECT net.http_post(
       url     := 'https://[PROJECT-REF].supabase.co/functions/v1/recordatorio-activacion',
       headers := jsonb_build_object(
         'Content-Type',  'application/json',
         'Authorization', 'Bearer [CRON_SECRET]'
       ),
       body    := '{}'::jsonb
     );
     $$
   );

4. Variables de entorno en Supabase → Edge Functions → recordatorio-activacion:
   RESEND_API_KEY       = [tu clave de Resend]
   FROM_EMAIL           = noreply@ufca.app (o el dominio verificado en Resend)
   APP_URL              = https://interfaz-web-profesional-ufca-9.vercel.app
   CRON_SECRET          = [genera uno en: openssl rand -hex 32]

5. Deploy:
   supabase functions deploy recordatorio-activacion
─────────────────────────────────────────────────────────────────────────────
*/
