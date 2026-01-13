import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { telemetry } from '@/utils/clientTelemetry';

const STORAGE_KEY = 'selected_ship_id';

type AppRole = 'admin' | 'admin_master' | 'technician' | 'supervisor' | 'viewer';

interface ShipFilterContextType {
  selectedShipId: string | null; // null = all ships
  setSelectedShipId: (shipId: string | null) => void;
  isFilterEnabled: boolean; // true for admin/admin_master/platform owner
  isReady: boolean; // true when auth is loaded and filter state is initialized
}

const ShipFilterContext = createContext<ShipFilterContextType | undefined>(undefined);

export function ShipFilterProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  const [initialized, setInitialized] = useState(false);
  const [selectedShipId, setSelectedShipIdState] = useState<string | null>(null);

  // Track session without depending on AuthContext (prevents context duplication issues)
  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setUserId(session?.user?.id ?? null);
      setAuthLoading(false);
    };

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!mounted) return;
      setUserId(session?.user?.id ?? null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load role/platform owner for permission checks
  useEffect(() => {
    let cancelled = false;

    const loadPermissions = async () => {
      if (!userId) {
        setRole(null);
        setIsPlatformOwner(false);
        setPermissionsLoading(false);
        return;
      }

      setPermissionsLoading(true);

      try {
        let timeoutId: number | undefined;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error('timeout')), 8000);
        });

        const [roleRes, ownerRes] = await Promise.race([
          Promise.all([
            supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
            supabase.from('platform_owners').select('id').eq('user_id', userId).maybeSingle(),
          ]),
          timeoutPromise.then(() => { throw new Error('timeout'); }),
        ]) as any;

        if (timeoutId) window.clearTimeout(timeoutId);

        if (cancelled) return;

        // Only update if no errors - otherwise keep previous values
        if (!roleRes.error) {
          setRole((roleRes.data?.role as AppRole) ?? null);
        }
        if (!ownerRes.error) {
          setIsPlatformOwner(!!ownerRes.data);
        }
      } catch (e) {
        // On any error, continue with current/default values
        if (!cancelled) telemetry.warn('ship_filter_permissions_error', { message: String(e) });
      } finally {
        // Always finish loading to unblock the UI
        if (!cancelled) setPermissionsLoading(false);
      }
    };

    loadPermissions();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Admin, admin_master, and platform owners can use global ship filter
  const isFilterEnabled = role === 'admin' || role === 'admin_master' || isPlatformOwner;

  // Initialize from localStorage only AFTER auth + permissions are loaded
  useEffect(() => {
    if (authLoading || permissionsLoading) return;

    if (!userId) {
      // User logged out - clear state
      setSelectedShipIdState(null);
      localStorage.removeItem(STORAGE_KEY);
      setInitialized(true);
      return;
    }

    if (isFilterEnabled) {
      // Restore from localStorage for authorized users
      const stored = localStorage.getItem(STORAGE_KEY);
      setSelectedShipIdState(stored || null);
    } else {
      // Non-admin users don't use ship filter
      setSelectedShipIdState(null);
      localStorage.removeItem(STORAGE_KEY);
    }

    setInitialized(true);
  }, [authLoading, permissionsLoading, userId, isFilterEnabled]);

  // Wrapped setter that also persists to localStorage
  const setSelectedShipId = useCallback((shipId: string | null) => {
    setSelectedShipIdState(shipId);
    if (shipId) {
      localStorage.setItem(STORAGE_KEY, shipId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Only consider ready when auth has loaded and we've initialized the state
  const isReady = useMemo(() => {
    return !authLoading && !permissionsLoading && initialized;
  }, [authLoading, permissionsLoading, initialized]);

  return (
    <ShipFilterContext.Provider
      value={{
        selectedShipId,
        setSelectedShipId,
        isFilterEnabled,
        isReady,
      }}
    >
      {children}
    </ShipFilterContext.Provider>
  );
}

export function useShipFilter() {
  const context = useContext(ShipFilterContext);
  if (context === undefined) {
    throw new Error('useShipFilter must be used within a ShipFilterProvider');
  }
  return context;
}
