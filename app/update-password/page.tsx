'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

export default function UpdatePasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!password || !confirmPassword) {
      setErrorMsg('Please fill in all credential fields.');
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
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('Password updated successfully. Access credentials secured.');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
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
          <h2 className="text-xl font-bold text-white tracking-tight">Set New Password</h2>
          <p className="text-xs text-secondary">Establish new credentials for your administrative profile.</p>
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
              <label className="text-muted font-bold uppercase tracking-wider block">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={isLoading}
                  className="bg-background border border-border text-xs text-primary-text placeholder-muted rounded-[6px] pl-3 pr-10 py-2 w-full focus:outline-none focus:border-purple-500/40"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <label className="text-muted font-bold uppercase tracking-wider block">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={isLoading}
                className="bg-background border border-border text-xs text-primary-text placeholder-muted rounded-[6px] px-3 py-2 w-full focus:outline-none focus:border-purple-500/40"
                required
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
                  <span>Updating password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>

          </form>
        )}

      </div>

    </div>
  );
}
