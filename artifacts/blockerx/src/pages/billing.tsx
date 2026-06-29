import { useGetProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const { data: profile } = useGetProfile();
  const user = (profile as any)?.user;
  const { toast } = useToast();
  const currentPlan = user?.plan || "free";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your plan and billing preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        {plans.map((plan) => (
          <Card key={plan.name} className={`relative ${plan.highlight ? "border-primary/40 bg-primary/5" : "bg-card/60 border-border/40"}`} data-testid={`card-plan-${plan.name.toLowerCase()}`}>
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">Recommended</span>
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-lg">{plan.name}</CardTitle>
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
                onClick={() => toast({ title: "Premium upgrade coming soon!", description: "Payment processing will be available shortly." })}
                data-testid={`button-plan-${plan.name.toLowerCase()}`}
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
