import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  // Set CORS headers on all responses
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  // Auth check
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { action } = req.query;

  try {
    switch (action) {
      // ── List all users ──────────────────────────────────────────────────────────
      case 'list': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        const { data, error } = await supabaseAdmin.auth.admin.listUsers();
        if (error) throw error;
        const users = data.users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.user_metadata?.name || '',
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
        }));
        return res.status(200).json({ users });
      }

      // ── Create user ─────────────────────────────────────────────────────────────
      case 'create': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const { email, password, name } = req.body || {};
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: name || '' },
        });
        if (error) throw error;
        return res.status(200).json({ user: data.user });
      }

      // ── Reset password ──────────────────────────────────────────────────────────
      case 'reset-password': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const { userId, newPassword } = req.body || {};
        if (!userId || !newPassword) return res.status(400).json({ error: 'userId and newPassword required' });
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      // ── Delete user ─────────────────────────────────────────────────────────────
      case 'delete': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const { userId } = req.body || {};
        if (!userId) return res.status(400).json({ error: 'userId required' });
        if (userId === user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      // ── Update own profile ──────────────────────────────────────────────────────
      case 'update-profile': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const { name } = req.body || {};
        const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          user_metadata: { name: name || '' },
        });
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err: any) {
    console.error('[admin-users]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
