'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Shield, Menu, X } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

const NAV_LINKS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Capabilities', href: '#capabilities' },
  { label: 'Security', href: '#ai-security' },
  { label: 'Resources', href: '#dashboard' },
];

function scrollToSection(href: string) {
  const id = href.replace('#', '');
  const el = document.getElementById(id);
  if (!el) return;
  // The landing page scroll container is the RootLayoutWrapper div.
  // scrollIntoView scrolls the nearest scrollable ancestor automatically.
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function LandingNavbar() {
  const { showToast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-[#1C2027] bg-[#06070A]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-5 md:px-8">

          {/* ── Brand ── */}
          <Link href="/" className="flex items-center gap-2.5 select-none group">
            <div className="p-1.5 border border-[#5EEAD4]/25 rounded bg-[#0F1115] group-hover:border-[#5EEAD4]/50 transition-colors">
              <Shield className="w-3.5 h-3.5 text-[#5EEAD4]" />
            </div>
            <div className="leading-none">
              <span className="font-landing-display font-semibold text-sm tracking-tight text-white block">
                NEXUS
              </span>
              <span className="text-[9px] text-[#5EEAD4] font-landing-mono tracking-[0.12em] uppercase block font-semibold opacity-80">
                Non-Human Identity Security
              </span>
            </div>
          </Link>

          {/* ── Center Nav (desktop) ── */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <button
                key={link.label}
                onClick={() => scrollToSection(link.href)}
                className="text-[#8B93A1] hover:text-white text-xs font-medium tracking-wide transition-colors cursor-pointer focus:outline-none"
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* ── Right Actions ── */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center text-xs font-semibold text-[#8B93A1] hover:text-white px-3.5 py-1.5 rounded transition-colors focus:outline-none"
            >
              Sign In
            </Link>
            <button
              onClick={() => showToast('Access request received. Our team will be in touch.', 'success')}
              className="bg-[#5EEAD4] text-[#06070A] font-semibold text-xs px-4 py-1.5 rounded hover:bg-white transition-colors cursor-pointer focus:outline-none"
            >
              Request Access
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden text-[#8B93A1] hover:text-white ml-1 focus:outline-none cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Menu ── */}
      {mobileOpen && (
        <div className="fixed top-14 left-0 right-0 z-40 bg-[#06070A] border-b border-[#1C2027] animate-slide-down md:hidden">
          <div className="px-5 py-4 flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <button
                key={link.label}
                onClick={() => {
                  scrollToSection(link.href);
                  setMobileOpen(false);
                }}
                className="text-left text-sm text-[#8B93A1] hover:text-white font-medium transition-colors cursor-pointer focus:outline-none"
              >
                {link.label}
              </button>
            ))}
            <Link
              href="/login"
              className="text-sm text-[#8B93A1] hover:text-white font-medium transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Sign In
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
