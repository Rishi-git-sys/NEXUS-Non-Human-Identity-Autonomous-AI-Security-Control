'use client';

import React, { useRef, useEffect, useState } from 'react';

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: 'agent' | 'resource' | 'blocked';
}

interface GraphEdge {
  from: string;
  to: string;
  status: 'allowed' | 'blocked' | 'monitored';
}

const NODES: GraphNode[] = [
  { id: 'agent',   label: 'AI Agent',        x: 50,  y: 50,  type: 'agent' },
  { id: 'api',     label: 'API',             x: 82,  y: 22,  type: 'resource' },
  { id: 'db',      label: 'Database',        x: 82,  y: 50,  type: 'blocked' },
  { id: 'cloud',   label: 'Cloud Role',      x: 82,  y: 78,  type: 'resource' },
  { id: 'svc',     label: 'Service Account', x: 18,  y: 78,  type: 'resource' },
];

const EDGES: GraphEdge[] = [
  { from: 'agent', to: 'api',   status: 'allowed' },
  { from: 'agent', to: 'db',    status: 'blocked' },
  { from: 'agent', to: 'cloud', status: 'monitored' },
  { from: 'svc',   to: 'agent', status: 'monitored' },
];

const nodeColor: Record<string, string> = {
  agent:    '#5EEAD4',
  resource: '#1C2027',
  blocked:  '#FF6B6B',
};

const edgeColor: Record<string, string> = {
  allowed:   'rgba(94,234,212,0.35)',
  blocked:   'rgba(255,107,107,0.55)',
  monitored: 'rgba(242,166,35,0.35)',
};

function toPercent(v: number) { return `${v}%`; }

function useIntersect() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

const LEGEND = [
  { color: edgeColor.allowed,   label: 'Allowed' },
  { color: edgeColor.blocked,   label: 'Blocked' },
  { color: edgeColor.monitored, label: 'Monitored' },
];

export function AccessGraph() {
  const { ref, visible } = useIntersect();

  return (
    <section id="access-graph" className="w-full bg-[#06070A] landing-section-border">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-20 md:py-28">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* ── Left: Copy ── */}
          <div className="space-y-6 order-2 lg:order-1">
            <p className="text-[10px] text-[#5EEAD4] font-landing-mono tracking-[0.16em] uppercase font-semibold">
              03. Access Graph
            </p>
            <h2
              className="font-landing-display font-bold text-white uppercase leading-tight"
              style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.5rem)', letterSpacing: '-0.02em' }}
            >
              Identity Access Topology
            </h2>
            <p className="text-[#8B93A1] text-sm leading-relaxed max-w-md">
              NEXUS constructs a live topology of every identity, tool connection, and
              resource relationship. Spot privilege paths, break access loops, and
              quarantine compromised nodes instantly.
            </p>

            <div className="space-y-2">
              {LEGEND.map((l) => (
                <div key={l.label} className="flex items-center gap-2.5">
                  <span
                    className="w-8 border-t-2"
                    style={{ borderColor: l.color }}
                  />
                  <span className="text-[11px] text-[#8B93A1] font-landing-mono">
                    {l.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: SVG Graph ── */}
          <div
            ref={ref}
            className="order-1 lg:order-2 relative w-full aspect-square max-w-sm mx-auto lg:mx-0 bg-[#0F1115] border border-[#1C2027] rounded-lg overflow-hidden"
          >
            <div className="absolute inset-0 landing-grid-bg pointer-events-none opacity-60" />

            {/* SVG Edges */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {EDGES.map((edge) => {
                const from = NODES.find((n) => n.id === edge.from)!;
                const to   = NODES.find((n) => n.id === edge.to)!;
                return (
                  <line
                    key={`${edge.from}-${edge.to}`}
                    x1={from.x} y1={from.y}
                    x2={to.x}   y2={to.y}
                    stroke={edgeColor[edge.status]}
                    strokeWidth="0.8"
                    strokeDasharray={edge.status === 'blocked' ? '2,1.5' : undefined}
                    className={visible ? 'animate-line-draw' : 'opacity-0'}
                  />
                );
              })}
            </svg>

            {/* Nodes */}
            {NODES.map((node) => (
              <div
                key={node.id}
                className={`absolute flex flex-col items-center gap-1 transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
                style={{
                  left: toPercent(node.x),
                  top: toPercent(node.y),
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                    node.type === 'agent' ? 'animate-node-pulse' : ''
                  }`}
                  style={{
                    background: nodeColor[node.type] + '18',
                    borderColor: nodeColor[node.type],
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: nodeColor[node.type] }}
                  />
                </div>
                <span
                  className="text-[7px] font-landing-mono text-center whitespace-nowrap font-medium"
                  style={{
                    color: node.type === 'blocked' ? '#FF6B6B' : '#8B93A1',
                  }}
                >
                  {node.label}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
