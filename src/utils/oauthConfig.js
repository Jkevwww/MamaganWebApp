function cleanBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function buildCallbackUrl(path) {
  const baseUrl = cleanBaseUrl(process.env.SERVER_URL || process.env.CLIENT_URL);
  return baseUrl ? `${baseUrl}${path}` : '';
}

function googleCallbackUrl() {
  return String(process.env.GOOGLE_CALLBACK_URL || '').trim() || buildCallbackUrl('/api/auth/google/callback');
}

function githubCallbackUrl() {
  return String(process.env.GITHUB_CALLBACK_URL || '').trim() || buildCallbackUrl('/api/auth/github/callback');
}

module.exports = {
  googleCallbackUrl,
  githubCallbackUrl,
};
