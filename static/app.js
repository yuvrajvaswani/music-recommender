const form = document.getElementById('recommend-form');
const songInput = document.getElementById('song-input');
const songOptions = document.getElementById('song-options');
const songIdInput = document.getElementById('song-id');
const similarityModeSelect = document.getElementById('similarity-mode');
const statusEl = document.getElementById('status');
const resultsGrid = document.getElementById('results-grid');
const resultCount = document.getElementById('result-count');
const emptyState = document.getElementById('empty-state');
const quickPicks = document.getElementById('quick-picks');
const heroCover = document.getElementById('hero-cover');
const heroTitle = document.getElementById('hero-title');
const heroArtist = document.getElementById('hero-artist');
const heroMode = document.getElementById('hero-mode');
const heroTip = document.getElementById('hero-tip');
const insightMode = document.getElementById('insight-mode');
const insightTopGenre = document.getElementById('insight-top-genre');
const insightVibe = document.getElementById('insight-vibe');
const insightAvgTempo = document.getElementById('insight-avg-tempo');
const insightAvgSimilarity = document.getElementById('insight-avg-similarity');
const saveQueueBtn = document.getElementById('save-queue-btn');
const recentQueues = document.getElementById('recent-queues');
const actionSurprise = document.getElementById('action-surprise');
const actionLastSeed = document.getElementById('action-last-seed');
const modeShortcutButtons = Array.from(document.querySelectorAll('.mode-chip'));
const sidebarRecentSeeds = document.getElementById('sidebar-recent-seeds');
const profileSavedQueues = document.getElementById('profile-saved-queues');
const profileRecentSeeds = document.getElementById('profile-recent-seeds');
const contextSeed = document.getElementById('context-seed');
const contextMode = document.getElementById('context-mode');
const contextTime = document.getElementById('context-time');
const contextCount = document.getElementById('context-count');
const contextTopGenre = document.getElementById('context-top-genre');
const contextAvgSim = document.getElementById('context-avg-sim');
const contextGenreBars = document.getElementById('context-genre-bars');
const coverCache = new Map();
const DEFAULT_COVER_PLACEHOLDER =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#2f2f2f'/><stop offset='100%' stop-color='#151515'/></linearGradient></defs><rect width='600' height='600' fill='url(#g)'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#e8e8e8' font-family='Arial, sans-serif' font-size='54' font-weight='700'>NO COVER</text></svg>"
    );

const STORAGE_KEY = 'music-recommender-saved-queues-v1';
const RECENT_SEEDS_KEY = 'music-recommender-recent-seeds-v1';
const MAX_SAVED_QUEUES = 8;
const MAX_RECENT_SEEDS = 8;

let allSongs = [];
let lastQueueSnapshot = null;
let lastRecommendations = [];
let lastSeedSong = null;
let activeRecommendationRequest = 0;
let isRecommendationRunning = false;

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function songDisplayLabel(song) {
    return `${song.title} - ${song.artist}`;
}

function resolveSongFromInput(value) {
    const normalized = normalizeText(value);
    if (!normalized) {
        return null;
    }

    let exact = allSongs.find((song) => normalizeText(songDisplayLabel(song)) === normalized);
    if (exact) {
        return exact;
    }

    const titleMatches = allSongs.filter((song) => normalizeText(song.title) === normalized);
    if (titleMatches.length === 1) {
        return titleMatches[0];
    }

    const asNumber = Number(value);
    if (Number.isInteger(asNumber)) {
        exact = allSongs.find((song) => Number(song.song_id) === asNumber) || null;
    }

    return exact || null;
}

function buildCoverLookupKey(song) {
    return `${song.title || ''}|${song.artist || ''}`.toLowerCase().trim();
}

function normalizeItunesArtworkUrl(url) {
    if (!url) {
        return null;
    }
    return String(url).replace(/100x100/g, '600x600');
}

function scoreItunesMatch(result, song) {
    const title = (song.title || '').toLowerCase();
    const artist = (song.artist || '').toLowerCase();
    const resultTitle = (result.trackName || '').toLowerCase();
    const resultArtist = (result.artistName || '').toLowerCase();

    let score = 0;
    if (resultTitle === title) {
        score += 3;
    } else if (resultTitle.includes(title) || title.includes(resultTitle)) {
        score += 1;
    }

    if (resultArtist === artist) {
        score += 3;
    } else if (resultArtist.includes(artist) || artist.includes(resultArtist)) {
        score += 1;
    }

    return score;
}

