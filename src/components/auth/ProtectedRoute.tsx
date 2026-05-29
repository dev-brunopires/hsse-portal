import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { LogIn, MonitorSmartphone } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SystemLogo } from '@/components/ui/SystemLogo';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin_master' | 'admin' | 'technician' | 'viewer' | 'supervisor';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { t } = useTranslation();
  const { user, role, loading, isPlatformOwner, sessionExpired } = useAuth();
  const location = useLocation();

  // Wait for auth to load - platform owners may not have a role
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Show friendly session-expired screen instead of white page
  if (!user && sessionExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MonitorSmartphone className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                {t('auth.sessionExpiredTitle', 'Sessão encerrada')}
              </h2>
              <p className="text-muted-foreground text-sm">
                {t('auth.sessionExpiredMessage', 'Sua sessão foi encerrada, possivelmente porque você acessou sua conta em outro navegador ou dispositivo. Por segurança, faça login novamente.')}
              </p>
            </div>
            <div className="flex justify-center pt-2">
              <SystemLogo size="sm" />
            </div>
            <Button 
              onClick={() => window.location.href = '/auth'} 
              className="w-full gap-2"
            >
              <LogIn className="h-4 w-4" />
              {t('auth.loginAgain', 'Entrar novamente')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Platform owners have full access
  if (isPlatformOwner) {
    return <>{children}</>;
  }

  // Check role if required
  if (requiredRole === 'admin_master') {
    if (role !== 'admin_master') {
      return <Navigate to="/" replace />;
    }
  } else if (requiredRole === 'admin') {
    const isAdminUser = role === 'admin' || role === 'admin_master';
    if (!isAdminUser) {
      return <Navigate to="/" replace />;
    }
  } else if (requiredRole) {
    const roleHierarchy: Record<string, number> = {
      admin_master: 5,
      admin: 4,
      supervisor: 3,
      technician: 2,
      viewer: 1,
    };
    const userLevel = roleHierarchy[role || 'viewer'] ?? 1;
    const requiredLevel = roleHierarchy[requiredRole] ?? 1;

    if (userLevel < requiredLevel) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
