// web/src/App.tsx
// Screenshot reference (uploaded): /mnt/data/8ca02230-2be6-49af-9694-0a716bbec7e0.png

import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Vault from './pages/Vault';
import './global.css'; // optional: create this to hold global styles (recommended)

function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [master, setMaster] = useState<string>('');
  const [kdfParams, setKdfParams] = useState<any>(null);
  const [showRegister, setShowRegister] = useState(false);

  // theme stored in localStorage by Vault.tsx; default to 'light'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('vaultify_theme') as 'light' | 'dark') || 'light';
    } catch {
      return 'light';
    }
  });

  // Apply theme as a CSS variable on the document root so all pages share it.
  useEffect(() => {
    const bg = theme === 'dark' ? '#0f1720' : '#f7fbff';
    document.documentElement.style.setProperty('--vaultify-bg', bg);
    // keep the body text color consistent
    document.documentElement.style.setProperty('--vaultify-text', theme === 'dark' ? '#e6eef8' : '#0f1720');
    try {
      localStorage.setItem('vaultify_theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // Watch for external theme changes (e.g., Vault component toggling theme)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'vaultify_theme') {
        setTheme((e.newValue as 'light' | 'dark') || 'light');
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Wrap login/register into a centered container when not authenticated
  if (!userId) {
    return showRegister ? (
      <div style={centerOuter}>
        <Register
          onRegistered={() => {
            setShowRegister(false);
          }}
        />
      </div>
    ) : (
      <div style={centerOuter}>
        <Login
          onSuccess={(uid: string, m: string, kp: any) => {
            setUserId(uid);
            setMaster(m);
            setKdfParams(kp);
          }}
          onSwitchToRegister={() => setShowRegister(true)}
        />
      </div>
    );
  }

  return (
    <Vault
      userId={userId}
      master={master}
      kdfParams={kdfParams}
      onLogout={() => {
        // wipe in-memory secrets
        setUserId(null);
        setMaster('');
        setKdfParams(null);
      }}
    />
  );
}

export default App;

/* Styles */

// full viewport center container used for Login/Register pages
const centerOuter: React.CSSProperties = {
  minHeight: '100vh',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  boxSizing: 'border-box',
  background: 'var(--vaultify-bg, #f7fbff)', // fallback to light if var missing
};

