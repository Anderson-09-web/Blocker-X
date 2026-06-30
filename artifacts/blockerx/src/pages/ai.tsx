import { useState, useRef, useEffect } from "react";
import { useAiChat, useGetAIUsage, useListBots, useListFiles, useWriteFile, useUploadFile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, Cpu, FolderCode, FileCode, CheckCircle, Loader2, ExternalLink, FilePlus, X } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function MarkdownBlock({ content }: { content: string }) {
  const lines = content.split("\n");
  const result: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      result.push(
        <div key={key++} className="my-3 rounded-lg overflow-hidden border border-border/40">
          {lang && (
            <div className="bg-black/40 px-3 py-1 text-xs text-muted-foreground font-mono border-b border-border/40 flex items-center gap-1.5">
              <FileCode className="w-3 h-3" />{lang}
            </div>
          )}
          <pre className="bg-black/30 px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre text-green-300 leading-relaxed">
            {codeLines.join("\n")}
          </pre>
        </div>
      );
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      result.push(<h3 key={key++} className="font-bold text-sm mt-3 mb-1 text-primary">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      result.push(<h2 key={key++} className="font-bold text-base mt-4 mb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      result.push(<h1 key={key++} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      result.push(
        <div key={key++} className="flex gap-2 my-0.5">
          <span className="text-primary mt-0.5">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (line.match(/^\d+\. /)) {
      const num = line.match(/^(\d+)\. /)?.[1];
      result.push(
        <div key={key++} className="flex gap-2 my-0.5">
          <span className="text-primary font-mono text-xs mt-0.5 w-4 text-right">{num}.</span>
          <span>{renderInline(line.replace(/^\d+\. /, ""))}</span>
        </div>
      );
    } else if (line.trim() === "") {
      result.push(<div key={key++} className="h-2" />);
    } else {
      result.push(<p key={key++} className="my-0.5 leading-relaxed">{renderInline(line)}</p>);
    }
    i++;
  }

  return <div className="text-sm space-y-0.5">{result}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={i} className="bg-black/30 px-1.5 py-0.5 rounded text-green-300 font-mono text-xs">{part.slice(1, -1)}</code>;
    }
    return <span key={i}>{part}</span>;
  });
}

function extractCodeBlocks(content: string): { lang: string; code: string }[] {
  const blocks: { lang: string; code: string }[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push({ lang: match[1], code: match[2] });
  }
  return blocks;
}

