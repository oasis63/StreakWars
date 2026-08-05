const express = require('express');
const router = express.Router();
const { prepare } = require('../db/db');

/**
 * POST /api/auth/register - Register a new global user account
 */
router.post('/register', async (req, res) => {
  try {
    const { username, display_name, pin_code, avatar_emoji, avatar_color } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required.' });
    }
    if (!display_name || !display_name.trim()) {
      return res.status(400).json({ error: 'Display name is required.' });
    }

    // Clean username (remove leading @, lowercase)
    const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
    const cleanDisplayName = display_name.trim();
    const cleanPin = (pin_code || '1234').toString().trim();
    const cleanAvatar = avatar_emoji || '👤';
    const cleanColor = avatar_color || '#6366f1';

    // Check if username already exists
    let existing = null;
    try {
      const checkStmt = prepare(`SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(leetcode_username) = ?`);
      existing = await checkStmt.get(cleanUsername, cleanUsername);
    } catch (e) {
      try {
        const checkFallback = prepare(`SELECT id FROM users WHERE LOWER(name) = ? OR LOWER(leetcode_username) = ?`);
        existing = await checkFallback.get(cleanUsername, cleanUsername);
      } catch (err) {}
    }

    if (existing) {
      return res.status(400).json({ error: `Username @${cleanUsername} is already taken. Please choose another.` });
    }

    // Insert new user
    const insertStmt = prepare(`
      INSERT INTO users (
        name, leetcode_username, username, display_name, pin_code, avatar_emoji, avatar_color, color, emoji
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await insertStmt.run(
      cleanDisplayName,
      cleanUsername,
      cleanUsername,
      cleanDisplayName,
      cleanPin,
      cleanAvatar,
      cleanColor,
      cleanColor,
      cleanAvatar
    );

    let newUser = result.row;
    if (!newUser) {
      const insertedId = result.lastInsertRowid || result.id;
      if (insertedId) {
        const getUserStmt = prepare(`SELECT * FROM users WHERE id = ?`);
        newUser = await getUserStmt.get(insertedId);
      }
    }

    if (!newUser) {
      try {
        const getUserStmt = prepare(`SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(leetcode_username) = ?`);
        newUser = await getUserStmt.get(cleanUsername, cleanUsername);
      } catch (e) {}
    }

    if (!newUser) {
      newUser = {
        id: result.lastInsertRowid || Date.now(),
        username: cleanUsername,
        display_name: cleanDisplayName,
        avatar_emoji: cleanAvatar,
        avatar_color: cleanColor
      };
    }

    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        username: `@${newUser.username || cleanUsername}`,
        display_name: newUser.display_name || newUser.name || cleanDisplayName,
        avatar_emoji: newUser.avatar_emoji || newUser.emoji || cleanAvatar,
        avatar_color: newUser.avatar_color || newUser.color || cleanColor
      }
    });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ error: err.message || 'Failed to register account' });
  }
});

/**
 * POST /api/auth/login - Log in with Username & 4-Digit PIN
 */
router.post('/login', async (req, res) => {
  try {
    const { username, pin_code } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
    const cleanPin = (pin_code || '').toString().trim();

    let user = null;
    try {
      const findStmt = prepare(`
        SELECT * FROM users 
        WHERE LOWER(username) = ? OR LOWER(leetcode_username) = ? OR LOWER(name) = ?
      `);
      user = await findStmt.get(cleanUsername, cleanUsername, cleanUsername);
    } catch (e) {
      try {
        const findFallback = prepare(`
          SELECT * FROM users 
          WHERE LOWER(name) = ? OR LOWER(leetcode_username) = ?
        `);
        user = await findFallback.get(cleanUsername, cleanUsername);
      } catch (err) {}
    }

    if (!user) {
      return res.status(404).json({ error: `Account '@${cleanUsername}' not found. Please check username or register.` });
    }

    // Verify PIN if set
    if (user.pin_code && user.pin_code !== '1234' && cleanPin && user.pin_code !== cleanPin) {
      return res.status(401).json({ error: 'Incorrect 4-digit PIN.' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: `@${user.username || user.leetcode_username || cleanUsername}`,
        display_name: user.display_name || user.name,
        avatar_emoji: user.avatar_emoji || user.emoji || '👤',
        avatar_color: user.avatar_color || user.color || '#6366f1'
      }
    });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: err.message || 'Failed to log in' });
  }
});

/**
 * GET /api/auth/me/:id - Fetch current user session details
 */
router.get('/me/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const findStmt = prepare(`SELECT * FROM users WHERE id = ?`);
    const user = await findStmt.get(id);

    if (!user) {
      return res.status(404).json({ error: 'User session expired or not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: `@${user.username || user.name.toLowerCase().replace(/\s+/g, '_')}`,
        display_name: user.display_name || user.name,
        avatar_emoji: user.avatar_emoji || user.emoji || '👤',
        avatar_color: user.avatar_color || user.color || '#6366f1'
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user session' });
  }
});

module.exports = router;
