/**
 * Valida si una cadena de texto tiene un formato de correo electrónico válido,
 * previniendo errores comunes de escritura como ".com.vom", ".con", o nombres de dominio con erratas.
 */
export const validateEmail = (email: string): boolean => {
  const emailTrimmed = email.trim();
  
  // Expresión regular base para verificar estructura general (usuario@dominio.tld)
  const baseRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!baseRegex.test(emailTrimmed)) return false;

  const parts = emailTrimmed.split('@');
  if (parts.length !== 2) return false;
  
  const domain = parts[1];
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
