import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import 'katex/dist/katex.min.css';
import Router from "./routes/Router";
import ErrorBoundary from "./components/ErrorBoundary";
import StagingBadge from "./components/StagingBadge";
import { registerPwa } from "./services/pwa";
import { startPwaInstall } from "./services/pwaInstall";
import { installDomErrorGuard } from "./utils/domErrorGuard";
import { installAppTimeZone } from "./lib/datetime";
import { startSentry } from "./lib/sentry";

installDomErrorGuard();
// Production builds only (a DSN is baked in by docker-compose). Buffers early errors now and
// loads the SDK in its own chunk once the browser is idle, so the entry bundle stays as it was.
startSentry();
// Every date on screen in Kazakhstan time, whatever zone the viewer's laptop is in.
installAppTimeZone();
// Before anything renders: Chrome's one-off install offer is caught and kept for the install card.
startPwaInstall();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Router />
    </ErrorBoundary>
    <StagingBadge />
  </React.StrictMode>
);

// Register the PWA service worker with a user-driven update prompt (no mid-session takeover).
registerPwa();
