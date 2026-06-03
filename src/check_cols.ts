import { supabase } from './lib/supabase';

async function main() {
  const { data, error } = await supabase.from('liquidaciones').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else if (data && data.length > 0) {
    console.log('Columns in liquidaciones:', Object.keys(data[0]));
  } else {
    // try to get column names from information schema via rpc if possible or just log no rows
    console.log('No rows found, cannot infer columns from empty result.');
  }
}
main();
