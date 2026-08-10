'use client';

import React from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';

const FOOTER_COLS = [
  {
    title: 'Platform',
    links: ['Dashboard', 'Identities', 'AI Agents', 'Policies', 'Audit Log'],
  },
  {
    title: 'Security',
    links: ['Access Graph', 'Risk Posture', 'Alerts', 'Governance'],
  },
  {
    title: 'Company',
    links: ['Documentation', 'Contact', 'Privacy Policy', 'Terms of Service'],
  },
];

export function LandingFooter() {
  return (
    <footer className="w-full bg-[#06070A] border-t border-[#1C2027]">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-14 md:py-16">

        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">

          {/* Brand column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 border border-[#5EEAD4]/20 rounded bg-[#0F1115]">
                <Shield className="w-3.5 h-3.5 text-[#5EEAD4]" />
              </div>
              <span className="font-landing-display font-semibold text-sm text-white tracking-tight">
                NEXUS
              </span>
            </div>
            <p className="text-[11px] text-[#8B93A1] leading-relaxed max-w-[180px]">
              Non-Human Identity &amp; Autonomous AI Security Control Plane.
            </p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5BD48F]" />
              <span className="text-[9px] text-[#5BD48F] font-landing-mono tracking-wider uppercase">
                System Operational
              </span>
            </div>
          </div>

          {/* Nav columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.title} className="space-y-3">
              <p className="text-[9px] text-[#8B93A1] font-landing-mono uppercase tracking-[0.14em] font-semibold">
                {col.title}
              </p>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="text-[11px] text-[#8B93A1] hover:text-white font-landing-mono transition-colors"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-[#1C2027] flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[10px] text-[#8B93A1] font-landing-mono">
            © 2026 NEXUS. All rights reserved.
          </span>
          <div className="flex items-center gap-4">
            {['Privacy', 'Terms', 'Security'].map((item) => (
              <Link
                key={item}
                href="#"
                className="text-[10px] text-[#8B93A1] hover:text-white font-landing-mono transition-colors"
              >
                {item}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
}
