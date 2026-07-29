const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:8080/dashboard ...');
    await page.goto('http://localhost:8080/dashboard', { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: '/tmp/sidebar-full.png', fullPage: false });
    console.log('Screenshot saved to /tmp/sidebar-full.png');

    // Check for the sidebar
    const sidebar = await page.$('.velo-dashboard-sidebar');
    console.log('\n=== SIDEBAR CHECK ===');
    console.log('velo-dashboard-sidebar exists:', !!sidebar);

    if (sidebar) {
      const sidebarRect = await page.evaluate(() => {
        const el = document.querySelector('.velo-dashboard-sidebar');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height, top: r.top, left: r.left };
      });
      console.log('Sidebar rect:', JSON.stringify(sidebarRect, null, 2));

      // Get the nav element
      const navItems = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Navegação principal"]');
        if (!nav) return { error: 'Nav not found' };

        const children = Array.from(nav.children);
        const results = [];

        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const rect = child.getBoundingClientRect();
          const link = child.querySelector('a, button');
          const text = link ? (link.textContent || '').trim() : (child.textContent || '').trim();
          
          results.push({
            index: i,
            text: text.substring(0, 40),
            tag: child.tagName,
            height: Math.round(rect.height * 100) / 100,
            top: Math.round(rect.top * 100) / 100,
            visible: rect.top < 900 && rect.bottom > 0,
            hasLink: !!link,
          });
        }

        return { count: children.length, items: results };
      });

      console.log('\n=== NAV ITEMS ===');
      console.log('Count:', navItems.count);
      console.log('Items:', JSON.stringify(navItems.items, null, 2));

      // Also check total scroll height of nav
      const navScroll = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Navegação principal"]');
        if (!nav) return {};
        return {
          scrollHeight: nav.scrollHeight,
          clientHeight: nav.clientHeight,
          offsetTop: nav.offsetTop,
        };
      });
      console.log('\n=== NAV CONTAINER ===');
      console.log('Scroll/Client:', JSON.stringify(navScroll, null, 2));

    } else {
      console.log('Sidebar NOT found. Checking page content...');
      const title = await page.title();
      const url = page.url();
      console.log('Page title:', title);
      console.log('URL:', url);

      const bodyPreview = await page.evaluate(() => {
        return document.body.innerText?.substring(0, 800) || 'NO TEXT';
      });
      console.log('Body text preview:', bodyPreview);

      // Check for login/auth elements
      const loginForm = await page.$('form');
      console.log('Has form:', !!loginForm);

      await page.screenshot({ path: '/tmp/auth-page.png' });
      console.log('Auth page screenshot saved to /tmp/auth-page.png');
    }

  } catch (err) {
    console.error('ERROR:', err.message);
    try {
      await page.screenshot({ path: '/tmp/error-page.png' });
      console.log('Error screenshot saved');
    } catch {}
  } finally {
    await browser.close();
    console.log('\nDone.');
  }
})();
