const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const axios = require('axios');

const { linkOrCreateOAuthUser } = require('../services/oauth.service');

async function fetchGithubVerifiedEmail(accessToken) {
  const { data } = await axios.get('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'MamaganBooking/1.0',
    },
  });
  const list = Array.isArray(data) ? data : [];
  const verified = list.filter((e) => e && e.verified === true);
  const primary = verified.find((e) => e.primary === true);
  return primary?.email || verified[0]?.email || null;
}

function readVerifiedGithubEmailFromProfile(profile) {
  const emails = profile.emails || [];
  for (const e of emails) {
    if (e && e.value && e.verified === true) {
      return e.value.trim().toLowerCase();
    }
  }
  return null;
}

function setUpPassport() {
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL,
          passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            void accessToken;
            void refreshToken;
            const emails = profile.emails || [];
            const verifiedEmail = emails.find((e) => e && e.verified && e.value);
            if (!verifiedEmail) {
              const err = new Error('Google account email is not verified');
              err.statusCode = 400;
              throw err;
            }
            const email = verifiedEmail.value;
            const displayName =
              profile.displayName || profile.name?.givenName || profile.username || email.split('@')[0];
            const avatarUrl = profile.photos?.[0]?.value || null;
            const payload = await linkOrCreateOAuthUser({
              provider: 'GOOGLE',
              providerUserId: profile.id,
              email,
              displayName,
              avatarUrl,
              req,
            });
            return done(null, payload);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  }

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          callbackURL: process.env.GITHUB_CALLBACK_URL,
          scope: ['user:email'],
          passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            void refreshToken;
            let email = readVerifiedGithubEmailFromProfile(profile);
            if (!email && accessToken) {
              email = await fetchGithubVerifiedEmail(accessToken);
            }
            if (!email) {
              const err = new Error('No verified GitHub email available');
              err.statusCode = 400;
              throw err;
            }
            const displayName =
              profile.displayName || profile.username || email.split('@')[0];
            const avatarUrl = profile.photos?.[0]?.value || profile._json?.avatar_url || null;
            const payload = await linkOrCreateOAuthUser({
              provider: 'GITHUB',
              providerUserId: profile.id,
              email,
              displayName,
              avatarUrl,
              req,
            });
            return done(null, payload);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  }
}

module.exports = { setUpPassport };
