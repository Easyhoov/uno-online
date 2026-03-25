import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 调试日志
console.log('main.tsx: Starting...');
console.log('React version:', StrictMode);

const rootElement = document.getElementById('root');
console.log('Root element:', rootElement);

if (!rootElement) {
  console.error('Root element not found!');
} else {
  const root = createRoot(rootElement);
  console.log('Root created, rendering App...');
  
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  
  console.log('App rendered');
}
