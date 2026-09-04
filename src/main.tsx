import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Registra o Service Worker para cache e uso 100% offline
registerSW({
  immediate: true,
  onOfflineReady() {
    console.log('Activity Totem: Aplicativo pronto para funcionar offline!');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
