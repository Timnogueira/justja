const DATAJUD_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { numero } = req.query;
  if (!numero) return res.status(400).json({ erro: 'numero required' });

  const digits = numero.replace(/\D/g, '');
  if (digits.length < 15) return res.status(400).json({ erro: 'Número de processo inválido' });

  const result = { datajud: null, djen: null };

  const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms));

  // DataJud — TJSP (paralelo com DJEN, 8s timeout cada)
  const [djRes, djenRes] = await Promise.allSettled([
    Promise.race([
      fetch('https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search', {
        method: 'POST',
        headers: { 'Authorization': `APIKey ${DATAJUD_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: { match: { numeroProcesso: digits } }, size: 1 })
      }),
      timeout(8000)
    ]),
    Promise.race([
      fetch(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroProcesso=${digits}&pagina=1&itensPorPagina=5`, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      }),
      timeout(8000)
    ])
  ]);

  if (djRes.status === 'fulfilled' && djRes.value.ok) {
    try { result.datajud = await djRes.value.json(); } catch(e) { result.erroDatajud = 'parse error'; }
  } else {
    result.erroDatajud = djRes.reason?.message || `HTTP ${djRes.value?.status}`;
  }

  if (djenRes.status === 'fulfilled' && djenRes.value.ok) {
    try { result.djen = await djenRes.value.json(); } catch(e) { result.erroDjen = 'parse error'; }
  } else {
    result.erroDjen = djenRes.reason?.message || `HTTP ${djenRes.value?.status}`;
  }

  return res.json(result);
};
