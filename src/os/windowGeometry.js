// Where a window actually sits on the desktop (desktop-layer px), shared by Window.jsx and
// anything that needs to know what a window covers (e.g. Disky getting out of the way).

export const EDGE = 8; // keep at least this much of a window inside the desktop

// Size and position clamped to the current desktop, as rendered
export function windowRect({ position, size, isMaximized }, desktop, forceMaximized = false) {
  if (isMaximized || forceMaximized) return { x: 0, y: 0, width: desktop.width, height: desktop.height };
  const width = Math.min(size.width, desktop.width - EDGE * 2);
  const height = Math.min(size.height, desktop.height - EDGE * 2);
  return {
    x: Math.min(Math.max(position.x, 0), Math.max(0, desktop.width - width)),
    y: Math.min(Math.max(position.y, 0), Math.max(0, desktop.height - height)),
    width,
    height
  };
}

export const rectsOverlap = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
