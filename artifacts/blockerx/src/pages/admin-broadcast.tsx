import { useState, startTransition } from "react";
import { useBroadcastAnnouncement } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Megaphone } from "lucide-react";

export default function AdminBroadcastPage() {
  const broadcast = useBroadcastAnnouncement();
  const { toast } = useToast();
  const [form, setForm] = useState({ title: "", message: "", type: "announcement" });

  const handleSend = () => {
    if (!form.title || !form.message) return;
    broadcast.mutate({ data: { title: form.title, message: form.message, type: form.type } as any }, {
      onSuccess: (data: any) => {
        toast({ title: data.message || "Announcement sent" });
        setForm({ title: "", message: "", type: "announcement" });
      },
      onError: () => toast({ title: "Failed to send announcement", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Broadcast</h1>
        <p className="text-muted-foreground mt-1">Send announcements to all platform users</p>
      </div>

      <Card className="bg-card/60 border-border/40">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Megaphone className="w-4 h-4" /> New Announcement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="bc-title">Title</Label>
            <Input id="bc-title" value={form.title} onChange={e => setForm(f=>({...f, title: e.target.value}))}
              placeholder="Platform maintenance scheduled..." className="mt-1" data-testid="input-broadcast-title" />
          </div>
          <div>
            <Label htmlFor="bc-message">Message</Label>
            <Textarea id="bc-message" value={form.message} onChange={e => setForm(f=>({...f, message: e.target.value}))}
              placeholder="Detailed announcement..." rows={4} className="mt-1 resize-none" data-testid="textarea-broadcast-message" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={form.type} onValueChange={v => { startTransition(() => setForm(f=>({...f, type: v}))); }}>
              <SelectTrigger className="mt-1" data-testid="select-broadcast-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="announcement">Announcement</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="success">Success</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">This will send a notification to all registered users.</p>
            <Button onClick={handleSend} disabled={broadcast.isPending || !form.title || !form.message} data-testid="button-send-broadcast">
              {broadcast.isPending ? "Sending..." : "Send Broadcast"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
