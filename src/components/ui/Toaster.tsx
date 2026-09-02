import { useToastStore } from '../../store/toastStore';
import { Loader2, CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-start gap-3 p-4 rounded-xl border shadow-lg animate-in slide-in-from-bottom-5 fade-in duration-300 bg-white border-gray-200 text-gray-900",
            toast.type === 'error' && "border-gray-900/40 bg-gray-50/50"
          )}
        >
          <div className="shrink-0 mt-0.5">
            {toast.type === 'loading' && <Loader2 className="w-5 h-5 animate-spin text-gray-900" />}
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-gray-900" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-gray-900" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-gray-700" />}
          </div>
          <div className="flex-1 text-sm font-medium text-gray-900">
            {toast.message}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-gray-400 hover:text-gray-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
