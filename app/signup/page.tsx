'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck, ArrowLeft, KeyRound, Check } from 'lucide-react';
import Link from 'next/link';

export default function SignupPage() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Client-side visual strength indicator (does not alter backend validation)
  const passwordLengthMet = password.length >= 8;
  const passwordHasNumber = /\d/.test(password);
  const passwordHasSpecial = /[^A-Za-z0-9]/.test(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName || !email || !password || !confirmPassword) {
      setErrorMsg('Please fill in all registration fields.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    const result = await signUp(fullName, email, password);
    setIsLoading(false);

    if (result.success) {
      if (result.message) {
        setSuccessMsg(result.message);
      } else {
        setSuccessMsg('Account created successfully. Logging in...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      }
    } else {
      setErrorMsg(result.error || 'Failed to create account.');
    }
  };

  return (
    <div className="min-h-screen w-screen bg-background flex items-center justify-center p-6 text-primary-text relative overflow-hidden">
      
      {/* Subtle background glow and grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#262640_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Floating brand header */}
      <div className="absolute top-6 left-6 flex items-center gap-2.5 z-20">
        <div className="p-1.5 bg-gradient-to-br from-brand-purple to-brand-indigo rounded-[8px] shadow-lg shadow-purple-900/20">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-tight text-white block">NEXUS</span>
          <span className="text-[9px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase font-semibold">Registration</span>
        </div>
      </div>

      {/* Form Card */}
      <div className="w-full max-w-md bg-surface border border-border rounded-[14px] p-8 shadow-2xl space-y-6 relative z-10 animate-scale-up">
        
        <div className="space-y-1.5">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-white transition-colors uppercase font-bold tracking-wider mb-2 group">
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back to login
          </Link>
          <div className="w-8 h-8 rounded-[8px] bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-2">
            <KeyRound className="w-4 h-4 text-purple-400" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Request Operator Access</h2>
          <p className="text-xs text-secondary">Register a new administrative credential profile on the NEXUS control plane.</p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2.5 rounded-[6px] flex items-start gap-2 animate-fade-in" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-2.5 rounded-[6px] flex items-start gap-2 animate-fade-in">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {!successMsg && (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="space-y-1 text-xs">
              <label className="text-muted font-bold uppercase tracking-wider block">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Rishi Gupta"
                disabled={isLoading}
                className="bg-background border border-border text-xs text-primary-text placeholder-muted rounded-[6px] px-3.5 py-2.5 w-full focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1 text-xs">
              <label className="text-muted font-bold uppercase tracking-wider block">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@nexus.security"
                disabled={isLoading}
                className="bg-background border border-border text-xs text-primary-text placeholder-muted rounded-[6px] px-3.5 py-2.5 w-full focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
                required
              />
            </div>

            <div className="space-y-1 text-xs">
              <label className="text-muted font-bold uppercase tracking-wider block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={isLoading}
                  className="bg-background border border-border text-xs text-primary-text placeholder-muted rounded-[6px] pl-3.5 pr-10 py-2.5 w-full focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password hints (presentation helper) */}
              {password.length > 0 && (
                <div className="pt-2 flex flex-wrap gap-2 text-[10px] text-muted">
                  <span className={`inline-flex items-center gap-1 ${passwordLengthMet ? 'text-emerald-400' : 'text-muted'}`}>
                    <Check className="w-3 h-3" /> 8+ chars
                  </span>
                  <span className={`inline-flex items-center gap-1 ${passwordHasNumber ? 'text-emerald-400' : 'text-muted'}`}>
                    <Check className="w-3 h-3" /> 1+ number
                  </span>
                  <span className={`inline-flex items-center gap-1 ${passwordHasSpecial ? 'text-emerald-400' : 'text-muted'}`}>
                    <Check className="w-3 h-3" /> 1+ symbol
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1 text-xs">
              <label className="text-muted font-bold uppercase tracking-wider block">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={isLoading}
                className="bg-background border border-border text-xs text-primary-text placeholder-muted rounded-[6px] px-3.5 py-2.5 w-full focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 text-white font-semibold text-xs py-2.5 rounded-[6px] transition-all disabled:opacity-50 flex items-center justify-center gap-2 h-10 mt-6 shadow-md shadow-purple-900/20 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting registration...</span>
                </>
              ) : (
                <span>Register Credentials</span>
              )}
            </button>

          </form>
        )}

      </div>

    </div>
  );
}
