import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRedeemInviteCode } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

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
          description: "Welcome to Blocker X.",
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="w-full max-w-md border-primary/20 bg-card/50 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center pb-8">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-6 border border-primary/20">
              <div className="w-6 h-6 bg-primary rounded-md rotate-45" />
            </div>
            <CardTitle className="text-3xl">Private Beta</CardTitle>
            <CardDescription className="text-base mt-2">
              Blocker X is currently invite-only. Please enter your invite code to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRedeem} className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Enter invite code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="h-12 text-center text-lg tracking-widest uppercase font-mono bg-background/50"
                  maxLength={12}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold"
                disabled={!code || redeemMutation.isPending}
              >
                {redeemMutation.isPending ? "Verifying..." : "Enter Platform"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
