

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // The third argument '' means load ALL env vars, not just VITE_ prefixed ones.
  // @ts-ignore
  const env = loadEnv(mode, process.cwd(), '');

  // SECURITY: Only expose PUBLIC-SAFE keys to the browser bundle.
  // - Supabase anon key is public by design (protected by RLS)
  // - Google Maps JS key MUST be HTTP-referrer-restricted in Google Console
  // - NEVER put server-side keys (Places, Geocoding, service_role) here
  //
  // 2026-04-22: Removed VITE_GOOGLE_PLACES_API_KEY — was root cause of $1,869 incident.
  // Places API calls must go through a server-side proxy, not the browser.
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  // Maps JS key — MUST be referrer-restricted in Google Console before use
  const mapsJsKey = env.VITE_GOOGLE_MAPS_JS_KEY || process.env.VITE_GOOGLE_MAPS_JS_KEY || '';

  return {
    plugins: [react()],
    define: {
      'process.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      'process.env.VITE_GOOGLE_MAPS_JS_KEY': JSON.stringify(mapsJsKey),
      'process.env': {}
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    server: {
      port: 3000,
    }
  };
});