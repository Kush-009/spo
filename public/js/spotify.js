/**
 * Spotify API Client and State Manager
 */

class SpotifyService {
  constructor() {
    this.status = {
      connected: false,
      demo_mode: true,
      local_ip: '127.0.0.1',
      port: 5000,
      client_id: '',
      redirect_uri: ''
    };

    this.playback = null;
    this.pollInterval = null;
    this.timerInterval = null;
    this.listeners = [];
    this.lastFetchedAt = 0;
    this.localProgressMs = 0;
    this.isPlaying = false;
    this.currentTrackId = null;
  }

  onUpdate(callback) {
    this.listeners.push(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      cb({
        playback: this.playback,
        progressMs: this.localProgressMs,
        status: this.status
      });
    }
  }

  async init() {
    await this.fetchStatus();
    await this.fetchPlayback();

    // Start background poll every 1.5 seconds
    this.pollInterval = setInterval(() => this.fetchPlayback(), 1500);

    // High frequency smooth progress ticker every 100ms
    this.timerInterval = setInterval(() => {
      if (this.isPlaying && this.playback && this.playback.item) {
        this.localProgressMs += 100;
        const duration = this.playback.item.duration_ms || 1;
        if (this.localProgressMs > duration) {
          this.localProgressMs = duration;
        }
        this.notify();
      }
    }, 100);
  }

  async fetchStatus() {
    try {
      const res = await fetch('/api/status');
      this.status = await res.json();
      return this.status;
    } catch (err) {
      console.error('[Spotify] fetchStatus error:', err);
    }
  }

  async fetchPlayback() {
    try {
      const res = await fetch('/api/playback');
      const data = await res.json();
      if (!data || Object.keys(data).length === 0) return;

      this.playback = data;
      this.isPlaying = Boolean(data.is_playing);
      this.localProgressMs = data.progress_ms || 0;
      this.lastFetchedAt = Date.now();

      // Check if track changed by title + artist or id
      const trackKey = data.item ? `${data.item.name}___${data.item.artists ? data.item.artists.map(a => a.name).join(' ') : (data.item.artist || '')}` : null;
      const trackChanged = trackKey && trackKey !== this.currentTrackKey;
      if (trackChanged) {
        this.currentTrackKey = trackKey;
        this.currentTrackId = data.item ? data.item.id : null;
      }

      this.notify();

      if (trackChanged && data.item) {
        window.dispatchEvent(new CustomEvent('trackchange', { detail: data.item }));
      }
    } catch (err) {
      console.warn('[Spotify] fetchPlayback error:', err);
    }
  }

  async play(params = {}) {
    this.isPlaying = true;
    try {
      await fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      setTimeout(() => this.fetchPlayback(), 300);
    } catch (err) {
      console.error(err);
    }
  }

  async pause() {
    this.isPlaying = false;
    try {
      await fetch('/api/pause', { method: 'POST' });
      setTimeout(() => this.fetchPlayback(), 300);
    } catch (err) {
      console.error(err);
    }
  }

  async togglePlay() {
    if (this.isPlaying) {
      await this.pause();
    } else {
      await this.play();
    }
  }

  async next() {
    try {
      await fetch('/api/next', { method: 'POST' });
      setTimeout(() => this.fetchPlayback(), 300);
    } catch (err) {
      console.error(err);
    }
  }

  async previous() {
    try {
      await fetch('/api/previous', { method: 'POST' });
      setTimeout(() => this.fetchPlayback(), 300);
    } catch (err) {
      console.error(err);
    }
  }

  async seek(positionMs) {
    this.localProgressMs = positionMs;
    this.notify();
    try {
      await fetch('/api/seek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_ms: positionMs })
      });
    } catch (err) {
      console.error(err);
    }
  }

  async setVolume(volumePercent) {
    if (this.playback && this.playback.device) {
      this.playback.device.volume_percent = volumePercent;
    }
    this.notify();
    try {
      await fetch('/api/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume_percent: volumePercent })
      });
    } catch (err) {
      console.error(err);
    }
  }

  async setShuffle(state) {
    if (this.playback) {
      this.playback.shuffle_state = state;
    }
    this.notify();
    try {
      await fetch('/api/shuffle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state })
      });
    } catch (err) {
      console.error(err);
    }
  }

  async setRepeat(state) {
    if (this.playback) {
      this.playback.repeat_state = state;
    }
    this.notify();
    try {
      await fetch('/api/repeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state })
      });
    } catch (err) {
      console.error(err);
    }
  }

  async getPlaylists() {
    try {
      const res = await fetch('/api/playlists');
      return await res.json();
    } catch (err) {
      return { items: [] };
    }
  }

  async getPlaylistTracks(playlistId) {
    try {
      const res = await fetch(`/api/playlist/tracks?id=${encodeURIComponent(playlistId)}`);
      return await res.json();
    } catch (err) {
      return { items: [] };
    }
  }

  async search(query, type = 'track,playlist,artist,album') {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`);
      return await res.json();
    } catch (err) {
      return { tracks: { items: [] }, playlists: { items: [] } };
    }
  }

  async getLyrics(title, artist, durationMs = 0) {
    try {
      const res = await fetch(`/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&duration=${durationMs}`);
      return await res.json();
    } catch (err) {
      return { syncedLyrics: null, plainLyrics: "Unable to load lyrics." };
    }
  }

  async getQueue() {
    try {
      const res = await fetch('/api/queue');
      return await res.json();
    } catch (err) {
      return { queue: [] };
    }
  }

  async addToQueue(uri, title, artist) {
    try {
      const res = await fetch('/api/queue/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri, title, artist })
      });
      return await res.json();
    } catch (err) {
      return { success: false };
    }
  }

  async saveConfig(cfg) {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg)
    });
    return await res.json();
  }

  async logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    await this.fetchStatus();
    await this.fetchPlayback();
  }

  async getAuthUrl() {
    const res = await fetch('/api/auth/url');
    return await res.json();
  }
}

window.spotify = new SpotifyService();
