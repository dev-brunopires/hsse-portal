import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'selected_ship_id';

interface ShipFilterContextType {
  selectedShipId: string | null; // null = all ships
  setSelectedShipId: (shipId: string | null) => void;
  isFilterEnabled: boolean; // true for admin/admin_master/platform owner
  isReady: boolean; // true when auth is loaded and filter state is initialized
}

const ShipFilterContext = createContext<ShipFilterContextType | undefined>(undefined);

export function ShipFilterProvider({ children }: { children: ReactNode }) {
  const { user, role, isPlatformOwner, loading: authLoading, profileLoading } = useAuth();
  const [initialized, setInitialized] = useState(false);
  const [selectedShipId, setSelectedShipIdState] = useState<string | null>(null);

  // Admin, admin_master, and platform owners can use global ship filter
  const isFilterEnabled = role === 'admin' || role === 'admin_master' || isPlatformOwner;

  // Initialize from localStorage only AFTER auth + profile are loaded
  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!user) {
      setSelectedShipIdState(null);
      localStorage.removeItem(STORAGE_KEY);
      setInitialized(true);
      return;
    }

    if (isFilterEnabled) {
      const stored = localStorage.getItem(STORAGE_KEY);
      setSelectedShipIdState(stored || null);
    } else {
      setSelectedShipIdState(null);
      localStorage.removeItem(STORAGE_KEY);
    }

    setInitialized(true);
  }, [authLoading, profileLoading, user?.id, isFilterEnabled]);

  const setSelectedShipId = useCallback((shipId: string | null) => {
    setSelectedShipIdState(shipId);
    if (shipId) {
      localStorage.setItem(STORAGE_KEY, shipId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const isReady = useMemo(() => {
    return !authLoading && !profileLoading && initialized;
  }, [authLoading, profileLoading, initialized]);

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
