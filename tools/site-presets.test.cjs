const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../site-presets.js'), 'utf8');
const context = vm.createContext({ URL, AbortSignal, fetch });
vm.runInContext(source, context);
const api = context.FocusPresets;
const merchant = { baseUrl: 'https://billing.invalid', projectId: 'app', environment: 'sandbox',
  featureId: '11111111-1111-4111-8111-111111111111' };
const token = 'gg_ct_' + 'x'.repeat(43);
const grant = (allowed = true) => ({ scope: { projectId: 'app', environment: 'sandbox' },
  check: { internal_feature_id: merchant.featureId, kind: 'access', allowed } });
const response = (body, protocol = '0.10') => new Response(JSON.stringify(body), {
  headers: { 'Content-Type': 'application/json', 'X-Indiana-Protocol': protocol } });

test('default pilot and invalid credentials never contact billing', async () => {
  assert.equal(api.config, null);
  const noNetwork = () => { throw new Error('must not fetch'); };
  await assert.rejects(api.checkAccess(null, token, noNetwork), /not connected/);
  await assert.rejects(api.checkAccess(merchant, 'gg_sk_server', noNetwork), /Connect/);
  await assert.rejects(api.checkAccess({ ...merchant, baseUrl: 'http://insecure.invalid' }, token, noNetwork), /not configured/);
});

test('checks only the token identity and configured Feature without page data', async () => {
  assert.equal(await api.checkAccess(merchant, token, async (url, options) => {
    assert.equal(String(url), 'https://billing.invalid/api/v1/entitlements/check');
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit');
    assert.deepEqual(JSON.parse(options.body), { requirement: {
      internal_feature_id: merchant.featureId, quantity: '1', properties: {} } });
    return response(grant());
  }), true);
  assert.equal(await api.checkAccess(merchant, token, async () => response(grant(false))), false);
});

test('revocation, wrong App/environment/protocol/Feature kind and network failure are closed', async () => {
  for (const mutate of [r => { r.scope.projectId = 'other'; }, r => { r.scope.environment = 'live'; },
    r => { r.check.internal_feature_id = 'other'; }, r => { r.check.kind = 'credit'; },
    r => { r.check.allowed = 'true'; }]) {
    const result = grant(); mutate(result);
    await assert.rejects(api.checkAccess(merchant, token, async () => response(result)), /Could not verify/);
  }
  await assert.rejects(api.checkAccess(merchant, token, async () => response(grant(), 'wrong')), /Could not verify/);
  await assert.rejects(api.checkAccess(merchant, token, async () => { throw new Error('private provider diagnostic'); }), /Could not verify/);
});

test('exact-host formatting does not alter global settings or site switches', () => {
  const settings = { enabled: true, intensity: 0.5, strength: 0.03, minBlockChars: 40, siteRules: { 'example.com': 'off' },
    siteProfiles: { 'example.com': { intensity: 0.7, strength: 0.04, minBlockChars: 50, enabled: true } } };
  const effective = api.settingsFor(settings, 'example.com');
  assert.equal(effective.intensity, 0.7);
  assert.equal(effective.siteRules['example.com'], 'off');
  assert.equal(settings.intensity, 0.5);
  assert.equal(api.settingsFor(settings, 'other.example.com'), settings);
  assert.equal(api.settingsFor({ ...settings, siteProfiles: { 'example.com': { intensity: NaN } } }, 'example.com').intensity, 0.5);
});

test('background denies save before any storage mutation and ignores content-script requests', async () => {
  const listeners = [];
  let writes = 0;
  let stored;
  let allowed = false;
  const chrome = {
    runtime: { getURL: path => `chrome-extension://test/${path}`, onMessage: { addListener: fn => listeners.push(fn) } },
    tabs: { get: async () => ({ url: 'https://example.com/private-article' }), onUpdated: { addListener() {} } },
    commands: { onCommand: { addListener() {} } },
    storage: { session: { get: async () => ({ longplayCustomerToken: token }) },
      sync: { get: async () => ({ siteProfiles: { 'keep.example': { intensity: 0.3, strength: 0.02, minBlockChars: 10 } } }),
        set: async value => { writes++; stored = value; } } }
  };
  const ctx = vm.createContext({ chrome, URL, importScripts() {}, FocusPresets: {
    normalize: api.normalize, config: merchant, checkAccess: async () => allowed } });
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../background.js'), 'utf8'), ctx);
  const message = { type: 'focus:saveSitePreset', tabId: 1, profile: { intensity: 0.5, strength: 0.03, minBlockChars: 40 } };
  assert.equal(listeners[0](message, { url: 'https://example.com' }, () => { throw new Error('unexpected response'); }), false);
  const result = await new Promise(resolve => listeners[0](message, { url: chrome.runtime.getURL('popup.html') }, resolve));
  assert.equal(result.ok, false);
  assert.match(result.error, /account does not include/);
  assert.equal(writes, 0);
  allowed = true;
  const saved = await new Promise(resolve => listeners[0]({ ...message, host: 'attacker.example' },
    { url: chrome.runtime.getURL('popup.html') }, resolve));
  assert.equal(saved.ok, true);
  assert.equal(writes, 1);
  assert.equal(stored.siteProfiles['example.com'].intensity, 0.5);
  assert.ok(stored.siteProfiles['keep.example']);
  assert.equal(stored.siteProfiles['attacker.example'], undefined);
});
