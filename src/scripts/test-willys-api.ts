async function main() {
  console.log('Fetching Willys search page to get cookies...');
  
  const initRes = await fetch('https://www.willys.se/sok?q=kvarg', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  
  // Use native getSetCookie if available, otherwise fallback
  const rawCookies = (initRes.headers as any).getSetCookie ? (initRes.headers as any).getSetCookie() : [];
  console.log('Raw cookies found:', rawCookies);
  
  const cookies = rawCookies.map((cookie: string) => cookie.split(';')[0]).join('; ');
  console.log('Formatted cookies:', cookies);
  
  console.log('Fetching search results for "kvarg"...');
  const searchRes = await fetch('https://www.willys.se/axfood/rest/p/search?q=kvarg&page=0&size=5', {
    headers: {
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Referer': 'https://www.willys.se/'
    }
  });
  
  console.log('Search status:', searchRes.status);
  const text = await searchRes.text();
  console.log('Search response:', text.slice(0, 1000));
}

main();
