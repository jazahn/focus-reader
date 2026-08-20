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
    el('status').textContent = 'Off everywhere.';
    return;
  }
  if (!siteEnabled()) {
    el('status').textContent = `Off on ${host}.`;
    return;
  }

  const state = await askPage();
  if (!state) {
    el('status').textContent = 'This page cannot be modified by extensions.';
    return;
  }
  if (!state.supported) {
    el('unsupported').hidden = false;
    el('panel').hidden = true;
    el('status').textContent = '';
    return;
  }
  el('status').textContent = state.active
    ? `${state.wordCount.toLocaleString()} words emphasized on this page.`
    : 'Inactive on this page.';
}

let statusTimer = 0;

async function save(patch) {
  settings = { ...settings, ...patch };
  await chrome.storage.sync.set(patch);
  render();

  // The page rebuilds on a 200ms debounce; wait past it so the word count we
  // show is the new one rather than the count we just invalidated.
  clearTimeout(statusTimer);
  statusTimer = setTimeout(refreshStatus, 350);
}

function bindSlider(id, key, parse = parseFloat) {
  el(id).addEventListener('input', (event) => {
    save({ [key]: parse(event.target.value) });
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
}

init();
