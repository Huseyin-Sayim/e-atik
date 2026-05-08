const express = require("express");
const userRoutes = require("./routes/api/userRoutes");
const authRoutes = require("./routes/api/authRoutes");
const regionRoutes = require("./routes/api/regionRoutes");
const dashboardRoutes = require('./routes/dashboardRoutes');
const binRoutes = require('./routes/api/binRoutes');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 2001;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(express.json());

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
app.use('/', dashboardRoutes);


app.listen(port, () => console.log(`Server running on port ${port}`));