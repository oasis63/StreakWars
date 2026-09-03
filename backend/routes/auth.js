const express = require('express');
const router = express.Router();
const { prepare } = require('../db/db');
const { signToken, publicUser } = require('../utils/auth');
const { requireAuth } = require('../middleware/auth');

function withToken(user) {
    const token = signToken(user);
    return { ...publicUser(user), token };
}

router.post('/register', async (req, res) => {
  try {
    const { username, display_name, pin_code, avatar_emoji, avatar_color } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required.' });
    }
    if (!display_name || !display_name.trim()) {
      return res.status(400).json({ error: 'Display name is required.' });
    }

    const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
    const cleanDisplayName = display_name.trim();
    const cleanPin = (pin_code || '1234').toString().trim();
    const cleanAvatar = avatar_emoji || '👤';
    const cleanColor = avatar_color || '#6366f1';

    let existing = await prepare(`SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(leetcode_username) = ?`).get(cleanUsername, cleanUsername);
    if (existing) {
      return res.status(400).json({ error: `Username @${cleanUsername} is already taken. Please choose another.` });
    }

    const isSuper = cleanUsername === 'rajesh' ? 1 : 0;
    const result = await prepare(`
      INSERT INTO users (
        name, leetcode_username, username, display_name, pin_code, avatar_emoji, avatar_color, color, emoji, is_participant, is_superadmin
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      cleanDisplayName,
      cleanUsername,
      cleanUsername,
      cleanDisplayName,
      cleanPin,
      cleanAvatar,
      cleanColor,
      cleanColor,
      cleanAvatar,
      isSuper
    );

    let newUser = result.row;
    const insertedId = result.lastInsertRowid || (result.row && result.row.id);
    if (!newUser && insertedId) {
      newUser = await prepare(`SELECT * FROM users WHERE id = ?`).get(insertedId);
    }
    if (!newUser) {
      newUser = await prepare(`SELECT * FROM users WHERE LOWER(username) = ?`).get(cleanUsername);
    }

    res.status(201).json({ success: true, user: withToken(newUser) });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ error: err.message || 'Failed to register account' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, pin_code } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
    const cleanPin = (pin_code || '').toString().trim();

    const user = await prepare(`
      SELECT * FROM users
      WHERE LOWER(username) = ? OR LOWER(leetcode_username) = ? OR LOWER(name) = ?
    `).get(cleanUsername, cleanUsername, cleanUsername);

    if (!user) {
      return res.status(404).json({ error: `Account '@${cleanUsername}' not found. Please check username or register.` });
    }

    if (user.pin_code && user.pin_code !== '1234' && cleanPin && user.pin_code !== cleanPin) {
      return res.status(401).json({ error: 'Incorrect 4-digit PIN.' });
    }

    if (cleanUsername === 'rajesh' && !user.is_superadmin) {
      await prepare(`UPDATE users SET is_superadmin = 1 WHERE id = ?`).run(user.id);
      user.is_superadmin = 1;
    }

    res.json({ success: true, user: withToken(user) });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: err.message || 'Failed to log in' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ success: true, user: withToken(req.user) });
});

module.exports = router;
