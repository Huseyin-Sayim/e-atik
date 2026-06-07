const http = require('http');
const net = require('net');

const PORT = 2001;
const TARGET_HOST = '31.57.156.61';
const TARGET_PORT = 2001;

const server = http.createServer((req, res) => {
  console.log(`[HTTP Proxy] ${req.method} ${req.url}`);
  
  const proxyReq = http.request({
    host: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('[HTTP Proxy Error]:', err.message);
    res.writeHead(502);
    res.end('Proxy Error: ' + err.message);
  });

  req.pipe(proxyReq, { end: true });
});

// WebSocket (ws://) bağlantılarını tünellemek için upgrade olayını dinle
server.on('upgrade', (req, socket, head) => {
  console.log(`[WS Proxy] Bağlantı isteği: ${req.url}`);
  
  const targetSocket = net.createConnection({
    host: TARGET_HOST,
    port: TARGET_PORT
  }, () => {
    // İlk el sıkışma paketini hedefe gönder
    targetSocket.write(head);
    
    // HTTP Upgrade header'larını elle oluştur ve hedefe gönder
    let rawHeaders = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      rawHeaders += `${req.rawHeaders[i]}: ${req.rawHeaders[i+1]}\r\n`;
    }
    rawHeaders += '\r\n';
    targetSocket.write(rawHeaders);
    
    // Soketleri birbirine bağla (çift yönlü veri akışı)
    socket.pipe(targetSocket);
    targetSocket.pipe(socket);
  });
  
  targetSocket.on('error', (err) => {
    console.error('[WS Proxy Error]:', err.message);
    socket.end();
  });
  
  socket.on('error', () => {
    targetSocket.end();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('========================================================');
  console.log(`🚀 Sunucu Köprüsü Aktif!`);
  console.log(`📍 Yerel Adres: http://localhost:${PORT}`);
  console.log(`➡️ Hedef Sunucu: http://${TARGET_HOST}:${TARGET_PORT}`);
  console.log('========================================================');
  console.log('Uygulamayı test etmek için bu pencereyi açık tut.');
});
