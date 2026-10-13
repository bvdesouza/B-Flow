import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function backup() {
  const tables = ['students', 'groups', 'group_students', 'plans', 'sessions', 'profiles'];
  const backupData: Record<string, any> = {};
  let hasError = false;

  console.log("Iniciando backup...");

  for (const table of tables) {
    console.log(`Buscando dados da tabela: ${table}...`);
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.error(`Erro ao buscar ${table}:`, error);
      hasError = true;
    } else {
      backupData[table] = data;
      console.log(`Tabela ${table} copiada (${data.length} registros).`);
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.json`;
  
  fs.writeFileSync(filename, JSON.stringify(backupData, null, 2));
  console.log(`Backup concluído! Arquivo salvo como: ${filename}`);
  
  // Save as backup.json as well for easy access
  fs.writeFileSync('backup.json', JSON.stringify(backupData, null, 2));
  console.log(`Cópia salva como: backup.json`);
}

backup();
