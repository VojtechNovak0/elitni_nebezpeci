// supabase-client.js – Inicializace Supabase klienta

const { createClient } = window.supabase;

const supabaseUrl = 'https://txzvsyfwfbvlxmadfbja.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4enZzeWZ3ZmJ2bHhtYWRmYmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MDI2NzUsImV4cCI6MjA4ODE3ODY3NX0.a-_FS9e1Pu4BnS8mE2S4QGxOjGt2dQulxk2Rb-nkZGc';

const supabaseClient = createClient(supabaseUrl, supabaseKey);