async function fetchAlbumCoverUrl(song) {
    const cacheKey = buildCoverLookupKey(song);
    if (coverCache.has(cacheKey)) {
        const cached = coverCache.get(cacheKey);
        if (cached) {
            return cached;
        }
    }

    const artist = String(song.artist || '').trim();
    const title = String(song.title || '').trim();
    const term = encodeURIComponent(`${artist} ${title}`.trim());
    const url = `https://itunes.apple.com/search?term=${term}&entity=song&limit=1`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            coverCache.set(cacheKey, DEFAULT_COVER_PLACEHOLDER);
            return DEFAULT_COVER_PLACEHOLDER;
        }

        const payload = await response.json();
        const first = Array.isArray(payload.results) ? payload.results[0] : null;
        const highRes = normalizeItunesArtworkUrl(first?.artworkUrl100 || null);
        const finalUrl = highRes || DEFAULT_COVER_PLACEHOLDER;
        coverCache.set(cacheKey, finalUrl);
        return finalUrl;
    } catch {
        coverCache.set(cacheKey, DEFAULT_COVER_PLACEHOLDER);
        return DEFAULT_COVER_PLACEHOLDER;
    }
}

async function attachAlbumCover(song, coverFrame) {
    const coverUrl = await fetchAlbumCoverUrl(song);

    const coverImage = document.createElement('img');
    coverImage.className = 'cover-art';
    coverImage.src = coverUrl;
    coverImage.alt = `${song.title} album cover`;
    coverImage.loading = 'lazy';
    coverImage.referrerPolicy = 'no-referrer';

    coverImage.addEventListener('load', () => {
        coverFrame.classList.remove('cover-fallback');
        coverFrame.textContent = '';
        coverFrame.appendChild(coverImage);
    });

    coverImage.addEventListener('error', () => {
        if (coverImage.src !== DEFAULT_COVER_PLACEHOLDER) {
            coverImage.src = DEFAULT_COVER_PLACEHOLDER;
            return;
        }
        coverImage.remove();
    });
}

function getInitials(song) {
    const titleInitial = (song.title || '?').trim().charAt(0).toUpperCase() || '?';
    const artistInitial = (song.artist || '?').trim().charAt(0).toUpperCase() || '?';
    return `${titleInitial}${artistInitial}`;
}

function clearResults() {
    resultsGrid.innerHTML = '';
    resultCount.textContent = '0';
}

function showEmptyState(show) {
    if (!emptyState) {
        return;
    }
    emptyState.style.display = show ? 'block' : 'none';
}

function toSimilarityPercent(song) {
    const rawPercent = song.similarity_percent;
    const numericPercent = typeof rawPercent === 'number' ? rawPercent : Number(rawPercent);
    if (Number.isFinite(numericPercent)) {
        return numericPercent.toFixed(1);
    }

    if (typeof song.similarity_score === 'number' && Number.isFinite(song.similarity_score)) {
        return (song.similarity_score * 100).toFixed(1);
    }

    return 'N/A';
}

function toSimilarityNumber(song) {
    const rawPercent = song.similarity_percent;
    const numericPercent = typeof rawPercent === 'number' ? rawPercent : Number(rawPercent);
    return Number.isFinite(numericPercent) ? numericPercent : null;
}

function formatModeLabel(mode) {
    const labels = {
        hybrid: 'Hybrid',
        artist: 'Artist',
        lyrics: 'Lyrics',
        vibe: 'Vibe',
        collaborative: 'Listening Pattern',
    };
    return labels[mode] || mode;
}

function modeInsight(mode) {
    const insights = {
        hybrid: 'Artist + Lyrics + Vibe',
        artist: 'Same artist and collaborators first',
        lyrics: 'Text and lyrical overlap focused',
        vibe: 'Tempo, energy, danceability, and mood',
        collaborative: 'Listening behavior patterns',
    };
    return insights[mode] || 'Balanced recommendation signal';
}

function inferVibeLabel(avgTempo) {
    if (!Number.isFinite(avgTempo)) {
        return '-';
    }
    if (avgTempo < 90) {
        return 'Calm';
    }
    if (avgTempo < 115) {
        return 'Chill';
    }
    if (avgTempo < 135) {
        return 'Balanced';
    }
    return 'Energetic';
}

