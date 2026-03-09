require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

// Dynamický endpoint – vrátí konfiguraci jako JS skript pro prohlížeč
app.get('/js/env-config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
    window.SUPABASE_URL = "${process.env.SUPABASE_URL}";
    window.SUPABASE_ANON_KEY = "${process.env.SUPABASE_ANON_KEY}";
  `);
});

// Servíruj statické soubory ze složky src
app.use(express.static(path.join(__dirname, 'src')));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server běží na portu ${port}`);
});
