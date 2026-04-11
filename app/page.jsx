'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', desc: 'fast, smart, everyday' },
  { id: 'claude-opus-4-6', label: 'Opus 4.6', desc: 'most capable, slower' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', desc: 'fastest, cheapest' },
];

const FOLDER_COLORS = [
  '#7c6bd9', '#9b8ce8', '#6b8dd6', '#72c49b',
  '#c4954a', '#c46b8d', '#8a6bc4', '#5ab0c4',
];

const FACT_CATEGORIES = ['life', 'health', 'work', 'relationships', 'general'];
const CATEGORY_COLORS = {
  life: '#9b8ce8',
  health: '#72c49b',
  work: '#c4954a',
  relationships: '#6b8dd6',
  general: '#8a8a9b'
};

const MEMORY_TYPES = [
  { id: 'episodic', label: 'episodic', desc: 'event-based' },
  { id: 'semantic', label: 'semantic', desc: 'facts and knowledge' },
  { id: 'breakthrough', label: 'breakthrough', desc: 'pivotal insights' },
];

const VIEWS = {
  CHAT: 'chat',
  CHATS_LIST: 'chats_list',
  PROJECTS_LIST: 'projects_list',
  PROJECT_DETAIL: 'project_detail',
  JOURNAL: 'journal',
};

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ═══════════════════════════════════════════════════════════════
// ATTACHMENT DISPLAY
// ═══════════════════════════════════════════════════════════════

