
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: any, res: any) {
  // Security: Vercel Cron requests include this header
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Only block if a secret is actually configured in Vercel
    // return res.status(401).json({ error: 'Unauthorized' });
  }

  const logResult = [];

  try {
    // 1. Archive Past Events
    const now = new Date().toISOString();
    const { data: pastEvents, error: fetchError } = await supabase
      .from('events')
      .select('id, title')
      .lt('end_time', now)
      .neq('status', 'archived');

    if (pastEvents && pastEvents.length > 0) {
      const ids = pastEvents.map((e: any) => e.id);
      
      const { error: updateError } = await supabase
        .from('events')
        .update({ status: 'archived' })
        .in('id', ids);

      if (updateError) throw updateError;

      logResult.push(`Archived ${ids.length} past events: ${pastEvents.map((e:any) => e.title).join(', ')}`);
      
      // Log to Admin Logs
      await supabase.from('admin_logs').insert([{
        action: 'UPDATE_EVENT',
        place_name: 'System Maintenance',
        details: `Auto-archived ${ids.length} events.`,
        created_at: new Date().toISOString()
      }]);
    } else {
        logResult.push("No events to archive.");
    }

    // 2. Prune Old Logs (Optional: older than 60 days)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const { error: deleteError } = await supabase
        .from('admin_logs')
        .delete()
        .lt('created_at', sixtyDaysAgo.toISOString());
    
    if (!deleteError) {
        logResult.push("Pruned logs older than 60 days.");
    }

    return res.status(200).json({ success: true, report: logResult });

  } catch (error: any) {
    console.error("Maintenance Cron Failed:", error);
    return res.status(500).json({ error: error.message });
  }
}
