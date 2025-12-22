import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface IFSConfig {
  baseUrl: string;
  username: string;
  companyId: string;
  enabled: boolean;
  lastSync: string | null;
  syncInterval: 'manual' | 'hourly' | 'daily';
}

export interface IFSSyncResult {
  success: boolean;
  equipmentSynced: number;
  inspectionsSynced: number;
  errors: string[];
  timestamp: string;
}

const IFS_CONFIG_KEY = 'safeship-ifs-config';

export function useIFSIntegration() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { organization } = useOrganization();
  const [isLoading, setIsLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<IFSSyncResult | null>(null);

  const getConfig = useCallback((): IFSConfig | null => {
    try {
      const stored = localStorage.getItem(IFS_CONFIG_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const saveConfig = useCallback((config: IFSConfig) => {
    localStorage.setItem(IFS_CONFIG_KEY, JSON.stringify(config));
    toast({
      title: t('hooks.ifsIntegration.configSaved'),
      description: t('hooks.ifsIntegration.configSavedDescription'),
    });
  }, [toast, t]);

  const testConnection = useCallback(async (config: Partial<IFSConfig>): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Call edge function to test IFS connection
      const { data, error } = await supabase.functions.invoke('ifs-integration', {
        body: {
          action: 'test-connection',
          config: {
            baseUrl: config.baseUrl,
            username: config.username,
            companyId: config.companyId,
          },
        },
      });

      if (error) throw error;

      toast({
        title: data.success ? t('hooks.ifsIntegration.connectionSuccess') : t('hooks.ifsIntegration.connectionFailed'),
        description: data.message,
        variant: data.success ? 'default' : 'destructive',
      });

      return data.success;
    } catch (error) {
      console.error('IFS connection test failed:', error);
      toast({
        title: t('hooks.ifsIntegration.connectionTestError'),
        description: t('hooks.ifsIntegration.connectionTestErrorDescription'),
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast, t]);

  const syncEquipment = useCallback(async (direction: 'import' | 'export'): Promise<IFSSyncResult> => {
    setIsLoading(true);
    const config = getConfig();

    if (!config?.enabled) {
      toast({
        title: t('hooks.ifsIntegration.integrationDisabled'),
        description: t('hooks.ifsIntegration.enableBeforeSync'),
        variant: 'destructive',
      });
      return {
        success: false,
        equipmentSynced: 0,
        inspectionsSynced: 0,
        errors: [t('hooks.ifsIntegration.ifsNotEnabled')],
        timestamp: new Date().toISOString(),
      };
    }

    if (!organization?.id) {
      toast({
        title: t('hooks.ifsIntegration.organizationRequired'),
        description: t('hooks.ifsIntegration.organizationRequiredDescription'),
        variant: 'destructive',
      });
      return {
        success: false,
        equipmentSynced: 0,
        inspectionsSynced: 0,
        errors: ['Organização não encontrada'],
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('ifs-integration', {
        body: {
          action: direction === 'import' ? 'import-equipment' : 'export-equipment',
          config,
          organizationId: organization.id,
        },
      });

      if (error) throw error;

      const result: IFSSyncResult = {
        success: data.success,
        equipmentSynced: data.equipmentCount || 0,
        inspectionsSynced: data.inspectionCount || 0,
        errors: data.errors || [],
        timestamp: new Date().toISOString(),
      };

      setSyncResult(result);

      // Update last sync time
      const updatedConfig = { ...config, lastSync: result.timestamp };
      localStorage.setItem(IFS_CONFIG_KEY, JSON.stringify(updatedConfig));

      toast({
        title: result.success ? t('hooks.ifsIntegration.syncCompleted') : t('hooks.ifsIntegration.syncWithErrors'),
        description: t('hooks.ifsIntegration.syncStats', { equipment: result.equipmentSynced, inspections: result.inspectionsSynced }),
        variant: result.success ? 'default' : 'destructive',
      });

      return result;
    } catch (error) {
      console.error('IFS sync failed:', error);
      const result: IFSSyncResult = {
        success: false,
        equipmentSynced: 0,
        inspectionsSynced: 0,
        errors: [(error as Error).message],
        timestamp: new Date().toISOString(),
      };
      setSyncResult(result);
      
      toast({
        title: t('hooks.ifsIntegration.syncError'),
        description: t('hooks.ifsIntegration.syncErrorDescription'),
        variant: 'destructive',
      });

      return result;
    } finally {
      setIsLoading(false);
    }
  }, [getConfig, toast, t, organization]);

  const exportToIFSFormat = useCallback((equipment: any[]): object => {
    // Transform SafeShip equipment data to IFS format
    return equipment.map(eq => ({
      OBJECT_ID: eq.internal_code,
      OBJECT_DESC: eq.name,
      OBJECT_TYPE: eq.type,
      SERIAL_NO: eq.serial_number,
      MANUFACTURER: eq.manufacturer || '',
      MODEL: eq.model || '',
      ACQUISITION_DATE: eq.acquisition_date,
      LOCATION: eq.location,
      STATUS: mapStatusToIFS(eq.status),
      NEXT_INSPECTION_DATE: eq.next_inspection,
      CERTIFICATE_EXPIRY: eq.certificate_expiry,
      COMPANY_ID: getConfig()?.companyId || '',
      LAST_MODIFIED: eq.updated_at,
    }));
  }, [getConfig]);

  const importFromIFSFormat = useCallback((ifsData: any[]): object[] => {
    // Transform IFS data to SafeShip equipment format
    return ifsData.map(item => ({
      internal_code: item.OBJECT_ID,
      name: item.OBJECT_DESC,
      type: item.OBJECT_TYPE,
      serial_number: item.SERIAL_NO,
      manufacturer: item.MANUFACTURER,
      model: item.MODEL,
      acquisition_date: item.ACQUISITION_DATE,
      location: item.LOCATION,
      status: mapStatusFromIFS(item.STATUS),
      next_inspection: item.NEXT_INSPECTION_DATE,
      certificate_expiry: item.CERTIFICATE_EXPIRY,
    }));
  }, []);

  return {
    isLoading,
    syncResult,
    getConfig,
    saveConfig,
    testConnection,
    syncEquipment,
    exportToIFSFormat,
    importFromIFSFormat,
  };
}

function mapStatusToIFS(status: string): string {
  const statusMap: Record<string, string> = {
    'valid': 'ACTIVE',
    'expiring': 'WARNING',
    'expired': 'EXPIRED',
    'maintenance': 'MAINTENANCE',
  };
  return statusMap[status] || 'ACTIVE';
}

function mapStatusFromIFS(status: string): string {
  const statusMap: Record<string, string> = {
    'ACTIVE': 'valid',
    'WARNING': 'expiring',
    'EXPIRED': 'expired',
    'MAINTENANCE': 'maintenance',
    'INACTIVE': 'expired',
  };
  return statusMap[status] || 'valid';
}
