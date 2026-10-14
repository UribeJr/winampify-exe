// Pure list helpers for the Media Library (any provider): text filter, column sorts, decades.

const artistNames = (track) => track?.artists?.map((a) => a.name).join(', ') || '';
const fold = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const matches = (query, ...fields) => {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = fields.map(fold).join(' ');
  return words.every((w) => text.includes(w));
};

export const filterTracks = (tracks, query) =>
  (query?.trim() ? tracks.filter((t) => matches(query, t.title, artistNames(t), t.album?.name)) : tracks);

export const filterAlbums = (albums, query) =>
  (query?.trim() ? albums.filter((al) => matches(query, al.name, al.artist)) : albums);

const TRACK_FIELDS = {
  title: (t) => fold(t.title),
  artist: (t) => fold(artistNames(t)),
  album: (t) => fold(t.album?.name),
  year: (t) => t.year ?? null,
  added: (t) => t.addedAt || null,
  length: (t) => t.durationMs ?? null
};

const ALBUM_FIELDS = {
  title: (al) => fold(al.name),
  artist: (al) => fold(al.artist),
  year: (al) => al.releaseDate || (al.year ? String(al.year) : null),
  added: (al) => al.addedAt || null
};

// Stable sort by one field; empty values always last. `field` null keeps the original order.
const sortBy = (fields) => (list, field, dir = 'asc') => {
  const valueOf = fields[field];
  if (!valueOf) return list;
  const sign = dir === 'desc' ? -1 : 1;
  return list
    .map((item, index) => ({ item, index, value: valueOf(item) }))
    .sort((a, b) => {
      const aEmpty = a.value === null || a.value === '';
      const bEmpty = b.value === null || b.value === '';
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? a.index - b.index : aEmpty ? 1 : -1;
      const cmp = typeof a.value === 'number' ? a.value - b.value : String(a.value).localeCompare(String(b.value));
      return cmp ? cmp * sign : a.index - b.index;
    })
    .map((entry) => entry.item);
};

export const sortTracks = sortBy(TRACK_FIELDS);
export const sortAlbums = sortBy(ALBUM_FIELDS);

export const decadeOf = (year) => (Number.isFinite(year) && year > 0 ? Math.floor(year / 10) * 10 : null);

// Decades present in a list of albums, newest first
export const decadesOf = (albums) =>
  [...new Set(albums.map((al) => decadeOf(al.year)).filter((d) => d !== null))].sort((a, b) => b - a);

export const byDecade = (albums, decade) =>
  (decade == null ? albums : albums.filter((al) => decadeOf(al.year) === decade));

export const decadeLabel = (decade) => `${decade}s`;
