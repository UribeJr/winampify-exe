import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldDock, diskyZone } from '../src/assistant/placement.js';
import { windowRect } from '../src/os/windowGeometry.js';

const DESKTOP = { width: 1280, height: 770 };
const win = (x, y, width, height, extra = {}) => ({ position: { x, y }, size: { width, height }, isMinimized: false, isMaximized: false, ...extra });

test('no windows: Disky stays in his corner', () => {
  assert.equal(shouldDock({ windows: [], desktop: DESKTOP }), false);
});

test('a small window away from the corner leaves him there', () => {
  assert.equal(shouldDock({ windows: [win(100, 80, 600, 400)], desktop: DESKTOP }), false);
});

test('a large, non-maximized window reaching the corner sends him to the tray', () => {
  // the case from the screenshot: a ~1130px-wide desktop with the 1100px player nearly filling it
  assert.equal(shouldDock({ windows: [win(10, 70, 1100, 720)], desktop: { width: 1132, height: 830 } }), true);
  // same window on a wider screen doesn't reach the corner
  assert.equal(shouldDock({ windows: [win(10, 70, 1100, 720)], desktop: DESKTOP }), false);
});

test('maximized or forced-maximized windows always dock him', () => {
  assert.equal(shouldDock({ windows: [win(0, 0, 300, 200, { isMaximized: true })], desktop: DESKTOP }), true);
  assert.equal(shouldDock({ windows: [win(0, 0, 300, 200)], desktop: DESKTOP, forceMaximized: true }), true);
});

test('minimized windows are ignored; phones always dock', () => {
  assert.equal(shouldDock({ windows: [win(10, 70, 1100, 720, { isMinimized: true })], desktop: DESKTOP }), false);
  assert.equal(shouldDock({ windows: [], desktop: DESKTOP, isMobile: true }), true);
});

test('window positions are clamped like the rendered window', () => {
  // dragged far off-screen to the right: rendered back inside, touching the corner
  const rect = windowRect(win(5000, 5000, 400, 300), DESKTOP);
  assert.deepEqual(rect, { x: 880, y: 470, width: 400, height: 300 });
  assert.equal(shouldDock({ windows: [win(5000, 5000, 400, 300)], desktop: DESKTOP }), true);
  const zone = diskyZone(DESKTOP);
  assert.ok(zone.x + zone.width <= DESKTOP.width && zone.y + zone.height <= DESKTOP.height);
});
