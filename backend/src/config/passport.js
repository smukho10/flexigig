const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../database/connection.js');
const user_queries = require('../database/queries/user_queries.js');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await user_queries.getUserById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Build callback URL dynamically based on environment
function getCallbackURL() {
  // If explicitly set, use it
  if (process.env.GOOGLE_CALLBACK_URL) {
    return process.env.GOOGLE_CALLBACK_URL;
  }

  // Otherwise build from BACKEND_URL or defaults
  const baseUrl = process.env.BACKEND_URL ||
                  (process.env.NODE_ENV === 'production'
                    ? 'https://flexigig-wcpz.onrender.com'
                    : `http://localhost:${process.env.PORT || 5000}`);

  return `${baseUrl}/api/auth/google/callback`;
}

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: getCallbackURL(),
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const email = profile.emails[0].value;
      const picture = profile.photos?.[0]?.value || null;
      const firstName = profile.name?.givenName || '';
      const lastName = profile.name?.familyName || '';

      // Check if user exists by google_id
      let user = await user_queries.getUserByGoogleId(googleId);

      if (user) {
        // Existing Google user - just login
        return done(null, user);
      }

      // Check if email already exists (local account)
      user = await user_queries.getUserByEmail(email);

      if (user) {
        // Link Google to existing local account
        await user_queries.linkGoogleAccount(user.id, googleId);
        user = await user_queries.getUserById(user.id);
        return done(null, user);
      }

      // New user - create account
      // Store OAuth data in session for account type selection
      const oauthData = {
        googleId,
        email,
        picture,
        firstName,
        lastName,
        needsAccountType: true
      };

      return done(null, oauthData);

    } catch (err) {
      console.error('Google OAuth error:', err);
      return done(err, null);
    }
  }
));

module.exports = passport;
