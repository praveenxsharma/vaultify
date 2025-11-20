// web/src/pages/Vault.tsx
import { useEffect, useState, useRef } from 'react';
import api from '../api';
import {
  deriveKeyPBKDF2,
  decryptVaultObject,
  encryptVaultObject,
  arrayBufferToBase64
} from '../utils/crypto';

type VaultItem = {
  id: number | string;
  title: string;
  username?: string;
  password?: string;
  notes?: string;
};

export default function Vault({
  userId,
  master,
  kdfParams
}: {
  userId: string;
  master: string;
  kdfParams: any;
}) {
  const [vault, setVault] = useState<{ items: VaultItem[] }>({ items: [] });
  const [status, setStatus] = useState('loading');
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [maskMap, setMaskMap] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const autoSaveTimer = useRef<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // load vault on mount / when userId changes
  useEffect(() => {
    (async () => {
      setStatus('loading...');
      try {
        const res = await api.get(`/api/vault/${userId}`);
        const serverBlob = res.data?.vault_blob;
        const serverIv = res.data?.vault_iv;
        const serverKdf = res.data?.kdf_params || kdfParams || {};

        if (serverBlob && serverIv) {
          const salt = serverKdf?.salt || '';
          if (!salt) throw new Error('Missing KDF salt on server record');

          const iterations = serverKdf?.iterations || 250000;
          const key = await deriveKeyPBKDF2(master, salt, iterations);
          const plaintext = await decryptVaultObject(serverBlob, serverIv, key);
          setVault(plaintext);
        } else {
          setVault({ items: [] });
        }
        setStatus('ready');
      } catch (err: any) {
        console.error(err);
        setStatus('error: ' + (err?.message || 'could not decrypt'));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, master]);

  // helper: schedule autosave after changes (debounced)
  function scheduleAutoSave(delay = 1500) {
    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(() => {
      save();
    }, delay);
  }

  // Save function: encrypt & post
  async function save() {
    setIsSaving(true);
    setStatus('saving...');
    try {
      // Ensure we have salt
      const salt = kdfParams?.salt || arrayBufferToBase64(window.crypto.getRandomValues(new Uint8Array(16)).buffer);
      const iterations = kdfParams?.iterations || 250000;
      const key = await deriveKeyPBKDF2(master, salt, iterations);
      const { iv, blob } = await encryptVaultObject(vault, key);
      await api.post(`/api/vault/${userId}`, { vault_blob: blob, vault_iv: iv, kdf_params: { salt, iterations } });
      setStatus('saved');
    } catch (err: any) {
      console.error(err);
      setStatus('error: ' + (err?.message || 'save failed'));
    } finally {
      setIsSaving(false);
    }
  }

  // Add a new blank item and start editing it
  function addItem() {
    const newItem: VaultItem = { id: Date.now(), title: '', username: '', password: '', notes: '' };
    setVault(v => ({ ...v, items: [...(v.items || []), newItem] }));
    setEditingId(newItem.id);
    scheduleAutoSave();
  }

  // Delete item (with simple confirm)
  function deleteItem(id: number | string) {
    if (!confirm('Delete this item?')) return;
    setVault(v => ({ ...v, items: (v.items || []).filter(i => i.id !== id) }));
    scheduleAutoSave();
  }

  // Update item field
  function updateItem(id: number | string, patch: Partial<VaultItem>) {
    setVault(v => ({
      ...v,
      items: (v.items || []).map(it => (it.id === id ? { ...it, ...patch } : it))
    }));
    scheduleAutoSave();
  }

  // Toggle mask for an item password
  function toggleMask(id: number | string) {
    setMaskMap(m => ({ ...m, [String(id)]: !m[String(id)] }));
  }

  // Copy password to clipboard
  async function copyPassword(txt?: string) {
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      // small UX feedback
      setStatus('copied to clipboard');
      setTimeout(() => setStatus('ready'), 1000);
    } catch (err) {
      console.error('copy failed', err);
      setStatus('copy failed');
    }
  }

  // Search filter
  const filtered = (vault.items || []).filter(it => {
    if (!query) return true;
    const q = query.toLowerCase();
    return String(it.title || '').toLowerCase().includes(q) || String(it.username || '').toLowerCase().includes(q);
  });

  return (
    <div style={{ padding: 12, maxWidth: 900 }}>
      <h2>Your Vault</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          placeholder="Search title or username..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
        />
        <button onClick={addItem} style={{ padding: '8px 12px' }}>
          + Add
        </button>
        <button
          onClick={() => {
            if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
            save();
          }}
          disabled={isSaving}
          style={{ padding: '8px 12px' }}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: '#666' }}>Status: {status}</div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ color: '#666' }}>No items found — click “+ Add” to create one.</div>
        ) : (
          filtered
            .slice()
            .reverse()
            .map(item => {
              const isEditing = editingId === item.id;
              const masked = !maskMap[String(item.id)];
              return (
                <div
                  key={String(item.id)}
                  style={{
                    border: '1px solid #e6e6e6',
                    padding: 12,
                    borderRadius: 8,
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    {isEditing ? (
                      <>
                        <input
                          value={item.title || ''}
                          onChange={e => updateItem(item.id, { title: e.target.value })}
                          placeholder="Title (e.g., Gmail)"
                          style={{ width: '100%', padding: 8, marginBottom: 8 }}
                        />
                        <input
                          value={item.username || ''}
                          onChange={e => updateItem(item.id, { username: e.target.value })}
                          placeholder="Username / email"
                          style={{ width: '100%', padding: 8, marginBottom: 8 }}
                        />
                        <input
                          value={item.password || ''}
                          onChange={e => updateItem(item.id, { password: e.target.value })}
                          placeholder="Password"
                          style={{ width: '100%', padding: 8, marginBottom: 8 }}
                        />
                        <textarea
                          value={item.notes || ''}
                          onChange={e => updateItem(item.id, { notes: e.target.value })}
                          placeholder="Notes (optional)"
                          style={{ width: '100%', padding: 8, minHeight: 60 }}
                        />
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600 }}>{item.title || '(no title)'}</div>
                        <div style={{ color: '#333' }}>{item.username || ''}</div>
                        <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontFamily: 'monospace' }}>
                            {item.password ? (masked ? '•'.repeat(10) : item.password) : <span style={{ color: '#999' }}>(no password)</span>}
                          </div>
                        </div>
                        {item.notes ? <div style={{ marginTop: 6, color: '#444' }}>{item.notes}</div> : null}
                      </>
                    )}
                  </div>

                  <div style={{ width: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            scheduleAutoSave();
                          }}
                          style={{ padding: '8px 10px' }}
                        >
                          Done
                        </button>
                        <button
                          onClick={() => {
                            // cancel edits by reloading the vault (cheap)
                            // Ideally you'd keep a copy to revert; for simplicity reload from server.
                            (async () => {
                              setStatus('reloading...');
                              try {
                                const res = await api.get(`/api/vault/${userId}`);
                                const serverBlob = res.data?.vault_blob;
                                const serverIv = res.data?.vault_iv;
                                const serverKdf = res.data?.kdf_params || kdfParams || {};
                                if (serverBlob && serverIv) {
                                  const salt = serverKdf?.salt || '';
                                  const iterations = serverKdf?.iterations || 250000;
                                  const key = await deriveKeyPBKDF2(master, salt, iterations);
                                  const plaintext = await decryptVaultObject(serverBlob, serverIv, key);
                                  setVault(plaintext);
                                } else {
                                  setVault({ items: [] });
                                }
                                setStatus('ready');
                                setEditingId(null);
                              } catch (err: any) {
                                console.error(err);
                                setStatus('error reloading');
                              }
                            })();
                          }}
                          style={{ padding: '8px 10px' }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(item.id);
                          }}
                          style={{ padding: '8px 10px' }}
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => {
                            toggleMask(item.id);
                          }}
                          style={{ padding: '8px 10px' }}
                        >
                          {maskMap[String(item.id)] ? 'Show' : 'Hide'}
                        </button>

                        <button
                          onClick={() => copyPassword(item.password)}
                          style={{ padding: '8px 10px' }}
                          disabled={!item.password}
                        >
                          Copy
                        </button>

                        <button
                          onClick={() => deleteItem(item.id)}
                          style={{ padding: '8px 10px', background: '#ffeded' }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

