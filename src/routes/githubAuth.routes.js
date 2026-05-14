const express = require('express');

const oauthController = require('../controllers/oauth.controller');

const router = express.Router();

router.get('/', oauthController.githubStart);
router.get('/callback', oauthController.githubCallback);

module.exports = router;
