'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CapabilityCardProps {
  number: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

export function CapabilityCard({
  number,
  icon: Icon,
  title,
  description,
}: CapabilityCardProps) {
  return (
    <div className="group relative bg-[#0F1115] border border-[#1C2027] rounded-lg p-6 hover:border-[#5EEAD4]/30 transition-all duration-300 cursor-default">
      {/* Subtle hover glow */}
      <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(94,234,212,0.04) 0%, transparent 100%)' }}
      />

      <div className="relative space-y-4">
        {/* Number + Icon row */}
        <div className="flex items-center justify-between">
          <span className="font-landing-mono text-[10px] text-[#8B93A1] font-semibold tracking-[0.14em]">
            {number}
          </span>
          <div className="p-2 bg-[#06070A] border border-[#1C2027] rounded group-hover:border-[#5EEAD4]/25 transition-colors">
            <Icon className="w-4 h-4 text-[#5EEAD4]" />
          </div>
        </div>

        {/* Title */}
        <h3 className="font-landing-display font-semibold text-white text-base uppercase tracking-tight">
          {title}
        </h3>

        {/* Description */}
        <p className="text-xs text-[#8B93A1] leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
