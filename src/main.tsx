import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'katex/dist/katex.min.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { Toaster, toast } from 'sonner';

const isBenignViteWsError = (err: unknown): boolean => {
  const message = typeof err === 'string' ? err : (err as { message?: string })?.message || '';
  const stack = (err as { stack?: string })?.stack || '';
  return (
    message.includes('WebSocket closed without opened') ||
    (stack.includes('@vite/client') && message.toLowerCase().includes('websocket'))
  );
};

// Global Error Listeners
window.addEventListener('error', (event) => {
  if (isBenignViteWsError(event.error || event.message)) {
    event.preventDefault();
    return;
  }
  console.error("Global Error Caught:", event.error || event.message);
  toast.error(event.message || "Terjadi kesalahan yang tidak terduga", {
    description: event.error?.stack ? event.error.stack.split('\n').slice(0, 3).join('\n') : "Periksa konsol untuk detail.",
    duration: 10000,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  if (isBenignViteWsError(event.reason)) {
    event.preventDefault();
    return;
  }
  console.error("Unhandled Promise Rejection:", event.reason);
  const reason = event.reason;
  const msg = typeof reason === 'string' ? reason : reason?.message || "Unhandled Promise Rejection";
  toast.error(msg, {
    description: reason?.stack ? reason.stack.split('\n').slice(0, 3).join('\n') : "Periksa konsol untuk detail.",
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

