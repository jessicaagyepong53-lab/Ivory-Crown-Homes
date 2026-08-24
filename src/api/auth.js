import API from './client.js';

export async function login(pin) {
  const { data } = await API.post('/auth/login', { pin });
  localStorage.setItem('estatepro_token', data.token);
  return data;
}

export async function verifyToken() {
  const { data } = await API.get('/auth/verify');
  return data;
}

// Change PIN. If resetToken is provided (from the "forgot PIN" flow), it's
// sent explicitly so this works even when the user isn't logged in.
// If omitted, the normal stored admin session token is used (interceptor
// in client.js attaches it automatically) — for changing PIN while logged in.
export async function changePin(pin, resetToken) {
  const config = resetToken ? { headers: { Authorization: `Bearer ${resetToken}` } } : {};
  const { data } = await API.put('/auth/pin', { pin }, config);
  return data;
}

export function logout() {
  localStorage.removeItem('estatepro_token');
}

// ── Security question (forgot-PIN flow) ─────────────────────────────────────

export async function getSecurityQuestion() {
  const { data } = await API.get('/auth/security-question');
  return data; // { question }
}

// Set up (or update) the question — only works while logged in as admin.
export async function setSecurityQuestion(question, answer) {
  const { data } = await API.post('/auth/security-question', { question, answer });
  return data;
}

// Verify the answer — returns a short-lived resetToken to pass into changePin().
export async function verifySecurityAnswer(answer) {
  const { data } = await API.post('/auth/security-answer', { answer });
  return data; // { resetToken }
}