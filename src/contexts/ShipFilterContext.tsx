import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'selected_ship_id';

interface ShipFilterContextType {
  selectedShipId: string | null; // null = all ships
  setSelectedShipId: (shipId: string | null) => void;
  isFilterEnabled: boolean; // true for admin/admin_master
}

const ShipFilterContext = createContext<ShipFilterContextType | undefined>(undefined);

export function ShipFilterProvider({ children }: { children: ReactNode }) {
  const { role, isPlatformOwner, user } = useAuth();

  // Initialize from localStorage if available
  const [selectedShipId, setSelectedShipIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || null;
  });

  // Admin, admin_master, and platform owners can use global ship filter
  const isFilterEnabled = role === 'admin' || role === 'admin_master' || isPlatformOwner;

  // Wrapped setter that also persists to localStorage
  const setSelectedShipId = useCallback((shipId: string | null) => {
    setSelectedShipIdState(shipId);
    if (shipId) {
      localStorage.setItem(STORAGE_KEY, shipId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Reset filter when role changes or user logs out
  useEffect(() => {
    if (!isFilterEnabled) {
      setSelectedShipIdState(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isFilterEnabled]);

  // Clear cache on logout
  useEffect(() => {
    if (!user) {
      localStorage.removeItem(STORAGE_KEY);
      setSelectedShipIdState(null);
    }
  }, [user]);

  return (
    <ShipFilterContext.Provider
      value={{
        selectedShipId,
        setSelectedShipId,
        isFilterEnabled,
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
