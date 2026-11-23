import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

try {
  registerSW({
    immediate: true,
    onOfflineReady() {
      // Offline app shell cached cleanly
    },
  });
} catch {
  // Service worker registration skipped if unsupported
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
