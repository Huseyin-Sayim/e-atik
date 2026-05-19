const http = require('http');

http.get('http://localhost:2001/api-health', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', data);
  });
}).on('error', (err) => {
  console.error('SERVER IS DOWN! ERROR:', err.message);
});
