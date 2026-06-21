import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nqzpoioxvbqavrtphtoa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xenBvaW94dmJxYXZydHBodG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMyNDgsImV4cCI6MjA5MDgxOTI0OH0.G1VlS8doiHQtooC2tyiiHbWl4h9kqoMSuirShDhhjzk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { count, error } = await supabase
    .from('catalog_products')
    .select('*', { count: 'exact', head: true })
    .in('source', ['b2drop', 'c7drop'])
    .eq('is_blocked', false);

  if (error) {
    console.error(error);
    return;
  }

  const { data: counts } = await supabase
    .from('catalog_products')
    .select('source')
    .in('source', ['b2drop', 'c7drop'])
    .eq('is_blocked', false);

  const breakdown = {};
  counts?.forEach(row => {
    breakdown[row.source] = (breakdown[row.source] || 0) + 1;
  });

  console.log('Breakdown per source:', breakdown);
  console.log('Total non-blocked (b2drop + c7drop):', count);
}

run();
