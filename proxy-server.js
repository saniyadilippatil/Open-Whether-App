// A minimal Node/Express proxy to keep your OpenWeatherMap key secret.
// Install: npm install express node-fetch dotenv

const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const OWM = process.env.OWM_API_KEY;
if(!OWM) console.warn('Warning: OWM_API_KEY not set in environment. Set it in .env or environment variables.');

app.use(express.static('public'));

app.get('/api/:path', async (req, res) => {
  try{
    const path = req.params.path; // e.g., weather, forecast
    const qs = new URLSearchParams(req.query);
    qs.set('appid', OWM || '');
    const url = `https://api.openweathermap.org/data/2.5/${path}?${qs.toString()}`;
    const r = await fetch(url);
    const text = await r.text();
    res.status(r.status).send(text);
  }catch(err){
    console.error(err);
    res.status(500).json({error: 'proxy error'});
  }
});

app.listen(PORT, ()=>console.log(`Proxy listening on http://localhost:${PORT}`));
