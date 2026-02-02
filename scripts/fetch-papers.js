const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/papers.json');

// Fetch from arXiv (physics.geo-ph + geothermal)
async function fetchArxiv() {
  const url = 'https://export.arxiv.org/api/query?search_query=all:geothermal&sortBy=submittedDate&sortOrder=descending&max_results=15';
  try {
    const res = await fetch(url);
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const papers = [];
    
    $('entry').each((i, el) => {
      papers.push({
        title: $(el).find('title').text().replace(/\s+/g, ' ').trim(),
        link: $(el).find('id').text(),
        authors: $(el).find('author name').map((i, a) => $(a).text()).get().join(', '),
        summary: $(el).find('summary').text().replace(/\s+/g, ' ').trim().slice(0, 500) + '...',
        published: $(el).find('published').text(),
        source: 'arXiv'
      });
    });
    return papers;
  } catch (err) {
    console.error('Error fetching arXiv:', err.message);
    return [];
  }
}

// Fetch from ScienceDirect/Elsevier RSS (Geothermics journal)
async function fetchGeothermicsJournal() {
  const url = 'https://rss.sciencedirect.com/publication/science/03756505';
  try {
    const res = await fetch(url);
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const papers = [];
    
    $('item').slice(0, 10).each((i, el) => {
      papers.push({
        title: $(el).find('title').text(),
        link: $(el).find('link').text(),
        summary: $(el).find('description').text().replace(/<[^>]*>/g, '').slice(0, 500) + '...',
        published: $(el).find('pubDate').text(),
        source: 'Geothermics Journal'
      });
    });
    return papers;
  } catch (err) {
    console.error('Error fetching Geothermics:', err.message);
    return [];
  }
}

// Fetch from Google Scholar RSS (via Semantic Scholar API as fallback)
async function fetchSemanticScholar() {
  const url = 'https://api.semanticscholar.org/graph/v1/paper/search?query=geothermal+energy&fields=title,url,abstract,authors,publicationDate&limit=10&sort=publicationDate:desc';
  try {
    const res = await fetch(url);
    const json = await res.json();
    return (json.data || []).map(p => ({
      title: p.title,
      link: p.url || `https://www.semanticscholar.org/paper/${p.paperId}`,
      authors: (p.authors || []).map(a => a.name).join(', '),
      summary: (p.abstract || 'No abstract available').slice(0, 500) + '...',
      published: p.publicationDate || 'Unknown',
      source: 'Semantic Scholar'
    }));
  } catch (err) {
    console.error('Error fetching Semantic Scholar:', err.message);
    return [];
  }
}

async function main() {
  console.log('Fetching geothermal papers...');
  
  const [arxiv, geothermics, semantic] = await Promise.all([
    fetchArxiv(),
    fetchGeothermicsJournal(),
    fetchSemanticScholar()
  ]);

  const data = {
    lastUpdated: new Date().toISOString(),
    arxiv,
    geothermics,
    semantic
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`Saved ${arxiv.length + geothermics.length + semantic.length} papers to ${DATA_FILE}`);
}

main();
