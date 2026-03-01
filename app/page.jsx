'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const MODES = {
  conversation: { label: 'conversation', color: '#9b72cf', symbol: '∿' },
  creative: { label: 'creative', color: '#6b8dd6', symbol: '◇' },
  practical: { label: 'practical', color: '#c4954a', symbol: '○' },
};

const FOLDER_COLORS = [
  '#7c4dbe', '#9b72cf', '#a78bfa', '#818cf8', '#6b8dd6',
  '#a084c4', '#c084b0', '#c49ab0', '#d4a0a0',
];

const FACT_CATEGORIES = ['life', 'health', 'work', 'relationships', 'general'];
const CATEGORY_COLORS = { life: '#9b72cf', health: '#72c49b', work: '#c4954a', relationships: '#6b8dd6', general: '#8a8a9b' };

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
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days/7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Attachment Display ──────────────────────────────────────────
function AttachmentDisplay({ attachments }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
      {attachments.map((att, i) => (
        att.type === 'image'
          ? <img key={i} src={`data:${att.mediaType};base64,${att.data}`} alt="attachment" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '10px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
          : <div key={i} style={{ padding: '6px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📄</span><span>{att.name}</span>
            </div>
      ))}
    </div>
  );
}

// ── Message Bubble ──────────────────────────────────────────────
function MessageBubble({ message, isNew, onDelete, onEdit, onRetry, onResend }) {
  const isUser = message.role === 'user';
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  const handleEditSave = () => {
    setEditing(false);
    setShowActions(false);
    onResend(editText);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: '16px', animation: isNew ? 'fadeUp 0.3s ease' : 'none' }}>
      {editing ? (
        <div style={{ maxWidth: '78%', width: '100%' }}>
          <textarea value={editText} onChange={e => setEditText(e.target.value)}
            style={{ background: 'var(--bg-input)', border: '1px solid var(--purple)', borderRadius: '12px', color: 'var(--text)', fontSize: '14.5px', padding: '10px 14px', width: '100%', minHeight: '80px', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setEditing(false); }} style={{ color: 'var(--text-dim)', fontSize: '12px' }}>cancel</button>
            <button onClick={handleEditSave} style={{ color: 'var(--purple)', fontSize: '12px' }}>save & resend</button>
          </div>
        </div>
      ) : (
        <div onClick={() => setShowActions(p => !p)} style={{
          maxWidth: '78%', padding: '11px 16px',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          background: isUser ? 'rgba(155,114,207,0.18)' : 'rgba(42,38,64,0.9)',
          border: isUser ? `1px solid ${showActions ? 'rgba(155,114,207,0.5)' : 'rgba(155,114,207,0.25)'}` : `1px solid ${showActions ? 'rgba(107,141,214,0.4)' : 'rgba(46,42,66,0.8)'}`,
          color: 'var(--text)', fontSize: '14.5px', lineHeight: '1.65', whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: 'pointer', transition: 'border-color 0.15s ease',
        }}>
          {message.attachments && <AttachmentDisplay attachments={message.attachments} />}
          {message.content}
        </div>
      )}
      {showActions && !editing && (
        <div style={{ display: 'flex', gap: '10px', marginTop: '6px', padding: '4px 10px', background: 'var(--bg-2)', borderRadius: '12px', border: '1px solid var(--border)', alignItems: 'center' }}>
          {message.timestamp && <span style={{ color: 'var(--text-dim)', fontSize: '10px', fontStyle: 'italic' }}>{message.timestamp}</span>}
          <button onClick={handleCopy} style={{ color: copied ? '#7dc47d' : 'var(--text-muted)', fontSize: '12px', padding: '2px 4px' }}>{copied ? 'copied' : 'copy'}</button>
          {isUser && <button onClick={() => { setEditing(true); setShowActions(false); }} style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '2px 4px' }}>edit</button>}
          {!isUser && onRetry && <button onClick={() => { onRetry(); setShowActions(false); }} style={{ color: '#6b8dd6', fontSize: '12px', padding: '2px 4px' }}>retry</button>}
          <button onClick={() => { onDelete(); setShowActions(false); }} style={{ color: '#c4605a', fontSize: '12px', padding: '2px 4px' }}>delete</button>
          <button onClick={() => setShowActions(false)} style={{ color: 'var(--text-dim)', fontSize: '12px', padding: '2px 4px' }}>✕</button>
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
      <div style={{ padding: '14px 18px', borderRadius: '18px 18px 18px 4px', background: 'rgba(42,38,64,0.9)', border: '1px solid rgba(46,42,66,0.8)', display: 'flex', gap: '5px', alignItems: 'center' }}>
        {[0,1,2].map(i => <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--text-muted)', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
      </div>
    </div>
  );
}

// ── Letter Notification ─────────────────────────────────────────
function LetterNotification({ onOpen }) {
  return (
    <div style={{ margin: '0 16px 16px', padding: '14px 18px', borderRadius: '14px', background: 'rgba(155,114,207,0.1)', border: '1px solid rgba(155,114,207,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeUp 0.4s ease' }}>
      <div>
        <div style={{ color: 'var(--purple)', fontSize: '13px', marginBottom: '2px' }}>✉ a letter is waiting</div>
        <div style={{ color: 'var(--text-dim)', fontSize: '11px', fontStyle: 'italic' }}>claude left you something</div>
      </div>
      <button onClick={onOpen} style={{ color: 'var(--purple)', fontSize: '12px', padding: '6px 14px', borderRadius: '10px', border: '1px solid rgba(155,114,207,0.4)', background: 'rgba(155,114,207,0.1)' }}>read</button>
    </div>
  );
}

