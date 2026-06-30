import { useState } from "react";
import { useGetProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Crown, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["2 bots", "512 MB storage", "10 AI requests/month", "Community support"],
    cta: "Current Plan",
    highlight: false,
  },
  {
    name: "Premium",
    price: "$9.99",
    period: "per month",
    features: ["Unlimited bots", "5 GB storage", "Unlimited AI requests", "Priority support", "Custom domains", "Advanced analytics"],
    cta: "Upgrade to Premium",
    highlight: true,
  },
];

export default function BillingPage() {
  const { data: profile, refetch } = useGetProfile();
  const user = (profile as any)?.user;
  const { toast } = useToast();
  const qc = useQueryClient();
  const currentPlan = user?.plan || "free";

  const [keyInput, setKeyInput] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);

  const handleRedeemKey = async () => {
    if (!keyInput.trim()) return;
    setIsRedeeming(true);
    try {
      const res = await fetch("/api/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: keyInput.trim() }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Invalid key", description: data.error, variant: "destructive" });
      } else {
        toast({
          title: data.grantsPremium ? "🎉 Premium Activated!" : "Key Redeemed",
          description: data.message,
        });
        setKeyInput("");
        refetch();
        qc.invalidateQueries();
      }
    } catch {
      toast({ title: "Error", description: "Could not redeem key", variant: "destructive" });
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your plan and billing preferences</p>
      </div>

      {/* Redeem Key Section */}
      <Card className="bg-card/60 border-border/40 max-w-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            Redeem a Key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Have a premium key? Enter it below to upgrade your account instantly.
          </p>
          <div className="flex gap-2">
            <Input
              value={keyInput}
              onChange={e => setKeyInput(e.target.value.toUpperCase())}
              placeholder="ENTER-YOUR-KEY"
              className="font-mono uppercase"
              onKeyDown={e => e.key === "Enter" && handleRedeemKey()}
            />
            <Button onClick={handleRedeemKey} disabled={!keyInput.trim() || isRedeeming}>
              {isRedeeming ? "Redeeming..." : "Redeem"}
            </Button>
          </div>
          {currentPlan === "premium" && (
            <div className="flex items-center gap-2 text-xs text-yellow-400">
              <Crown className="w-3.5 h-3.5" />
              You already have Premium — enjoy all features!
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        {plans.map((plan) => (
          <Card key={plan.name} className={`relative ${plan.highlight ? "border-primary/40 bg-primary/5" : "bg-card/60 border-border/40"}`}>
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">Recommended</span>
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {plan.name}
                {plan.name === "Premium" && <Crown className="w-4 h-4 text-yellow-400" />}
              </CardTitle>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground text-sm">/{plan.period}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={plan.highlight ? "default" : "outline"}
                disabled={currentPlan === plan.name.toLowerCase() || plan.name === "Free"}
                onClick={() => toast({ title: "Use a premium key", description: "Enter a key above to activate Premium." })}
              >
                {currentPlan === plan.name.toLowerCase() ? "Current Plan" : plan.cta}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
