import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserSignatureSettings {
  default_signature: string | null;
  auto_sign_inspections: boolean;
}

export function useUserSignature() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-signature', user?.id],
    queryFn: async (): Promise<UserSignatureSettings> => {
      if (!user?.id) {
        return { default_signature: null, auto_sign_inspections: false };
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('default_signature, auto_sign_inspections')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      
      return {
        default_signature: data?.default_signature || null,
        auto_sign_inspections: data?.auto_sign_inspections || false,
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
