const songs = [
  { title: 'Kesariya', artist: 'Arijit Singh', artwork: '♪', source: { type: 'youtube', authorized: true, videoId: 'NJAv_7lHUIU' } },
  { title: 'Tum Hi Ho', artist: 'Arijit Singh', artwork: '♫', source: { type: 'youtube', authorized: true, videoId: 'Umqb9KENgmk' } },
  { title: 'Chaleya', artist: 'Arijit Singh, Shilpa Rao', artwork: '✦', source: { type: 'unavailable', reason: 'No verified playback source is configured yet.' } },
  { title: 'Apna Bana Le', artist: 'Arijit Singh', artwork: '♪', source: { type: 'unavailable', reason: 'No verified playback source is configured yet.' } },
  { title: 'O Maahi', artist: 'Arijit Singh', artwork: '♫', source: { type: 'youtube', authorized: true, videoId: 'Zlqf9cuaOBw' } },
  { title: 'Tujhe Kitna Chahne Lage', artist: 'Arijit Singh', artwork: '✦', source: { type: 'unavailable', reason: 'No verified playback source is configured yet.' } },
  { title: 'Satranga', artist: 'Arijit Singh', artwork: '♪', source: { type: 'unavailable', reason: 'No verified playback source is configured yet.' } },
  { title: 'Ve Kamleya', artist: 'Arijit Singh, Shreya Ghoshal', artwork: '♫', source: { type: 'unavailable', reason: 'No verified playback source is configured yet.' } }
];

// Playback sources must be explicitly authorized. Never create IDs or audio URLs
// from client-side search results, and never extract/re-host protected audio.

