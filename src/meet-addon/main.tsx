import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { installAppTimeZone } from '../lib/datetime';
import App from './App';
import { isDarkChoice } from '../lib/theme';

// The Google Meet side panel's own entry (`/meet-addon.html`). Deliberately none of the main app's
// router, providers, service worker or Sentry: Meet waits at most 10 seconds for the panel.
installAppTimeZone();

// The panel has no ThemeProvider. Follow the LMS's saved choice when the frame can read it, else
// the system (Meet itself is dark by default), and keep following the system until one is saved.
function savedTheme(): string | null {
  try { return localStorage.getItem('theme'); } catch { return null; }
}
const scheme = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => {
  const saved = savedTheme();
  document.documentElement.classList.toggle('dark', isDarkChoice(saved, scheme.matches));
};
applyTheme();
scheme.addEventListener('change', applyTheme);

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
