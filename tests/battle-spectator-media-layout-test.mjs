import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const css = ['battle.css', 'battle-spectator.css'].map(file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')).join('\n');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(`<style>${css}</style><main class="spectator-shell"><section class="spectator-view"><div id="spMedia" class="spectator-players"><video width="720" height="1280"></video><audio></audio><video width="1920" height="1080"></video></div><div class="spectator-placeholder">No media</div></section></main>`);
    const state = await page.evaluate(() => {
      const videos = [...document.querySelectorAll('video')];
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        boxes: videos.map(v => { const r = v.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, right:r.right }; }),
        audioHidden: getComputedStyle(document.querySelector('audio')).display === 'none',
        placeholderHidden: getComputedStyle(document.querySelector('.spectator-placeholder')).display === 'none',
        contained: videos.every(v => getComputedStyle(v).objectFit === 'contain'),
      };
    });
    assert.equal(state.overflow, false, 'horizontal overflow at ' + width);
    assert.ok(state.audioHidden && state.placeholderHidden && state.contained);
    assert.ok(state.boxes.every(b => b.width > 0 && b.right <= width));
    assert.ok(Math.abs(state.boxes[0].width - state.boxes[1].width) < 1);
    assert.equal(state.boxes[0].y === state.boxes[1].y, width > 620);
  }
  console.log('PASS real Chromium: portrait/landscape video layout at 390, 768, 1440px');
} finally { await browser.close(); }
