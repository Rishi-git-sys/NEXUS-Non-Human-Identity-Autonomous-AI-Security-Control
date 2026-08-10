'use client';

import React from 'react';
import { Search, BarChart2, ShieldCheck, Zap } from 'lucide-react';
import { CapabilityCard } from './CapabilityCard';

const CAPABILITIES = [
  {
    number: '01',
    icon: Search,
    title: 'Discover',
    description:
      'Automatically discover and inventory non-human identities across cloud providers, CI/CD pipelines, SaaS integrations, and AI agent frameworks.',
  },
  {
    number: '02',
    icon: BarChart2,
    title: 'Understand',
    description:
      'Analyze ownership, privilege scope, inter-service relationships, and risk exposure. Map transitive access paths invisible to standard IAM tooling.',
  },
  {
    number: '03',
    icon: ShieldCheck,
    title: 'Govern',
    description:
      'Author and enforce zero-trust policies at runtime. Enforce least privilege, block anomalous actions, and maintain continuous audit records.',
  },
  {
    number: '04',
    icon: Zap,
    title: 'Respond',
    description:
      'Detect behavioral anomalies and respond to identity threats in real time. Rotate credentials, suspend agents, and trigger automated remediation.',
  },
];

export function CapabilitiesSection() {
  return (
    <section
      id="capabilities"
      className="w-full bg-[#080B10] landing-section-border"
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-20 md:py-28">

        {/* Header */}
        <div className="max-w-xl mb-12">
          <p className="text-[10px] text-[#5EEAD4] font-landing-mono tracking-[0.16em] uppercase font-semibold mb-4">
            02. Core Capabilities
          </p>
          <h2
            className="font-landing-display font-bold text-white uppercase leading-tight"
            style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.5rem)', letterSpacing: '-0.02em' }}
          >
            The Complete NHI Security Lifecycle
          </h2>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CAPABILITIES.map((cap) => (
            <CapabilityCard
              key={cap.number}
              number={cap.number}
              icon={cap.icon}
              title={cap.title}
              description={cap.description}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
