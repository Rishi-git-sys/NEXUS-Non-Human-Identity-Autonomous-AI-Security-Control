'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Shield, Loader2, AlertCircle, ShieldCheck, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email) {
      setErrorMsg('Please enter your work email address.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('Recovery instructions dispatched. Please check your inbox.');
      }
    } catch {
      setErrorMsg('We couldn\'t connect to the authentication service. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-background flex items-center justify-center p-6 text-primary-text relative">
      
      {/* Subtle grid accent background */}
      <div className="absolute inset-0 bg-[radial-gradient(#1f1f30_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />

      {/* Floating brand header */}
      <div className="absolute top-6 left-6 flex items-center gap-2.5">
        <div className="p-1.5 bg-gradient-to-br from-brand-purple to-brand-indigo rounded-[6px]">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-sm tracking-tight text-white block">NEXUS</span>
      </div>

      {/* Form Card */}
      <div className="w-full max-w-md bg-surface border border-border rounded-[12px] p-8 shadow-2xl space-y-6 relative z-10 animate-scale-up">
        
        <div className="space-y-1.5">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-white transition-colors uppercase font-bold tracking-wider mb-2">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to login
          </Link>
          <h2 className="text-xl font-bold text-white tracking-tight">Recover Credentials</h2>
          <p className="text-xs text-secondary">Send verification link to reset security password.</p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2.5 rounded-[6px] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs px-3 py-2.5 rounded-[6px] flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {!successMsg && (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="space-y-1 text-xs">
              <label className="text-muted font-bold uppercase tracking-wider block">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@nexus.security"
                disabled={isLoading}
                className="bg-background border border-border text-xs text-primary-text placeholder-muted rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 text-white font-semibold text-xs py-2.5 rounded-[6px] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 h-10 mt-6 shadow-md shadow-purple-900/10 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending reset link...</span>
                </>
              ) : (
                <span>Send Reset Link</span>
              )}
            </button>

          </form>
        )}

      </div>

    </div>
  );
}
