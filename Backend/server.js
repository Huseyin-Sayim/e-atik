const http = require('http');
const { WebSocketServer } = require('ws');
const express = require('express');
const userRoutes = require('./routes/api/userRoutes');
const authRoutes = require('./routes/api/authRoutes');
const regionRoutes = require('./routes/api/regionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const binRoutes = require('./routes/api/binRoutes');
const statsRoutes = require('./routes/api/statsRoutes');
const trackingRoutes = require('./routes/api/trackingRoutes');
const wasteRequestRoutes = require('./routes/api/wasteRequestRoutes');
const wasteTypeRoutes = require('./routes/api/wasteTypeRoutes');
const walletRoutes = require('./routes/api/walletRoutes');
const employeeRouteRoutes = require('./routes/api/employeeRouteRoutes');
const wasteRoutes = require('./routes/api/wasteRoutes');
const partnerStoreRoutes = require('./routes/api/partnerStoreRoutes');
const wasteItemRoutes = require('./routes/api/wasteItemRoutes');
const { initSocket } = require('./socket');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 2001;
const server = http.createServer(app);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Tarayıcı üzerinden web testi yapılabilmesi için CORS ayarı
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/api-health', async (req, res) => {
  res.json({
    message: 'api is running',
    status: 'success',
    statusCode: 200,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/bins', binRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/waste-requests', wasteRequestRoutes);
app.use('/api/waste-requests-legacy', wasteRoutes);
app.use('/api/waste-types', wasteTypeRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/employee', employeeRouteRoutes);
app.use('/api/partner-stores', partnerStoreRoutes);
app.use('/api/waste-items', wasteItemRoutes);
app.use('/', dashboardRoutes);

const staffLocations = new Map();

app.get('/api/users/staff-locations', (req, res) => {
  const locations = Array.from(staffLocations.entries()).map(([staffId, data]) => ({
    staffId,
    ...data,
  }));
  res.json({
    status: 'success',
    data: locations,
  });
});

initSocket(server);

// Ham WebSocket (dashboard harita gerçek zamanlı güncellemeleri)
const wss = new WebSocketServer({ noServer: true });
global.wss = wss;

wss.on('connection', (ws) => {
  console.log('WebSocket istemci bağlandı');

  ws.on('message', (message) => {
    try {
      const payload = JSON.parse(message);
      console.log('WebSocket alındı:', payload);

      if (payload.type === 'locationUpdate' && payload.staffId) {
        staffLocations.set(payload.staffId, {
          latitude: payload.latitude,
          longitude: payload.longitude,
          target: payload.target || null,
          timestamp: new Date().toISOString(),
        });
      }

      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify(payload));
        }
      });
    } catch (err) {
      console.error('WebSocket yayın hatası:', err);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket istemci bağlantısı koptu');
  });
});

server.on('upgrade', (request, socket, head) => {
  if (request.url?.startsWith('/socket.io')) {
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

server.listen(port, async () => {
  console.log(`Server running on port ${port} (WebSocket + Socket.io aktif)`);

  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const updated = await prisma.wasteRequest.updateMany({
      where: {
        status: 'COLLECTED',
      },
      data: {
        status: 'PENDING',
      },
    });
    if (updated.count > 0) {
      console.log(`[TEST] ${updated.count} adet COLLECTED talep PENDING yapıldı.`);
    }
  } catch (err) {
    console.error('Test yardımcısı hatası:', err);
  }
});
