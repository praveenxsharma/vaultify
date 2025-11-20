// web/src/pages/Register.tsx
import React, { useState } from 'react';
import api from '../api';
import { generateRandomSaltB64, deriveVerifierB64 } from '../utils/crypto';

export default function Register() {
  const [email, setEmail] = useState('');
  const [master, setMaster] = useState('');
  const [status, setStatus] = useState('');

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setStatus('registering...');
    try {
      // Two salts: one for auth verifier, one for AES KDF (keeps separation of concerns)
      const authSalt = generateRandomSaltB64(16); // for verifier
      const kdfSalt = generateRandomSaltB64(16);  // for AES key derivation

      // Deterministic verifier: use master+email for domain separation
      const verifierB64 = await deriveVerifierB64(master + email, authSalt, 100000);

      const kdfParams = { algo: 'PBKDF2', salt: kdfSalt, iterations: 250000 };

      await api.post('/api/register', {
        email,
        auth_verifier: verifierB64,
        auth_salt: authSalt,
        kdf_params: kdfParams
      });

      setStatus('registered! please login.');
    } catch (err: any) {
      console.error(err);
      setStatus('error: ' + (err?.message || 'unknown'));
    }
  }

  return (
    <form onSubmit={onRegister} style={{ marginBottom: 16 }}>
      <h3>Register</h3>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email" />
      <input value={master} onChange={e => setMaster(e.target.value)} placeholder="master password" type="password" />
      <button type="submit">Register</button>
      <div style={{ marginTop: 8 }}>{status}</div>
    </form>
  );
}

