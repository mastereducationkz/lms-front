import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { installAppTimeZone } from '../lib/datetime';
import App from './App';

// The Google Meet side panel's own entry (`/meet-addon.html`). Deliberately none of the main app's
// router, providers, service worker or Sentry: Meet waits at most 10 seconds for the panel.
installAppTimeZone();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