export default function AiPage() {
  const { data: usage } = useGetAIUsage();
  const { data: bots } = useListBots();
  const aiChat = useAiChat();
  const writeFile = useWriteFile();
  const uploadFile = useUploadFile();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState("python");
  const [selectedBotId, setSelectedBotId] = useState<string>("none");
  const [selectedFilePath, setSelectedFilePath] = useState<string>("none");
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const [creatingFileFor, setCreatingFileFor] = useState<{ msgIdx: number; code: string } | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeBotId = selectedBotId !== "none" ? selectedBotId : null;
  const selectedBot = (bots as any[])?.find((b: any) => b.id === selectedBotId);
  const { data: fileList, refetch: refetchFiles } = useListFiles(activeBotId || "", {}, {
    query: { enabled: !!activeBotId }
  });
  const allFiles = (fileList as any[])?.filter((f: any) => f.type === "file") || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedBot) setLanguage(selectedBot.language === "python" ? "python" : "javascript");
  }, [selectedBotId]);

  const handleSend = () => {
    if (!input.trim() || aiChat.isPending) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInput("");

    aiChat.mutate({
      data: {
        message: userMsg,
        language: language as any,
        botId: selectedBotId !== "none" ? selectedBotId : undefined,
        filePath: selectedFilePath !== "none" ? selectedFilePath : undefined,
      } as any
    }, {
      onSuccess: (data: any) => {
        setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
        qc.invalidateQueries({ queryKey: ["getAIUsage"] });
      },
      onError: (err: any) => {
        const msg = err?.data?.error || err?.message || "Failed to get AI response";
        setMessages(prev => [...prev, { role: "assistant", content: `❌ ${msg}` }]);
        toast({ title: msg, variant: "destructive" });
      },
    });
  };

  const applyCodeToFile = async (code: string, msgIdx: number) => {
    if (selectedFilePath === "none" || !selectedBotId || selectedBotId === "none") {
      toast({ title: "Selecciona un archivo del bot primero o usa 'Crear archivo'", variant: "destructive" });
      return;
    }
    setApplyingIdx(msgIdx);
    writeFile.mutate({ botId: selectedBotId, data: { path: selectedFilePath, content: code } }, {
      onSuccess: () => {
        toast({ title: "Codigo aplicado", description: `Guardado en ${selectedFilePath.split("/").pop()}` });
        setApplyingIdx(null);
      },
      onError: () => {
        toast({ title: "Error al guardar", variant: "destructive" });
        setApplyingIdx(null);
      },
    });
  };

  const handleCreateFileFromAI = (code: string, msgIdx: number) => {
    if (!activeBotId) {
      toast({ title: "Selecciona un proyecto primero", variant: "destructive" });
      return;
    }
    setCreatingFileFor({ msgIdx, code });
    setNewFileName(language === "python" ? "nuevo_archivo.py" : "nuevo_archivo.js");
  };

  const confirmCreateFile = () => {
    if (!creatingFileFor || !newFileName.trim() || !activeBotId) return;
    uploadFile.mutate({
      botId: activeBotId,
      data: { path: "/", name: newFileName.trim(), content: creatingFileFor.code, encoding: "utf-8" }
    }, {
      onSuccess: () => {
        toast({ title: "Archivo creado", description: newFileName.trim() });
        refetchFiles();
        setCreatingFileFor(null);
        setNewFileName("");
      },
      onError: () => toast({ title: "Error al crear archivo", variant: "destructive" }),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const usageCount = (usage as any)?.count || 0;
  const usageLimit = (usage as any)?.limit;
  const remaining = usageLimit ? usageLimit - usageCount : null;

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IA para Bots</h1>
          <p className="text-muted-foreground mt-1">Tu asistente para construir y arreglar bots de Discord</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm text-muted-foreground bg-accent/30 border border-border/40 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-primary" />
            {usageLimit ? `${usageCount}/${usageLimit} hoy` : `${usageCount} hoy`}
          </div>
        </div>
      </div>

      {/* Create file dialog */}
      {creatingFileFor && (
        <div className="bg-card/80 border border-primary/30 rounded-lg p-4 flex items-start gap-3">
          <FilePlus className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">Crear archivo con este código</p>
            <div className="flex gap-2">
              <Input value={newFileName} onChange={e => setNewFileName(e.target.value)}
                placeholder="nombre_archivo.py" className="font-mono text-sm flex-1"
                onKeyDown={e => e.key === "Enter" && confirmCreateFile()} autoFocus />
              <Button size="sm" onClick={confirmCreateFile} disabled={!newFileName.trim() || uploadFile.isPending}>
                {uploadFile.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}Crear
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setCreatingFileFor(null); setNewFileName(""); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5"><FolderCode className="w-3 h-3" />Proyecto</label>
          <Select value={selectedBotId} onValueChange={v => { setSelectedBotId(v); setSelectedFilePath("none"); }}>
            <SelectTrigger className="bg-card/60 border-border/40 text-sm h-9">
              <SelectValue placeholder="Ninguno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin proyecto</SelectItem>
              {(bots as any[])?.map((bot: any) => (
                <SelectItem key={bot.id} value={bot.id}>{bot.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5"><FileCode className="w-3 h-3" />Archivo (contexto + aplicar)</label>
          <Select value={selectedFilePath} onValueChange={setSelectedFilePath} disabled={selectedBotId === "none"}>
            <SelectTrigger className="bg-card/60 border-border/40 text-sm h-9">
              <SelectValue placeholder="Ninguno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ningún archivo</SelectItem>
              {allFiles.map((f: any) => (
                <SelectItem key={f.path} value={f.path}>{f.path.split("/").pop()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Lenguaje</label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="bg-card/60 border-border/40 text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="python">Python (discord.py)</SelectItem>
              <SelectItem value="javascript">JavaScript (discord.js)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedBotId !== "none" && selectedBot && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5 text-sm flex items-center gap-2 flex-wrap">
          <Bot className="w-4 h-4 text-primary shrink-0" />
          <span>Configurando <strong>{selectedBot.name}</strong></span>
          {selectedFilePath !== "none" && (
            <span className="text-muted-foreground">· archivo: <code className="bg-black/20 px-1.5 rounded text-xs font-mono text-green-300">{selectedFilePath.split("/").pop()}</code></span>
          )}
          <a href={`/bots/${selectedBotId}`} className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
            Ver proyecto <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {remaining !== null && remaining <= 2 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-sm text-yellow-400">
          {remaining === 0
            ? "Límite diario alcanzado. Actualiza a Premium para IA ilimitada."
            : `${remaining} uso${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"} hoy en el plan gratuito.`}
        </div>
      )}

      <Card className="flex-1 bg-card/60 border-border/40 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: "300px", maxHeight: "55vh" }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Bot className="w-7 h-7 text-primary" />
              </div>
              <div className="text-center max-w-sm">
                <p className="font-medium">Asistente IA para Discord Bots</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedBotId !== "none"
                    ? `Pregunta sobre ${selectedBot?.name}. Puedo leer y escribir archivos del bot directamente.`
                    : "Selecciona un proyecto arriba para que pueda leer y modificar tus archivos, o pregunta en general sobre bots."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {["¿Cómo agrego un comando slash?", "Crea un sistema de bienvenida", "¿Cómo agrego música?", "Arregla los errores del bot"].map(s => (
                    <button key={s} onClick={() => setInput(s)} className="text-xs bg-accent/40 border border-border/40 rounded-full px-3 py-1 hover:bg-accent/60 transition-colors">{s}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const codeBlocks = msg.role === "assistant" ? extractCodeBlocks(msg.content) : [];
            return (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-accent/30 text-foreground border border-border/40 rounded-bl-sm"
                }`}>
                  {msg.role === "assistant"
                    ? <MarkdownBlock content={msg.content} />
                    : <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  }
                  {msg.role === "assistant" && codeBlocks.length > 0 && activeBotId && (
                    <div className="mt-3 pt-3 border-t border-border/30 flex flex-wrap gap-2">
                      {codeBlocks.map((block, ci) => (
                        <div key={ci} className="flex gap-1.5 flex-wrap">
                          {selectedFilePath !== "none" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                              disabled={applyingIdx === i}
                              onClick={() => applyCodeToFile(block.code, i)}
                            >
                              {applyingIdx === i
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <CheckCircle className="w-3 h-3" />}
                              Aplicar{codeBlocks.length > 1 ? ` #${ci + 1}` : ""} → {selectedFilePath.split("/").pop()}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5 border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/40"
                            onClick={() => handleCreateFileFromAI(block.code, i)}
                          >
                            <FilePlus className="w-3 h-3" />
                            Crear archivo{codeBlocks.length > 1 ? ` #${ci + 1}` : ""}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {aiChat.isPending && (
            <div className="flex justify-start">
              <div className="bg-accent/30 border border-border/40 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </CardContent>

        <div className="border-t border-border/40 p-4">
          <div className="flex gap-3">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedBotId !== "none"
                  ? `Pregunta sobre ${selectedBot?.name}... (ej: "agrega un sistema de economía", "arregla el error de permisos")`
                  : "Pregunta sobre comandos, eventos, slash commands, permisos..."
              }
              className="resize-none bg-background/50 border-border/40 text-sm"
              rows={2}
              disabled={remaining === 0}
            />
            <Button
              onClick={handleSend}
              disabled={aiChat.isPending || !input.trim() || remaining === 0}
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Enter para enviar · Shift+Enter para nueva línea</p>
        </div>
      </Card>
    </div>
  );
}
