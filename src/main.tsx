import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Client-side protection against casual inspection (Right-click, F12, Ctrl+U)
if (typeof window !== 'undefined') {
  // Disable Right-Click context menu
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Block Developer Tools & View Source shortcuts
  document.addEventListener('keydown', (e) => {
    // F12 key
    if (e.keyCode === 123) {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (Inspect)
    if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
      e.preventDefault();
      return false;
    }
    // Ctrl+U (View Source)
    if (e.ctrlKey && (e.keyCode === 85 || e.keyCode === 83)) {
      e.preventDefault();
      return false;
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

