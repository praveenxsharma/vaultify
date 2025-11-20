// web/src/App.tsx
import { useState } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Vault from './pages/Vault';

function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [master, setMaster] = useState<string>('');
  const [kdfParams, setKdfParams] = useState<any>(null);
  const [showRegister, setShowRegister] = useState(false);

  if (!userId) {
    return showRegister ? (
      <Register onRegistered={() => setShowRegister(false)} />
    ) : (
      <Login
        onSuccess={(uid: string, m: string, kp: any) => {
          setUserId(uid);
          setMaster(m);
          setKdfParams(kp);
        }}
        onSwitchToRegister={() => setShowRegister(true)}
      />
    );
  }

  return (
    <Vault
      userId={userId}
      master={master}
      kdfParams={kdfParams}
      onLogout={() => {
        setUserId(null);
        setMaster('');
        setKdfParams(null);
      }}
    />
  );
}

export default App;

