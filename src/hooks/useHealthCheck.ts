import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type HealthStatus = 'ok' | 'warning' | 'error' | 'pending' | 'running';

export interface HealthCheckResult {
  component: string;
  name: string;
  status: HealthStatus;
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface HealthCheckCategory {
  id: string;
  name: string;
  icon: string;
  results: HealthCheckResult[];
  overallStatus: HealthStatus;
  totalLatency: number;
}

interface UseHealthCheckReturn {
  categories: HealthCheckCategory[];
  isRunning: boolean;
  progress: number;
  totalChecks: number;
  completedChecks: number;
  runAllChecks: () => Promise<void>;
  runCategoryCheck: (categoryId: string) => Promise<void>;
  lastRunTime: number | null;
  history: { timestamp: number; status: HealthStatus; summary: string }[];
}

const STORAGE_KEY = 'health-check-history';
const MAX_HISTORY = 50;

export function useHealthCheck(): UseHealthCheckReturn {
  const [categories, setCategories] = useState<HealthCheckCategory[]>([
    { id: 'database', name: 'Database', icon: 'Database', results: [], overallStatus: 'pending', totalLatency: 0 },
    { id: 'edge-functions', name: 'Edge Functions', icon: 'Zap', results: [], overallStatus: 'pending', totalLatency: 0 },
    { id: 'storage', name: 'Storage', icon: 'HardDrive', results: [], overallStatus: 'pending', totalLatency: 0 },
    { id: 'auth', name: 'Authentication', icon: 'Shield', results: [], overallStatus: 'pending', totalLatency: 0 },
    { id: 'system', name: 'System', icon: 'Activity', results: [], overallStatus: 'pending', totalLatency: 0 },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completedChecks, setCompletedChecks] = useState(0);
  const [lastRunTime, setLastRunTime] = useState<number | null>(null);
  const [history, setHistory] = useState<{ timestamp: number; status: HealthStatus; summary: string }[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const totalChecks = 20; // Total number of individual checks

  const updateCategory = useCallback((categoryId: string, updates: Partial<HealthCheckCategory>) => {
    setCategories(prev => prev.map(cat => 
      cat.id === categoryId ? { ...cat, ...updates } : cat
    ));
  }, []);

  const addResult = useCallback((categoryId: string, result: HealthCheckResult) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id !== categoryId) return cat;
      const newResults = [...cat.results, result];
      const hasError = newResults.some(r => r.status === 'error');
      const hasWarning = newResults.some(r => r.status === 'warning');
      const allOk = newResults.every(r => r.status === 'ok');
      const totalLatency = newResults.reduce((sum, r) => sum + (r.latency || 0), 0);
      
      return {
        ...cat,
        results: newResults,
        overallStatus: hasError ? 'error' : hasWarning ? 'warning' : allOk ? 'ok' : 'pending',
        totalLatency,
      };
    }));
    setCompletedChecks(prev => prev + 1);
  }, []);

  const runDatabaseChecks = useCallback(async () => {
    updateCategory('database', { results: [], overallStatus: 'running' });
    
    // Check 1: Basic connection
    const start1 = performance.now();
    try {
      const { error } = await supabase.from('profiles').select('count').limit(1).single();
      const latency = Math.round(performance.now() - start1);
      addResult('database', {
        component: 'connection',
        name: 'Database Connection',
        status: error ? 'error' : latency > 500 ? 'warning' : 'ok',
        latency,
        message: error ? error.message : `Connected in ${latency}ms`,
        timestamp: Date.now(),
      });
    } catch (err) {
      addResult('database', {
        component: 'connection',
        name: 'Database Connection',
        status: 'error',
        message: err instanceof Error ? err.message : 'Connection failed',
        timestamp: Date.now(),
      });
    }

    // Check 2: Equipment table
    const start2 = performance.now();
    try {
      const { count, error } = await supabase.from('equipment').select('*', { count: 'exact', head: true });
      const latency = Math.round(performance.now() - start2);
      addResult('database', {
        component: 'equipment',
        name: 'Equipment Table',
        status: error ? 'error' : 'ok',
        latency,
        message: error ? error.message : `${count || 0} records`,
        details: { count },
        timestamp: Date.now(),
      });
    } catch (err) {
      addResult('database', {
        component: 'equipment',
        name: 'Equipment Table',
        status: 'error',
        message: err instanceof Error ? err.message : 'Query failed',
        timestamp: Date.now(),
      });
    }

    // Check 3: Inspections table
    const start3 = performance.now();
    try {
      const { count, error } = await supabase.from('inspections').select('*', { count: 'exact', head: true });
      const latency = Math.round(performance.now() - start3);
      addResult('database', {
        component: 'inspections',
        name: 'Inspections Table',
        status: error ? 'error' : 'ok',
        latency,
        message: error ? error.message : `${count || 0} records`,
        details: { count },
        timestamp: Date.now(),
      });
    } catch (err) {
      addResult('database', {
        component: 'inspections',
        name: 'Inspections Table',
        status: 'error',
        message: err instanceof Error ? err.message : 'Query failed',
        timestamp: Date.now(),
      });
    }

    // Check 4: Maintenance table
    const start4 = performance.now();
    try {
      const { count, error } = await supabase.from('maintenance_requests').select('*', { count: 'exact', head: true });
      const latency = Math.round(performance.now() - start4);
      addResult('database', {
        component: 'maintenance',
        name: 'Maintenance Table',
        status: error ? 'error' : 'ok',
        latency,
        message: error ? error.message : `${count || 0} records`,
        details: { count },
        timestamp: Date.now(),
      });
    } catch (err) {
      addResult('database', {
        component: 'maintenance',
        name: 'Maintenance Table',
        status: 'error',
        message: err instanceof Error ? err.message : 'Query failed',
        timestamp: Date.now(),
      });
    }
  }, [updateCategory, addResult]);

  const runEdgeFunctionChecks = useCallback(async () => {
    updateCategory('edge-functions', { results: [], overallStatus: 'running' });
    
    const functions = [
      { name: 'client-telemetry', displayName: 'Client Telemetry' },
      { name: 'check-inspection-deadlines', displayName: 'Inspection Deadlines' },
      { name: 'health-check', displayName: 'Health Check' },
    ];

    for (const fn of functions) {
      const start = performance.now();
      try {
        const { error } = await supabase.functions.invoke(fn.name, {
          body: { healthCheck: true },
        });
        const latency = Math.round(performance.now() - start);
        addResult('edge-functions', {
          component: fn.name,
          name: fn.displayName,
          status: error ? 'warning' : latency > 2000 ? 'warning' : 'ok',
          latency,
          message: error ? 'Function may be unavailable' : `Response in ${latency}ms`,
          timestamp: Date.now(),
        });
      } catch (err) {
        addResult('edge-functions', {
          component: fn.name,
          name: fn.displayName,
          status: 'warning',
          message: 'Could not verify function',
          timestamp: Date.now(),
        });
      }
    }
  }, [updateCategory, addResult]);

  const runStorageChecks = useCallback(async () => {
    updateCategory('storage', { results: [], overallStatus: 'running' });
    
    const buckets = [
      'equipment-documents',
      'inspection-photos',
      'maintenance-photos',
      'avatars',
      'organization-logos',
      'certificates',
    ];

    for (const bucket of buckets) {
      const start = performance.now();
      try {
        const { data, error } = await supabase.storage.from(bucket).list('', { limit: 1 });
        const latency = Math.round(performance.now() - start);
        addResult('storage', {
          component: bucket,
          name: bucket.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          status: error ? 'error' : 'ok',
          latency,
          message: error ? error.message : `Accessible (${latency}ms)`,
          timestamp: Date.now(),
        });
      } catch (err) {
        addResult('storage', {
          component: bucket,
          name: bucket.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          status: 'error',
          message: err instanceof Error ? err.message : 'Access failed',
          timestamp: Date.now(),
        });
      }
    }
  }, [updateCategory, addResult]);

  const runAuthChecks = useCallback(async () => {
    updateCategory('auth', { results: [], overallStatus: 'running' });
    
    // Check 1: Session status
    const start1 = performance.now();
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      const latency = Math.round(performance.now() - start1);
      
      if (error) {
        addResult('auth', {
          component: 'session',
          name: 'Session Status',
          status: 'error',
          latency,
          message: error.message,
          timestamp: Date.now(),
        });
      } else if (session) {
        const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
        const minutesLeft = expiresAt ? Math.round((expiresAt.getTime() - Date.now()) / 60000) : 0;
        addResult('auth', {
          component: 'session',
          name: 'Session Status',
          status: minutesLeft < 10 ? 'warning' : 'ok',
          latency,
          message: `Active, expires in ${minutesLeft} min`,
          details: { expiresAt: expiresAt?.toISOString(), minutesLeft },
          timestamp: Date.now(),
        });
      } else {
        addResult('auth', {
          component: 'session',
          name: 'Session Status',
          status: 'warning',
          latency,
          message: 'No active session',
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      addResult('auth', {
        component: 'session',
        name: 'Session Status',
        status: 'error',
        message: err instanceof Error ? err.message : 'Check failed',
        timestamp: Date.now(),
      });
    }

    // Check 2: Token refresh
    const start2 = performance.now();
    try {
      const { error } = await supabase.auth.refreshSession();
      const latency = Math.round(performance.now() - start2);
      addResult('auth', {
        component: 'refresh',
        name: 'Token Refresh',
        status: error ? 'warning' : 'ok',
        latency,
        message: error ? 'Refresh may fail' : `Refreshed in ${latency}ms`,
        timestamp: Date.now(),
      });
    } catch (err) {
      addResult('auth', {
        component: 'refresh',
        name: 'Token Refresh',
        status: 'warning',
        message: 'Refresh test skipped',
        timestamp: Date.now(),
      });
    }
  }, [updateCategory, addResult]);

  const runSystemChecks = useCallback(async () => {
    updateCategory('system', { results: [], overallStatus: 'running' });
    
    // Check 1: Network status
    addResult('system', {
      component: 'network',
      name: 'Network Status',
      status: navigator.onLine ? 'ok' : 'error',
      message: navigator.onLine ? 'Online' : 'Offline',
      timestamp: Date.now(),
    });

    // Check 2: IndexedDB
    try {
      const dbRequest = indexedDB.open('health-check-test', 1);
      await new Promise<void>((resolve, reject) => {
        dbRequest.onsuccess = () => {
          dbRequest.result.close();
          indexedDB.deleteDatabase('health-check-test');
          resolve();
        };
        dbRequest.onerror = () => reject(dbRequest.error);
      });
      addResult('system', {
        component: 'indexeddb',
        name: 'IndexedDB',
        status: 'ok',
        message: 'Available',
        timestamp: Date.now(),
      });
    } catch (err) {
      addResult('system', {
        component: 'indexeddb',
        name: 'IndexedDB',
        status: 'error',
        message: 'Not available',
        timestamp: Date.now(),
      });
    }

    // Check 3: Service Worker
    const swStatus = 'serviceWorker' in navigator;
    const swRegistration = swStatus ? await navigator.serviceWorker.getRegistration() : null;
    addResult('system', {
      component: 'serviceworker',
      name: 'Service Worker',
      status: swRegistration ? 'ok' : swStatus ? 'warning' : 'error',
      message: swRegistration ? 'Registered' : swStatus ? 'Not registered' : 'Not supported',
      timestamp: Date.now(),
    });

    // Check 4: Local Storage
    try {
      const testKey = '__health_check_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      
      // Estimate storage usage
      let totalSize = 0;
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length + key.length;
        }
      }
      const sizeKB = Math.round(totalSize / 1024);
      
      addResult('system', {
        component: 'localstorage',
        name: 'Local Storage',
        status: 'ok',
        message: `Available (${sizeKB} KB used)`,
        details: { sizeKB },
        timestamp: Date.now(),
      });
    } catch (err) {
      addResult('system', {
        component: 'localstorage',
        name: 'Local Storage',
        status: 'error',
        message: 'Not available or full',
        timestamp: Date.now(),
      });
    }

    // Check 5: Memory (if available)
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
      const totalMB = Math.round(memory.jsHeapSizeLimit / 1048576);
      const usagePercent = Math.round((usedMB / totalMB) * 100);
      
      addResult('system', {
        component: 'memory',
        name: 'Memory Usage',
        status: usagePercent > 80 ? 'warning' : 'ok',
        message: `${usedMB} MB / ${totalMB} MB (${usagePercent}%)`,
        details: { usedMB, totalMB, usagePercent },
        timestamp: Date.now(),
      });
    }
  }, [updateCategory, addResult]);

  const runAllChecks = useCallback(async () => {
    setIsRunning(true);
    setProgress(0);
    setCompletedChecks(0);
    
    // Reset all categories
    setCategories(prev => prev.map(cat => ({
      ...cat,
      results: [],
      overallStatus: 'pending',
      totalLatency: 0,
    })));

    try {
      // Run checks in sequence for better progress tracking
      await runDatabaseChecks();
      setProgress(20);
      
      await runEdgeFunctionChecks();
      setProgress(40);
      
      await runStorageChecks();
      setProgress(60);
      
      await runAuthChecks();
      setProgress(80);
      
      await runSystemChecks();
      setProgress(100);
    } catch (error) {
      console.error('Health check error:', error);
    } finally {
      setIsRunning(false);
      const now = Date.now();
      setLastRunTime(now);
      
      // Save to history
      setCategories(currentCategories => {
        const hasError = currentCategories.some(c => c.overallStatus === 'error');
        const hasWarning = currentCategories.some(c => c.overallStatus === 'warning');
        const overallStatus: HealthStatus = hasError ? 'error' : hasWarning ? 'warning' : 'ok';
        const okCount = currentCategories.filter(c => c.overallStatus === 'ok').length;
        const summary = `${okCount}/${currentCategories.length} categories OK`;
        
        const newHistory = [
          { timestamp: now, status: overallStatus, summary },
          ...history,
        ].slice(0, MAX_HISTORY);
        
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
        } catch {
          // Storage full, ignore
        }
        setHistory(newHistory);
        
        return currentCategories;
      });
    }
  }, [runDatabaseChecks, runEdgeFunctionChecks, runStorageChecks, runAuthChecks, runSystemChecks, history]);

  const runCategoryCheck = useCallback(async (categoryId: string) => {
    const checkMap: Record<string, () => Promise<void>> = {
      'database': runDatabaseChecks,
      'edge-functions': runEdgeFunctionChecks,
      'storage': runStorageChecks,
      'auth': runAuthChecks,
      'system': runSystemChecks,
    };
    
    const check = checkMap[categoryId];
    if (check) {
      await check();
    }
  }, [runDatabaseChecks, runEdgeFunctionChecks, runStorageChecks, runAuthChecks, runSystemChecks]);

  return {
    categories,
    isRunning,
    progress,
    totalChecks,
    completedChecks,
    runAllChecks,
    runCategoryCheck,
    lastRunTime,
    history,
  };
}