function updateInsights(recommendations, mode) {
    if (insightMode) {
        insightMode.textContent = formatModeLabel(mode || 'hybrid');
    }

    if (!Array.isArray(recommendations) || !recommendations.length) {
        if (insightTopGenre) {
            insightTopGenre.textContent = '-';
        }
        if (insightVibe) {
            insightVibe.textContent = '-';
        }
        if (insightAvgTempo) {
            insightAvgTempo.textContent = '-';
        }
        if (insightAvgSimilarity) {
            insightAvgSimilarity.textContent = '-';
        }
        return;
    }

    const genreCounts = new Map();
    let tempoTotal = 0;
    let tempoCount = 0;
    let similarityTotal = 0;
    let similarityCount = 0;

    recommendations.forEach((song) => {
        const genre = String(song.genre || '').trim();
        if (genre) {
            genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
        }

        const tempo = Number(song.tempo);
        if (Number.isFinite(tempo)) {
            tempoTotal += tempo;
            tempoCount += 1;
        }

        const similarity = toSimilarityNumber(song);
        if (Number.isFinite(similarity)) {
            similarityTotal += similarity;
            similarityCount += 1;
        }
    });

    const topGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    const avgTempo = tempoCount ? tempoTotal / tempoCount : NaN;
    const avgSimilarity = similarityCount ? similarityTotal / similarityCount : NaN;

    if (insightTopGenre) {
        insightTopGenre.textContent = topGenre;
    }
    if (insightVibe) {
        insightVibe.textContent = inferVibeLabel(avgTempo);
    }
    if (insightAvgTempo) {
        insightAvgTempo.textContent = Number.isFinite(avgTempo) ? `${avgTempo.toFixed(0)} BPM` : '-';
    }
    if (insightAvgSimilarity) {
        insightAvgSimilarity.textContent = Number.isFinite(avgSimilarity) ? `${avgSimilarity.toFixed(1)}%` : '-';
    }
}

function updateHeroSong(song, mode) {
    if (!song || !heroTitle || !heroArtist || !heroMode || !heroTip || !heroCover) {
        return;
    }

    heroTitle.textContent = song.title || 'Next Track Session';
    heroArtist.textContent = song.artist || 'Pick a seed song to start your queue.';
    heroMode.textContent = formatModeLabel(mode || 'hybrid');
    heroTip.textContent = modeInsight(mode || 'hybrid');
    heroCover.className = 'hero-cover cover-frame cover-fallback';
    heroCover.textContent = getInitials(song);
    attachAlbumCover(song, heroCover);
}

function buildWhyText(song) {
    const mode = (similarityModeSelect?.value || 'hybrid').toLowerCase();
    const similarityText = toSimilarityPercent(song);

    if (mode === 'artist') {
        return `This recommendation is driven by shared artist or collaborator identity, with a confidence score of ${similarityText}%.`;
    }
    if (mode === 'lyrics') {
        return `This track shares strong text-level overlap with your seed track (lyrics/title metadata), scoring ${similarityText}%.`;
    }
    if (mode === 'vibe') {
        return `This song is close in vibe profile (tempo, mood, and energy signature), with a ${similarityText}% match.`;
    }
    if (mode === 'collaborative') {
        return `Listeners who played your seed track also gravitated to this song in similar listening sessions (${similarityText}% fit).`;
    }

    return `This is a blended pick across artist identity, lyrics/text, vibe, and listening pattern with an overall ${similarityText}% similarity.`;
}

