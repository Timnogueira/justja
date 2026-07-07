const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname);
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json' };

http.createServer((req, res) => {
  let url = req.url.split('?')[0].split('#')[0];
  if (url === '/') url = '/index.html';
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found: ' + url); return; }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
}).listen(7891, () => console.log('JustJA server at http://localhost:7891'));
