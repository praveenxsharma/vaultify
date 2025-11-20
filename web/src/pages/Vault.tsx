// web/src/pages/Vault.tsx
import { useEffect, useState } from 'react';
import api from '../api';
import { deriveKeyPBKDF2, decryptVaultObject, encryptVaultObject, arrayBufferToBase64 } from '../utils/crypto';

export default function Vault({ userId, master, kdfParams }: { userId: string, master: string, kdfParams: any }) {
  const [vault, setVault] = useState<any>({ items: [] });
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    (async () => {
      setStatus('loading...');
      try {
        const res = await api.get(`/api/vault/${userId}`);
        const serverBlob = res.data?.vault_blob;
        const serverIv = res.data?.vault_iv;
        const serverKdf = res.data?.kdf_params || kdfParams || {};

        if (serverBlob && serverIv) {
          // Ensure we have salt for KDF
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
  }, [userId, master, kdfParams]);

  async function save() {
    setStatus('saving...');
    try {
      // Use existing kdfParams.salt if present, else generate one
      const salt = kdfParams?.salt || (await (async () => {
        // create local random salt
        const s = arrayBufferToBase64(window.crypto.getRandomValues(new Uint8Array(16)).buffer);
        return s;
      })());

      const iterations = kdfParams?.iterations || 250000;
      const key = await deriveKeyPBKDF2(master, salt, iterations);
      const { iv, blob } = await encryptVaultObject(vault, key);
      await api.post(`/api/vault/${userId}`, { vault_blob: blob, vault_iv: iv, kdf_params: { salt, iterations } });
      setStatus('saved');
    } catch (err: any) {
      console.error(err);
      setStatus('error: ' + (err?.message || 'save failed'));
    }
  }

  // small UI to add an item for testing
  function addTestItem() {
    setVault((v: any) => ({ ...v, items: [...(v.items || []), { id: Date.now(), title: 'example', username: 'user', password: 'pass' }] }));
  }

  return (
    <div>
      <h3>Your Vault</h3>
      <pre style={{ maxHeight: 300, overflow: 'auto' }}>{JSON.stringify(vault, null, 2)}</pre>
      <div style={{ marginTop: 8 }}>
        <button onClick={addTestItem}>Add test item</button>
        <button onClick={save} style={{ marginLeft: 8 }}>Save vault (encrypt & upload)</button>
      </div>
      <div style={{ marginTop: 8 }}>{status}</div>
    </div>
  );
}

