import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type { Habit, TodayStack, TodayView } from "@shared/schema";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, queryKeys } from "@/lib/api";
import { localToday } from "@/lib/dates";
import { QUARK_COLORS } from "@/lib/colors";
import { cn } from "@/lib/utils";

export function StackBuilder({
  open,
  onOpenChange,
  editStack,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editStack: TodayStack | null;
}) {
  const today = localToday();
  const queryClient = useQueryClient();
  const { data: view } = useQuery<TodayView>({ queryKey: queryKeys.today(today) });

  const [name, setName] = useState("");
  const [anchor, setAnchor] = useState("");
  const [color, setColor] = useState("gold");
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(editStack?.name ?? "");
      setAnchor(editStack?.anchor ?? "");
      setColor(editStack?.color ?? "gold");
      setMemberIds(editStack ? editStack.habits.map((m) => m.habit.id) : []);
      setProblem(null);
      setConfirmDelete(false);
    }
  }, [open, editStack]);

  // Habits available to stack: currently unstacked ones + this stack's own.
  const candidates = useMemo<Habit[]>(() => {
    if (!view) return [];
    const own = editStack ? editStack.habits.map((m) => m.habit as Habit) : [];
    return [...view.habits.filter((h) => !h.pausedOn), ...own];
  }, [view, editStack]);

  const byId = useMemo(() => new Map(candidates.map((h) => [h.id, h])), [candidates]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.today(today) });
    queryClient.invalidateQueries({ queryKey: queryKeys.progress(today) });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (editStack) {
        await api.updateStack(editStack.id, { name: name.trim(), anchor: anchor.trim(), color });
        await api.setStackHabits(editStack.id, memberIds);
        return;
      }
      await api.createStack({ name: name.trim(), anchor: anchor.trim(), color }, memberIds);
    },
    onSuccess: () => {
      refresh();
      onOpenChange(false);
    },
    onError: (e) => setProblem(e instanceof Error ? e.message : "Couldn't save the stack."),
  });

  const removeStack = useMutation({
    mutationFn: () => api.deleteStack(editStack!.id),
    onSuccess: () => {
      refresh();
      setConfirmDelete(false);
      onOpenChange(false);
    },
  });

  const toggleMember = (id: number) => {
    setMemberIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  };

  const move = (index: number, by: -1 | 1) => {
    setMemberIds((ids) => {
      const next = [...ids];
      const target = index + by;
      if (target < 0 || target >= next.length) return ids;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const canSave = name.trim().length > 0 && anchor.trim().length > 0 && memberIds.length > 0;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent aria-describedby={undefined}>
          <DrawerHeader className="pb-3 text-left">
            <DrawerTitle>{editStack ? "Edit stack" : "Build a stack"}</DrawerTitle>
          </DrawerHeader>

          <div className="space-y-5 overflow-y-auto px-5">
            <div className="space-y-2">
              <Label htmlFor="stack-name">Name</Label>
              <Input
                id="stack-name"
                placeholder="Morning start"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stack-anchor">After I…</Label>
              <Input
                id="stack-anchor"
                placeholder="pour my morning coffee"
                value={anchor}
                onChange={(e) => setAnchor(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Pick a cue that already happens every day.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Habits in this stack</Label>
              {candidates.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Every habit is already in a stack. Free one up first.
                </p>
              )}
              <div className="space-y-1.5">
                {candidates.map((h) => {
                  const checked = memberIds.includes(h.id);
                  return (
                    <button
                      key={h.id}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => toggleMember(h.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                        checked
                          ? "border-primary bg-accent"
                          : "border-border bg-secondary/40 hover:bg-accent",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border",
                          checked ? "border-primary bg-primary" : "border-muted-foreground/50",
                        )}
                      >
                        {checked && <span className="h-2 w-2 rounded-sm bg-primary-foreground" />}
                      </span>
                      <span className="truncate">{h.name}</span>
                      <span className="ml-auto truncate text-xs text-muted-foreground">
                        {h.action}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {memberIds.length > 1 && (
              <div className="space-y-2">
                <Label>Chain order</Label>
                <div className="space-y-1.5">
                  {memberIds.map((id, i) => {
                    const habit = byId.get(id);
                    if (!habit) return null;
                    const prev = i === 0 ? null : byId.get(memberIds[i - 1]);
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2"
                      >
                        <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
                          After I{" "}
                          <span className="text-foreground">
                            {prev ? prev.action : anchor.trim() || "…"}
                          </span>
                          , I will{" "}
                          <span className="text-foreground">{habit.action}</span>
                        </p>
                        <button
                          type="button"
                          aria-label={`Move ${habit.name} up`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-accent disabled:opacity-30"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${habit.name} down`}
                          disabled={i === memberIds.length - 1}
                          onClick={() => move(i, 1)}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-accent disabled:opacity-30"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2.5">
                {QUARK_COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-label={c.label}
                    aria-pressed={color === c.key}
                    onClick={() => setColor(c.key)}
                    className={cn(
                      "h-8 w-8 cursor-pointer rounded-full transition-transform",
                      c.bg,
                      color === c.key && "scale-110 ring-2 ring-ring ring-offset-2 ring-offset-card",
                    )}
                  />
                ))}
              </div>
            </div>

            {problem && <p className="text-sm text-destructive">{problem}</p>}

            {editStack && (
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 /> Delete stack (habits stay)
              </Button>
            )}
          </div>

          <div
            className="flex gap-2 p-5"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
          >
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!canSave || save.isPending}
              onClick={() => save.mutate()}
            >
              {editStack ? "Save stack" : "Create stack"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{editStack?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The stack goes away; its habits return to the Today grid with all
              their history intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeStack.isPending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeStack.isPending}
              onClick={() => removeStack.mutate()}
            >
              Delete stack
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
