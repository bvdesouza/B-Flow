import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.log('No supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .ilike('name', '%Fernanda%');
    
  if (error) {
    console.error(error);
    return;
  }
  
  if (data && data.length > 0) {
    const student = data[0];
    console.log('Student:', student.name, student.id);
    const { data: sessions, error: sessErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('reference_id', student.id);
      
    if (sessErr) {
      console.error(sessErr);
      return;
    }
    
    console.log('Sessions:');
    sessions.forEach(s => {
      console.log(`- ID: ${s.id}, Date: ${s.date}, Status: ${s.status}`);
    });
  } else {
    console.log('No student found');
  }
}

run();
