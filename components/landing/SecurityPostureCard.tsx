'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';

interface PostureRow {
  label: string;
  value: string;
  status: 'healthy' | 'warning' | 'critical' | 'neutral';
}

const POSTURE_ROWS: PostureRow[] = [
  { label: 'Identity Risk', value: 'LOW', status: 'healthy' },
  { label: 'AI Agent Risk', value: 'LOW', status: 'healthy' },
  { label: 'Privileged Access', value: '2', status: 'warning' },
  { label: 'Policy Compliance', value: '96%', status: 'healthy' },
];

const statusValueColor: Record<string, string> = {
  healthy: '#5BD48F',
  warning: '#F2A623',
  critical: '#FF6B6B',
  neutral: '#E7E9EE',
};

/**
 * SecurityPostureCard — The hero right-panel visual.
 * Shows an animated security score counter plus live posture rows.
 * Replaces the terminal block from the previous design.
 */
export function SecurityPostureCard() {
  const [score, setScore] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const delay = setTimeout(() => {
      setMounted(true);
      const target = 94;
      const duration = 1200;
      const step = target / (duration / 16);
      let current = 0;

      const timer = setInterval(() => {
        current += step;
        if (current >= target) {
          setScore(target);
          clearInterval(timer);
        } else {
          setScore(Math.floor(current));
        }
      }, 16);

      return () => clearInterval(timer);
    }, 600);

    return () => clearTimeout(delay);
  }, []);

  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference - (circumference * score) / 100;

  return (
    <div
      className="relative bg-[#0F1115] border border-[#1C2027] rounded-lg shadow-2xl overflow-hidden animate-border-glow"
      style={{ minWidth: 0 }}
    >
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 landing-grid-bg pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center justify-between px-5 py-3.5 border-b border-[#1C2027]">
        <div>
          <p className="text-[9px] text-[#5EEAD4] font-landing-mono tracking-[0.14em] uppercase font-semibold">
            NEXUS Security Posture
          </p>
          <p className="text-[8px] text-[#8B93A1] font-landing-mono tracking-wider uppercase mt-0.5">
            Live Environment
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-[9px] text-[#5BD48F] font-landing-mono font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5BD48F] animate-pulse" />
          OPERATIONAL
        </span>
      </div>

      {/* Score */}
      <div className="relative flex flex-col items-center py-6 px-5">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            {/* Track */}
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke="#1C2027"
              strokeWidth="6"
            />
            {/* Progress */}
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke="#5EEAD4"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={mounted ? dashOffset : circumference}
              style={{ transition: 'stroke-dashoffset 0.05s linear' }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span
              className="font-landing-display font-bold text-white leading-none"
              style={{
                fontSize: '2rem',
                fontVariantNumeric: 'tabular-nums',
                fontFeatureSettings: '"tnum"',
              }}
            >
              {score}
            </span>
            <span className="text-[9px] text-[#8B93A1] font-landing-mono tracking-wider uppercase mt-1">
              Security Score
            </span>
          </div>
        </div>

        {/* Trend */}
        <div className="flex items-center gap-1 mt-2">
          <TrendingUp className="w-3 h-3 text-[#5BD48F]" />
          <span className="text-[10px] text-[#5BD48F] font-medium">
            +2.4% from last scan
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-[#1C2027]" />

      {/* Posture rows */}
      <div className="relative px-5 py-4 space-y-3">
        {POSTURE_ROWS.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-[11px] text-[#8B93A1] font-landing-mono">
              {row.label}
            </span>
            <span
              className="text-[11px] font-semibold font-landing-mono tracking-wide"
              style={{ color: statusValueColor[row.status] }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
