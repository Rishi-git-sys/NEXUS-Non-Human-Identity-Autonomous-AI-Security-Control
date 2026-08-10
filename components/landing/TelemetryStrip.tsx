'use client';

import React from 'react';
import { Metric } from './Metric';

const TELEMETRY_METRICS = [
  {
    label: 'Identities Monitored',
    value: '12,482',
    status: 'neutral' as const,
    delta: 'Real-time',
  },
  {
    label: 'Critical Risks',
    value: '2',
    status: 'warning' as const,
    delta: 'Active',
  },
  {
    label: 'Policy Compliance',
    value: '96',
    suffix: '%',
    status: 'healthy' as const,
    delta: '+1.2% this week',
  },
  {
    label: 'Continuous Monitoring',
    value: '24/7',
    status: 'neutral' as const,
    delta: 'Always on',
  },
];

/**
 * TelemetryStrip — Full-width stat strip immediately below the hero.
 * All four metrics use the shared <Metric> component — guaranteed alignment.
 */
export function TelemetryStrip() {
  return (
    <div
      id="telemetry"
      className="w-full border-t border-b border-[#1C2027] bg-[#0F1115]/60 backdrop-blur-sm"
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x md:divide-[#1C2027]">
          {TELEMETRY_METRICS.map((m, i) => (
            <div
              key={m.label}
              className={`${i > 0 ? 'md:pl-8' : ''} ${i < TELEMETRY_METRICS.length - 1 ? 'md:pr-8' : ''}`}
            >
              <Metric
                label={m.label}
                value={m.value}
                suffix={m.suffix}
                status={m.status}
                delta={m.delta}
                size="default"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
