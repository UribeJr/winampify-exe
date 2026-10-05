// Built-in desktop wallpapers (original pixel art in public/assets/wallpapers) and display modes,
// as in Win98's Display Properties → Background.

export const WALLPAPERS = [
  { id: 'teal', name: 'Classic Teal', url: null, defaultMode: 'center' },
  { id: 'clouds', name: 'Pixel Clouds', url: '/assets/wallpapers/clouds.svg', defaultMode: 'stretch' },
  // previewTile: tile size in the Display Properties monitor preview (~1/5 scale)
  { id: 'starfield', name: 'Starfield', url: '/assets/wallpapers/starfield.svg', defaultMode: 'tile', previewTile: '52px' },
  { id: 'bricks', name: 'Bricks', url: '/assets/wallpapers/bricks.svg', defaultMode: 'tile', previewTile: '13px' },
  { id: 'hills', name: 'Rolling Hills', url: '/assets/wallpapers/hills.svg', defaultMode: 'stretch' },
  { id: 'xp-hills', name: 'Green Hills (XP)', url: '/assets/wallpapers/xp-hills.svg', defaultMode: 'stretch' }
];

export const XP_WALLPAPER = { id: 'xp-hills', mode: 'stretch' };

export const CUSTOM_WALLPAPER_ID = 'custom';
export const DEFAULT_WALLPAPER = { id: 'clouds', mode: 'stretch' };

export const MODES = {
  center: { label: 'Center', size: 'auto', repeat: 'no-repeat', position: 'center' },
  tile: { label: 'Tile', size: 'auto', repeat: 'repeat', position: 'top left' },
  stretch: { label: 'Stretch', size: 'cover', repeat: 'no-repeat', position: 'center' }
};

export const getWallpaper = (id) => WALLPAPERS.find((w) => w.id === id) || null;

// CSS background values for a wallpaper selection; `customUrl` is the user's own picture (data URL)
export function wallpaperStyle({ id, mode }, customUrl) {
  const url = id === CUSTOM_WALLPAPER_ID ? customUrl : getWallpaper(id)?.url;
  const m = MODES[mode] || MODES.center;
  return {
    image: url ? `url("${url}")` : 'none',
    size: m.size,
    repeat: m.repeat,
    position: m.position
  };
}