// ── Document Panel ──────────────────────────────────────────────
function DocumentPanel({ folderId, folderColor, onClose }) {
  const [docs, setDocs] = useState([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState('character');

  const load = useCallback(async () => {
    const res = await fetch(`/api/documents?folderId=${folderId}`);
    const data = await res.json();
    setDocs(data.documents || []);
  }, [folderId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    await fetch('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderId, title: newTitle, content: newContent, doc_type: newType }) });
    setCreating(false); setNewTitle(''); setNewContent(''); setNewType('character'); load();
  };

  const update = async (doc) => {
    await fetch('/api/documents', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: doc.id, title: doc.title, content: doc.content }) });
    setEditing(null); load();
  };

  const remove = async (id) => {
    await fetch('/api/documents', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    load();
  };

  const docTypes = ['character', 'lore', 'world', 'plot', 'general'];
  const typeColors = { character: '#9b72cf', lore: '#6b8dd6', world: '#72c49b', plot: '#c4954a', general: '#8a8a9b' };

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '320px', background: 'var(--bg-2)', borderLeft: '1px solid var(--border)', zIndex: 100, display: 'flex', flexDirection: 'column', animation: 'slideRight 0.2s ease' }}>
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: 300, color: folderColor }}>project documents</span>
        <button onClick={onClose} style={{ color: 'var(--text-dim)', fontSize: '18px' }}>✕</button>
      </div>
      <div style={{ padding: '12px' }}>
        <button onClick={() => setCreating(true)} style={{ width: '100%', padding: '8px', borderRadius: '10px', border: `1px solid ${folderColor}40`, color: folderColor, fontSize: '13px', background: folderColor + '10' }}>+ new document</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
        {creating && (
          <div style={{ background: 'var(--bg-3)', borderRadius: '12px', padding: '12px', marginBottom: '12px', border: '1px solid var(--border)' }}>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="document title"
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '13px', padding: '6px 10px', outline: 'none', fontFamily: 'DM Sans, sans-serif', marginBottom: '8px' }} />
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {docTypes.map(t => <button key={t} onClick={() => setNewType(t)} style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '11px', background: newType === t ? typeColors[t] + '30' : 'transparent', border: `1px solid ${newType === t ? typeColors[t] : 'var(--border)'}`, color: newType === t ? typeColors[t] : 'var(--text-dim)' }}>{t}</button>)}
            </div>
            <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="document content..." rows={6}
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '13px', padding: '8px 10px', outline: 'none', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }} />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setCreating(false)} style={{ color: 'var(--text-dim)', fontSize: '12px' }}>cancel</button>
              <button onClick={create} style={{ color: folderColor, fontSize: '12px' }}>save</button>
            </div>
          </div>
        )}
        {docs.map(doc => (
          <div key={doc.id} style={{ background: 'var(--bg-3)', borderRadius: '12px', padding: '12px', marginBottom: '8px', border: '1px solid var(--border)' }}>
            {editing === doc.id ? (
              <>
                <input value={doc.title} onChange={e => setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, title: e.target.value } : d))}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '13px', padding: '6px 10px', outline: 'none', fontFamily: 'DM Sans, sans-serif', marginBottom: '8px' }} />
                <textarea value={doc.content} onChange={e => setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, content: e.target.value } : d))} rows={8}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '13px', padding: '8px 10px', outline: 'none', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }} />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditing(null)} style={{ color: 'var(--text-dim)', fontSize: '12px' }}>cancel</button>
                  <button onClick={() => update(doc)} style={{ color: folderColor, fontSize: '12px' }}>save</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '8px', background: (typeColors[doc.doc_type] || '#8a8a9b') + '20', color: typeColors[doc.doc_type] || '#8a8a9b' }}>{doc.doc_type}</span>
                    <span style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 500 }}>{doc.title}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setEditing(doc.id)} style={{ color: 'var(--text-dim)', fontSize: '11px' }}>✎</button>
                    <button onClick={() => remove(doc.id)} style={{ color: '#c4605a', fontSize: '11px' }}>✕</button>
                  </div>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{doc.content}</p>
              </>
            )}
          </div>
        ))}
        {docs.length === 0 && !creating && <p style={{ color: 'var(--text-dim)', fontSize: '12px', textAlign: 'center', padding: '20px', fontStyle: 'italic' }}>no documents yet</p>}
      </div>
    </div>
  );
}

