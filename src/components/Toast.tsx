import { CheckCircle2, X } from 'lucide-react';

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="toast" role="status">
      <CheckCircle2 size={21} />
      <span>{message}</span>
      <button onClick={onClose} aria-label="Cerrar confirmación"><X size={18} /></button>
    </div>
  );
}
