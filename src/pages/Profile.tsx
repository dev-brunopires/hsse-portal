import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Briefcase, 
  PenTool,
  Bell,
  Shield,
  Camera,
  Save,
  Loader2,
  CheckCircle2,
  Settings,
  Key,
  Palette,
  Sun,
  Moon,
  Monitor,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/hooks/useTheme';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SignaturePad } from '@/components/inspections/SignaturePad';
import { AvatarCropDialog } from '@/components/profile/AvatarCropDialog';

const createProfileSchema = (t: (key: string) => string) => z.object({
  full_name: z.string().min(2, t('profilePage.validation.nameMin')),
  email: z.string().email(t('profilePage.validation.emailInvalid')),
  phone: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
});

type ProfileFormData = z.infer<ReturnType<typeof createProfileSchema>>;

interface ProfileData {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  position: string | null;
  department: string | null;
  avatar_url: string | null;
  default_signature: string | null;
  auto_sign_inspections: boolean;
  notification_email: boolean;
  notification_app: boolean;
}

export default function Profile() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [autoSign, setAutoSign] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState(true);
  const [notificationApp, setNotificationApp] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  const profileSchema = createProfileSchema(t);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      position: '',
      department: '',
    },
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfileData(data as ProfileData);
        form.reset({
          full_name: data.full_name || '',
          email: data.email || '',
          phone: data.phone || '',
          position: data.position || '',
          department: data.department || '',
        });
        setSignatureData(data.default_signature);
        setAutoSign(data.auto_sign_inspections || false);
        setNotificationEmail(data.notification_email !== false);
        setNotificationApp(data.notification_app !== false);
        if (data.avatar_url) {
          setAvatarPreview(data.avatar_url);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: 'Erro ao carregar perfil',
        description: 'Não foi possível carregar seus dados.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Open crop dialog with the selected image
      const imageUrl = URL.createObjectURL(file);
      setImageToCrop(imageUrl);
      setCropDialogOpen(true);
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    // Convert blob to file
    const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });
    setAvatarFile(croppedFile);
    setAvatarPreview(URL.createObjectURL(croppedBlob));
    
    // Clean up the original image URL
    if (imageToCrop) {
      URL.revokeObjectURL(imageToCrop);
      setImageToCrop(null);
    }
    
    toast({
      title: 'Foto recortada',
      description: 'Clique em "Salvar Alterações" para confirmar.',
    });
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user || !profileData) return;
    
    setSaving(true);
    try {
      let avatarUrl = profileData.avatar_url;

      // Upload avatar if changed
      if (avatarFile) {
        const fileName = `${user.id}/${Date.now()}-avatar.${avatarFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          avatarUrl = urlData.publicUrl;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone || null,
          position: data.position || null,
          department: data.department || null,
          avatar_url: avatarUrl,
          default_signature: signatureData,
          auto_sign_inspections: autoSign,
          notification_email: notificationEmail,
          notification_app: notificationApp,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Refresh the profile in AuthContext so navbar updates
      await refreshProfile();

      toast({
        title: 'Perfil Atualizado',
        description: 'Suas informações foram salvas com sucesso.',
      });

      fetchProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar suas alterações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignatureSave = (data: string) => {
    setSignatureData(data);
    toast({
      title: 'Assinatura Capturada',
      description: 'Clique em "Salvar Alterações" para confirmar.',
    });
  };

  const handleClearSignature = () => {
    setSignatureData(null);
    toast({
      title: 'Assinatura Removida',
      description: 'A assinatura padrão foi removida.',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
          <p className="text-muted-foreground">
            Gerencie suas informações pessoais e preferências
          </p>
        </div>
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="personal" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Pessoal</span>
          </TabsTrigger>
          <TabsTrigger value="signature" className="flex items-center gap-2">
            <PenTool className="h-4 w-4" />
            <span className="hidden sm:inline">Assinatura</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Aparência</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notificações</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Segurança</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Informações Pessoais */}
        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Informações Pessoais
              </CardTitle>
              <CardDescription>
                Atualize seus dados de identificação e contato
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Avatar Section */}
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <Avatar className="h-24 w-24 border-4 border-primary/20">
                        <AvatarImage src={avatarPreview || undefined} />
                        <AvatarFallback className="text-xl bg-primary/10 text-primary">
                          {getInitials(form.watch('full_name') || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <label
                        htmlFor="avatar-upload"
                        className="absolute -bottom-2 -right-2 p-2 rounded-full bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
                      >
                        <Camera className="h-4 w-4" />
                        <input
                          type="file"
                          id="avatar-upload"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarChange}
                        />
                      </label>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{form.watch('full_name')}</h3>
                      <p className="text-sm text-muted-foreground">{form.watch('email')}</p>
                      {profileData?.position && (
                        <p className="text-sm text-muted-foreground mt-1">{profileData.position}</p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Nome Completo
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Seu nome completo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email
                          </FormLabel>
                          <FormControl>
                            <Input {...field} disabled />
                          </FormControl>
                          <FormDescription>
                            O email não pode ser alterado
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Telefone
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="(00) 00000-0000" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4" />
                            Cargo
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Técnico de Segurança" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            Departamento
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Segurança do Trabalho" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving} className="gap-2">
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Salvar Alterações
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Assinatura */}
        <TabsContent value="signature">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PenTool className="h-5 w-5 text-primary" />
                  Assinatura Digital Padrão
                </CardTitle>
                <CardDescription>
                  Configure sua assinatura padrão para inspeções. Esta assinatura será usada automaticamente quando a opção estiver habilitada.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {signatureData ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg border-2 border-status-success bg-status-success/10">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-5 w-5 text-status-success" />
                        <span className="font-medium text-status-success">Assinatura Configurada</span>
                      </div>
                      <div className="bg-white rounded-lg p-4 border">
                        <img 
                          src={signatureData} 
                          alt="Sua assinatura" 
                          className="max-h-24 mx-auto"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={handleClearSignature} className="flex-1">
                        Remover Assinatura
                      </Button>
                      <Button variant="outline" onClick={() => setSignatureData(null)} className="flex-1">
                        Criar Nova Assinatura
                      </Button>
                    </div>
                  </div>
                ) : (
                  <SignaturePad
                    onSave={handleSignatureSave}
                  />
                )}

                <Separator />

                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="space-y-1">
                    <Label htmlFor="auto-sign" className="font-medium">
                      Assinar Inspeções Automaticamente
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Quando habilitado, suas inspeções serão automaticamente assinadas com sua assinatura padrão ao finalizar
                    </p>
                  </div>
                  <Switch
                    id="auto-sign"
                    checked={autoSign}
                    onCheckedChange={setAutoSign}
                    disabled={!signatureData}
                  />
                </div>

                {!signatureData && autoSign && (
                  <p className="text-sm text-status-warning flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Configure uma assinatura padrão para habilitar a assinatura automática
                  </p>
                )}

                <div className="flex justify-end">
                  <Button onClick={form.handleSubmit(onSubmit)} disabled={saving} className="gap-2">
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Salvar Configurações
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Aparência */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                {t('profile.appearance')}
              </CardTitle>
              <CardDescription>
                {t('profile.themeDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Language Selector */}
              <div className="space-y-4">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {t('profile.language')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('profile.languageDescription')}
                </p>
                <RadioGroup
                  value={language}
                  onValueChange={(value: 'pt-BR' | 'en') => setLanguage(value)}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2"
                >
                  <div>
                    <RadioGroupItem
                      value="pt-BR"
                      id="lang-pt"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="lang-pt"
                      className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <span className="text-2xl mb-2">🇧🇷</span>
                      <span className="font-medium">{t('common.portuguese')}</span>
                      <span className="text-xs text-muted-foreground mt-1">Português (Brasil)</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem
                      value="en"
                      id="lang-en"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="lang-en"
                      className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <span className="text-2xl mb-2">🇺🇸</span>
                      <span className="font-medium">{t('common.english')}</span>
                      <span className="text-xs text-muted-foreground mt-1">English</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              {/* Theme Selector */}
              <div className="space-y-4">
                <Label className="text-base font-medium">{t('profile.theme')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('profile.themeDescription')}
                </p>
                <RadioGroup
                  value={theme}
                  onValueChange={(value: 'light' | 'dark' | 'system') => setTheme(value)}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2"
                >
                  <div>
                    <RadioGroupItem
                      value="light"
                      id="theme-light"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="theme-light"
                      className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <Sun className="h-8 w-8 mb-3 text-yellow-500" />
                      <span className="font-medium">{t('profile.themeLight')}</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem
                      value="dark"
                      id="theme-dark"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="theme-dark"
                      className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <Moon className="h-8 w-8 mb-3 text-blue-500" />
                      <span className="font-medium">{t('profile.themeDark')}</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem
                      value="system"
                      id="theme-system"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="theme-system"
                      className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <Monitor className="h-8 w-8 mb-3 text-muted-foreground" />
                      <span className="font-medium">{t('profile.themeSystem')}</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Notificações */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Preferências de Notificação
              </CardTitle>
              <CardDescription>
                Configure como você deseja receber alertas e notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-1">
                    <Label htmlFor="notification-email" className="font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Notificações por Email
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receba alertas sobre inspeções vencendo e atualizações importantes
                    </p>
                  </div>
                  <Switch
                    id="notification-email"
                    checked={notificationEmail}
                    onCheckedChange={setNotificationEmail}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-1">
                    <Label htmlFor="notification-app" className="font-medium flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Notificações no App
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receba notificações push quando estiver usando o aplicativo
                    </p>
                  </div>
                  <Switch
                    id="notification-app"
                    checked={notificationApp}
                    onCheckedChange={setNotificationApp}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={form.handleSubmit(onSubmit)} disabled={saving} className="gap-2">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Salvar Preferências
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Segurança */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Segurança da Conta
              </CardTitle>
              <CardDescription>
                Gerencie a segurança da sua conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">Alterar Senha</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Atualize sua senha regularmente para manter sua conta segura
                    </p>
                    <Button variant="outline" className="mt-3" onClick={async () => {
                      const { error } = await supabase.auth.resetPasswordForEmail(
                        form.getValues('email'),
                        { redirectTo: `${window.location.origin}/auth` }
                      );
                      if (error) {
                        toast({
                          title: 'Erro',
                          description: error.message,
                          variant: 'destructive',
                        });
                      } else {
                        toast({
                          title: 'Email Enviado',
                          description: 'Verifique seu email para redefinir sua senha.',
                        });
                      }
                    }}>
                      Enviar Email de Redefinição
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">Informações da Sessão</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium">{user?.email}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ID do Usuário:</span>
                    <p className="font-mono text-xs truncate">{user?.id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Último Acesso:</span>
                    <p className="font-medium">
                      {user?.last_sign_in_at 
                        ? new Date(user.last_sign_in_at).toLocaleString('pt-BR')
                        : 'N/A'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Avatar Crop Dialog */}
      {imageToCrop && (
        <AvatarCropDialog
          open={cropDialogOpen}
          onOpenChange={(open) => {
            setCropDialogOpen(open);
            if (!open && imageToCrop) {
              URL.revokeObjectURL(imageToCrop);
              setImageToCrop(null);
            }
          }}
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}
