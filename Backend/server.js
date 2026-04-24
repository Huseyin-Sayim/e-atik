const express = require("express");
const userRoutes = require("./routes/api/userRoutes");
const authRoutes = require("./routes/api/authRoutes");
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 2001;

app.use(cookieParser());
app.use(express.json());

app.get('/', async (req, res) => {
  res.json({
    message: "api is running",
    status: "success",
    statusCode: 200
  })
})

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);

app.listen(port, () => console.log(`Server running on port ${port}`));