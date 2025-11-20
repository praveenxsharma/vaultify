// web/src/App.tsx
import { useState } from 'react';
import Register from './pages/Register';
import Login from './pages/Login';
import Vault from './pages/Vault';

function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [master, setMaster] = useState<string>('');
  const [kdfParams, setKdfParams] = useState<any>(null);

  if (!userId) {
    return (
      <div style={{ padding: 20, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 720 }}>
          <Register />
          <hr />
          <Login
            onSuccess={(uid: string, m: string, kp: any) => {
              setUserId(uid);
              setMaster(m);
              setKdfParams(kp);
            }}
          />
        </div>
      </div>
    );
  }

  return <Vault userId={userId} master={master} kdfParams={kdfParams} onLogout={() => { setUserId(null); setMaster(''); setKdfParams(null); }} />;
}

export default App;

