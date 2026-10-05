import React, { useEffect } from 'react';
import TrackTable from './TrackTable';
import SearchBox from './SearchBox';
import { coverUrl, LIKED_SOURCE, sourceKey } from './utils';
import { playlistSource, albumSource, artistSource } from '../music/models';
import { useMusic } from '../music/MusicContext';
import { useAssistant } from '../assistant/AssistantProvider';

const Art = ({ item, size, className, icon }) => {
  const url = coverUrl(item, size);
  return url
    ? <img src={url} alt="" className={className} loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
    : <span className={`${className} placeholder icon-${icon}`} aria-hidden="true" />;
};

const sourceIcon = (type) => (type === 'liked' ? 'heart' : type === 'artist' ? 'directory_closed-4' : 'cd');

const SourceHeader = ({ source, meta, onPlayAll, onBack }) => (
  <div className="library-source-header">
    {onBack && (
      <button type="button" className="library-back" onClick={onBack} aria-label="Back to library">
        ◀ Library
      </button>
    )}
    <div className="library-source-title">
      <Art item={source} size={96} className="library-source-art" icon={sourceIcon(source.type)} />
      <div>
        <h3>{source.name}</h3>
        <span className="library-source-meta">{meta}</span>
      </div>
    </div>
    {onPlayAll && <button type="button" className="library-play-all" onClick={onPlayAll}>▶ Play all</button>}
  </div>
);

const Tile = ({ item, label, sublabel, icon, onClick }) => (
  <button type="button" className="library-tile" onClick={onClick} title={label}>
    <Art item={item} size={300} className="library-tile-art" icon={icon} />
    <span className="library-tile-label">{label}</span>
    {sublabel && <span className="library-tile-sub">{sublabel}</span>}
  </button>
);

const ListRow = ({ item, label, sublabel, icon, onClick }) => (
  <button type="button" className="library-list-row" onClick={onClick}>
    <Art item={item} size={96} className="library-list-art" icon={icon} />
    <span className="library-list-text">
      <span className="library-list-label">{label}</span>
      {sublabel && <span className="library-list-sub">{sublabel}</span>}
    </span>
    <span className="library-list-chevron" aria-hidden="true">▸</span>
  </button>
);

const albumSub = (al) => [al.artist, al.year].filter(Boolean).join(' · ');
const songs = (n) => `${n} song${n === 1 ? '' : 's'}`;

const AlbumTiles = ({ albums, onSelectSource }) => (
  <div className="library-tiles">
    {albums.map((al) => (
      <Tile key={al.id} item={al} label={al.name} sublabel={albumSub(al)} icon="cd" onClick={() => onSelectSource(albumSource(al))} />
    ))}
  </div>
);

const TreeItem = ({ selected, onClick, children, title }) => (
  <li>
    <button type="button" className={selected ? 'selected' : ''} onClick={onClick} title={title}>{children}</button>
  </li>
);

/**
 * Media Library. Desktop: tree sidebar + content pane; phones: a drill-down list.
 * Content by source: dashboard (none), artist → album tiles, search → artists/albums/songs,
 * everything else → a track table.
 */
