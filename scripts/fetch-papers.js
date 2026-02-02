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

// Fetch from CNKI (China National Knowledge Infrastructure) - via search
async function fetchCNKIPapers() {
  // Using Baidu Scholar as alternative since CNKI requires auth
  const url = 'https://xueshu.baidu.com/s?wd=地热能源&rsv_bp=0&tn=SE_baiduxueshu_c1gjeupa&rsv_spt=3&ie=utf-8&f=8&rsv_sug2=0&sc_f_para=sc_tasktype%3D%7BfirstSimpleSearch%7D';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const papers = [];
    
    $('.result').slice(0, 8).each((i, el) => {
      const title = $(el).find('h3 a').text().trim();
      const link = $(el).find('h3 a').attr('href') || '';
      const summary = $(el).find('.c_abstract').text().trim();
      const authors = $(el).find('.author_text span').map((i, a) => $(a).text()).get().join(', ');
      if (title) {
        papers.push({
          title,
          link: link.startsWith('http') ? link : `https://xueshu.baidu.com${link}`,
          authors,
          summary: summary.slice(0, 500) + '...',
          published: 'Recent',
          source: '百度学术'
        });
      }
    });
    return papers;
  } catch (err) {
    console.error('Error fetching CNKI:', err.message);
    return [];
  }
}

async function main() {
  console.log('Fetching geothermal papers...');
  
  const [arxiv, geothermics, semantic, cnki] = await Promise.all([
    fetchArxiv(),
    fetchGeothermicsJournal(),
    fetchSemanticScholar(),
    fetchCNKIPapers()
  ]);

  const data = {
    lastUpdated: new Date().toISOString(),
    arxiv,
    geothermics,
    semantic,
    mainland: cnki
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`Saved ${arxiv.length + geothermics.length + semantic.length + cnki.length} papers to ${DATA_FILE}`);
}

main();
