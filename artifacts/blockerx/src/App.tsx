import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";

import LandingPage from "@/pages/landing";
import InvitePage from "@/pages/invite";
import DashboardPage from "@/pages/dashboard";
import BotsPage from "@/pages/bots";
import BotDetailPage from "@/pages/bot-detail";
import DeploymentsPage from "@/pages/deployments";
import StoragePage from "@/pages/storage";
import AiPage from "@/pages/ai";
import NotificationsPage from "@/pages/notifications";
import ProfilePage from "@/pages/profile";
import SettingsPage from "@/pages/settings";
import BillingPage from "@/pages/billing";
import AdminPage from "@/pages/admin";
import AdminUsersPage from "@/pages/admin-users";
import AdminInvitesPage from "@/pages/admin-invites";
import AdminDeploymentsPage from "@/pages/admin-deployments";
import AdminLogsPage from "@/pages/admin-logs";
import AdminBroadcastPage from "@/pages/admin-broadcast";
import NotFound from "@/pages/not-found";
import DashboardLayout from "@/components/layout/dashboard-layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType; adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
  if (!user) return null;
  if (user.isBanned) return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-2xl font-bold text-destructive mb-2">Account Suspended</p>
        <p className="text-muted-foreground">Your account has been suspended. Contact support for help.</p>
      </div>
    </div>
  );
  if (adminOnly && !user.isAdmin) return <NotFound />;
  return <Component />;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/invite" component={InvitePage} />
      <Route path="/dashboard">
        <DashboardLayout><ProtectedRoute component={DashboardPage} /></DashboardLayout>
      </Route>
      <Route path="/bots/:botId">
        <DashboardLayout><ProtectedRoute component={BotDetailPage} /></DashboardLayout>
      </Route>
      <Route path="/bots">
        <DashboardLayout><ProtectedRoute component={BotsPage} /></DashboardLayout>
      </Route>
      <Route path="/deployments">
        <DashboardLayout><ProtectedRoute component={DeploymentsPage} /></DashboardLayout>
      </Route>
      <Route path="/storage">
        <DashboardLayout><ProtectedRoute component={StoragePage} /></DashboardLayout>
      </Route>
      <Route path="/ai">
        <DashboardLayout><ProtectedRoute component={AiPage} /></DashboardLayout>
      </Route>
      <Route path="/notifications">
        <DashboardLayout><ProtectedRoute component={NotificationsPage} /></DashboardLayout>
      </Route>
      <Route path="/profile">
        <DashboardLayout><ProtectedRoute component={ProfilePage} /></DashboardLayout>
      </Route>
      <Route path="/settings">
        <DashboardLayout><ProtectedRoute component={SettingsPage} /></DashboardLayout>
      </Route>
      <Route path="/billing">
        <DashboardLayout><ProtectedRoute component={BillingPage} /></DashboardLayout>
      </Route>
      <Route path="/admin/users">
        <DashboardLayout><ProtectedRoute component={AdminUsersPage} adminOnly /></DashboardLayout>
      </Route>
      <Route path="/admin/invites">
        <DashboardLayout><ProtectedRoute component={AdminInvitesPage} adminOnly /></DashboardLayout>
      </Route>
      <Route path="/admin/deployments">
        <DashboardLayout><ProtectedRoute component={AdminDeploymentsPage} adminOnly /></DashboardLayout>
      </Route>
      <Route path="/admin/logs">
        <DashboardLayout><ProtectedRoute component={AdminLogsPage} adminOnly /></DashboardLayout>
      </Route>
      <Route path="/admin/broadcast">
        <DashboardLayout><ProtectedRoute component={AdminBroadcastPage} adminOnly /></DashboardLayout>
      </Route>
      <Route path="/admin">
        <DashboardLayout><ProtectedRoute component={AdminPage} adminOnly /></DashboardLayout>
      </Route>
      <Route>
        <DashboardLayout><NotFound /></DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
