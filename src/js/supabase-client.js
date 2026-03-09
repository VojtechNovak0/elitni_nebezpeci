// supabase-client.js – Inicializace Supabase klienta

const { createClient } = window.supabase;

// Klíče jsou injektovány serverem přes /js/env-config.js
const supabaseUrl = window.SUPABASE_URL;
const supabaseKey = window.SUPABASE_ANON_KEY;

const supabaseClient = createClient(supabaseUrl, supabaseKey);
