import { useState } from "react";
import { useGetProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Crown, Key, Zap, Bot, Brain, Share2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const FREE_FEATURES = [
  { icon: Bot, text: "Hasta 2 bots" },
  { icon: Zap, text: "512 MB de almacenamiento" },
  { icon: Brain, text: "10 solicitudes IA / mes" },
  { icon: Clock, text: "Reinicios programados (plan gratuito)" },
];

const PREMIUM_FEATURES = [
  { icon: Bot, text: "Bots ilimitados" },
  { icon: Zap, text: "5 GB de almacenamiento" },
  { icon: Brain, text: "IA sin límites" },
  { icon: Share2, text: "Compartir proyectos con colaboradores" },
  { icon: Clock, text: "Sin reinicios forzados" },
  { icon: Crown, text: "Soporte prioritario" },
];

export default function BillingPage() {
  const { data: profile, refetch } = useGetProfile();
  const user = (profile as any)?.user;
  const { toast } = useToast();
  const qc = useQueryClient();
  const currentPlan: "free" | "premium" = user?.plan || "free";

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
        toast({ title: "Clave inválida", description: data.error, variant: "destructive" });
      } else {
        toast({
          title: data.grantsPremium ? "🎉 ¡Premium activado!" : "Clave canjeada",
          description: data.message,
        });
        setKeyInput("");
        refetch();
        qc.invalidateQueries();
      }
    } catch {
      toast({ title: "Error", description: "No se pudo canjear la clave", variant: "destructive" });
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Plan y facturación</h1>
        <p className="text-muted-foreground mt-1">Administra tu suscripción y acceso a funciones</p>
      </div>

      {/* Current plan banner */}
      <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${currentPlan === "premium" ? "bg-yellow-400/5 border-yellow-400/20" : "bg-card/60 border-border/40"}`}>
        <Crown className={`w-5 h-5 shrink-0 ${currentPlan === "premium" ? "text-yellow-400" : "text-muted-foreground"}`} />
        <div>
          <p className="font-semibold text-sm">
            {currentPlan === "premium" ? "Plan Premium activo" : "Plan Free"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {currentPlan === "premium"
              ? "Tienes acceso completo a todas las funciones de Blocker X."
              : "Canjea una clave premium para desbloquear todas las funciones."}
          </p>
        </div>
      </div>

      {/* Plans side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        {/* Free */}
        <Card className={`bg-card/60 border-border/40 ${currentPlan === "free" ? "ring-1 ring-border/60" : ""}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Free
              {currentPlan === "free" && (
                <span className="text-xs font-normal bg-muted px-2 py-0.5 rounded-full text-muted-foreground">Plan actual</span>
              )}
            </CardTitle>
            <p className="text-3xl font-bold">$0 <span className="text-sm font-normal text-muted-foreground">/ siempre</span></p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2">
              {FREE_FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="w-4 h-4 shrink-0 text-muted-foreground/60" />
                  {text}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Premium */}
        <Card className={`relative border-primary/40 bg-primary/5 ${currentPlan === "premium" ? "ring-1 ring-yellow-400/30" : ""}`}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">Recomendado</span>
          </div>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">Premium <Crown className="w-4 h-4 text-yellow-400" /></span>
              {currentPlan === "premium" && (
                <span className="text-xs font-normal bg-yellow-400/10 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-400/20">Activo</span>
              )}
            </CardTitle>
            <p className="text-3xl font-bold">$9.99 <span className="text-sm font-normal text-muted-foreground">/ mes</span></p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2">
              {PREMIUM_FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 shrink-0 text-primary" />
                  <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
                  {text}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Redeem Key */}
      <Card className="bg-card/60 border-border/40 max-w-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            Canjear clave Premium
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentPlan === "premium" ? (
            <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-400/5 border border-yellow-400/20 rounded-lg px-4 py-3">
              <Crown className="w-4 h-4 shrink-0" />
              Ya tienes Premium activo. ¡Disfruta todas las funciones!
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                ¿Tienes una clave Premium? Ingrésala aquí para activar tu cuenta al instante.
              </p>
              <div className="flex gap-2">
                <Input
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX"
                  className="font-mono uppercase tracking-widest"
                  onKeyDown={e => e.key === "Enter" && handleRedeemKey()}
                />
                <Button onClick={handleRedeemKey} disabled={!keyInput.trim() || isRedeeming}>
                  {isRedeeming ? "Canjeando..." : "Canjear"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
