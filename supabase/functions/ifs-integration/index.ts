import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IFSConfig {
  baseUrl: string;
  username: string;
  companyId: string;
}

interface IFSEquipment {
  OBJECT_ID: string;
  OBJECT_DESC: string;
  OBJECT_TYPE: string;
  SERIAL_NO: string;
  MANUFACTURER?: string;
  MODEL?: string;
  ACQUISITION_DATE?: string;
  LOCATION: string;
  STATUS: string;
  NEXT_INSPECTION_DATE?: string;
  CERTIFICATE_EXPIRY?: string;
  COMPANY_ID: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ifsApiKey = Deno.env.get('IFS_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, config, organizationId } = await req.json();
    
    // Validate organization_id for data operations
    if (!organizationId && (action === 'import-equipment' || action === 'export-equipment')) {
      return new Response(
        JSON.stringify({ success: false, message: 'Organização não especificada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'test-connection': {
        // Test IFS API connection
        if (!config.baseUrl) {
          return new Response(
            JSON.stringify({ success: false, message: 'URL do servidor não informada' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          // In production, make actual IFS API call here
          // For now, simulate connection test
          const isValidUrl = config.baseUrl.startsWith('http');
          
          if (!isValidUrl) {
            return new Response(
              JSON.stringify({ success: false, message: 'URL inválida' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Simulate IFS API health check
          // const response = await fetch(`${config.baseUrl}/health`, {
          //   headers: { 'Authorization': `Bearer ${ifsApiKey}` }
          // });

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Conexão com IFS configurada. Aguardando credenciais válidas para ativar.' 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Erro desconhecido';
          return new Response(
            JSON.stringify({ success: false, message: `Erro: ${message}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'import-equipment': {
        // Import equipment from IFS
        if (!ifsApiKey) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: 'API Key do IFS não configurada',
              errors: ['Configure a variável IFS_API_KEY nas secrets do projeto']
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          // In production: fetch from IFS API
          // const ifsResponse = await fetch(`${config.baseUrl}/equipment`, {
          //   headers: { 
          //     'Authorization': `Bearer ${ifsApiKey}`,
          //     'X-Company-ID': config.companyId
          //   }
          // });
          // const ifsData: IFSEquipment[] = await ifsResponse.json();

          // Simulated IFS data for demonstration
          const ifsData: IFSEquipment[] = [];

          // First, get a default category and ship for the organization
          const { data: defaultCategory } = await supabase
            .from('categories')
            .select('id')
            .eq('organization_id', organizationId)
            .limit(1)
            .single();

          const { data: defaultShip } = await supabase
            .from('ships')
            .select('id')
            .eq('organization_id', organizationId)
            .limit(1)
            .single();

          if (!defaultCategory || !defaultShip) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                message: 'Configuração incompleta: cadastre ao menos uma categoria e embarcação antes de importar.',
                errors: ['Categoria ou embarcação não encontrada para a organização']
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Transform and upsert to SafeShip with organization context
          const transformedData = ifsData.map(item => ({
            internal_code: item.OBJECT_ID,
            name: item.OBJECT_DESC,
            type: item.OBJECT_TYPE,
            serial_number: item.SERIAL_NO,
            manufacturer: item.MANUFACTURER || null,
            model: item.MODEL || null,
            acquisition_date: item.ACQUISITION_DATE || null,
            location: item.LOCATION,
            status: mapIFSStatus(item.STATUS),
            next_inspection: item.NEXT_INSPECTION_DATE || null,
            certificate_expiry: item.CERTIFICATE_EXPIRY || null,
            category_id: defaultCategory.id,
            ship_id: defaultShip.id,
            unit: 'Importado IFS',
          }));

          let equipmentCount = 0;
          const errors: string[] = [];

          for (const eq of transformedData) {
            const { error } = await supabase
              .from('equipment')
              .upsert(eq, { onConflict: 'internal_code' });
            
            if (error) {
              errors.push(`Erro ao importar ${eq.internal_code}: ${error.message}`);
            } else {
              equipmentCount++;
            }
          }

          return new Response(
            JSON.stringify({ 
              success: errors.length === 0,
              equipmentCount,
              inspectionCount: 0,
              errors,
              message: `Importação concluída: ${equipmentCount} equipamentos`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Erro desconhecido';
          return new Response(
            JSON.stringify({ 
              success: false, 
              errors: [message],
              equipmentCount: 0,
              inspectionCount: 0
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'export-equipment': {
        // Export equipment to IFS
        if (!ifsApiKey) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: 'API Key do IFS não configurada',
              errors: ['Configure a variável IFS_API_KEY nas secrets do projeto']
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          // Fetch SafeShip equipment filtered by organization (through ships)
          const { data: orgShips } = await supabase
            .from('ships')
            .select('id')
            .eq('organization_id', organizationId);
          
          const shipIds = orgShips?.map(s => s.id) || [];
          
          const { data: equipment, error } = await supabase
            .from('equipment')
            .select('*')
            .in('ship_id', shipIds);

          if (error) throw error;

          // Transform to IFS format
          const ifsFormat = equipment?.map(eq => ({
            OBJECT_ID: eq.internal_code,
            OBJECT_DESC: eq.name,
            OBJECT_TYPE: eq.type,
            SERIAL_NO: eq.serial_number,
            MANUFACTURER: eq.manufacturer || '',
            MODEL: eq.model || '',
            ACQUISITION_DATE: eq.acquisition_date,
            LOCATION: eq.location,
            STATUS: mapToIFSStatus(eq.status),
            NEXT_INSPECTION_DATE: eq.next_inspection,
            CERTIFICATE_EXPIRY: eq.certificate_expiry,
            COMPANY_ID: config.companyId,
          })) || [];

          // In production: send to IFS API
          // await fetch(`${config.baseUrl}/equipment/batch`, {
          //   method: 'POST',
          //   headers: { 
          //     'Authorization': `Bearer ${ifsApiKey}`,
          //     'Content-Type': 'application/json'
          //   },
          //   body: JSON.stringify(ifsFormat)
          // });

          return new Response(
            JSON.stringify({ 
              success: true,
              equipmentCount: ifsFormat.length,
              inspectionCount: 0,
              errors: [],
              message: `Exportação preparada: ${ifsFormat.length} equipamentos prontos para envio ao IFS`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Erro desconhecido';
          return new Response(
            JSON.stringify({ 
              success: false, 
              errors: [message],
              equipmentCount: 0,
              inspectionCount: 0
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Ação não reconhecida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('IFS Integration error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function mapIFSStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'ACTIVE': 'valid',
    'WARNING': 'expiring',
    'EXPIRED': 'expired',
    'MAINTENANCE': 'maintenance',
    'INACTIVE': 'expired',
  };
  return statusMap[status] || 'valid';
}

function mapToIFSStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'valid': 'ACTIVE',
    'expiring': 'WARNING',
    'expired': 'EXPIRED',
    'maintenance': 'MAINTENANCE',
  };
  return statusMap[status] || 'ACTIVE';
}
