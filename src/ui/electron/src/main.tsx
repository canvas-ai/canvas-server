import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Check if we're running in Electron
const isElectron = typeof process !== 'undefined' && process.versions && !!process.versions.electron;

if (isElectron) {
  console.log('Running in Electron environment');
} else {
  console.warn('Not running in Electron environment - some features may not work');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
