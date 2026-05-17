const http = require('http');
const express = require("express");
const userRoutes = require("./routes/api/userRoutes");
const authRoutes = require("./routes/api/authRoutes");
const regionRoutes = require("./routes/api/regionRoutes");
const dashboardRoutes = require('./routes/dashboardRoutes');
const binRoutes = require('./routes/api/binRoutes');
const statsRoutes = require('./routes/api/statsRoutes');
const trackingRoutes = require('./routes/api/trackingRoutes');
const wasteRequestRoutes = require('./routes/api/wasteRequestRoutes');
const employeeRouteRoutes = require('./routes/api/employeeRouteRoutes');
const { initSocket } = require('./socket');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 2001;
const server = http.createServer(app);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(express.json());

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

app.get('/api-health', async (req, res) => {
  res.json({
    message: "api is running",
    status: "success",
    statusCode: 200
  })
})

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/bins', binRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/waste-requests', wasteRequestRoutes);
app.use('/api/employee', employeeRouteRoutes);
app.use('/', dashboardRoutes);

initSocket(server);

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Socket.io ready');
});