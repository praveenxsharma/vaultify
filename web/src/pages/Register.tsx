// web/src/pages/Register.tsx
import { useState } from 'react';
import api from '../api';
import { generateRandomSaltB64, deriveVerifierB64 } from '../utils/crypto';

export default function Register({ onRegistered }: { onRegistered?: () => void }) {
  const [email, setEmail] = useState('');
  const [master, setMaster] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function handleRegister(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setErr(null);
    setOk(null);

    if (!email || !master) {
      setErr('Email and master password required');
      return;
    }
    if (master !== confirm) {
      setErr('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const authSalt = generateRandomSaltB64(16);
      const kdfSalt = generateRandomSaltB64(16);
      const verifierB64 = await deriveVerifierB64(master + email, authSalt, 100000);
      const kdfParams = { algo: 'PBKDF2', salt: kdfSalt, iterations: 250000 };

      const res = await api.post('/api/register', {
        email,
        auth_verifier: verifierB64,
        auth_salt: authSalt,
        kdf_params: kdfParams
      });

      if (res.data?.ok) {
        setOk('Account created — please login.');
        setEmail('');
        setMaster('');
        setConfirm('');
        if (onRegistered) onRegistered();
      } else {
        setErr('registration failed');
      }
    } catch (e: any) {
      console.error(e);
      setErr(e?.response?.data?.error || e?.message || 'network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={centerCard}>
      <form onSubmit={handleRegister} style={cardInner}>
        <h1 style={title}>Create account</h1>
        <p style={subtitle}>Create a zero-knowledge vault — your master password is never sent to the server.</p>

        <label style={label}>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@domain.com" style={input} />

        <label style={{ ...label, marginTop: 12 }}>Master password</label>
        <input type="password" value={master} onChange={e => setMaster(e.target.value)} placeholder="Choose a strong master password" style={input} />

        <label style={{ ...label, marginTop: 12 }}>Confirm</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat master password" style={input} />

        {err ? <div style={error}>{err}</div> : null}
        {ok ? <div style={okStyle}>{ok}</div> : null}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="submit" disabled={loading} style={primaryBtn}>
            {loading ? 'Creating...' : 'Create account'}
          </button>

          <button
            type="button"
            onClick={() => {
              if (onRegistered) onRegistered();
            }}
            style={ghostBtn}
          >
            Back to Login
          </button>
        </div>
      </form>
    </div>
  );
}

/* reuse styles from Login for consistent look */
const centerCard: React.CSSProperties = {
  minHeight: '70vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const cardInner: React.CSSProperties = {
  width: 420,
  padding: 28,
  borderRadius: 12,
  boxShadow: '0 10px 30px rgba(12,40,80,0.08)',
  background: '#fff',
  display: 'flex',
  flexDirection: 'column'
};

const title: React.CSSProperties = { margin: 0, fontSize: 22 };
const subtitle: React.CSSProperties = { marginTop: 8, marginBottom: 12, color: '#64748b', fontSize: 13 };

const label: React.CSSProperties = { fontSize: 13, marginBottom: 6, color: '#475569' };
const input: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(15,23,42,0.06)',
  outline: 'none',
  fontSize: 14
};

const primaryBtn: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  border: 'none',
  background: '#10b981',
  color: '#fff',
  cursor: 'pointer'
};

const ghostBtn: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid rgba(16,185,129,0.12)',
  background: 'transparent',
  color: '#10b981',
  cursor: 'pointer'
};

const error: React.CSSProperties = { marginTop: 10, color: '#b91c1c', fontSize: 13 };
const okStyle: React.CSSProperties = { marginTop: 10, color: '#064e3b', fontSize: 13 };

