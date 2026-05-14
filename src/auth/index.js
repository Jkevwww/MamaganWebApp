const passportGoogle = require('passport-google-oauth20');
const passportGithub = require('passport-github2');

const { User } = require('../models/User');

function initAuth(passport) {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findByPk(id);
      done(null, user || null);
    } catch (e) {
      done(e);
    }
  });

  const requireEnv = (key) => {
    if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);
    return process.env[key];
  };

  // Register Google strategy only when credentials are present.
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
    passport.use(
      new passportGoogle.Strategy(
        {
          clientID: requireEnv('GOOGLE_CLIENT_ID'),
          clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
          callbackURL: requireEnv('GOOGLE_CALLBACK_URL')
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const providerId = profile.id;
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
            const name = profile.displayName || null;

            const [user] = await User.findOrCreate({
              where: { provider: 'google', providerId },
              defaults: { email, name }
            });

            if (email && (!user.email || user.email !== email)) user.email = email;
            if (name && (!user.name || user.name !== name)) user.name = name;
            await user.save();

            done(null, user);
          } catch (e) {
            done(e);
          }
        }
      )
    );

    // Note: routes are mounted in server.js for simplicity.
  }

  // Register GitHub strategy only when credentials are present.
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.GITHUB_CALLBACK_URL) {
    passport.use(
      new passportGithub.Strategy(
        {
          clientID: requireEnv('GITHUB_CLIENT_ID'),
          clientSecret: requireEnv('GITHUB_CLIENT_SECRET'),
          callbackURL: requireEnv('GITHUB_CALLBACK_URL')
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const providerId = profile.id;
            const email = Array.isArray(profile.emails) && profile.emails[0] ? profile.emails[0].value : null;
            const name = profile.displayName || profile.username || null;

            const [user] = await User.findOrCreate({
              where: { provider: 'github', providerId },
              defaults: { email, name }
            });

            if (email && (!user.email || user.email !== email)) user.email = email;
            if (name && (!user.name || user.name !== name)) user.name = name;
            await user.save();

            done(null, user);
          } catch (e) {
            done(e);
          }
        }
      )
    );
  }
}

module.exports = { initAuth };


