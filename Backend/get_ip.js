const os = require('os');
const nets = os.networkInterfaces();
const results = {};

for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
    // 'IPv4' is usually returned as a family value
    const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
    if (net.family === familyV4Value && !net.internal) {
      if (!results[name]) {
        results[name] = [];
      }
      results[name].push(net.address);
    }
  }
}

console.log("=== BİLGİSAYARININ IP ADRESLERİ ===");
console.log(JSON.stringify(results, null, 2));
console.log("\n====================================");
console.log("Eğer telefonun bu adreslerden birine tarayıcıdan (örneğin telefonun tarayıcısına http://<IP>:2001/api-health yazarak) erişemiyorsa:");
console.log("1. Telefonun ve bilgisayarın aynı Wi-Fi ağına bağlı olup olmadığını kontrol et.");
console.log("2. Modemde 'AP Isolation' (Kablosuz Yalıtım) açık olabilir, bu cihazların birbirini görmesini engeller.");
