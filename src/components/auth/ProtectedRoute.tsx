import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'technician' | 'viewer' | 'supervisor';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { t } = useTranslation();
  const { user, role, loading, isPlatformOwner } = useAuth();
  const location = useLocation();

  // Wait for auth to load - platform owners may not have a role
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
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
  if (requiredRole === 'admin') {
    // Only admin and admin_master can access admin-required routes
    const isAdminUser = role === 'admin' || role === 'admin_master';
    if (!isAdminUser) {
      return <Navigate to="/" replace />;
    }
  } else if (requiredRole) {
    // For other role requirements, use hierarchy
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
