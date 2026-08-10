'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SecurityPostureCard } from './SecurityPostureCard';

function useNodeCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    type Node = { x: number; y: number; vx: number; vy: number; r: number };
    const nodes: Node[] = Array.from({ length: 28 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      r: Math.random() * 1.1 + 0.6,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        n1.x += n1.vx;
        n1.y += n1.vy;
        if (n1.x < 0 || n1.x > width) n1.vx *= -1;
        if (n1.y < 0 || n1.y > height) n1.vy *= -1;

        ctx.fillStyle = 'rgba(94, 234, 212, 0.18)';
        ctx.beginPath();
        ctx.arc(n1.x, n1.y, n1.r, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
          if (dist < 110) {
            const alpha = (1 - dist / 110) * 0.05;
            ctx.strokeStyle = `rgba(94, 234, 212, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mq.matches) {
      draw();
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [canvasRef]);
}

interface HeroSectionProps {
  onExplore: () => void;
}

export function HeroSection({ onExplore }: HeroSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useNodeCanvas(canvasRef);

  return (
    <section
      id="hero"
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#06070A] pt-14"
    >
      {/* Node canvas background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* Subtle grid */}
      <div className="absolute inset-0 landing-grid-bg pointer-events-none z-0" />

      {/* Radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(6,7,10,0.8) 100%)',
        }}
      />

      <div className="relative z-10 max-w-7xl w-full mx-auto px-5 md:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center py-16 md:py-24">

        {/* ── Left: Copy ── */}
        <div className="lg:col-span-7 space-y-7">

          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-2 bg-[#0F1115] border border-[#1C2027] px-3.5 py-1.5 rounded animate-text-stagger"
            style={{ animationDelay: '100ms' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#5EEAD4] animate-pulse" />
            <span className="text-[10px] text-[#5EEAD4] font-landing-mono tracking-[0.16em] uppercase font-semibold">
              Non-Human Identity Security — 2026
            </span>
          </div>

          {/* Headline */}
          <div
            className="animate-text-stagger"
            style={{ animationDelay: '250ms' }}
          >
            <h1 className="font-landing-display font-bold text-white uppercase leading-[0.92] tracking-[-0.025em]"
              style={{ fontSize: 'clamp(2.6rem, 6vw, 5rem)' }}
            >
              Control Every
            </h1>
            <h1
              className="font-landing-display font-bold uppercase leading-[0.92] tracking-[-0.025em]"
              style={{
                fontSize: 'clamp(2.6rem, 6vw, 5rem)',
                color: '#5EEAD4',
              }}
            >
              Autonomous Identity.
            </h1>
          </div>

          {/* Supporting text */}
          <p
            className="text-[#8B93A1] leading-relaxed max-w-lg animate-text-stagger"
            style={{ fontSize: '1.05rem', animationDelay: '400ms' }}
          >
            NEXUS discovers, governs, monitors, and secures machine identities and
            autonomous AI agents across your enterprise infrastructure.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-wrap gap-3 animate-text-stagger"
            style={{ animationDelay: '550ms' }}
          >
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-[#5EEAD4] text-[#06070A] font-semibold text-sm px-6 py-3 rounded hover:bg-white transition-colors cursor-pointer focus:outline-none"
            >
              Enter Control Center
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={onExplore}
              className="inline-flex items-center gap-2 bg-transparent border border-[#1C2027] text-[#E7E9EE] font-semibold text-sm px-6 py-3 rounded hover:border-[#5EEAD4]/40 hover:text-white transition-colors cursor-pointer focus:outline-none"
            >
              Explore Platform
            </button>
          </div>

          {/* Trust signal */}
          <div
            className="flex items-center gap-2 animate-text-stagger"
            style={{ animationDelay: '650ms' }}
          >
            <div className="flex -space-x-1">
              {['#5EEAD4', '#5BD48F', '#F2A623'].map((c, i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full border border-[#06070A]"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <span className="text-[11px] text-[#8B93A1] font-landing-mono tracking-wide">
              Trusted across enterprise security teams
            </span>
          </div>
        </div>

        {/* ── Right: Security Posture Card ── */}
        <div
          className="lg:col-span-5 w-full max-w-sm mx-auto lg:mx-0 lg:ml-auto animate-text-stagger"
          style={{ animationDelay: '700ms' }}
        >
          <SecurityPostureCard />
        </div>

      </div>
    </section>
  );
}
