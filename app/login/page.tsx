'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Shield, Eye, EyeOff, Loader2, AlertCircle, ArrowDown, HelpCircle, Key, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorState, setErrorState] = useState<'none' | 'invalid-email' | 'incorrect-password' | 'email-not-confirmed' | 'auth-error' | 'network-error' | 'required'>('none');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorState('none');

    if (!email || !password) {
      setErrorState('required');
      return;
    }

    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 800);
    } else {
      const err = result.error;
      if (err === 'invalid-email') {
        setErrorState('invalid-email');
      } else if (err === 'incorrect-password') {
        setErrorState('incorrect-password');
      } else if (err === 'email-not-confirmed') {
        setErrorState('email-not-confirmed');
      } else if (err === 'network-error') {
        setErrorState('network-error');
      } else {
        setErrorState('auth-error');
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      if (error) {
        showToast(`Google Auth configuration required: ${error.message}`, 'error');
      }
    } catch {
      setErrorState('network-error');
    } finally {
      setIsLoading(false);
    }
  };

  const getErrorMessage = () => {
    switch (errorState) {
      case 'invalid-email':
        return 'Please enter a valid work email address.';
      case 'incorrect-password':
        return 'Email or password is incorrect.';
      case 'email-not-confirmed':
        return 'Please verify your email before signing in.';
      case 'network-error':
        return 'We couldn\'t connect to the authentication service. Please try again.';
      case 'auth-error':
        return 'Authentication failed. Please verify credentials.';
      case 'required':
        return 'Please fill in all authentication fields.';
      default:
        return '';
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-primary-text">
      
      {/* Left Panel: Product Identity */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-background to-[#10101A] border-r border-border flex-col justify-between p-12 relative overflow-hidden">
        
        {/* Subtle grid accent background */}
        <div className="absolute inset-0 bg-[radial-gradient(#1f1f30_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        {/* Brand header */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="p-2 bg-gradient-to-br from-brand-purple to-brand-indigo rounded-[8px]">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-none">NEXUS</h1>
            <span className="text-[10px] text-purple-400 font-mono tracking-widest uppercase font-semibold">Security Engine</span>
          </div>
        </div>

        {/* Brand visual statement & flowchart */}
        <div className="relative z-10 my-auto max-w-md space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-white tracking-tight leading-tight">
              Secure every identity.<br />
              Govern every autonomous action.
            </h2>
            <p className="text-xs text-secondary leading-relaxed">
              An enterprise governance control plane mapping non-human credentials, API scopes, and autonomous LLM agent execution behaviors.
            </p>
          </div>

          {/* Flow sequence visualization */}
          <div className="pt-4 space-y-2">
            {[
              { label: 'IDENTITY', desc: 'Workloads & API Credentials' },
              { label: 'AI AGENT', desc: 'Autonomous Execution Contexts' },
              { label: 'ACCESS', desc: 'Dynamic Cloud Resource Boundaries' },
              { label: 'POLICY', desc: 'Allowed / Blocked Boundaries' },
              { label: 'TRUST', desc: 'Immutable Ledger Audit Trail' }
            ].map((step, idx, arr) => (
              <React.Fragment key={step.label}>
                <div className="flex items-center gap-4 bg-surface/40 border border-border/60 rounded-[8px] p-2.5 max-w-sm">
                  <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-950/40 border border-purple-900/40 px-2 py-0.5 rounded-[4px]">
                    0{idx + 1}
                  </span>
                  <div>
                    <h4 className="text-[11px] font-bold text-white tracking-wider uppercase leading-none">{step.label}</h4>
                    <span className="text-[9px] text-muted">{step.desc}</span>
                  </div>
                </div>
                {idx < arr.length - 1 && (
                  <div className="pl-6 py-0.5">
                    <ArrowDown className="w-3.5 h-3.5 text-border" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-[10px] text-muted flex justify-between items-center">
          <span>&copy; 2026 NEXUS Control Plane Inc.</span>
          <span className="flex items-center gap-1.5 cursor-help hover:text-white transition-colors">
            <HelpCircle className="w-3 h-3" />
            Support Center
          </span>
        </div>
      </div>

      {/* Right Panel: Authentication Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-bg-mid">
        
        {/* Auth form card */}
        <div className="w-full max-w-md bg-surface border border-border rounded-[12px] p-8 shadow-2xl flex flex-col justify-between min-h-[460px] animate-scale-up">
          
          <div className="space-y-6">
            
            {/* Header titles */}
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-white tracking-tight">Welcome back</h2>
              <p className="text-xs text-secondary">Sign in to your NEXUS control plane.</p>
            </div>

            {/* Error notifications */}
            {errorState !== 'none' && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2.5 rounded-[6px] flex items-start gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{getErrorMessage()}</span>
              </div>
            )}

            {/* Success check indicator */}
            {success && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs px-3 py-2.5 rounded-[6px] flex items-center gap-2 animate-fade-in">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Authentication successful. Securing access credentials...</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="space-y-1 text-xs">
                <label className="text-muted font-bold uppercase tracking-wider block">Work Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@nexus.security"
                  disabled={isLoading || success}
                  className="bg-background border border-border text-xs text-primary-text placeholder-muted rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40 disabled:opacity-50"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <label className="text-muted font-bold uppercase tracking-wider block">Password</label>
                  <Link href="/forgot-password" className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    disabled={isLoading || success}
                    className="bg-background border border-border text-xs text-primary-text placeholder-muted rounded-[6px] pl-3 pr-10 py-2 w-full focus:outline-none focus:border-purple-500/40 disabled:opacity-50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading || success}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || success}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 text-white font-semibold text-xs py-2.5 rounded-[6px] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 h-10 mt-6 shadow-md shadow-purple-900/10 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </>
                )}
              </button>

            </form>

            {/* SSO Separator */}
            <div className="relative flex py-2 items-center shrink-0">
              <div className="flex-grow border-t border-border" />
              <span className="flex-shrink mx-4 text-[10px] text-muted font-bold uppercase tracking-wider">OR</span>
              <div className="flex-grow border-t border-border" />
            </div>

            {/* SSO Signins */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading || success}
                className="bg-background hover:bg-bg-mid border border-border text-xs text-secondary hover:text-white font-semibold py-2 px-3 rounded-[6px] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>Google</span>
              </button>

              <button
                onClick={() => showToast('Okta Integration requires admin console setup.', 'info')}
                disabled={isLoading || success}
                className="bg-background hover:bg-bg-mid border border-border text-xs text-secondary hover:text-white font-semibold py-2 px-3 rounded-[6px] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>Corporate SSO</span>
              </button>
            </div>

          </div>

          {/* Bottom links */}
          <div className="text-center text-[11px] text-muted mt-8 pt-4 border-t border-border/60 shrink-0">
            Don&apos;t have access?{' '}
            <Link href="/signup" className="text-purple-400 hover:text-purple-300 font-semibold cursor-pointer">
              Request access
            </Link>
          </div>

        </div>

      </div>

    </div>
  );
}
