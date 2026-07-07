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

  // DataJud — TJSP
  try {
    const r = await fetch('https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search', {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: { match: { numeroProcesso: digits } }, size: 1 })
    });
    if (r.ok) result.datajud = await r.json();
    else result.erroDatajud = `HTTP ${r.status}`;
  } catch (e) {
    result.erroDatajud = e.message;
  }

  // DJEN — Comunica CNJ
  try {
    const r = await fetch(
      `https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroProcesso=${digits}&pagina=1&itensPorPagina=5`,
      {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      }
    );
    if (r.ok) result.djen = await r.json();
    else result.erroDjen = `HTTP ${r.status}`;
  } catch (e) {
    result.erroDjen = e.message;
  }

  return res.json(result);
};
