import { ArrowLeft, House } from 'lucide-react';

type Props = {
  onBack: () => void;
  onHome: () => void;
};

export function PageNavigation({ onBack, onHome }: Props) {
  return (
    <nav className="page-navigation-shell" aria-label="Navegación de página">
      <div className="page-navigation">
        <button type="button" onClick={onBack} aria-label="Volver a la página anterior" title="Volver">
          <ArrowLeft size={18} /> <span>Volver</span>
        </button>
        <i aria-hidden="true" />
        <button type="button" className="page-navigation__home" onClick={onHome} aria-label="Ir al inicio de Zabal Performance" title="Inicio">
          <House size={17} /> <span>Inicio</span>
        </button>
      </div>
    </nav>
  );
}
