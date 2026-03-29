const express = require("express");
const {PrismaClient} = require("@prisma/client");
const userRoutes = require("./routes/api/userRoutes");
const {route} = require("express/lib/application");

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 2001;

app.use(express.json());

app.get('/', async (req, res) => {
  res.json({
    message: "api is running",
    status: "success",
    statusCode: 200
  })
})

app.get('/api/users', userRoutes);

app.get('/a', (req, res) => {
  res.send('Merhaba Dünya')
})
app.listen(port, () => console.log(`Server running on port ${port}`));