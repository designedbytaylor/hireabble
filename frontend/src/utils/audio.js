/**
 * Audio service using the Web Audio API.
 * Preloads short sound effects into AudioBuffers for instant, low-latency playback.
 * Works on both web and iOS WKWebView. No native plugin required.
 */

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

let _ctx = null;
const _buffers = {};
let _muted = typeof localStorage !== 'undefined'
  ? localStorage.getItem('hireabble_sound_muted') === 'true'
  : false;
let _initialized = false;

/**
 * Create or resume the AudioContext.
 * Must be called from a user gesture on iOS WebKit.
 */
function init() {
  if (_ctx && _ctx.state === 'running') return;
  if (!_ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    _ctx = new AudioCtx();
  }
  if (_ctx.state === 'suspended') {
    _ctx.resume().catch(() => {});
  }
  _initialized = true;
}

/**
 * Fetch and decode an audio file into a reusable AudioBuffer.
 * @param {string} name - Identifier for the sound (e.g. 'match')
 * @param {string} url  - URL of the audio file
 */
async function preload(name, url) {
  if (_buffers[name]) return;
  try {
    init();
    if (!_ctx) return;
    const response = await fetch(url);
    if (!response.ok) return;
    const arrayBuffer = await response.arrayBuffer();
    _buffers[name] = await _ctx.decodeAudioData(arrayBuffer);
  } catch {
    // Silently fail — audio is a nice-to-have, not critical
  }
}

/**
 * Play a preloaded sound immediately.
 * @param {string} name - Identifier that was used in preload()
 */
function play(name) {
  if (_muted || !_ctx || !_buffers[name]) return;
  // Ensure context is resumed (may have been suspended by iOS)
  if (_ctx.state === 'suspended') {
    _ctx.resume().catch(() => {});
  }
  try {
    const source = _ctx.createBufferSource();
    source.buffer = _buffers[name];
    source.connect(_ctx.destination);
    source.start(0);
  } catch {
    // Playback failed — not critical
  }
}

/**
 * Mute or unmute all sounds. Persisted to localStorage.
 * @param {boolean} muted
 */
function setMuted(muted) {
  _muted = muted;
  try {
    localStorage.setItem('hireabble_sound_muted', String(muted));
  } catch {}
}

/** @returns {boolean} */
function isMuted() {
  return _muted;
}

/**
 * Resolve the match sound URL: admin-uploaded custom sound or bundled default.
 * @returns {Promise<string>}
 */
async function getMatchSoundUrl() {
  try {
    const res = await fetch(`${API}/settings/match-sound`);
    if (res.ok) {
      const data = await res.json();
      if (data.url) return data.url;
    }
  } catch {
    // Fall through to default
  }
  return '/sounds/match.wav';
}

/**
 * Convenience: preload the match sound (resolves admin override vs default).
 */
async function preloadMatchSound() {
  const url = await getMatchSoundUrl();
  await preload('match', url);
}

const audioService = {
  init,
  preload,
  play,
  setMuted,
  isMuted,
  getMatchSoundUrl,
  preloadMatchSound,
};

export default audioService;
