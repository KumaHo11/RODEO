const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  
  try {
    console.log('Going to login page...');
    await page.goto('http://localhost:3000/login');
    
    console.log('Filling form...');
    await page.fill('input[type="email"]', 'javi.osorio.1@gmail.com');
    await page.fill('input[type="password"]', '1q2w3e4r');
    
    console.log('Clicking submit...');
    await page.click('button[type="submit"]');
    
    // Wait for either a redirect or an error message box to appear
    await Promise.race([
      page.waitForURL(/.*(dashboard|onboarding).*/),
      page.waitForSelector('.bg-red-50, .bg-amber-50', { timeout: 10000 })
    ]).catch(e => console.log('Wait finished or timed out'));
    
    const url = page.url();
    console.log('Current URL:', url);
    
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('Page Text:', bodyText);
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await browser.close();
  }
})();
