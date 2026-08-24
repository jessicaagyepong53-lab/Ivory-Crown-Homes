import jwt from 'jsonwebtoken';

// Standard guard — used on every existing protected route (blocks, tenants,
// maintenance, trash, etc). Only accepts a full admin session token.
// A pin-reset token (see routes/auth.js) will be correctly REJECTED here.
export function verifyJWT(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Relaxed guard — used ONLY on PUT /auth/pin. Accepts either a normal admin
// session (already logged in, just changing PIN) OR a short-lived
// 'pin-reset' token issued after answering the security question correctly.
export function verifyAdminOrPinReset(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin' && decoded.role !== 'pin-reset') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}