'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

export function FinalCTA() {
  const { showToast } = useToast();

  return (
    <section id="cta" className="w-full bg-[#080B10] landing-section-border">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-24 md:py-36">

        <div className="max-w-3xl mx-auto text-center space-y-8">

          {/* Status pill */}
          <div className="inline-flex items-center gap-2 bg-[#0F1115] border border-[#1C2027] px-4 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5EEAD4] animate-pulse" />
            <span className="text-[9px] text-[#5EEAD4] font-landing-mono tracking-[0.16em] uppercase font-semibold">
              Secure Connection Available
            </span>
          </div>

          {/* Headline */}
          <div className="space-y-1">
            <h2
              className="font-landing-display font-bold text-white uppercase leading-tight"
              style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)', letterSpacing: '-0.025em' }}
            >
              Your Autonomous Identities
            </h2>
            <h2
              className="font-landing-display font-bold text-white uppercase leading-tight"
              style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)', letterSpacing: '-0.025em' }}
            >
              Are Already Everywhere.
            </h2>
            <h2
              className="font-landing-display font-bold uppercase leading-tight"
              style={{
                fontSize: 'clamp(2rem, 5vw, 3.75rem)',
                letterSpacing: '-0.025em',
                color: '#5EEAD4',
              }}
            >
              NEXUS Gives You Control.
            </h2>
          </div>

          {/* Supporting text */}
          <p className="text-[#8B93A1] text-base leading-relaxed max-w-xl mx-auto">
            Secure your non-human perimeter. Enforce zero-trust rules on autonomous agents.
            Begin continuous governance across your enterprise today.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-[#5EEAD4] text-[#06070A] font-semibold text-sm px-8 py-3.5 rounded hover:bg-white transition-colors focus:outline-none"
            >
              Enter Control Center
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={() => showToast('Access request received. Our team will reach out shortly.', 'success')}
              className="inline-flex items-center justify-center gap-2 bg-[#0F1115] border border-[#1C2027] text-[#E7E9EE] hover:border-[#5EEAD4]/35 hover:text-white font-semibold text-sm px-8 py-3.5 rounded transition-colors cursor-pointer focus:outline-none"
            >
              Request Access
            </button>
          </div>

          {/* Divider */}
          <div className="pt-4 border-t border-[#1C2027]" />

          {/* Trust stats */}
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { value: '12K+', label: 'Identities Monitored' },
              { value: '99.9%', label: 'Platform Uptime' },
              { value: '< 50ms', label: 'Policy Evaluation' },
            ].map((stat) => (
              <div key={stat.label}>
                <span
                  className="font-landing-display font-bold text-white block"
                  style={{ fontSize: '1.5rem', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }}
                >
                  {stat.value}
                </span>
                <span className="text-[10px] text-[#8B93A1] font-landing-mono uppercase tracking-wider mt-1 block">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
