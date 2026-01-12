import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, Loader2, Eye, EyeOff, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SystemLogo } from '@/components/ui/SystemLogo';
import { getOrganizationUrl } from '@/utils/organizationUrl';
import loginBg from '@/assets/login-bg.jpg';

const REMEMBER_EMAIL_KEY = 'safeship_remembered_email';

export default function Auth() {
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organization, logoUrl, subdomain } = useOrganization();
  const formInitialized = useRef(false);
  
  const currentLanguage = i18n.language;
  
  // Use organization logo or system default logo
  const hasOrgLogo = organization && logoUrl;
  const organizationName = organization?.name || 'SafeShip';

  const loginSchema = z.object({
    email: z.string().email(t('errors.invalidEmail')).min(1, t('validation.required')),
    password: z.string().min(6, t('validation.minLength', { count: 6 })),
  });

  type LoginFormData = z.infer<typeof loginSchema>;

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Load remembered email on mount (only once)
  useEffect(() => {
    if (formInitialized.current) return;
    formInitialized.current = true;
    
    const rememberedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (rememberedEmail) {
      loginForm.setValue('email', rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const toggleLanguage = () => {
    setIsAnimating(true);
    const newLang = currentLanguage === 'pt-BR' ? 'en' : 'pt-BR';
    
    // Small delay for animation
    setTimeout(() => {
      i18n.changeLanguage(newLang);
      localStorage.setItem('language', newLang);
      setTimeout(() => setIsAnimating(false), 200);
    }, 150);
  };

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    
    // Save or remove remembered email
    if (rememberMe) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, data.email);
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }
    
    const { error, data: authData } = await signIn(data.email, data.password);
    
    if (error) {
      setIsLoading(false);
      return;
    }

    // After successful login, validate organization membership
    if (authData?.user && subdomain) {
      try {
        // Check if user is platform owner (they can access any org)
        const { data: isPlatformOwner } = await supabase
          .from('platform_owners')
          .select('id')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (!isPlatformOwner) {
          // Get user's actual organization
          const { data: userOrgData } = await supabase
            .from('user_organizations')
            .select(`
              organizations:organization_id (
                subdomain,
                name
              )
            `)
            .eq('user_id', authData.user.id)
            .maybeSingle();

          const userSubdomain = userOrgData?.organizations?.subdomain;
          
          // If user's org doesn't match URL org, redirect to correct URL
          if (userSubdomain && userSubdomain !== subdomain) {
            toast({
              title: t('authPage.wrongOrganization', 'Organização incorreta'),
              description: t('authPage.redirectingToCorrectOrg', 'Redirecionando para {{org}}...', { 
                org: userOrgData?.organizations?.name 
              }),
            });
            
            // Redirect to correct organization URL
            const correctUrl = getOrganizationUrl(userSubdomain, '/');
            window.location.href = correctUrl;
            return;
          }

          // If user has no org and trying to access specific org, show error
          if (!userSubdomain) {
            toast({
              title: t('authPage.noOrganization', 'Sem organização'),
              description: t('authPage.userNotAssigned', 'Usuário não está vinculado a nenhuma organização.'),
              variant: 'destructive',
            });
            await supabase.auth.signOut();
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('Error validating organization:', err);
      }
    }

    setIsLoading(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex relative">
      {/* Language Toggle - Top Right */}
      <button
        type="button"
        onClick={toggleLanguage}
        className="absolute top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:bg-background transition-all duration-200 hover:scale-105 active:scale-95"
      >
        <Globe className={`h-3.5 w-3.5 transition-transform duration-300 ${isAnimating ? 'rotate-180' : ''}`} />
        <span className={`font-medium transition-opacity duration-150 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
          {currentLanguage === 'pt-BR' ? 'PT' : 'EN'}
        </span>
      </button>

      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            {hasOrgLogo ? (
              <img src={logoUrl} alt={organizationName} className="h-12 mx-auto mb-3" />
            ) : (
              <div className="flex justify-center mb-3">
                <SystemLogo />
              </div>
            )}
          </div>

          {/* Form Header */}
          <div className="mb-8">
            {hasOrgLogo ? (
              <img src={logoUrl} alt={organizationName} className="h-10 mb-4 hidden lg:block" />
            ) : (
              <div className="mb-4 hidden lg:block">
                <SystemLogo />
              </div>
            )}
            <h2 className="text-lg font-semibold text-primary mb-2">
              {t('authPage.equipmentManagement')}
            </h2>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t('authPage.welcomeBack')}
            </h1>
            <p className="text-muted-foreground">
              {t('authPage.enterCredentials')}
            </p>
          </div>

          {/* Login Form */}
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-5">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('authPage.email')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder={t('authPage.emailPlaceholder', 'seu.email@empresa.com')}
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('authPage.password')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          className="pl-10 pr-10"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="remember" 
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                  />
                  <label
                    htmlFor="remember"
                    className="text-sm text-muted-foreground cursor-pointer select-none"
                  >
                    {t('authPage.rememberEmail')}
                  </label>
                </div>
                <button type="button" className="text-sm text-primary hover:underline">
                  {t('authPage.forgotPassword')}
                </button>
              </div>

              <Button type="submit" className="w-full h-11" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('authPage.loggingIn')}
                  </>
                ) : (
                  t('authPage.login')
                )}
              </Button>
            </form>
          </Form>

          {/* Terms */}
          <p className="mt-8 text-xs text-center text-muted-foreground">
            {t('authPage.termsAgreement')}{' '}
            <span className="text-primary hover:underline cursor-pointer">{t('authPage.termsOfUse')}</span>
            {' '}{t('authPage.and')}{' '}
            <span className="text-primary hover:underline cursor-pointer">{t('authPage.privacyPolicy')}</span>
            {' '}{t('authPage.of')} {organizationName}.
          </p>
        </div>
      </div>

      {/* Right Side - Image */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative">
        <img
          src={loginBg}
          alt={t('authPage.loginBackground')}
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Overlay Content */}
        <div className="absolute bottom-0 right-0 p-8 lg:p-12">
          <p className="text-white/80 text-sm drop-shadow-md text-right">
            © {new Date().getFullYear()} {organizationName}. {t('authPage.allRightsReserved')}
          </p>
        </div>
      </div>
    </div>
  );
}
