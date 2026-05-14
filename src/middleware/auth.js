function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

function ensureGuest(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return res.redirect('/');
  return next();
}

module.exports = { ensureAuth, ensureGuest };

