const https = require('https');

const DATAJUD_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

function httpsPost(hostname, path, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ hostname, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, json: () => JSON.parse(raw) }); }
        catch(e) { reject(new Error('parse error: ' + raw.substring(0, 100))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error(`timeout ${timeoutMs}ms`)); });
    req.write(data);
    req.end();
  });
}

function httpsGet(hostname, path, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET', headers }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, json: () => JSON.parse(raw) }); }
        catch(e) { reject(new Error('parse error: ' + raw.substring(0, 100))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error(`timeout ${timeoutMs}ms`)); });
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { numero } = req.query;
  if (!numero) return res.status(400).json({ erro: 'numero required' });

  const digits = numero.replace(/\D/g, '');
  if (digits.length < 15) return res.status(400).json({ erro: 'Numero invalido (minimo 15 digitos)' });

  const result = { datajud: null, djen: null };

  const [djRes, djenRes] = await Promise.allSettled([
    httpsPost(
      'api-publica.datajud.cnj.jus.br',
      '/api_publica_tjsp/_search',
      { 'Authorization': `APIKey ${DATAJUD_KEY}`, 'Content-Type': 'application/json' },
      { query: { match: { numeroProcesso: digits } }, size: 1 },
      8000
    ),
    httpsGet(
      'comunicaapi.pje.jus.br',
      `/api/v1/comunicacao?numeroProcesso=${digits}&pagina=1&itensPorPagina=5`,
      {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      8000
    )
  ]);

  if (djRes.status === 'fulfilled' && djRes.value.ok) {
    try { result.datajud = djRes.value.json(); } catch(e) { result.erroDatajud = 'parse error'; }
  } else {
    result.erroDatajud = djRes.reason?.message || `HTTP ${djRes.value?.status}`;
  }

  if (djenRes.status === 'fulfilled' && djenRes.value.ok) {
    try { result.djen = djenRes.value.json(); } catch(e) { result.erroDjen = 'parse error'; }
  } else {
    result.erroDjen = djenRes.reason?.message || `HTTP ${djenRes.value?.status}`;
  }

  return res.json(result);
};
