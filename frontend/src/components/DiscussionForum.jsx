import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Dices, Heart, Reply, Trash2, Edit, Search, 
  Sparkles, Filter, RefreshCw, Plus, ArrowLeft, Clock,
  AlertCircle, Check, X
} from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import MarkdownRenderer from './MarkdownRenderer';
import { API_BASE_URL } from '../config';

const CATEGORIES = [
  { id: 'all', name: 'All Topics', icon: '💬' },
  { id: 'problem', name: '💡 Problem Solutions', icon: '💡' },
  { id: 'strategy', name: '⚡ Streak Strategies', icon: '⚡' },
  { id: 'general', name: '🚀 General Chat', icon: '🚀' },
  { id: 'debugging', name: '🐛 Debugging & Code', icon: '🐛' }
];

export default function DiscussionForum({ currentUser, onOpenAuth }) {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Active Poster Mode: 'account' (real DP & username) vs 'anonymous' (random persona)
  const [postMode, setPostMode] = useState(currentUser ? 'account' : 'anonymous');

  // Active Random Persona
  const [persona, setPersona] = useState(null);
  const [loadingPersona, setLoadingPersona] = useState(false);

  // Active view: 'list' | 'create' | 'thread'
  const [viewMode, setViewMode] = useState('list');
  const [activeThreadId, setActiveThreadId] = useState(null);

  // Create new topic form state
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicCategory, setNewTopicCategory] = useState('💡 Problem Solutions');
  const [newTopicContent, setNewTopicContent] = useState('');
  const [submittingTopic, setSubmittingTopic] = useState(false);

  // Comment state inside thread
  const [commentContent, setCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Edit post/comment state
  const [editingPostId, setEditingPostId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Search & Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'comments' | 'popular'

  // Helper to safely parse JSON responses
  const safeJsonFetch = async (url, options) => {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Server returned invalid response (${res.status}). Ensure backend server is running.`);
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Server error (${res.status})`);
    }
    return data;
  };

  // Fetch initial random persona
  const fetchRandomPersona = async () => {
    setLoadingPersona(true);
    try {
      const data = await safeJsonFetch(`${API_BASE_URL}/api/forum/persona`);
      setPersona(data);
    } catch (err) {
      console.error('Failed to fetch persona:', err);
    } finally {
      setLoadingPersona(false);
    }
  };

  // Fetch all discussion topics
  const fetchTopics = async () => {
    setLoading(true);
    try {
      const data = await safeJsonFetch(`${API_BASE_URL}/api/forum`);
      if (data.success) {
        setTopics(data.topics || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRandomPersona();
    fetchTopics();
  }, []);

  const activePoster = (postMode === 'account' && currentUser)
    ? {
        user_id: currentUser.id,
        name: currentUser.display_name,
        handle: currentUser.username,
        avatar: currentUser.avatar_emoji || '👤',
        color: currentUser.avatar_color || '#6366f1',
        title: 'Participant'
      }
    : persona;

  // Handle creating a new discussion topic
  const handleCreateTopic = async () => {
    if (!newTopicTitle.trim()) {
      alert('Please enter a discussion title.');
      return;
    }
    if (!newTopicContent.trim()) {
      alert('Please enter discussion content.');
      return;
    }

    setSubmittingTopic(true);
    try {
      const data = await safeJsonFetch(`${API_BASE_URL}/api/forum`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTopicTitle,
          category: newTopicCategory,
          content: newTopicContent,
          author: activePoster
        })
      });

      setNewTopicTitle('');
      setNewTopicContent('');
      setViewMode('list');
      await fetchTopics();
      fetchRandomPersona();

      // Automatically open the newly created thread
      if (data.post) {
        setActiveThreadId(data.post.id);
        setViewMode('thread');
      }
    } catch (err) {
      alert(`Error creating topic: ${err.message}`);
    } finally {
      setSubmittingTopic(false);
    }
  };

  // Handle posting a comment to a thread
  const handlePostComment = async (parentId) => {
    if (!commentContent.trim()) return;

    setSubmittingComment(true);
    try {
      await safeJsonFetch(`${API_BASE_URL}/api/forum`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: commentContent,
          parent_id: parentId,
          author: activePoster
        })
      });

      setCommentContent('');
      await fetchTopics();
      fetchRandomPersona();
    } catch (err) {
      alert(`Error posting comment: ${err.message}`);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Handle editing any post or comment
  const handleStartEdit = (post) => {
    setEditingPostId(post.id);
    setEditTitle(post.title || '');
    setEditCategory(post.category || 'General');
    setEditContent(post.content || '');
  };

  const handleSaveEdit = async (postId) => {
    if (!editContent.trim()) return;

    setSavingEdit(true);
    try {
      await safeJsonFetch(`${API_BASE_URL}/api/forum/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          category: editCategory,
          content: editContent
        })
      });

      setEditingPostId(null);
      await fetchTopics();
    } catch (err) {
      alert(`Error updating post: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle liking/upvoting
  const handleLikePost = async (postId) => {
    try {
      await safeJsonFetch(`${API_BASE_URL}/api/forum/${postId}/like`, {
        method: 'POST'
      });
      fetchTopics();
    } catch (err) {
      console.error('Failed to like post:', err);
    }
  };

  // Handle deleting any post or comment (anyone can delete)
  const handleDeletePost = async (postId, isTopic = false) => {
    if (!window.confirm(`Are you sure you want to delete this ${isTopic ? 'entire discussion thread' : 'comment'}?`)) return;

    try {
      await safeJsonFetch(`${API_BASE_URL}/api/forum/${postId}`, {
        method: 'DELETE'
      });
      
      if (isTopic && activeThreadId === postId) {
        setViewMode('list');
        setActiveThreadId(null);
      }
      
      fetchTopics();
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  // Relative time formatter
  const formatTimeAgo = (isoString) => {
    if (!isoString) return 'Just now';
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  // Filter & sort topics
  const filteredTopics = topics.filter(t => {
    // Category filter
    if (selectedCategory !== 'all') {
      const catObj = CATEGORIES.find(c => c.id === selectedCategory);
      if (catObj && !t.category.toLowerCase().includes(catObj.name.toLowerCase().replace(/^[^\w]+/, ''))) {
        return false;
      }
    }
    // Search filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.title && t.title.toLowerCase().includes(q)) ||
      t.author_name.toLowerCase().includes(q) ||
      t.author_handle.toLowerCase().includes(q) ||
      t.content.toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    if (sortBy === 'popular') return (b.likes || 0) - (a.likes || 0);
    if (sortBy === 'comments') return (b.replies_count || 0) - (a.replies_count || 0);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const activeThread = topics.find(t => t.id === activeThreadId);

  return (
    <div className="hud-card p-5 sm:p-7 space-y-6 font-['Inter',sans-serif]">
      {/* Forum Main Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-mono-title font-bold text-cream">
              Discussion forum
            </h2>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-200 border border-amber-500/25 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              30-day auto-cleanup
            </span>
          </div>
          <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
            Share solutions, streak tactics, and debug help. Threads older than 30 days are removed automatically.
          </p>
        </div>

        {/* Action Header Controls */}
        <div className="flex items-center gap-2">
          {viewMode === 'list' && (
            <button
              onClick={() => setViewMode('create')}
              className="sw-btn sw-btn-primary"
            >
              <Plus className="w-4 h-4" />
              Start a discussion
            </button>
          )}

          {viewMode !== 'list' && (
            <button
              onClick={() => {
                setViewMode('list');
                setActiveThreadId(null);
              }}
              className="px-3.5 py-2 rounded-xl bg-[var(--ink-2)] hover:bg-[var(--ink-2)] text-cream font-code font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Discussions
            </button>
          )}

          <button
            onClick={fetchTopics}
            className="px-3 py-2 rounded-xl bg-[var(--ink-2)] border border-[var(--line)] hover:border-[var(--line-strong)] text-cream hover:text-cream font-code text-xs flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Poster Identity Box */}
      <div className="bg-[var(--ink-2)] border border-[var(--line)] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div 
            className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shadow-lg shrink-0 border border-white/10"
            style={{ backgroundColor: activePoster?.color || '#6366f1' }}
          >
            {activePoster?.avatar || '🐱‍💻'}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono-title font-bold text-sm text-cream">
                {activePoster?.name || 'Loading profile...'}
              </span>
              <span className="text-xs font-code text-muted">
                {activePoster?.handle}
              </span>
              {activePoster?.title && (
                <span 
                  className="px-2 py-0.5 rounded text-[10px] font-code font-bold"
                  style={{ backgroundColor: `${activePoster.color}25`, color: activePoster.color, border: `1px solid ${activePoster.color}40` }}
                >
                  {activePoster.title}
                </span>
              )}
            </div>
            <div className="text-[11px] font-code text-muted flex items-center gap-1 mt-0.5">
              <Sparkles className="w-3 h-3 text-amber-400 inline" />
              <span>
                {postMode === 'account' 
                  ? 'Posting as your verified account with your profile avatar DP'
                  : 'Posting as an anonymous developer persona'}
              </span>
            </div>
          </div>
        </div>

        {/* Identity Selector Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {currentUser ? (
            <div className="flex bg-[var(--panel)] rounded-xl p-1 border border-[var(--line)] font-code text-xs">
              <button
                type="button"
                onClick={() => setPostMode('account')}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  postMode === 'account'
                    ? 'bg-[var(--volt-dim)] text-[var(--volt)] border border-[var(--volt)]/30'
                    : 'text-muted hover:text-cream'
                }`}
              >
                <span>👤 Real Profile</span>
              </button>
              <button
                type="button"
                onClick={() => setPostMode('anonymous')}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  postMode === 'anonymous'
                    ? 'bg-[var(--volt-dim)] text-[var(--volt)] border border-[var(--volt)]/30'
                    : 'text-muted hover:text-cream'
                }`}
              >
                <span>🎲 Anonymously</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--volt-dim)] hover:bg-[var(--volt)]/20 text-[var(--volt)] border border-[var(--volt)]/30 font-code font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <span>🔑 Log In to Post as Yourself</span>
            </button>
          )}

          {postMode === 'anonymous' && (
            <button
              onClick={fetchRandomPersona}
              disabled={loadingPersona}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-code font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Dices className={`w-3.5 h-3.5 ${loadingPersona ? 'animate-spin' : ''}`} />
              Reroll Persona
            </button>
          )}
        </div>
      </div>

      {/* MODE 1: CREATE NEW TOPIC FORM */}
      {viewMode === 'create' && (
        <div className="hud-card p-6 border border-[var(--volt)]/30 bg-[var(--panel)] rounded-2xl space-y-4 shadow-2xl">
          <h3 className="text-lg font-mono-title font-bold text-[var(--volt)] flex items-center gap-2">
            <Plus className="w-5 h-5" /> Start a New Discussion Thread
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Discussion Title */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-code font-bold text-cream">
                Discussion Title *
              </label>
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="e.g., Optimal O(N) solution for today's LeetCode Medium..."
                className="w-full bg-[var(--ink)] border border-[var(--line)] rounded-xl px-3.5 py-2 text-sm text-cream placeholder:text-muted focus:outline-none focus:border-[var(--volt)] font-['Inter',sans-serif]"
              />
            </div>

            {/* Category Selector */}
            <div className="space-y-1">
              <label className="text-xs font-code font-bold text-cream">
                Category
              </label>
              <select
                value={newTopicCategory}
                onChange={(e) => setNewTopicCategory(e.target.value)}
                className="w-full bg-[var(--ink)] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-cream focus:outline-none focus:border-[var(--volt)] font-code"
              >
                <option value="💡 Problem Solutions">💡 Problem Solutions</option>
                <option value="⚡ Streak Strategies">⚡ Streak Strategies</option>
                <option value="🚀 General Chat">🚀 General Chat</option>
                <option value="🐛 Debugging & Code">🐛 Debugging & Code</option>
              </select>
            </div>
          </div>

          {/* Description & Code Editor */}
          <div className="space-y-1">
            <label className="text-xs font-code font-bold text-cream">
              Discussion Content & Code Snippets *
            </label>
            <RichTextEditor
              value={newTopicContent}
              onChange={setNewTopicContent}
              placeholder="Explain your topic, approach, or paste your solution code block here..."
              onSubmit={handleCreateTopic}
              submitLabel="Publish Discussion Thread"
              isSubmitting={submittingTopic}
            />
          </div>
        </div>
      )}

      {/* MODE 2: SINGLE THREAD DETAILS & COMMENTS CONVERSATION */}
      {viewMode === 'thread' && activeThread && (
        <div className="space-y-6">
          {/* Main Discussion Topic Card */}
          <div className="hud-card p-6 border border-[var(--line)] bg-[var(--panel)] rounded-2xl space-y-4 shadow-xl">
            {/* Header / Author */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shadow shrink-0 border border-white/10"
                  style={{ backgroundColor: activeThread.author_color || '#6366f1' }}
                >
                  {activeThread.author_avatar || '🐱‍💻'}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono-title font-bold text-base text-cream">
                      {activeThread.author_name}
                    </span>
                    <span className="text-xs font-code text-muted">
                      {activeThread.author_handle}
                    </span>
                    {activeThread.author_title && (
                      <span 
                        className="px-2 py-0.5 rounded text-[10px] font-code font-bold"
                        style={{ backgroundColor: `${activeThread.author_color}25`, color: activeThread.author_color, border: `1px solid ${activeThread.author_color}40` }}
                      >
                        {activeThread.author_title}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-code text-muted mt-0.5">
                    <span className="px-2 py-0.5 rounded bg-[var(--ink-2)] text-cream font-bold">
                      {activeThread.category || 'General'}
                    </span>
                    <span>•</span>
                    <span>{formatTimeAgo(activeThread.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Edit / Delete Controls for Topic */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleStartEdit(activeThread)}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--ink-2)] hover:bg-[var(--ink-2)] text-cream font-code text-xs flex items-center gap-1 transition-colors"
                >
                  <Edit className="w-3.5 h-3.5 text-amber-400" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDeletePost(activeThread.id, true)}
                  className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-code text-xs flex items-center gap-1 transition-colors border border-red-500/30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Thread</span>
                </button>
              </div>
            </div>

            {/* Inline Topic Edit Mode */}
            {editingPostId === activeThread.id ? (
              <div className="bg-[var(--ink)] p-4 rounded-xl border border-amber-500/40 space-y-3">
                <div className="text-xs font-code font-bold text-amber-400">
                  Editing Discussion Topic
                </div>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-[var(--ink-2)] border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm text-cream font-mono-title"
                />
                <RichTextEditor
                  value={editContent}
                  onChange={setEditContent}
                  onSubmit={() => handleSaveEdit(activeThread.id)}
                  submitLabel="Save Changes"
                  isSubmitting={savingEdit}
                />
                <button
                  onClick={() => setEditingPostId(null)}
                  className="text-xs font-code text-muted hover:text-cream"
                >
                  Cancel Edit
                </button>
              </div>
            ) : (
              <>
                {/* Topic Title & Main Content */}
                <h1 className="text-xl font-mono-title font-bold text-cream pt-1">
                  {activeThread.title}
                </h1>
                <div className="pt-2">
                  <MarkdownRenderer content={activeThread.content} enableTruncate={false} />
                </div>
              </>
            )}

            {/* Topic Footer Stats */}
            <div className="flex items-center gap-4 pt-3 border-t border-[var(--line)] text-xs font-code text-muted">
              <button
                onClick={() => handleLikePost(activeThread.id)}
                className="flex items-center gap-1.5 hover:text-rose-400 transition-colors group"
              >
                <Heart className={`w-4 h-4 group-hover:scale-110 transition-transform ${activeThread.likes > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
                <span className="font-bold">{activeThread.likes || 0} Upvotes</span>
              </button>
              <span>•</span>
              <span className="flex items-center gap-1 text-cream">
                <MessageSquare className="w-4 h-4 text-[var(--volt)]" />
                <strong className="text-cream">{activeThread.replies_count || 0}</strong> Comments
              </span>
            </div>
          </div>

          {/* Comments Section Header */}
          <div className="space-y-4">
            <h3 className="text-lg font-mono-title font-bold text-cream flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[var(--volt)]" />
              Comments & Discussion ({activeThread.replies ? activeThread.replies.length : 0})
            </h3>

            {/* Comments List */}
            {activeThread.replies && activeThread.replies.length > 0 ? (
              <div className="space-y-3">
                {activeThread.replies.map((reply) => (
                  <div 
                    key={reply.id} 
                    className="bg-[var(--panel)] p-4 rounded-xl border border-[var(--line)] space-y-3 shadow-md"
                  >
                    {/* Comment Header */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-base shadow shrink-0"
                          style={{ backgroundColor: reply.author_color || '#6366f1' }}
                        >
                          {reply.author_avatar || '🐱‍💻'}
                        </div>
                        <span className="font-mono-title font-bold text-xs text-cream">
                          {reply.author_name}
                        </span>
                        <span className="text-[11px] font-code text-muted">
                          {reply.author_handle}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-code text-muted">
                        <span>{formatTimeAgo(reply.created_at)}</span>
                        <button
                          onClick={() => handleStartEdit(reply)}
                          className="text-muted hover:text-amber-300 p-1"
                          title="Edit comment"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePost(reply.id)}
                          className="text-muted hover:text-red-400 p-1"
                          title="Delete comment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Comment Edit Mode */}
                    {editingPostId === reply.id ? (
                      <div className="bg-[var(--ink)] p-3 rounded-lg border border-amber-500/40 space-y-2">
                        <RichTextEditor
                          value={editContent}
                          onChange={setEditContent}
                          onSubmit={() => handleSaveEdit(reply.id)}
                          submitLabel="Save Edit"
                          isSubmitting={savingEdit}
                        />
                        <button
                          onClick={() => setEditingPostId(null)}
                          className="text-xs font-code text-muted hover:text-cream"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <MarkdownRenderer content={reply.content} />
                    )}

                    {/* Comment Footer */}
                    <div className="flex items-center gap-3 pt-1 text-[11px] font-code text-muted border-t border-[var(--line)]">
                      <button
                        onClick={() => handleLikePost(reply.id)}
                        className="flex items-center gap-1 hover:text-rose-400 transition-colors"
                      >
                        <Heart className={`w-3.5 h-3.5 ${reply.likes > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
                        <span>{reply.likes || 0}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 font-code text-xs text-muted bg-[var(--ink-2)] rounded-xl border border-[var(--line)]">
                No comments yet. Be the first to leave a comment below!
              </div>
            )}

            {/* Comment Composer at Bottom of All Comments */}
            <div className="bg-[var(--ink-2)] p-4 rounded-2xl border border-[var(--line)] space-y-2 mt-6">
              <label className="text-xs font-code font-bold text-cream flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[var(--volt)]" />
                Join the Discussion
              </label>
              <RichTextEditor
                value={commentContent}
                onChange={setCommentContent}
                placeholder="Write a comment or code response..."
                onSubmit={() => handlePostComment(activeThread.id)}
                submitLabel="Post Comment"
                isSubmitting={submittingComment}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: TOPIC OVERVIEW LIST / THREAD FEED */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Category Filter Pills & Search */}
          <div className="space-y-3">
            {/* Categories */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-sm">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-2 rounded-xl font-medium transition-colors whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'bg-[var(--volt-dim)] text-[var(--volt)] border border-[var(--volt)]/35'
                      : 'bg-[var(--ink-2)] text-muted border border-[var(--line)] hover:text-cream'
                  }`}
                >
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>

            {/* Search & Sort Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search discussion threads or code..."
                  className="w-full bg-[var(--ink)] border border-[var(--line)] rounded-xl pl-9 pr-3 py-1.5 text-xs text-cream placeholder:text-muted focus:outline-none focus:border-[var(--volt)] font-code"
                />
              </div>

              <div className="flex items-center gap-2 font-code text-xs text-muted">
                <Filter className="w-3.5 h-3.5" />
                <span>Sort:</span>
                <div className="flex bg-[var(--panel)] rounded-xl p-0.5 border border-[var(--line)]">
                  <button
                    onClick={() => setSortBy('newest')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      sortBy === 'newest'
                        ? 'bg-[var(--volt-dim)] text-[var(--volt)] font-bold border border-[var(--volt)]/30'
                        : 'text-muted hover:text-cream'
                    }`}
                  >
                    Newest
                  </button>
                  <button
                    onClick={() => setSortBy('comments')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      sortBy === 'comments'
                        ? 'bg-[var(--volt-dim)] text-[var(--volt)] font-bold border border-[var(--volt)]/30'
                        : 'text-muted hover:text-cream'
                    }`}
                  >
                    Most Comments 💬
                  </button>
                  <button
                    onClick={() => setSortBy('popular')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      sortBy === 'popular'
                        ? 'bg-[var(--volt-dim)] text-[var(--volt)] font-bold border border-[var(--volt)]/30'
                        : 'text-muted hover:text-cream'
                    }`}
                  >
                    Most Liked 🔥
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Topics List Cards */}
          {loading ? (
            <div className="text-center py-12 font-code text-muted text-xs">
              Loading discussion threads...
            </div>
          ) : filteredTopics.length === 0 ? (
            <div className="text-center py-12 bg-[var(--ink-2)] rounded-2xl border border-[var(--line)] space-y-3">
              <MessageSquare className="w-8 h-8 text-muted mx-auto" />
              <p className="font-code text-xs text-muted">
                No discussion threads found. Click "Start a Discussion" above to post the first topic!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTopics.map((topic) => (
                <div 
                  key={topic.id} 
                  className="rounded-xl border border-[var(--line)] bg-[var(--ink-2)] hover:border-[var(--line-strong)] p-5 transition-colors space-y-3.5"
                >
                  {/* Topic Card Top Bar */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow shrink-0 border border-white/10"
                        style={{ backgroundColor: topic.author_color || '#6366f1' }}
                      >
                        {topic.author_avatar || '🐱‍💻'}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono-title font-bold text-sm text-cream">
                            {topic.author_name}
                          </span>
                          <span className="text-xs font-code text-muted">
                            {topic.author_handle}
                          </span>
                          {topic.author_title && (
                            <span 
                              className="px-2 py-0.5 rounded text-[10px] font-code font-bold"
                              style={{ backgroundColor: `${topic.author_color}25`, color: topic.author_color, border: `1px solid ${topic.author_color}40` }}
                            >
                              {topic.author_title}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-code text-muted mt-0.5">
                          <span className="px-2 py-0.5 rounded bg-[var(--panel)] border border-[var(--line)] text-cream font-bold">
                            {topic.category || 'General'}
                          </span>
                          <span>•</span>
                          <span>{formatTimeAgo(topic.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Edit / Delete Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleStartEdit(topic)}
                        className="p-1.5 text-muted hover:text-amber-300 rounded-lg hover:bg-[var(--ink-2)] transition-colors"
                        title="Edit topic"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePost(topic.id, true)}
                        className="p-1.5 text-muted hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                        title="Delete topic thread"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Topic Edit Mode */}
                  {editingPostId === topic.id ? (
                    <div className="bg-[var(--ink)] p-4 rounded-xl border border-amber-500/40 space-y-3">
                      <div className="text-xs font-code font-bold text-amber-400">
                        Editing Topic Thread
                      </div>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full bg-[var(--ink-2)] border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm text-cream font-mono-title"
                      />
                      <RichTextEditor
                        value={editContent}
                        onChange={setEditContent}
                        onSubmit={() => handleSaveEdit(topic.id)}
                        submitLabel="Save Changes"
                        isSubmitting={savingEdit}
                      />
                      <button
                        onClick={() => setEditingPostId(null)}
                        className="text-xs font-code text-muted hover:text-cream"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Topic Title & Content Preview */}
                      <button
                        onClick={() => {
                          setActiveThreadId(topic.id);
                          setViewMode('thread');
                        }}
                        className="text-left w-full group"
                      >
                        <h3 className="text-base font-mono-title font-bold text-cream group-hover:text-[var(--volt)] transition-colors">
                          {topic.title || 'Untitled Discussion'}
                        </h3>
                      </button>

                      <MarkdownRenderer content={topic.content} />
                    </>
                  )}

                  {/* Card Footer Bar */}
                  <div className="flex items-center justify-between gap-4 pt-3 border-t border-[var(--line)] text-sm">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleLikePost(topic.id)}
                        className="flex items-center gap-1.5 text-muted hover:text-rose-400 transition-colors"
                      >
                        <Heart className={`w-4 h-4 ${topic.likes > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
                        <span className="font-medium">{topic.likes || 0}</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveThreadId(topic.id);
                          setViewMode('thread');
                        }}
                        className="flex items-center gap-1.5 text-muted hover:text-[var(--volt)] transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>{topic.replies_count || 0} comments</span>
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setActiveThreadId(topic.id);
                        setViewMode('thread');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[var(--volt-dim)] border border-[var(--volt)]/25 text-[var(--volt)] font-semibold text-sm hover:bg-[var(--volt)] hover:text-ink transition-colors"
                    >
                      Open thread
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
