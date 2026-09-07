// Node/CommonJS port of fello-frontend/lib/google.ts's getOrgAccessToken, for
// use by the Drive sync pipeline (src/drive-sync.js). Same source of truth:
// Firestore google_integrations/{orgId} (connected, accessToken, refreshToken,
// expiresAt, scopes, email), refreshed via the standard OAuth2 token endpoint
// using the same GOOGLE_OAUTH_CLIENT_ID/SECRET env vars used elsewhere.

const { adminDb } = require('./firebase');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function expired(expiresAt) {
  if (!expiresAt) return true;
  const ms = typeof expiresAt === 'number' ? expiresAt : Date.parse(String(expiresAt));
  if (Number.isNaN(ms)) return true;
  return Date.now() >= ms - 60_000;
}

/**
 * Return a usable access token for the org's connected Google account,
 * refreshing (and persisting the refresh) if the cached token has expired.
 * Returns { token, error } — never throws.
 */
async function getOrgAccessToken(orgId) {
  const ref = adminDb().collection('google_integrations').doc(orgId);
  const snap = await ref.get();
  const integ = snap.exists ? snap.data() : null;

  if (!integ || !integ.connected) {
    return { error: 'No Google account is connected for this organization. Connect one in Settings.' };
  }
  if (integ.accessToken && !expired(integ.expiresAt)) {
    return { token: integ.accessToken };
  }
  if (!integ.refreshToken) {
    if (integ.accessToken) return { token: integ.accessToken };
    return { error: 'The connected Google account needs to be reconnected in Settings.' };
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { error: 'Google OAuth client is not configured on the server.' };
  }

  let res;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: integ.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
  } catch (err) {
    return { error: `Token refresh request failed: ${err.message}` };
  }
  if (!res.ok) {
    return { error: `Token refresh failed (${res.status}): ${(await res.text()).slice(0, 300)}` };
  }
  const data = await res.json();
  const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;

  await ref.update({ accessToken: data.access_token, expiresAt });

  return { token: data.access_token };
}

module.exports = { getOrgAccessToken };
