import { rewrite, next } from '@vercel/edge'

// Edge Middleware runs BEFORE the filesystem, so it can serve the registry at the
// clean root of registromedicopr.com (a vercel.json rewrite can't — dist/index.html
// wins the root for mapadecaborojo.com). Scoped to '/' and '/categoria/*'.
export const config = {
  matcher: ['/', '/categoria/:slug*'],
}

export default function middleware(request: Request) {
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase()
  const isReg = host === 'registromedicopr.com' || host === 'www.registromedicopr.com'
  const path = new URL(request.url).pathname

  // /categoria/* es una ruta del Mapa. Servida bajo registromedicopr.com le entregaba
  // al vecino una página con marca de MapaDeCaboRojo y canonical a otro dominio, y
  // Google la tenía rankeando en posición 11 para "neurologo cabo rojo" mientras la
  // página que sí contesta (/registro/neurologo/cabo-rojo) se quedaba atrás.
  if (isReg && path.startsWith('/categoria/')) {
    const slug = path.slice('/categoria/'.length).split('/')[0]
    const dest = slug ? `/registro/${slug}` : '/registro'
    return Response.redirect(new URL(dest, request.url), 301)
  }

  if (isReg && path === '/') {
    // URL stays registromedicopr.com/ — content served from the registro handler.
    return rewrite(new URL('/api/mapa-pages?page=registro', request.url))
  }
  if (host === 'puertoricosinfiltros.com' || host === 'www.puertoricosinfiltros.com') {
    // URL stays puertoricosinfiltros.com/ — the third face of the substrate: PR's public record.
    return rewrite(new URL('/api/mapa-pages?page=sinfiltros', request.url))
  }
  return next()
}
