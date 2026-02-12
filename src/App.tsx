import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ShipFilterProvider } from "@/contexts/ShipFilterContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { OnboardingProvider } from "./components/onboarding/OnboardingProvider";
import { PageLoadingFallback } from "@/components/ui/PageLoadingFallback";
import { ChunkErrorBoundary } from "@/components/ui/ChunkErrorBoundary";
import { Suspense } from "react";
import { lazyWithRetry } from "@/utils/lazyWithRetry";

// Lazy load pages with retry for better resilience
const Index = lazyWithRetry(() => import("./pages/Index"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const EquipmentList = lazyWithRetry(() => import("./pages/EquipmentList"));
const Inspections = lazyWithRetry(() => import("./pages/Inspections"));
const Reports = lazyWithRetry(() => import("./pages/Reports"));
const Alerts = lazyWithRetry(() => import("./pages/Alerts"));
const Categories = lazyWithRetry(() => import("./pages/Categories"));
const Users = lazyWithRetry(() => import("./pages/Users"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const PendingRecommendations = lazyWithRetry(() => import("./pages/PendingRecommendations"));
const AuditLog = lazyWithRetry(() => import("./pages/AuditLog"));
const Maintenance = lazyWithRetry(() => import("./pages/Maintenance"));
const Certificates = lazyWithRetry(() => import("./pages/Certificates"));
const PlatformAdmin = lazyWithRetry(() => import("./pages/PlatformAdmin"));
const OfflineData = lazyWithRetry(() => import("./pages/OfflineData"));
const Diagnostics = lazyWithRetry(() => import("./pages/Diagnostics"));
const HealthCheck = lazyWithRetry(() => import("./pages/HealthCheck"));
const Supervisor = lazyWithRetry(() => import("./pages/Supervisor"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={0}>
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <LanguageProvider>
                <OrganizationProvider>
                <ShipFilterProvider>
                  <OnboardingProvider />
                  <ChunkErrorBoundary>
                  <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/reset-password" element={
                  <Suspense fallback={<PageLoadingFallback />}>
                    {(() => {
                      const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
                      return <ResetPassword />;
                    })()}
                  </Suspense>
                } />
                <Route path="/platform-admin" element={
                  <ProtectedRoute>
                    <PlatformAdmin />
                  </ProtectedRoute>
                } />
                
                {/* Protected Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Index />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/equipment"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <EquipmentList />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/inspections"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Inspections />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Reports />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/alerts"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Alerts />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pending"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <PendingRecommendations />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/maintenance"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Maintenance />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/certificates"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Certificates />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/categories"
                  element={
                    <ProtectedRoute requiredRole="technician">
                      <AppLayout>
                        <Categories />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <AppLayout>
                        <Users />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <AppLayout>
                        <Settings />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/audit-log"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <AppLayout>
                        <AuditLog />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Profile />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/offline"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <OfflineData />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/diagnostics"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Diagnostics />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/health-check"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <HealthCheck />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/supervisor"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Supervisor />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
                  </Suspense>
                  </ChunkErrorBoundary>
              </ShipFilterProvider>
                </OrganizationProvider>
              </LanguageProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
