// Replaces FirebaseConfig.js + scattered firebase/* SDK calls across the app
// with calls to the self-hosted server (server/). Also centralizes "who's
// logged in" as a stored token+email pair instead of threading `email`
// through every screen's route.params (that threading was the source of the
// `params.email.email` / `this.props.param.email` bugs found while migrating).
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'al_token';
const EMAIL_KEY = 'al_email';

async function setSession(token, email) {
  await AsyncStorage.multiSet([[TOKEN_KEY, token], [EMAIL_KEY, email]]);
}

async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, EMAIL_KEY]);
}

async function getEmail() {
  return AsyncStorage.getItem(EMAIL_KEY);
}

async function request(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // An expired/invalid token would otherwise loop forever: boot would keep
    // finding a token in storage (see api.isLoggedIn, used by Routes.js) and
    // skip straight past Login into screens that then fail every request.
    // Clearing it here means the next launch correctly falls back to Login.
    if (auth && res.status === 401) await clearSession();
    const err = new Error(data.error || `request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function uploadToR2(uploadUrl, blob, contentType) {
  const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
}

export const api = {
  getEmail,

  // Checked once at boot (Routes.js) so a returning user with a still-valid
  // stored token skips Login entirely - no network call needed to know
  // you're "still logged in". A stale/expired token still gets caught (and
  // cleared) the first time it's actually used against the server, above.
  async isLoggedIn() {
    return !!(await AsyncStorage.getItem(TOKEN_KEY));
  },

  async signup(email, password) {
    const data = await request('/auth/signup', { method: 'POST', body: { email, password }, auth: false });
    await setSession(data.token, data.email);
    return data;
  },

  async login(email, password) {
    const data = await request('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    await setSession(data.token, data.email);
    return data;
  },

  async logout() {
    await clearSession();
  },

  createSketch(name, clientId) {
    return request('/sketches', { method: 'POST', body: { name, clientId } });
  },
  listSketches() {
    return request('/sketches');
  },
  getSketch(id) {
    return request(`/sketches/${id}`);
  },
  updateSketch(id, fields) {
    return request(`/sketches/${id}`, { method: 'PATCH', body: fields });
  },
  deleteSketch(id) {
    return request(`/sketches/${id}`, { method: 'DELETE' });
  },
  deleteAllSketches() {
    return request('/sketches', { method: 'DELETE' });
  },
  getUploadUrl(sketchId, field, contentType) {
    return request(`/sketches/${sketchId}/upload-url`, { method: 'POST', body: { field, contentType } });
  },
  enhance(sketchId, { signal, instruction } = {}) {
    return request('/enhance', { method: 'POST', body: { sketchId, instruction }, signal });
  },
  submitCorrections(sketchId, corrections) {
    return request('/corrections', { method: 'POST', body: { sketchId, corrections } });
  },
};
