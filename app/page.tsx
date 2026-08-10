'use client';

import React from 'react';

// Landing page components
import { LandingNavbar }       from '@/components/landing/LandingNavbar';
import { HeroSection }         from '@/components/landing/HeroSection';
import { TelemetryStrip }      from '@/components/landing/TelemetryStrip';
import { PlatformOverview }    from '@/components/landing/PlatformOverview';
import { CapabilitiesSection } from '@/components/landing/CapabilitiesSection';
import { AccessGraph }         from '@/components/landing/AccessGraph';
import { AIAgentSecurity }     from '@/components/landing/AIAgentSecurity';
import { DashboardPreview }    from '@/components/landing/DashboardPreview';
import { FinalCTA }            from '@/components/landing/FinalCTA';
import { LandingFooter }       from '@/components/landing/LandingFooter';

/**
 * NEXUS Landing Page
 *
 * This is the public marketing / landing page.
 * All authenticated routes (/dashboard, /identities, etc.) are separate.
 * RootLayoutWrapper excludes '/' from the app shell automatically.
 */
export default function LandingPage() {
  const handleExplore = () => {
    const el = document.getElementById('telemetry');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="signal-room min-h-screen w-full bg-[#06070A] text-[#E7E9EE] overflow-x-hidden">

      {/* Fixed navigation */}
      <LandingNavbar />

      {/* Main content — scrolls normally (not snap-scroll) for better UX */}
      <main>

        {/* 1. Hero — headline, CTAs, SecurityPostureCard, node canvas */}
        <HeroSection onExplore={handleExplore} />

        {/* 2. Telemetry strip — key metrics, all using <Metric /> */}
        <TelemetryStrip />

        {/* 3. Platform overview — the NHI problem + identity layer diagram */}
        <PlatformOverview />

        {/* 4. Core capabilities — Discover, Understand, Govern, Respond */}
        <CapabilitiesSection />

        {/* 5. Access graph — SVG topology visualization */}
        <AccessGraph />

        {/* 6. AI Agent security — NEXUS's key differentiator */}
        <AIAgentSecurity />

        {/* 7. Dashboard preview — real security posture UI preview */}
        <DashboardPreview />

        {/* 8. Final CTA */}
        <FinalCTA />

      </main>

      {/* Footer */}
      <LandingFooter />

    </div>
  );
}
