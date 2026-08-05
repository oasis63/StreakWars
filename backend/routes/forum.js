const express = require('express');
const router = express.Router();
const { prepare } = require('../db/db');

// Random Persona Generator lists
const ADJECTIVES = [
  'Binary', 'Cyber', 'Quantum', 'Algo', 'Recursion', 'Bitwise', 'Pixel', 
  'Terminal', 'Rustacean', 'Vim', 'Stack', 'Async', 'Cache', 'Daemon', 
  'Hex', 'Null', 'Kernel', 'Lambda', 'Matrix', 'Vector', 'Crypto', 'Logic'
];

const NOUNS = [
  'Ninja', 'Wizard', 'Architect', 'Maverick', 'Virtuoso', 'Bandit', 'Titan', 
  'Guru', 'Hacker', 'Knight', 'Pioneer', 'Surfer', 'Overlord', 'Voyager', 
  'Phoenix', 'Sorcerer', 'Coder', 'Engineer', 'Samurai', 'Legend'
];

const TITLES = [
  'DP Guru', 'Bug Hunter', 'Bitwise Boss', 'Streak Master', 'Algo Wizard', 
  'Code Ninja', 'LeetCode Legend', 'Graph Specialist', 'Tree Explorer', 
  'Optimization God', 'System Architect', 'Recursion Master', 'Heap Specialist'
];

const AVATARS = [
  '🐱‍💻', '🤖', '👾', '⚡', '🔮', '🚀', '🛡️', '🥷', '🧠', '💻', 
  '🎨', '🦁', '🐉', '🛸', '🎯', '🦊', '🦅', '🐺', '🦉', '🌋'
];

const COLORS = [
  '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', 
  '#06b6d4', '#ef4444', '#14b8a6', '#3b82f6', '#84cc16', '#a855f7'
];

function generateRandomPersona() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const name = `${adj} ${noun}`;
  const num = Math.floor(10 + Math.random() * 90);
  const handle = `@${adj.toLowerCase()}_${noun.toLowerCase()}_${num}`;
  const title = TITLES[Math.floor(Math.random() * TITLES.length)];
  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];

  return { name, handle, title, avatar, color };
}

/**
 * Auto-delete posts and topics older than 30 days
 */
async function cleanupOldPosts() {
  try {
    const cleanupStmt = prepare(`
      DELETE FROM forum_posts 
      WHERE datetime(created_at) < datetime('now', '-30 days')
    `);
    await cleanupStmt.run();
  } catch (err) {
    try {
      const cleanupPgStmt = prepare(`
        DELETE FROM forum_posts 
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);
      await cleanupPgStmt.run();
    } catch (e) {}
  }
}

/**
 * GET /api/forum/persona - Get a newly generated random persona
 */
router.get('/persona', (req, res) => {
  res.json(generateRandomPersona());
});

/**
 * GET /api/forum - Fetch discussion threads with nested comments
 */
router.get('/', async (req, res) => {
  try {
    await cleanupOldPosts();

    const allPostsStmt = prepare(`
      SELECT * FROM forum_posts 
      ORDER BY created_at ASC
    `);
    const posts = await allPostsStmt.all();

    // Separate into top-level topics and comments
    const topLevelTopics = [];
    const replyMap = {};

    posts.forEach(p => {
      p.likes = p.likes || 0;
      if (p.parent_id) {
        if (!replyMap[p.parent_id]) replyMap[p.parent_id] = [];
        replyMap[p.parent_id].push(p);
      } else {
        p.replies = [];
        topLevelTopics.push(p);
      }
    });

    // Attach comments & reply counts to top-level topics
    topLevelTopics.forEach(t => {
      t.replies = replyMap[t.id] || [];
      t.replies_count = t.replies.length;
    });

    // Return newest top-level topics first
    topLevelTopics.reverse();

    res.json({
      success: true,
      topics: topLevelTopics,
      total_count: posts.length
    });
  } catch (err) {
    console.error('Error fetching forum posts:', err);
    res.status(500).json({ error: 'Failed to fetch discussion topics' });
  }
});

/**
 * POST /api/forum - Create a new topic or comment
 */
router.post('/', async (req, res) => {
  try {
    await cleanupOldPosts();

    const { title, category, content, parent_id, author } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content cannot be empty.' });
    }

    // Generate random persona if not provided or incomplete
    const persona = (author && author.name) ? author : generateRandomPersona();

    const insertStmt = prepare(`
      INSERT INTO forum_posts (
        title, category, author_name, author_avatar, author_color, author_handle, author_title, content, parent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await insertStmt.run(
      title ? title.trim() : '',
      category ? category.trim() : 'General',
      persona.name,
      persona.avatar || '🐱‍💻',
      persona.color || '#6366f1',
      persona.handle || `@user_${Date.now().toString().slice(-4)}`,
      persona.title || 'Algo Explorer',
      content.trim(),
      parent_id || null
    );

    const getNewPostStmt = prepare(`SELECT * FROM forum_posts WHERE id = ?`);
    const newPost = await getNewPostStmt.get(result.lastInsertRowid || result.id);

    res.status(201).json({
      success: true,
      post: newPost
    });
  } catch (err) {
    console.error('Error creating forum post:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

/**
 * PUT /api/forum/:id - Edit an existing post or comment (anyone can edit)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content cannot be empty.' });
    }

    const updateStmt = prepare(`
      UPDATE forum_posts 
      SET content = ?, title = COALESCE(?, title), category = COALESCE(?, category)
      WHERE id = ?
    `);

    await updateStmt.run(
      content.trim(),
      title ? title.trim() : null,
      category ? category.trim() : null,
      id
    );

    const getPostStmt = prepare(`SELECT * FROM forum_posts WHERE id = ?`);
    const updatedPost = await getPostStmt.get(id);

    res.json({
      success: true,
      post: updatedPost
    });
  } catch (err) {
    console.error('Error editing forum post:', err);
    res.status(500).json({ error: 'Failed to edit post' });
  }
});

/**
 * POST /api/forum/:id/like - Like/upvote a post
 */
router.post('/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const updateStmt = prepare(`
      UPDATE forum_posts SET likes = likes + 1 WHERE id = ?
    `);
    await updateStmt.run(id);

    const getPostStmt = prepare(`SELECT * FROM forum_posts WHERE id = ?`);
    const updatedPost = await getPostStmt.get(id);

    res.json({
      success: true,
      likes: updatedPost ? updatedPost.likes : 0
    });
  } catch (err) {
    console.error('Error liking forum post:', err);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

/**
 * DELETE /api/forum/:id - Delete a post and its replies (anyone can delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleteStmt = prepare(`DELETE FROM forum_posts WHERE id = ? OR parent_id = ?`);
    await deleteStmt.run(id, id);

    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (err) {
    console.error('Error deleting forum post:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

module.exports = router;
