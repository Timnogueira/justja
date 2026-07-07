const DATAJUD_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

async function fetchComTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(timer);
    return r;
  } catch (e) {
    clearTimeout(timer);
    throw e.name === 'AbortError' ? new Error(`timeout ${ms}ms`) : e;
  }
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
    fetchComTimeout(
      'https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search',
      {
        method: 'POST',
        headers: {
          'Authorization': `APIKey ${DATAJUD_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: { match: { numeroProcesso: digits } }, size: 1 })
      },
      9000
    ),
    fetchComTimeout(
      `https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroProcesso=${digits}&pagina=1&itensPorPagina=5`,
      {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      },
      9000
    )
  ]);

  if (djRes.status === 'fulfilled' && djRes.value.ok) {
    try { result.datajud = await djRes.value.json(); } catch { result.erroDatajud = 'parse error'; }
  } else {
    result.erroDatajud = djRes.reason?.message || `HTTP ${djRes.value?.status}`;
  }

  if (djenRes.status === 'fulfilled' && djenRes.value.ok) {
    try { result.djen = await djenRes.value.json(); } catch { result.erroDjen = 'parse error'; }
  } else {
    result.erroDjen = djenRes.reason?.message || `HTTP ${djenRes.value?.status}`;
  }

  return res.json(result);
};
