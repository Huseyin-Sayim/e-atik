const http = require('http');

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function test() {
  // Kullanıcıları listele (admin endpoint)
  const usersResp = await httpRequest({
    hostname: 'localhost', port: 2001, path: '/api/users', method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
  console.log('GET /api/users status:', usersResp.status);
  
  // Waste requests (yetkisiz erişim testi)
  const wasteResp = await httpRequest({
    hostname: 'localhost', port: 2001, path: '/api/waste-requests', method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
  console.log('GET /api/waste-requests (no token) status:', wasteResp.status, '| message:', wasteResp.body?.message);
}

test().catch(e => console.error('Test error:', e.message));
