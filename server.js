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

// RSS Feed
app.get('/rss', (req, res) => {
  const newsFile = path.join(__dirname, 'data/news.json');
  const papersFile = path.join(__dirname, 'data/papers.json');
  
  let items = [];
  const baseUrl = req.protocol + '://' + req.get('host');
  
  if (fs.existsSync(newsFile)) {
    const news = JSON.parse(fs.readFileSync(newsFile));
    const allNews = [...(news.chinese || []), ...(news.english || []), ...(news.featured || [])];
    items = items.concat(allNews.map(n => ({
      title: n.title,
      link: n.link,
      pubDate: n.pubDate ? new Date(n.pubDate).toUTCString() : new Date().toUTCString(),
      description: n.summary || n.title,
      category: 'News'
    })));
  }
  
  if (fs.existsSync(papersFile)) {
    const papers = JSON.parse(fs.readFileSync(papersFile));
    const allPapers = [...(papers.arxiv || []), ...(papers.geothermics || []), ...(papers.semantic || [])];
    items = items.concat(allPapers.slice(0, 10).map(p => ({
      title: p.title,
      link: p.link,
      pubDate: p.published ? new Date(p.published).toUTCString() : new Date().toUTCString(),
      description: p.summary || p.title,
      category: 'Paper'
    })));
  }
  
  // Sort by date descending
  items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  items = items.slice(0, 30);
  
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>地熱新聞與論文彙整 - 台灣先進地熱</title>
    <link>${baseUrl}</link>
    <description>每日地熱產業新聞與學術論文整理，由台灣先進地熱提供</description>
    <language>zh-TW</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/rss" rel="self" type="application/rss+xml"/>
    <image>
      <url>${baseUrl}/favicon.ico</url>
      <title>地熱新聞與論文彙整</title>
      <link>${baseUrl}</link>
    </image>
${items.map(item => `    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <guid isPermaLink="true">${item.link}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <category>${item.category}</category>
      <description><![CDATA[${item.description}]]></description>
    </item>`).join('\n')}
  </channel>
</rss>`;

  res.set('Content-Type', 'application/rss+xml');
  res.send(rss);
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
