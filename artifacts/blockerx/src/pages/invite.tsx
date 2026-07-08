import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRedeemInviteCode } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import bxLogo from "@/assets/bx-logo.jpg";

export default function InvitePage() {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const redeemMutation = useRedeemInviteCode();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    
    redeemMutation.mutate({ data: { code } }, {
      onSuccess: () => {
        toast({
          title: "Access Granted",
          description: "Welcome to BX.",
        });
        window.location.href = "/dashboard";
      },
      onError: (err: any) => {
        toast({
          title: "Invalid Code",
          description: err.error || "The invite code is invalid or expired.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-primary/8 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <Card className="w-full max-w-md border-primary/20 bg-card/60 backdrop-blur-xl shadow-2xl shadow-primary/5">
          <CardHeader className="text-center pb-6">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4, type: "spring", stiffness: 200 }}
              className="mx-auto mb-5"
            >
              <img
                src={bxLogo}
                alt="BX"
                className="w-20 h-20 object-contain rounded-2xl shadow-lg shadow-primary/20 mx-auto"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.35 }}
            >
              <CardTitle className="text-3xl font-bold tracking-tight">Private Beta</CardTitle>
              <CardDescription className="text-base mt-2 text-muted-foreground">
                BX is currently invite-only. Enter your code to access the platform.
              </CardDescription>
            </motion.div>
          </CardHeader>
          <CardContent>
            <motion.form
              onSubmit={handleRedeem}
              className="space-y-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.3 }}
            >
              <div className="space-y-2">
                <Input
                  placeholder="ENTER INVITE CODE"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="h-12 text-center text-lg tracking-widest uppercase font-mono bg-background/50 border-border/60 focus:border-primary/60"
                  maxLength={12}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold tracking-wide transition-all duration-200 shadow-lg shadow-primary/20 hover:shadow-primary/35"
                disabled={!code || redeemMutation.isPending}
              >
                {redeemMutation.isPending ? "Verifying..." : "Enter Platform"}
              </Button>
            </motion.form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
