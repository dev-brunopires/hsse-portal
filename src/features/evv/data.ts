import { supabase } from '@/integrations/supabase/client';
import type { EvvLocation, EvvVessel } from './types';

// Fallback seed if DB has not yet been provisioned.
const FALLBACK_LOCATIONS: EvvLocation[] = [
  { id: 'loc-guyana', name: 'Guyana' },
  { id: 'loc-angola', name: 'Angola' },
  { id: 'loc-brazil', name: 'Brazil' },
];

const FALLBACK_VESSELS: EvvVessel[] = [
  { id: 'v-unity', location_id: 'loc-guyana', name: 'FPSO Unity' },
  { id: 'v-destiny', location_id: 'loc-guyana', name: 'FPSO Destiny' },
  { id: 'v-prosperity', location_id: 'loc-guyana', name: 'FPSO Prosperity' },
  { id: 'v-anchieta', location_id: 'loc-brazil', name: 'FPSO Cidade de Anchieta' },
];

export async function fetchLocations(): Promise<EvvLocation[]> {
  const { data, error } = await supabase
    .from('evv_locations' as any)
    .select('id, name')
    .order('name');
  if (error || !data || data.length === 0) return FALLBACK_LOCATIONS;
  return data as unknown as EvvLocation[];
}

export async function fetchVessels(locationId?: string): Promise<EvvVessel[]> {
  let q = supabase.from('evv_vessels' as any).select('id, location_id, name').order('name');
  if (locationId) q = q.eq('location_id', locationId);
  const { data, error } = await q;
  if (error || !data) {
    return locationId ? FALLBACK_VESSELS.filter((v) => v.location_id === locationId) : FALLBACK_VESSELS;
  }
  return data as unknown as EvvVessel[];
}
