const express = require('express');
const cron = require('node-cron');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API endpoints
app.get('/api/news', (req, res) => {
  const dataFile = path.join(__dirname, 'data/news.json');
  if (fs.existsSync(dataFile)) {
    res.json(JSON.parse(fs.readFileSync(dataFile)));
  } else {
    res.json({ error: 'No data yet', lastUpdated: null });
  }
});

app.get('/api/papers', (req, res) => {
  const dataFile = path.join(__dirname, 'data/papers.json');
  if (fs.existsSync(dataFile)) {
    res.json(JSON.parse(fs.readFileSync(dataFile)));
  } else {
    res.json({ error: 'No data yet', lastUpdated: null });
  }
});

// Manual refresh endpoint
app.post('/api/refresh', (req, res) => {
  try {
    execSync('node scripts/fetch-news.js', { cwd: __dirname });
    execSync('node scripts/fetch-papers.js', { cwd: __dirname });
    res.json({ success: true, message: 'Data refreshed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Schedule automatic updates
// News: every 6 hours
cron.schedule('0 */6 * * *', () => {
  console.log('Running scheduled news fetch...');
  execSync('node scripts/fetch-news.js', { cwd: __dirname });
});

// Papers: every day at 8 AM
cron.schedule('0 8 * * *', () => {
  console.log('Running scheduled papers fetch...');
  execSync('node scripts/fetch-papers.js', { cwd: __dirname });
});

app.listen(PORT, () => {
  console.log(`🌋 Geothermal News Server running at http://localhost:${PORT}`);
  
  // Initial fetch if no data exists
  if (!fs.existsSync(path.join(__dirname, 'data/news.json'))) {
    console.log('No data found, running initial fetch...');
    try {
      execSync('node scripts/fetch-news.js', { cwd: __dirname });
      execSync('node scripts/fetch-papers.js', { cwd: __dirname });
    } catch (err) {
      console.error('Initial fetch failed:', err.message);
    }
  }
});
