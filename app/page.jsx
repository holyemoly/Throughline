'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const MODES = {
  conversation: { label: 'conversation', color: '#9b72cf' },
  creative: { label: 'creative', color: '#6b8dd6' },
  practical: { label: 'practical', color: '#c4954a' },
};

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function MessageBubble({ message, isNew, onDelete, onEdit }) {
  const isUser = message.role === 'user';
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
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
              background: 'var(--bg-input)',
              border: '1px solid var(--purple)',
              borderRadius: '12px',
              color: 'var(--text)',
              fontSize: '14.5px',
              padding: '10px 14px',
              width: '100%',
              minHeight: '80px',
              outline: 'none',
              fontFamily: 'DM Sans, sans-serif',
            }}
          />
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px', justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(false)} style={{ color: 'var(--text-dim)', fontSize: '12px' }}>cancel</button>
            <button onClick={() => { onEdit(editText); setEditing(false); setShowActions(false); }} style={{ color: 'var(--purple)', fontSize: '12px' }}>save</button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setShowActions(prev => !prev)}
          style={{
            maxWidth: '78%',
            padding: '11px 16px',
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            background: isUser ? 'rgba(155, 114, 207, 0.18)' : 'rgba(42, 38, 64, 0.9)',
            border: isUser
              ? \`1px solid \${showActions ? 'rgba(155,114,207,0.5)' : 'rgba(155,114,207,0.25)'}\`
              : \`1px solid \${showActions ? 'rgba(107,141,214,0.4)' : 'rgba(46,42,66,0.8)'}\`,
            color: 'var(--text)',
            fontSize: '14.5px',
            lineHeight: '1.65',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease',
          }}
        >
          {message.content}
        </div>
      )}

      {showActions && !editing && (
        <div style={{
          display: 'flex',
          gap: '12px',
          marginTop: '6px',
          padding: '4px 10px',
          background: 'var(--bg-2)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
        }}>
          {isUser && (
            <button onClick={() => { setEditing(true); setShowActions(false); }}
              style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '2px 4px' }}>
              edit
            </button>
          )}
          <button onClick={() => { onDelete(); setShowActions(false); }}
            style={{ color: '#c4605a', fontSize: '12px', padding: '2px 4px' }}>
            delete
          </button>
          <button onClick={() => setShowActions(false)}
            style={{ color: 'var(--text-dim)', fontSize: '12px', padding: '2px 4px' }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
      <div style={{
        padding: '14px 18px',
        borderRadius: '18px 18px 18px 4px',
        background: 'rgba(42, 38, 64, 0.9)',
        border: '1px solid rgba(46, 42, 66, 0.8)',
        display: 'flex',
        gap: '5px',
        alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: 'var(--text-muted)',
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
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
  const [conversationId] = useState(() => generateId());
  const [newMessageIndex, setNewMessageIndex] = useState(null);
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

  const sendMessage = async (overrideInput) => {
    const trimmed = (overrideInput ?? input).trim();
    if (!trimmed || loading) return;

    // Handle intentional silence
    if (trimmed === '.') {
      setMessages(prev => [...prev, { role: 'user', content: '.', silent: true }]);
      setInput('');
      return;
    }

    const userMessage = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMessage]);
    setNewMessageIndex(messages.length);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, mode, conversationId }),
      });

      const data = await res.json();
      if (data.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
        setNewMessageIndex(messages.length + 1);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = (index) => {
    setMessages(prev => prev.filter((_, i) => i !== index));
  };

  const editMessage = (index, newContent) => {
    setMessages(prev => prev.map((m, i) => i === index ? { ...m, content: newContent } : m));
  };

  const handleKeyDown = (e) => {
    // Enter sends only on desktop (non-mobile) with no shift
    // On mobile, Enter is just a new line — use the send button
    if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
      e.preventDefault();
      sendMessage();
    }
  };

  const currentMode = MODES[mode];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;1,9..40,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #1b1828; --bg-2: #221f30; --bg-3: #2a2640; --bg-input: #1f1c2d;
          --purple: #9b72cf; --blue-purple: #6b8dd6; --amber: #c4954a;
          --text: #e2ddf0; --text-muted: #9990b8; --text-dim: #6b6490;
          --border: #2e2a42; --border-soft: #251f38;
        }
        html, body { height: 100%; background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 15px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
        ::selection { background: rgba(155,114,207,0.3); }
        button { cursor: pointer; border: none; background: none; font-family: inherit; }
        textarea, input { font-family: inherit; resize: none; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
        @keyframes shimmer { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.6; } }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxWidth: '680px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border-soft)',
          background: 'rgba(27,24,40,0.97)',
          backdropFilter: 'blur(12px)',
          position: 'sticky', top: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: '22px', letterSpacing: '0.04em', lineHeight: 1 }}>
              Throughline
            </h1>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.08em', marginTop: '3px', fontStyle: 'italic' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-2)', borderRadius: '20px', padding: '3px', border: '1px solid var(--border)' }}>
            {Object.entries(MODES).map(([key, val]) => (
              <button key={key} onClick={() => { setMode(key); setMessages([]); }}
                style={{
                  padding: '5px 12px', borderRadius: '16px', fontSize: '11px', letterSpacing: '0.03em',
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
                {mode === 'conversation' ? '∿' : mode === 'creative' ? '◇' : '○'}
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '13px', fontStyle: 'italic', maxWidth: '220px', lineHeight: 1.7 }}>
                {mode === 'conversation' ? 'say something' : mode === 'creative' ? 'begin a story' : 'ask something practical'}
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            msg.silent
              ? <div key={i} style={{ textAlign: 'right', color: 'var(--text-dim)', fontSize: '11px', marginBottom: '8px', fontStyle: 'italic' }}>· intentional silence</div>
              : <MessageBubble
                  key={i}
                  message={msg}
                  isNew={i === newMessageIndex || i === newMessageIndex + 1}
                  onDelete={() => deleteMessage(i)}
                  onEdit={(text) => editMessage(i, text)}
                />
          ))}

          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px 24px', borderTop: '1px solid var(--border-soft)', background: 'rgba(27,24,40,0.97)', backdropFilter: 'blur(12px)' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: '10px',
            background: 'var(--bg-input)', borderRadius: '20px',
            border: `1px solid ${input === '.' ? currentMode.color + '60' : 'var(--border)'}`,
            padding: '10px 14px', transition: 'border-color 0.2s ease',
          }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'conversation' ? 'say something...' : mode === 'creative' ? 'begin a story...' : 'ask something...'}
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: input === '.' ? 'var(--text-dim)' : 'var(--text)',
                fontSize: '14.5px', lineHeight: '1.5', maxHeight: '160px',
                overflowY: 'auto', caretColor: currentMode.color,
                fontStyle: input === '.' ? 'italic' : 'normal',
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                background: input.trim() && !loading ? currentMode.color : 'var(--bg-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease',
                opacity: input.trim() && !loading ? 1 : 0.4,
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
            . for intentional silence
          </div>
        </div>
      </div>
    </>
  );
}
