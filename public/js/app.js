/**
 * Main Tablet Stream Deck Application Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const albumArtEl = document.getElementById('albumArt');
  const trackTitleEl = document.getElementById('trackTitle');
  const trackArtistEl = document.getElementById('trackArtist');
  const progressFillEl = document.getElementById('progressFill');
  const progressBgEl = document.getElementById('progressBarBg');
  const progressThumbEl = document.getElementById('progressThumb');
  const timeElapsedEl = document.getElementById('timeElapsed');
  const timeTotalEl = document.getElementById('timeTotal');

  const playPauseBtn = document.getElementById('playPauseBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const repeatBtn = document.getElementById('repeatBtn');

  // Volume
  const volumeSliderFill = document.getElementById('volumeSliderFill');
  const volumeSliderThumb = document.getElementById('volumeSliderThumb');
  const volumeSliderContainer = document.getElementById('volumeSliderContainer');
  const volumePercentLabel = document.getElementById('volumePercentLabel');
  const shuffleSwitch = document.getElementById('shuffleSwitch');
  const addToPlaylistBtn = document.getElementById('addToPlaylistBtn');
  const openQueueBtn = document.getElementById('openQueueBtn');

  // Search & Playlists
  const searchInput = document.getElementById('searchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const filterPills = document.querySelectorAll('.filter-pills .pill-btn');
  const playlistsListEl = document.getElementById('playlistsList');

  // Lyrics
  const lyricsContainer = document.getElementById('lyricsContainer');
  const fsLyricsContainer = document.getElementById('fsLyricsContainer');
  const lyricsExpandBtn = document.getElementById('lyricsExpandBtn');
  const fsLyricsModal = document.getElementById('fsLyricsModal');
  const closeFsLyricsBtn = document.getElementById('closeFsLyricsBtn');

  // Modals & Drawers
  const queueModal = document.getElementById('queueModal');
  const closeQueueBtn = document.getElementById('closeQueueBtn');
  const queueListEl = document.getElementById('queueList');

  const settingsModal = document.getElementById('settingsModal');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const connectSpotifyBtn = document.getElementById('connectSpotifyBtn');
  const toggleDemoModeBtn = document.getElementById('toggleDemoModeBtn');
  const clientIdInput = document.getElementById('clientIdInput');
  const clientSecretInput = document.getElementById('clientSecretInput');
  const redirectUriInput = document.getElementById('redirectUriInput');
  const tabletUrlDisplay = document.getElementById('tabletUrlDisplay');

  // Header status
  const connectionStatusDot = document.getElementById('connectionStatusDot');
  const connectionStatusText = document.getElementById('connectionStatusText');
  const fullscreenToggleBtn = document.getElementById('fullscreenToggleBtn');
  const wakeLockToggleBtn = document.getElementById('wakeLockToggleBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  // State
  let currentActiveTab = 'playlists';
  let isSeeking = false;
  let isAdjustingVolume = false;
  let wakeLockSentinel = null;
  let lastLyricsTrackKey = '';

  // Initialize Lyrics Manager
  const lyricsManager = new LyricsManager(
    lyricsContainer,
    fsLyricsContainer,
    (seekMs) => window.spotify.seek(seekMs)
  );

  // Time format utility (ms -> mm:ss)
  function formatTime(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Toast helper
  function showToast(msg) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // Update playback UI
  function updatePlaybackUI(data) {
    const { playback, progressMs, status } = data;

    // Status pill
    if (status) {
      if (status.connected) {
        connectionStatusDot.className = 'status-dot';
        connectionStatusText.textContent = 'Spotify Connected';
      } else {
        connectionStatusDot.className = 'status-dot demo';
        connectionStatusText.textContent = 'Demo Mode (Simulation)';
      }
    }

    if (!playback || !playback.item) {
      // Idle state
      trackTitleEl.textContent = 'Ready to Play';
      trackArtistEl.textContent = 'Open Spotify on your PC or tap Demo';
      playPauseBtn.innerHTML = getPlaySvg();
      timeElapsedEl.textContent = '0:00';
      timeTotalEl.textContent = '0:00';
      progressFillEl.style.width = '0%';
      return;
    }

    const item = playback.item;
    const duration = item.duration_ms || 1;

    // Title & Artist
    trackTitleEl.textContent = item.name || 'Unknown Track';
    const artistNames = item.artists ? item.artists.map(a => a.name).join(', ') : (item.artist || 'Unknown Artist');
    trackArtistEl.textContent = artistNames;

    // Album Art
    let imgUrl = '/assets/cover-placeholder.svg';
    if (item.album && item.album.images && item.album.images.length > 0) {
      imgUrl = item.album.images[0].url;
    } else if (item.cover_url) {
      imgUrl = item.cover_url;
    }
    if (albumArtEl.src !== imgUrl && !albumArtEl.src.endsWith(imgUrl)) {
      albumArtEl.src = imgUrl;
    }

    // Play/Pause button
    if (playback.is_playing) {
      playPauseBtn.innerHTML = getPauseSvg();
    } else {
      playPauseBtn.innerHTML = getPlaySvg();
    }

    // Progress
    if (!isSeeking) {
      const currentMs = Math.min(progressMs, duration);
      const pct = Math.max(0, Math.min(100, (currentMs / duration) * 100));
      progressFillEl.style.width = `${pct}%`;
      progressThumbEl.style.left = `${pct}%`;
      timeElapsedEl.textContent = formatTime(currentMs);
      timeTotalEl.textContent = formatTime(duration);

      // Sync Lyrics
      lyricsManager.updateSync(currentMs);
    }

    // Shuffle & Repeat states
    if (playback.shuffle_state) {
      shuffleBtn.classList.add('active');
      shuffleSwitch.checked = true;
    } else {
      shuffleBtn.classList.remove('active');
      shuffleSwitch.checked = false;
    }

    if (playback.repeat_state && playback.repeat_state !== 'off') {
      repeatBtn.classList.add('active');
    } else {
      repeatBtn.classList.remove('active');
    }

    // Volume
    if (!isAdjustingVolume && playback.device && playback.device.volume_percent !== undefined) {
      const vol = playback.device.volume_percent;
      volumePercentLabel.textContent = `${vol}%`;
      volumeSliderFill.style.width = `${vol}%`;
      volumeSliderThumb.style.left = `${vol}%`;
    }
  }

  // Fetch lyrics when track changes
  async function loadLyricsForCurrentTrack(item) {
    if (!item) return;
    const artist = item.artists ? item.artists.map(a => a.name).join(' ') : (item.artist || '');
    const title = item.name || '';
    const key = `${title}__${artist}`;
    if (key === lastLyricsTrackKey) return;
    lastLyricsTrackKey = key;

    lyricsContainer.innerHTML = '<div class="lyric-line">Loading lyrics...</div>';
    const lyricsData = await window.spotify.getLyrics(title, artist, item.duration_ms);
    lyricsManager.loadLyrics(lyricsData.syncedLyrics, lyricsData.plainLyrics);
  }

  window.addEventListener('trackchange', (e) => {
    loadLyricsForCurrentTrack(e.detail);
  });

  // Playback Controls Listeners
  playPauseBtn.addEventListener('click', () => window.spotify.togglePlay());
  prevBtn.addEventListener('click', () => window.spotify.previous());
  nextBtn.addEventListener('click', () => window.spotify.next());

  shuffleBtn.addEventListener('click', () => {
    const isShuffle = shuffleBtn.classList.contains('active');
    window.spotify.setShuffle(!isShuffle);
  });

  shuffleSwitch.addEventListener('change', () => {
    window.spotify.setShuffle(shuffleSwitch.checked);
  });

  repeatBtn.addEventListener('click', () => {
    const cur = window.spotify.playback ? window.spotify.playback.repeat_state : 'off';
    const nextState = cur === 'off' ? 'context' : (cur === 'context' ? 'track' : 'off');
    window.spotify.setRepeat(nextState);
  });

  // Progress Bar Scrubbing
  function seekToClientX(clientX) {
    const rect = progressBgEl.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const duration = (window.spotify.playback && window.spotify.playback.item) ? window.spotify.playback.item.duration_ms : 0;
    if (duration > 0) {
      const seekMs = Math.floor(pos * duration);
      window.spotify.seek(seekMs);
    }
  }

  progressBgEl.addEventListener('pointerdown', (e) => {
    isSeeking = true;
    seekToClientX(e.clientX);
    const onPointerMove = (ev) => {
      seekToClientX(ev.clientX);
    };
    const onPointerUp = () => {
      isSeeking = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  });

  // Volume Slider Scrubbing (Zero-lag, buttery smooth touch & mouse)
  let volThrottleTimer = null;
  let lastVolSent = -1;

  function setVolumeFromClientX(clientX, isFinal = false) {
    const rect = volumeSliderContainer.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const vol = Math.round(pos * 100);

    // Instant 0ms visual update on tablet
    volumePercentLabel.textContent = `${vol}%`;
    volumeSliderFill.style.width = `${vol}%`;
    volumeSliderThumb.style.left = `${vol}%`;

    if (isFinal) {
      clearTimeout(volThrottleTimer);
      volThrottleTimer = null;
      if (vol !== lastVolSent) {
        lastVolSent = vol;
        window.spotify.setVolume(vol);
      }
    } else {
      if (!volThrottleTimer) {
        volThrottleTimer = setTimeout(() => {
          volThrottleTimer = null;
          if (vol !== lastVolSent) {
            lastVolSent = vol;
            window.spotify.setVolume(vol);
          }
        }, 40);
      }
    }
  }

  volumeSliderContainer.addEventListener('pointerdown', (e) => {
    isAdjustingVolume = true;
    setVolumeFromClientX(e.clientX, false);
    const onPointerMove = (ev) => {
      setVolumeFromClientX(ev.clientX, false);
    };
    const onPointerUp = (ev) => {
      isAdjustingVolume = false;
      setVolumeFromClientX(ev.clientX, true);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  });

  // Quick Action Buttons
  addToPlaylistBtn.addEventListener('click', () => {
    showToast('❤️ Added to Liked Songs!');
  });

  openQueueBtn.addEventListener('click', async () => {
    queueModal.classList.add('active');
    queueListEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Loading Queue...</div>';
    const data = await window.spotify.getQueue();
    const queue = data.queue || [];
    if (queue.length === 0) {
      queueListEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Queue is empty</div>';
    } else {
      queueListEl.innerHTML = queue.map((t, i) => `
        <div class="playlist-item">
          <div class="playlist-item-left">
            <span style="font-weight:700;color:var(--text-muted);width:20px;">${i + 1}</span>
            <img class="playlist-thumb" src="${t.cover_url || (t.album && t.album.images && t.album.images[0] ? t.album.images[0].url : '/assets/cover-placeholder.svg')}" onerror="this.src='/assets/cover-placeholder.svg'" />
            <div class="playlist-meta">
              <span class="playlist-name">${escapeHtml(t.title || t.name)}</span>
              <span class="playlist-sub">${escapeHtml(t.artist || (t.artists ? t.artists.map(a => a.name).join(', ') : ''))}</span>
            </div>
          </div>
        </div>
      `).join('');
    }
  });

  closeQueueBtn.addEventListener('click', () => {
    queueModal.classList.remove('active');
  });

  // Fullscreen Lyrics
  lyricsExpandBtn.addEventListener('click', () => {
    fsLyricsModal.classList.add('active');
    lyricsManager.updateSync(window.spotify.localProgressMs, true);
  });

  closeFsLyricsBtn.addEventListener('click', () => {
    fsLyricsModal.classList.remove('active');
  });

  // Playlists and Search Rendering
  async function loadPlaylists() {
    playlistsListEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Loading playlists...</div>';
    const data = await window.spotify.getPlaylists();
    const items = data.items || [];
    renderPlaylists(items);
  }

  function renderPlaylists(items) {
    if (items.length === 0) {
      playlistsListEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No playlists found</div>';
      return;
    }

    playlistsListEl.innerHTML = items.map(p => {
      const isLiked = p.id === 'liked' || p.type === 'liked';
      const thumb = isLiked
        ? `<div class="playlist-thumb gradient-purple"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div>`
        : `<img class="playlist-thumb" src="${p.cover_url || '/assets/cover-placeholder.svg'}" onerror="this.src='/assets/cover-placeholder.svg'" />`;

      const trackCountText = p.track_count ? `${p.track_count} songs` : 'Playlist';

      return `
        <div class="playlist-item" data-id="${p.id}" data-uri="${p.uri || ''}">
          <div class="playlist-item-left">
            ${thumb}
            <div class="playlist-meta">
              <span class="playlist-name">${escapeHtml(p.name)}</span>
              <span class="playlist-sub">${trackCountText}</span>
            </div>
          </div>
          <button class="playlist-more-btn" title="Options">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
        </div>
      `;
    }).join('');

    // Attach click to play playlist
    playlistsListEl.querySelectorAll('.playlist-item').forEach(el => {
      el.addEventListener('click', async (e) => {
        if (e.target.closest('.playlist-more-btn')) {
          e.stopPropagation();
          showToast('Playing playlist...');
        }
        const plId = el.getAttribute('data-id');
        const uri = el.getAttribute('data-uri');

        if (uri) {
          await window.spotify.play({ context_uri: uri });
          showToast(`Playing ${el.querySelector('.playlist-name').textContent}`);
        } else {
          // Fetch tracks and play
          const tData = await window.spotify.getPlaylistTracks(plId);
          if (tData.items && tData.items.length > 0) {
            await window.spotify.play();
            showToast(`Playing ${el.querySelector('.playlist-name').textContent}`);
          }
        }
      });
    });
  }

  // Filter Pills
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentActiveTab = pill.getAttribute('data-tab');

      if (searchInput.value.trim()) {
        executeSearch(searchInput.value.trim());
      } else {
        loadPlaylists();
      }
    });
  });

  // Search Input with debounce
  let searchTimeout = null;
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    if (q) {
      searchClearBtn.style.display = 'block';
    } else {
      searchClearBtn.style.display = 'none';
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (q) {
        executeSearch(q);
      } else {
        loadPlaylists();
      }
    }, 350);
  });

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchClearBtn.style.display = 'none';
    loadPlaylists();
  });

  async function executeSearch(query) {
    playlistsListEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Searching...</div>';
    const data = await window.spotify.search(query);

    let items = [];
    if (currentActiveTab === 'playlists') {
      items = (data.playlists && data.playlists.items) || [];
      renderPlaylists(items.map(p => ({
        id: p.id,
        name: p.name,
        type: 'playlist',
        uri: p.uri,
        track_count: p.tracks ? p.tracks.total : '',
        cover_url: p.images && p.images[0] ? p.images[0].url : ''
      })));
    } else {
      // Songs / Artists / Albums
      items = (data.tracks && data.tracks.items) || [];
      if (items.length === 0) {
        playlistsListEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No songs found</div>';
        return;
      }
      playlistsListEl.innerHTML = items.map(t => `
        <div class="playlist-item" data-uri="${t.uri || ''}" data-id="${t.id}">
          <div class="playlist-item-left">
            <img class="playlist-thumb" src="${t.cover_url || (t.album && t.album.images && t.album.images[0] ? t.album.images[0].url : '/assets/cover-placeholder.svg')}" onerror="this.src='/assets/cover-placeholder.svg'" />
            <div class="playlist-meta">
              <span class="playlist-name">${escapeHtml(t.name || t.title)}</span>
              <span class="playlist-sub">${escapeHtml(t.artists ? t.artists.map(a => a.name).join(', ') : (t.artist || ''))}</span>
            </div>
          </div>
          <button class="playlist-more-btn" title="Queue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      `).join('');

      playlistsListEl.querySelectorAll('.playlist-item').forEach(el => {
        el.addEventListener('click', async (e) => {
          const uri = el.getAttribute('data-uri');
          const title = el.querySelector('.playlist-name').textContent;
          const artist = el.querySelector('.playlist-sub').textContent;

          if (e.target.closest('.playlist-more-btn')) {
            e.stopPropagation();
            await window.spotify.addToQueue(uri, title, artist);
            showToast(`Added "${title}" to Queue!`);
            return;
          }

          if (uri) {
            await window.spotify.play({ uris: [uri] });
          } else {
            await window.spotify.play();
          }
          showToast(`Playing "${title}"`);
        });
      });
    }
  }

  // Sidebar navigation actions
  document.getElementById('navSearch').addEventListener('click', () => {
    searchInput.focus();
    searchInput.select();
  });

  document.getElementById('navLibrary').addEventListener('click', () => {
    searchInput.value = '';
    searchClearBtn.style.display = 'none';
    loadPlaylists();
  });

  document.getElementById('navLiked').addEventListener('click', async () => {
    showToast('Loading Liked Songs...');
    const tData = await window.spotify.getPlaylistTracks('liked');
    if (tData.items) {
      executeSearch('Night Changes'); // or display liked
    }
  });

  // Settings Modal & Spotify Connect Setup
  openSettingsBtn.addEventListener('click', async () => {
    const st = await window.spotify.fetchStatus();
    if (st) {
      clientIdInput.value = st.client_id || '';
      redirectUriInput.value = st.redirect_uri || `http://${st.local_ip}:${st.port}/callback`;
      tabletUrlDisplay.textContent = `http://${st.local_ip}:${st.port}`;
    }
    settingsModal.classList.add('active');
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  saveSettingsBtn.addEventListener('click', async () => {
    const res = await window.spotify.saveConfig({
      client_id: clientIdInput.value.trim(),
      client_secret: clientSecretInput.value.trim(),
      redirect_uri: redirectUriInput.value.trim()
    });
    if (res.success) {
      showToast('Settings saved successfully!');
    }
  });

  connectSpotifyBtn.addEventListener('click', async () => {
    // Save first
    await window.spotify.saveConfig({
      client_id: clientIdInput.value.trim(),
      client_secret: clientSecretInput.value.trim(),
      redirect_uri: redirectUriInput.value.trim()
    });

    const authRes = await window.spotify.getAuthUrl();
    if (authRes.url) {
      window.location.href = authRes.url;
    } else {
      alert(authRes.error || 'Please enter your Spotify Client ID and Client Secret.');
    }
  });

  toggleDemoModeBtn.addEventListener('click', async () => {
    const st = window.spotify.status;
    const newDemoState = !st.demo_mode;
    await window.spotify.saveConfig({ demo_mode: newDemoState });
    window.location.reload();
  });

  // Tablet Fullscreen Toggle
  fullscreenToggleBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen request failed:', err);
      });
      fullscreenToggleBtn.title = 'Exit Fullscreen';
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      fullscreenToggleBtn.title = 'Enter Fullscreen';
    }
  });

  // Screen Wake Lock API (keeps tablet awake while music is playing)
  wakeLockToggleBtn.addEventListener('click', async () => {
    if (!wakeLockSentinel && 'wakeLock' in navigator) {
      try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockToggleBtn.style.color = 'var(--spotify-green)';
        showToast('Screen Wake Lock: Active (Tablet won\'t sleep)');
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
          wakeLockToggleBtn.style.color = '';
        });
      } catch (err) {
        showToast('Wake Lock error: ' + err.message);
      }
    } else if (wakeLockSentinel) {
      wakeLockSentinel.release();
      wakeLockSentinel = null;
      wakeLockToggleBtn.style.color = '';
      showToast('Screen Wake Lock: Released');
    } else {
      showToast('Wake Lock not supported on this browser');
    }
  });

  // Theme Toggle (Light / Dark)
  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    }
  });

  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  // SVG Helper Icons
  function getPlaySvg() {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`;
  }

  function getPauseSvg() {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.5"></rect><rect x="14" y="4" width="4" height="16" rx="1.5"></rect></svg>`;
  }

  // Check URL params for auth success/error
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('auth') === 'success') {
    showToast('🎉 Connected to Spotify successfully!');
    history.replaceState(null, '', window.location.pathname);
  } else if (urlParams.get('auth') === 'error') {
    showToast('Spotify auth error: ' + (urlParams.get('msg') || ''));
  }

  // Initialize service
  window.spotify.onUpdate(updatePlaybackUI);
  await window.spotify.init();
  await loadPlaylists();

  // Load initial track lyrics
  if (window.spotify.playback && window.spotify.playback.item) {
    loadLyricsForCurrentTrack(window.spotify.playback.item);
  }
});
