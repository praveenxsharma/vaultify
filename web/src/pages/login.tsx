// web/src/pages/Login.tsx
import { useState } from 'react';
import api from '../api';
import { deriveVerifierB64 } from '../utils/crypto';

export default function Login({
  onSuccess,
  onSwitchToRegister
}: {
  onSuccess: (userId: string, master: string, kdfParams: any) => void;
  onSwitchToRegister: () => void;
}) {
  const [email, setEmail] = useState('');
  const [master, setMaster] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setErr(null);
    if (!email || !master) {
      setErr('Please enter email and master password.');
      return;
    }
    setLoading(true);
    try {
      // fetch auth_salt + kdf_params first
      const saltRes = await api.get('/api/auth_salt', { params: { email } });
      const authSalt = saltRes.data?.auth_salt;
      const kdfParams = saltRes.data?.kdf_params || {};

      if (!authSalt) {
        setErr('Account not found. Click Register to create one.');
        setLoading(false);
        return;
      }

      // derive deterministic verifier (same as in register)
      const verifierB64 = await deriveVerifierB64(master + email, authSalt, 100000);

      const res = await api.post('/api/login', { email, auth_verifier: verifierB64 });
      if (res.data?.ok) {
        onSuccess(res.data.userId, master, kdfParams);
      } else {
        setErr('Invalid credentials');
      }
    } catch (e: any) {
      console.error(e);
      setErr((e?.response?.data?.error) || e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={centerCard}>
      <form onSubmit={handleSubmit} style={cardInner}>
        <h1 style={title}>Welcome back</h1>
        <p style={subtitle}>Unlock your Vaultify vault — all encryption happens in your browser.</p>

        <label style={label}>Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@domain.com"
          style={input}
          autoFocus
        />

        <label style={{ ...label, marginTop: 12 }}>Master password</label>
        <input
          type="password"
          value={master}
          onChange={e => setMaster(e.target.value)}
          placeholder="Your master password"
          style={input}
        />

        {err ? <div style={error}>{err}</div> : null}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="submit" disabled={loading} style={primaryBtn}>
            {loading ? 'Logging in...' : 'Log in'}
          </button>
          <button type="button" onClick={onSwitchToRegister} style={ghostBtn}>
            No account? Register
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: '#677285' }}>
          Tip: your master password never leaves your browser.
        </div>
      </form>
    </div>
  );
}

/* styles */
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
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer'
};

const ghostBtn: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid rgba(37,99,235,0.12)',
  background: 'transparent',
  color: '#2563eb',
  cursor: 'pointer'
};

const error: React.CSSProperties = { marginTop: 10, color: '#b91c1c', fontSize: 13 };

