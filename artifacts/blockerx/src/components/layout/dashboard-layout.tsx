import React, { useState } from "react";
import Sidebar, { SidebarContent } from "./sidebar";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

class PageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, error: err?.message || "Unknown error" };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-4 py-20">
          <p className="text-destructive font-semibold">Algo salió mal</p>
          <p className="text-sm text-muted-foreground max-w-sm text-center">{this.state.error}</p>
          <button
            className="text-xs bg-primary text-primary-foreground px-4 py-2 rounded-md"
            onClick={() => this.setState({ hasError: false, error: "" })}
          >Reintentar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 md:hidden flex items-center px-4 border-b border-border bg-card shrink-0 gap-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="p-0 w-64 bg-card border-border"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <SidebarContent onNavigate={() => setTimeout(() => setMobileOpen(false), 50)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-primary rounded-sm rotate-45 shrink-0" />
            <span className="font-bold tracking-tight">Blocker X</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-4 md:p-8 max-w-7xl mx-auto"
          >
            <PageErrorBoundary>
              {children}
            </PageErrorBoundary>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
