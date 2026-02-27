'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const MODES = {
  conversation: { label: 'conversation', color: '#9b72cf', symbol: '∿' },
  creative: { label: 'creative', color: '#6b8dd6', symbol: '◇' },
  practical: { label: 'practical', color: '#c4954a', symbol: '○' },
};

const FOLDER_COLORS = [
  '#7c4dbe', '#9b72cf', '#a78bfa', '#818cf8', '#6b8dd6',
  '#a084c4', '#c084b0', '#c49ab0', '#d4a0a0', '#c4954a',
];

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Attachment Display ──────────────────────────────────────────
function AttachmentDisplay({ attachments }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
      {attachments.map((att, i) => (
        att.type === 'image' ? (
          <img key={i} src={`data:${att.mediaType};base64,${att.data}`} alt="attachment"
            style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '10px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
        ) : (
          <div key={i} style={{ padding: '6px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📄</span>
            <span>{att.name}</span>
          </div>
        )
      ))}
    </div>
  );
}

// ── Message Bubble ──────────────────────────────────────────────
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: '16px', animation: isNew ? 'fadeUp 0.3s ease' : 'none' }}>
      {editing ? (
        <div style={{ maxWidth: '78%', width: '100%' }}>
          <textarea value={editText} onChange={e => setEditText(e.target.value)}
            style={{ background: 'var(--bg-input)', border: '1px solid var(--purple)', borderRadius: '12px', color: 'var(--text)', fontSize: '14.5px', padding: '10px 14px', width: '100%', minHeight: '80px', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
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
          border: isUser ? `1px solid ${showActions ? 'rgba(155,114,207,0.5)' : 'rgba(155,114,207,0.25)'}` : `1px solid ${showActions ? 'rgba(107,141,214,0.4)' : 'rgba(46,42,66,0.8)'}`,
          color: 'var(--text)', fontSize: '14.5px', lineHeight: '1.65', whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: 'pointer', transition: 'border-color 0.15s ease',
        }}>
          {message.attachments && <AttachmentDisplay attachments={message.attachments} />}
          {message.content}
        </div>
      )}
      {showActions && !editing && (
        <div style={{ display: 'flex', gap: '10px', marginTop: '6px', padding: '4px 10px', background: 'var(--bg-2)', borderRadius: '12px', border: '1px solid var(--border)' }}>
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
    setCreating(false); setNewTitle(''); setNewContent(''); setNewType('character');
    load();
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
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '8px', background: (typeColors[doc.doc_type] || '#8a8a9b') + '20', color: typeColors[doc.doc_type] || '#8a8a9b', letterSpacing: '0.05em' }}>{doc.doc_type}</span>
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
