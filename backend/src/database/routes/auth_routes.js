const express = require('express');
const passport = require('passport');
const crypto = require('crypto');
const router = express.Router();
const user_queries = require('../queries/user_queries.js');

function getFrontendUrl() {
  const url = process.env.FRONTEND_URL || 'http://localhost:3000';
  return url.replace(/\/$/, '');
}

/**
 * Short-lived in-memory token store for OAuth session handoff.
 *
 * Problem: Google OAuth redirects the browser directly to the Render backend
 * (not through the Vercel proxy). Any session cookie set at that point is
 * stored for the Render domain, not the Vercel domain. When the frontend then
 * calls /api/... through the Vercel rewrite proxy, the Render-domain cookie is
 * not included, so the session is lost.
 *
 * Fix: Instead of creating a session in the OAuth callback, we create a
 * short-lived token and redirect the frontend to exchange it via the Vercel
 * proxy (/api/auth/google/exchange). The exchange sets the session cookie
 * through the proxy, so it is stored on the Vercel domain and works correctly.
 */
const authTokens = new Map();

function createAuthToken(data) {
  const token = crypto.randomBytes(32).toString('hex');
  authTokens.set(token, { data, createdAt: Date.now() });
  // Auto-expire after 5 minutes
  setTimeout(() => authTokens.delete(token), 5 * 60 * 1000);
  return token;
}

function consumeAuthToken(token) {
  const entry = authTokens.get(token);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > 5 * 60 * 1000) {
    authTokens.delete(token);
    return null;
  }
  authTokens.delete(token);
  return entry.data;
}

// Initiate Google OAuth
router.get('/auth/google', (req, res, next) => {
  const accountType = req.query.accountType;
  if (accountType === 'Worker' || accountType === 'Employer') {
    req.session.pendingAccountType = accountType;
  }
  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/user.phonenumbers.read'
    ]
  })(req, res, next);
});

// Google OAuth callback
router.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${getFrontendUrl()}/signin?error=oauth_failed`,
    session: false
  }),
  async (req, res) => {
    try {
      const userData = req.user;

      if (userData.emailPendingVerification) {
        // User registered with email but hasn't verified yet — block to prevent duplicate accounts
        return res.redirect(`${getFrontendUrl()}/signin?error=verify_email_first`);
      }

      if (userData.needsAccountType) {
        // New user — store pending data in a token and redirect to frontend
        const accountType = req.session.pendingAccountType;
        if (accountType) delete req.session.pendingAccountType;

        const token = createAuthToken({
          type: 'pending',
          googleId: userData.googleId,
          email: userData.email,
          picture: userData.picture,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phoneNumber: userData.phoneNumber,
          preSelectedAccountType: accountType || null
        });

        const accountTypeParam = accountType ? `&accountType=${accountType}` : '';
        return res.redirect(`${getFrontendUrl()}/auth/callback?token=${token}${accountTypeParam}`);
      }

      // Existing user — store userId in a token and redirect to frontend
      const token = createAuthToken({
        type: 'login',
        userId: userData.id
      });

      return res.redirect(`${getFrontendUrl()}/auth/callback?token=${token}`);

    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`${getFrontendUrl()}/signin?error=oauth_failed`);
    }
  }
);

/**
 * Exchange a short-lived OAuth token for a real session.
 * This is called by the frontend through the Vercel proxy, so the session
 * cookie will be stored for the Vercel domain and work correctly.
 */
router.get('/auth/google/exchange', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Token is required.' });
  }

  const data = consumeAuthToken(token);
  if (!data) {
    return res.status(400).json({ success: false, message: 'Invalid or expired token. Please sign in again.' });
  }

  try {
    if (data.type === 'login') {
      // Existing user — create session
      req.session.regenerate(async (err) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({ success: false, message: 'Session error' });
        }

        req.session.user_id = data.userId;
        await user_queries.setCurrentSession(data.userId, req.sessionID);

        const user = await user_queries.getUserById(data.userId);
        return res.json({
          success: true,
          type: 'login',
          user: {
            id: user.id,
            email: user.email,
            isbusiness: user.isbusiness,
            userImage: user.userImage || user.userimage || null
          }
        });
      });

    } else if (data.type === 'pending') {
      // New user — store pending OAuth data in session (now through proxy, cookie on Vercel domain)
      req.session.pendingOAuth = {
        googleId: data.googleId,
        email: data.email,
        picture: data.picture,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber
      };

      return res.json({
        success: true,
        type: 'pending',
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber || null,
        preSelectedAccountType: data.preSelectedAccountType || null
      });
    }

  } catch (error) {
    console.error('Token exchange error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Complete OAuth registration (called after account type selection)
router.post('/auth/google/complete', async (req, res) => {
  try {
    const { accountType, firstName, lastName, businessName, businessDescription } = req.body;
    const pendingOAuth = req.session.pendingOAuth;

    if (!pendingOAuth) {
      return res.status(400).json({
        success: false,
        message: 'No pending OAuth data. Please start the sign-in process again.'
      });
    }

    if (!accountType) {
      return res.status(400).json({
        success: false,
        message: 'Account type is required.'
      });
    }

    const isBusiness = accountType === 'Employer';

    const user = await user_queries.createOAuthUser(
      pendingOAuth.email,
      pendingOAuth.googleId,
      isBusiness,
      pendingOAuth.picture,
      pendingOAuth.phoneNumber
    );

    let workerId = null;

    if (accountType === 'Worker') {
      const workerFirstName = firstName || pendingOAuth.firstName || 'User';
      const workerLastName = lastName || pendingOAuth.lastName || '';
      const worker = await user_queries.addWorker(user.id, workerFirstName, workerLastName);
      workerId = worker?.id ?? null;
    } else {
      await user_queries.addBusiness(user.id, businessName || '', businessDescription || '', {
        businessEmail: pendingOAuth.email,
        businessPhoneNumber: pendingOAuth.phoneNumber,
        contactFirstName: firstName || pendingOAuth.firstName || null,
        contactLastName: lastName || pendingOAuth.lastName || null
      });
    }

    delete req.session.pendingOAuth;

    req.session.regenerate(async (err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ success: false, message: 'Session error' });
      }

      req.session.user_id = user.id;
      await user_queries.setCurrentSession(user.id, req.sessionID);

      const userResponse = {
        id: user.id,
        email: user.email,
        isbusiness: user.isbusiness,
        userImage: user.userImage || user.userimage || null
      };
      if (workerId) userResponse.workerId = workerId;

      res.status(200).json({
        success: true,
        user: userResponse,
        workerId: workerId
      });
    });

  } catch (error) {
    console.error('OAuth completion error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// Check if there's pending OAuth data
router.get('/auth/google/pending', (req, res) => {
  if (req.session.pendingOAuth) {
    res.json({
      pending: true,
      email: req.session.pendingOAuth.email,
      firstName: req.session.pendingOAuth.firstName,
      lastName: req.session.pendingOAuth.lastName,
      phoneNumber: req.session.pendingOAuth.phoneNumber,
      picture: req.session.pendingOAuth.picture
    });
  } else {
    res.json({ pending: false });
  }
});

module.exports = router;
