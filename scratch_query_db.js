const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function run() {
  console.log("Checking columns of liquidaciones...");
  const { data: row, error: rowErr } = await supabase.from('liquidaciones').select('*').limit(1);
  if (rowErr) {
    console.error("Error fetching liquidaciones:", rowErr);
  } else {
    console.log("liquidaciones columns:", row && row[0] ? Object.keys(row[0]) : "No rows found, but table exists");
  }

  console.log("\nTesting RPC actualizar_liquidacion with a dummy UUID...");
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('actualizar_liquidacion', {
    p_id: '00000000-0000-0000-0000-000000000000'
  });
  console.log("RPC Error/Result:", { rpcRes, rpcErr });

  console.log("\nFetching recent liquidaciones to test with a real ID...");
  const { data: recent, error: recentErr } = await supabase.from('liquidaciones').select('id, asociado_id, estado, tipo, anulado').limit(5);
  if (recentErr) {
    console.error("Error fetching recent liquidaciones:", recentErr);
  } else {
    console.log("Recent liquidaciones:", recent);
    if (recent && recent.length > 0) {
      const target = recent[0];
      console.log(`\nTesting RPC actualizar_liquidacion on real ID: ${target.id} with status 'Pagada'`);
      const { data: testRes, error: testErr } = await supabase.rpc('actualizar_liquidacion', {
        p_id: target.id,
        p_estado: 'Pagada'
      });
      console.log("RPC call result on real ID:", { testRes, testErr });
    }
  }
}

run().catch(console.error);