const LibraryView = ({
  source, onSelectSource, onSearch, trackList, collections, artistDetail, searchExtras,
  currentKey, onPlayTrack, onPlayAll, isMobile
}) => {
  const { playlists, playlistsLoading, capabilities, isStarred, providerName } = useMusic();
  const selectedKey = sourceKey(source);
  const { albums, artists, newest, recent } = collections;
  const back = isMobile ? () => onSelectSource(null) : undefined;
  const { notify } = useAssistant();
  const searchEmpty = source?.type === 'search' && !trackList.loading && !searchExtras.loading
    && !trackList.tracks.length && !searchExtras.artists.length && !searchExtras.albums.length;
  // Wait a beat: right after a new search starts the lists are briefly empty before loading begins
  useEffect(() => {
    if (!searchEmpty) return undefined;
    const t = setTimeout(() => notify('search-empty'), 800);
    return () => clearTimeout(t);
  }, [searchEmpty, notify]);

  const trackTable = (showAlbum) => (
    <TrackTable
      tracks={trackList.tracks}
      currentKey={currentKey}
      onPlay={onPlayTrack}
      compact={isMobile}
      loading={trackList.loading}
      error={trackList.error}
      hasMore={trackList.hasMore}
      onLoadMore={trackList.loadMore}
      showAlbum={showAlbum}
      isStarred={capabilities.star ? isStarred : undefined}
    />
  );

  let content = null;
  if (source?.type === 'artist') {
    const { artist, albums: artistAlbums, loading, error } = artistDetail;
    content = (
      <div className="library-source">
        <SourceHeader source={{ ...source, coverArt: artist?.coverArt || source.coverArt }} meta={artistAlbums.length ? `${artistAlbums.length} albums` : ''} onBack={back} />
        <div className="library-scroll">
          {loading && <div className="wmp-library-placeholder">Loading…</div>}
          {error && <div className="wmp-library-placeholder">{error}</div>}
          <AlbumTiles albums={artistAlbums} onSelectSource={onSelectSource} />
        </div>
      </div>
    );
  } else if (source?.type === 'search') {
    const nothing = !trackList.loading && !searchExtras.loading
      && !trackList.tracks.length && !searchExtras.artists.length && !searchExtras.albums.length;
    content = (
      <div className="library-source">
        <SourceHeader source={source} meta={`in your ${providerName} library`} onBack={back} onPlayAll={trackList.tracks.length ? onPlayAll : undefined} />
        <div className="library-scroll search-results">
          {nothing && <div className="wmp-library-placeholder">No matches for “{source.query}”.</div>}
          {searchExtras.artists.length > 0 && (
            <section>
              <h4 className="library-section-heading">Artists</h4>
              <div className="search-artists">
                {searchExtras.artists.map((ar) => (
                  <ListRow key={ar.id} item={ar} label={ar.name} sublabel={`${ar.albumCount} albums`} icon="directory_closed-4" onClick={() => onSelectSource(artistSource(ar))} />
                ))}
              </div>
            </section>
          )}
          {searchExtras.albums.length > 0 && (
            <section>
              <h4 className="library-section-heading">Albums</h4>
              <AlbumTiles albums={searchExtras.albums} onSelectSource={onSelectSource} />
            </section>
          )}
          {(trackList.loading || trackList.tracks.length > 0) && (
            <section className="search-songs">
              <h4 className="library-section-heading">Songs</h4>
              {trackTable(true)}
            </section>
          )}
        </div>
      </div>
    );
  } else if (source) {
    content = (
      <div className="library-source">
        <SourceHeader source={source} meta={trackList.total ? songs(trackList.total) : ''} onPlayAll={onPlayAll} onBack={back} />
        {trackTable(source.type !== 'album')}
      </div>
    );
  }

  const searchBox = capabilities.search && (
    <SearchBox onSearch={onSearch} initial={source?.type === 'search' ? source.query : ''} label={`Search ${providerName}`} className="library-search" />
  );

  if (isMobile) {
    return (
      <div className="wmp-media-library-view mobile">
        {content || (
          <div className="library-list">
            {searchBox}
            <ListRow item={null} label="Liked Songs" sublabel="Your favorites" icon="heart" onClick={() => onSelectSource(LIKED_SOURCE)} />
            {artists.length > 0 && <h4 className="library-list-heading">Artists</h4>}
            {artists.map((ar) => (
              <ListRow key={ar.id} item={ar} label={ar.name} sublabel={`${ar.albumCount} albums`} icon="directory_closed-4" onClick={() => onSelectSource(artistSource(ar))} />
            ))}
            {playlists.length > 0 && <h4 className="library-list-heading">My Playlists</h4>}
            {playlistsLoading && <div className="wmp-library-placeholder">Loading playlists…</div>}
            {playlists.map((pl) => (
              <ListRow key={pl.id} item={pl} label={pl.name} sublabel={songs(pl.songCount)} icon="cd" onClick={() => onSelectSource(playlistSource(pl))} />
            ))}
            {albums.length > 0 && <h4 className="library-list-heading">My Albums</h4>}
            {albums.map((al) => (
              <ListRow key={al.id} item={al} label={al.name} sublabel={albumSub(al)} icon="cd" onClick={() => onSelectSource(albumSource(al))} />
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
                <TreeItem selected={selectedKey === sourceKey(LIKED_SOURCE)} onClick={() => onSelectSource(LIKED_SOURCE)}>
                  Liked Songs
                </TreeItem>
              </ul>
            </details>
          </li>
          {capabilities.artists && (
            <li>
              <details open>
                <summary>Artists</summary>
                <ul>
                  {artists.length === 0 && <li className="tree-muted">No artists</li>}
                  {artists.map((ar) => (
                    <TreeItem key={ar.id} selected={selectedKey === `artist:${ar.id}`} onClick={() => onSelectSource(artistSource(ar))} title={ar.name}>
                      {ar.name}
                    </TreeItem>
                  ))}
                </ul>
              </details>
            </li>
          )}
          <li>
            <details open>
              <summary>My Playlists</summary>
              <ul>
                {playlistsLoading && <li className="tree-muted">Loading…</li>}
                {!playlistsLoading && playlists.length === 0 && <li className="tree-muted">No playlists</li>}
                {playlists.map((pl) => (
                  <TreeItem key={pl.id} selected={selectedKey === `playlist:${pl.id}`} onClick={() => onSelectSource(playlistSource(pl))} title={pl.name}>
                    {pl.name}
                  </TreeItem>
                ))}
              </ul>
            </details>
          </li>
          <li>
            <details>
              <summary>My Albums</summary>
              <ul>
                {albums.length === 0 && <li className="tree-muted">No albums</li>}
                {albums.map((al) => (
                  <TreeItem key={al.id} selected={selectedKey === `album:${al.id}`} onClick={() => onSelectSource(albumSource(al))} title={`${al.name} — ${al.artist}`}>
                    {al.name}
                  </TreeItem>
                ))}
              </ul>
            </details>
          </li>
        </ul>
      </nav>
      <div className="wmp-library-content">
        {content || (
          <div className="wmp-dashboard">
            <div className="dashboard-header">
              <h2>Media Library</h2>
              <p className="dashboard-subtitle">Welcome to your music collection</p>
            </div>
            {newest.length > 0 && (
              <section>
                <h4 className="library-section-heading">Recently Added</h4>
                <AlbumTiles albums={newest} onSelectSource={onSelectSource} />
              </section>
            )}
            {recent.length > 0 && (
              <section>
                <h4 className="library-section-heading">Recently Played</h4>
                <AlbumTiles albums={recent} onSelectSource={onSelectSource} />
              </section>
            )}
            <section>
              <h4 className="library-section-heading">Playlists</h4>
              <div className="library-tiles">
                <Tile item={null} label="Liked Songs" icon="heart" onClick={() => onSelectSource(LIKED_SOURCE)} />
                {playlists.map((pl) => (
                  <Tile key={pl.id} item={pl} label={pl.name} sublabel={songs(pl.songCount)} icon="cd" onClick={() => onSelectSource(playlistSource(pl))} />
                ))}
              </div>
            </section>
            {playlistsLoading && <div className="wmp-library-placeholder">Loading playlists…</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryView;
