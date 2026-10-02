// Helpers over the app models in src/music/models.js (provider-neutral).
export { LIKED_SOURCE } from '../music/models';

export const formatTime = (ms) => {
  if (!ms || Number.isNaN(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const artistNames = (track) => track?.artists?.map((a) => a.name).join(', ') || '';

// Artwork URL at roughly `size` px. Navidrome's proxy resizes on request; Spotify offers fixed sizes.
export const coverUrl = (item, size = 300) => {
  if (!item?.coverArt) return null;
  if (item.coverArt.startsWith('/api/nd/cover/')) return `${item.coverArt}?size=${size}`;
  return size <= 100 ? item.coverArtSmall || item.coverArt : item.coverArt;
};

export const trackArt = coverUrl;

export const sourceKey = (source) => (source ? `${source.type}:${source.id || ''}` : '');
