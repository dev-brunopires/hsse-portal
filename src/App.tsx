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
const HeatStress = lazyWithRetry(() => import("./pages/HeatStress"));
const ObsCardsDashboard = lazyWithRetry(() => import("./pages/ObsCardsDashboard"));
const ObsCardsUpload = lazyWithRetry(() => import("./pages/ObsCardsUpload"));
const ObsCardsDatasets = lazyWithRetry(() => import("./pages/ObsCardsDatasets"));
const SafetyObservationForm = lazyWithRetry(() => import("./pages/SafetyObservationForm"));
const EvvHome = lazyWithRetry(() => import("./features/evv/pages/EvvHome"));
const EvvFormSelector = lazyWithRetry(() => import("./features/evv/pages/FormSelector"));
const EvvWizard = lazyWithRetry(() => import("./features/evv/pages/EvvWizard"));
const EvvHistory = lazyWithRetry(() => import("./features/evv/pages/EvvHistory"));
const EvvReports = lazyWithRetry(() => import("./features/evv/pages/EvvReports"));
const EvvSubmissionDetail = lazyWithRetry(() => import("./features/evv/pages/EvvSubmissionDetail"));
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
                    <ProtectedRoute moduleKey="equipment" pageKey="dashboard">
                      <AppLayout>
                        <Index />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/equipment"
                  element={
                    <ProtectedRoute moduleKey="equipment" pageKey="equipment">
                      <AppLayout>
                        <EquipmentList />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/inspections"
                  element={
                    <ProtectedRoute moduleKey="equipment" pageKey="inspections">
                      <AppLayout>
                        <Inspections />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute moduleKey="reports" pageKey="reports">
                      <AppLayout>
                        <Reports />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/alerts"
                  element={
                    <ProtectedRoute moduleKey="alerts" pageKey="alerts">
                      <AppLayout>
                        <Alerts />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pending"
                  element={
                    <ProtectedRoute moduleKey="equipment" pageKey="pending">
                      <AppLayout>
                        <PendingRecommendations />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/maintenance"
                  element={
                    <ProtectedRoute moduleKey="equipment" pageKey="maintenance">
                      <AppLayout>
                        <Maintenance />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/certificates"
                  element={
                    <ProtectedRoute moduleKey="equipment" pageKey="certificates">
                      <AppLayout>
                        <Certificates />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/categories"
                  element={
                    <ProtectedRoute moduleKey="equipment" pageKey="categories">
                      <AppLayout>
                        <Categories />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <ProtectedRoute moduleKey="admin" pageKey="users">
                      <AppLayout>
                        <Users />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute moduleKey="settings" pageKey="settings">
                      <AppLayout>
                        <Settings />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/audit-log"
                  element={
                    <ProtectedRoute moduleKey="audit" pageKey="audit_log">
                      <AppLayout>
                        <AuditLog />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute moduleKey="settings" pageKey="profile">
                      <AppLayout>
                        <Profile />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/offline"
                  element={
                    <ProtectedRoute moduleKey="settings" pageKey="offline">
                      <AppLayout>
                        <OfflineData />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/diagnostics"
                  element={
                    <ProtectedRoute moduleKey="settings" pageKey="diagnostics">
                      <AppLayout>
                        <Diagnostics />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/health-check"
                  element={
                    <ProtectedRoute moduleKey="health" pageKey="health_check">
                      <AppLayout>
                        <HealthCheck />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/supervisor"
                  element={
                    <ProtectedRoute moduleKey="equipment" pageKey="supervisor">
                      <AppLayout>
                        <Supervisor />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/heat-stress"
                  element={
                    <ProtectedRoute moduleKey="health" pageKey="heat_stress">
                      <AppLayout>
                        <HeatStress />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/obs-cards"
                  element={
                    <ProtectedRoute moduleKey="obs_cards" pageKey="dashboard">
                      <AppLayout>
                        <ObsCardsDashboard />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/obs-cards/safety-observation"
                  element={
                    <ProtectedRoute moduleKey="obs_cards" pageKey="safety_observation">
                      <AppLayout>
                        <SafetyObservationForm />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/obs-cards/upload"
                  element={
                    <ProtectedRoute moduleKey="obs_cards" pageKey="upload">
                      <AppLayout>
                        <ObsCardsUpload />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/obs-cards/datasets"
                  element={
                    <ProtectedRoute moduleKey="obs_cards" pageKey="datasets">
                      <AppLayout>
                        <ObsCardsDatasets />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route path="/evv" element={<ProtectedRoute moduleKey="evv" pageKey="home"><AppLayout><EvvHome /></AppLayout></ProtectedRoute>} />
                <Route path="/evv/forms" element={<ProtectedRoute moduleKey="evv" pageKey="forms"><AppLayout><EvvFormSelector /></AppLayout></ProtectedRoute>} />
                <Route path="/evv/forms/:formType" element={<ProtectedRoute moduleKey="evv" pageKey="forms" action="create"><AppLayout><EvvWizard /></AppLayout></ProtectedRoute>} />
                <Route path="/evv/history" element={<ProtectedRoute moduleKey="evv" pageKey="history"><AppLayout><EvvHistory /></AppLayout></ProtectedRoute>} />
                <Route path="/evv/history/:id" element={<ProtectedRoute moduleKey="evv" pageKey="history"><AppLayout><EvvSubmissionDetail /></AppLayout></ProtectedRoute>} />
                <Route path="/evv/reports" element={<ProtectedRoute moduleKey="evv" pageKey="reports"><AppLayout><EvvReports /></AppLayout></ProtectedRoute>} />

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
