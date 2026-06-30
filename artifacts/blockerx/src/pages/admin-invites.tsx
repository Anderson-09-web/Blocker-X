import { useState } from "react";
import { useListInviteCodes, useCreateInviteCode, useDeleteInviteCode, useToggleInviteCode, getListInviteCodesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Copy, Trash2, ToggleLeft, ToggleRight, KeyRound, Crown } from "lucide-react";

type DialogMode = "invite" | "premium" | null;

export default function AdminInvitesPage() {
  const { data: codes, isLoading } = useListInviteCodes();
  const createInvite = useCreateInviteCode();
  const deleteInvite = useDeleteInviteCode();
  const toggleInvite = useToggleInviteCode();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [form, setForm] = useState({ maxUses: "", customCode: "" });

  const refresh = () => qc.invalidateQueries({ queryKey: getListInviteCodesQueryKey() });

  const openDialog = (mode: DialogMode) => {
    setForm({ maxUses: "", customCode: "" });
    setDialogMode(mode);
  };

  const handleCreate = () => {
    const grantsPremium = dialogMode === "premium";
    createInvite.mutate({
      data: {
        maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
        customCode: form.customCode || undefined,
        grantsPremium,
      } as any
    }, {
      onSuccess: () => {
        refresh();
        setDialogMode(null);
        toast({ title: grantsPremium ? "Premium key created" : "Invite code created" });
      },
      onError: () => toast({ title: "Failed to create", variant: "destructive" }),
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied to clipboard" });
  };

  const isPremiumMode = dialogMode === "premium";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invite Codes</h1>
          <p className="text-muted-foreground mt-1">Manage platform access and premium keys</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openDialog("invite")} data-testid="button-create-invite">
            <Plus className="w-4 h-4 mr-2" /> Create Invite Code
          </Button>
          <Button onClick={() => openDialog("premium")} className="bg-yellow-500 hover:bg-yellow-600 text-black" data-testid="button-create-premium">
            <Crown className="w-4 h-4 mr-2" /> Create Premium Key
          </Button>
        </div>
      </div>

      <Card className="bg-card/60 border-border/40">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-14 w-full"/>)}</div>
          ) : !(codes as any[])?.length ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <KeyRound className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No invite codes yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {(codes as any[])?.map((c: any) => (
                <div key={c.id} className="flex items-center gap-4 px-4 md:px-6 py-4" data-testid={`row-invite-${c.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-mono font-bold text-primary text-sm">{c.code}</code>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyCode(c.code)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${c.isActive ? "bg-green-500/15 text-green-400 border-green-500/20" : "bg-gray-500/15 text-gray-400 border-gray-500/20"}`}>
                        {c.isActive ? "Active" : "Disabled"}
                      </span>
                      {c.grantsPremium && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full border bg-yellow-500/15 text-yellow-400 border-yellow-500/20 flex items-center gap-1">
                          <Crown className="w-2.5 h-2.5" /> Premium
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.usesCount}{c.maxUses ? `/${c.maxUses}` : ""} uses
                      {c.expiresAt ? ` · Expires ${new Date(c.expiresAt).toLocaleDateString()}` : ""}
                      · Created {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title={c.isActive ? "Disable" : "Enable"}
                      onClick={() => toggleInvite.mutate({ inviteId: c.id }, { onSuccess: refresh })}>
                      {c.isActive ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteInvite.mutate({ inviteId: c.id }, { onSuccess: refresh })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!dialogMode} onOpenChange={open => { if (!open) setDialogMode(null); }}>
        <DialogContent className="bg-card border-border/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isPremiumMode ? <Crown className="w-4 h-4 text-yellow-400" /> : <KeyRound className="w-4 h-4" />}
              {isPremiumMode ? "Create Premium Key" : "Create Invite Code"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isPremiumMode && (
              <div className="p-3 rounded-md border border-yellow-500/20 bg-yellow-500/5 text-sm text-yellow-300">
                When redeemed, this code will automatically upgrade the user to Premium.
              </div>
            )}
            <div>
              <Label htmlFor="custom-code">Custom Code (optional)</Label>
              <Input id="custom-code" value={form.customCode} onChange={e => setForm(f=>({...f, customCode: e.target.value}))}
                placeholder="Leave blank to auto-generate" className="mt-1 font-mono uppercase" data-testid="input-custom-code" />
            </div>
            <div>
              <Label htmlFor="max-uses">Max Uses (optional)</Label>
              <Input id="max-uses" type="number" value={form.maxUses} onChange={e => setForm(f=>({...f, maxUses: e.target.value}))}
                placeholder="Unlimited" className="mt-1" data-testid="input-max-uses" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createInvite.isPending} data-testid="button-submit-invite"
              className={isPremiumMode ? "bg-yellow-500 hover:bg-yellow-600 text-black" : ""}>
              {createInvite.isPending ? "Creating..." : isPremiumMode ? "Create Premium Key" : "Create Invite Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