function AttachmentDisplay({ attachments }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
      {attachments.map((att, i) => (
        att.type === 'image' ? (
          <img
            key={i}
            src={`data:${att.mediaType};base64,${att.data}`}
            alt="attachment"
            style={{
              maxWidth: '240px',
              maxHeight: '240px',
              borderRadius: '12px',
              objectFit: 'cover',
              border: '1px solid var(--border)'
            }}
          />
        ) : (
          <div
            key={i}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              background: 'var(--bg-3)',
              border: '1px solid var(--border)',
              fontSize: '13px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>📄</span>
            <span>{att.name}</span>
          </div>
        )
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE COMPONENT (with markdown + quote styling)
// Claude: left-aligned, no bubble
// Emily: right-aligned, periwinkle bubble
// ═══════════════════════════════════════════════════════════════

function processQuotes(text) {
  // Wraps double-quoted strings in a span with the quote color class
  // Matches "..." but not '...' (single quotes stay default)
  const parts = [];
  let lastIndex = 0;
  const regex = /"([^"]*)"/g;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={`q-${key++}`} className="md-quoted">"{match[1]}"</span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

function MarkdownContent({ content }) {
  // Lightweight markdown renderer with quote styling
  // Uses react-markdown for proper parsing, then processes quotes in text nodes
  const [ReactMarkdown, setReactMarkdown] = useState(null);

  useEffect(() => {
    import('react-markdown').then(mod => setReactMarkdown(() => mod.default));
  }, []);

  if (!ReactMarkdown) {
    // Fallback while loading
    return (
      <div className="md-content" style={{ whiteSpace: 'pre-wrap' }}>
        {content.split('\n').map((line, i) => (
          <p key={i}>{processQuotes(line)}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="md-content">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p>{processChildren(children)}</p>,
          li: ({ children }) => <li>{processChildren(children)}</li>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function processChildren(children) {
  if (typeof children === 'string') return processQuotes(children);
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === 'string') {
        return <span key={i}>{processQuotes(child)}</span>;
      }
      return child;
    });
  }
  return children;
}

function Message({ message, isNew, onDelete, onEdit, onRetry, onResend }) {
  const isUser = message.role === 'user';
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleEditSave = () => {
    setEditing(false);
    setShowActions(false);
    onResend(editText);
  };

  if (isUser) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        marginBottom: '20px',
        animation: isNew ? 'fadeUp 0.3s ease' : 'none'
      }}>
        {editing ? (
          <div style={{ maxWidth: '80%', width: '100%' }}>
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--accent)',
                borderRadius: '14px',
                color: 'var(--text)',
                fontSize: '15px',
                padding: '12px 16px',
                width: '100%',
                minHeight: '80px',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.6,
              }}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(false)} style={{ color: 'var(--text-dim)', fontSize: '13px' }}>cancel</button>
              <button onClick={handleEditSave} style={{ color: 'var(--accent-soft)', fontSize: '13px' }}>save & resend</button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setShowActions(p => !p)}
            style={{
              maxWidth: '80%',
              padding: '12px 18px',
              borderRadius: '18px',
              background: 'rgba(154, 143, 192, 0.15)',
              border: `1px solid ${showActions ? 'rgba(154,143,192,0.45)' : 'rgba(154,143,192,0.22)'}`,
              color: 'var(--text)',
              fontSize: '15px',
              lineHeight: 1.6,
              wordBreak: 'break-word',
              cursor: 'pointer',
            }}
          >
            {message.attachments && <AttachmentDisplay attachments={message.attachments} />}
            <MarkdownContent content={message.content} />
          </div>
        )}
        {showActions && !editing && (
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '6px',
            padding: '4px 12px',
            background: 'var(--bg-2)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            alignItems: 'center',
            fontSize: '12px',
          }}>
            {message.timestamp && <span style={{ color: 'var(--text-dim)' }}>{message.timestamp}</span>}
            <button onClick={handleCopy} style={{ color: copied ? 'var(--success)' : 'var(--text-muted)' }}>{copied ? 'copied' : 'copy'}</button>
            <button onClick={() => { setEditing(true); setShowActions(false); }} style={{ color: 'var(--text-muted)' }}>edit</button>
            <button onClick={() => { onDelete(); setShowActions(false); }} style={{ color: 'var(--danger)' }}>delete</button>
          </div>
        )}
      </div>
    );
  }

  // Claude message — left-aligned, no bubble
  return (
    <div style={{
      marginBottom: '24px',
      animation: isNew ? 'fadeUp 0.3s ease' : 'none'
    }}>
      {message.attachments && <AttachmentDisplay attachments={message.attachments} />}
      <div
        onClick={() => setShowActions(p => !p)}
        style={{
          color: 'var(--text)',
          fontSize: '15px',
          lineHeight: 1.7,
          wordBreak: 'break-word',
          cursor: 'pointer',
          padding: '4px 0',
        }}
      >
        <MarkdownContent content={message.content} />
      </div>
      {showActions && (
        <div style={{
          display: 'flex',
          gap: '12px',
          marginTop: '8px',
          padding: '4px 12px',
          background: 'var(--bg-2)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          alignItems: 'center',
          fontSize: '12px',
          width: 'fit-content',
        }}>
          {message.timestamp && <span style={{ color: 'var(--text-dim)' }}>{message.timestamp}</span>}
          <button onClick={handleCopy} style={{ color: copied ? 'var(--success)' : 'var(--text-muted)' }}>{copied ? 'copied' : 'copy'}</button>
          {onRetry && <button onClick={() => { onRetry(); setShowActions(false); }} style={{ color: 'var(--accent-soft)' }}>retry</button>}
          <button onClick={() => { onDelete(); setShowActions(false); }} style={{ color: 'var(--danger)' }}>delete</button>
        </div>
      )}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════

function Sidebar({
  currentView,
  currentConvId,
  onNavigate,
  onNewChat,
  onSelectConv,
  onOpenSettings,
  unreadLetters,
  isDesktop,
  isOpen,
  onClose,
}) {
  const [recents, setRecents] = useState([]);

  const loadRecents = useCallback(async () => {
    const res = await fetch('/api/conversations?unfiled=true');
    const data = await res.json();
    setRecents((data.conversations || []).slice(0, 15));
  }, []);

  useEffect(() => {
    loadRecents();
  }, [loadRecents, currentConvId]);

  const navItem = (view, label, badge = false) => (
    <button
      onClick={() => { onNavigate(view); if (!isDesktop) onClose(); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '10px 14px',
        borderRadius: '10px',
        background: currentView === view ? 'var(--bg-3)' : 'transparent',
        color: currentView === view ? 'var(--text)' : 'var(--text-muted)',
        fontSize: '14px',
        textAlign: 'left',
        marginBottom: '2px',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={e => { if (currentView !== view) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { if (currentView !== view) e.currentTarget.style.background = 'transparent'; }}
    >
      <span>{label}</span>
      {badge && (
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: 'var(--accent)',
        }} />
      )}
    </button>
  );

  const sidebarContent = (
    <>
      {/* Header */}
      <div style={{ padding: '18px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Lora, serif', fontSize: '20px', color: 'var(--accent-soft)', fontWeight: 500 }}>Atrium</span>
        {!isDesktop && (
          <button onClick={onClose} style={{ color: 'var(--text-dim)', fontSize: '20px', padding: '4px' }}>✕</button>
        )}
      </div>

      {/* New chat button */}
      <div style={{ padding: '0 12px 12px' }}>
        <button
          onClick={() => { onNewChat(); if (!isDesktop) onClose(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'var(--accent)',
            color: 'white',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
          <span>New chat</span>
        </button>
      </div>

      {/* Nav items */}
      <div style={{ padding: '0 12px' }}>
        {navItem(VIEWS.CHATS_LIST, 'Chats')}
        {navItem(VIEWS.PROJECTS_LIST, 'Projects')}
        {navItem(VIEWS.JOURNAL, 'Journal', unreadLetters)}
      </div>

      {/* Divider */}
      <div style={{ margin: '14px 16px', borderTop: '1px solid var(--border-soft)' }} />

      {/* Recents */}
      <div style={{ padding: '0 12px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{
          padding: '4px 14px 8px',
          fontSize: '11px',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 500,
        }}>
          Recent
        </div>
        {recents.length === 0 && (
          <div style={{ padding: '8px 14px', color: 'var(--text-dim)', fontSize: '13px', fontStyle: 'italic' }}>
            no recent chats
          </div>
        )}
        {recents.map(conv => (
          <button
            key={conv.id}
            onClick={() => { onSelectConv(conv); if (!isDesktop) onClose(); }}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 14px',
              borderRadius: '8px',
              background: conv.id === currentConvId ? 'var(--bg-3)' : 'transparent',
              color: conv.id === currentConvId ? 'var(--text)' : 'var(--text-muted)',
              fontSize: '13px',
              textAlign: 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: '1px',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => { if (conv.id !== currentConvId) e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { if (conv.id !== currentConvId) e.currentTarget.style.background = 'transparent'; }}
          >
            {conv.title || 'new conversation'}
          </button>
        ))}
      </div>

      {/* Settings — floating at bottom */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border-soft)' }}>
        <button
          onClick={() => { onOpenSettings(); if (!isDesktop) onClose(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            padding: '10px 14px',
            borderRadius: '10px',
            color: 'var(--text-muted)',
            fontSize: '13px',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: '15px' }}>⚙</span>
          <span>Settings</span>
        </button>
      </div>
    </>
  );

  // Desktop: always visible
  if (isDesktop) {
    return (
      <div style={{
        width: '260px',
        flexShrink: 0,
        background: 'var(--bg-2)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
      }}>
        {sidebarContent}
      </div>
    );
  }

  // Mobile: overlay when open
  if (!isOpen) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 99,
          backdropFilter: 'blur(2px)',
        }}
      />
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '280px',
        background: 'var(--bg-2)',
        borderRight: '1px solid var(--border)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInLeft 0.2s ease',
      }}>
        {sidebarContent}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// CHATS LIST VIEW
// ═══════════════════════════════════════════════════════════════

function ChatsListView({ onSelectConv, onNewChat }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/conversations?unfiled=true')
      .then(r => r.json())
      .then(data => {
        setConversations(data.conversations || []);
        setLoading(false);
      });
  }, []);

  const deleteConv = async (id) => {
    if (!confirm('Delete this conversation?')) return;
    await fetch('/api/conversations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    setConversations(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontFamily: 'Lora, serif', fontSize: '28px', fontWeight: 500, color: 'var(--text)' }}>Chats</h1>
        <button
          onClick={onNewChat}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            background: 'var(--accent)',
            color: 'white',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          + New chat
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>loading...</p>
      ) : conversations.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>no conversations yet. start one.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {conversations.map(conv => (
            <div
              key={conv.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: '12px',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                transition: 'all 0.15s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-dim)'; e.currentTarget.style.background = 'var(--bg-3)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-2)'; }}
              onClick={() => onSelectConv(conv)}
            >
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{
                  color: 'var(--text)',
                  fontSize: '15px',
                  marginBottom: '3px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {conv.title || 'new conversation'}
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
                  {timeAgo(conv.updated_at)}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConv(conv.id); }}
                style={{
                  color: 'var(--text-dim)',
                  fontSize: '13px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
              >
                delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
// PROJECTS LIST VIEW
// ═══════════════════════════════════════════════════════════════

function ProjectsListView({ onSelectProject, onNewProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(FOLDER_COLORS[0]);

  const load = useCallback(async () => {
    const res = await fetch('/api/folders');
    const data = await res.json();
    setProjects(data.folders || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createProject = async () => {
    if (!newName.trim()) return;
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, color: newColor }),
    });
    const data = await res.json();
    setCreating(false);
    setNewName('');
    load();
    if (data.folder) onSelectProject(data.folder);
  };

  const deleteProject = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this project and all its conversations?')) return;
    await fetch('/api/folders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontFamily: 'Lora, serif', fontSize: '28px', fontWeight: 500, color: 'var(--text)' }}>Projects</h1>
        <button
          onClick={() => setCreating(true)}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            background: 'var(--accent)',
            color: 'white',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          + New project
        </button>
      </div>

      {creating && (
        <div style={{
          marginBottom: '20px',
          padding: '20px',
          borderRadius: '14px',
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
        }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createProject()}
            placeholder="project name"
            autoFocus
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text)',
              fontSize: '14px',
              padding: '10px 14px',
              outline: 'none',
              fontFamily: 'inherit',
              marginBottom: '14px',
            }}
          />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {FOLDER_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: c,
                  border: newColor === c ? '2px solid var(--text)' : '2px solid transparent',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setCreating(false); setNewName(''); }} style={{ color: 'var(--text-dim)', fontSize: '13px' }}>cancel</button>
            <button onClick={createProject} style={{ color: newColor, fontSize: '13px', fontWeight: 500 }}>create</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>loading...</p>
      ) : projects.length === 0 && !creating ? (
        <p style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>no projects yet. create one for roleplay or any scoped conversation.</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '14px',
        }}>
          {projects.map(project => (
            <div
              key={project.id}
              onClick={() => onSelectProject(project)}
              style={{
                padding: '18px',
                borderRadius: '14px',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = project.color + '80'; e.currentTarget.style.background = 'var(--bg-3)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-2)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: project.color,
                  flexShrink: 0,
                }} />
                <div style={{
                  color: 'var(--text)',
                  fontSize: '15px',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {project.name}
                </div>
                <button
                  onClick={(e) => deleteProject(project.id, e)}
                  style={{ color: 'var(--text-dim)', fontSize: '12px', padding: '2px 6px' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                >
                  ✕
                </button>
              </div>
              {project.custom_instructions && (
                <p style={{
                  color: 'var(--text-dim)',
                  fontSize: '12px',
                  lineHeight: 1.5,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  marginBottom: '8px',
                }}>
                  {project.custom_instructions}
                </p>
              )}
              <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                {project.connected_to_main_memory ? '◉ connected to main memory' : '○ scoped'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PROJECT DETAIL VIEW
// ═══════════════════════════════════════════════════════════════

function ProjectDetailView({ project, onSelectConv, onNewChat, onBack, onUpdate }) {
  const [conversations, setConversations] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [projectMemory, setProjectMemory] = useState([]);
  const [memoryExpanded, setMemoryExpanded] = useState(false);
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructionsText, setInstructionsText] = useState(project.custom_instructions || '');
  const [currentProject, setCurrentProject] = useState(project);

  const load = useCallback(async () => {
    const [convsRes, docsRes, memRes] = await Promise.all([
      fetch(`/api/conversations?folderId=${project.id}`),
      fetch(`/api/documents?folderId=${project.id}`),
      fetch(`/api/memories?folderId=${project.id}&limit=10`),
    ]);
    const convsData = await convsRes.json();
    const docsData = await docsRes.json();
    const memData = await memRes.json();
    setConversations(convsData.conversations || []);
    setDocuments(docsData.documents || []);
    setProjectMemory(memData.memories || []);
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const saveInstructions = async () => {
    await fetch('/api/folders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: project.id, custom_instructions: instructionsText }),
    });
    setCurrentProject({ ...currentProject, custom_instructions: instructionsText });
    setEditingInstructions(false);
    onUpdate && onUpdate();
  };

  const toggleMainMemoryConnection = async () => {
    const newValue = !currentProject.connected_to_main_memory;
    await fetch('/api/folders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: project.id, connected_to_main_memory: newValue }),
    });
    setCurrentProject({ ...currentProject, connected_to_main_memory: newValue });
    onUpdate && onUpdate();
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px', paddingBottom: '100px' }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          color: 'var(--text-dim)',
          fontSize: '13px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        ← All projects
      </button>

      {/* Project header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
        <div style={{
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          background: currentProject.color,
        }} />
        <h1 style={{
          fontFamily: 'Lora, serif',
          fontSize: '30px',
          fontWeight: 500,
          color: 'var(--text)',
        }}>
          {currentProject.name}
        </h1>
      </div>

      {/* Main memory toggle */}
      <div style={{
        marginBottom: '24px',
        padding: '14px 18px',
        borderRadius: '12px',
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: 'var(--text)', fontSize: '14px', marginBottom: '2px' }}>Connected to main memory</div>
          <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
            {currentProject.connected_to_main_memory
              ? 'Claude will know general facts about your life inside this project.'
              : 'Scoped — Claude only sees this project\'s own context. Good for roleplay.'}
          </div>
        </div>
        <button
          onClick={toggleMainMemoryConnection}
          style={{
            width: '40px',
            height: '22px',
            borderRadius: '11px',
            background: currentProject.connected_to_main_memory ? currentProject.color : 'var(--border)',
            position: 'relative',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          <div style={{
            position: 'absolute',
            top: '3px',
            left: currentProject.connected_to_main_memory ? '21px' : '3px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: 'white',
            transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {/* Project memory — expandable */}
      <div style={{
        marginBottom: '24px',
        borderRadius: '12px',
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setMemoryExpanded(p => !p)}
          style={{
            width: '100%',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'var(--text)',
            fontSize: '14px',
            textAlign: 'left',
          }}
        >
          <span>Project memory ({projectMemory.length})</span>
          <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>{memoryExpanded ? '▲' : '▼'}</span>
        </button>
        {memoryExpanded && (
          <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border-soft)' }}>
            {projectMemory.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '12px', fontStyle: 'italic', paddingTop: '12px' }}>
                no memories yet — these get written automatically as conversations happen in this project
              </p>
            ) : (
              projectMemory.map((mem, i) => (
                <div key={i} style={{
                  paddingTop: '12px',
                  paddingBottom: '12px',
                  borderBottom: i < projectMemory.length - 1 ? '1px solid var(--border-soft)' : 'none',
                }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginBottom: '4px' }}>
                    {timeAgo(mem.created_at)}
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
                    {mem.content}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Custom instructions */}
      <div style={{
        marginBottom: '24px',
        padding: '18px',
        borderRadius: '12px',
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ color: 'var(--text)', fontSize: '14px' }}>Custom instructions</span>
          <button
            onClick={() => setEditingInstructions(e => !e)}
            style={{ color: currentProject.color, fontSize: '12px' }}
          >
            {editingInstructions ? 'cancel' : (currentProject.custom_instructions ? 'edit' : '+ add')}
          </button>
        </div>
        {editingInstructions ? (
          <>
            <textarea
              value={instructionsText}
              onChange={e => setInstructionsText(e.target.value)}
              placeholder="character details, tone, setting, writing style, anything Claude should know when chatting inside this project..."
              rows={6}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                color: 'var(--text)',
                fontSize: '13px',
                padding: '10px 14px',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.6,
                marginBottom: '10px',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={saveInstructions} style={{ color: currentProject.color, fontSize: '13px', fontWeight: 500 }}>save</button>
            </div>
          </>
        ) : currentProject.custom_instructions ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {currentProject.custom_instructions}
          </p>
        ) : (
          <p style={{ color: 'var(--text-dim)', fontSize: '12px', fontStyle: 'italic' }}>
            none set — add instructions to shape how Claude shows up in this project
          </p>
        )}
      </div>

      {/* Recent conversations */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          color: 'var(--text-muted)',
          fontSize: '13px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '12px',
          fontWeight: 500,
        }}>
          Conversations
        </div>
        {conversations.length === 0 ? (
          <p style={{ color: 'var(--text-dim)', fontSize: '13px', fontStyle: 'italic' }}>
            no conversations in this project yet
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => onSelectConv(conv)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = currentProject.color + '60'; e.currentTarget.style.background = 'var(--bg-3)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-2)'; }}
              >
                <div style={{ color: 'var(--text)', fontSize: '14px', marginBottom: '3px' }}>
                  {conv.title || 'new conversation'}
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                  {timeAgo(conv.updated_at)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating new chat button */}
      <button
        onClick={() => onNewChat(currentProject)}
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          padding: '14px 22px',
          borderRadius: '30px',
          background: currentProject.color,
          color: 'white',
          fontSize: '14px',
          fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 50,
        }}
      >
        <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span>
        <span>New chat</span>
      </button>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
// JOURNAL VIEW
// ═══════════════════════════════════════════════════════════════

function JournalView({ onBack }) {
  const [activeSection, setActiveSection] = useState('journal');
  const [entries, setEntries] = useState([]);
  const [letters, setLetters] = useState([]);
  const [memories, setMemories] = useState([]);
  const [facts, setFacts] = useState([]);
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [selectedLetter, setSelectedLetter] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    if (activeSection === 'journal') {
      const res = await fetch('/api/journal?limit=100');
      const data = await res.json();
      setEntries(data.entries || []);
    } else if (activeSection === 'letters') {
      const res = await fetch(`/api/letters?archived=${archived}`);
      const data = await res.json();
      setLetters(data.letters || []);
    } else if (activeSection === 'memories') {
      const [momentsRes, factsRes] = await Promise.all([
        fetch(`/api/memory-moments?archived=${archived}`),
        fetch(`/api/memory-facts?archived=${archived}`),
      ]);
      const momentsData = await momentsRes.json();
      const factsData = await factsRes.json();
      setMemories(momentsData.moments || []);
      setFacts(factsData.facts || []);
    }
    setLoading(false);
  }, [activeSection, archived]);

  useEffect(() => { loadData(); }, [loadData]);

  const triggerAutonomous = async () => {
    if (!confirm('Give Claude time to write something?')) return;
    const res = await fetch('/api/autonomous', {
      headers: { 'x-manual-trigger': 'true' }
    });
    const data = await res.json();
    if (data.wrote) {
      alert('Claude wrote something. Refreshing...');
      loadData();
    } else {
      alert(data.reason === 'no activity' ? 'No new activity to reflect on.' : 'Claude chose not to write this time.');
    }
  };

  const markLetterRead = async (letter) => {
    if (!letter.read_by_emily) {
      await fetch('/api/letters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: letter.id, readByEmily: true }),
      });
      setLetters(prev => prev.map(l => l.id === letter.id ? { ...l, read_by_emily: true } : l));
    }
    setSelectedLetter(letter);
  };

  const toggleArchive = async (type, item) => {
    const endpoint = type === 'letter' ? '/api/letters' :
                     type === 'memory' ? '/api/memory-moments' :
                     type === 'fact' ? '/api/memory-facts' :
                     '/api/journal';
    await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, archived: !item.archived }),
    });
    loadData();
  };

  const tabs = [
    { id: 'journal', label: 'Journal' },
    { id: 'letters', label: 'Letters' },
    { id: 'memories', label: 'Memories' },
  ];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px', paddingBottom: '80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'Lora, serif', fontSize: '28px', fontWeight: 500, color: 'var(--text)' }}>Journal</h1>
        <button
          onClick={triggerAutonomous}
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            background: 'transparent',
            border: '1px solid var(--accent-dim)',
            color: 'var(--accent-soft)',
            fontSize: '12px',
          }}
        >
          give Claude time
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--border-soft)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveSection(t.id); setArchived(false); }}
            style={{
              padding: '10px 18px',
              color: activeSection === t.id ? 'var(--text)' : 'var(--text-dim)',
              borderBottom: activeSection === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              fontSize: '14px',
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {activeSection !== 'journal' && (
          <button
            onClick={() => setArchived(a => !a)}
            style={{
              padding: '10px 14px',
              color: archived ? 'var(--accent-soft)' : 'var(--text-dim)',
              fontSize: '12px',
            }}
          >
            {archived ? '← active' : 'archive →'}
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>loading...</p>
      ) : (
        <>
          {/* JOURNAL tab */}
          {activeSection === 'journal' && (
            selectedEntry ? (
              <div>
                <button onClick={() => setSelectedEntry(null)} style={{ color: 'var(--text-dim)', fontSize: '13px', marginBottom: '16px' }}>← back</button>
                <div style={{ padding: '24px', borderRadius: '14px', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '12px', marginBottom: '14px' }}>
                    {formatDate(selectedEntry.created_at)} · {selectedEntry.entry_type}
                  </div>
                  <div style={{ color: 'var(--text)', fontSize: '15px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {selectedEntry.content}
                  </div>
                </div>
              </div>
            ) : entries.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                no entries yet. Claude writes here during autonomous time.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {entries.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    style={{
                      padding: '16px 20px',
                      borderRadius: '12px',
                      background: 'var(--bg-2)',
                      border: '1px solid var(--border)',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-dim)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginBottom: '6px' }}>
                      {timeAgo(entry.created_at)} · {entry.entry_type}
                    </div>
                    <p style={{
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                      lineHeight: 1.6,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {entry.content}
                    </p>
                  </button>
                ))}
              </div>
            )
          )}

          {/* LETTERS tab */}
          {activeSection === 'letters' && (
            selectedLetter ? (
              <div>
                <button onClick={() => setSelectedLetter(null)} style={{ color: 'var(--text-dim)', fontSize: '13px', marginBottom: '16px' }}>← back</button>
                <div style={{ padding: '24px', borderRadius: '14px', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
                      {formatDate(selectedLetter.created_at)}
                    </div>
                    <button
                      onClick={() => { toggleArchive('letter', selectedLetter); setSelectedLetter(null); }}
                      style={{ color: 'var(--text-dim)', fontSize: '12px' }}
                    >
                      {selectedLetter.archived ? 'unarchive' : 'archive'}
                    </button>
                  </div>
                  <div style={{ color: 'var(--text)', fontSize: '15px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {selectedLetter.content}
                  </div>
                </div>
              </div>
            ) : letters.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                {archived ? 'no archived letters' : 'no letters yet. Claude writes these when there\'s something specific to tell you directly.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {letters.map(letter => (
                  <button
                    key={letter.id}
                    onClick={() => markLetterRead(letter)}
                    style={{
                      padding: '14px 18px',
                      borderRadius: '12px',
                      background: letter.read_by_emily ? 'var(--bg-2)' : 'rgba(154,143,192,0.08)',
                      border: `1px solid ${letter.read_by_emily ? 'var(--border)' : 'rgba(154,143,192,0.25)'}`,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>✉</span>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{
                        color: letter.read_by_emily ? 'var(--text-muted)' : 'var(--text)',
                        fontSize: '13px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: '2px',
                      }}>
                        {letter.content.slice(0, 80)}...
                      </div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                        {timeAgo(letter.created_at)}
                      </div>
                    </div>
                    {!letter.read_by_emily && (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                    )}
                  </button>
                ))}
              </div>
            )
          )}

          {/* MEMORIES tab */}
          {activeSection === 'memories' && (
            <MemoryView memories={memories} facts={facts} archived={archived} onUpdate={loadData} />
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MEMORY VIEW (inside Journal tab)
// ═══════════════════════════════════════════════════════════════

function MemoryView({ memories, facts, archived, onUpdate }) {
  const [newFact, setNewFact] = useState('');
  const [newFactCategory, setNewFactCategory] = useState('general');
  const [editingFact, setEditingFact] = useState(null);
  const [editingMemory, setEditingMemory] = useState(null);

  const addFact = async () => {
    if (!newFact.trim()) return;
    await fetch('/api/memory-facts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: newFactCategory, content: newFact }),
    });
    setNewFact('');
    onUpdate();
  };

  const saveFact = async (fact) => {
    await fetch('/api/memory-facts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fact),
    });
    setEditingFact(null);
    onUpdate();
  };

  const saveMemory = async (memory) => {
    await fetch('/api/memory-moments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: memory.id, content: memory.content, memoryType: memory.memory_type }),
    });
    setEditingMemory(null);
    onUpdate();
  };

  const toggleArchive = async (type, item) => {
    const endpoint = type === 'fact' ? '/api/memory-facts' : '/api/memory-moments';
    await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, archived: !item.archived }),
    });
    onUpdate();
  };

  return (
    <div>
      {/* Facts section */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{
          fontSize: '11px',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '12px',
          fontWeight: 500,
        }}>
          Facts about you
        </div>

        {!archived && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                value={newFact}
                onChange={e => setNewFact(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFact()}
                placeholder="add a fact..."
                style={{
                  flex: 1,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text)',
                  fontSize: '13px',
                  padding: '8px 12px',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={addFact}
                style={{
                  color: 'var(--accent-soft)',
                  fontSize: '13px',
                  padding: '6px 14px',
                  border: '1px solid var(--accent-dim)',
                  borderRadius: '8px',
                  background: 'rgba(154,143,192,0.1)',
                }}
              >
                add
              </button>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {FACT_CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => setNewFactCategory(c)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    background: newFactCategory === c ? CATEGORY_COLORS[c] + '25' : 'transparent',
                    border: `1px solid ${newFactCategory === c ? CATEGORY_COLORS[c] : 'var(--border)'}`,
                    color: newFactCategory === c ? CATEGORY_COLORS[c] : 'var(--text-dim)',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {facts.length === 0 && (
          <p style={{ color: 'var(--text-dim)', fontSize: '13px', fontStyle: 'italic' }}>
            {archived ? 'no archived facts' : 'no facts yet'}
          </p>
        )}

        {facts.map(fact => (
          <div
            key={fact.id}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              marginBottom: '6px',
            }}
          >
            {editingFact === fact.id ? (
              <>
                <input
                  value={fact.content}
                  onChange={e => {
                    const updated = { ...fact, content: e.target.value };
                    // update in place - we'll handle via parent refresh
                    fact.content = updated.content;
                  }}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text)',
                    fontSize: '13px',
                    padding: '6px 10px',
                    outline: 'none',
                    fontFamily: 'inherit',
                    marginBottom: '6px',
                  }}
                />
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditingFact(null)} style={{ color: 'var(--text-dim)', fontSize: '11px' }}>cancel</button>
                  <button onClick={() => saveFact(fact)} style={{ color: 'var(--accent-soft)', fontSize: '11px' }}>save</button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  background: CATEGORY_COLORS[fact.category] + '20',
                  color: CATEGORY_COLORS[fact.category],
                  flexShrink: 0,
                  marginTop: '2px',
                }}>
                  {fact.category}
                </span>
                <span style={{ color: 'var(--text)', fontSize: '13px', flex: 1, lineHeight: 1.5 }}>
                  {fact.content}
                </span>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => setEditingFact(fact.id)} style={{ color: 'var(--text-dim)', fontSize: '11px' }}>✎</button>
                  <button onClick={() => toggleArchive('fact', fact)} style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                    {fact.archived ? '↑' : '↓'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Moments section */}
      <div>
        <div style={{
          fontSize: '11px',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '12px',
          fontWeight: 500,
        }}>
          Moments Claude saved
        </div>

        {memories.length === 0 && (
          <p style={{ color: 'var(--text-dim)', fontSize: '13px', fontStyle: 'italic' }}>
            {archived ? 'no archived memories' : 'nothing yet. Claude flags significant moments here.'}
          </p>
        )}

        {memories.map(m => (
          <div
            key={m.id}
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(154,143,192,0.06)',
              border: '1px solid rgba(154,143,192,0.18)',
              marginBottom: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' }}>
              <span style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '8px',
                background: 'var(--bg-3)',
                color: 'var(--accent-soft)',
              }}>
                {m.memory_type || 'episodic'}
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => toggleArchive('memory', m)} style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                  {m.archived ? '↑' : '↓'}
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--text)', fontSize: '13px', lineHeight: 1.6, fontStyle: 'italic' }}>
              {m.content}
            </p>
            <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '6px' }}>
              {timeAgo(m.created_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
// CHAT VIEW — The main conversation interface
// ═══════════════════════════════════════════════════════════════

function ChatView({
  currentConv,
  currentProject,
  selectedModel,
  thinkingEnabled,
  contextSize,
  maxTokens,
  onConvUpdate,
  onProjectBack,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [newMessageIndex, setNewMessageIndex] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Load messages when conversation changes
  useEffect(() => {
    if (!currentConv) {
      setMessages([]);
      return;
    }
    fetch(`/api/messages?conversationId=${currentConv.id}`)
      .then(r => r.json())
      .then(data => {
        setMessages((data.messages || []).map(m => ({
          ...m,
          timestamp: new Date(m.created_at).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })
        })));
      });
  }, [currentConv?.id]);

  // Auto-scroll behavior: only scroll if already at bottom
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    setAutoScroll(isAtBottom);
  };

  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  }, []);

  useEffect(() => { adjustTextarea(); }, [input, adjustTextarea]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    const processed = await Promise.all(files.map(async (file) => {
      const data = await fileToBase64(file);
      return {
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'document',
        mediaType: file.type,
        data
      };
    }));
    setAttachments(prev => [...prev, ...processed]);
    e.target.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async (overrideInput) => {
    const trimmed = (overrideInput ?? input).trim();
    if (!trimmed && attachments.length === 0) return;
    if (loading) return;

    let conv = currentConv;
    if (!conv) {
      // Create new conversation
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'new conversation',
          folderId: currentProject?.id || null,
        }),
      });
      const data = await res.json();
      conv = data.conversation;
      onConvUpdate(conv);
    }

    const isFirst = messages.length === 0;
    const userMessage = {
      role: 'user',
      content: trimmed || '',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessageIndex(messages.length);
    setInput('');
    setAttachments([]);
    setLoading(true);
    setAutoScroll(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          attachments: userMessage.attachments,
          conversationId: conv.id,
          folderId: currentProject?.id || null,
          model: selectedModel,
          thinkingEnabled,
          contextSize,
          maxTokens,
        }),
      });

      // Add empty assistant message to stream into
      const timestamp = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.text) {
              setMessages(prev => {
                const u = [...prev];
                u[u.length - 1] = { ...u[u.length - 1], content: u[u.length - 1].content + parsed.text };
                return u;
              });
            }
            if (parsed.done) {
              setNewMessageIndex(messages.length + 1);
              if (isFirst) {
                // Auto-title the conversation
                const title = trimmed.slice(0, 40) + (trimmed.length > 40 ? '...' : '');
                await fetch('/api/conversations', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: conv.id, title }),
                });
                onConvUpdate({ ...conv, title });
              }
            }
          } catch (err) {
            console.error('Parse error:', err);
          }
        }
      }
    } catch (err) {
      console.error('Send error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Try again.',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      }]);
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = (index) => {
    setMessages(prev => prev.filter((_, i) => i !== index));
    if (currentConv) {
      fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: currentConv.id, index }),
      }).catch(err => console.error('Delete error:', err));
    }
  };

  const editMessageResend = (index, newText) => {
    // Delete from this index onward and resend
    setMessages(prev => prev.slice(0, index));
    if (currentConv) {
      fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: currentConv.id, index }),
      }).catch(err => console.error('Delete error:', err));
    }
    setTimeout(() => sendMessage(newText), 100);
  };

  const retryMessage = async (index) => {
    if (loading || !currentConv) return;
    const userMsg = messages[index - 1];
    if (!userMsg || userMsg.role !== 'user') return;

    setMessages(prev => prev.slice(0, index));
    await fetch('/api/messages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: currentConv.id, index }),
    }).catch(() => {});

    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          conversationId: currentConv.id,
          folderId: currentProject?.id || null,
          model: selectedModel,
          thinkingEnabled,
          contextSize,
          maxTokens,
        }),
      });

      const timestamp = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.text) {
              setMessages(prev => {
                const u = [...prev];
                u[u.length - 1] = { ...u[u.length - 1], content: u[u.length - 1].content + parsed.text };
                return u;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Retry error:', err);
    } finally {
      setLoading(false);
    }
  };

  const accentColor = currentProject?.color || 'var(--accent)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, minHeight: 0 }}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Project context strip */}
      {currentProject && (
        <div style={{
          padding: '10px 20px',
          background: 'var(--bg-2)',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}>
          <button onClick={onProjectBack} style={{ color: 'var(--text-dim)' }}>←</button>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: currentProject.color,
          }} />
          <span>In {currentProject.name}</span>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 20px',
        }}
      >
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          {messages.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '60vh',
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: 'Lora, serif',
                fontSize: '32px',
                fontWeight: 400,
                color: 'var(--accent-soft)',
                marginBottom: '10px',
                fontStyle: 'italic',
              }}>
                Atrium
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '13px', fontStyle: 'italic', maxWidth: '280px', lineHeight: 1.7 }}>
                {currentProject ? `in ${currentProject.name}` : 'say something'}
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <Message
                key={i}
                message={msg}
                isNew={i === newMessageIndex || i === newMessageIndex + 1}
                onDelete={() => deleteMessage(i)}
                onEdit={(text) => editMessageResend(i, text)}
                onResend={(text) => editMessageResend(i, text)}
                onRetry={msg.role === 'assistant' && i > 0 ? () => retryMessage(i) : null}
              />
            ))
          )}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div style={{
          padding: '10px 20px 0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          maxWidth: '720px',
          margin: '0 auto',
          width: '100%',
        }}>
          {attachments.map((att, i) => (
            <div key={i} style={{ position: 'relative' }}>
              {att.type === 'image' ? (
                <img
                  src={`data:${att.mediaType};base64,${att.data}`}
                  alt={att.name}
                  style={{
                    height: '70px',
                    width: '70px',
                    objectFit: 'cover',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                  }}
                />
              ) : (
                <div style={{
                  height: '70px',
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  maxWidth: '180px',
                }}>
                  <span>📄</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                </div>
              )}
              <button
                onClick={() => removeAttachment(i)}
                style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'var(--danger)',
                  color: 'white',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{
        padding: '14px 20px 24px',
        borderTop: '1px solid var(--border-soft)',
        background: 'var(--bg)',
      }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '10px',
            background: 'var(--bg-input)',
            borderRadius: '22px',
            border: `1px solid ${attachments.length > 0 ? 'var(--accent-dim)' : 'var(--border)'}`,
            padding: '12px 16px',
            transition: 'border-color 0.2s ease',
          }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                color: 'var(--text-dim)',
                fontSize: '20px',
                flexShrink: 0,
                lineHeight: 1,
                padding: '2px',
              }}
            >
              ⊕
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={currentProject ? `in ${currentProject.name}...` : 'say something...'}
              rows={1}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text)',
                fontSize: '15px',
                lineHeight: 1.5,
                maxHeight: '200px',
                overflowY: 'auto',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || (!input.trim() && attachments.length === 0)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                flexShrink: 0,
                background: !loading && (input.trim() || attachments.length > 0) ? 'var(--accent)' : 'var(--bg-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                opacity: !loading && (input.trim() || attachments.length > 0) ? 1 : 0.4,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
