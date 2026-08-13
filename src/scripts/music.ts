const DID = 'did:plc:nmhfq335cddnwt4ovrq4gzsm';
const FALLBACK_PDS = 'https://chaga.us-west.host.bsky.network';
const COLLECTIONS = {
  lists: 'fm.shirabe.list',
  listItems: 'fm.shirabe.listItem',
  tracks: 'fm.shirabe.track',
  albums: 'fm.shirabe.album',
  artists: 'fm.shirabe.artist'
} as const;

type ExternalId = { scheme?: string; id?: string };
type RecordValue = {
  name?: string;
  description?: string;
  title?: string;
  artists?: string[];
  album?: string;
  duration?: number;
  externalIds?: ExternalId[];
  releaseDate?: string;
  releaseDatePrecision?: string;
  trackCount?: number;
  createdAt?: string;
  updatedAt?: string;
  list?: string;
  subject?: string;
  order?: string;
};
type AtRecord = { uri: string; value: RecordValue };
type MusicData = {
  lists: AtRecord[];
  listItems: AtRecord[];
  tracks: AtRecord[];
  albums: AtRecord[];
  artists: AtRecord[];
};
type MusicIndex = MusicData & {
  listByUri: Map<string, AtRecord>;
  trackByUri: Map<string, AtRecord>;
  albumByUri: Map<string, AtRecord>;
  artistByUri: Map<string, AtRecord>;
  itemsByList: Map<string, AtRecord[]>;
  listsByTrack: Map<string, AtRecord[]>;
  tracksByAlbum: Map<string, AtRecord[]>;
};

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function rkeyOf(uri: string) {
  return uri.split('/').pop() || '';
}

function pageLink(page: 'list' | 'track', uri: string) {
  return `/blog/music/${page}?id=${encodeURIComponent(rkeyOf(uri))}`;
}

