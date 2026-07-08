import React from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
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
  Zap,
} from "lucide-react";
import bxLogo from "@/assets/bx-logo.png";

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
  groupIndex = 0,
}: {
  title: string;
  items: NavItem[];
  location: string;
  onNavigate?: () => void;
  groupIndex?: number;
}) {
  return (
    <div className="mb-5">
      <h4 className="px-3 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em] mb-1.5">
        {title}
      </h4>
      <div className="space-y-0.5">
        {items.map((item, i) => {
          const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(`${item.href}/`));
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: (groupIndex * items.length + i) * 0.03, duration: 0.2, ease: "easeOut" }}
            >
              <Link
                href={item.href}
                onClick={onNavigate}
                className={`group relative flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all duration-150 ${
                  isActive
                    ? "bg-primary/10 text-primary bx-nav-active"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                {/* Active left bar */}
                {isActive && (
                  <motion.div
                    layoutId="nav-active-bar"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full"
                    style={{ boxShadow: "0 0 8px rgba(0,213,255,0.8)" }}
                  />
                )}
                <item.icon className={`w-4 h-4 shrink-0 transition-colors duration-150 ${isActive ? "text-primary" : "group-hover:text-foreground"}`} />
                <span className="flex-1 truncate">{item.title}</span>
                {isActive && (
                  <motion.div
                    layoutId="nav-active-dot"
                    className="w-1 h-1 rounded-full bg-primary"
                    style={{ boxShadow: "0 0 6px rgba(0,213,255,1)" }}
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
      <div className="h-16 flex items-center px-4 border-b border-border/60 shrink-0">
        <motion.div
          whileHover={{ scale: 1.03 }}
          transition={{ type: "spring", stiffness: 350, damping: 22 }}
          className="flex items-center gap-3"
        >
          <div className="relative">
            <img
              src={bxLogo}
              alt="BX"
              className="w-9 h-9 object-contain bx-logo-glow"
              style={{ imageRendering: "crisp-edges" }}
            />
            {/* Subtle cyan ring */}
            <div className="absolute inset-0 rounded-lg ring-1 ring-primary/20 pointer-events-none" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm tracking-[0.08em] text-foreground">BX PLATFORM</span>
            <span className="text-[9px] font-medium text-primary/70 tracking-[0.2em] uppercase mt-0.5">
              {user?.plan === "premium" ? "● Premium" : "● Free"}
            </span>
          </div>
        </motion.div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-2">
        <NavGroup title="Main" items={mainNav} location={location} onNavigate={onNavigate} groupIndex={0} />
        <NavGroup title="Tools" items={toolsNav} location={location} onNavigate={onNavigate} groupIndex={1} />
        <NavGroup title="Account" items={accountNav} location={location} onNavigate={onNavigate} groupIndex={2} />
        {user?.isAdmin && <NavGroup title="Admin" items={adminNav} location={location} onNavigate={onNavigate} groupIndex={3} />}

        {/* Support link */}
        <div className="mb-4">
          <a
            href="https://discord.gg/cf2pNF7gh8"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onNavigate}
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all duration-150 text-muted-foreground hover:text-foreground hover:bg-white/5"
          >
            <HeartHandshake className="w-4 h-4 shrink-0 text-primary/60" />
            Support Server
          </a>
        </div>
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-border/60 shrink-0">
        <div className="flex items-center gap-3 mb-2 px-2 py-1.5 rounded-md bg-white/3">
          <div className="w-7 h-7 rounded-full bg-muted overflow-hidden shrink-0 ring-1 ring-primary/20">
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/15 flex items-center justify-center text-primary font-bold text-xs">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate text-foreground">{user?.username}</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-primary" />
              {user?.plan === "premium" ? "BX Plus" : "Free Plan"}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/8 transition-all duration-150 disabled:opacity-50"
        >
          <LogOut className="w-3.5 h-3.5" />
          {logoutMutation.isPending ? "Cerrando..." : "Log out"}
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  return (
    <div className="w-60 border-r border-border/60 bg-sidebar h-screen hidden md:flex flex-col">
      <SidebarContent />
    </div>
  );
}