// ── Settings Panel ──────────────────────────────────────────────
function SettingsPanel({ onClose, selectedModel, setSelectedModel, thinkingEnabled, setThinkingEnabled, contextSize, setContextSize, maxTokens, setMaxTokens }) {
  const [activeTab, setActiveTab] = useState('settings');
  const [facts, setFacts] = useState([]);
  const [moments, setMoments] = useState([]);
  const [letters, setLetters] = useState([]);
  const [newFact, setNewFact] = useState('');
  const [newFactCategory, setNewFactCategory] = useState('general');
  const [editingFact, setEditingFact] = useState(null);
  const [music, setMusic] = useState(null);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState(null);

  useEffect(() => {
    if (activeTab === 'memory') {
      Promise.all([
        fetch('/api/memory-facts').then(r => r.json()),
        fetch('/api/memory-moments').then(r => r.json()),
      ]).then(([f, m]) => { setFacts(f.facts || []); setMoments(m.moments || []); });
    }
    if (activeTab === 'letters') {
      fetch('/api/letters').then(r => r.json()).then(d => setLetters(d.letters || []));
    }
    if (activeTab === 'settings') {
      fetch('/api/lastfm').then(r => r.json()).then(d => setMusic(d)).catch(() => {});
      fetch('/api/calendar').then(r => r.json()).then(d => setCalendarConnected(d.connected === true)).catch(() => {});
    }
  }, [activeTab]);

  const addFact = async () => {
    if (!newFact.trim()) return;
    const res = await fetch('/api/memory-facts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: newFactCategory, content: newFact }) });
    const data = await res.json();
    setFacts(prev => [...prev, data.fact]);
    setNewFact('');
  };

  const deleteFact = async (id) => {
    await fetch('/api/memory-facts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setFacts(prev => prev.filter(f => f.id !== id));
  };

  const updateFact = async (fact) => {
    await fetch('/api/memory-facts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fact) });
    setFacts(prev => prev.map(f => f.id === fact.id ? fact : f));
    setEditingFact(null);
  };

  const deleteMoment = async (id) => {
    const res = await fetch('/api/memory-moments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setMoments(prev => prev.filter(m => m.id !== id));
  };

  const markLetterRead = async (letter) => {
    await fetch('/api/letters', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: letter.id, readByEmily: true }) });
    setLetters(prev => prev.map(l => l.id === letter.id ? { ...l, read_by_emily: true } : l));
    setSelectedLetter(letter);
  };

  const saveContextSize = async (val) => {
    setContextSize(val);
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hot_context_size: val }) });
  };

  const tabs = ['settings', 'memory', 'letters'];

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '340px', background: 'var(--bg-2)', borderLeft: '1px solid var(--border)', zIndex: 100, display: 'flex', flexDirection: 'column', animation: 'slideRight 0.2s ease' }}>
      <div style={{ padding: '20px 16px 0', borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 300, color: 'var(--purple)' }}>throughline</span>
          <button onClick={onClose} style={{ color: 'var(--text-dim)', fontSize: '18px' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '0' }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: '8px 4px', fontSize: '11px', letterSpacing: '0.05em', color: activeTab === t ? 'var(--purple)' : 'var(--text-dim)', borderBottom: activeTab === t ? '2px solid var(--purple)' : '2px solid transparent', background: 'transparent' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* ── Settings Tab ── */}
        {activeTab === 'settings' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>model</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', desc: 'fast, smart, everyday' },
                  { id: 'claude-opus-4-6', label: 'Opus 4.6', desc: 'most capable, slower' },
                  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', desc: 'fastest, cheapest' },
                ].map(m => (
                  <button key={m.id} onClick={() => setSelectedModel(m.id)} style={{ padding: '10px 12px', borderRadius: '10px', background: selectedModel === m.id ? 'rgba(155,114,207,0.15)' : 'var(--bg-3)', border: `1px solid ${selectedModel === m.id ? 'rgba(155,114,207,0.4)' : 'var(--border)'}`, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ color: 'var(--text)', fontSize: '13px' }}>{m.label}</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>extended thinking</div>
              <button onClick={() => setThinkingEnabled(p => !p)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: thinkingEnabled ? 'rgba(107,141,214,0.15)' : 'var(--bg-3)', border: `1px solid ${thinkingEnabled ? 'rgba(107,141,214,0.4)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: 'var(--text)', fontSize: '13px' }}>thinking mode</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>deeper reasoning, slower, costs more</div>
                </div>
                <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: thinkingEnabled ? '#6b8dd6' : 'var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: '3px', left: thinkingEnabled ? '18px' : '3px', width: '14px', height: '14px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                </div>
              </button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                context window — {contextSize} messages
              </div>
              <input type="range" min={10} max={40} step={5} value={contextSize} onChange={e => saveContextSize(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--purple)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
                <span>10 (cheaper)</span><span>40 (more context)</span>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                response length — {maxTokens} tokens
              </div>
              <input type="range" min={512} max={4096} step={512} value={maxTokens} onChange={e => setMaxTokens(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--purple)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
                <span>512 (concise)</span><span>4096 (full)</span>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>google calendar</div>
              {calendarConnected
                ? <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(114,196,155,0.1)', border: '1px solid rgba(114,196,155,0.3)', color: '#72c49b', fontSize: '13px' }}>✓ connected</div>
                : <a href="/api/google" style={{ display: 'block', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--purple)', fontSize: '13px', textDecoration: 'none', textAlign: 'center' }}>connect google calendar &#x2192;</a>
              }
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>manson's glucose log</div>
              {process.env.MANSON_SHEET_ID ? (
                <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(114,196,155,0.1)', border: '1px solid rgba(114,196,155,0.3)', color: '#72c49b', fontSize: '13px' }}>✓ connected</div>
              ) : (
                <p style={{ color: 'var(--text-dim)', fontSize: '12px', fontStyle: 'italic', lineHeight: 1.5 }}>add MANSON_SHEET_ID to Vercel env vars — the Google Sheet ID from the URL</p>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>last.fm</div>
              {music && !music.error ? (
                <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(155,114,207,0.1)', border: '1px solid rgba(155,114,207,0.2)' }}>
                  {music.nowPlaying
                    ? <><div style={{ fontSize: '10px', color: 'var(--purple)', marginBottom: '4px' }}>▶ now playing</div>
                       <div style={{ color: 'var(--text)', fontSize: '13px' }}>{music.nowPlaying.name}</div>
                       <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{music.nowPlaying.artist}</div></>
                    : <div style={{ color: 'var(--text-dim)', fontSize: '12px', fontStyle: 'italic' }}>not playing right now</div>
                  }
                </div>
              ) : <p style={{ color: 'var(--text-dim)', fontSize: '12px', fontStyle: 'italic' }}>not connected</p>}
            </div>

            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>api usage</div>
              <a href={'https://console.anthropic.com/settings/usage'} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--purple)', fontSize: '13px', textDecoration: 'none', textAlign: 'center' }}>
                view in anthropic console &#x2192;
              </a>
              <p style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '8px', fontStyle: 'italic', lineHeight: 1.5 }}>sonnet 4.6: ~$3/M input · ~$15/M output · 90% off cached tokens</p>
            </div>
          </>
        )}

        {/* ── Memory Tab ── */}
        {activeTab === 'memory' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>your facts</div>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontStyle: 'italic' }}>editable</span>
              </div>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                <input value={newFact} onChange={e => setNewFact(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFact()} placeholder="add a fact about you..."
                  style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '12px', padding: '6px 10px', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
                <button onClick={addFact} style={{ color: 'var(--purple)', fontSize: '12px', padding: '6px 12px', border: '1px solid rgba(155,114,207,0.3)', borderRadius: '8px', background: 'rgba(155,114,207,0.1)' }}>add</button>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {FACT_CATEGORIES.map(c => (
                  <button key={c} onClick={() => setNewFactCategory(c)} style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '11px', background: newFactCategory === c ? CATEGORY_COLORS[c] + '25' : 'transparent', border: `1px solid ${newFactCategory === c ? CATEGORY_COLORS[c] : 'var(--border)'}`, color: newFactCategory === c ? CATEGORY_COLORS[c] : 'var(--text-dim)' }}>{c}</button>
                ))}
              </div>

              {facts.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: '12px', fontStyle: 'italic' }}>no facts yet</p>}
              {facts.map(fact => (
                <div key={fact.id} style={{ padding: '8px 10px', borderRadius: '10px', background: 'var(--bg-3)', border: '1px solid var(--border)', marginBottom: '6px' }}>
                  {editingFact === fact.id ? (
                    <>
                      <input value={fact.content} onChange={e => setFacts(prev => prev.map(f => f.id === fact.id ? { ...f, content: e.target.value } : f))}
                        style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '12px', padding: '4px 8px', outline: 'none', fontFamily: 'DM Sans, sans-serif', marginBottom: '6px' }} />
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditingFact(null)} style={{ color: 'var(--text-dim)', fontSize: '11px' }}>cancel</button>
                        <button onClick={() => updateFact(fact)} style={{ color: 'var(--purple)', fontSize: '11px' }}>save</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '8px', background: CATEGORY_COLORS[fact.category] + '20', color: CATEGORY_COLORS[fact.category], flexShrink: 0, marginTop: '2px' }}>{fact.category}</span>
                      <span style={{ color: 'var(--text)', fontSize: '12px', flex: 1, lineHeight: 1.4 }}>{fact.content}</span>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => setEditingFact(fact.id)} style={{ color: 'var(--text-dim)', fontSize: '10px' }}>✎</button>
                        <button onClick={() => deleteFact(fact.id)} style={{ color: '#c4605a', fontSize: '10px' }}>✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>claude noticed</div>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontStyle: 'italic' }}>protected</span>
              </div>
              {moments.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: '12px', fontStyle: 'italic' }}>nothing yet — things claude finds significant will appear here</p>}
              {moments.map(m => (
                <div key={m.id} style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(155,114,207,0.06)', border: '1px solid rgba(155,114,207,0.15)', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <p style={{ color: 'var(--text)', fontSize: '12px', lineHeight: 1.5, flex: 1, fontStyle: 'italic' }}>{m.content}</p>
                    {!m.protected && <button onClick={() => deleteMoment(m.id)} style={{ color: '#c4605a', fontSize: '10px', flexShrink: 0 }}>✕</button>}
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '10px', marginTop: '6px' }}>{timeAgo(m.created_at)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Letters Tab ── */}
        {activeTab === 'letters' && (
          <>
            {selectedLetter ? (
              <div>
                <button onClick={() => setSelectedLetter(null)} style={{ color: 'var(--text-dim)', fontSize: '12px', marginBottom: '16px' }}>← back</button>
                <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(155,114,207,0.06)', border: '1px solid rgba(155,114,207,0.2)' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '10px', marginBottom: '12px' }}>{new Date(selectedLetter.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                  <p style={{ color: 'var(--text)', fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{selectedLetter.content}</p>
                </div>
              </div>
            ) : (
              <>
                {letters.length === 0 && (
                  <p style={{ color: 'var(--text-dim)', fontSize: '12px', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>no letters yet — claude can write these during conversations when something feels worth saying directly</p>
                )}
                {letters.map(letter => (
                  <button key={letter.id} onClick={() => markLetterRead(letter)} style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: letter.read_by_emily ? 'var(--bg-3)' : 'rgba(155,114,207,0.1)', border: `1px solid ${letter.read_by_emily ? 'var(--border)' : 'rgba(155,114,207,0.3)'}`, textAlign: 'left', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>{letter.read_by_emily ? '✉' : '✉'}</span>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ color: letter.read_by_emily ? 'var(--text-muted)' : 'var(--text)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{letter.content.slice(0, 60)}...</div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '10px', marginTop: '3px' }}>{timeAgo(letter.created_at)}</div>
                    </div>
                    {!letter.read_by_emily && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--purple)', flexShrink: 0 }} />}
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Sidebar ─────────────────────────────────────────────────────
function Sidebar({ mode, currentConvId, currentFolderId, onSelectConv, onSelectFolder, onNewConv, onOpenSettings, onClose }) {
  const [folders, setFolders] = useState([]);
  const [unfoldered, setUnfoldered] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [folderConvs, setFolderConvs] = useState({});
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [renaming, setRenaming] = useState(null);
  const [renameText, setRenameText] = useState('');
  const currentMode = MODES[mode];

  const loadAll = useCallback(async () => {
    const [fRes, cRes] = await Promise.all([fetch(`/api/folders?mode=${mode}`), fetch(`/api/conversations?mode=${mode}`)]);
    const fData = await fRes.json(); const cData = await cRes.json();
    setFolders(fData.folders || []); setUnfoldered(cData.conversations || []);
  }, [mode]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadFolderConvs = async (folderId) => {
    const res = await fetch(`/api/conversations?folderId=${folderId}`);
    const data = await res.json();
    setFolderConvs(prev => ({ ...prev, [folderId]: data.conversations || [] }));
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => { const next = { ...prev, [folderId]: !prev[folderId] }; if (next[folderId]) loadFolderConvs(folderId); return next; });
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newFolderName, mode, color: newFolderColor }) });
    setCreatingFolder(false); setNewFolderName(''); loadAll();
  };

  const deleteFolder = async (folder) => {
    if (!confirm(`Delete "${folder.name}" and all its conversations?`)) return;
    await fetch('/api/folders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: folder.id }) });
    loadAll();
  };

  const deleteConv = async (conv) => {
    await fetch('/api/conversations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: conv.id }) });
    loadAll(); if (conv.folder_id) loadFolderConvs(conv.folder_id);
  };

  const toggleStar = async (conv, e) => {
    e.stopPropagation();
    await fetch('/api/conversations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: conv.id, starred: !conv.starred }) });
    loadAll(); if (conv.folder_id) loadFolderConvs(conv.folder_id);
  };

  const renameConv = async (conv) => {
    await fetch('/api/conversations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: conv.id, title: renameText }) });
    setRenaming(null); loadAll(); if (conv.folder_id) loadFolderConvs(conv.folder_id);
  };

  const moveToFolder = async (conv, folderId) => {
    await fetch('/api/conversations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: conv.id, folderId: folderId || null }) });
    loadAll();
    if (conv.folder_id) loadFolderConvs(conv.folder_id);
    if (folderId) loadFolderConvs(folderId);
  };

  const ConvItem = ({ conv }) => {
    const [showMove, setShowMove] = useState(false);
    return (
    <div style={{ padding: '7px 10px', borderRadius: '8px', marginBottom: '2px', background: conv.id === currentConvId ? currentMode.color + '15' : 'transparent', border: conv.id === currentConvId ? `1px solid ${currentMode.color}30` : '1px solid transparent' }}>
      {renaming === conv.id ? (
        <div onClick={e => e.stopPropagation()}>
          <input value={renameText} onChange={e => setRenameText(e.target.value)} onKeyDown={e => e.key === 'Enter' && renameConv(conv)} autoFocus
            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--purple)', borderRadius: '6px', color: 'var(--text)', fontSize: '12px', padding: '4px 8px', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button onClick={() => setRenaming(null)} style={{ color: 'var(--text-dim)', fontSize: '11px' }}>cancel</button>
            <button onClick={() => renameConv(conv)} style={{ color: 'var(--purple)', fontSize: '11px' }}>save</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={(e) => toggleStar(conv, e)} style={{ color: conv.starred ? '#c4954a' : 'var(--text-dim)', fontSize: '12px', flexShrink: 0, opacity: conv.starred ? 1 : 0.4 }}>★</button>
            <span onClick={() => { onSelectConv(conv); onClose(); }} style={{ color: 'var(--text-muted)', fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>{conv.title}</span>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button onClick={() => setShowMove(p => !p)} style={{ color: 'var(--text-dim)', fontSize: '10px' }} title="move">⤷</button>
              <button onClick={() => { setRenaming(conv.id); setRenameText(conv.title); }} style={{ color: 'var(--text-dim)', fontSize: '10px' }}>✎</button>
              <button onClick={() => deleteConv(conv)} style={{ color: '#c4605a', fontSize: '10px' }}>✕</button>
            </div>
          </div>
          {showMove && (
            <div style={{ marginTop: '6px', padding: '8px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '6px' }}>move to...</div>
              {conv.folder_id && (
                <button onClick={() => { moveToFolder(conv, null); setShowMove(false); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '12px', marginBottom: '3px', background: 'transparent' }}>
                  ✕ remove from folder
                </button>
              )}
              {folders.filter(f => f.id !== conv.folder_id).map(f => (
                <button key={f.id} onClick={() => { moveToFolder(conv, f.id); setShowMove(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '4px 8px', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '12px', marginBottom: '3px', background: 'transparent' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
    );
  };

  // Starred conversations section
  const allStarred = [...unfoldered, ...Object.values(folderConvs).flat()].filter(c => c.starred);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: '280px', background: 'var(--bg-2)', borderRight: '1px solid var(--border)', zIndex: 100, display: 'flex', flexDirection: 'column', animation: 'slideIn 0.2s ease' }}>
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: 300, color: currentMode.color }}>{mode}</span>
        <button onClick={onClose} style={{ color: 'var(--text-dim)', fontSize: '18px' }}>✕</button>
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', gap: '6px' }}>
        <button onClick={() => onNewConv(null)} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: `1px solid ${currentMode.color}40`, color: currentMode.color, fontSize: '12px', background: currentMode.color + '10' }}>+ new chat</button>
        <button onClick={() => setCreatingFolder(true)} style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '12px', background: 'transparent' }}>+ folder</button>
      </div>
      {creatingFolder && (
        <div style={{ margin: '0 12px 8px', padding: '12px', background: 'var(--bg-3)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="folder name" autoFocus onKeyDown={e => e.key === 'Enter' && createFolder()}
            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '13px', padding: '6px 10px', outline: 'none', fontFamily: 'DM Sans, sans-serif', marginBottom: '8px' }} />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {FOLDER_COLORS.map(c => <button key={c} onClick={() => setNewFolderColor(c)} style={{ width: '20px', height: '20px', borderRadius: '50%', background: c, border: newFolderColor === c ? '2px solid white' : '2px solid transparent', padding: 0 }} />)}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setCreatingFolder(false)} style={{ color: 'var(--text-dim)', fontSize: '12px' }}>cancel</button>
            <button onClick={createFolder} style={{ color: newFolderColor, fontSize: '12px' }}>create</button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {allStarred.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ padding: '4px 8px', color: '#c4954a', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>★ starred</div>
            {allStarred.map(conv => <ConvItem key={conv.id} conv={conv} />)}
          </div>
        )}
        {unfoldered.filter(c => !c.starred).length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ padding: '4px 8px', color: 'var(--text-dim)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>unfiled</div>
            {unfoldered.filter(c => !c.starred).map(conv => <ConvItem key={conv.id} conv={conv} />)}
          </div>
        )}
        {folders.map(folder => (
          <div key={folder.id} style={{ marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', borderRadius: '10px', background: currentFolderId === folder.id ? folder.color + '12' : 'var(--bg-3)', border: `1px solid ${currentFolderId === folder.id ? folder.color + '30' : 'var(--border)'}`, cursor: 'pointer' }}
              onClick={() => { toggleFolder(folder.id); onSelectFolder(folder); }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: folder.color, marginRight: '8px', flexShrink: 0 }} />
              <span style={{ color: 'var(--text)', fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button onClick={() => onNewConv(folder)} style={{ color: folder.color, fontSize: '13px', lineHeight: 1 }}>+</button>
                <button onClick={() => deleteFolder(folder)} style={{ color: '#c4605a', fontSize: '11px' }}>✕</button>
              </div>
            </div>
            {expandedFolders[folder.id] && (
              <div style={{ paddingLeft: '16px', marginTop: '4px' }}>
                {(folderConvs[folder.id] || []).map(conv => <ConvItem key={conv.id} conv={conv} />)}
                {(folderConvs[folder.id] || []).length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: '11px', fontStyle: 'italic', padding: '4px 8px' }}>empty</p>}
              </div>
            )}
          </div>
        ))}
        {folders.length === 0 && unfoldered.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: '12px', textAlign: 'center', padding: '20px', fontStyle: 'italic' }}>no conversations yet</p>}
      </div>

      {/* Gear at bottom */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-soft)' }}>
        <button onClick={() => { onOpenSettings(); onClose(); }} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '12px', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>⚙</span> settings & memory
        </button>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────
export default function Home() {
  const [mode, setMode] = useState('conversation');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentConv, setCurrentConv] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [newMessageIndex, setNewMessageIndex] = useState(null);
  const [wasTruncated, setWasTruncated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-6');
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [contextSize, setContextSize] = useState(20);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [unreadLetters, setUnreadLetters] = useState(false);
  const [letterNotifDismissed, setLetterNotifDismissed] = useState(false);
  const [openPRs, setOpenPRs] = useState([]);
  const [prBannerDismissed, setPrBannerDismissed] = useState(false);

  // Context refresh tracking — timestamps of last fetch
  const contextTimestamps = useRef({ lastfm: 0, calendar: 0, memory: 0 });
  const REFRESH_INTERVALS = { lastfm: 60 * 60 * 1000, calendar: 24 * 60 * 60 * 1000, memory: 3 * 60 * 60 * 1000 };

  const shouldRefresh = (key) => Date.now() - contextTimestamps.current[key] > REFRESH_INTERVALS[key];
  const markRefreshed = (key) => { contextTimestamps.current[key] = Date.now(); };
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Check for unread letters and load settings on mount
  useEffect(() => {
    fetch('/api/letters?unread=true').then(r => r.json()).then(d => {
      if (d.letters && d.letters.length > 0) setUnreadLetters(true);
    }).catch(() => {});
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.settings) {
        setContextSize(d.settings.hot_context_size || 20);
        setSelectedModel(d.settings.default_model || 'claude-sonnet-4-6');
        setThinkingEnabled(d.settings.thinking_default || false);
      }
    }).catch(() => {});
    // Check for open PRs from Claude
    fetch('/api/github-prs').then(r => r.json()).then(d => {
      if (d.prs && d.prs.length > 0) setOpenPRs(d.prs);
    }).catch(() => {});
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; }
  }, []);
  useEffect(() => { adjustTextarea(); }, [input, adjustTextarea]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    const processed = await Promise.all(files.map(async (file) => {
      const data = await fileToBase64(file);
      return { name: file.name, type: file.type.startsWith('image/') ? 'image' : 'document', mediaType: file.type, data };
    }));
    setAttachments(prev => [...prev, ...processed]);
    e.target.value = '';
  };

  const removeAttachment = (index) => setAttachments(prev => prev.filter((_, i) => i !== index));

  const createNewConversation = async (folder) => {
    const f = folder || currentFolder;
    const res = await fetch('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, title: 'new conversation', folderId: f?.id || null }) });
    const data = await res.json();
    setCurrentConv(data.conversation); setCurrentFolder(f || null);
    setMessages([]); setWasTruncated(false);
    return data.conversation;
  };

  const loadConversation = async (conv) => {
    setCurrentConv(conv); setWasTruncated(false);
    const res = await fetch(`/api/messages?conversationId=${conv.id}&mode=${mode}`);
    const data = await res.json();
    setMessages(data.messages?.map(m => ({
      ...m,
      timestamp: new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    })) || []);
  };

  const updateConvTitle = async (convId, firstMessage) => {
    const title = firstMessage.slice(0, 40) + (firstMessage.length > 40 ? '...' : '');
    await fetch('/api/conversations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: convId, title }) });
  };

  const sendMessage = async (overrideInput) => {
    const trimmed = (overrideInput ?? input).trim();
    // Empty send with existing conversation = continue
    if (!trimmed && attachments.length === 0) {
      if (currentConv && messages.length > 0 && !loading) {
        continueMessage();
      }
      return;
    }
    if (loading) return;
    setWasTruncated(false);

    // /read command — fetch file from GitHub and inject into conversation
    if (trimmed.startsWith('/read ') && mode === 'practical') {
      const filePath = trimmed.slice(6).trim();
      setInput(''); setLoading(true);
      setMessages(prev => [...prev, { role: 'user', content: trimmed, timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) }]);
      try {
        const res = await fetch(`/api/github?path=${encodeURIComponent(filePath)}`);
        const data = await res.json();
        if (data.content) {
          setMessages(prev => [...prev, { role: 'assistant', content: `\`\`\`\n// ${filePath}\n${data.content}\n\`\`\``, timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }), isFileRead: true }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: `Couldn't read ${filePath} — ${data.error || 'file not found'}`, timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) }]);
        }
      } catch {
        setMessages(prev => [...prev, { role: 'assistant', content: `Failed to read ${filePath}`, timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) }]);
      } finally { setLoading(false); }
      return;
    }

    if (trimmed === '.' && attachments.length === 0) {
      setMessages(prev => [...prev, { role: 'user', content: '.', silent: true }]);
      setInput(''); return;
    }

    let conv = currentConv;
    if (!conv) conv = await createNewConversation(null);

    const isFirst = messages.length === 0;
    const userMessage = { role: 'user', content: trimmed || '', timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }), attachments: attachments.length > 0 ? [...attachments] : undefined };
    setMessages(prev => [...prev, userMessage]);
    setNewMessageIndex(messages.length);
    setInput(''); setAttachments([]); setLoading(true);

    try {
      const refreshFlags = {
        refreshLastfm: shouldRefresh('lastfm'),
        refreshCalendar: shouldRefresh('calendar'),
        refreshMemory: shouldRefresh('memory'),
      };
      if (refreshFlags.refreshLastfm) markRefreshed('lastfm');
      if (refreshFlags.refreshCalendar) markRefreshed('calendar');
      if (refreshFlags.refreshMemory) markRefreshed('memory');

      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, attachments: userMessage.attachments, mode, conversationId: conv.id, folderId: currentFolder?.id || null, model: selectedModel, thinkingEnabled, contextSize, maxTokens, ...refreshFlags }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message, timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) }]);
        setNewMessageIndex(messages.length + 1);
        setWasTruncated(data.stopReason === 'max_tokens');
        if (isFirst) updateConvTitle(conv.id, trimmed || 'shared an attachment');
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }]);
    } finally { setLoading(false); }
  };

  const continueMessage = async () => {
    if (loading || !currentConv) return;
    setWasTruncated(false); setLoading(true);
    const context = messages.map(m => ({ role: m.role, content: m.content }));
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '', mode, conversationId: currentConv.id, folderId: currentFolder?.id || null, isContinue: true, continueContext: context, model: selectedModel }) });
      const data = await res.json();
      if (data.message) {
        setMessages(prev => { const u = [...prev]; const l = u.length - 1; if (u[l].role === 'assistant') u[l] = { ...u[l], content: u[l].content + ' ' + data.message }; return u; });
        setWasTruncated(data.stopReason === 'max_tokens');
      }
    } catch {} finally { setLoading(false); }
  };

  const retryMessage = async (index) => {
    if (loading || !currentConv) return;
    const userMsg = messages[index - 1];
    if (!userMsg || userMsg.role !== 'user') return;
    // Remove both the assistant response and the user message that triggered it
    setMessages(prev => prev.filter((_, i) => i < index - 1));
    setLoading(true); setWasTruncated(false);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMsg.content, mode, conversationId: currentConv.id, folderId: currentFolder?.id || null, model: selectedModel }) });
      const data = await res.json();
      if (data.message) {
        setMessages(prev => [...prev, 
          { role: 'user', content: userMsg.content, timestamp: userMsg.timestamp },
          { role: 'assistant', content: data.message, timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) }
        ]);
        setWasTruncated(data.stopReason === 'max_tokens');
      }
    } catch {} finally { setLoading(false); }
  };

  const deleteMessage = (i) => {
    setMessages(prev => prev.filter((_, j) => j !== i));
    if (currentConv) {
      fetch('/api/messages', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: currentConv.id, index: i, mode }) }).catch(() => {});
    }
  };
  const editMessage = (i, c) => {
    setMessages(prev => prev.map((m, j) => j === i ? { ...m, content: c } : m));
    if (currentConv) {
      // Delete from this index onward and re-insert the edited message
      fetch('/api/messages', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: currentConv.id, index: i, mode }) }).catch(() => {});
    }
  };

  const handleModeSwitch = (newMode) => {
    setMode(newMode); setCurrentConv(null); setCurrentFolder(null);
    setMessages([]); setWasTruncated(false); setSidebarOpen(false); setDocsOpen(false); setAttachments([]);
  };

  const currentMode = MODES[mode];
  const accentColor = currentFolder?.color || currentMode.color;

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:0.3; transform:scale(0.8); } 50% { opacity:1; transform:scale(1); } }
        @keyframes shimmer { 0%,100% { opacity:0.35; } 50% { opacity:0.6; } }
        @keyframes slideIn { from { transform:translateX(-100%); } to { transform:translateX(0); } }
        @keyframes slideRight { from { transform:translateX(100%); } to { transform:translateX(0); } }
      `}</style>

      <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf" onChange={handleFileSelect} style={{ display: 'none' }} />

      {sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(2px)' }} />
          <Sidebar mode={mode} currentConvId={currentConv?.id} currentFolderId={currentFolder?.id}
            onSelectConv={loadConversation} onSelectFolder={setCurrentFolder}
            onNewConv={(folder) => { createNewConversation(folder); setSidebarOpen(false); }}
            onOpenSettings={() => setSettingsOpen(true)}
            onClose={() => setSidebarOpen(false)} />
        </>
      )}

      {docsOpen && currentFolder && mode === 'creative' && (
        <>
          <div onClick={() => setDocsOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(2px)' }} />
          <DocumentPanel folderId={currentFolder.id} folderColor={currentFolder.color} onClose={() => setDocsOpen(false)} />
        </>
      )}

      {settingsOpen && (
        <>
          <div onClick={() => setSettingsOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(2px)' }} />
          <SettingsPanel
            onClose={() => setSettingsOpen(false)}
            selectedModel={selectedModel} setSelectedModel={setSelectedModel}
            thinkingEnabled={thinkingEnabled} setThinkingEnabled={setThinkingEnabled}
            contextSize={contextSize} setContextSize={setContextSize}
            maxTokens={maxTokens} setMaxTokens={setMaxTokens}
          />
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxWidth: '680px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border-soft)', background: 'rgba(27,24,40,0.97)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => setSidebarOpen(true)} style={{ color: 'var(--text-dim)', fontSize: '18px', flexShrink: 0, padding: '4px' }}>☰</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', overflow: 'hidden' }}>
              <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, fontSize: '20px', letterSpacing: '0.04em', lineHeight: 1, flexShrink: 0 }}>Throughline</h1>
              {currentFolder && <span style={{ color: accentColor, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.8 }}>/ {currentFolder.name}</span>}
              {currentConv && currentConv.title !== 'new conversation' && <span style={{ color: 'var(--text-dim)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>/ {currentConv.title}</span>}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.08em', marginTop: '2px', fontStyle: 'italic' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>
          {mode === 'creative' && currentFolder && (
            <button onClick={() => setDocsOpen(true)} style={{ color: accentColor, fontSize: '11px', padding: '4px 10px', borderRadius: '10px', border: `1px solid ${accentColor}40`, background: accentColor + '10', flexShrink: 0 }}>docs</button>
          )}
          <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-2)', borderRadius: '20px', padding: '3px', border: '1px solid var(--border)', flexShrink: 0 }}>
            {Object.entries(MODES).map(([key, val]) => (
              <button key={key} onClick={() => handleModeSwitch(key)} style={{ padding: '4px 10px', borderRadius: '16px', fontSize: '10px', color: mode === key ? 'var(--text)' : 'var(--text-dim)', background: mode === key ? val.color + '30' : 'transparent', border: mode === key ? `1px solid ${val.color}50` : '1px solid transparent', transition: 'all 0.2s ease' }}>
                {val.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: '2px', background: `linear-gradient(90deg, transparent, ${accentColor}50, transparent)`, transition: 'background 0.4s ease' }} />

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column' }}>
          {unreadLetters && !letterNotifDismissed && (
            <LetterNotification onOpen={() => { setLetterNotifDismissed(true); setSettingsOpen(true); }} />
          )}

          {openPRs.length > 0 && !prBannerDismissed && (
            <div style={{ margin: '0 0 16px', padding: '12px 16px', borderRadius: '14px', background: 'rgba(107,141,214,0.1)', border: '1px solid rgba(107,141,214,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeUp 0.4s ease' }}>
              <div>
                <div style={{ color: '#6b8dd6', fontSize: '13px', marginBottom: '2px' }}>⤷ {openPRs.length} proposed change{openPRs.length > 1 ? 's' : ''} waiting</div>
                <div style={{ color: 'var(--text-dim)', fontSize: '11px', fontStyle: 'italic' }}>claude suggested a code update</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <a href={openPRs[0].pr_url} target="_blank" rel="noopener noreferrer" style={{ color: '#6b8dd6', fontSize: '12px', padding: '6px 12px', borderRadius: '10px', border: '1px solid rgba(107,141,214,0.4)', background: 'rgba(107,141,214,0.1)', textDecoration: 'none' }}>review</a>
                <button onClick={() => setPrBannerDismissed(true)} style={{ color: 'var(--text-dim)', fontSize: '14px' }}>✕</button>
              </div>
            </div>
          )}

          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '36px', fontWeight: 300, color: accentColor, animation: 'shimmer 4s ease infinite', marginBottom: '12px' }}>{currentMode.symbol}</div>
              <p style={{ color: 'var(--text-dim)', fontSize: '13px', fontStyle: 'italic', maxWidth: '220px', lineHeight: 1.7 }}>
                {currentFolder ? currentFolder.name : mode === 'conversation' ? 'say something' : mode === 'creative' ? 'begin a story' : 'ask something practical'}
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            msg.silent
              ? <div key={i} style={{ textAlign: 'right', color: 'var(--text-dim)', fontSize: '11px', marginBottom: '8px', fontStyle: 'italic' }}>· intentional silence</div>
              : <MessageBubble key={i} message={msg} isNew={i === newMessageIndex || i === newMessageIndex + 1}
                  onDelete={() => deleteMessage(i)} onEdit={text => editMessage(i, text)}
                  onResend={text => sendMessage(text)}
                  onRetry={msg.role === 'assistant' ? () => retryMessage(i) : null} />
          ))}

          {loading && <TypingIndicator />}

          {wasTruncated && !loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
              <button onClick={continueMessage} style={{ padding: '8px 16px', borderRadius: '16px', background: 'transparent', border: `1px solid ${accentColor}50`, color: accentColor, fontSize: '12px', fontStyle: 'italic' }}>
                there's more — continue
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Status indicators */}
        {(thinkingEnabled || selectedModel !== 'claude-sonnet-4-6') && (
          <div style={{ padding: '4px 16px', background: 'rgba(27,24,40,0.97)', display: 'flex', gap: '10px', alignItems: 'center' }}>
            {thinkingEnabled && <span style={{ fontSize: '10px', color: '#6b8dd6', fontStyle: 'italic' }}>✦ thinking</span>}
            {selectedModel !== 'claude-sonnet-4-6' && <span style={{ fontSize: '10px', color: '#c4954a', fontStyle: 'italic' }}>{selectedModel.includes('opus') ? 'opus' : 'haiku'}</span>}
          </div>
        )}

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div style={{ padding: '8px 16px 0', background: 'rgba(27,24,40,0.97)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {attachments.map((att, i) => (
              <div key={i} style={{ position: 'relative', display: 'inline-flex' }}>
                {att.type === 'image'
                  ? <img src={`data:${att.mediaType};base64,${att.data}`} alt={att.name} style={{ height: '60px', width: '60px', objectFit: 'cover', borderRadius: '8px', border: `1px solid ${accentColor}40` }} />
                  : <div style={{ height: '60px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${accentColor}40`, background: accentColor + '10', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', maxWidth: '160px' }}>
                      <span>📄</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                    </div>
                }
                <button onClick={() => removeAttachment(i)} style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%', background: '#c4605a', color: 'white', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '12px 16px 24px', borderTop: '1px solid var(--border-soft)', background: 'rgba(27,24,40,0.97)', backdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', background: 'var(--bg-input)', borderRadius: '20px', border: `1px solid ${attachments.length > 0 ? accentColor + '50' : 'var(--border)'}`, padding: '10px 14px', transition: 'border-color 0.2s ease' }}>
            <button onClick={() => fileInputRef.current?.click()} style={{ color: 'var(--text-dim)', fontSize: '18px', flexShrink: 0, lineHeight: 1, padding: '0 2px', opacity: 0.7 }}>⊕</button>
            <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)}
              placeholder={attachments.length > 0 ? 'add a message...' : currentFolder ? `in ${currentFolder.name}...` : mode === 'conversation' ? 'say something...' : mode === 'creative' ? 'begin a story...' : 'ask something...'}
              rows={1}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '14.5px', lineHeight: '1.5', maxHeight: '160px', overflowY: 'auto', caretColor: accentColor }} />
            <button onClick={() => sendMessage()} disabled={loading || (!input.trim() && attachments.length === 0)}
              style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, background: !loading && (input.trim() || attachments.length > 0 || currentConv) ? accentColor : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', opacity: !loading && (input.trim() || attachments.length > 0 || currentConv) ? 1 : 0.4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>. for intentional silence · ⊕ to attach</div>
        </div>
      </div>
    </>
  );
}
