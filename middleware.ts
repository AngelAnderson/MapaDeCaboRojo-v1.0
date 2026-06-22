import { rewrite, next } from '@vercel/edge'

// Edge Middleware runs BEFORE the filesystem, so it can serve the registry at the
// clean root of registromedicopr.com (a vercel.json rewrite can't — dist/index.html
// wins the root for mapadecaborojo.com). Scoped to '/' only; everything else passes through.
export const config = {
  matcher: '/',
}

export default function middleware(request: Request) {
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase()
  if (host === 'registromedicopr.com' || host === 'www.registromedicopr.com') {
    // URL stays registromedicopr.com/ — content served from the registro handler.
    return rewrite(new URL('/api/mapa-pages?page=registro', request.url))
  }
  return next()
}
