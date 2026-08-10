'use client';

import React from 'react';

const IDENTITY_TYPES = [
  'Service Accounts',
  'API Keys & Tokens',
  'Workload Identities',
  'Bots & Automation',
  'Autonomous AI Agents',
  'Machine Credentials',
  'Cloud IAM Roles',
  'CI/CD Pipelines',
];

const IDENTITY_LAYERS = [
  { label: 'Human Users', color: '#8B93A1' },
  { label: 'Applications', color: '#8B93A1' },
  { label: 'Service Identities', color: '#5EEAD4', highlight: true },
  { label: 'AI Agents', color: '#5EEAD4', highlight: true },
  { label: 'Cloud / Infrastructure', color: '#5EEAD4', highlight: true },
];

export function PlatformOverview() {
  return (
    <section
      id="platform"
      className="w-full bg-[#06070A] landing-section-border"
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-20 md:py-28">

        {/* Section header */}
        <div className="max-w-2xl mb-14 md:mb-20">
          <p className="text-[10px] text-[#5EEAD4] font-landing-mono tracking-[0.16em] uppercase font-semibold mb-4">
            01. The Problem
          </p>
          <h2
            className="font-landing-display font-bold text-white uppercase leading-tight mb-5"
            style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', letterSpacing: '-0.02em' }}
          >
            Security for the Autonomous Enterprise
          </h2>
          <p className="text-[#8B93A1] text-base leading-relaxed max-w-xl">
            Traditional IAM was designed for human users with usernames and passwords.
            Modern enterprises now operate thousands of non-human identities that bypass
            every legacy security gate.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* ── Left: Identity type list ── */}
          <div className="space-y-8">
            <div>
              <p className="text-xs text-[#8B93A1] font-landing-mono uppercase tracking-wider mb-4">
                What legacy IAM misses
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {IDENTITY_TYPES.map((type) => (
                  <div
                    key={type}
                    className="flex items-center gap-2.5 bg-[#0F1115] border border-[#1C2027] px-3.5 py-2.5 rounded hover:border-[#5EEAD4]/25 transition-colors"
                  >
                    <span className="w-1 h-1 rounded-full bg-[#5EEAD4] shrink-0" />
                    <span className="text-xs text-[#E7E9EE] font-landing-mono">
                      {type}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0F1115] border border-[#FF6B6B]/20 rounded p-4">
              <p className="text-[10px] text-[#FF6B6B] font-landing-mono uppercase tracking-wider font-semibold mb-2">
                The Security Gap
              </p>
              <p className="text-xs text-[#8B93A1] leading-relaxed">
                Machine identities now outnumber human identities by 45:1 in the average
                enterprise. They operate continuously with no MFA, no session expiry, and
                minimal audit coverage.
              </p>
            </div>
          </div>

          {/* ── Right: Identity layer diagram ── */}
          <div className="bg-[#0F1115] border border-[#1C2027] rounded-lg p-6 relative overflow-hidden">
            <div className="absolute inset-0 landing-grid-bg pointer-events-none opacity-50" />
            <div className="relative">
              <p className="text-[9px] text-[#8B93A1] font-landing-mono uppercase tracking-wider mb-6">
                Enterprise Identity Stack
              </p>

              <div className="space-y-2">
                {IDENTITY_LAYERS.map((layer, i) => (
                  <React.Fragment key={layer.label}>
                    <div
                      className={`flex items-center justify-between px-4 py-3 rounded border transition-colors ${
                        layer.highlight
                          ? 'bg-[#5EEAD4]/5 border-[#5EEAD4]/20'
                          : 'bg-[#06070A] border-[#1C2027]'
                      }`}
                    >
                      <span
                        className="text-xs font-landing-mono font-medium"
                        style={{ color: layer.color }}
                      >
                        {layer.label}
                      </span>
                      {layer.highlight && (
                        <span className="text-[9px] text-[#5EEAD4] font-landing-mono tracking-wider uppercase">
                          NEXUS governed
                        </span>
                      )}
                    </div>

                    {/* Connector arrow */}
                    {i < IDENTITY_LAYERS.length - 1 && (
                      <div className="flex justify-center">
                        <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
                          <line x1="6" y1="0" x2="6" y2="10" stroke="#1C2027" strokeWidth="1.5" />
                          <polyline points="2,7 6,12 10,7" stroke="#1C2027" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* NEXUS span indicator */}
              <div className="mt-6 flex items-center gap-2 px-4 py-2.5 border border-[#5EEAD4]/30 rounded bg-[#5EEAD4]/5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5EEAD4]" />
                <span className="text-[10px] text-[#5EEAD4] font-landing-mono tracking-wider uppercase font-semibold">
                  NEXUS spans the full identity layer
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
