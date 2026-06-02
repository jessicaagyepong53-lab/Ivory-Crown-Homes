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

export async function changePin(pin) {
  const { data } = await API.put('/auth/pin', { pin });
  return data;
}

export function logout() {
  localStorage.removeItem('estatepro_token');
}
