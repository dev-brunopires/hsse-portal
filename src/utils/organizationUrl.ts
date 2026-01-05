// Utilities to build tenant/organization URLs consistently across environments.

function shouldUseOrgQueryParam(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.lovable.app') ||
    hostname.endsWith('.vercel.app')
  );
}

function getBaseDomain(hostname: string) {
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length <= 2) return hostname;
  // Drop the first label (subdomain like "www" or "platform")
  return parts.slice(1).join('.');
}

export function getOrganizationUrl(subdomain: string, path = '/') {
  if (typeof window === 'undefined') return '';

  const { origin, protocol, hostname } = window.location;

  // Preview/dev environments: subdomains won't resolve, so we route via query param.
  if (shouldUseOrgQueryParam(hostname)) {
    const url = new URL(origin);
    url.pathname = path;
    url.searchParams.set('org', subdomain);
    return url.toString();
  }

  const baseDomain = getBaseDomain(hostname);
  return `${protocol}//${subdomain}.${baseDomain}${path}`;
}

export function getOrganizationUrlSuffix() {
  if (typeof window === 'undefined') return '';

  const hostname = window.location.hostname;
  if (shouldUseOrgQueryParam(hostname)) return '?org=';

  return `.${getBaseDomain(hostname)}`;
}