function renderRecommendations(recommendations) {
    clearResults();
    resultCount.textContent = String(recommendations.length);
    showEmptyState(!recommendations.length);

    recommendations.forEach((song, index) => {
        const card = document.createElement('article');
        card.className = 'song-card';
        card.style.setProperty('--stagger', `${index * 55}ms`);

        const coverFrame = document.createElement('div');
        coverFrame.className = 'cover-frame cover-fallback';
        coverFrame.textContent = getInitials(song);
        attachAlbumCover(song, coverFrame);

        const title = document.createElement('h3');
        title.className = 'track-title';
        title.textContent = song.title;

        const artist = document.createElement('p');
        artist.className = 'track-artist';
        artist.textContent = song.artist;

        const meta = document.createElement('p');
        meta.className = 'track-meta';
        const similarityText = toSimilarityPercent(song);
        const suffix = similarityText === 'N/A' ? '' : '%';
        meta.textContent = `${song.genre} | ${song.tempo} BPM | Similarity ${similarityText}${suffix}`;

        const pills = document.createElement('div');
        pills.className = 'meta-badges';

        const genrePill = document.createElement('span');
        genrePill.className = 'meta-pill';
        genrePill.textContent = song.genre;

        const tempoPill = document.createElement('span');
        tempoPill.className = 'meta-pill';
        tempoPill.textContent = `${song.tempo} BPM`;

        pills.appendChild(genrePill);
        pills.appendChild(tempoPill);

        const confidenceWrap = document.createElement('div');
        confidenceWrap.className = 'confidence-wrap';

        const confidenceLabel = document.createElement('p');
        confidenceLabel.className = 'confidence-label';
        confidenceLabel.textContent = `Match Confidence ${similarityText}${suffix}`;

        const confidenceTrack = document.createElement('div');
        confidenceTrack.className = 'confidence-track';

        const confidenceFill = document.createElement('div');
        confidenceFill.className = 'confidence-fill';
        const percent = Number(similarityText);
        const width = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
        confidenceFill.style.width = `${width}%`;

        confidenceTrack.appendChild(confidenceFill);
        confidenceWrap.appendChild(confidenceLabel);
        confidenceWrap.appendChild(confidenceTrack);

        const whyToggle = document.createElement('details');
        whyToggle.className = 'why-toggle';

        const whySummary = document.createElement('summary');
        whySummary.textContent = 'Why this song?';

        const whyCopy = document.createElement('p');
        whyCopy.className = 'why-copy';
        whyCopy.textContent = buildWhyText(song);

        whyToggle.appendChild(whySummary);
        whyToggle.appendChild(whyCopy);

        card.appendChild(coverFrame);
        card.appendChild(title);
        card.appendChild(artist);
        card.appendChild(meta);
        card.appendChild(pills);
        card.appendChild(confidenceWrap);
        card.appendChild(whyToggle);
        resultsGrid.appendChild(card);
    });
}

function showLoadingSkeleton(count = 8) {
    clearResults();
    resultCount.textContent = '...';
    showEmptyState(false);

    for (let i = 0; i < count; i += 1) {
        const card = document.createElement('article');
        card.className = 'song-card skeleton';

        const cover = document.createElement('div');
        cover.className = 'skeleton-block skeleton-cover';

        const line1 = document.createElement('div');
        line1.className = 'skeleton-block skeleton-line medium';

        const line2 = document.createElement('div');
        line2.className = 'skeleton-block skeleton-line short';

        const line3 = document.createElement('div');
        line3.className = 'skeleton-block skeleton-line long';

        card.appendChild(cover);
        card.appendChild(line1);
        card.appendChild(line2);
        card.appendChild(line3);
        resultsGrid.appendChild(card);
    }
}

async function fetchSongs() {
    const response = await fetch('/api/songs');
    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.error || 'Failed to load songs.');
    }

    return Array.isArray(payload.songs) ? payload.songs : [];
}

function populateSongOptions(songs) {
    songOptions.innerHTML = '';
    songs.forEach((song) => {
        const option = document.createElement('option');
        option.value = songDisplayLabel(song);
        songOptions.appendChild(option);
    });
}

function handleSongInputChange() {
    const matchedSong = resolveSongFromInput(songInput.value);
    if (matchedSong) {
        songIdInput.value = String(matchedSong.song_id);
    } else {
        songIdInput.value = '';
    }
}

function renderQuickPicks() {
    if (!quickPicks) {
        return;
    }

    quickPicks.innerHTML = '';
    allSongs.slice(0, 5).forEach((song) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quick-pick';
        btn.textContent = song.title;
        btn.addEventListener('click', () => {
            songInput.value = songDisplayLabel(song);
            handleSongInputChange();
            updateHeroSong(song, (similarityModeSelect?.value || 'hybrid').toLowerCase());
        });
        quickPicks.appendChild(btn);
    });
}

function loadSavedQueues() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveSavedQueues(queues) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queues.slice(0, MAX_SAVED_QUEUES)));
}

function resolveSongFromSnapshot(snapshot) {
    if (!snapshot || !snapshot.seed_song_id) {
        return null;
    }

    const byId = allSongs.find((song) => Number(song.song_id) === Number(snapshot.seed_song_id));
    if (byId) {
        return byId;
    }

    const seedTitle = normalizeText(snapshot.seed_title);
    const seedArtist = normalizeText(snapshot.seed_artist);
    return allSongs.find(
        (song) => normalizeText(song.title) === seedTitle && normalizeText(song.artist) === seedArtist
    ) || null;
}

