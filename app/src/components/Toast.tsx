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

  const colors = {
    success: 'border-[#10B981] text-[#10B981]',
    error: 'border-[#EF4444] text-[#EF4444]',
    info: 'border-[#06B6D4] text-[#06B6D4]',
  };

  const bgColors = {
    success: 'bg-[#10B981]/10',
    error: 'bg-[#EF4444]/10',
    info: 'bg-[#06B6D4]/10',
  };

  const Icon = icons[type];

  return (
    <div
      className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border bg-[#0A1128] shadow-2xl backdrop-blur-sm transition-all duration-300
        ${colors[type]} ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
    >
      <div className={`p-1.5 rounded-lg ${bgColors[type]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-sm font-medium text-[#F8FAFC] pr-4">{message}</span>
      <button
        onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
        className="text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
