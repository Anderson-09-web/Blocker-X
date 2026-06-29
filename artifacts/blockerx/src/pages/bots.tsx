import { useState } from "react";
import { useListBots, useCreateBot, useStartBot, useStopBot, useRestartBot, useDeleteBot, getListBotsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Plus, Play, Square, RotateCcw, Trash2, ExternalLink, TerminalSquare, CheckCircle, ChevronRight, Code2, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    running: "bg-green-500/15 text-green-400 border-green-500/20",
    stopped: "bg-gray-500/15 text-gray-400 border-gray-500/20",
    errored: "bg-red-500/15 text-red-400 border-red-500/20",
    deploying: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    starting: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  };
  return map[status] || map.stopped;
}

const PYTHON_GUIDE = [
  "Your bot uses discord.py with a ready-made template.",
  'Default prefix is "!" — try !ping or !hello.',
  "Edit main.py in the File Manager to add your own commands.",
  "Add dependencies to requirements.txt (they auto-install on start).",
  "Click Deploy to launch your bot live.",
];

const JS_GUIDE = [
  "Your bot uses discord.js v14 with a ready-made template.",
  'Default prefix is "!" — try !ping or !hello.',
  "Edit index.js in the File Manager to add your own commands.",
  "Add packages to package.json (they auto-install on start).",
  "Click Deploy to launch your bot live.",
];

type Step = 1 | 2 | 3;

function CreateBotWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [language, setLanguage] = useState<"python" | "javascript" | "">("");
  const [form, setForm] = useState({ name: "", token: "", description: "" });
  const [createdBotName, setCreatedBotName] = useState("");
  const createBot = useCreateBot();
  const { toast } = useToast();

  const handleCreate = () => {
    if (!form.name || !language) return;
    createBot.mutate(
      { data: { name: form.name, description: form.description, language: language as any, token: form.token } as any },
      {
        onSuccess: (bot: any) => {
          setCreatedBotName(bot.name);
          setStep(3);
          onCreated();
        },
        onError: () => toast({ title: "Failed to create bot", variant: "destructive" }),
      }
    );
  };

  const guide = language === "python" ? PYTHON_GUIDE : JS_GUIDE;

  return (
    <DialogContent className="bg-card border-border/60 max-w-lg">
      <DialogHeader>
        <div className="flex items-center gap-3 mb-1">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors ${step >= s ? "bg-primary border-primary text-primary-foreground" : "border-border/50 text-muted-foreground"}`}>
                {step > s ? <CheckCircle className="w-3.5 h-3.5" /> : s}
              </div>
              {s < 3 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
            </div>
          ))}
        </div>
        <DialogTitle className="text-lg">
          {step === 1 && "Choose Language"}
          {step === 2 && "Configure Your Bot"}
          {step === 3 && "Bot Created!"}
        </DialogTitle>
      </DialogHeader>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">Select the programming language for your bot.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setLanguage("python"); setStep(2); }}
                className={`p-4 rounded-xl border text-left transition-all hover:border-primary/60 hover:bg-primary/5 ${language === "python" ? "border-primary bg-primary/10" : "border-border/50 bg-card/40"}`}
              >
                <Cpu className="w-6 h-6 text-blue-400 mb-2" />
                <div className="font-semibold text-sm">Python</div>
                <div className="text-xs text-muted-foreground mt-0.5">discord.py template</div>
                <div className="text-xs text-muted-foreground">requests, dotenv</div>
              </button>
              <button
                onClick={() => { setLanguage("javascript"); setStep(2); }}
                className={`p-4 rounded-xl border text-left transition-all hover:border-primary/60 hover:bg-primary/5 ${language === "javascript" ? "border-primary bg-primary/10" : "border-border/50 bg-card/40"}`}
              >
                <Code2 className="w-6 h-6 text-yellow-400 mb-2" />
                <div className="font-semibold text-sm">JavaScript</div>
                <div className="text-xs text-muted-foreground mt-0.5">discord.js v14 template</div>
                <div className="text-xs text-muted-foreground">dotenv included</div>
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 mt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
              {language === "python" ? <Cpu className="w-4 h-4 text-blue-400" /> : <Code2 className="w-4 h-4 text-yellow-400" />}
              {language === "python" ? "Python (discord.py)" : "JavaScript (discord.js)"}
              <button onClick={() => setStep(1)} className="ml-auto text-primary hover:underline">Change</button>
            </div>
            <div>
              <Label htmlFor="bot-name">Bot Name <span className="text-destructive">*</span></Label>
              <Input id="bot-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My Awesome Bot" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="bot-token">
                Discord Bot Token
                <span className="ml-1 text-xs text-muted-foreground">(optional — can add later in env vars)</span>
              </Label>
              <Input
                id="bot-token"
                type="password"
                value={form.token}
                onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
                placeholder="MTI3..." className="mt-1 font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Stored securely as the <code className="bg-muted px-1 rounded">DISCORD_TOKEN</code> environment variable.
              </p>
            </div>
            <div>
              <Label htmlFor="bot-desc">Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input id="bot-desc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this bot do?" className="mt-1" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button onClick={handleCreate} disabled={createBot.isPending || !form.name} className="flex-1">
                {createBot.isPending ? "Creating..." : "Create Bot"}
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 mt-2">
            <div className="flex flex-col items-center gap-2 py-3">
              <CheckCircle className="w-12 h-12 text-green-400" />
              <p className="text-base font-semibold">{createdBotName} is ready!</p>
              <p className="text-sm text-muted-foreground text-center">Your bot has been created with a starter template. Here&apos;s how to get started:</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 space-y-2">
              {guide.map((tip, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <span className="text-primary font-semibold shrink-0">{i + 1}.</span>
                  <span className="text-muted-foreground">{tip}</span>
                </div>
              ))}
            </div>
            <Button onClick={onClose} className="w-full">Go to My Bots</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </DialogContent>
  );
}

export default function BotsPage() {
  const { data: bots, isLoading } = useListBots();
  const startBot = useStartBot();
  const stopBot = useStopBot();
  const restartBot = useRestartBot();
  const deleteBot = useDeleteBot();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });

  const handleAction = (action: "start" | "stop" | "restart" | "delete", botId: string, name: string) => {
    const fns = { start: startBot, stop: stopBot, restart: restartBot, delete: deleteBot };
    (fns[action] as any).mutate({ botId }, {
      onSuccess: () => { refresh(); toast({ title: `Bot ${action}ed successfully` }); },
      onError: (e: any) => toast({ title: `Failed to ${action} bot`, description: e?.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Bots</h1>
          <p className="text-muted-foreground mt-1">Manage and deploy your Discord bots</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Bot
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : bots?.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
            <TerminalSquare className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-center">No bots yet. Create your first bot to get started.</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Bot
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {bots?.map((bot: any) => (
            <Card key={bot.id} className="bg-card/60 border-border/50 hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold truncate">{bot.name}</CardTitle>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {bot.language === "python"
                        ? <Cpu className="w-3 h-3 text-blue-400" />
                        : <Code2 className="w-3 h-3 text-yellow-400" />}
                      <p className="text-xs text-muted-foreground">{bot.language === "python" ? "Python" : "JavaScript"}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${statusBadge(bot.status)}`}>
                    {bot.status}
                  </span>
                </div>
                {bot.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{bot.description}</p>}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {bot.status !== "running" && bot.status !== "starting" && bot.status !== "deploying" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAction("start", bot.id, bot.name)}>
                      <Play className="w-3 h-3 mr-1" /> Start
                    </Button>
                  )}
                  {(bot.status === "running" || bot.status === "starting" || bot.status === "deploying") && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAction("stop", bot.id, bot.name)}>
                      <Square className="w-3 h-3 mr-1" /> Stop
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAction("restart", bot.id, bot.name)}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Restart
                  </Button>
                  <Link href={`/bots/${bot.id}`}>
                    <Button size="sm" variant="ghost" className="h-7 text-xs">
                      <ExternalLink className="w-3 h-3 mr-1" /> Manage
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:bg-destructive/10" onClick={() => handleAction("delete", bot.id, bot.name)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">Created {new Date(bot.createdAt).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <CreateBotWizard onClose={() => setShowCreate(false)} onCreated={refresh} />
      </Dialog>
    </div>
  );
}