function formatQueueTime(timestamp) {
    const dt = new Date(timestamp || Date.now());
    return dt.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function upsertRecentSeed(song) {
    if (!song || !song.title || !song.artist) {
        return;
    }

    const seed = {
        seed_song_id: Number(song.song_id),
        seed_title: song.title,
        seed_artist: song.artist,
        created_at: Date.now(),
    };

    const existing = loadRecentSeeds();
    const deduped = [seed, ...existing].filter(
        (item, index, arr) =>
            arr.findIndex((ref) => Number(ref.seed_song_id) === Number(item.seed_song_id)) === index
    );

    localStorage.setItem(RECENT_SEEDS_KEY, JSON.stringify(deduped.slice(0, MAX_RECENT_SEEDS)));
    renderSidebarRecentSeeds();
}

function loadRecentSeeds() {
    try {
        const raw = localStorage.getItem(RECENT_SEEDS_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function updateProfileStats() {
    if (profileSavedQueues) {
        profileSavedQueues.textContent = String(loadSavedQueues().length);
    }
    if (profileRecentSeeds) {
        profileRecentSeeds.textContent = String(loadRecentSeeds().length);
    }
}

function renderSidebarRecentSeeds() {
    if (!sidebarRecentSeeds) {
        return;
    }

    const recent = loadRecentSeeds();
    sidebarRecentSeeds.innerHTML = '';

    if (!recent.length) {
        const empty = document.createElement('p');
        empty.className = 'queue-empty';
        empty.textContent = 'No seeds yet. Run a recommendation.';
        sidebarRecentSeeds.appendChild(empty);
        updateProfileStats();
        return;
    }

    recent.forEach((seed) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'side-seed-item';
        item.textContent = `${seed.seed_title} - ${seed.seed_artist}`;
        item.addEventListener('click', async () => {
            const resolved = resolveSongFromSnapshot(seed);
            if (!resolved) {
                statusEl.textContent = 'That seed song is not available in this catalog.';
                return;
            }
            songInput.value = songDisplayLabel(resolved);
            songIdInput.value = String(resolved.song_id);
            await runRecommendation(resolved, (similarityModeSelect?.value || 'hybrid').toLowerCase());
        });
        sidebarRecentSeeds.appendChild(item);
    });

    updateProfileStats();
}

function setActiveModeShortcut(mode) {
    modeShortcutButtons.forEach((btn) => {
        const isActive = btn.dataset.mode === mode;
        btn.classList.toggle('active', isActive);
    });
}

function renderContextGenreBars(recommendations) {
    if (!contextGenreBars) {
        return;
    }

    contextGenreBars.innerHTML = '';
    if (!Array.isArray(recommendations) || !recommendations.length) {
        const empty = document.createElement('p');
        empty.className = 'queue-empty';
        empty.textContent = 'Run recommendations to view genre spread.';
        contextGenreBars.appendChild(empty);
        return;
    }

    const counts = new Map();
    recommendations.forEach((song) => {
        const genre = String(song.genre || '').trim() || 'Unknown';
        counts.set(genre, (counts.get(genre) || 0) + 1);
    });

    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const maxCount = ranked[0]?.[1] || 1;

    ranked.forEach(([genre, count]) => {
        const bar = document.createElement('div');
        bar.className = 'genre-bar';

        const meta = document.createElement('div');
        meta.className = 'genre-bar-meta';
        const label = document.createElement('span');
        label.textContent = genre;
        const value = document.createElement('span');
        value.textContent = String(count);
        meta.appendChild(label);
        meta.appendChild(value);

        const track = document.createElement('div');
        track.className = 'genre-bar-track';
        const fill = document.createElement('div');
        fill.className = 'genre-bar-fill';
        fill.style.width = `${(count / maxCount) * 100}%`;
        track.appendChild(fill);

        bar.appendChild(meta);
        bar.appendChild(track);
        contextGenreBars.appendChild(bar);
    });
}

function updateContextRail(seedSong, recommendations, mode) {
    if (contextSeed && seedSong) {
        contextSeed.textContent = `${seedSong.title} - ${seedSong.artist}`;
    }
    if (contextMode) {
        contextMode.textContent = `Mode: ${formatModeLabel(mode || 'hybrid')}`;
    }
    if (contextTime) {
        contextTime.textContent = `Updated: ${formatQueueTime(Date.now())}`;
    }

    const recommendationList = Array.isArray(recommendations) ? recommendations : [];
    if (contextCount) {
        contextCount.textContent = String(recommendationList.length);
    }

    const topGenre = insightTopGenre ? insightTopGenre.textContent : '-';
    if (contextTopGenre) {
        contextTopGenre.textContent = topGenre || '-';
    }

    let avgSim = '-';
    if (recommendationList.length) {
        const nums = recommendationList.map((song) => toSimilarityNumber(song)).filter((x) => Number.isFinite(x));
        if (nums.length) {
            avgSim = `${(nums.reduce((sum, x) => sum + x, 0) / nums.length).toFixed(1)}%`;
        }
    }
    if (contextAvgSim) {
        contextAvgSim.textContent = avgSim;
    }

    renderContextGenreBars(recommendationList);
}

function renderRecentQueues() {
    if (!recentQueues) {
        return;
    }

    const queues = loadSavedQueues();
    recentQueues.innerHTML = '';

    if (!queues.length) {
        const empty = document.createElement('p');
        empty.className = 'queue-empty';
        empty.textContent = 'No saved queues yet. Run recommendations and click Save Current.';
        recentQueues.appendChild(empty);
        return;
    }

    queues.forEach((queue) => {
        const item = document.createElement('article');
        item.className = 'queue-item';

        const title = document.createElement('p');
        title.className = 'queue-title';
        title.textContent = `${queue.seed_title} - ${queue.seed_artist}`;

        const meta = document.createElement('p');
        meta.className = 'queue-meta';
        meta.textContent = `${formatModeLabel(queue.similarity_mode || 'hybrid')} | ${formatQueueTime(queue.created_at)}`;

        const replay = document.createElement('button');
        replay.type = 'button';
        replay.className = 'queue-replay';
        replay.textContent = 'Replay';
        replay.addEventListener('click', async () => {
            const resolved = resolveSongFromSnapshot(queue);
            if (!resolved) {
                statusEl.textContent = 'Saved song is not available in the current catalog.';
                return;
            }

            const mode = String(queue.similarity_mode || 'hybrid').toLowerCase();
            songInput.value = songDisplayLabel(resolved);
            songIdInput.value = String(resolved.song_id);
            if (similarityModeSelect) {
                similarityModeSelect.value = mode;
            }
            await runRecommendation(resolved, mode);
        });

        item.appendChild(title);
        item.appendChild(meta);
        item.appendChild(replay);
        recentQueues.appendChild(item);
    });

    updateProfileStats();
}

function saveCurrentQueue() {
    if (!lastQueueSnapshot) {
        statusEl.textContent = 'Run a recommendation first, then save the queue.';
        return;
    }

    const queues = loadSavedQueues();
    const merged = [lastQueueSnapshot, ...queues];
    const deduped = [];
    const seen = new Set();

    merged.forEach((queue) => {
        const key = `${queue.seed_song_id}|${queue.similarity_mode}|${queue.created_at}`;
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push(queue);
        }
    });

    saveSavedQueues(deduped);
    renderRecentQueues();
    updateProfileStats();
    statusEl.textContent = 'Current queue saved.';
}

async function initializeSongs() {
    try {
        const songs = await fetchSongs();
        allSongs = songs;
        populateSongOptions(songs);
        renderQuickPicks();
        renderRecentQueues();
        renderSidebarRecentSeeds();
        showEmptyState(true);
        updateInsights([], (similarityModeSelect?.value || 'hybrid').toLowerCase());
        updateContextRail(null, [], (similarityModeSelect?.value || 'hybrid').toLowerCase());
        setActiveModeShortcut((similarityModeSelect?.value || 'hybrid').toLowerCase());
        statusEl.textContent = `Loaded ${songs.length} songs.`;
        handleSongInputChange();
    } catch (error) {
        songOptions.innerHTML = '';
        songInput.placeholder = 'Unable to load songs';
        statusEl.textContent = error.message;
    }
}

async function fetchRecommendations(songId, similarityMode) {
    const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            song_id: songId,
            top_n: 10,
            similarity_mode: similarityMode,
        }),
    });

    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch recommendations.');
    }

    return Array.isArray(payload.recommendations) ? payload.recommendations : [];
}

