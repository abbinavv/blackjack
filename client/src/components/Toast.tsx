import { useGameStore } from '../store/gameStore';

export function ToastContainer() {
  const { toasts, error } = useGameStore();

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {error && (
        <div className="px-4 py-3 rounded-xl text-sm font-medium animate-slideUp shadow-xl"
             style={{ background: '#7f1d1d', border: '1px solid #ef4444', color: '#fca5a5' }}>
          ⚠ {error}
        </div>
      )}
      {toasts.map((t, i) => (
        <div
          key={i}
          className="px-4 py-3 rounded-xl text-sm font-medium animate-slideUp shadow-xl"
          style={{ background: 'rgba(15,25,35,0.95)', border: '1px solid rgba(255,255,255,0.15)', color: '#f1faee' }}
        >
          {t}
        </div>
      ))}
    </div>
  );
}
