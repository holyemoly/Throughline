'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const MODES = {
  conversation: { label: 'conversation', color: '#9b72cf', symbol: '∿' },
  creative: { label: 'creative', color: '#6b8dd6', symbol: '◇' },
  practical: { label: 'practical', color: '#c4954a', symbol: '○' },
};

function MessageBubble({ message, isNew, onDelete, onEdit, onRetry }) {
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

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '16px',
      animation: isNew ? 'fadeUp 0.3s ease' : 'none',
    }}>
      {editing ? (
        <div style={{ maxWidth: '78%', width: '100%' }}>
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            style={{
              background: 'var(--bg-input)', border: '1px solid var(--purple)',
              borderRadius: '12px', color: 'var(--text)', fontSize: '14.5px',
              padding: '10px 14px', width: '100%', minHeight: '80px',
              outline: 'none', fontFamily: 'DM Sans, sans-serif',
            }}
          />
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px', justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(false)} style={{ color: 'var(--text-dim)', fontSize: '12px' }}>cancel</button>
            <button onClick={() => { onEdit(editText); setEditing(false); setShowActions(false); }} style={{ color: 'var(--purple)', fontSize: '12px' }}>save</button>
          </div>
        </div>
      ) : (
        <div onClick={() => setShowActions(p => !p)} style={{
          maxWidth: '78%', padding: '11px 16px',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          background: isUser ? 'rgba(155,114,207,0.18)' : 'rgba(42,38,64,0.9)',
          border: isUser
            ? `1px solid ${showActions ? 'rgba(155,114,207,0.5)' : 'rgba(155,114,207,0.25)'}`
            : `1px solid ${showActions ? 'rgba(107,141,214,0.4)' : 'rgba(46,42,66,0.8)'}`,
          color: 'var(--text)', fontSize: '14.5px', lineHeight: '1.65',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          cursor: 'pointer', transition: 'border-color 0.15s ease',
        }}>
          {message.content}
        </div>
      )}

      {showActions && !editing && (
        <div style={{
          display: 'flex', gap: '10px', marginTop: '6px',
          padding: '4px 10px', background: 'var(--bg-2)',
          borderRadius: '12px', border: '1px solid var(--border)',
        }}>
          <button onClick={handleCopy} style={{ color: copied ? '#7dc47d' : 'var(--text-muted)', fontSize: '12px', padding: '2px 4px' }}>
            {copied ? 'copied' : 'copy'}
          </button>
          {isUser && (
            <button onClick={() => { setEditing(true); setShowActions(false); }} style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '2px 4px' }}>
              edit
            </button>
          )}
          {!isUser && onRetry && (
            <button onClick={() => { onRetry(); setShowActions(false); }} style={{ color: '#6b8dd6', fontSize: '12px', padding: '2px 4px' }}>
              retry
            </button>
          )}
          <button onClick={() => { onDelete(); setShowActions(false); }} style={{ color: '#c4605a', fontSize: '12px', padding: '2px 4px' }}>
            delete
          </button>
          <button onClick={() => setShowActions(false)} style={{ color: 'var(--text-dim)', fontSize: '12px', padding: '2px 4px' }}>✕</button>
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
      <div style={{
        padding: '14px 18px', borderRadius: '18px 18px 18px 4px',
        background: 'rgba(42,38,64,0.9)', border: '1px solid rgba(46,42,66,0.8)',
        display: 'flex', gap: '5px', alignItems: 'center',
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: 'var(--text-muted)',
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

function Sidebar({ mode, currentConvId, onSelect, onNew, onClose }) {
  const [conversations, setConversations] = useState([]);
  const [renaming, setRenaming] = useState(null);
  const [renameText, setRenameText] = useState('');

  const loadConversations = useCallback(async () => {
    const res = await fetch(`/api/conversations?mode=${mode}`);
    const data = await res.json();
    setConversations(data.conversations || []);
  }, [mode]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const handleDelete = async (conv) => {
    if (!confirm(`Delete "${conv.title}"?`)) return;
    await fetch('/api/conversations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: conv.id, mode }),
    });
    loadConversations();
    if (conv.id === currentConvId) onNew();
  };

  const handleRename = async (conv) => {
    await fetch('/api/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: conv.id, title: renameText }),
    });
    setRenaming(null);
    loadConversations();
  };

  const currentMode = MODES[mode];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, bottom: 0, width: '280px',
      background: 'var(--bg-2)', borderRight: '1px solid var(--border)',
      zIndex: 100, display: 'flex', flexDirection: 'column',
      animation: 'slideIn 0.2s ease',
    }}>
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: 300, color: currentMode.color }}>
          {mode}
        </span>
        <button onClick={onClose} style={{ color: 'var(--text-dim)', fontSize: '18px', lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ padding: '12px' }}>
        <button onClick={onNew} style={{
          width: '100%', padding: '10px', borderRadius: '12px',
          border: `1px solid ${currentMode.color}40`,
          color: currentMode.color, fontSize: '13px',
          background: currentMode.color + '10',
          letterSpacing: '0.03em',
        }}>
          + new conversation
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
        {conversations.length === 0 && (
          <p style={{ color: 'var(--text-dim)', fontSize: '12px', textAlign: 'center', padding: '20px', fontStyle: 'italic' }}>
            no conversations yet
          </p>
        )}
        {conversations.map(conv => (
          <div key={conv.id} style={{
            padding: '10px 12px', borderRadius: '10px', marginBottom: '4px',
            background: conv.id === currentConvId ? currentMode.color + '15' : 'transparent',
            border: conv.id === currentConvId ? `1px solid ${currentMode.color}30` : '1px solid transparent',
            cursor: 'pointer',
          }}>
            {renaming === conv.id ? (
              <div onClick={e => e.stopPropagation()}>
                <input
                  value={renameText}
                  onChange={e => setRenameText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRename(conv)}
                  autoFocus
                  style={{
                    background: 'var(--bg-input)', border: '1px solid var(--purple)',
                    borderRadius: '6px', color: 'var(--text)', fontSize: '13px',
                    padding: '4px 8px', width: '100%', outline: 'none',
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button onClick={() => setRenaming(null)} style={{ color: 'var(--text-dim)', fontSize: '11px' }}>cancel</button>
                  <button onClick={() => handleRename(conv)} style={{ color: 'var(--purple)', fontSize: '11px' }}>save</button>
                </div>
              </div>
            ) : (
              <div onClick={() => { onSelect(conv); onClose(); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ color: 'var(--text)', fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.title}
                </span>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setRenaming(conv.id); setRenameText(conv.title); }} style={{ color: 'var(--text-dim)', fontSize: '11px' }}>✎</button>
                  <button onClick={() => handleDelete(conv)} style={{ color: '#c4605a', fontSize: '11px' }}>✕</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState('conversation');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentConv, setCurrentConv] = useState(null);
  const [newMessageIndex, setNewMessageIndex] = useState(null);
  const [wasTruncated, setWasTruncated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }
  }, []);

  useEffect(() => { adjustTextarea(); }, [input, adjustTextarea]);

  const createNewConversation = async (m) => {
    const modeToUse = m || mode;
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: modeToUse, title: 'new conversation' }),
    });
    const data = await res.json();
    setCurrentConv(data.conversation);
    setMessages([]);
    setWasTruncated(false);
    return data.conversation;
  };

  const loadConversation = async (conv) => {
    setCurrentConv(conv);
    setWasTruncated(false);
    const res = await fetch(`/api/messages?conversationId=${conv.id}&mode=${conv.mode}`);
    const data = await res.json();
    setMessages(data.messages || []);
  };

  const updateConvTitle = async (convId, firstMessage) => {
    const title = firstMessage.slice(0, 40) + (firstMessage.length > 40 ? '...' : '');
    await fetch('/api/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: convId, title }),
    });
  };

  const sendMessage = async (overrideInput) => {
    const trimmed = (overrideInput ?? input).trim();
    if (!trimmed || loading) return;

    setWasTruncated(false);

    if (trimmed === '.') {
      setMessages(prev => [...prev, { role: 'user', content: '.', silent: true }]);
      setInput('');
      return;
    }

    let conv = currentConv;
    if (!conv) {
      conv = await createNewConversation();
    }

    const isFirst = messages.length === 0;
    const userMessage = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMessage]);
    setNewMessageIndex(messages.length);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, mode, conversationId: conv.id }),
      });

      const data = await res.json();
      if (data.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
        setNewMessageIndex(messages.length + 1);
        setWasTruncated(data.stopReason === 'max_tokens');
        if (isFirst) updateConvTitle(conv.id, trimmed);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const continueMessage = async () => {
    if (loading || !currentConv) return;
    setWasTruncated(false);
    setLoading(true);

    const context = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '', mode, conversationId: currentConv.id, isContinue: true, continueContext: context }),
      });

      const data = await res.json();
      if (data.message) {
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx].role === 'assistant') {
            updated[lastIdx] = { ...updated[lastIdx], content: updated[lastIdx].content + ' ' + data.message };
          }
          return updated;
        });
        setWasTruncated(data.stopReason === 'max_tokens');
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong continuing.' }]);
    } finally {
      setLoading(false);
    }
  };

  const retryMessage = async (index) => {
    if (loading || !currentConv) return;
    const userMsg = messages[index - 1];
    if (!userMsg || userMsg.role !== 'user') return;

    setMessages(prev => prev.filter((_, i) => i !== index));
    setLoading(true);
    setWasTruncated(false);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, mode, conversationId: currentConv.id }),
      });

      const data = await res.json();
      if (data.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
        setWasTruncated(data.stopReason === 'max_tokens');
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong.' }]);
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = (index) => setMessages(prev => prev.filter((_, i) => i !== index));
  const editMessage = (index, newContent) => setMessages(prev => prev.map((m, i) => i === index ? { ...m, content: newContent } : m));

  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    setCurrentConv(null);
    setMessages([]);
    setWasTruncated(false);
    setSidebarOpen(false);
  };

  const currentMode = MODES[mode];

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
        @keyframes shimmer { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.6; } }
        @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      `}</style>

      {sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(2px)' }} />
          <Sidebar
            mode={mode}
            currentConvId={currentConv?.id}
            onSelect={loadConversation}
            onNew={() => { createNewConversation(); setSidebarOpen(false); }}
            onClose={() => setSidebarOpen(false)}
          />
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxWidth: '680px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          padding: '12px 16px 10px',
          borderBottom: '1px solid var(--border-soft)',
          background: 'rgba(27,24,40,0.97)',
          backdropFilter: 'blur(12px)',
          position: 'sticky', top: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <button onClick={() => setSidebarOpen(true)} style={{ color: 'var(--text-dim)', fontSize: '18px', lineHeight: 1, flexShrink: 0, padding: '4px' }}>
            ☰
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: '20px', letterSpacing: '0.04em', lineHeight: 1, flexShrink: 0 }}>
                Throughline
              </h1>
              {currentConv && currentConv.title !== 'new conversation' && (
                <span style={{ color: 'var(--text-dim)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  / {currentConv.title}
                </span>
              )}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.08em', marginTop: '2px', fontStyle: 'italic' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-2)', borderRadius: '20px', padding: '3px', border: '1px solid var(--border)', flexShrink: 0 }}>
            {Object.entries(MODES).map(([key, val]) => (
              <button key={key} onClick={() => handleModeSwitch(key)}
                style={{
                  padding: '4px 10px', borderRadius: '16px', fontSize: '10px', letterSpacing: '0.03em',
                  color: mode === key ? 'var(--text)' : 'var(--text-dim)',
                  background: mode === key ? val.color + '30' : 'transparent',
                  border: mode === key ? `1px solid ${val.color}50` : '1px solid transparent',
                  transition: 'all 0.2s ease',
                }}>
                {val.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: '2px', background: `linear-gradient(90deg, transparent, ${currentMode.color}50, transparent)`, transition: 'background 0.4s ease' }} />

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column' }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '36px', fontWeight: 300, color: currentMode.color, animation: 'shimmer 4s ease infinite', marginBottom: '12px' }}>
                {currentMode.symbol}
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '13px', fontStyle: 'italic', maxWidth: '220px', lineHeight: 1.7 }}>
                {mode === 'conversation' ? 'say something' : mode === 'creative' ? 'begin a story' : 'ask something practical'}
              </p>
            </div>
          )}

   
