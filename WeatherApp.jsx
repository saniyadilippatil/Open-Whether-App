import React, { useEffect, useState, useRef } from 'react';

const USE_PROXY = false; // set true if using a backend proxy
const OWM_API_KEY = import.meta.env.VITE_OWM_API_KEY || 'REPLACE_WITH_KEY';
const API_BASE_URL = USE_PROXY ? '/api' : 'https://api.openweathermap.org/data/2.5';

function iconUrl(icon){ return `https://openweathermap.org/img/wn/${icon}@2x.png`; }

export default function WeatherApp(){
  const [q, setQ] = useState('');
  const [unit, setUnit] = useState(localStorage.getItem('weather_unit') || 'metric');
  const [history, setHistory] = useState(JSON.parse(localStorage.getItem('weather_history')||'[]'));
  const [now, setNow] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  useEffect(()=>{ return ()=>{ mounted.current = false } },[]);

  useEffect(()=>{ localStorage.setItem('weather_unit', unit) },[unit]);
  useEffect(()=>{ localStorage.setItem('weather_history', JSON.stringify(history)) },[history]);

  useEffect(()=>{ if(history.length) searchCity(history[0]) },[]); // try load last searched on mount

  function saveHistory(entry){ if(!entry) return; const normalized = entry.trim(); setHistory(prev=>{ const next = [normalized, ...prev.filter(x=>x.toLowerCase()!==normalized.toLowerCase())].slice(0,8); return next; }); }

  async function callOWM(path, params={}){
    const p = { ...params };
    if(!USE_PROXY) p.appid = OWM_API_KEY;
    if(unit !== 'standard') p.units = unit;
    const qs = Object.entries(p).filter(([_,v])=>v!==undefined).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const url = `${API_BASE_URL}/${path}?${qs}`;
    const res = await fetch(url);
    if(!res.ok){ const txt = await res.text(); throw new Error(`${res.status} ${res.statusText} - ${txt}`); }
    return res.json();
  }

  async function searchCity(city){
    if(!city) { setError('Enter a city'); return; }
    setLoading(true); setError(''); setNow(null); setForecast([]);
    try{
      const data = await callOWM('weather', { q: city });
      if(!mounted.current) return;
      setNow(data);
      saveHistory(`${data.name}${data.sys?.country ? ', ' + data.sys.country : ''}`);
      // forecast
      const f = await callOWM('forecast', { lat: data.coord.lat, lon: data.coord.lon });
      if(!mounted.current) return;
      setForecast(f.list.slice(0,10));
    }catch(err){ console.error(err); setError(err.message || 'Failed to fetch'); }
    finally{ if(mounted.current) setLoading(false); }
  }

  async function searchCoords(lat, lon){
    setLoading(true); setError(''); setNow(null); setForecast([]);
    try{
      const data = await callOWM('weather', { lat, lon });
      if(!mounted.current) return;
      setNow(data);
      saveHistory(`${data.name}${data.sys?.country ? ', ' + data.sys.country : ''}`);
      const f = await callOWM('forecast', { lat, lon });
      if(!mounted.current) return;
      setForecast(f.list.slice(0,10));
    }catch(err){ console.error(err); setError(err.message || 'Failed to fetch'); }
    finally{ if(mounted.current) setLoading(false); }
  }

  function handleGeo(){
    if(!navigator.geolocation){ setError('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(pos=>{
      searchCoords(pos.coords.latitude, pos.coords.longitude);
    }, ()=> setError('Geolocation denied or failed'));
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-xl font-semibold">Weather App</h1>
        <p className="text-sm text-slate-400">Current + 5-day forecast</p>
      </div>

      <div className="bg-slate-900/60 p-4 rounded-2xl shadow-lg">
        <div className="flex flex-wrap gap-3 mb-4">
          <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') searchCity(q) }} className="bg-transparent border border-slate-700 rounded px-3 py-2 flex-1 min-w-[220px]" placeholder="City or 'City, Country'" />
          <button onClick={()=>searchCity(q)} className="bg-blue-600 px-4 py-2 rounded">Search</button>
          <button onClick={handleGeo} className="border border-slate-700 px-3 py-2 rounded">Use my location</button>

          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-slate-400">Units</label>
            <select value={unit} onChange={e=>setUnit(e.target.value)} className="bg-transparent border border-slate-700 rounded px-2 py-1">
              <option value="metric">Metric (°C)</option>
              <option value="imperial">Imperial (°F)</option>
              <option value="standard">Kelvin (K)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-slate-800/40 p-4 rounded-lg">
            {loading && <div className="text-sm text-slate-300">Loading...</div>}
            {error && <div className="text-red-300 bg-red-900/20 p-2 rounded">{error}</div>}

            {!now && !loading && !error && <div className="text-slate-400">Search a city or use geolocation to start.</div>}

            {now && (
              <div className="flex items-center gap-4">
                <img src={iconUrl(now.weather?.[0]?.icon || '01d')} alt="" width={96} height={96} />
                <div className="flex-1">
                  <div className="text-slate-400 text-sm">{now.name}{now.sys?.country ? `, ${now.sys.country}` : ''}</div>
                  <div className="text-4xl font-bold">{Math.round(now.main.temp)}{unit==='metric'?'°C':unit==='imperial'?'°F':'K'}</div>
                  <div className="text-sm text-slate-400">Feels like {Math.round(now.main.feels_like)} • Humidity {now.main.humidity}% • Wind {now.wind.speed} {unit==='metric' ? 'm/s' : unit==='imperial' ? 'mph' : 'm/s'}</div>
                </div>
                <div className="text-sm text-slate-400">Local: {new Date(Date.now() + (now.timezone||0)*1000).toLocaleString()}</div>
              </div>
            )}

            {forecast.length>0 && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">Forecast (next slices)</h3>
                <div className="flex gap-2 overflow-x-auto">
                  {forecast.map(item=> (
                    <div key={item.dt} className="min-w-[120px] bg-white/5 p-3 rounded flex-shrink-0 text-center">
                      <div className="text-xs text-slate-400">{new Date((item.dt + (now?.timezone||0)) * 1000).toLocaleString(undefined,{weekday:'short', hour:'2-digit', minute:'2-digit'})}</div>
                      <img src={iconUrl(item.weather[0].icon)} alt="" width={60} height={60} className="mx-auto" />
                      <div className="font-semibold">{Math.round(item.main.temp)}{unit==='metric'?'°C':unit==='imperial'?'°F':'K'}</div>
                      <div className="text-xs text-slate-400">{item.weather[0].main}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="bg-slate-800/30 p-4 rounded-lg">
            <h3 className="font-medium">Search History</h3>
            <div className="flex flex-col gap-2 mt-2">
              {history.length ? history.map(h=> (
                <button key={h} onClick={()=>{ setQ(h); searchCity(h); }} className="text-left px-3 py-2 bg-white/3 rounded">{h}</button>
              )) : <div className="text-slate-400 text-sm">No recent searches</div>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>{ setHistory([]); localStorage.removeItem('weather_history'); }} className="border border-slate-700 px-3 py-2 rounded">Clear</button>
              <button onClick={()=>alert('Type a city and press Search. Or click Use my location. Toggle units from the dropdown.')} className="border border-slate-700 px-3 py-2 rounded">Help</button>
            </div>
          </aside>
        </div>

        <p className="text-xs text-slate-500 mt-3">Note: OpenWeatherMap used for demo. Use a proxy in production to keep your API key secret.</p>
      </div>
    </div>
  );
}
