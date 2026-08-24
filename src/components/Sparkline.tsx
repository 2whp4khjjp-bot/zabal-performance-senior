type SparklineProps = { values: number[]; color?: string; label: string; min?: number; max?: number };

export function Sparkline({ values, color = '#296eaf', label, min, max }: SparklineProps) {
  if (values.length < 2) return <div className="sparkline-empty">Sin datos suficientes</div>;
  const width = 220;
  const height = 58;
  const low = min ?? Math.min(...values) - 0.5;
  const high = max ?? Math.max(...values) + 0.5;
  const range = Math.max(high - low, 1);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * (width - 8) + 4;
    const y = height - 5 - ((value - low) / range) * (height - 10);
    return `${x},${y}`;
  }).join(' ');
  const last = points.split(' ').at(-1)?.split(',') ?? ['0', '0'];
  return (
    <svg className="sparkline" role="img" aria-label={`${label}: ${values.join(', ')}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <line x1="4" y1={height - 5} x2={width - 4} y2={height - 5} stroke="#dfe6ed" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="4" fill={color} />
    </svg>
  );
}
