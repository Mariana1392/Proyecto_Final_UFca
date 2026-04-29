// Supabase Edge Function: enviar-simulacion-credito
// Notifica al asociado que su tabla de amortización está lista en la app.
// Deploy: supabase functions deploy enviar-simulacion-credito

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') ?? 'noreply@ufca.app';
const FROM_NAME      = 'UFCA – Unión Familiar de Crédito y Ahorro';

interface Payload {
  destinatario:   string;  // correo del asociado
  nombreAsociado: string;
  monto:          number;
  tasa:           number;
  plazo:          number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

function buildHtml(p: Payload): string {
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Tu simulación de crédito está lista – UFCA</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
        style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.09);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:36px 40px;text-align:center;">
            <div style="display:inline-block;background:rgba(255,255,255,.15);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;margin-bottom:14px;">📋</div>
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
              Tu simulación está lista
            </h1>
            <p style="margin:8px 0 0;font-size:13px;color:#c4b5fd;">
              Unión Familiar de Crédito y Ahorro
            </p>
          </td>
        </tr>

        <!-- Cuerpo -->
        <tr>
          <td style="padding:36px 40px 0;">
            <p style="margin:0;font-size:15px;color:#1e293b;">
              Hola, <strong>${p.nombreAsociado}</strong> 👋
            </p>
            <p style="margin:14px 0 0;font-size:14px;color:#475569;line-height:1.7;">
              El administrador de <strong>UFCA</strong> ha generado una simulación de crédito con
              tabla de amortización personalizada para ti. Ya la puedes ver completa dentro de la aplicación.
            </p>
          </td>
        </tr>

        <!-- Datos del crédito -->
        <tr>
          <td style="padding:24px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                  <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Monto solicitado</span><br>
                  <strong style="font-size:18px;color:#1e293b;">${fmt(p.monto)}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                  <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Tasa de interés (EA)</span><br>
                  <strong style="font-size:18px;color:#1e293b;">${p.tasa}%</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;">
                  <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Plazo</span><br>
                  <strong style="font-size:18px;color:#1e293b;">${p.plazo} meses</strong>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 40px 32px;text-align:center;">
            <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
              Ingresa a la app para ver la tabla de amortización completa y decidir
              si deseas <strong>confirmar</strong> o <strong>rechazar</strong> esta propuesta.
            </p>
            <a href="#"
              style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
              Ver mi simulación en UFCA
            </a>
          </td>
        </tr>

        <!-- Aviso -->
        <tr>
          <td style="padding:0 40px 32px;">
            <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;">
              <p style="margin:0;font-size:12px;color:#92400e;line-height:1.6;">
                ⚠️ Esta simulación no compromete ningún crédito. Solo se registrará si la confirmas
                desde tu panel en la aplicación.
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1e293b;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
              © ${year} UFCA – Unión Familiar de Crédito y Ahorro<br>
              Este correo fue generado automáticamente. Por favor no respondas a este mensaje.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const payload: Payload = await req.json();

    if (!payload.destinatario || !payload.nombreAsociado) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = buildHtml(payload);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    `${FROM_NAME} <${FROM_EMAIL}>`,
        to:      [payload.destinatario],
        subject: `UFCA – Tu simulación de crédito está lista`,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', data);
      return new Response(JSON.stringify({ error: 'Error al enviar el correo.', detail: data }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Edge Function error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