function formatDuration(milliseconds?: number) {
  if (!Number.isFinite(milliseconds) || !milliseconds || milliseconds < 0) return '';
  const seconds = Math.round(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatReleaseDate(value?: string, precision?: string) {
  if (!value) return '';
  if (precision === 'year') return value.slice(0, 4);
  if (precision === 'month') return value.slice(0, 7);
  return value;
}

function spotifyId(track: AtRecord) {
  const id = track.value.externalIds?.find((entry) => entry.scheme === 'spotify-track')?.id || '';
  return /^[A-Za-z0-9]{22}$/.test(id) ? id : '';
}

function artistNames(uris: string[] | undefined, index: MusicIndex) {
  if (!uris?.length) return 'Unknown artist';
  return uris.map((uri) => index.artistByUri.get(uri)?.value.name || 'Unknown artist').join(', ');
}

async function resolvePds() {
  try {
    const response = await fetch(`https://plc.directory/${DID}`);
    if (!response.ok) throw new Error(`DID resolution failed: ${response.status}`);
    const document = await response.json();
    return document.service?.find((service: { id?: string; type?: string; serviceEndpoint?: string }) =>
      service.id === '#atproto_pds' || service.type === 'AtprotoPersonalDataServer'
    )?.serviceEndpoint || FALLBACK_PDS;
  } catch {
    return FALLBACK_PDS;
  }
}

async function listRecords(pds: string, collection: string) {
  const records: AtRecord[] = [];
  let cursor = '';
  do {
    const query = new URLSearchParams({ repo: DID, collection, limit: '100' });
    if (cursor) query.set('cursor', cursor);
    const response = await fetch(`${pds}/xrpc/com.atproto.repo.listRecords?${query}`);
    if (!response.ok) throw new Error(`${collection}: ${response.status}`);
    const page = await response.json();
    records.push(...(page.records || []));
    cursor = page.cursor || '';
  } while (cursor);
  return records;
}

async function loadMusic(): Promise<MusicIndex> {
  const pds = await resolvePds();
  const [lists, listItems, tracks, albums, artists] = await Promise.all([
    listRecords(pds, COLLECTIONS.lists),
    listRecords(pds, COLLECTIONS.listItems),
    listRecords(pds, COLLECTIONS.tracks),
    listRecords(pds, COLLECTIONS.albums),
    listRecords(pds, COLLECTIONS.artists)
  ]);
  const listByUri = new Map(lists.map((record) => [record.uri, record]));
  const trackByUri = new Map(tracks.map((record) => [record.uri, record]));
  const albumByUri = new Map(albums.map((record) => [record.uri, record]));
  const artistByUri = new Map(artists.map((record) => [record.uri, record]));
  const itemsByList = new Map<string, AtRecord[]>();
  const listUrisByTrack = new Map<string, Set<string>>();
  const tracksByAlbum = new Map<string, AtRecord[]>();

  listItems.forEach((item) => {
    const { list, subject } = item.value;
    if (list) {
      const items = itemsByList.get(list) || [];
      items.push(item);
      itemsByList.set(list, items);
    }
    if (list && subject) {
      const listUris = listUrisByTrack.get(subject) || new Set<string>();
      listUris.add(list);
      listUrisByTrack.set(subject, listUris);
    }
  });
  itemsByList.forEach((items) => items.sort((a, b) =>
    String(a.value.order || rkeyOf(a.uri)).localeCompare(String(b.value.order || rkeyOf(b.uri)))
  ));
  tracks.forEach((track) => {
    if (!track.value.album) return;
    const albumTracks = tracksByAlbum.get(track.value.album) || [];
    albumTracks.push(track);
    tracksByAlbum.set(track.value.album, albumTracks);
  });
  tracksByAlbum.forEach((albumTracks) => albumTracks.sort((a, b) =>
    String(a.value.title || '').localeCompare(String(b.value.title || ''), 'ja')
  ));

  const listsByTrack = new Map<string, AtRecord[]>();
  listUrisByTrack.forEach((listUris, trackUri) => {
    listsByTrack.set(trackUri, [...listUris].map((uri) => listByUri.get(uri)).filter(Boolean) as AtRecord[]);
  });
  return {
    lists, listItems, tracks, albums, artists,
    listByUri, trackByUri, albumByUri, artistByUri,
    itemsByList, listsByTrack, tracksByAlbum
  };
}

function sectionHeading(title: string, note: string) {
  const heading = element('div', 'music-section-heading');
  heading.append(element('h2', '', title), element('p', '', note));
  return heading;
}

function trackRow(track: AtRecord, index: MusicIndex, number?: number) {
  const row = element('li', 'music-track-row');
  if (number != null) row.append(element('span', 'music-track-number', String(number)));
  const details = element('div', 'music-track-copy');
  const title = element('a', 'music-track-title', track.value.title || 'Untitled track');
  title.href = pageLink('track', track.uri);
  details.append(title, element('span', 'music-track-artist', artistNames(track.value.artists, index)));
  const album = track.value.album ? index.albumByUri.get(track.value.album) : undefined;
  if (album) details.append(element('span', 'music-track-album', album.value.title || 'Untitled album'));
  row.append(details, element('span', 'music-track-duration', formatDuration(track.value.duration)));
  return row;
}

function setPageTitle(pageTitle: string) {
  const title = document.querySelector<HTMLTitleElement>('title');
  const previousPageTitle = title?.dataset.pageTitle || '';
  const siteSuffix = previousPageTitle && document.title.startsWith(`${previousPageTitle} | `)
    ? document.title.slice(previousPageTitle.length)
    : '';
  if (title) title.dataset.pageTitle = pageTitle;
  document.title = `${pageTitle}${siteSuffix}`;
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
}

function renderHome(host: HTMLElement, index: MusicIndex) {
  const listSection = element('section', 'music-section');
  listSection.append(sectionHeading('リスト', `${index.lists.length} lists`));
  const listGrid = element('div', 'music-list-grid');
  [...index.lists]
    .sort((a, b) => String(b.value.createdAt || '').localeCompare(String(a.value.createdAt || '')))
    .forEach((record) => {
      const card = element('a', 'music-list-card');
      card.href = pageLink('list', record.uri);
      const count = index.itemsByList.get(record.uri)?.length || 0;
      card.append(
        element('span', 'music-card-kicker', `${count} tracks`),
        element('h3', '', record.value.name || 'Untitled list'),
        element('p', '', record.value.description || '説明はまだありません。'),
        element('span', 'music-card-arrow', 'リストを見る →')
      );
      listGrid.append(card);
    });
  if (!index.lists.length) listGrid.append(element('p', 'music-status', 'リストはまだありません。'));
  listSection.append(listGrid);

  const albumSection = element('section', 'music-section');
  albumSection.append(sectionHeading('アルバム', `${index.albums.length} albums`));
  const albumGrid = element('div', 'music-album-grid');
  [...index.albums]
    .sort((a, b) => String(b.value.releaseDate || '').localeCompare(String(a.value.releaseDate || '')))
    .forEach((album) => {
      const card = element('article', 'music-album-card');
      const savedTracks = index.tracksByAlbum.get(album.uri) || [];
      card.append(
        element('p', 'music-album-year', formatReleaseDate(album.value.releaseDate, album.value.releaseDatePrecision) || 'Date unknown'),
        element('h3', '', album.value.title || 'Untitled album'),
        element('p', 'music-album-artist', artistNames(album.value.artists, index))
      );
      const counts = element('p', 'music-album-count');
      counts.textContent = `${savedTracks.length} saved`;
      if (album.value.trackCount) counts.textContent += ` / ${album.value.trackCount} tracks`;
      card.append(counts);
      if (savedTracks.length) {
        const tracks = element('ul', 'music-album-tracks');
        savedTracks.forEach((track) => {
          const item = element('li');
          const link = element('a', '', track.value.title || 'Untitled track');
          link.href = pageLink('track', track.uri);
          item.append(link);
          tracks.append(item);
        });
        card.append(tracks);
      }
      albumGrid.append(card);
    });
  if (!index.albums.length) albumGrid.append(element('p', 'music-status', 'アルバムはまだありません。'));
  albumSection.append(albumGrid);
  host.replaceChildren(listSection, albumSection);
}

function requestedRecord(records: AtRecord[]) {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return null;
  return records.find((record) => rkeyOf(record.uri) === id) || null;
}

function renderList(host: HTMLElement, index: MusicIndex) {
  const list = requestedRecord(index.lists);
  if (!list) {
    host.replaceChildren(element('p', 'music-status music-error', 'リストが見つかりません。'));
    return;
  }
  setPageTitle(`${list.value.name || 'Music list'} | Music`);
  const intro = element('section', 'music-detail-intro');
  intro.append(
    element('p', 'music-eyebrow', 'MUSIC LIST'),
    element('h1', '', list.value.name || 'Untitled list')
  );
  if (list.value.description) intro.append(element('p', 'music-lead', list.value.description));
  const items = index.itemsByList.get(list.uri) || [];
  intro.append(element('p', 'music-detail-count', `${items.length} tracks`));

  const trackList = element('ol', 'music-track-list');
  let visibleNumber = 0;
  items.forEach((item) => {
    const track = item.value.subject ? index.trackByUri.get(item.value.subject) : undefined;
    if (track) {
      visibleNumber += 1;
      trackList.append(trackRow(track, index, visibleNumber));
    } else {
      const missing = element('li', 'music-track-row music-track-missing');
      missing.append(element('span', 'music-track-number', '–'), element('span', '', '参照先の曲が見つかりません。'));
      trackList.append(missing);
    }
  });
  if (!items.length) trackList.append(element('li', 'music-status', 'このリストに曲はまだありません。'));
  host.replaceChildren(intro, trackList);
}

function spotifyEmbed(track: AtRecord) {
  const id = spotifyId(track);
  const section = element('section', 'music-player');
  section.append(sectionHeading('Spotify', 'Listen on Spotify'));
  if (!id) {
    section.append(element('p', 'music-status', 'Spotifyの再生情報はありません。'));
    return section;
  }
  const iframe = document.createElement('iframe');
  iframe.src = `https://open.spotify.com/embed/track/${id}`;
  iframe.title = `${track.value.title || 'Track'} on Spotify`;
  iframe.loading = 'lazy';
  iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
  iframe.setAttribute('allowfullscreen', '');
  const link = element('a', 'music-spotify-link', 'Spotifyで開く ↗');
  link.href = `https://open.spotify.com/track/${id}`;
  link.target = '_blank';
  link.rel = 'noopener';
  section.append(iframe, link);
  return section;
}

function renderTrack(host: HTMLElement, index: MusicIndex) {
  const track = requestedRecord(index.tracks);
  if (!track) {
    host.replaceChildren(element('p', 'music-status music-error', '曲が見つかりません。'));
    return;
  }
  setPageTitle(`${track.value.title || 'Track'} | Music`);
  const album = track.value.album ? index.albumByUri.get(track.value.album) : undefined;
  const article = element('article', 'music-track-detail');
  const intro = element('header', 'music-track-header');
  intro.append(
    element('p', 'music-eyebrow', 'TRACK'),
    element('h1', '', track.value.title || 'Untitled track'),
    element('p', 'music-track-detail-artist', artistNames(track.value.artists, index))
  );
  const facts = element('dl', 'music-facts');
  const addFact = (label: string, value: string) => {
    if (!value) return;
    facts.append(element('dt', '', label), element('dd', '', value));
  };
  addFact('Album', album?.value.title || '');
  addFact('Released', formatReleaseDate(album?.value.releaseDate, album?.value.releaseDatePrecision));
  addFact('Duration', formatDuration(track.value.duration));
  intro.append(facts);
  article.append(intro, spotifyEmbed(track));

  const memberships = index.listsByTrack.get(track.uri) || [];
  const listSection = element('section', 'music-memberships');
  listSection.append(sectionHeading('収録リスト', `${memberships.length} lists`));
  if (memberships.length) {
    const links = element('div', 'music-membership-links');
    memberships.forEach((list) => {
      const link = element('a', '', list.value.name || 'Untitled list');
      link.href = pageLink('list', list.uri);
      links.append(link);
    });
    listSection.append(links);
  } else {
    listSection.append(element('p', 'music-status', '現在この曲を含むリストはありません。'));
  }
  article.append(listSection);
  host.replaceChildren(article);
}

async function init() {
  const root = document.querySelector<HTMLElement>('[data-music-page]');
  const host = document.getElementById('music-content');
  if (!root || !host) return;
  try {
    const index = await loadMusic();
    const page = root.dataset.musicPage;
    if (page === 'list') renderList(host, index);
    else if (page === 'track') renderTrack(host, index);
    else renderHome(host, index);
  } catch (error) {
    host.replaceChildren(element('p', 'music-status music-error', '音楽データを取得できませんでした。 / Could not load music.'));
    console.error(error);
  }
}

init();
