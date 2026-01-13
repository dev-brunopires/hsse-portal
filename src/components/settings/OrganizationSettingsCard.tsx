import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Upload, Loader2, ImageIcon, Image } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUpdateOrganization } from '@/hooks/useOrganizations';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getOrganizationUrl } from '@/utils/organizationUrl';

export function OrganizationSettingsCard() {
  const { t } = useTranslation();
  const { organization } = useOrganization();
  const updateOrganization = useUpdateOrganization();
  const { toast } = useToast();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLogoWhite, setUploadingLogoWhite] = useState(false);
  const [uploadingLoginBg, setUploadingLoginBg] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoWhiteInputRef = useRef<HTMLInputElement>(null);
  const loginBgInputRef = useRef<HTMLInputElement>(null);

  if (!organization) {
    return null;
  }

  const uploadLogo = async (file: File, type: 'logo' | 'logo_white' | 'login_background') => {
    const setUploading = type === 'logo' 
      ? setUploadingLogo 
      : type === 'logo_white' 
        ? setUploadingLogoWhite 
        : setUploadingLoginBg;
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${organization.id}/${type}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('organization-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('organization-logos')
        .getPublicUrl(fileName);

      const updateData = type === 'logo'
        ? { id: organization.id, logo_url: urlData.publicUrl }
        : type === 'logo_white'
          ? { id: organization.id, logo_white_url: urlData.publicUrl }
          : { id: organization.id, login_background_url: urlData.publicUrl };

      await updateOrganization.mutateAsync(updateData);

      toast({
        title: t('settings.logoUpdated'),
        description: type === 'login_background' 
          ? t('settings.loginBackgroundUpdatedDesc')
          : t('settings.logoUpdatedDesc'),
      });
    } catch (error: any) {
      toast({
        title: t('settings.logoUpdateError'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'logo_white' | 'login_background') => {
    const file = e.target.files?.[0];
    if (file) {
      uploadLogo(file, type);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          {t('settings.organization')}
        </CardTitle>
        <CardDescription>{t('settings.organizationDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <p className="font-medium">{organization.name}</p>
            <p className="text-sm text-muted-foreground">{getOrganizationUrl(organization.subdomain)}</p>
          </div>
        </div>

        {/* Logo Upload */}
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">{t('settings.coloredLogo')}</Label>
            <p className="text-xs text-muted-foreground mb-2">{t('settings.coloredLogoDesc')}</p>
            <div className="flex items-center gap-4">
              <div className="h-16 w-32 rounded-lg border border-dashed border-border flex items-center justify-center bg-background">
                {organization.logo_url ? (
                  <img src={organization.logo_url} alt="Logo" className="h-12 w-auto object-contain" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoChange(e, 'logo')}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {t('settings.uploadLogo')}
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">{t('settings.whiteLogo')}</Label>
            <p className="text-xs text-muted-foreground mb-2">{t('settings.whiteLogoDesc')}</p>
            <div className="flex items-center gap-4">
              <div className="h-16 w-32 rounded-lg border border-dashed border-border flex items-center justify-center bg-sidebar">
                {organization.logo_white_url ? (
                  <img src={organization.logo_white_url} alt="Logo White" className="h-12 w-auto object-contain" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                )}
              </div>
              <input
                ref={logoWhiteInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoChange(e, 'logo_white')}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => logoWhiteInputRef.current?.click()}
                disabled={uploadingLogoWhite}
              >
                {uploadingLogoWhite ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {t('settings.uploadLogo')}
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">{t('settings.loginBackground')}</Label>
            <p className="text-xs text-muted-foreground mb-2">{t('settings.loginBackgroundDesc')}</p>
            <div className="flex items-center gap-4">
              <div className="h-20 w-36 rounded-lg border border-dashed border-border flex items-center justify-center bg-muted overflow-hidden">
                {organization.login_background_url ? (
                  <img src={organization.login_background_url} alt="Login Background" className="h-full w-full object-cover" />
                ) : (
                  <Image className="h-8 w-8 text-muted-foreground/50" />
                )}
              </div>
              <input
                ref={loginBgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoChange(e, 'login_background')}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => loginBgInputRef.current?.click()}
                disabled={uploadingLoginBg}
              >
                {uploadingLoginBg ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {t('settings.uploadBackground')}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
