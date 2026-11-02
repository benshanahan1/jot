import { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
}

const TOAST_DURATION_MS = 3000;

export function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}
