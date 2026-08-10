'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Helper to fetch user profile directly from public.profiles in Supabase
  const fetchProfile = useCallback(async (userId: string, email: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, organization_id')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile from Supabase:', error.message);
        return null;
      }

      if (data) {
        return {
          id: data.id,
          email,
          full_name: data.full_name,
          avatar_url: data.avatar_url,
          role: data.role,
          organization_id: data.organization_id,
        };
      } else {
        // Profile record not found (e.g. newly registered user before trigger/insert)
        // Attempt a default profile insert if allowed by database/RLS
        const { data: inserted, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            full_name: email.split('@')[0],
          })
          .select('id, full_name, avatar_url, role, organization_id')
          .single();

        if (!insertError && inserted) {
          return {
            id: inserted.id,
            email,
            full_name: inserted.full_name,
            avatar_url: inserted.avatar_url,
            role: inserted.role,
            organization_id: inserted.organization_id,
          };
        }
        if (insertError) {
          console.error('Error creating profile record:', insertError.message);
        }
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
    return null;
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

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user?.id) return;

    const profileUpdates: Partial<Database['public']['Tables']['profiles']['Update']> = {};
    if (updates.full_name !== undefined) profileUpdates.full_name = updates.full_name;
    if (updates.avatar_url !== undefined) profileUpdates.avatar_url = updates.avatar_url;

    if (Object.keys(profileUpdates).length > 0) {
      const { data, error } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user.id)
        .select('id, full_name, avatar_url, role, organization_id')
        .single();

      if (error) {
        console.error('Error updating profile in Supabase:', error.message);
        throw error;
      }

      if (data) {
        setUser({
          ...user,
          full_name: data.full_name,
          avatar_url: data.avatar_url,
          role: data.role,
          organization_id: data.organization_id,
          email: updates.email || user.email,
        });
        return;
      }
    }

    if (updates.email && updates.email !== user.email) {
      setUser({
        ...user,
        ...updates,
      });
    }
  };

  useEffect(() => {
    let mounted = true;

    // Retrieve active session initially
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!mounted) return;

      if (error) {
        console.error('Error getting Supabase session:', error.message);
      }

      if (session?.user) {
        const profile = await fetchProfile(session.user.id, session.user.email || '');
        if (mounted) {
          if (profile) {
            setUser(profile);
            setIsAuthenticated(true);
          } else {
            console.error('Valid Supabase session exists but profile could not be loaded for user:', session.user.id);
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

    // Listen to changes in auth state (login, signout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (session?.user) {
        const profile = await fetchProfile(session.user.id, session.user.email || '');
        if (mounted) {
          if (profile) {
            setUser(profile);
            setIsAuthenticated(true);
          } else {
            console.error('Auth state change: Session exists but profile could not be loaded.');
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
      // Authenticated users are redirected away from login / signup / forgot-password to dashboard
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
      console.error('Login error:', err);
      return { success: false, error: 'auth-error' };
    }
  };

  const signUp = async (fullName: string, email: string, password: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName,
          }
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
      console.error('Logout error:', e);
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
