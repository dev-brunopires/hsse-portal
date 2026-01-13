import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, Session, AuthTokenResponsePassword } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getOrganizationUrl } from '@/utils/organizationUrl';
import { telemetry } from '@/utils/clientTelemetry';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  unit: string | null;
}

type AppRole = 'admin' | 'admin_master' | 'technician' | 'supervisor' | 'viewer';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; data: AuthTokenResponsePassword['data'] | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  forceRefreshSession: () => Promise<void>;
  isAdmin: boolean;
  isAdminMaster: boolean;
  isTechnician: boolean;
  canEdit: boolean;
  isPlatformOwner: boolean;
  sessionUnstable: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionUnstable, setSessionUnstable] = useState(false);
  const refreshFailuresRef = useRef(0);
  const { toast } = useToast();

  const withTimeout = async <T,>(promise: Promise<T>, ms = 20000): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        const id = window.setTimeout(() => reject(new Error('timeout')), ms);
        // Prevent TS unused warning in some builds
        void id;
      }),
    ]);
  };

  const fetchUserData = async (userId: string, retryCount = 0) => {
    try {
      // Fetch profile, role, and platform owner status in parallel with longer timeout
      const [profileResult, roleResult, platformOwnerResult] = await withTimeout(
        Promise.all([
          supabase.from('profiles').select('*').eq('user_id', userId).single(),
          supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
          supabase.from('platform_owners').select('id').eq('user_id', userId).maybeSingle(),
        ]),
        25000 // 25 seconds for slow connections
      );

      // If any request errored (network/auth), don't wipe previously loaded state.
      if (profileResult.error && profileResult.error.code !== 'PGRST116') throw profileResult.error;
      if (roleResult.error) throw roleResult.error;
      if (platformOwnerResult.error) throw platformOwnerResult.error;

      if (profileResult.data) {
        setProfile(profileResult.data);
      }

      if (roleResult.data?.role) {
        setRole(roleResult.data.role as AppRole);
      } else {
        // Only clear role when the request succeeded but no role exists.
        setRole(null);
      }

      setIsPlatformOwner(!!platformOwnerResult.data);
      telemetry.debug('fetch_user_data_success', { userId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown';
      telemetry.error('fetch_user_data_error', { userId, error: errorMessage, retryCount });
      
      // Retry once on timeout
      if (errorMessage === 'timeout' && retryCount < 1) {
        console.warn('Retrying user data fetch after timeout...');
        setTimeout(() => fetchUserData(userId, retryCount + 1), 1000);
        return;
      }
      
      // Keep last known profile/role to avoid UI falling into a permanent "Carregando..." state
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;

        telemetry.debug('auth_state_change', { event });

        // Reset consecutive refresh failures on successful auth events
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          refreshFailuresRef.current = 0;
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Defer backend calls with setTimeout to prevent deadlock
          setTimeout(() => {
            if (mounted) {
              fetchUserData(currentSession.user.id);
            }
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
        }

        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (!mounted) return;
      
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        // Don't block loading on user data fetch - it may timeout
        fetchUserData(currentSession.user.id).catch(() => {});
      }
      
      // Always finish loading regardless of user data fetch result
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Refresh session/profile when the tab returns (common mobile case) or when connection comes back.
  // Also run a lightweight watchdog every ~50s to detect "stuck" auth (common symptom: UI loads but queries stop).
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const redirectToAuth = () => {
      const search = window.location.search || '';
      window.location.href = `/auth${search}`;
    };

    const refreshNow = async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (cancelled) return;

        if (error) {
          refreshFailuresRef.current += 1;
          setSessionUnstable(true);
          telemetry.warn('auth_refresh_failed', { message: error.message, failures: refreshFailuresRef.current });

          // If we fail twice in a row, consider the session dead and force re-login.
          if (refreshFailuresRef.current >= 2) {
            redirectToAuth();
          }
          return;
        }

        refreshFailuresRef.current = 0;
        setSessionUnstable(false);

        if (data.session?.user?.id) {
          await fetchUserData(data.session.user.id);
        }
      } catch (e) {
        if (cancelled) return;
        refreshFailuresRef.current += 1;
        setSessionUnstable(true);
        telemetry.warn('auth_refresh_exception', { message: String(e), failures: refreshFailuresRef.current });
        if (refreshFailuresRef.current >= 2) {
          redirectToAuth();
        }
      }
    };

    const onFocus = () => {
      void refreshNow();
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        void refreshNow();
      }
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const interval = window.setInterval(() => {
      // Only check when online to avoid false positives.
      if (navigator.onLine) {
        void refreshNow();
      }
    }, 50000);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(interval);
    };
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: 'Erro ao fazer login',
          description: error.message === 'Invalid login credentials' 
            ? 'Email ou senha incorretos' 
            : error.message,
          variant: 'destructive',
        });
        return { error, data: null };
      }

      toast({
        title: 'Login realizado',
        description: 'Bem-vindo ao sistema!',
      });

      return { error: null, data };
    } catch (error) {
      return { error: error as Error, data: null };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        let message = error.message;
        if (error.message.includes('already registered')) {
          message = 'Este email já está cadastrado';
        }
        
        toast({
          title: 'Erro ao criar conta',
          description: message,
          variant: 'destructive',
        });
        return { error };
      }

      toast({
        title: 'Conta criada com sucesso',
        description: 'Você já pode acessar o sistema!',
      });

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    // Get user's organization subdomain before signing out
    let orgSubdomain: string | null = null;
    
    if (profile) {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('user_id', user?.id)
          .single();
        
        if (profileData?.organization_id) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('subdomain')
            .eq('id', profileData.organization_id)
            .single();
          
          orgSubdomain = orgData?.subdomain || null;
        }
      } catch (error) {
        console.error('Error fetching org subdomain for redirect:', error);
      }
    }

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setIsPlatformOwner(false);
    
    toast({
      title: 'Logout realizado',
      description: 'Até logo!',
    });

    // Redirect to organization's login page
    if (orgSubdomain) {
      const orgUrl = getOrganizationUrl(orgSubdomain, '/auth');
      window.location.href = orgUrl;
    } else {
      window.location.href = '/auth';
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  const forceRefreshSession = async () => {
    setSessionUnstable(false);
    refreshFailuresRef.current = 0;
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        setSessionUnstable(true);
        telemetry.warn('force_refresh_failed', { message: error.message });
        return;
      }
      if (data.session?.user?.id) {
        await fetchUserData(data.session.user.id);
      }
    } catch (e) {
      setSessionUnstable(true);
      telemetry.error('force_refresh_exception', { message: String(e) });
    }
  };

  const isAdminMaster = role === 'admin_master' || isPlatformOwner;
  const isAdmin = role === 'admin' || role === 'admin_master' || isPlatformOwner;
  const isTechnician = role === 'technician';
  const isSupervisor = role === 'supervisor';
  const canEdit = isAdmin || isTechnician || isSupervisor;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        forceRefreshSession,
        isAdmin,
        isAdminMaster,
        isTechnician,
        canEdit,
        isPlatformOwner,
        sessionUnstable,
      }}
    >
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
