const express = require('express');
const passport = require('passport');
const router = express.Router();
const user_queries = require('../queries/user_queries.js');

function getFrontendUrl() {
  const url = process.env.FRONTEND_URL || 'http://localhost:3000';
  return url.replace(/\/$/, '');
}

// Initiate Google OAuth
// Frontend redirects user here to start the OAuth flow
router.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

// Google OAuth callback
// Google redirects here after user grants permission
router.get('/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${getFrontendUrl()}/signin?error=oauth_failed`,
    session: false
  }),
  async (req, res) => {
    try {
      const userData = req.user;

      // Check if this is a new user who needs to select account type
      if (userData.needsAccountType) {
        // Store OAuth data in session for later use
        req.session.pendingOAuth = {
          googleId: userData.googleId,
          email: userData.email,
          picture: userData.picture,
          firstName: userData.firstName,
          lastName: userData.lastName
        };

        // Redirect to account selection page
        return res.redirect(`${getFrontendUrl()}/account-selection?oauth=google`);
      }

      // Existing user - create session and redirect to dashboard
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.redirect(`${getFrontendUrl()}/signin?error=session_error`);
        }

        req.session.user_id = userData.id;
        res.redirect(`${getFrontendUrl()}/dashboard`);
      });

    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`${getFrontendUrl()}/signin?error=oauth_failed`);
    }
  }
);

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

    // Create the user
    const user = await user_queries.createOAuthUser(
      pendingOAuth.email,
      pendingOAuth.googleId,
      isBusiness,
      pendingOAuth.picture
    );

    // Create worker or business profile
    if (accountType === 'Worker') {
      const workerFirstName = firstName || pendingOAuth.firstName || 'User';
      const workerLastName = lastName || pendingOAuth.lastName || '';
      await user_queries.addWorker(user.id, workerFirstName, workerLastName);
    } else {
      await user_queries.addBusiness(user.id, businessName || '', businessDescription || '');
    }

    // Clear pending OAuth data
    delete req.session.pendingOAuth;

    // Create session
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ success: false, message: 'Session error' });
      }

      req.session.user_id = user.id;

      // Return user data
      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          isbusiness: user.isbusiness,
          userImage: user.userimage
        }
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
      picture: req.session.pendingOAuth.picture
    });
  } else {
    res.json({ pending: false });
  }
});

module.exports = router;
