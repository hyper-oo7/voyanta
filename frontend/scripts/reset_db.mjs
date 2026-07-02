import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[k] = v;
  }
});

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log('No Supabase credentials in .env');
  process.exit(0);
}

const supabase = createClient(url, key);

async function run() {
  console.log('Wiping all proposal items...');
  const res1 = await supabase.from('proposal_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Items delete result:', res1.error ? res1.error.message : 'SUCCESS');

  console.log('Wiping all proposals...');
  const res2 = await supabase.from('proposals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Proposals delete result:', res2.error ? res2.error.message : 'SUCCESS');

  console.log('Database reset to ZERO complete!');
}

run();
