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

async function comRetry(fn, tentativas) {
  let ultimo;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fn();
      // 429/5xx: vale re-tentar com backoff; outros status retornam direto
      if (!r.ok && (r.status === 429 || r.status >= 500) && i < tentativas - 1) {
        ultimo = new Error(`HTTP ${r.status}`);
      } else {
        return r;
      }
    } catch (e) {
      ultimo = e;
      if (i === tentativas - 1) throw e;
    }
    // backoff exponencial: 2s, 4s, 8s — não marretar o rate limit
    await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i)));
  }
  throw ultimo;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { numero, apenas } = req.query;
  if (!numero) return res.status(400).json({ erro: 'numero required' });

  const digits = numero.replace(/\D/g, '');
  if (digits.length < 15) return res.status(400).json({ erro: 'Numero invalido (minimo 15 digitos)' });

  const result = { datajud: null, djen: null };

  const pDatajud = comRetry(() => fetchComTimeout(
    'https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search',
    {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ size: 1, query: { term: { numeroProcesso: digits } } })
    },
    22000
  ), 2);

  // apenas=datajud: browser já tem o DJEN — responder assim que o DataJud voltar (sem esperar DJEN)
  const pDjen = apenas === 'datajud' ? null : comRetry(() => fetchComTimeout(
    `https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroProcesso=${digits}&pagina=1&itensPorPagina=100`,
    {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    },
    20000
  ), 1);

  const [djRes, djenRes] = await Promise.allSettled([pDatajud, pDjen ?? Promise.resolve(null)]);

  if (djRes.status === 'fulfilled' && djRes.value.ok) {
    try { result.datajud = await djRes.value.json(); } catch { result.erroDatajud = 'parse error'; }
  } else if (djRes.status === 'rejected') {
    result.erroDatajud = djRes.reason?.message || 'erro';
  } else {
    result.erroDatajud = `HTTP ${djRes.value?.status}`;
  }

  if (pDjen) {
    if (djenRes.status === 'fulfilled' && djenRes.value?.ok) {
      try { result.djen = await djenRes.value.json(); } catch { result.erroDjen = 'parse error'; }
    } else {
      result.erroDjen = djenRes.reason?.message || `HTTP ${djenRes.value?.status}`;
    }
  }

  return res.json(result);
};
