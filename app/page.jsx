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
// ── Sidebar ─────────────────────────────────────────────────────
function Sidebar({ mode, currentConvId, currentFolderId, onSelectConv, onSelectFolder, onNewConv, onClose }) {
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

  const renameConv = async (conv) => {
    await fetch('/api/conversations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: conv.id, title: renameText }) });
    setRenaming(null); loadAll(); if (conv.folder_id) loadFolderConvs(conv.folder_id);
  };

  const ConvItem = ({ conv }) => (
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <span onClick={() => { onSelectConv(conv); onClose(); }} style={{ color: 'var(--text-muted)', fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>{conv.title}</span>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button onClick={() => { setRenaming(conv.id); setRenameText(conv.title); }} style={{ color: 'var(--text-dim)', fontSize: '10px' }}>✎</button>
            <button onClick={() => deleteConv(conv)} style={{ color: '#c4605a', fontSize: '10px' }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
        {unfoldered.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ padding: '4px 8px', color: 'var(--text-dim)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>unfiled</div>
            {unfoldered.map(conv => <ConvItem key={conv.id} conv={conv} />)}
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
  const [attachments, setAttachments] = useState([]);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

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
      const isImage = file.type.startsWith('image/');
      return { name: file.name, type: isImage ? 'image' : 'document', mediaType: file.type, data };
    }));
    setAttachments(prev => [...prev, ...processed]);
    e.target.value = '';
  };
  const removeAttachment = (index) => setAttachments(prev => prev.filter((_, i) => i !== index));

  const createNewConversation = async (folder) => {
    const f = folder || currentFolder;
    const res = await fetch('/api/conversations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, title: 'new conversation', folderId: f?.id || null }),
    });
    const data = await res.json();
    setCurrentConv(data.conversation); setCurrentFolder(f || null);
    setMessages([]); setWasTruncated(false);
    return data.conversation;
  };

  const loadConversation = async (conv) => {
    setCurrentConv(conv); setWasTruncated(false);
    const res = await fetch(`/api/messages?conversationId=${conv.id}&mode=${mode}`);
    const data = await res.json();
    setMessages(data.messages || []);
  };

  const updateConvTitle = async (convId, firstMessage) => {
    const title = firstMessage.slice(0, 40) + (firstMessage.length > 40 ? '...' : '');
    await fetch('/api/conversations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: convId, title }) });
  };

  const sendMessage = async (overrideInput) => {
    const trimmed = (overrideInput ?? input).trim();
    if ((!trimmed && attachments.length === 0) || loading) return;
    setWasTruncated(false);

    if (trimmed === '.' && attachments.length === 0) {
      setMessages(prev => [...prev, { role: 'user', content: '.', silent: true }]);
      setInput(''); return;
    }

    let conv = currentConv;
    if (!conv) conv = await createNewConversation(null);

    const isFirst = messages.length === 0;
    const userMessage = { role: 'user', content: trimmed || '', attachments: attachments.length > 0 ? [...attachments] : undefined };
    setMessages(prev => [...prev, userMessage]);
    setNewMessageIndex(messages.length);
    setInput(''); setAttachments([]); setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, attachments: userMessage.attachments, mode, conversationId: conv.id, folderId: currentFolder?.id || null }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
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
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '', mode, conversationId: currentConv.id, folderId: currentFolder?.id || null, isContinue: true, continueContext: context }),
      });
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
    setMessages(prev => prev.filter((_, i) => i !== index));
    setLoading(true); setWasTruncated(false);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, mode, conversationId: currentConv.id, folderId: currentFolder?.id || null }),
      });
      const data = await res.json();
      if (data.message) { setMessages(prev => [...prev, { role: 'assistant', content: data.message }]); setWasTruncated(data.stopReason === 'max_tokens'); }
    } catch {} finally { setLoading(false); }
  };

  const deleteMessage = (i) => setMessages(prev => prev.filter((_, j) => j !== i));
  const editMessage = (i, c) => setMessages(prev => prev.map((m, j) => j === i ? { ...m, content: c } : m));

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
            onClose={() => setSidebarOpen(false)} />
        </>
      )}

      {docsOpen && currentFolder && mode === 'creative' && (
        <>
          <div onClick={() => setDocsOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(2px)' }} />
          <DocumentPanel folderId={currentFolder.id} folderColor={currentFolder.color} onClose={() => setDocsOpen(false)} />
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

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div style={{ padding: '8px 16px 0', background: 'rgba(27,24,40,0.97)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {attachments.map((att, i) => (
              <div key={i} style={{ position: 'relative', display: 'inline-flex' }}>
                {att.type === 'image' ? (
                  <img src={`data:${att.mediaType};base64,${att.data}`} alt={att.name}
                    style={{ height: '60px', width: '60px', objectFit: 'cover', borderRadius: '8px', border: `1px solid ${accentColor}40` }} />
                ) : (
                  <div style={{ height: '60px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${accentColor}40`, background: accentColor + '10', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', maxWidth: '160px' }}>
                    <span>📄</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                  </div>
                )}
                <button onClick={() => removeAttachment(i)} style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%', background: '#c4605a', color: 'white', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>✕</button>
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
              style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, background: (input.trim() || attachments.length > 0) && !loading ? accentColor : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', opacity: (input.trim() || attachments.length > 0) && !loading ? 1 : 0.4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>. for intentional silence · ⊕ to attach images or files</div>
        </div>
      </div>
    </>
  );
}
