/**
 * Synced Lyrics Engine for Spotify Tablet Deck
 * Handles LRC format parsing, timing sync, auto-scroll, and click-to-seek
 */

class LyricsManager {
  constructor(containerEl, fullscreenContainerEl, onSeekCallback) {
    this.container = containerEl;
    this.fsContainer = fullscreenContainerEl;
    this.onSeek = onSeekCallback;
    this.lines = [];
    this.activeIndex = -1;
    this.isSynced = false;
    this.isUserScrolling = false;
    this.scrollTimeout = null;

    if (this.container) {
      this.container.addEventListener('scroll', () => this.handleUserScroll());
    }
    if (this.fsContainer) {
      this.fsContainer.addEventListener('scroll', () => this.handleUserScroll());
    }
  }

  handleUserScroll() {
    this.isUserScrolling = true;
    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => {
      this.isUserScrolling = false;
    }, 2500);
  }

  parseLRC(lrcText) {
    this.lines = [];
    if (!lrcText) return;

    const rawLines = lrcText.split('\n');
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    for (let raw of rawLines) {
      raw = raw.trim();
      if (!raw) continue;

      let match;
      let hasMatch = false;
      let text = raw.replace(timeRegex, '').trim();

      // Reset regex index
      timeRegex.lastIndex = 0;
      while ((match = timeRegex.exec(raw)) !== null) {
        hasMatch = true;
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const millis = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
        const timeMs = minutes * 60 * 1000 + seconds * 1000 + millis;

        this.lines.push({
          timeMs: timeMs,
          text: text || "♪"
        });
      }

      if (!hasMatch && text) {
        // Plain lyric line
        this.lines.push({
          timeMs: null,
          text: text
        });
      }
    }

    // Sort by timestamp
    this.lines.sort((a, b) => {
      if (a.timeMs === null) return 1;
      if (b.timeMs === null) return -1;
      return a.timeMs - b.timeMs;
    });

    this.isSynced = this.lines.some(l => l.timeMs !== null);
  }

  loadLyrics(lrcText, plainText) {
    this.activeIndex = -1;
    if (lrcText) {
      this.parseLRC(lrcText);
    } else if (plainText) {
      this.lines = plainText.split('\n').filter(l => l.trim()).map(t => ({ timeMs: null, text: t.trim() }));
      this.isSynced = false;
    } else {
      this.lines = [{ timeMs: null, text: "No lyrics available for this track" }];
      this.isSynced = false;
    }

    this.render();
  }

  render() {
    const buildHTML = (isFs = false) => {
      return this.lines.map((l, idx) => {
        const cls = isFs ? 'fs-lyric-line' : 'lyric-line';
        return `<div class="${cls}" data-idx="${idx}" data-time="${l.timeMs !== null ? l.timeMs : ''}">${escapeHtml(l.text)}</div>`;
      }).join('');
    };

    if (this.container) {
      this.container.innerHTML = buildHTML(false);
      this.attachClickHandlers(this.container);
    }

    if (this.fsContainer) {
      this.fsContainer.innerHTML = buildHTML(true);
      this.attachClickHandlers(this.fsContainer);
    }
  }

  attachClickHandlers(wrapper) {
    const els = wrapper.querySelectorAll('.lyric-line, .fs-lyric-line');
    els.forEach(el => {
      el.addEventListener('click', () => {
        const time = el.getAttribute('data-time');
        if (time && this.onSeek) {
          const ms = parseInt(time, 10);
          this.onSeek(ms);
          this.updateSync(ms, true);
        }
      });
    });
  }

  updateSync(currentMs, forceScroll = false) {
    if (!this.isSynced || this.lines.length === 0) return;

    // Find current active line
    let newIndex = -1;
    for (let i = 0; i < this.lines.length; i++) {
      if (this.lines[i].timeMs !== null && currentMs >= this.lines[i].timeMs) {
        newIndex = i;
      } else if (this.lines[i].timeMs !== null && currentMs < this.lines[i].timeMs) {
        break;
      }
    }

    if (newIndex === -1 && this.lines.length > 0) {
      newIndex = 0;
    }

    if (newIndex !== this.activeIndex || forceScroll) {
      this.activeIndex = newIndex;
      this.highlight(this.container, false, forceScroll);
      this.highlight(this.fsContainer, true, forceScroll);
    }
  }

  highlight(wrapper, isFs, forceScroll) {
    if (!wrapper) return;
    const items = wrapper.querySelectorAll(isFs ? '.fs-lyric-line' : '.lyric-line');

    items.forEach((item, idx) => {
      if (idx === this.activeIndex) {
        item.classList.add('active');
        item.classList.remove('past');

        // Scroll into view if user isn't manually scrolling
        if (!this.isUserScrolling || forceScroll) {
          item.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      } else if (idx < this.activeIndex) {
        item.classList.remove('active');
        item.classList.add('past');
      } else {
        item.classList.remove('active');
        item.classList.remove('past');
      }
    });
  }
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}
