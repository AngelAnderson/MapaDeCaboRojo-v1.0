
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // The third argument '' means load ALL env vars, not just VITE_ prefixed ones.
  // @ts-ignore
  const env = loadEnv(mode, process.cwd(), '');

  // Fallback to process.env for system variables (important for Vercel/Netlify CI/CD)
  // CHECK ALL POSSIBLE KEY NAMES: VITE_API_KEY, API_KEY, VITE_GOOGLE_API_KEY
  const apiKey = env.VITE_API_KEY || env.API_KEY || env.VITE_GOOGLE_API_KEY || 
                 process.env.VITE_API_KEY || process.env.API_KEY || process.env.VITE_GOOGLE_API_KEY || '';
  
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  return {
    plugins: [react()],
    define: {
      // Shims for process.env variables to work in browser
      'process.env.API_KEY': JSON.stringify(apiKey),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      // Global process.env fallback to empty object to prevent "process is not defined" errors
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