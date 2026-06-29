import { useState } from "react";
import { useListBots, useCreateBot, useStartBot, useStopBot, useRestartBot, useDeleteBot, getListBotsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Plus, Play, Square, RotateCcw, Trash2, ExternalLink, TerminalSquare } from "lucide-react";

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

export default function BotsPage() {
  const { data: bots, isLoading } = useListBots();
  const createBot = useCreateBot();
  const startBot = useStartBot();
  const stopBot = useStopBot();
  const restartBot = useRestartBot();
  const deleteBot = useDeleteBot();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", language: "python" });

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });

  const handleCreate = () => {
    if (!form.name) return;
    createBot.mutate({ data: { name: form.name, description: form.description, language: form.language as any } }, {
      onSuccess: () => { setShowCreate(false); setForm({ name: "", description: "", language: "python" }); refresh(); toast({ title: "Bot created" }); },
      onError: () => toast({ title: "Failed to create bot", variant: "destructive" }),
    });
  };

  const handleAction = (action: "start" | "stop" | "restart" | "delete", botId: string, name: string) => {
    const fns = { start: startBot, stop: stopBot, restart: restartBot, delete: deleteBot };
    (fns[action] as any).mutate({ botId }, {
      onSuccess: () => { refresh(); toast({ title: `Bot ${action}ed` }); },
      onError: () => toast({ title: `Failed to ${action} bot`, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Bots</h1>
          <p className="text-muted-foreground mt-1">Manage and deploy your Discord bots</p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-bot">
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
            <Card key={bot.id} data-testid={`card-bot-${bot.id}`} className="bg-card/60 border-border/50 hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold truncate">{bot.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{bot.language === "python" ? "Python" : "JavaScript"}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusBadge(bot.status)}`}>
                    {bot.status}
                  </span>
                </div>
                {bot.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{bot.description}</p>}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {bot.status !== "running" && bot.status !== "starting" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAction("start", bot.id, bot.name)} data-testid={`button-start-${bot.id}`}>
                      <Play className="w-3 h-3 mr-1" /> Start
                    </Button>
                  )}
                  {(bot.status === "running" || bot.status === "starting") && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAction("stop", bot.id, bot.name)} data-testid={`button-stop-${bot.id}`}>
                      <Square className="w-3 h-3 mr-1" /> Stop
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAction("restart", bot.id, bot.name)} data-testid={`button-restart-${bot.id}`}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Restart
                  </Button>
                  <Link href={`/bots/${bot.id}`}>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" data-testid={`link-bot-${bot.id}`}>
                      <ExternalLink className="w-3 h-3 mr-1" /> Manage
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:bg-destructive/10" onClick={() => handleAction("delete", bot.id, bot.name)} data-testid={`button-delete-${bot.id}`}>
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
        <DialogContent className="bg-card border-border/60">
          <DialogHeader>
            <DialogTitle>Create New Bot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bot-name">Bot Name</Label>
              <Input id="bot-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My Awesome Bot" className="mt-1" data-testid="input-bot-name" />
            </div>
            <div>
              <Label htmlFor="bot-desc">Description (optional)</Label>
              <Input id="bot-desc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this bot do?" className="mt-1" data-testid="input-bot-description" />
            </div>
            <div>
              <Label>Language</Label>
              <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-bot-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="python">Python (discord.py)</SelectItem>
                  <SelectItem value="javascript">JavaScript (discord.js)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createBot.isPending || !form.name} data-testid="button-submit-create-bot">
              {createBot.isPending ? "Creating..." : "Create Bot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
