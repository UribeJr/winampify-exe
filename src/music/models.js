/**
 * App-level music models. Providers (Navidrome, Spotify) normalize their API objects into these
 * shapes so the Win98 UI never touches OpenSubsonic- or Spotify-specific fields.
 *
 * @typedef {{ id: string, name: string }} ArtistRef
 *
 * @typedef {Object} Track
 * @property {string} id          provider id (Navidrome song id / Spotify track id)
 * @property {string} key         unique key within a list (Spotify: track URI; Navidrome: `nd:<id>`)
 * @property {string} title
 * @property {ArtistRef[]} artists
 * @property {{ id: string|null, name: string }} album
 * @property {number} durationMs
 * @property {string|null} coverArt       artwork URL (see coverUrl() in player/utils.js for sizing)
 * @property {string|null} [coverArtSmall] optional thumbnail URL
 * @property {boolean} starred
 * @property {boolean} playable
 *
 * @typedef {Object} Album
 * @property {string} id
 * @property {string} name
 * @property {string} artist
 * @property {string|null} artistId
 * @property {string|null} coverArt
 * @property {number} songCount
 * @property {number|null} year
 * @property {string} [uri]       Spotify only
 *
 * @typedef {Object} Artist
 * @property {string} id
 * @property {string} name
 * @property {number} albumCount
 * @property {string|null} coverArt
 *
 * @typedef {Object} Playlist
 * @property {string} id
 * @property {string} name
 * @property {number} songCount
 * @property {string|null} coverArt
 * @property {string} [uri]       Spotify only
 *
 * A library "source" the player can browse and queue from.
 * @typedef {Object} Source
 * @property {'liked'|'playlist'|'album'|'artist'|'search'} type
 * @property {string} id
 * @property {string} name
 * @property {string|null} [coverArt]
 * @property {string} [uri]       Spotify context URI
 * @property {string} [query]     search text
 */

export const LIKED_SOURCE = { type: 'liked', id: 'liked', name: 'Liked Songs' };

export const playlistSource = (pl) => ({ type: 'playlist', id: pl.id, name: pl.name, uri: pl.uri, coverArt: pl.coverArt });
export const albumSource = (al) => ({ type: 'album', id: al.id, name: al.name, uri: al.uri, coverArt: al.coverArt });
export const artistSource = (ar) => ({ type: 'artist', id: ar.id, name: ar.name, coverArt: ar.coverArt });
export const searchSource = (query) => ({ type: 'search', id: query.toLowerCase(), name: `Search: ${query}`, query });
