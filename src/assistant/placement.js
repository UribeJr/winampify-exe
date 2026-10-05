import { windowRect, rectsOverlap } from '../os/windowGeometry.js';

// Disky's corner spot in desktop-layer px. Keep in sync with .assistant in styles/assistant.css
// (right: 16px, bottom: 12px above the taskbar, 72px character) plus a little breathing room.
export const DISKY = { size: 72, right: 16, bottom: 12, margin: 8 };

export const diskyZone = (desktop) => ({
  x: desktop.width - DISKY.right - DISKY.size - DISKY.margin,
  y: desktop.height - DISKY.bottom - DISKY.size - DISKY.margin,
  width: DISKY.size + DISKY.margin * 2,
  height: DISKY.size + DISKY.margin * 2
});

/**
 * Should Disky wait in the taskbar tray instead of his corner? Yes on phones, and whenever an
 * open (not minimized) window covers his corner — maximized or not — so he never sits on
 * controls like the player's volume slider.
 */
export function shouldDock({ windows, desktop, isMobile = false, forceMaximized = false }) {
  if (isMobile) return true;
  const zone = diskyZone(desktop);
  return windows.some((w) => !w.isMinimized && rectsOverlap(windowRect(w, desktop, forceMaximized), zone));
}
