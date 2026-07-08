import React from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
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
  HeartHandshake,
  Webhook,
  BookOpen,
} from "lucide-react";
import bxLogo from "@/assets/bx-logo.jpg";

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
  { title: "Webhooks", href: "/webhooks", icon: Webhook },
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
  { title: "Documentación", href: "/admin/docs", icon: BookOpen },
];

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
      <div className="space-y-0.5">
        {items.map((item, i) => {
          const isActive = location === item.href || location.startsWith(`${item.href}/`);
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
            >
              <Link
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                  isActive
                    ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                {item.title}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-dot"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                  />
                )}
              </Link>
            </motion.div>
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
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-border shrink-0">
        <motion.div
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="flex items-center gap-3"
        >
          <img
            src={bxLogo}
            alt="BX"
            className="w-9 h-9 object-contain rounded-lg"
          />
          <div className="flex flex-col leading-none">
            <span className="font-bold text-base tracking-tight text-foreground">BX</span>
            <span className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase">Platform</span>
          </div>
        </motion.div>
      </div>

      <div className="flex-1 overflow-y-auto py-5 px-3">
        <NavGroup title="Main" items={mainNav} location={location} onNavigate={onNavigate} />
        <NavGroup title="Tools" items={toolsNav} location={location} onNavigate={onNavigate} />
        <NavGroup title="Account" items={accountNav} location={location} onNavigate={onNavigate} />
        {user?.isAdmin && <NavGroup title="Admin" items={adminNav} location={location} onNavigate={onNavigate} />}

        <div className="mb-6">
          <a
            href="https://discord.gg/cf2pNF7gh8"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onNavigate}
            className="flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 text-muted-foreground hover:text-foreground hover:bg-accent/60"
          >
            <HeartHandshake className="w-4 h-4 shrink-0 text-primary" />
            Support Server
          </a>
        </div>
      </div>

      {/* User footer */}
      <div className="p-4 border-t border-border shrink-0">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-muted overflow-hidden shrink-0 ring-2 ring-primary/20">
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user?.username}</p>
            <p className="text-xs text-muted-foreground">{user?.plan === "premium" ? "BX Plus" : "Free Plan"}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150 disabled:opacity-50"
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
    <div className="w-64 border-r border-border bg-sidebar h-screen hidden md:flex flex-col">
      <SidebarContent />
    </div>
  );
}
