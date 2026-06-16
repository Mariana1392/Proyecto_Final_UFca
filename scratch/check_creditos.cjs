const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2].replace(/["'\r]/g, '');
});

const sb = createClient(envVars['VITE_SUPABASE_URL'], envVars['VITE_SUPABASE_ANON_KEY']);

async function main() {
  const { data, error } = await sb.from('creditos').select('*').limit(5);
  console.log("Error:", error);
  if (data) {
     console.log("Keys in creditos:", Object.keys(data[0] || {}));
  }
}
main();
