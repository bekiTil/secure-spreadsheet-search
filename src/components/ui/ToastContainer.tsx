import { useAppStore } from '@/store/app';
import { CheckIcon, AlertIcon, InfoIcon, XIcon } from './Icons';

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`} role="alert">
          {toast.type === 'success' && <CheckIcon size={16} />}
          {toast.type === 'error' && <AlertIcon size={16} />}
          {toast.type === 'info' && <InfoIcon size={16} />}
          <span style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}>{toast.message}</span>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss notification"
            style={{ padding: '2px', marginLeft: '4px' }}
          >
            <XIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
