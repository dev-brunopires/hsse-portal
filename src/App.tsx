import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
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
const SafetyObservationReports = lazyWithRetry(() => import("./pages/SafetyObservationReports"));
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

function ProtectedAppLayout() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </ProtectedRoute>
  );
}

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
                <Route element={<ProtectedAppLayout />}>
                  <Route path="/" element={<ProtectedRoute moduleKey="equipment" pageKey="dashboard"><Index /></ProtectedRoute>} />
                  <Route path="/equipment" element={<ProtectedRoute moduleKey="equipment" pageKey="equipment"><EquipmentList /></ProtectedRoute>} />
                  <Route path="/inspections" element={<ProtectedRoute moduleKey="equipment" pageKey="inspections"><Inspections /></ProtectedRoute>} />
                  <Route path="/reports" element={<ProtectedRoute moduleKey="reports" pageKey="reports"><Reports /></ProtectedRoute>} />
                  <Route path="/alerts" element={<ProtectedRoute moduleKey="alerts" pageKey="alerts"><Alerts /></ProtectedRoute>} />
                  <Route path="/pending" element={<ProtectedRoute moduleKey="equipment" pageKey="pending"><PendingRecommendations /></ProtectedRoute>} />
                  <Route path="/maintenance" element={<ProtectedRoute moduleKey="equipment" pageKey="maintenance"><Maintenance /></ProtectedRoute>} />
                  <Route path="/certificates" element={<ProtectedRoute moduleKey="equipment" pageKey="certificates"><Certificates /></ProtectedRoute>} />
                  <Route path="/categories" element={<ProtectedRoute moduleKey="equipment" pageKey="categories"><Categories /></ProtectedRoute>} />
                  <Route path="/users" element={<ProtectedRoute moduleKey="admin" pageKey="users"><Users /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute moduleKey="settings" pageKey="settings"><Settings /></ProtectedRoute>} />
                  <Route path="/audit-log" element={<ProtectedRoute moduleKey="audit" pageKey="audit_log"><AuditLog /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute moduleKey="settings" pageKey="profile"><Profile /></ProtectedRoute>} />
                  <Route path="/offline" element={<ProtectedRoute moduleKey="settings" pageKey="offline"><OfflineData /></ProtectedRoute>} />
                  <Route path="/diagnostics" element={<ProtectedRoute moduleKey="settings" pageKey="diagnostics"><Diagnostics /></ProtectedRoute>} />
                  <Route path="/health-check" element={<ProtectedRoute moduleKey="health" pageKey="health_check"><HealthCheck /></ProtectedRoute>} />
                  <Route path="/supervisor" element={<ProtectedRoute moduleKey="equipment" pageKey="supervisor"><Supervisor /></ProtectedRoute>} />
                  <Route path="/heat-stress" element={<ProtectedRoute moduleKey="health" pageKey="heat_stress"><HeatStress /></ProtectedRoute>} />
                  <Route path="/obs-cards" element={<ProtectedRoute moduleKey="obs_cards" pageKey="dashboard"><ObsCardsDashboard /></ProtectedRoute>} />
                  <Route path="/obs-cards/safety-observation" element={<ProtectedRoute moduleKey="obs_cards" pageKey="safety_observation"><SafetyObservationForm /></ProtectedRoute>} />
                  <Route path="/obs-cards/reports" element={<ProtectedRoute moduleKey="obs_cards" pageKey="reports"><SafetyObservationReports /></ProtectedRoute>} />
                  <Route path="/obs-cards/upload" element={<ProtectedRoute moduleKey="obs_cards" pageKey="upload"><ObsCardsUpload /></ProtectedRoute>} />
                  <Route path="/obs-cards/datasets" element={<ProtectedRoute moduleKey="obs_cards" pageKey="datasets"><ObsCardsDatasets /></ProtectedRoute>} />
                  <Route path="/evv" element={<ProtectedRoute moduleKey="evv" pageKey="home"><EvvHome /></ProtectedRoute>} />
                  <Route path="/evv/forms" element={<ProtectedRoute moduleKey="evv" pageKey="forms"><EvvFormSelector /></ProtectedRoute>} />
                  <Route path="/evv/forms/:formType" element={<ProtectedRoute moduleKey="evv" pageKey="forms" action="create"><EvvWizard /></ProtectedRoute>} />
                  <Route path="/evv/history" element={<ProtectedRoute moduleKey="evv" pageKey="history"><EvvHistory /></ProtectedRoute>} />
                  <Route path="/evv/history/:id" element={<ProtectedRoute moduleKey="evv" pageKey="history"><EvvSubmissionDetail /></ProtectedRoute>} />
                  <Route path="/evv/reports" element={<ProtectedRoute moduleKey="evv" pageKey="reports"><EvvReports /></ProtectedRoute>} />
                </Route>

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
