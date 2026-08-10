'use client';

import React from 'react';
import { Bot, Wrench, Globe, Database, CheckCircle, XCircle, Eye, ShieldCheck } from 'lucide-react';

const FLOW_STEPS = [
  { label: 'AI Agent', icon: Bot, color: '#5EEAD4' },
  { label: 'Tools', icon: Wrench, color: '#8B93A1' },
  { label: 'APIs', icon: Globe, color: '#8B93A1' },
  { label: 'Data', icon: Database, color: '#8B93A1' },
];

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: 'Agent Identity',
    description: 'Every autonomous agent is issued a verifiable identity and registered in the NEXUS control plane.',
    color: '#5EEAD4',
  },
  {
    icon: CheckCircle,
    title: 'Tool Access Control',
    description: 'Tool calls are intercepted and evaluated against policy before execution.',
    color: '#5BD48F',
  },
  {
    icon: XCircle,
    title: 'Privilege Boundaries',
    description: 'Hard permission limits prevent privilege escalation through tool chaining.',
    color: '#F2A623',
  },
  {
    icon: Eye,
    title: 'Behavior Monitoring',
    description: 'Continuous observation of agent actions, tool usage, and data access patterns.',
    color: '#5EEAD4',
  },
];

const DECISION_EXAMPLES = [
  { action: 'DevOps-Agent → DELETE production_db', decision: 'BLOCKED', color: '#FF6B6B', bg: 'rgba(255,107,107,0.07)', border: 'rgba(255,107,107,0.2)' },
  { action: 'Finance-Agent → READ s3://ledger', decision: 'ALLOWED', color: '#5BD48F', bg: 'rgba(91,212,143,0.07)', border: 'rgba(91,212,143,0.2)' },
  { action: 'Research-Agent → WRITE secrets vault', decision: 'REVIEW', color: '#F2A623', bg: 'rgba(242,166,35,0.07)', border: 'rgba(242,166,35,0.2)' },
];

export function AIAgentSecurity() {
  return (
    <section id="ai-security" className="w-full bg-[#080B10] landing-section-border">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-20 md:py-28">

        {/* Header */}
        <div className="mb-14 md:mb-20">
          <p className="text-[10px] text-[#5EEAD4] font-landing-mono tracking-[0.16em] uppercase font-semibold mb-4">
            04. Autonomous AI Security
          </p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <h2
              className="font-landing-display font-bold text-white uppercase leading-tight max-w-xl"
              style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.5rem)', letterSpacing: '-0.02em' }}
            >
              Secure Autonomous AI from Identity to Action
            </h2>
            <p className="text-[#8B93A1] text-sm leading-relaxed max-w-md md:text-right">
              LLM agents operate tools, query data, and call APIs with minimal human
              oversight. NEXUS enforces identity-first control at every step.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

          {/* ── Left: Flow + decisions ── */}
          <div className="space-y-6">

            {/* Agent flow */}
            <div className="bg-[#0F1115] border border-[#1C2027] rounded-lg p-6">
              <p className="text-[9px] text-[#8B93A1] font-landing-mono uppercase tracking-wider mb-5">
                Agent Execution Flow
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {FLOW_STEPS.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <React.Fragment key={step.label}>
                      <div className="flex flex-col items-center gap-1.5">
                        <div
                          className="w-10 h-10 rounded-lg border flex items-center justify-center"
                          style={{
                            background: step.color + '12',
                            borderColor: step.color + '40',
                          }}
                        >
                          <Icon className="w-4 h-4" style={{ color: step.color }} />
                        </div>
                        <span
                          className="text-[9px] font-landing-mono"
                          style={{ color: step.color }}
                        >
                          {step.label}
                        </span>
                      </div>
                      {i < FLOW_STEPS.length - 1 && (
                        <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className="shrink-0 mb-4">
                          <line x1="0" y1="5" x2="10" y2="5" stroke="#1C2027" strokeWidth="1.5" />
                          <polyline points="7,2 11,5 7,8" stroke="#1C2027" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
                        </svg>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Decision examples */}
            <div className="space-y-2">
              <p className="text-[9px] text-[#8B93A1] font-landing-mono uppercase tracking-wider mb-3">
                Policy Decision Examples
              </p>
              {DECISION_EXAMPLES.map((ex) => (
                <div
                  key={ex.action}
                  className="flex items-center justify-between px-4 py-3 rounded border"
                  style={{ background: ex.bg, borderColor: ex.border }}
                >
                  <span className="text-[11px] text-[#E7E9EE] font-landing-mono flex-1 min-w-0 truncate">
                    {ex.action}
                  </span>
                  <span
                    className="text-[9px] font-bold font-landing-mono tracking-[0.1em] uppercase ml-3 shrink-0"
                    style={{ color: ex.color }}
                  >
                    {ex.decision}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Highlights ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
            {HIGHLIGHTS.map((h) => {
              const Icon = h.icon;
              return (
                <div
                  key={h.title}
                  className="bg-[#0F1115] border border-[#1C2027] rounded-lg p-5 hover:border-[#5EEAD4]/25 transition-colors"
                >
                  <div
                    className="p-2 rounded w-fit mb-3"
                    style={{ background: h.color + '15' }}
                  >
                    <Icon className="w-4 h-4" style={{ color: h.color }} />
                  </div>
                  <h3 className="text-sm font-semibold text-white font-landing-display mb-2">
                    {h.title}
                  </h3>
                  <p className="text-[11px] text-[#8B93A1] leading-relaxed">
                    {h.description}
                  </p>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
}
