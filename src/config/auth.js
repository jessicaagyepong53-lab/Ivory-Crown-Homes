// JWT token helpers — PIN is now stored securely on the server as a bcrypt hash
const TOKEN_KEY = "estatepro_token";

export const getToken   = ()    => localStorage.getItem(TOKEN_KEY);
export const setToken   = (t)   => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = ()    => localStorage.removeItem(TOKEN_KEY);
export const isLoggedIn = ()    => !!localStorage.getItem(TOKEN_KEY);
