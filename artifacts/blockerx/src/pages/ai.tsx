import { useState, useRef, useEffect } from "react";
import { useAiChat, useGetAIUsage } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AiPage() {
  const { data: usage } = useGetAIUsage();
  const aiChat = useAiChat();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState("python");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || aiChat.isPending) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInput("");

    aiChat.mutate({ data: { message: userMsg, language: language as any } }, {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const usageCount = (usage as any)?.count || 0;
  const usageLimit = (usage as any)?.limit;
  const remaining = usageLimit ? usageLimit - usageCount : null;

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
          <p className="text-muted-foreground mt-1">Get help building and debugging your Discord bots</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-36" data-testid="select-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">
            {usageLimit ? `${usageCount}/${usageLimit} requests` : `${usageCount} requests`}
          </div>
        </div>
      </div>

      {remaining !== null && remaining <= 2 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-sm text-yellow-400">
          {remaining === 0 ? "AI usage limit reached. Upgrade to Premium for unlimited requests." : `${remaining} request${remaining === 1 ? "" : "s"} remaining on free plan.`}
        </div>
      )}

      <Card className="flex-1 bg-card/60 border-border/40 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: "400px", maxHeight: "60vh" }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Bot className="w-7 h-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium">Discord Bot AI</p>
                <p className="text-sm text-muted-foreground mt-1">Ask anything about building Discord bots with {language === "python" ? "discord.py" : "discord.js"}</p>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`msg-${msg.role}-${i}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-accent/40 text-foreground border border-border/40 rounded-bl-sm"
              }`}>
                <pre className="whitespace-pre-wrap font-sans break-words">{msg.content}</pre>
              </div>
            </div>
          ))}
          {aiChat.isPending && (
            <div className="flex justify-start">
              <div className="bg-accent/40 border border-border/40 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
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
              placeholder="Ask about commands, events, slash commands, permissions..."
              className="resize-none bg-background/50 border-border/40 text-sm"
              rows={2}
              disabled={remaining === 0}
              data-testid="textarea-ai-input"
            />
            <Button onClick={handleSend} disabled={aiChat.isPending || !input.trim() || remaining === 0} className="self-end" data-testid="button-send-ai">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Press Enter to send, Shift+Enter for new line</p>
        </div>
      </Card>
    </div>
  );
}
