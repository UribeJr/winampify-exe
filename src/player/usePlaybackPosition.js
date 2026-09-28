import { useState, useEffect } from 'react';

const TICK_MS = 250;

// Interpolates the playback position between engine updates so progress bars move smoothly.
export default function usePlaybackPosition(playback) {
  const { position, updatedAt, isPaused, isActive, duration } = playback;
  const [now, setNow] = useState(Date.now);
  const playing = isActive && !isPaused;

  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [playing]);

  if (!playing) return position;
  const live = position + Math.max(0, now - updatedAt);
  return duration ? Math.min(live, duration) : live;
}
