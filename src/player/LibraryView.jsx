import React, { useEffect } from 'react';
import TrackTable from './TrackTable';
import SearchBox from './SearchBox';
import { coverUrl, LIKED_SOURCE, sourceKey } from './utils';
import { playlistSource, albumSource, artistSource, ALBUMS_SOURCE } from '../music/models';
import { decadesOf, decadeLabel } from '../music/selectors';
import { useMusic } from '../music/MusicContext';
import { useAssistant } from '../assistant/AssistantProvider';
import { useTrackView, useAlbumView } from './useListView';

const Art = ({ item, size, className, icon }) => {
  const url = coverUrl(item, size);
  return url
    ? <img src={url} alt="" className={className} loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
    : <span className={`${className} placeholder icon-${icon}`} aria-hidden="true" />;
};

const sourceIcon = (type) => (type === 'liked' ? 'heart' : type === 'artist' ? 'directory_closed-4' : 'cd');
const count = (n) => Number(n || 0).toLocaleString();

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
const artistSub = (ar) => (ar.albumCount ? `${ar.albumCount} albums` : 'Artist');
const EMPTY_HOME = { sections: [], needsReauth: false };
const songs = (n) => `${count(n)} song${n === 1 ? '' : 's'}`;

const ArtistTiles = ({ artists, onSelectSource }) => (
  <div className="library-tiles">
    {artists.map((ar) => (
      <Tile key={ar.id} item={ar} label={ar.name} sublabel={artistSub(ar)} icon="directory_closed-4" onClick={() => onSelectSource(artistSource(ar))} />
    ))}
  </div>
);

const PlaylistTiles = ({ playlists, onSelectSource }) => (
  <div className="library-tiles">
    {playlists.map((pl) => (
      <Tile key={pl.id} item={pl} label={pl.name} sublabel={pl.owner || songs(pl.songCount)} icon="cd" onClick={() => onSelectSource(playlistSource(pl))} />
    ))}
  </div>
);

const AlbumTiles = ({ albums, onSelectSource }) => (
  <div className="library-tiles">
    {albums.map((al) => (
      <Tile key={al.id} item={al} label={al.name} sublabel={albumSub(al)} icon="cd" onClick={() => onSelectSource(albumSource(al))} />
    ))}
  </div>
);

const SectionHeading = ({ title, onMore }) => (
  <h4 className="library-section-heading">
    {title}
    {onMore && <button type="button" className="library-see-all" onClick={onMore}>See all ▸</button>}
  </h4>
);

// Filter box for the list on screen, with a "12 of 3,512" count while it narrows the list
const ListFilter = ({ value, onChange, label, shown, total }) => (
  <div className="library-filter-bar">
    <input
      type="search"
      className="library-filter"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={label}
      aria-label={label}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
    />
    {value.trim() && <span className="library-filter-count">{count(shown)} of {count(total)}</span>}
  </div>
);

const PHASES = { songs: 'songs', albums: 'albums', artists: 'artists' };

// One line about the library itself: Spotify asking us to slow down, or the index being built
const LibraryStatus = ({ status, rateLimited, providerName }) => {
  let text = null;
  if (rateLimited > 0) {
    text = `${providerName} asked Winampify to slow down. Trying again in ${rateLimited}s…`;
  } else if (status?.state === 'syncing') {
    text = status.total
      ? `Indexing your library: ${PHASES[status.phase] || 'items'} ${count(status.done)} of ${count(status.total)}…`
      : 'Indexing your library…';
  } else if (status?.state === 'error') {
    text = 'Couldn\'t index your whole library just now, so the newest items are shown. Winampify will try again later.';
  }
  return text ? <p className="library-status" role="status">{text}</p> : null;
};

