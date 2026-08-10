'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight, ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number | string;
  trend: string;
  trendDirection: 'up' | 'down' | 'neutral';
  status: 'healthy' | 'warning' | 'critical' | 'informational';
}

export function KPICard({ title, value, trend, trendDirection, status }: KPICardProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'healthy':
        return <ShieldCheck className="w-4 h-4 text-healthy-text" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-warning-text" />;
      case 'critical':
        return <ShieldAlert className="w-4 h-4 text-critical-text" />;
      default:
        return null;
    }
  };

  const getTrendIcon = () => {
    if (trendDirection === 'up') {
      return <ArrowUpRight className="w-3 h-3 mr-0.5 shrink-0" />;
    }
    if (trendDirection === 'down') {
      return <ArrowDownRight className="w-3 h-3 mr-0.5 shrink-0" />;
    }
    return null;
  };

  const getTrendStyle = () => {
    if (status === 'critical') {
      // For critical cards, trendUp (meaning more critical threats) is negative (red)
      return trendDirection === 'up' ? 'text-critical-text bg-critical-bg border border-critical-border/20' : 'text-healthy-text bg-healthy-bg border border-healthy-border/20';
    }
    if (status === 'warning') {
      return trendDirection === 'up' ? 'text-warning-text bg-warning-bg border border-warning-border/20' : 'text-healthy-text bg-healthy-bg border border-healthy-border/20';
    }
    // For default metrics, trendUp is generally positive (green)
    return trendDirection === 'up' ? 'text-healthy-text bg-healthy-bg border border-healthy-border/20' : 'text-secondary bg-surface-top border border-border/40';
  };

  return (
    <div className="bg-surface border border-border rounded-[10px] p-5 flex flex-col justify-between hover:border-border/80 transition-all duration-200">
      <div className="flex justify-between items-start">
        <h3 className="text-secondary text-xs font-semibold uppercase tracking-wider">{title}</h3>
        {getStatusIcon()}
      </div>
      
      <div className="mt-4 flex items-baseline justify-between gap-3 w-full min-w-0">
        <span className="text-2xl font-bold text-primary-text tracking-tight truncate shrink">
          {value}
        </span>
        
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] flex items-center shrink-0 whitespace-nowrap ${getTrendStyle()}`}>
          {getTrendIcon()}
          {trend}
        </span>
      </div>
    </div>
  );
}
