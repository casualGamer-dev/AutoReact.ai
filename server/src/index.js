require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db');
const authRoutes = require('./routes/auth');
const sketchRoutes = require('./routes/sketches');
const enhanceRoutes = require('./routes/enhance');
const correctionRoutes = require('./routes/corrections');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/auth', authRoutes);
app.use('/sketches', sketchRoutes);
app.use('/enhance', enhanceRoutes);
app.use('/corrections', correctionRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

async function start() {
  await connectDB();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`autolayout-server listening on :${port}`));
}

if (require.main === module) start();

module.exports = { app };