const ReauthNotice = ({ onLogin }) => (
  <p className="display-notice library-reauth" role="status">
    Sign in again to see your top artists and tracks.
    {' '}
    <button type="button" onClick={onLogin}>Sign in again</button>
  </p>
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
  source, onSelectSource, onSearch, trackList, collections, artistDetail, searchExtras, home = EMPTY_HOME,
  currentKey, onPlayTrack, onPlayAll, isMobile
}) => {
  const {
    playlists, playlistsLoading, capabilities, isStarred, toggleStar, providerName, library, login, libraryStatus, rateLimited
  } = useMusic();
  const labels = { newest: 'Recently Added', recent: 'Recently Played', ...library?.labels };
  const homeArtists = home.sections.filter((sec) => sec.kind === 'artists');
  const homeSources = home.sections.filter((sec) => sec.kind === 'sources').flatMap((sec) => sec.items);
  const selectedKey = sourceKey(source);
  const { albums, artists, newest, recent } = collections;
  const back = isMobile ? () => onSelectSource(null) : undefined;
  const view = useTrackView(trackList.tracks, selectedKey);
  const albumView = useAlbumView(albums, selectedKey);
  // Sorting and filtering only make sense once the whole list is loaded
  const refinable = !trackList.hasMore && !trackList.loading && trackList.tracks.length > 1;
  const playShown = () => onPlayAll(view.list);
  const status = <LibraryStatus status={libraryStatus} rateLimited={rateLimited} providerName={providerName} />;
  const { notify } = useAssistant();
  const searchEmpty = source?.type === 'search' && !trackList.loading && !searchExtras.loading
    && !trackList.tracks.length && !searchExtras.artists.length && !searchExtras.albums.length && !searchExtras.playlists?.length;
  // Wait a beat: right after a new search starts the lists are briefly empty before loading begins
  useEffect(() => {
    if (!searchEmpty) return undefined;
    const t = setTimeout(() => notify('search-empty'), 800);
    return () => clearTimeout(t);
  }, [searchEmpty, notify]);

  const trackTable = (showAlbum, { sortable = refinable } = {}) => (
    <TrackTable
      tracks={sortable ? view.visible : trackList.tracks}
      currentKey={currentKey}
      onPlay={sortable ? (track, index) => onPlayTrack(track, index, view.list) : onPlayTrack}
      compact={isMobile}
      loading={trackList.loading}
      error={trackList.error}
      hasMore={(sortable && view.hasMoreRows) || trackList.hasMore}
      onLoadMore={sortable && view.hasMoreRows ? view.showMore : trackList.loadMore}
      showAlbum={showAlbum}
      isStarred={capabilities.star ? isStarred : undefined}
      onToggleStar={capabilities.star ? toggleStar : undefined}
      sort={sortable ? view.sort : undefined}
      onSort={sortable ? view.onSort : undefined}
      showDates={!isMobile && trackList.tracks.some((t) => t.addedAt)}
      emptyText={view.query.trim() ? `No songs match “${view.query.trim()}”.` : undefined}
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
      && !trackList.tracks.length && !searchExtras.artists.length && !searchExtras.albums.length && !searchExtras.playlists?.length;
    content = (
      <div className="library-source">
        <SourceHeader source={source} meta={labels.searchMeta || `in your ${providerName} library`} onBack={back} onPlayAll={trackList.tracks.length ? playShown : undefined} />
        <div className="library-scroll search-results">
          {nothing && <div className="wmp-library-placeholder">No matches for “{source.query}”.</div>}
          {searchExtras.artists.length > 0 && (
            <section>
              <h4 className="library-section-heading">Artists</h4>
              <div className="search-artists">
                {searchExtras.artists.map((ar) => (
                  <ListRow key={ar.id} item={ar} label={ar.name} sublabel={artistSub(ar)} icon="directory_closed-4" onClick={() => onSelectSource(artistSource(ar))} />
                ))}
              </div>
            </section>
          )}
          {searchExtras.playlists?.length > 0 && (
            <section>
              <h4 className="library-section-heading">Playlists</h4>
              <PlaylistTiles playlists={searchExtras.playlists} onSelectSource={onSelectSource} />
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
              {trackTable(true, { sortable: false })}
            </section>
          )}
        </div>
      </div>
    );
  } else if (source?.type === 'albums') {
    const decades = decadesOf(albums);
    content = (
      <div className="library-source">
        <SourceHeader source={source} meta={albums.length ? `${count(albums.length)} albums` : ''} onBack={back} />
        <div className="library-refine">
          <ListFilter value={albumView.query} onChange={albumView.setQuery} label="Filter albums" shown={albumView.list.length} total={albums.length} />
          <label className="library-sort">
            Sort by{' '}
            <select value={albumView.sort} onChange={(e) => albumView.setSort(e.target.value)}>
              <option value="">Library order</option>
              <option value="artist">Artist</option>
              <option value="title">Title</option>
              <option value="year">Release year</option>
            </select>
          </label>
        </div>
        {decades.length > 1 && (
          <div className="library-chips" role="group" aria-label="Decade">
            <button type="button" aria-pressed={albumView.decade === null} onClick={() => albumView.setDecade(null)}>All</button>
            {decades.map((d) => (
              <button type="button" key={d} aria-pressed={albumView.decade === d} onClick={() => albumView.setDecade(d)}>{decadeLabel(d)}</button>
            ))}
          </div>
        )}
        <div className="library-scroll">
          {collections.loading && !albums.length && <div className="wmp-library-placeholder">Loading…</div>}
          {!collections.loading && !albumView.list.length && (
            <div className="wmp-library-placeholder">{albums.length ? 'No albums match.' : 'No saved albums yet.'}</div>
          )}
          <AlbumTiles albums={albumView.list} onSelectSource={onSelectSource} />
        </div>
      </div>
    );
  } else if (source) {
    content = (
      <div className="library-source">
        <SourceHeader source={source} meta={trackList.total ? songs(trackList.total) : ''} onPlayAll={playShown} onBack={back} />
        {trackList.notice === 'not_listable' ? (
          <div className="wmp-library-placeholder library-notice">
            Spotify only lets Winampify list the songs in playlists you own or collaborate on.
            You can still play the whole playlist with <b>▶ Play all</b>.
          </div>
        ) : (
          <>
            {refinable && trackList.tracks.length > 8 && (
              <ListFilter value={view.query} onChange={view.setQuery} label="Filter this list" shown={view.list.length} total={trackList.tracks.length} />
            )}
            {trackTable(source.type !== 'album')}
          </>
        )}
      </div>
    );
  }

  const searchBox = capabilities.search && (
    <SearchBox onSearch={onSearch} initial={source?.type === 'search' ? source.query : ''} label={`Search ${providerName}`} className="library-search" />
  );

  if (isMobile) {
    return (
      <div className="wmp-media-library-view mobile">
        {status}
        {content || (
          <div className="library-list">
            {searchBox}
            {home.needsReauth && <ReauthNotice onLogin={login} />}
            <ListRow item={null} label="Liked Songs" sublabel="Your favorites" icon="heart" onClick={() => onSelectSource(LIKED_SOURCE)} />
            {homeSources.map((src) => (
              <ListRow key={src.id} item={null} label={src.name} sublabel="From your listening" icon="cd" onClick={() => onSelectSource(src)} />
            ))}
            {artists.length > 0 && <h4 className="library-list-heading">Artists</h4>}
            {artists.map((ar) => (
              <ListRow key={ar.id} item={ar} label={ar.name} sublabel={artistSub(ar)} icon="directory_closed-4" onClick={() => onSelectSource(artistSource(ar))} />
            ))}
            {playlists.length > 0 && <h4 className="library-list-heading">My Playlists</h4>}
            {playlistsLoading && <div className="wmp-library-placeholder">Loading playlists…</div>}
            {playlists.map((pl) => (
              <ListRow key={pl.id} item={pl} label={pl.name} sublabel={songs(pl.songCount)} icon="cd" onClick={() => onSelectSource(playlistSource(pl))} />
            ))}
            {albums.length > 0 && (
              <>
                <h4 className="library-list-heading">My Albums</h4>
                <ListRow item={albums[0]} label="Albums" sublabel={`${count(albums.length)} saved`} icon="cd" onClick={() => onSelectSource(ALBUMS_SOURCE)} />
              </>
            )}
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
                <TreeItem selected={selectedKey === sourceKey(ALBUMS_SOURCE)} onClick={() => onSelectSource(ALBUMS_SOURCE)}>
                  Albums{albums.length ? ` (${count(albums.length)})` : ''}
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
        </ul>
      </nav>
      <div className="wmp-library-content">
        {status}
        {content || (
          <div className="wmp-dashboard">
            <div className="dashboard-header">
              <h2>Media Library</h2>
              <p className="dashboard-subtitle">Welcome to your music collection</p>
            </div>
            {home.needsReauth && <ReauthNotice onLogin={login} />}
            {recent.length > 0 && (
              <section>
                <h4 className="library-section-heading">{labels.recent}</h4>
                <AlbumTiles albums={recent} onSelectSource={onSelectSource} />
              </section>
            )}
            {homeArtists.map((sec) => (
              <section key={sec.title}>
                <h4 className="library-section-heading">{sec.title}</h4>
                <ArtistTiles artists={sec.items} onSelectSource={onSelectSource} />
              </section>
            ))}
            {newest.length > 0 && (
              <section>
                <h4 className="library-section-heading">{labels.newest}</h4>
                <AlbumTiles albums={newest} onSelectSource={onSelectSource} />
              </section>
            )}
            <section>
              <h4 className="library-section-heading">Playlists</h4>
              <div className="library-tiles">
                <Tile item={null} label="Liked Songs" icon="heart" onClick={() => onSelectSource(LIKED_SOURCE)} />
                {homeSources.map((src) => (
                  <Tile key={src.id} item={null} label={src.name} sublabel="From your listening" icon="cd" onClick={() => onSelectSource(src)} />
                ))}
                {playlists.map((pl) => (
                  <Tile key={pl.id} item={pl} label={pl.name} sublabel={songs(pl.songCount)} icon="cd" onClick={() => onSelectSource(playlistSource(pl))} />
                ))}
              </div>
              {!playlistsLoading && playlists.length === 0 && (
                <p className="library-empty-note">
                  No playlists yet. Playlists you create or follow in {providerName} will show up here.
                </p>
              )}
            </section>
            {playlistsLoading && <div className="wmp-library-placeholder">Loading playlists…</div>}
            {albums.length > 0 && (
              <section>
                <SectionHeading title="Your Albums" onMore={albums.length > 12 ? () => onSelectSource(ALBUMS_SOURCE) : undefined} />
                <AlbumTiles albums={albums.slice(0, 12)} onSelectSource={onSelectSource} />
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryView;