const $ = id => document.getElementById(id);
const sourceLabels = { youtube: 'YouTube', licensed: 'Licensed', owned: 'Owned', creative_commons: 'Creative Commons', unavailable: 'Unavailable' };
let toastTimer;

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function formatTime(seconds) {
  const time = Math.floor(Number(seconds) || 0);
  return `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
}

function authorizedSource(song) {
  const { source } = song;
  if (!source.authorized) return false;
  if (source.type === 'youtube') return typeof source.videoId === 'string' && /^[\w-]{11}$/.test(source.videoId);
  if (['licensed', 'owned', 'creative_commons'].includes(source.type)) return Boolean(source.audioUrl);
  return false;
}

class YouTubeAdapter {
  constructor(onUpdate) {
    this.player = null;
    this.ready = false;
    this.loading = null;
    this.onUpdate = onUpdate;
  }

  loadApi() {
    if (window.YT?.Player) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => reject(new Error('The YouTube player could not be loaded.'));
      window.onYouTubeIframeAPIReady = () => resolve();
      document.head.append(script);
    });
    return this.loading;
  }

  async play(source) {
    await this.loadApi();
    if (!this.player) {
      await new Promise(resolve => {
        this.player = new window.YT.Player('youtubePlayer', {
          videoId: source.videoId,
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => { this.ready = true; resolve(); },
            onStateChange: event => this.handleState(event.data),
            onError: event => this.onUpdate({ status: 'error', error: `YouTube could not play this video (error ${event.data}).` })
          }
        });
      });
    } else {
      this.player.loadVideoById(source.videoId);
    }
    this.player.playVideo();
  }

  handleState(state) {
    const YT = window.YT?.PlayerState;
    if (state === YT?.PLAYING) this.onUpdate({ status: 'playing' });
    if (state === YT?.PAUSED) this.onUpdate({ status: 'paused' });
    if (state === YT?.BUFFERING) this.onUpdate({ status: 'loading' });
    if (state === YT?.ENDED) this.onUpdate({ status: 'ended' });
  }

  pause() { this.player?.pauseVideo(); }
  resume() { this.player?.playVideo(); }
  seek(seconds) { this.player?.seekTo(seconds, true); }
  volume(value) { this.player?.setVolume(value); }
  metrics() { return { currentTime: this.player?.getCurrentTime?.() || 0, duration: this.player?.getDuration?.() || 0 }; }
}

class NativeAudioAdapter {
  constructor(onUpdate) {
    this.audio = new Audio();
    this.onUpdate = onUpdate;
    this.audio.addEventListener('playing', () => onUpdate({ status: 'playing' }));
    this.audio.addEventListener('pause', () => onUpdate({ status: 'paused' }));
    this.audio.addEventListener('waiting', () => onUpdate({ status: 'loading' }));
    this.audio.addEventListener('ended', () => onUpdate({ status: 'ended' }));
    this.audio.addEventListener('error', () => onUpdate({ status: 'error', error: 'The authorized audio source could not be played.' }));
  }
  async play(source) { if (this.audio.src !== source.audioUrl) this.audio.src = source.audioUrl; await this.audio.play(); }
  pause() { this.audio.pause(); }
  resume() { return this.audio.play(); }
  seek(seconds) { this.audio.currentTime = seconds; }
  volume(value) { this.audio.volume = value / 100; }
  metrics() { return { currentTime: this.audio.currentTime || 0, duration: this.audio.duration || 0 }; }
}

class PlaybackController {
  constructor() {
    this.current = -1;
    this.status = 'idle';
    this.adapter = null;
    this.timer = null;
    this.volume = 80;
    this.youtube = new YouTubeAdapter(update => this.sourceUpdate(update));
    this.native = new NativeAudioAdapter(update => this.sourceUpdate(update));
  }

  sourceUpdate(update) {
    this.status = update.status;
    if (update.status === 'ended') return this.next();
    if (update.status === 'error') showToast(update.error);
    this.render();
  }

  async select(index) {
    const song = songs[index];
    this.current = index;
    this.status = 'loading';
    this.render();
    if (!authorizedSource(song)) {
      this.status = 'unavailable';
      this.render();
      showToast('Playback unavailable for this song.');
      return;
    }
    this.adapter = song.source.type === 'youtube' ? this.youtube : this.native;
    try {
      await this.adapter.play(song.source);
      this.adapter.volume(this.volume);
    } catch (error) {
      this.status = 'error';
      this.render();
      showToast(error.message || 'Playback could not be started.');
    }
  }

  toggle() {
    if (this.current < 0) return this.select(0);
    if (!this.adapter || !authorizedSource(songs[this.current])) return showToast('Playback unavailable for this song.');
    return this.status === 'playing' ? this.adapter.pause() : this.adapter.resume();
  }
  next() { return this.select((this.current + 1 + songs.length) % songs.length); }
  previous() { return this.select((this.current - 1 + songs.length) % songs.length); }
  seek(percent) { const { duration } = this.adapter?.metrics() || {}; if (duration) this.adapter.seek(duration * percent / 100); }
  setVolume(value) { this.volume = Number(value); this.adapter?.volume(this.volume); }
  tick() { this.renderProgress(); }
  start() { this.timer = setInterval(() => this.tick(), 500); }

  render() {
    const song = songs[this.current];
    const playable = song && authorizedSource(song);
    $('playerTitle').textContent = song?.title || 'Select a song';
    $('playerArtist').textContent = song ? `${song.artist} · ${sourceLabels[song.source.type]}` : 'Choose an authorized source';
    $('playerCover').textContent = song?.artwork || '♪';
    $('playBtn').textContent = this.status === 'playing' ? 'Ⅱ' : '▶';
    $('playBtn').disabled = Boolean(song && !playable);
    $('playBtn').setAttribute('aria-label', this.status === 'playing' ? 'Pause' : 'Play');
    $('playerState').textContent = this.status === 'loading' ? 'Loading source…' : this.status === 'unavailable' ? 'Playback unavailable' : this.status === 'error' ? 'Playback error' : playable ? sourceLabels[song.source.type] : 'Ready';
    $('player').dataset.status = this.status;
    $('stage').hidden = song?.source.type !== 'youtube' || !playable;
    $('stageMessage').hidden = !song || playable;
    if (song && !playable) $('stageMessage').textContent = `Playback unavailable for “${song.title}”. ${song.source.reason || ''}`;
    this.renderProgress();
  }

  renderProgress() {
    const { currentTime, duration } = this.adapter?.metrics() || { currentTime: 0, duration: 0 };
    $('timeLabel').textContent = formatTime(currentTime);
    $('durationLabel').textContent = formatTime(duration);
    $('progressRange').disabled = !duration;
    if (duration && document.activeElement !== $('progressRange')) $('progressRange').value = currentTime / duration * 100;
  }
}

const playback = new PlaybackController();

function renderSongs(list = songs) {
  $('results').innerHTML = list.map(song => {
    const index = songs.indexOf(song);
    const available = authorizedSource(song);
    return `<article class="song-card${available ? '' : ' unavailable'}" data-index="${index}" tabindex="0" role="button" aria-label="${available ? 'Play' : 'Playback unavailable for'} ${song.title}">
      <div class="cover">${song.artwork}</div><div class="song-title">${song.title}</div><div class="song-artist">${song.artist}</div>
      <span class="source-badge">${available ? sourceLabels[song.source.type] : 'Unavailable'}</span></article>`;
  }).join('');
  document.querySelectorAll('.song-card').forEach(card => {
    const play = () => playback.select(Number(card.dataset.index));
    card.addEventListener('click', play);
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); play(); } });
  });
}

$('playBtn').addEventListener('click', () => playback.toggle());
$('nextBtn').addEventListener('click', () => playback.next());
$('prevBtn').addEventListener('click', () => playback.previous());
$('progressRange').addEventListener('input', event => playback.seek(event.target.value));
$('volumeRange').addEventListener('input', event => playback.setVolume(event.target.value));
$('exploreBtn').addEventListener('click', () => { $('searchInput').focus(); $('search').scrollIntoView({ behavior: 'smooth' }); });
$('clearSearch').addEventListener('click', () => { $('searchInput').value = ''; renderSongs(); });
$('searchInput').addEventListener('input', event => {
  const query = event.target.value.trim().toLowerCase();
  renderSongs(query ? songs.filter(song => `${song.title} ${song.artist}`.toLowerCase().includes(query)) : songs);
});
document.querySelectorAll('.mood-card').forEach(button => button.addEventListener('click', () => {
  $('searchInput').value = button.dataset.query;
  renderSongs([]);
  showToast('Mood search needs an authorized catalogue search provider.');
  $('search').scrollIntoView({ behavior: 'smooth' });
}));
$('queueBtn').addEventListener('click', () => $('queuePanel').classList.toggle('open'));
$('closeQueue').addEventListener('click', () => $('queuePanel').classList.remove('open'));
$('queueList').innerHTML = songs.map((song, index) => `<button data-index="${index}"><span>${song.title}</span><small>${sourceLabels[song.source.type]}</small></button>`).join('');
document.querySelectorAll('#queueList button').forEach(button => button.addEventListener('click', () => { playback.select(Number(button.dataset.index)); $('queuePanel').classList.remove('open'); }));

renderSongs();
playback.start();
