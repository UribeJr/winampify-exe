import React from 'react';
import TrackTable from './TrackTable';
import { imageUrl, LIKED_SOURCE, sourceKey } from './utils';
import { useSpotify } from '../spotify/SpotifyContext';

const playlistSource = (pl) => ({ type: 'playlist', id: pl.id, name: pl.name, uri: pl.uri, images: pl.images });
const albumSource = (album) => ({ type: 'album', id: album.id, name: album.name, uri: album.uri, images: album.images });

const SourceHeader = ({ source, total, onPlayAll, onBack }) => (
  <div className="library-source-header">
    {onBack && (
      <button type="button" className="library-back" onClick={onBack} aria-label="Back to library">
        ◀ Library
      </button>
    )}
    <div className="library-source-title">
      {imageUrl(source.images, 64)
        ? <img src={imageUrl(source.images, 64)} alt="" className="library-source-art" />
        : <span className={`library-source-art placeholder icon-${source.type === 'liked' ? 'heart' : 'cd'}`} aria-hidden="true" />}
      <div>
        <h3>{source.name}</h3>
        <span className="library-source-meta">{total ? `${total} songs` : ''}</span>
      </div>
    </div>
    <button type="button" className="library-play-all" onClick={onPlayAll}>▶ Play all</button>
  </div>
);

const Tile = ({ label, sublabel, images, icon, onClick }) => (
  <button type="button" className="library-tile" onClick={onClick}>
    {imageUrl(images, 150)
      ? <img src={imageUrl(images, 150)} alt="" loading="lazy" />
      : <span className={`library-tile-placeholder icon-${icon}`} aria-hidden="true" />}
    <span className="library-tile-label">{label}</span>
    {sublabel && <span className="library-tile-sub">{sublabel}</span>}
  </button>
);

const ListRow = ({ label, sublabel, images, icon, onClick }) => (
  <button type="button" className="library-list-row" onClick={onClick}>
    {imageUrl(images, 64)
      ? <img src={imageUrl(images, 64)} alt="" loading="lazy" />
      : <span className={`library-list-placeholder icon-${icon}`} aria-hidden="true" />}
    <span className="library-list-text">
      <span className="library-list-label">{label}</span>
      {sublabel && <span className="library-list-sub">{sublabel}</span>}
    </span>
    <span className="library-list-chevron" aria-hidden="true">▸</span>
  </button>
);

/**
 * Media Library. Desktop: tree sidebar + content pane (dashboard tiles or a track table).
 * Phones: a stacked list that drills into a source, with a back button.
 */
const LibraryView = ({ source, onSelectSource, trackList, albums, currentUri, onPlayTrack, onPlayAll, isMobile }) => {
  const { playlists, playlistsLoading } = useSpotify();
  const selectedKey = sourceKey(source);

  const sourceContent = source && (
    <div className="library-source">
      <SourceHeader
        source={source}
        total={trackList.total}
        onPlayAll={onPlayAll}
        onBack={isMobile ? () => onSelectSource(null) : undefined}
      />
      <TrackTable
        tracks={trackList.tracks}
        currentUri={currentUri}
        onPlay={onPlayTrack}
        compact={isMobile}
        loading={trackList.loading}
        error={trackList.error}
        hasMore={trackList.hasMore}
        onLoadMore={trackList.loadMore}
        showAlbum={source.type !== 'album'}
      />
    </div>
  );

  if (isMobile) {
    return (
      <div className="wmp-media-library-view mobile">
        {source ? sourceContent : (
          <div className="library-list">
            <ListRow label="Liked Songs" sublabel="Your saved tracks" icon="heart" onClick={() => onSelectSource(LIKED_SOURCE)} />
            <h4 className="library-list-heading">My Playlists</h4>
            {playlistsLoading && <div className="wmp-library-placeholder">Loading playlists…</div>}
            {playlists.map((pl) => (
              <ListRow
                key={pl.id}
                label={pl.name}
                sublabel={`${pl.tracks?.total ?? 0} songs`}
                images={pl.images}
                icon="cd"
                onClick={() => onSelectSource(playlistSource(pl))}
              />
            ))}
            {albums.length > 0 && <h4 className="library-list-heading">My Albums</h4>}
            {albums.map((album) => (
              <ListRow
                key={album.id}
                label={album.name}
                sublabel={album.artists?.map((a) => a.name).join(', ')}
                images={album.images}
                icon="cd"
                onClick={() => onSelectSource(albumSource(album))}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wmp-media-library-view">
      <nav className="wmp-library-sidebar" aria-label="Library">
        <ul className="tree-view">
          <li>
            <details open>
              <summary>My Music</summary>
              <ul>
                <li>
                  <button
                    type="button"
                    className={selectedKey === sourceKey(LIKED_SOURCE) ? 'selected' : ''}
                    onClick={() => onSelectSource(LIKED_SOURCE)}
                  >
                    Liked Songs
                  </button>
                </li>
              </ul>
            </details>
          </li>
          <li>
            <details open>
              <summary>My Playlists</summary>
              <ul>
                {playlistsLoading && <li className="tree-muted">Loading…</li>}
                {playlists.map((pl) => (
                  <li key={pl.id}>
                    <button
                      type="button"
                      className={selectedKey === `playlist:${pl.id}` ? 'selected' : ''}
                      onClick={() => onSelectSource(playlistSource(pl))}
                      title={pl.name}
                    >
                      {pl.name}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </li>
          <li>
            <details>
              <summary>My Albums</summary>
              <ul>
                {albums.length === 0 && <li className="tree-muted">No saved albums</li>}
                {albums.map((album) => (
                  <li key={album.id}>
                    <button
                      type="button"
                      className={selectedKey === `album:${album.id}` ? 'selected' : ''}
                      onClick={() => onSelectSource(albumSource(album))}
                      title={album.name}
                    >
                      {album.name}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        </ul>
      </nav>
      <div className="wmp-library-content">
        {sourceContent || (
          <div className="wmp-dashboard">
            <div className="dashboard-header">
              <h2>Media Library</h2>
              <p className="dashboard-subtitle">Welcome to your music collection</p>
            </div>
            <div className="library-tiles">
              <Tile label="Liked Songs" icon="heart" onClick={() => onSelectSource(LIKED_SOURCE)} />
              {playlists.map((pl) => (
                <Tile
                  key={pl.id}
                  label={pl.name}
                  sublabel={`${pl.tracks?.total ?? 0} songs`}
                  images={pl.images}
                  icon="cd"
                  onClick={() => onSelectSource(playlistSource(pl))}
                />
              ))}
            </div>
            {playlistsLoading && <div className="wmp-library-placeholder">Loading playlists…</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryView;
