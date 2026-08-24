import { appConfig } from '../config';

type BrandProps = { compact?: boolean; light?: boolean };

export function Brand({ compact = false, light = false }: BrandProps) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''} ${light ? 'brand--light' : ''}`}>
      <img className="brand__mark" src={appConfig.logoSrc} alt="Isotipo Zabal Performance" />
      <div>
        <div className="brand__name"><span>ZABAL</span> PERFORMANCE</div>
        {!compact && <div className="brand__subtitle">Control preentrenamiento</div>}
      </div>
    </div>
  );
}
