/* Plain MV3 code: no remote scripts, server key, package manager or bundler. */
(() => {
  'use strict';
  // Merchant-owned public configuration. Leave null until account handoff is available.
  // { baseUrl: 'https://api.longplayai.com', projectId: '...', environment: 'sandbox', featureId: '<UUID>' }
  const config = null;
  const featurePattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

  function normalize(value) {
    const ranges = { intensity: [0.2, 0.8], strength: [0.01, 0.08], minBlockChars: [0, 200] };
    const result = {};
    for (const [key, [min, max]] of Object.entries(ranges)) {
      const number = value?.[key];
      if (!Number.isFinite(number) || number < min || number > max) throw new Error('Invalid site preset.');
      result[key] = number;
    }
    return result;
  }

  function settingsFor(settings, host) {
    try {
      const profile = Object.hasOwn(settings.siteProfiles || {}, host) && settings.siteProfiles[host];
      return profile ? { ...settings, ...normalize(profile) } : settings;
    } catch { return settings; }
  }

  async function checkAccess(merchant, token, request = fetch) {
    if (!merchant) throw new Error('Site presets are not connected to billing yet.');
    const url = new URL(merchant.baseUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
        !merchant.projectId || !['sandbox', 'live'].includes(merchant.environment) || !featurePattern.test(merchant.featureId)) {
      throw new Error('Site preset billing is not configured.');
    }
    if (!/^gg_ct_[A-Za-z0-9_-]{32,128}$/.test(token || '')) throw new Error('Connect your account to save a site preset.');
    try {
      const response = await request(new URL('/api/v1/entitlements/check', url), {
        method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(5000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`,
          'X-Indiana-Protocol': '0.10', 'X-Indiana-Project': merchant.projectId, 'X-Indiana-Environment': merchant.environment },
        body: JSON.stringify({ requirement: { internal_feature_id: merchant.featureId, quantity: '1', properties: {} } })
      });
      if (response.status === 401) throw new Error('Connect your account to save a site preset.');
      if (!response.ok || response.headers.get('X-Indiana-Protocol') !== '0.10') throw new Error('Unavailable');
      const result = await response.json();
      if (result.scope?.projectId !== merchant.projectId || result.scope?.environment !== merchant.environment ||
          result.check?.internal_feature_id !== merchant.featureId || result.check.kind !== 'access' ||
          typeof result.check.allowed !== 'boolean') throw new Error('Unavailable');
      return result.check.allowed;
    } catch {
      throw new Error('Could not verify site preset access. Connect your account or try again later.');
    }
  }

  globalThis.FocusPresets = { config, normalize, settingsFor, checkAccess };
})();