async function runRecommendation(seedSong, similarityMode) {
    const requestId = ++activeRecommendationRequest;
    isRecommendationRunning = true;

    const recommendBtn = document.getElementById('recommend-btn');
    if (recommendBtn) {
        recommendBtn.disabled = true;
    }

    lastSeedSong = seedSong;
    updateHeroSong(seedSong, similarityMode);
    setActiveModeShortcut(similarityMode);
    statusEl.textContent = 'Finding recommendations...';
    showLoadingSkeleton(8);

    try {
        const recommendations = await fetchRecommendations(Number(seedSong.song_id), similarityMode);
        if (requestId !== activeRecommendationRequest) {
            return;
        }

        lastRecommendations = recommendations;
        upsertRecentSeed(seedSong);
        renderRecommendations(recommendations);
        updateInsights(recommendations, similarityMode);
        updateContextRail(seedSong, recommendations, similarityMode);

        lastQueueSnapshot = {
            created_at: Date.now(),
            seed_song_id: Number(seedSong.song_id),
            seed_title: seedSong.title,
            seed_artist: seedSong.artist,
            similarity_mode: similarityMode,
            recommendations: recommendations.slice(0, 10).map((song) => ({
                title: song.title,
                artist: song.artist,
            })),
        };

        statusEl.textContent = `Top 10 ${formatModeLabel(similarityMode)} recommendations ready.`;
    } catch (error) {
        if (requestId !== activeRecommendationRequest) {
            return;
        }

        lastRecommendations = [];
        clearResults();
        showEmptyState(true);
        updateInsights([], similarityMode);
        updateContextRail(seedSong, [], similarityMode);
        statusEl.textContent = error.message;
    } finally {
        if (requestId === activeRecommendationRequest) {
            isRecommendationRunning = false;
            if (recommendBtn) {
                recommendBtn.disabled = false;
            }
        }
    }
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (isRecommendationRunning) {
        return;
    }

    const matchedSong = resolveSongFromInput(songInput.value);
    if (!matchedSong) {
        statusEl.textContent = 'Please type an exact song title or choose one from suggestions.';
        return;
    }

    songIdInput.value = String(matchedSong.song_id);
    const similarityMode = (similarityModeSelect?.value || 'hybrid').toLowerCase();
    await runRecommendation(matchedSong, similarityMode);
});

