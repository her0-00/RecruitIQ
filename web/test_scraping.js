const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

async function testWTTJ() {
  const keywords = 'développeur';
  const q = encodeURIComponent(keywords);
  const url = `https://www.welcometothejungle.com/fr/jobs?query=${q}&aroundQuery=France`;
  
  console.log('Testing WTTJ:', url);
  
  try {
    const res = await fetch(url, { headers: HEADERS });
    const html = await res.text();
    
    // Save HTML to file for inspection
    const fs = require('fs');
    fs.writeFileSync('wttj_debug.html', html);
    console.log('✓ HTML saved to wttj_debug.html');
    
    const $ = cheerio.load(html);
    
    // Try different selectors
    console.log('\nTrying selectors:');
    console.log('1. li[data-testid="search-results-list-item-wrapper"]:', $('li[data-testid="search-results-list-item-wrapper"]').length);
    console.log('2. [data-testid*="job"]:', $('[data-testid*="job"]').length);
    console.log('3. article:', $('article').length);
    console.log('4. [class*="job"]:', $('[class*="job"]').length);
    
    // Try to find any job-like elements
    const jobs = [];
    $('li[data-testid="search-results-list-item-wrapper"]').each((_, el) => {
      const title = $(el).find('h3').first().text().trim();
      const company = $(el).find('span[data-testid="company-name"]').first().text().trim();
      console.log('Found:', { title, company });
      if (title) jobs.push({ title, company });
    });
    
    console.log(`\nTotal jobs found: ${jobs.length}`);
    return jobs;
  } catch (err) {
    console.error('Error:', err.message);
    return [];
  }
}

async function testHelloWork() {
  const keywords = 'développeur';
  const q = encodeURIComponent(keywords);
  const url = `https://www.hellowork.com/fr-fr/emploi/recherche.html?k=${q}&l=France`;
  
  console.log('\n\nTesting HelloWork:', url);
  
  try {
    const res = await fetch(url, { headers: HEADERS });
    const html = await res.text();
    
    const fs = require('fs');
    fs.writeFileSync('hellowork_debug.html', html);
    console.log('✓ HTML saved to hellowork_debug.html');
    
    const $ = cheerio.load(html);
    
    console.log('\nTrying selectors:');
    console.log('1. article[data-id]:', $('article[data-id]').length);
    console.log('2. article:', $('article').length);
    console.log('3. [class*="offer"]:', $('[class*="offer"]').length);
    console.log('4. [class*="job"]:', $('[class*="job"]').length);
    
    const jobs = [];
    $('article').each((_, el) => {
      const title = $(el).find('h2, h3').first().text().trim();
      const company = $(el).find('[class*="company"]').first().text().trim();
      console.log('Found:', { title, company });
      if (title) jobs.push({ title, company });
    });
    
    console.log(`\nTotal jobs found: ${jobs.length}`);
    return jobs;
  } catch (err) {
    console.error('Error:', err.message);
    return [];
  }
}

// Run tests
(async () => {
  console.log('=== JOB SCRAPING DEBUG ===\n');
  await testWTTJ();
  await testHelloWork();
  console.log('\n=== Check the HTML files to see what the sites actually return ===');
})();
