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
import { Spinner } from '@/components/ui/spinner';
import { PageHeader } from '@/components/layout/PageHeader';
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
        title: t('profilePage.errorLoadingProfile'),
        description: t('profilePage.errorLoadingProfileDesc'),
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
      title: t('profilePage.photoCropped'),
      description: t('profilePage.photoCroppedDesc'),
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
        title: t('profilePage.profileUpdated'),
        description: t('profilePage.profileUpdatedDesc'),
      });

      fetchProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: t('profilePage.errorSaving'),
        description: t('profilePage.errorSavingDesc'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignatureSave = (data: string) => {
    setSignatureData(data);
    toast({
      title: t('profilePage.signatureCaptured'),
      description: t('profilePage.signatureCapturedDesc'),
    });
  };

  const handleClearSignature = () => {
    setSignatureData(null);
    toast({
      title: t('profilePage.signatureRemoved'),
      description: t('profilePage.signatureRemovedDesc'),
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
      <PageHeader
        icon={User}
        title={t('profilePage.myProfile')}
        subtitle={t('profilePage.manageInfo')}
      />

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="personal" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profilePage.personalTab')}</span>
          </TabsTrigger>
          <TabsTrigger value="signature" className="flex items-center gap-2">
            <PenTool className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profilePage.signatureTab')}</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profilePage.appearanceTab')}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profilePage.notificationsTab')}</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profilePage.securityTab')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Informações Pessoais */}
        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                {t('profilePage.personalInfo')}
              </CardTitle>
              <CardDescription>
                {t('profilePage.updateYourData')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Avatar Section */}
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="relative flex-shrink-0">
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
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-lg truncate">{form.watch('full_name')}</h3>
                      <p className="text-sm text-muted-foreground break-all">{form.watch('email')}</p>
                      {profileData?.position && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">{profileData.position}</p>
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
                            {t('profilePage.fullName')}
                          </FormLabel>
                          <FormControl>
                            <Input placeholder={t('profilePage.fullName')} {...field} />
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
                            {t('profilePage.email')}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} disabled />
                          </FormControl>
                          <FormDescription>
                            {t('profilePage.emailCantChange')}
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
                            {t('profilePage.phone')}
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
                            {t('profilePage.position')}
                          </FormLabel>
                          <FormControl>
                            <Input placeholder={t('profilePage.position')} {...field} />
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
                            {t('profilePage.department')}
                          </FormLabel>
                          <FormControl>
                            <Input placeholder={t('profilePage.department')} {...field} />
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
                          {t('profilePage.saving')}
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          {t('profilePage.saveChanges')}
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
                  {t('profilePage.defaultSignature')}
                </CardTitle>
                <CardDescription>
                  {t('profilePage.signatureDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {signatureData ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg border-2 border-status-success bg-status-success/10">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-5 w-5 text-status-success" />
                        <span className="font-medium text-status-success">{t('profilePage.signatureConfigured')}</span>
                      </div>
                      <div className="bg-white rounded-lg p-4 border">
                        <img 
                          src={signatureData} 
                          alt={t('profilePage.defaultSignature')} 
                          className="max-h-24 mx-auto"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button variant="outline" onClick={handleClearSignature} className="flex-1">
                        {t('profilePage.removeSignature')}
                      </Button>
                      <Button variant="outline" onClick={() => setSignatureData(null)} className="flex-1">
                        {t('profilePage.createNewSignature')}
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
                      {t('profilePage.autoSignInspections')}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t('profilePage.autoSignDescription')}
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
                    {t('profilePage.configureSignatureFirst')}
                  </p>
                )}

                <div className="flex justify-end">
                  <Button onClick={form.handleSubmit(onSubmit)} disabled={saving} className="gap-2">
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('profilePage.saving')}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        {t('profilePage.saveSettings')}
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
                {t('profilePage.notificationPreferences')}
              </CardTitle>
              <CardDescription>
                {t('profilePage.notificationDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-1">
                    <Label htmlFor="notification-email" className="font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {t('profilePage.emailNotifications')}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t('profilePage.emailNotificationsDesc')}
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
                      {t('profilePage.appNotifications')}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t('profilePage.appNotificationsDesc')}
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
                      {t('profilePage.saving')}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {t('profilePage.savePreferences')}
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
                {t('profilePage.accountSecurity')}
              </CardTitle>
              <CardDescription>
                {t('profilePage.manageAccountSecurity')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{t('profilePage.changePasswordTitle')}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('profilePage.changePasswordDesc')}
                    </p>
                    <Button variant="outline" className="mt-3" onClick={async () => {
                      const { error } = await supabase.auth.resetPasswordForEmail(
                        form.getValues('email'),
                        { redirectTo: `${window.location.origin}/auth` }
                      );
                      if (error) {
                        toast({
                          title: t('common.error'),
                          description: error.message,
                          variant: 'destructive',
                        });
                      } else {
                        toast({
                          title: t('profilePage.emailSent'),
                          description: t('profilePage.emailSentDesc'),
                        });
                      }
                    }}>
                      {t('profilePage.sendResetEmail')}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">{t('profilePage.sessionInfo')}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="min-w-0">
                    <span className="text-muted-foreground">{t('profilePage.email')}:</span>
                    <p className="font-medium break-all">{user?.email}</p>
                  </div>
                  <div className="min-w-0">
                    <span className="text-muted-foreground">{t('profilePage.userId')}:</span>
                    <p className="font-mono text-xs break-all">{user?.id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('profilePage.lastAccess')}:</span>
                    <p className="font-medium">
                      {user?.last_sign_in_at 
                        ? new Date(user.last_sign_in_at).toLocaleString(language === 'pt-BR' ? 'pt-BR' : 'en-US')
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
