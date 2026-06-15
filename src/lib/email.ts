// src/lib/email.ts
// Helper to send liquidation notification emails using SendGrid (or any HTTP email service).
// The API key should be provided via an environment variable (VITE_SENDGRID_API_KEY).
// This module is deliberately lightweight and does not expose the key in the client bundle.
// In a production setup you would move the call to a server‑side function (Supabase Edge Function) to keep the key secret.

export interface LiquidacionEmailPayload {
  to: string; // recipient email address
  tipo: string;
  fechaCorte: string; // ISO date string (YYYY‑MM‑DD)
  montoNeto: number; // net amount in COP
}

/**
 * Sends the email via EmailJS.
 * Returns true on success, otherwise false.
 */
export async function sendLiquidacionEmail(
  payload: LiquidacionEmailPayload
): Promise<boolean> {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const userId = import.meta.env.VITE_EMAILJS_USER_ID;

  if (!serviceId || !templateId || !userId) {
    console.warn('EmailJS env variables not set – email not sent');
    return false;
  }

  const templateParams = {
    to_email: payload.to,
    tipo_liquidacion: payload.tipo,
    fecha_corte: payload.fechaCorte,
    monto_neto: payload.montoNeto.toLocaleString('es-CO'),
    accion: payload.montoNeto >= 0 ? 'creado' : 'actualizado',
  };

  try {
    const emailjs = await import('emailjs-com');
    const result = await emailjs.send(serviceId, templateId, templateParams, userId);
    return result.status === 200;
  } catch (e) {
    console.error('Error sending email via EmailJS', e);
    return false;
  }
}
