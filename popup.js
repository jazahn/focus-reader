const DEFAULTS = {
  enabled: true,
  intensity: 0.5,
  strength: 0.03,
  minBlockChars: 40,
  maxLinkDensity: 0.5,
  siteRules: {}
};

const el = (id) => document.getElementById(id);

let settings = { ...DEFAULTS };
let host = null;
let tabId = null;

// Absence of a rule means enabled: the master switch is the thing that turns
// everything off, and per-site rules only ever subtract from it.
function siteEnabled() {
  return host ? settings.siteRules[host] !== 'off' : true;
}

function render() {
  el('enabled').checked = settings.enabled;
  el('siteEnabled').checked = siteEnabled();
  el('intensity').value = settings.intensity;
  el('strength').value = settings.strength;
  el('minBlockChars').value = settings.minBlockChars;

  el('intensityOut').textContent = `${Math.round(settings.intensity * 100)}%`;
  el('strengthOut').textContent = settings.strength.toFixed(3).replace(/0+$/, '');
  el('minBlockOut').textContent = `${settings.minBlockChars} chars`;
  el('host').textContent = host || 'this site';

  const masterOff = !settings.enabled;
  el('panel').dataset.disabled = String(masterOff);
  el('siteEnabled').disabled = masterOff || !host;
  for (const id of ['intensity', 'strength', 'minBlockChars']) {
    el(id).disabled = masterOff;
  }
}

function setStatus(text, { error = false } = {}) {
  el('status').textContent = text;
  el('status').classList.toggle('error', error);
}

async function askPage() {
  if (tabId == null) return null;
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'focus:getState' });
  } catch {
    // No content script here: chrome:// pages, the web store, the PDF viewer.
    return null;
  }
}

async function refreshStatus() {
  if (!settings.enabled) {
    setStatus('Off everywhere.');
    return;
  }
  if (!siteEnabled()) {
    setStatus(`Off on ${host}.`);
    return;
  }

  const state = await askPage();
  if (!state) {
    setStatus('This page cannot be modified by extensions.');
    return;
  }
  if (!state.supported) {
    el('unsupported').hidden = false;
    el('panel').hidden = true;
    setStatus('');
    return;
  }
  setStatus(
    state.active
      ? `${state.wordCount.toLocaleString()} words emphasized on this page.`
      : 'Inactive on this page.'
  );
}

/* ------------------------------------------------------------------ *
 * Persistence
 *
 * chrome.storage.sync rate-limits writes (120 per minute at the time of
 * writing). A range input fires `input` on every step of a drag, so a few
 * minutes of tuning the sliders used to exhaust that quota -- after which the
 * next write, typically the master switch, was rejected and silently dropped.
 * The popup had already flipped its own copy of the state, so it showed "off"
 * while every open tab stayed on (GitHub issue #4).
 *
 * Two defenses: slider changes are coalesced into one write per pause, and a
 * write that fails reloads the real stored state so the popup never claims a
 * state that did not land.
 * ------------------------------------------------------------------ */

const SLIDER_DEBOUNCE_MS = 150;

let pending = {};
let flushTimer = 0;
let statusTimer = 0;

async function flush() {
  clearTimeout(flushTimer);
  flushTimer = 0;

  const patch = pending;
  pending = {};
  if (!Object.keys(patch).length) return;

  try {
    await chrome.storage.sync.set(patch);
  } catch {
    settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
    render();
    setStatus('Could not save. Chrome limits how often settings sync; try again in a minute.', {
      error: true
    });
    return;
  }

  // The page rebuilds on a 200ms debounce; wait past it so the word count we
  // show is the new one rather than the count we just invalidated.
  clearTimeout(statusTimer);
  statusTimer = setTimeout(refreshStatus, 350);
}

// Applies `patch` to the UI at once and persists it -- immediately for
// switches, coalesced for sliders. Whatever is still pending rides along with
// the next write, so a switch flipped mid-drag commits the slider too.
function save(patch, { debounce = 0 } = {}) {
  settings = { ...settings, ...patch };
  Object.assign(pending, patch);
  render();

  clearTimeout(flushTimer);
  if (debounce) flushTimer = setTimeout(flush, debounce);
  else flush();
}

function bindSlider(id, key, parse = parseFloat) {
  el(id).addEventListener('input', (event) => {
    save({ [key]: parse(event.target.value) }, { debounce: SLIDER_DEBOUNCE_MS });
  });
}

async function init() {
  settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id != null) {
    tabId = tab.id;
    try {
      const url = new URL(tab.url);
      if (url.protocol === 'http:' || url.protocol === 'https:') host = url.hostname;
    } catch {
      /* opaque or missing URL; leave host null */
    }
  }

  render();
  refreshStatus();

  el('enabled').addEventListener('change', (event) => {
    save({ enabled: event.target.checked });
  });

  el('siteEnabled').addEventListener('change', (event) => {
    if (!host) return;
    const siteRules = { ...settings.siteRules };
    if (event.target.checked) delete siteRules[host];
    else siteRules[host] = 'off';
    save({ siteRules });
  });

  bindSlider('intensity', 'intensity');
  bindSlider('strength', 'strength');
  bindSlider('minBlockChars', 'minBlockChars', (v) => parseInt(v, 10));

  // The popup closes the instant it loses focus. A slider value still waiting
  // out its debounce would be lost; the set() call is dispatched synchronously
  // even though its promise never gets to resolve.
  window.addEventListener('pagehide', () => {
    if (flushTimer) flush();
  });
}

init();
