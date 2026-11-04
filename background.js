/*
 * Service worker. Two jobs, both of which content scripts cannot do themselves:
 * dimming the toolbar icon per tab, and handling the extension's keyboard
 * shortcut.
 *
 * The manifest's default_icon is the muted variant, so any tab we never hear
 * from -- chrome:// pages, the web store, the PDF viewer -- shows a dimmed icon
 * without needing to be detected. A content script that goes active promotes its
 * own tab to the full-color icon.
 */

importScripts('site-presets.js');

// Only the extension popup can save a paid preset. Content scripts cannot supply
// an account, Customer ID, token, billing endpoint or a remote settings payload.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'focus:saveSitePreset') return false;
  if (sender.url !== chrome.runtime.getURL('popup.html')) return false;
  (async () => {
    const tab = await chrome.tabs.get(message.tabId);
    const host = hostOf(tab.url);
    if (!host) throw new Error('Open a web page to save its preset.');
    const profile = FocusPresets.normalize(message.profile);
    const { longplayCustomerToken } = await chrome.storage.session.get('longplayCustomerToken');
    if (!await FocusPresets.checkAccess(FocusPresets.config, longplayCustomerToken)) {
      throw new Error('Your account does not include site presets.');
    }
    const { siteProfiles = {} } = await chrome.storage.sync.get('siteProfiles');
    await chrome.storage.sync.set({ siteProfiles: { ...siteProfiles, [host]: profile } });
    sendResponse({ ok: true });
  })().catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

const DEFAULTS = {
  enabled: true,
  siteRules: {}
};

const ACTIVE_ICON = {
  16: 'icons/icon16.png',
  32: 'icons/icon32.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png'
};

const MUTED_ICON = {
  16: 'icons/icon16-off.png',
  32: 'icons/icon32-off.png',
  48: 'icons/icon48-off.png',
  128: 'icons/icon128-off.png'
};

function hostOf(url) {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'http:' && protocol !== 'https:') return null;
    return hostname;
  } catch {
    return null;
  }
}

function setTabIcon(tabId, isActive) {
  // Rejects if the tab closed between the report and this call, which is normal.
  chrome.action
    .setIcon({ tabId, path: isActive ? ACTIVE_ICON : MUTED_ICON })
    .catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message && message.type === 'focus:state' && sender.tab && sender.tab.id != null) {
    setTabIcon(sender.tab.id, Boolean(message.active));
  }
  return false;
});

// Reset to muted the moment a tab starts navigating. Without this, a tab that
// goes from an article to a page with no content script would keep the stale
// full-color icon, claiming to be active where nothing is running.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') setTabIcon(tabId, false);
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'toggle-site' || !tab || !tab.url) return;

  const host = hostOf(tab.url);
  if (!host) return;

  const { enabled, siteRules } = await chrome.storage.sync.get(DEFAULTS);
  const activeHere = enabled && siteRules[host] !== 'off';

  if (activeHere) {
    siteRules[host] = 'off';
    await chrome.storage.sync.set({ siteRules });
  } else {
    // "Make it work here": clear this site's block and lift the master switch if
    // that was what was holding it back. Pressing the shortcut should always
    // change what you are looking at.
    delete siteRules[host];
    await chrome.storage.sync.set({ enabled: true, siteRules });
  }
});
