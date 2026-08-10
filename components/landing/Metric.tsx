'use client';

import React from 'react';

type MetricStatus = 'healthy' | 'warning' | 'critical' | 'neutral';
type MetricSize = 'default' | 'large' | 'small';

interface MetricProps {
  /** Short all-caps label displayed above the number */
  label: string;
  /** The primary numeric or text value */
  value: string | number;
  /** Optional suffix displayed after the value (e.g. "/100", "%") */
  suffix?: string;
  /** Optional sub-label or unit displayed below the number */
  unit?: string;
  /** Optional delta / change indicator (e.g. "+2.4% from last scan") */
  delta?: string;
  /** Status controls color of the value */
  status?: MetricStatus;
  /** Size variant */
  size?: MetricSize;
  /** Additional class names on the outer container */
  className?: string;
}

const statusValueColor: Record<MetricStatus, string> = {
  healthy: 'text-[#5BD48F]',
  warning: 'text-[#F2A623]',
  critical: 'text-[#FF6B6B]',
  neutral: 'text-white',
};

const statusDeltaColor: Record<MetricStatus, string> = {
  healthy: 'text-[#5BD48F]',
  warning: 'text-[#F2A623]',
  critical: 'text-[#FF6B6B]',
  neutral: 'text-[#8B93A1]',
};

const valueSizeClass: Record<MetricSize, string> = {
  default: 'metric-value',
  large: 'metric-value-lg',
  small: 'metric-value-sm',
};

/**
 * Metric — The single reusable component for ALL landing page statistics.
 *
 * Guarantees:
 *  - font-variant-numeric: tabular-nums (prevents layout shift as digits change)
 *  - fixed min-height content blocks (all cards baseline-aligned)
 *  - zero arbitrary margin offsets
 */
export function Metric({
  label,
  value,
  suffix,
  unit,
  delta,
  status = 'neutral',
  size = 'default',
  className = '',
}: MetricProps) {
  const valueColor = statusValueColor[status];
  const deltaColor = statusDeltaColor[status];

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Label — always same height */}
      <span className="metric-label text-[#8B93A1] font-landing-mono mb-2">
        {label}
      </span>

      {/* Value block — fixed min-height ensures all cards share the same baseline */}
      <div className="metric-content">
        <div className="flex items-baseline gap-1">
          <span className={`${valueSizeClass[size]} ${valueColor} font-landing-display`}>
            {value}
          </span>
          {suffix && (
            <span className={`metric-suffix ${valueColor} opacity-60`}>
              {suffix}
            </span>
          )}
        </div>

        {/* Unit — shown inline below value */}
        {unit && (
          <span className="metric-label text-[#8B93A1] font-landing-mono">
            {unit}
          </span>
        )}
      </div>

      {/* Delta — optional change indicator */}
      {delta && (
        <span className={`text-[11px] font-medium mt-1 ${deltaColor}`}>
          {delta}
        </span>
      )}
    </div>
  );
}
