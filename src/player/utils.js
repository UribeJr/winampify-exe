export const formatTime = (ms) => {
  if (!ms || Number.isNaN(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const artistNames = (track) =>
  track?.artists?.map((a) => a.name).join(', ') || track?.show?.name || '';

// Pick the smallest image at least `minSize` wide (Spotify lists images largest-first)
export const imageUrl = (images, minSize = 0) => {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (a.width || 0) - (b.width || 0));
  return (sorted.find((img) => (img.width || 0) >= minSize) || sorted[sorted.length - 1]).url;
};

export const trackArt = (track, minSize) => imageUrl(track?.album?.images || track?.images, minSize);

export const sourceKey = (source) => (source ? `${source.type}:${source.id || ''}` : '');

export const LIKED_SOURCE = { type: 'liked', id: 'liked', name: 'Liked Songs' };
