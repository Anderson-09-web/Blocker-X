import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  TerminalSquare, 
  Rocket, 
  HardDrive,
  Settings,
  CreditCard,
  User,
  Bell,
  LogOut,
  ShieldAlert,
  Users,
  KeyRound,
  FileText,
  Activity,
  MessageSquare,
  HeartHandshake
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

const mainNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "My Bots", href: "/bots", icon: TerminalSquare },
  { title: "Deployments", href: "/deployments", icon: Rocket },
  { title: "Storage", href: "/storage", icon: HardDrive },
];

const toolsNav: NavItem[] = [
  { title: "AI Assistant", href: "/ai", icon: MessageSquare },
];

const accountNav: NavItem[] = [
  { title: "Notifications", href: "/notifications", icon: Bell },
  { title: "Billing", href: "/billing", icon: CreditCard },
  { title: "Profile", href: "/profile", icon: User },
  { title: "Settings", href: "/settings", icon: Settings },
];

const adminNav: NavItem[] = [
  { title: "Admin Dashboard", href: "/admin", icon: ShieldAlert },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Invite Codes", href: "/admin/invites", icon: KeyRound },
  { title: "All Deployments", href: "/admin/deployments", icon: Rocket },
  { title: "Audit Logs", href: "/admin/logs", icon: FileText },
  { title: "Broadcast", href: "/admin/broadcast", icon: Activity },
];

// NavGroup defined outside SidebarContent so React never remounts it on re-renders
function NavGroup({
  title,
  items,
  location,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  location: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="mb-6">
      <h4 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {title}
      </h4>
      <div className="space-y-1">
        {items.map((item) => {
          const isActive = location === item.href || location.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

interface SidebarContentProps {
  onNavigate?: () => void;
}

export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  const logoutMutation = useLogout();
  const qc = useQueryClient();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        qc.removeQueries({ queryKey: getGetMeQueryKey() });
        qc.clear();
        window.location.href = "/";
      },
      onError: () => {
        qc.clear();
        window.location.href = "/";
      }
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
        <div className="w-6 h-6 bg-primary rounded-md rotate-45 mr-4 shrink-0" />
        <span className="font-bold text-lg tracking-tight">Blocker X</span>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3">
        <NavGroup title="Main" items={mainNav} location={location} onNavigate={onNavigate} />
        <NavGroup title="Tools" items={toolsNav} location={location} onNavigate={onNavigate} />
        <NavGroup title="Account" items={accountNav} location={location} onNavigate={onNavigate} />
        {user?.isAdmin && <NavGroup title="Admin" items={adminNav} location={location} onNavigate={onNavigate} />}

        {/* Support server */}
        <div className="mb-6">
          <a
            href="https://discord.gg/cf2pNF7gh8"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onNavigate}
            className="flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50"
          >
            <HeartHandshake className="w-4 h-4 shrink-0 text-primary" />
            Support Server
          </a>
        </div>
      </div>

      <div className="p-4 border-t border-border shrink-0">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-muted overflow-hidden shrink-0">
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.username}</p>
            <p className="text-xs text-muted-foreground">{user?.plan === "premium" ? "Premium" : "Free Plan"}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {logoutMutation.isPending ? "Cerrando..." : "Log out"}
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  return (
    <div className="w-64 border-r border-border bg-card h-screen hidden md:flex flex-col">
      <SidebarContent />
    </div>
  );
}
