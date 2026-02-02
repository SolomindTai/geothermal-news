const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/news.json');

async function fetchGoogleNews(query, lang = 'en') {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${lang}`;
  try {
    const res = await fetch(url);
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const items = [];
    
    $('item').each((i, el) => {
      if (i >= 10) return false;
      items.push({
        title: $(el).find('title').text(),
        link: $(el).find('link').text(),
        pubDate: $(el).find('pubDate').text(),
        source: $(el).find('source').text() || 'Unknown'
      });
    });
    return items;
  } catch (err) {
    console.error(`Error fetching ${query}:`, err.message);
    return [];
  }
}

async function fetchCleanTechnica() {
  const url = 'https://cleantechnica.com/?s=geothermal';
  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);
    const items = [];
    
    $('article').slice(0, 5).each((i, el) => {
      const title = $(el).find('h2 a, h3 a').first().text().trim();
      const link = $(el).find('h2 a, h3 a').first().attr('href');
      const summary = $(el).find('p').first().text().trim();
      if (title && link) {
        items.push({ title, link, summary, source: 'CleanTechnica' });
      }
    });
    return items;
  } catch (err) {
    console.error('Error fetching CleanTechnica:', err.message);
    return [];
  }
}

async function main() {
  console.log('Fetching geothermal news...');
  
  const [enNews, twNews, cnNews, cleantech] = await Promise.all([
    fetchGoogleNews('geothermal energy', 'en'),
    fetchGoogleNews('地熱', 'zh-TW'),
    fetchGoogleNews('地热 能源', 'zh-CN'),
    fetchCleanTechnica()
  ]);

  const data = {
    lastUpdated: new Date().toISOString(),
    english: enNews,
    chinese: twNews,
    mainland: cnNews,
    featured: cleantech
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`Saved ${enNews.length + twNews.length + cnNews.length + cleantech.length} news items to ${DATA_FILE}`);
}

main();
