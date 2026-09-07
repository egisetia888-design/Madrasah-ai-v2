import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'katex/dist/katex.min.css';
import { initFirestoreSync } from './lib/firestoreSync';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { Toaster, toast } from 'sonner';

initFirestoreSync();

// Global Error Listeners
window.addEventListener('error', (event) => {
  console.error("Global Error Caught:", event.error || event.message);
  toast.error(event.message || "An unexpected error occurred", {
    description: event.error?.stack ? event.error.stack.split('\n').slice(0, 3).join('\n') : "Check console for details.",
    duration: 10000,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error("Unhandled Promise Rejection:", event.reason);
  const reason = event.reason;
  const msg = typeof reason === 'string' ? reason : reason?.message || "Unhandled Promise Rejection";
  toast.error(msg, {
    description: reason?.stack ? reason.stack.split('\n').slice(0, 3).join('\n') : "Check console for details.",
    duration: 10000,
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Toaster position="top-right" expand={true} richColors theme="light" />
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

