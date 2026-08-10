'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, ShieldCheck, AlertTriangle, ShieldAlert, TrendingUp } from 'lucide-react';

interface KPIItem {
  label: string;
  value: string;
  trend: string;
  direction: 'up' | 'down';
  status: 'healthy' | 'warning' | 'critical';
}

const KPI_ITEMS: KPIItem[] = [
  { label: 'Security Score',      value: '94/100', trend: '+2.4%',  direction: 'up',   status: 'healthy' },
  { label: 'Identity Risk',       value: 'LOW',    trend: '−1.2%', direction: 'down', status: 'healthy' },
  { label: 'Agent Risk',          value: 'LOW',    trend: '−0.8%', direction: 'down', status: 'healthy' },
  { label: 'Policy Compliance',   value: '96%',    trend: '+1.1%',  direction: 'up',   status: 'healthy' },
  { label: 'Critical Alerts',     value: '2',      trend: '+1',     direction: 'up',   status: 'warning' },
  { label: 'Identities Governed', value: '12,482', trend: '+182',   direction: 'up',   status: 'healthy' },
];

const RECENT_ACTIVITY = [
  { text: 'DevOps-Agent → DELETE blocked',         label: 'BLOCKED', color: '#FF6B6B' },
  { text: 'Stripe API key rotated automatically',  label: 'ROTATED', color: '#5BD48F' },
  { text: '12 credentials flagged for review',     label: 'REVIEW',  color: '#F2A623' },
];

const statusIcon: Record<string, React.ReactNode> = {
  healthy:  <ShieldCheck className="w-3.5 h-3.5 text-[#5BD48F]" />,
  warning:  <AlertTriangle className="w-3.5 h-3.5 text-[#F2A623]" />,
  critical: <ShieldAlert className="w-3.5 h-3.5 text-[#FF6B6B]" />,
};

const statusValueColor: Record<string, string> = {
  healthy:  '#E7E9EE',
  warning:  '#F2A623',
  critical: '#FF6B6B',
};

function useIntersect() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

export function DashboardPreview() {
  const { ref, visible } = useIntersect();

  return (
    <section id="dashboard" className="w-full bg-[#06070A] landing-section-border">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-20 md:py-28">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <p className="text-[10px] text-[#5EEAD4] font-landing-mono tracking-[0.16em] uppercase font-semibold mb-4">
              05. Command Center
            </p>
            <h2
              className="font-landing-display font-bold text-white uppercase leading-tight"
              style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.5rem)', letterSpacing: '-0.02em' }}
            >
              Unified Security Posture
            </h2>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-[#5EEAD4] text-[#06070A] font-semibold text-sm px-5 py-2.5 rounded hover:bg-white transition-colors self-start md:self-auto focus:outline-none"
          >
            Enter Control Center
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Dashboard preview card */}
        <div
          ref={ref}
          className={`bg-[#0F1115] border border-[#1C2027] rounded-xl overflow-hidden transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {/* Fake title bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#1C2027] bg-[#0A0D11]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B6B]/40" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#F2A623]/40" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#5BD48F]/40" />
              <span className="ml-3 text-[10px] text-[#8B93A1] font-landing-mono">
                nexus.security — Command Center
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5BD48F] animate-pulse" />
              <span className="text-[9px] text-[#5BD48F] font-landing-mono font-semibold">LIVE</span>
            </div>
          </div>

          {/* KPI grid */}
          <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-3">
            {KPI_ITEMS.map((kpi) => (
              <div
                key={kpi.label}
                className="bg-[#06070A] border border-[#1C2027] rounded-lg p-4 hover:border-[#1C2027]/80 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] text-[#8B93A1] font-landing-mono uppercase tracking-wider font-semibold">
                    {kpi.label}
                  </span>
                  {statusIcon[kpi.status]}
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="font-landing-display font-bold text-xl leading-none"
                    style={{
                      color: statusValueColor[kpi.status],
                      fontVariantNumeric: 'tabular-nums',
                      fontFeatureSettings: '"tnum"',
                    }}
                  >
                    {kpi.value}
                  </span>
                  <span
                    className="text-[9px] font-semibold font-landing-mono flex items-center shrink-0"
                    style={{
                      color: kpi.direction === 'up' && kpi.status !== 'warning'
                        ? '#5BD48F'
                        : kpi.direction === 'up'
                        ? '#F2A623'
                        : '#5BD48F',
                    }}
                  >
                    {kpi.direction === 'up'
                      ? <ArrowUpRight className="w-3 h-3" />
                      : <ArrowDownRight className="w-3 h-3" />
                    }
                    {kpi.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Recent activity */}
          <div className="border-t border-[#1C2027] px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-[#8B93A1]" />
              <span className="text-[9px] text-[#8B93A1] font-landing-mono uppercase tracking-wider font-semibold">
                Recent Activity
              </span>
            </div>
            <div className="space-y-2">
              {RECENT_ACTIVITY.map((item) => (
                <div key={item.text} className="flex items-center gap-3">
                  <span
                    className="text-[8px] font-bold font-landing-mono tracking-wider border px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      color: item.color,
                      borderColor: item.color + '30',
                      background: item.color + '10',
                    }}
                  >
                    {item.label}
                  </span>
                  <span className="text-[11px] text-[#8B93A1] font-landing-mono truncate">
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
