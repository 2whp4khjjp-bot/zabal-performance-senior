import { WifiOff } from 'lucide-react';

export function OfflineBanner({ offline }: { offline: boolean }) {
  if (!offline) return null;
  return (
    <div className="offline-banner" role="status">
      <WifiOff size={18} aria-hidden="true" />
      Sin conexión. Conservaremos el formulario en este dispositivo.
    </div>
  );
}
