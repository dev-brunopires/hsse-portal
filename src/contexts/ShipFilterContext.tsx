import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'selected_ship_id';

interface ShipFilterContextType {
  selectedShipId: string | null; // null = all ships
  setSelectedShipId: (shipId: string | null) => void;
  isFilterEnabled: boolean; // true for admin/admin_master
  isReady: boolean; // true when auth is loaded and filter state is initialized
}

const ShipFilterContext = createContext<ShipFilterContextType | undefined>(undefined);

export function ShipFilterProvider({ children }: { children: ReactNode }) {
  const { role, isPlatformOwner, user, loading: authLoading } = useAuth();
  const [initialized, setInitialized] = useState(false);
  const [selectedShipId, setSelectedShipIdState] = useState<string | null>(null);

  // Admin, admin_master, and platform owners can use global ship filter
  const isFilterEnabled = role === 'admin' || role === 'admin_master' || isPlatformOwner;

  // Initialize from localStorage only AFTER auth is loaded
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
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
  }, [authLoading, user, isFilterEnabled]);

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
    return !authLoading && initialized;
  }, [authLoading, initialized]);

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
