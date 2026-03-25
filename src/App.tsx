import { useEffect, useState } from 'react';
import { useGameStore } from './store/gameStore';
import { Lobby } from './components/Lobby';
import { GameTable } from './components/GameTable';
import './App.css';

function App() {
  const { room } = useGameStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎴</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>UNO</div>
          <div style={{ color: '#9ca3af', marginTop: '0.5rem' }}>加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
    }}>
      {room.isConnected && room.isGameRunning ? (
        <GameTable />
      ) : (
        <Lobby />
      )}
    </div>
  );
}

export default App;
