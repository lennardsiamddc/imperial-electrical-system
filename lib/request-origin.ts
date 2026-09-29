/**
 * Same-origin CSRF boundary for cookie-authenticated mutation Route Handlers.
 * Next can reconstruct Request.url with its internal hostname (localhost) even
 * when the browser addressed 127.0.0.1. Host is the incoming request authority;
 * do not replace it with arbitrary client-supplied forwarded headers.
 * Reverse proxies must preserve the public Host and provide the correct scheme
 * through the trusted server adapter. No host aliases or wildcard allowlist.
 */
export function hasValidRequestOrigin(request:Request):boolean {
 try {
  const raw=request.headers.get('origin');
  if(!raw||raw==='null')return false;
  const origin=new URL(raw);
  if(!['http:','https:'].includes(origin.protocol)||origin.origin!==raw)return false;
  const url=new URL(request.url),host=request.headers.get('host');
  if(!['http:','https:'].includes(url.protocol))return false;
  // Synthetic Fetch Requests in tests may omit Host; real HTTP requests have it.
  if(host!==null){
   if(!host||/[\s,/@?#\\]/.test(host))return false;
   const authority=new URL(`${url.protocol}//${host}`);
   if(authority.username||authority.password||authority.pathname!=='/'||!authority.host)return false;
   return origin.origin===authority.origin;
  }
  return origin.origin===url.origin;
 }catch{return false;}
}