songInput.addEventListener('input', handleSongInputChange);
songInput.addEventListener('change', handleSongInputChange);
similarityModeSelect?.addEventListener('change', () => {
    const current = resolveSongFromInput(songInput.value);
    const selectedMode = (similarityModeSelect?.value || 'hybrid').toLowerCase();

    if (lastRecommendations.length) {
        updateInsights(lastRecommendations, selectedMode);
    } else {
        updateInsights([], selectedMode);
    }

    if (current) {
        updateHeroSong(current, selectedMode);
        runRecommendation(current, selectedMode);
    } else {
        setActiveModeShortcut(selectedMode);
        updateContextRail(lastSeedSong, lastRecommendations, selectedMode);
    }
});
saveQueueBtn?.addEventListener('click', saveCurrentQueue);
actionSurprise?.addEventListener('click', async () => {
    if (!allSongs.length) {
        return;
    }
    const picked = allSongs[Math.floor(Math.random() * allSongs.length)];
    songInput.value = songDisplayLabel(picked);
    songIdInput.value = String(picked.song_id);
    await runRecommendation(picked, (similarityModeSelect?.value || 'hybrid').toLowerCase());
});
actionLastSeed?.addEventListener('click', async () => {
    if (!lastSeedSong) {
        statusEl.textContent = 'No previous seed yet. Run one recommendation first.';
        return;
    }
    songInput.value = songDisplayLabel(lastSeedSong);
    songIdInput.value = String(lastSeedSong.song_id);
    await runRecommendation(lastSeedSong, (similarityModeSelect?.value || 'hybrid').toLowerCase());
});
modeShortcutButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
        const mode = String(btn.dataset.mode || 'hybrid').toLowerCase();
        if (similarityModeSelect) {
            similarityModeSelect.value = mode;
        }
        setActiveModeShortcut(mode);
        const current = resolveSongFromInput(songInput.value);
        if (current) {
            await runRecommendation(current, mode);
            return;
        }
        updateInsights(lastRecommendations, mode);
        updateContextRail(lastSeedSong, lastRecommendations, mode);
    });
});

initializeSongs();
