'use client';

// Hand-built SVG charts — no external library, so nothing new can break the build.

export function Donut({ segments, size = 150, thickness = 22, center, centerSub }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  if (total === 0) {
    return <div className="empty" style={{ padding: '30px 0', textAlign: 'center' }}>No data yet.</div>;
  }

  let offset = 0;

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f6" strokeWidth={thickness} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((seg, i) => {
            if (seg.value <= 0) return null;
            const len = (seg.value / total) * c;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        {center !== undefined && (
          <text x="50%" y="49%" textAnchor="middle" dominantBaseline="middle" className="donut-center">
            {center}
          </text>
        )}
        {centerSub && (
          <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle" className="donut-sub">
            {centerSub}
          </text>
        )}
      </svg>
      <div className="donut-legend">
        {segments.map((seg, i) => (
          <div key={i} className="legend-item">
            <span className="legend-dot" style={{ background: seg.color }} />
            <span>{seg.label}</span>
            <strong>{seg.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarList({ items, max = 5 }) {
  if (!items.length) {
    return <div className="empty" style={{ padding: '20px 0' }}>No data yet.</div>;
  }
  return (
    <div className="bars">
      {items.map((it, i) => (
        <div className="bar-row" key={i}>
          <div className="bar-label">{it.label}</div>
          <div className="bar-track">
            <div className={`bar-fill ${it.band || ''}`} style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
          <div className="bar-value">{it.value.toFixed(1)}</div>
        </div>
      ))}
    </div>
  );
}
