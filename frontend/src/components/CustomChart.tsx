import React, { useState } from 'react';

// Common Tooltip Component
interface TooltipProps {
  x: number;
  y: number;
  label: string;
  value: string | number;
  visible: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({ x, y, label, value, visible }) => {
  if (!visible) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: `${x + 10}px`,
        top: `${y - 35}px`,
        background: '#0d1210',
        border: '1px solid var(--border)',
        padding: '6px 10px',
        borderRadius: '4px',
        fontSize: '11px',
        fontFamily: 'JetBrains Mono, monospace',
        color: '#f4f4f0',
        pointerEvents: 'none',
        zIndex: 50,
        boxShadow: '0 8px 16px rgba(6,10,8,0.5)',
      }}
    >
      <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
      <div style={{ color: 'var(--accent)', fontWeight: 500 }}>{value}</div>
    </div>
  );
};

// 1. Horizontal Bar Chart (for SHAP/LIME or leaderboards)
interface HorizontalBarChartProps {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  metricLabel?: string;
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  data,
  maxValue,
  metricLabel = 'Value',
}) => {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    value: string | number;
    visible: boolean;
  }>({ x: 0, y: 0, label: '', value: '', visible: false });

  const validData = data.filter(d => d.value !== undefined && !isNaN(d.value));
  if (validData.length === 0) {
    return <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>No data to display</div>;
  }

  const computedMax = maxValue || Math.max(...validData.map(d => Math.abs(d.value)), 0.0001);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Tooltip {...tooltip} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {validData.map((item, idx) => {
          const isNegative = item.value < 0;
          const absVal = Math.abs(item.value);
          const percent = (absVal / computedMax) * 100;

          // Sage green for positive features, Champagne for negative contributions in LIME
          const barColor = item.color || (isNegative ? '#c4b5a3' : '#8ba393');

          const handleMouseMove = (e: React.MouseEvent) => {
            const containerRect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
            if (containerRect) {
              setTooltip({
                x: e.clientX - containerRect.left,
                y: e.clientY - containerRect.top,
                label: item.label,
                value: `${metricLabel}: ${item.value.toFixed(4)}`,
                visible: true,
              });
            }
          };

          return (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr 60px',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              {/* Feature label */}
              <div
                style={{
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'right',
                }}
                title={item.label}
              >
                {item.label}
              </div>

              {/* Bar track */}
              <div
                style={{
                  height: '14px',
                  background: '#060a08',
                  borderRadius: '2px',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
              >
                {/* Visual bar fill */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: isNegative ? 'auto' : 0,
                    right: isNegative ? 0 : 'auto',
                    width: `${percent}%`,
                    backgroundColor: barColor,
                    borderRadius: '1px',
                    transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </div>

              {/* Numerical value */}
              <div
                style={{
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--highlight)',
                  textAlign: 'left',
                }}
              >
                {item.value.toFixed(4)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 2. Ranked Leaderboard Bar Chart (comparing model scores side-by-side)
interface ModelBarChartProps {
  data: { label: string; value: number }[];
  metricName: string;
}

export const ModelBarChart: React.FC<ModelBarChartProps> = ({ data, metricName }) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    value: string | number;
    visible: boolean;
  }>({ x: 0, y: 0, label: '', value: '', visible: false });

  if (data.length === 0) return null;

  const maxScore = Math.max(...data.map(d => d.value), 0.001);
  const height = 180;
  const paddingBottom = 30;
  const paddingTop = 15;
  const chartHeight = height - paddingBottom - paddingTop;

  return (
    <div style={{ position: 'relative', width: '100%', padding: '10px 0' }}>
      <Tooltip {...tooltip} />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'flex-end',
          height: `${height}px`,
          borderBottom: '1px solid var(--border)',
          position: 'relative',
          paddingBottom: `${paddingBottom}px`,
        }}
      >
        {/* Simple grid lines background */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: '25%', borderTop: '1px dashed rgba(139, 163, 147, 0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: '1px dashed rgba(139, 163, 147, 0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: '75%', borderTop: '1px dashed rgba(139, 163, 147, 0.05)', pointerEvents: 'none' }} />

        {data.map((item, idx) => {
          const percent = (item.value / maxScore) * chartHeight;
          const isActive = activeIdx === idx;

          const handleMouseMove = (e: React.MouseEvent) => {
            const containerRect = e.currentTarget.parentElement?.getBoundingClientRect();
            if (containerRect) {
              setTooltip({
                x: e.clientX - containerRect.left,
                y: e.clientY - containerRect.top,
                label: item.label,
                value: `${metricName}: ${item.value.toFixed(4)}`,
                visible: true,
              });
              setActiveIdx(idx);
            }
          };

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                position: 'relative',
                zIndex: 10,
              }}
            >
              {/* Score bar */}
              <div
                style={{
                  width: '32px',
                  height: `${percent}px`,
                  background: isActive ? 'var(--highlight)' : 'var(--accent)',
                  borderRadius: '2px 2px 0 0',
                  cursor: 'pointer',
                  transition: 'height 0.6s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s',
                  border: '1px solid var(--border)',
                  borderBottom: 'none',
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => {
                  setTooltip(t => ({ ...t, visible: false }));
                  setActiveIdx(null);
                }}
              />

              {/* Shortened Label */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '-24px',
                  fontSize: '10px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: isActive ? 'var(--highlight)' : 'var(--text-muted)',
                  textAlign: 'center',
                  width: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={item.label}
              >
                {item.label.replace('Classifier', 'Clf').replace('Regressor', 'Reg')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
