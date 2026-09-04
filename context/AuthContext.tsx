'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  organization_id: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (fullName: string, email: string, password: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * In-flight deduplication map — prevents redundant concurrent fetchProfile
 * executions for the same userId (e.g., simultaneous getSession + onAuthStateChange).
 */
const inFlightProfileFetches = new Map<string, Promise<UserProfile | null>>();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Fetches the current user's profile via the NEXUS server API (/api/profile).
   * This eliminates all direct browser-to-Supabase application-table access.
   *
   * The supabase browser client is ONLY used for:
   *   - supabase.auth.getSession()
   *   - supabase.auth.onAuthStateChange()
   *   - supabase.auth.signInWithPassword()
   *   - supabase.auth.signUp()
   *   - supabase.auth.signOut()
   */
  const fetchProfile = useCallback(async (userId: string, email: string): Promise<UserProfile | null> => {
    // Single-flight deduplication: reuse in-flight request for the same userId
    const existingFlight = inFlightProfileFetches.get(userId);
    if (existingFlight) return existingFlight;

    const task = (async (): Promise<UserProfile | null> => {
      try {
        // Validate the session token exists before calling the API
        const { data: sessionData } = await supabase.auth.getSession();
        const currentSession = sessionData.session;

        if (!currentSession?.user || !currentSession.access_token) {
          console.warn('[NEXUS AUTH] Aborting profile fetch: no active session.');
          return null;
        }

        // All application-data access through the NEXUS server API
        const res = await fetch('/api/profile');

        if (res.status === 401) {
          console.warn('[NEXUS AUTH] /api/profile returned 401 — session not yet propagated.');
          return null;
        }

        if (res.status === 403) {
          console.warn('[NEXUS AUTH] /api/profile returned 403 — user has no organization.');
          // Return a minimal profile so the user stays authenticated
          return {
            id: userId,
            email,
            full_name: currentSession.user.user_metadata?.full_name as string ?? null,
            avatar_url: currentSession.user.user_metadata?.avatar_url as string ?? null,
            role: 'viewer',
            organization_id: null,
          };
        }

        if (!res.ok) {
          console.error('[NEXUS AUTH] /api/profile error:', res.status);
          return null;
        }

        const json = await res.json();
        if (!json.success || !json.data) {
          console.error('[NEXUS AUTH] /api/profile returned unexpected shape:', json);
          return null;
        }

        return {
          id: json.data.id,
          email: json.data.email || email,
          full_name: json.data.full_name ?? null,
          avatar_url: json.data.avatar_url ?? null,
          role: json.data.role ?? 'viewer',
          organization_id: json.data.organization_id ?? null,
        };
      } catch (err) {
        console.error('[NEXUS AUTH] Failed to load profile via API:', err);
        return null;
      }
    })();

    inFlightProfileFetches.set(userId, task);
    try {
      return await task;
    } finally {
      inFlightProfileFetches.delete(userId);
    }
  }, []);

  const refreshProfile = async () => {
    if (!user?.id) return;
    const profile = await fetchProfile(user.id, user.email);
    if (profile) {
      setUser(profile);
      setIsAuthenticated(true);
    } else {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  /**
   * Updates mutable profile fields (full_name, avatar_url) via NEXUS server API.
   * No direct supabase.from('profiles') access in the browser.
   */
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user?.id) return;

    const patchBody: Record<string, unknown> = {};
    if (updates.full_name !== undefined) patchBody.full_name = updates.full_name;
    if (updates.avatar_url !== undefined) patchBody.avatar_url = updates.avatar_url;

    if (Object.keys(patchBody).length > 0) {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to update profile.');
      }

      const json = await res.json();
      if (json.success && json.data) {
        setUser({
          ...user,
          full_name: json.data.full_name ?? user.full_name,
          avatar_url: json.data.avatar_url ?? user.avatar_url,
          role: json.data.role ?? user.role,
          organization_id: json.data.organization_id ?? user.organization_id,
          email: updates.email || user.email,
        });
        return;
      }
    }

    // Email-only updates (no server profile change needed for display)
    if (updates.email && updates.email !== user.email) {
      setUser({ ...user, ...updates });
    }
  };

  useEffect(() => {
    let mounted = true;

    // Retrieve the active Supabase session on mount
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!mounted) return;

      if (error) {
        console.error('[NEXUS AUTH] Error getting session:', error.message);
      }

      if (session?.user) {
        const profile = await fetchProfile(session.user.id, session.user.email || '');
        if (mounted) {
          if (profile) {
            setUser(profile);
            setIsAuthenticated(true);
          } else {
            console.error('[NEXUS AUTH] Session exists but profile could not be loaded for user:', session.user.id);
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } else {
        // No session — check for in-flight OAuth code before clearing state
        const hasAuthParam = typeof window !== 'undefined' &&
          (window.location.search.includes('code=') || window.location.hash.includes('access_token='));
        if (mounted && !hasAuthParam) {
          setUser(null);
          setIsAuthenticated(false);
        }
      }

      if (mounted) {
        const hasAuthParam = typeof window !== 'undefined' &&
          (window.location.search.includes('code=') || window.location.hash.includes('access_token='));
        if (!hasAuthParam) {
          setIsLoading(false);
        }
      }
    });

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (session?.user) {
        const profile = await fetchProfile(session.user.id, session.user.email || '');
        if (mounted) {
          if (profile) {
            setUser(profile);
            setIsAuthenticated(true);
          } else {
            console.error('[NEXUS AUTH] Auth state change: session exists but profile could not be loaded.');
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } else {
        if (mounted) {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
      if (mounted) {
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Route protection logic
  useEffect(() => {
    if (isLoading) return;

    const publicRoutes = ['/', '/login', '/signup', '/forgot-password', '/update-password'];
    const isPublicRoute = publicRoutes.includes(pathname);

    if (!isAuthenticated) {
      if (!isPublicRoute) {
        router.push('/login');
      }
    } else {
      if (pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password') {
        router.push('/dashboard');
      } else if (pathname === '/command-center') {
        router.push('/dashboard');
      }
    }
  }, [isAuthenticated, pathname, isLoading, router]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { success: false, error: 'incorrect-password' };
        }
        if (error.message.includes('Email not confirmed')) {
          return { success: false, error: 'email-not-confirmed' };
        }
        return { success: false, error: error.message || 'auth-error' };
      }

      if (data.session && data.user) {
        const profile = await fetchProfile(data.user.id, data.user.email || email.trim());
        if (profile) {
          setUser(profile);
          setIsAuthenticated(true);
          return { success: true };
        } else {
          return { success: false, error: 'profile-load-failed' };
        }
      }

      return { success: false, error: 'auth-error' };
    } catch (err) {
      console.error('[NEXUS AUTH] Login error:', err);
      return { success: false, error: 'auth-error' };
    }
  };

  const signUp = async (fullName: string, email: string, password: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user && !data.session) {
        return {
          success: true,
          message: 'Check your email to verify your NEXUS account.'
        };
      }

      if (data.session && data.user) {
        const profile = await fetchProfile(data.user.id, data.user.email || email.trim());
        if (profile) {
          setUser(profile);
          setIsAuthenticated(true);
          return { success: true };
        }
      }

      return { success: false, error: 'Registration completed but profile initialization failed.' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration error.';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[NEXUS AUTH] Logout error:', e);
    } finally {
      setIsAuthenticated(false);
      setUser(null);
      router.push('/');
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, signUp, logout, refreshProfile, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