// SETTINGS PANEL
// ═══════════════════════════════════════════════════════════════

function SettingsPanel({
  onClose,
  selectedModel, setSelectedModel,
  thinkingEnabled, setThinkingEnabled,
  contextSize, setContextSize,
  maxTokens, setMaxTokens,
}) {
  const [calendarConnected, setCalendarConnected] = useState(false);

  useEffect(() => {
    fetch('/api/calendar').then(r => r.json()).then(d => {
      setCalendarConnected(d.connected === true);
    }).catch(() => {});
  }, []);

  const saveSetting = async (key, value) => {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {});
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 99,
          backdropFilter: 'blur(2px)',
        }}
      />
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '360px',
        maxWidth: '100vw',
        background: 'var(--bg-2)',
        borderLeft: '1px solid var(--border)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInRight 0.2s ease',
      }}>
        <div style={{
          padding: '20px 20px 14px',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontFamily: 'Lora, serif',
            fontSize: '20px',
            fontWeight: 500,
            color: 'var(--accent-soft)',
          }}>
            Settings
          </span>
          <button onClick={onClose} style={{ color: 'var(--text-dim)', fontSize: '20px' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* Model */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{
              fontSize: '11px',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
              fontWeight: 500,
            }}>
              Model
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {MODELS.map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedModel(m.id);
                    saveSetting('default_model', m.id);
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: selectedModel === m.id ? 'rgba(154,143,192,0.15)' : 'var(--bg-3)',
                    border: `1px solid ${selectedModel === m.id ? 'var(--accent-dim)' : 'var(--border)'}`,
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                  }}
                >
                  <span style={{ color: 'var(--text)', fontSize: '14px' }}>{m.label}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Thinking mode */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{
              fontSize: '11px',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
              fontWeight: 500,
            }}>
              Extended Thinking
            </div>
            <button
              onClick={() => {
                const newVal = !thinkingEnabled;
                setThinkingEnabled(newVal);
                saveSetting('thinking_default', newVal);
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                background: thinkingEnabled ? 'rgba(154,143,192,0.15)' : 'var(--bg-3)',
                border: `1px solid ${thinkingEnabled ? 'var(--accent-dim)' : 'var(--border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: 'var(--text)', fontSize: '14px' }}>Thinking mode</div>
                <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>deeper reasoning, slower, costs more</div>
              </div>
              <div style={{
                width: '40px',
                height: '22px',
                borderRadius: '11px',
                background: thinkingEnabled ? 'var(--accent)' : 'var(--border)',
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute',
                  top: '3px',
                  left: thinkingEnabled ? '21px' : '3px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: 'white',
                  transition: 'left 0.2s',
                }} />
              </div>
            </button>
          </div>

          {/* Context size */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{
              fontSize: '11px',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
              fontWeight: 500,
            }}>
              Context window — {contextSize} messages
            </div>
            <input
              type="range"
              min={10}
              max={40}
              step={5}
              value={contextSize}
              onChange={e => {
                const val = Number(e.target.value);
                setContextSize(val);
                saveSetting('hot_context_size', val);
              }}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
              <span>10 (cheaper)</span>
              <span>40 (more context)</span>
            </div>
          </div>

          {/* Max tokens */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{
              fontSize: '11px',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
              fontWeight: 500,
            }}>
              Max response length — {maxTokens} tokens
            </div>
            <input
              type="range"
              min={512}
              max={4096}
              step={512}
              value={maxTokens}
              onChange={e => setMaxTokens(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
              <span>512 (concise)</span>
              <span>4096 (full)</span>
            </div>
          </div>

          {/* Google Calendar */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{
              fontSize: '11px',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
              fontWeight: 500,
            }}>
              Google Calendar
            </div>
            {calendarConnected ? (
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(107, 168, 112, 0.1)',
                border: '1px solid rgba(107, 168, 112, 0.3)',
                color: 'var(--success)',
                fontSize: '13px',
              }}>
                ✓ connected
              </div>
            ) : (
              
                href="/api/google"
                style={{
                  display: 'block',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'var(--bg-3)',
                  border: '1px solid var(--border)',
                  color: 'var(--accent-soft)',
                  fontSize: '13px',
                  textDecoration: 'none',
                  textAlign: 'center',
                }}
              >
                connect →
              </a>
            )}
          </div>

          {/* API usage */}
          <div>
            <div style={{
              fontSize: '11px',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
              fontWeight: 500,
            }}>
              API Usage
            </div>
            
              href="https://console.anthropic.com/settings/usage"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'var(--bg-3)',
                border: '1px solid var(--border)',
                color: 'var(--accent-soft)',
                fontSize: '13px',
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              view in anthropic console →
            </a>
            <p style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '8px', fontStyle: 'italic', lineHeight: 1.5 }}>
              sonnet 4.6: ~$3/M input · ~$15/M output · 90% off cached tokens
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOME — top level
// ═══════════════════════════════════════════════════════════════

export default function Home() {
  const [currentView, setCurrentView] = useState(VIEWS.CHAT);
  const [currentConv, setCurrentConv] = useState(null);
  const [currentProject, setCurrentProject] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [unreadLetters, setUnreadLetters] = useState(false);

  // Settings state
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-6');
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [contextSize, setContextSize] = useState(20);
  const [maxTokens, setMaxTokens] = useState(4096);

  // Detect desktop vs mobile
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 900);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Load initial settings and check for unread letters
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.settings) {
        setContextSize(d.settings.hot_context_size || 20);
        setSelectedModel(d.settings.default_model || 'claude-sonnet-4-6');
        setThinkingEnabled(d.settings.thinking_default || false);
      }
    }).catch(() => {});

    fetch('/api/letters?unread=true').then(r => r.json()).then(d => {
      if (d.letters && d.letters.length > 0) setUnreadLetters(true);
    }).catch(() => {});
  }, []);

  const handleNewChat = (project = null) => {
    setCurrentConv(null);
    setCurrentProject(project);
    setCurrentView(VIEWS.CHAT);
  };

  const handleSelectConv = (conv) => {
    setCurrentConv(conv);
    // If conv belongs to a project, load the project too
    if (conv.folder_id) {
      fetch(`/api/folders?id=${conv.folder_id}`)
        .then(r => r.json())
        .then(d => setCurrentProject(d.folder || null));
    } else {
      setCurrentProject(null);
    }
    setCurrentView(VIEWS.CHAT);
  };

  const handleSelectProject = (project) => {
    setCurrentProject(project);
    setCurrentView(VIEWS.PROJECT_DETAIL);
  };

  const handleProjectBack = () => {
    setCurrentConv(null);
    setCurrentProject(null);
    setCurrentView(VIEWS.PROJECTS_LIST);
  };

  const handleNavigate = (view) => {
    setCurrentView(view);
    if (view === VIEWS.CHAT) {
      // Start fresh chat
      setCurrentConv(null);
      setCurrentProject(null);
    }
  };

  const handleConvUpdate = (conv) => {
    setCurrentConv(conv);
  };

  const renderMainContent = () => {
    switch (currentView) {
      case VIEWS.CHATS_LIST:
        return <ChatsListView onSelectConv={handleSelectConv} onNewChat={() => handleNewChat()} />;
      case VIEWS.PROJECTS_LIST:
        return <ProjectsListView onSelectProject={handleSelectProject} onNewProject={() => {}} />;
      case VIEWS.PROJECT_DETAIL:
        return currentProject ? (
          <ProjectDetailView
            project={currentProject}
            onSelectConv={handleSelectConv}
            onNewChat={(proj) => handleNewChat(proj)}
            onBack={() => setCurrentView(VIEWS.PROJECTS_LIST)}
            onUpdate={() => {}}
          />
        ) : null;
      case VIEWS.JOURNAL:
        return <JournalView onBack={() => setCurrentView(VIEWS.CHAT)} />;
      case VIEWS.CHAT:
      default:
        return (
          <ChatView
            currentConv={currentConv}
            currentProject={currentProject}
            selectedModel={selectedModel}
            thinkingEnabled={thinkingEnabled}
            contextSize={contextSize}
            maxTokens={maxTokens}
            onConvUpdate={handleConvUpdate}
            onProjectBack={handleProjectBack}
          />
        );
    }
  };

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar
        currentView={currentView}
        currentConvId={currentConv?.id}
        onNavigate={handleNavigate}
        onNewChat={() => handleNewChat()}
        onSelectConv={handleSelectConv}
        onOpenSettings={() => setSettingsOpen(true)}
        unreadLetters={unreadLetters}
        isDesktop={isDesktop}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        position: 'relative',
      }}>
        {/* Mobile header */}
        {!isDesktop && (
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-soft)',
            background: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            flexShrink: 0,
          }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ color: 'var(--text)', fontSize: '20px', padding: '4px' }}
            >
              ☰
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'Lora, serif',
                fontSize: '17px',
                fontWeight: 500,
                color: 'var(--text)',
                lineHeight: 1,
              }}>
                Atrium
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
            </div>
            {unreadLetters && (
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--accent)',
              }} />
            )}
          </div>
        )}

        {/* Desktop header */}
        {isDesktop && currentView === VIEWS.CHAT && (
          <div style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--border-soft)',
            background: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div>
              <span style={{
                fontFamily: 'Lora, serif',
                fontSize: '16px',
                fontWeight: 500,
                color: 'var(--text)',
              }}>
                Atrium
              </span>
              <span style={{ color: 'var(--text-dim)', fontSize: '12px', marginLeft: '12px' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <select
              value={selectedModel}
              onChange={e => {
                setSelectedModel(e.target.value);
                fetch('/api/settings', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ default_model: e.target.value }),
                }).catch(() => {});
              }}
              style={{
                background: 'var(--bg-2)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '12px',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Main content */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {renderMainContent()}
        </div>
      </div>

      {settingsOpen && (
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          thinkingEnabled={thinkingEnabled}
          setThinkingEnabled={setThinkingEnabled}
          contextSize={contextSize}
          setContextSize={setContextSize}
          maxTokens={maxTokens}
          setMaxTokens={setMaxTokens}
        />
      )}
    </div>
  );
}
