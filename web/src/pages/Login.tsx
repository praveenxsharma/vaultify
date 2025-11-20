// web/src/pages/Login.tsx
import React, { useState } from 'react';
import api from '../api';
import { deriveVerifierB64 } from '../utils/crypto';

export default function Login({ onSuccess }: { onSuccess: (userId: string, master: string, kdfParams: any) => void }) {
  const [email, setEmail] = useState('');
  const [master, setMaster] = useState('');
  const [status, setStatus] = useState('');

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setStatus('logging in...');
    try {
      // Fetch auth_salt and stored kdf_params from server
      const saltRes = await api.get('/api/auth_salt', { params: { email } });
      const authSalt = saltRes.data?.auth_salt;
      const kdfParams = saltRes.data?.kdf_params || {};

      if (!authSalt) {
        setStatus('no account found');
        return;
      }

      // derive verifier using same input as registration
      const verifierB64 = await deriveVerifierB64(master + email, authSalt, 100000);

      const res = await api.post('/api/login', { email, auth_verifier: verifierB64 });
      if (res.data?.ok) {
        setStatus('logged in');
        onSuccess(res.data.userId, master, kdfParams);
      } else {
        setStatus('invalid credentials');
      }
    } catch (err: any) {
      console.error(err);
      setStatus('error: ' + (err?.message || 'unknown'));
    }
  }

  return (
    <form onSubmit={onLogin}>
      <h3>Login</h3>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email" />
      <input value={master} onChange={e => setMaster(e.target.value)} placeholder="master password" type="password" />
      <button type="submit">Login</button>
      <div style={{ marginTop: 8 }}>{status}</div>
    </form>
  );
}

