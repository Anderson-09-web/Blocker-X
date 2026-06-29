import { SiDiscord } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function LandingPage() {
  const handleDiscordLogin = () => {
    const apiBase = import.meta.env.VITE_API_URL || "";
    window.location.href = `${apiBase}/api/auth/discord`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Abstract background glow */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="z-10 flex flex-col items-center max-w-lg text-center px-4"
      >
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-8 border border-primary/20 shadow-[0_0_40px_rgba(var(--primary),0.2)]">
          <div className="w-8 h-8 bg-primary rounded-lg rotate-45" />
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-foreground">
          Blocker <span className="text-primary">X</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-10 max-w-md mx-auto leading-relaxed">
          Premium Discord bot hosting. Fast, reliable, and built for developers who demand control.
        </p>

        <Button 
          size="lg" 
          onClick={handleDiscordLogin}
          className="h-14 px-8 text-base bg-[#5865F2] hover:bg-[#4752C4] text-white border-0 shadow-[0_0_20px_rgba(88,101,242,0.3)] transition-all hover:shadow-[0_0_30px_rgba(88,101,242,0.5)]"
        >
          <SiDiscord className="mr-3 w-5 h-5" />
          Sign in with Discord
        </Button>
      </motion.div>
    </div>
  );
}
