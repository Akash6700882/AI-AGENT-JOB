import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
  };

  // No design token for "info" (blue/cyan) exists in this palette, so it
  // stays neutral (foreground/border) rather than inventing an off-palette
  // color — still visually distinct from success (primary) and error
  // (destructive).
  const colors = {
    success: 'border-primary text-primary',
    error: 'border-destructive text-destructive',
    info: 'border-border text-foreground',
  };

  const bgColors = {
    success: 'bg-primary/10',
    error: 'bg-destructive/10',
    info: 'bg-muted',
  };

  const Icon = icons[type];

  return (
    <div
      className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border bg-card shadow-2xl backdrop-blur-sm transition-all duration-300
        ${colors[type]} ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
    >
      <div className={`p-1.5 rounded-lg ${bgColors[type]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-sm font-medium text-foreground pr-4">{message}</span>
      <button
        onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
