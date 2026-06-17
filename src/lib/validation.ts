/**
 * Valida si una cadena de texto tiene un formato de correo electrónico válido,
 * previniendo errores comunes de escritura como ".com.vom", ".con", o nombres de dominio con erratas.
 */
export const validateEmail = (email: string): boolean => {
  const emailTrimmed = email.trim();
  
  // 1. No debe contener espacios en blanco en su interior
  if (/\s/.test(emailTrimmed)) return false;

  // 2. Longitud total máxima de 254 caracteres
  if (emailTrimmed.length > 254) return false;

  // 3. Debe contener exactamente una @
  const parts = emailTrimmed.split('@');
  if (parts.length !== 2) return false;

  const localPart = parts[0];
  const domain = parts[1];

  // 4. Parte local (antes de la @) de máximo 64 caracteres
  if (localPart.length > 64 || localPart.length === 0) return false;

  // 5. Parte de dominio (después de la @) de máximo 255 caracteres
  if (domain.length > 255 || domain.length === 0) return false;

  // Expresión regular base para verificar estructura general (usuario@dominio.tld)
  const baseRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!baseRegex.test(emailTrimmed)) return false;

  const domainParts = domain.split('.');
  if (domainParts.length < 2) return false;
  
  const tld = domainParts[domainParts.length - 1].toLowerCase();
  
  // Listado de dominios de nivel superior (TLD) válidos y comunes en nuestro contexto
  const validTLDs = new Set([
    'com', 'co', 'net', 'org', 'edu', 'gov', 'mil', 'info', 'biz', 'online', 
    'xyz', 'club', 'app', 'dev', 'es', 'ar', 'mx', 'cl', 'pe', 'br', 'uy', 
    've', 'ec', 'bo', 'py', 'us', 'uk', 'ca', 'fr', 'it', 'de', 'jp', 'cn', 
    'in', 'ru', 'lat', 'tech', 'site', 'store', 'cc', 'tv', 'me', 'io'
  ]);
  
  if (!validTLDs.has(tld)) return false;

  // Validación de proveedores conocidos (para evitar cosas como gmail.com.vom o hotmail.com.com)
  const provider = domainParts.find(p => ['gmail', 'hotmail', 'yahoo', 'outlook'].includes(p.toLowerCase()));
  if (provider) {
    const validDomains = new Set([
      'gmail.com', 'gmail.co', 'gmail.es', 'gmail.com.co',
      'hotmail.com', 'hotmail.co', 'hotmail.es', 'hotmail.com.co',
      'yahoo.com', 'yahoo.co', 'yahoo.es', 'yahoo.com.co',
      'outlook.com', 'outlook.co', 'outlook.es', 'outlook.com.co'
    ]);
    if (!validDomains.has(domain.toLowerCase())) {
      return false;
    }
  }

  // Prevenir erratas comunes en los nombres de dominio de los proveedores
  const lowerDomain = domain.toLowerCase();
  if (
    lowerDomain.includes('gamil') || 
    lowerDomain.includes('gmal') || 
    lowerDomain.includes('gmaill') || 
    lowerDomain.includes('hotmal') || 
    lowerDomain.includes('hotmai') || 
    lowerDomain.includes('outlok')
  ) {
    return false;
  }

  return true;
};

/**
 * Valida de forma asíncrona si el dominio del correo electrónico existe y está configurado
 * para recibir correos (tiene registros MX o al menos un registro A/AAAA).
 * Utiliza APIs de DNS-over-HTTPS (DoH) públicas de Cloudflare y Google de forma gratuita y sin API keys.
 */
export const validateEmailDomain = async (email: string): Promise<boolean> => {
  const emailTrimmed = email.trim();
  const parts = emailTrimmed.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1].toLowerCase();

  // Omitir validación de DNS si es un dominio local de pruebas (localhost, example.com, test.com, etc.)
  const localDomains = new Set(['localhost', 'local', 'example.com', 'test.com', 'pruebas.com']);
  if (localDomains.has(domain) || domain.endsWith('.local') || domain.endsWith('.localhost')) {
    return true;
  }

  try {
    // 1. Consultar registros MX en Cloudflare DoH (DNS-over-HTTPS)
    const cfUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`;
    const cfResponse = await fetch(cfUrl, {
      headers: { 'accept': 'application/dns-json' }
    });

    if (cfResponse.ok) {
      const data = await cfResponse.json();
      // Status 0 es NOERROR (exitoso)
      if (data && data.Status === 0 && data.Answer && data.Answer.length > 0) {
        return true;
      }
      // Si el status es 3 (NXDOMAIN), el dominio definitivamente no existe
      if (data && data.Status === 3) {
        return false;
      }
    }

    // 2. Si no tiene MX, o si falló Cloudflare, intentamos con Google DoH como respaldo para registros MX
    const googleUrl = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;
    const googleResponse = await fetch(googleUrl);
    if (googleResponse.ok) {
      const data = await googleResponse.json();
      if (data && data.Status === 0 && data.Answer && data.Answer.length > 0) {
        return true;
      }
      if (data && data.Status === 3) {
        return false;
      }
    }

    // 3. Si no se encontraron registros MX, algunos dominios antiguos o configuraciones simples
    // usan el registro A del dominio principal como fallback para el correo.
    // Consultamos registros A en Cloudflare
    const cfAUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`;
    const cfAResponse = await fetch(cfAUrl, {
      headers: { 'accept': 'application/dns-json' }
    });
    if (cfAResponse.ok) {
      const data = await cfAResponse.json();
      if (data && data.Status === 0 && data.Answer && data.Answer.length > 0) {
        return true;
      }
      if (data && data.Status === 3) {
        return false;
      }
    }

    // Si ambos servicios responden correctamente pero no encuentran registros MX ni A, el dominio no existe o no tiene IP/correo
    return false;
  } catch (error) {
    console.warn('[Validation] Error consultando DNS para validación de dominio de correo:', error);
    // En caso de error de red o de las APIs de DNS, retornamos true para no bloquear al usuario
    return true;
  }
};
