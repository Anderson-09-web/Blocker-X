import { useState, useEffect } from "react";
import { useParams } from "wouter";
import {
  useGetBot, useListFiles, useGetBotLogs, useListEnvVars, useSetEnvVar, useDeleteEnvVar,
  useReadFile, useWriteFile, useDeployBot, useListDeployments, useStartBot, useStopBot,
  useRestartBot, useUpdateBot,
  getGetBotQueryKey, getListFilesQueryKey, getGetBotLogsQueryKey, getListEnvVarsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Play, Square, RotateCcw, Rocket, Plus, Trash2, Save, Folder, FileText, ChevronLeft, Settings } from "lucide-react";
import { Link } from "wouter";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    running: "bg-green-500/15 text-green-400 border-green-500/20",
    stopped: "bg-gray-500/15 text-gray-400 border-gray-500/20",
    errored: "bg-red-500/15 text-red-400 border-red-500/20",
    deploying: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    starting: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${map[status] || map.stopped}`}>{status}</span>;
}

function LogLevelBadge({ level }: { level: string }) {
  const map: Record<string, string> = { error: "text-red-400", warn: "text-yellow-400", info: "text-blue-400", debug: "text-gray-400" };
  return <span className={`font-mono text-xs ${map[level] || "text-gray-400"}`}>[{level}]</span>;
}

const BOT_STATUSES = [
  { value: "online", label: "🟢 Online" },
  { value: "idle", label: "🌙 Idle" },
  { value: "dnd", label: "🔴 Do Not Disturb" },
  { value: "invisible", label: "⚫ Invisible" },
];

export default function BotDetailPage() {
  const { botId } = useParams<{ botId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: bot, isLoading } = useGetBot(botId, { query: { queryKey: getGetBotQueryKey(botId) } });
  const { data: files } = useListFiles(botId, {}, { query: { queryKey: getListFilesQueryKey(botId) } });
  const { data: logs } = useGetBotLogs(botId, {}, { query: { queryKey: getGetBotLogsQueryKey(botId), refetchInterval: 3000 } });
  const { data: envVars } = useListEnvVars(botId, { query: { queryKey: getListEnvVarsQueryKey(botId) } });
  const { data: deployments } = useListDeployments();

  const startBot = useStartBot();
  const stopBot = useStopBot();
  const restartBot = useRestartBot();
  const deployBot = useDeployBot();
  const updateBot = useUpdateBot();
  const setEnvVar = useSetEnvVar();
  const deleteEnvVar = useDeleteEnvVar();
  const writeFile = useWriteFile();

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvVal, setNewEnvVal] = useState("");

  // Settings form state
  const [settingsName, setSettingsName] = useState("");
  const [settingsDesc, setSettingsDesc] = useState("");
  const [settingsAvatar, setSettingsAvatar] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("online");

  const { data: fileData } = useReadFile(botId, { filePath: selectedFile! }, {
    query: { enabled: !!selectedFile, queryKey: ["readFile", botId, selectedFile] }
  });

  useEffect(() => {
    if (fileData?.content !== undefined) setFileContent(fileData.content);
  }, [fileData]);

  // Sync settings form when bot loads
  useEffect(() => {
    if (bot) {
      setSettingsName((bot as any).name || "");
      setSettingsDesc((bot as any).description || "");
    }
  }, [bot]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getGetBotQueryKey(botId) });
    qc.invalidateQueries({ queryKey: getGetBotLogsQueryKey(botId) });
  };

  const botDeployments = (deployments as any[])?.filter((d: any) => d.botId === botId) || [];

  const handleAction = (action: "start" | "stop" | "restart") => {
    const fns = { start: startBot, stop: stopBot, restart: restartBot };
    (fns[action] as any).mutate({ botId }, {
      onSuccess: () => { refresh(); toast({ title: `Bot ${action}ed` }); },
      onError: () => toast({ title: `Failed to ${action}`, variant: "destructive" }),
    });
  };

  const handleDeploy = () => {
    deployBot.mutate({ botId }, {
      onSuccess: () => { refresh(); toast({ title: "Deployment started" }); },
      onError: () => toast({ title: "Deploy failed", variant: "destructive" }),
    });
  };

  const handleSaveFile = () => {
    if (!selectedFile) return;
    writeFile.mutate({ botId, data: { path: selectedFile, content: fileContent } }, {
      onSuccess: () => toast({ title: "File saved" }),
      onError: () => toast({ title: "Save failed", variant: "destructive" }),
    });
  };

  const handleAddEnv = () => {
    if (!newEnvKey) return;
    setEnvVar.mutate({ botId, data: { key: newEnvKey, value: newEnvVal } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListEnvVarsQueryKey(botId) });
        setNewEnvKey(""); setNewEnvVal("");
        toast({ title: "Variable saved" });
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    });
  };

  const handleSaveSettings = () => {
    const updates: any = {};
    if (settingsName.trim()) updates.name = settingsName.trim();
    if (settingsDesc !== undefined) updates.description = settingsDesc;

    updateBot.mutate({ botId, data: updates }, {
      onSuccess: async () => {
        // Save avatar URL and status as env vars if provided
        const envPromises = [];
        if (settingsAvatar.trim()) {
          envPromises.push(
            new Promise<void>((resolve) =>
              setEnvVar.mutate({ botId, data: { key: "BOT_AVATAR_URL", value: settingsAvatar.trim() } }, { onSuccess: () => resolve(), onError: () => resolve() })
            )
          );
        }
        if (settingsStatus) {
          envPromises.push(
            new Promise<void>((resolve) =>
              setEnvVar.mutate({ botId, data: { key: "BOT_STATUS", value: settingsStatus } }, { onSuccess: () => resolve(), onError: () => resolve() })
            )
          );
        }
        await Promise.all(envPromises);
        refresh();
        qc.invalidateQueries({ queryKey: getListEnvVarsQueryKey(botId) });
        toast({ title: "Settings saved" });
      },
      onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!bot) return <div className="text-muted-foreground">Bot not found.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Link href="/bots">
          <Button variant="ghost" size="sm" className="gap-2 self-start">
            <ChevronLeft className="w-4 h-4" /> Bots
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold truncate">{(bot as any).name}</h1>
            <StatusBadge status={(bot as any).status} />
            <span className="text-sm text-muted-foreground">{(bot as any).language === "python" ? "Python" : "JavaScript"}</span>
          </div>
          {(bot as any).description && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{(bot as any).description}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(bot as any).status !== "running" && <Button size="sm" onClick={() => handleAction("start")}><Play className="w-3 h-3 mr-1" />Start</Button>}
          {(bot as any).status === "running" && <Button size="sm" variant="outline" onClick={() => handleAction("stop")}><Square className="w-3 h-3 mr-1" />Stop</Button>}
          <Button size="sm" variant="outline" onClick={() => handleAction("restart")}><RotateCcw className="w-3 h-3 mr-1" />Restart</Button>
          <Button size="sm" onClick={handleDeploy} disabled={deployBot.isPending}><Rocket className="w-3 h-3 mr-1" />Deploy</Button>
        </div>
      </div>

      <Tabs defaultValue="files">
        <TabsList className="bg-card/60 border border-border/40 w-full md:w-auto flex overflow-x-auto">
          <TabsTrigger value="files" className="flex-1 md:flex-none">Files</TabsTrigger>
          <TabsTrigger value="env" className="flex-1 md:flex-none">Environment</TabsTrigger>
          <TabsTrigger value="logs" className="flex-1 md:flex-none">Logs</TabsTrigger>
          <TabsTrigger value="deployments" className="flex-1 md:flex-none">Deployments</TabsTrigger>
          <TabsTrigger value="settings" className="flex-1 md:flex-none"><Settings className="w-3.5 h-3.5 mr-1" />Settings</TabsTrigger>
        </TabsList>

        {/* Files */}
        <TabsContent value="files" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card/60 border-border/40">
              <CardHeader className="pb-2"><CardTitle className="text-sm">File Explorer</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="min-h-48 divide-y divide-border/30">
                  {(!files || (files as any[]).length === 0) && (
                    <p className="text-xs text-muted-foreground p-4 text-center">No files yet. Deploy your bot to upload files.</p>
                  )}
                  {(files as any[])?.map((f: any) => (
                    <button key={f.path} onClick={() => { setSelectedFile(f.path); setFileContent(""); }}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent/30 transition-colors text-left ${selectedFile === f.path ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                      {f.type === "directory" ? <Folder className="w-3.5 h-3.5 shrink-0" /> : <FileText className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="md:col-span-2 bg-card/60 border-border/40">
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <CardTitle className="text-sm">{selectedFile ? selectedFile.split("/").pop() : "Select a file"}</CardTitle>
                {selectedFile && <Button size="sm" onClick={handleSaveFile} disabled={writeFile.isPending}><Save className="w-3 h-3 mr-1" />Save</Button>}
              </CardHeader>
              <CardContent>
                {selectedFile ? (
                  <textarea
                    value={fileContent}
                    onChange={e => setFileContent(e.target.value)}
                    className="w-full h-72 md:h-80 font-mono text-sm bg-background/50 border border-border/40 rounded-md p-3 resize-none focus:outline-none focus:border-primary/40"
                    spellCheck={false}
                  />
                ) : (
                  <div className="h-72 md:h-80 flex items-center justify-center text-muted-foreground text-sm">
                    Select a file to edit
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Environment */}
        <TabsContent value="env" className="mt-4">
          <Card className="bg-card/60 border-border/40">
            <CardHeader><CardTitle className="text-sm">Environment Variables</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-col sm:flex-row">
                <Input value={newEnvKey} onChange={e => setNewEnvKey(e.target.value)} placeholder="KEY" className="font-mono text-sm" />
                <Input value={newEnvVal} onChange={e => setNewEnvVal(e.target.value)} placeholder="VALUE" type="password" className="font-mono text-sm" />
                <Button onClick={handleAddEnv} disabled={!newEnvKey}><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="divide-y divide-border/30 rounded-md border border-border/40 overflow-hidden">
                {(!envVars || (envVars as any[]).length === 0) && (
                  <p className="text-sm text-muted-foreground p-4 text-center">No environment variables set.</p>
                )}
                {(envVars as any[])?.map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm font-medium">{v.key}</span>
                      <span className="font-mono text-xs text-muted-foreground">{"•".repeat(8)}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                      onClick={() => deleteEnvVar.mutate({ botId, varId: v.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListEnvVarsQueryKey(botId) }) })}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs" className="mt-4">
          <Card className="bg-card/60 border-border/40">
            <CardHeader><CardTitle className="text-sm font-medium">Console Output</CardTitle></CardHeader>
            <CardContent>
              <div className="h-96 overflow-y-auto font-mono text-xs space-y-1 bg-background/40 rounded-md p-4 border border-border/30">
                {(!logs || (logs as any[]).length === 0) && (
                  <p className="text-muted-foreground text-center py-8">No logs yet. Start your bot to see output.</p>
                )}
                {(logs as any[])?.map((l: any) => (
                  <div key={l.id} className="flex items-start gap-3">
                    <span className="text-muted-foreground shrink-0 text-[10px] pt-0.5">{new Date(l.timestamp).toLocaleTimeString()}</span>
                    <LogLevelBadge level={l.level} />
                    <span className="text-foreground/80 break-all">{l.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deployments */}
        <TabsContent value="deployments" className="mt-4">
          <Card className="bg-card/60 border-border/40">
            <CardHeader><CardTitle className="text-sm">Deployment History</CardTitle></CardHeader>
            <CardContent>
              <div className="divide-y divide-border/30">
                {botDeployments.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No deployments yet.</p>}
                {botDeployments.map((d: any) => (
                  <div key={d.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{new Date(d.startedAt).toLocaleString()}</p>
                      {d.errorMessage && <p className="text-xs text-destructive mt-0.5">{d.errorMessage}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      d.status === "success" ? "bg-green-500/15 text-green-400 border-green-500/20" :
                      d.status === "failed" ? "bg-red-500/15 text-red-400 border-red-500/20" :
                      "bg-blue-500/15 text-blue-400 border-blue-500/20"
                    }`}>{d.status}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-card/60 border-border/40">
              <CardHeader><CardTitle className="text-sm">Bot Profile</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-muted border border-border/40 overflow-hidden shrink-0">
                    {settingsAvatar ? (
                      <img src={settingsAvatar} alt="Bot avatar" className="w-full h-full object-cover"
                        onError={() => setSettingsAvatar("")} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                        {settingsName.charAt(0) || (bot as any).name?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{settingsName || (bot as any).name}</p>
                    <p className="text-xs text-muted-foreground">{(bot as any).language === "python" ? "Python" : "JavaScript"} bot</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="bot-name">Bot Name</Label>
                  <Input id="bot-name" value={settingsName} onChange={e => setSettingsName(e.target.value)}
                    placeholder={(bot as any).name} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="bot-desc">Description</Label>
                  <Textarea id="bot-desc" value={settingsDesc} onChange={e => setSettingsDesc(e.target.value)}
                    placeholder="What does your bot do?" className="mt-1 resize-none h-20" />
                </div>
                <div>
                  <Label htmlFor="bot-avatar">Avatar URL</Label>
                  <Input id="bot-avatar" value={settingsAvatar} onChange={e => setSettingsAvatar(e.target.value)}
                    placeholder="https://example.com/avatar.png" className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">Saved as BOT_AVATAR_URL env var — use it in your bot code</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border/40">
              <CardHeader><CardTitle className="text-sm">Presence & Status</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Choose a default status. Saved as <code className="bg-muted px-1 rounded">BOT_STATUS</code> env var — read it in your bot code to set the presence.
                </p>
                <div className="space-y-2">
                  {BOT_STATUSES.map(s => (
                    <button key={s.value} onClick={() => setSettingsStatus(s.value)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md border text-sm font-medium transition-colors ${
                        settingsStatus === s.value
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border/40 text-muted-foreground hover:bg-accent/30"
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="p-3 bg-muted/30 rounded-md border border-border/30 text-xs text-muted-foreground font-mono">
                  <p className="font-semibold text-foreground/60 mb-1"># Example usage in your bot:</p>
                  {(bot as any).language === "python" ? (
                    <>
                      <p>import os, discord</p>
                      <p>status = os.getenv("BOT_STATUS", "online")</p>
                      <p>activity = discord.Activity(type=discord.ActivityType.playing, name="Blocker X")</p>
                    </>
                  ) : (
                    <>
                      <p>const status = process.env.BOT_STATUS || 'online'</p>
                      <p>client.user.setPresence({"{ status }"});</p>
                    </>
                  )}
                </div>

                <Button onClick={handleSaveSettings} disabled={updateBot.isPending} className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  {updateBot.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
