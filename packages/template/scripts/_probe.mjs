import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars'],
});
const page = await browser.newPage();
for (const cell of [
  'theme=forge&scheme=light&accent=ember&font=stencil-mono',
  'theme=heritage&scheme=light&accent=brick&font=signwriter',
]) {
  for (const width of [1024, 1100, 1200]) {
    await page.setViewport({ width, height: 900 });
    await page.goto(`http://localhost:4398/?${cell}`, { waitUntil: 'networkidle0' });
    const out = await page.evaluate(() => {
      const name = document.querySelector('.d-header__name');
      const cs = getComputedStyle(name);
      const r = document.createRange();
      r.selectNodeContents(name);
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-9999px';
      probe.style.fontFamily = cs.fontFamily;
      probe.style.fontWeight = cs.fontWeight;
      probe.style.letterSpacing = cs.letterSpacing;
      probe.style.textTransform = cs.textTransform;
      document.body.appendChild(probe);
      const at = (s, t) => {
        probe.style.fontSize = `${s}px`;
        probe.textContent = t;
        return Math.round(probe.getBoundingClientRect().width);
      };
      const need = {};
      for (const s of [17, 16, 15, 14]) need[s] = at(s, 'Industrial Machine');
      probe.remove();
      return {
        fontSize: cs.fontSize,
        box: Math.round(name.getBoundingClientRect().width),
        lines: [...new Set([...r.getClientRects()].map((x) => Math.round(x.top)))].length,
        needFirstTwo: need,
      };
    });
    console.log(cell.split('font=')[1], width, JSON.stringify(out));
  }
}
await browser.close();
