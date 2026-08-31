"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MessageSquare, X, ChevronLeft, Send } from "lucide-react";
import { loadConversationAction, sendMessageAction } from "./actions";
import type { ChatDriver, ChatMessage } from "@/lib/data/messages";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function ChatWidget({
  drivers,
  t,
  locale,
}: {
  drivers: ChatDriver[];
  t: Dictionary["chat"];
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = drivers.find((d) => d.id === activeId) ?? null;

  const timeFmt = new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dayFmt = new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", {
    day: "numeric",
    month: "short",
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, activeId]);

  function openConversation(id: string) {
    setActiveId(id);
    setMessages([]);
    setLoading(true);
    loadConversationAction(id)
      .then((m) => setMessages(m))
      .finally(() => setLoading(false));
  }

  function send() {
    const text = input.trim();
    if (!text || !activeId) return;
    setInput("");
    startTransition(async () => {
      const msg = await sendMessageAction(activeId, text);
      setMessages((cur) => [...cur, msg]);
    });
  }

  // ---- Launcher ----
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.open}
        className="bg-primary text-primary-foreground hover:bg-primary/90 fixed bottom-6 right-6 z-[1100] flex size-14 items-center justify-center rounded-full shadow-lg transition-colors"
      >
        <MessageSquare className="size-6" />
      </button>
    );
  }

  // ---- Panel ----
  return (
    <div className="bg-card fixed bottom-6 right-6 z-[1100] flex h-[520px] max-h-[80vh] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border shadow-2xl">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        {active && (
          <button
            type="button"
            onClick={() => setActiveId(null)}
            className="hover:bg-muted -ml-1 grid size-8 place-items-center rounded-md"
            aria-label={t.back}
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        <span className="flex-1 truncate text-sm font-semibold">{active ? active.name : t.title}</span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setActiveId(null);
          }}
          className="hover:bg-muted grid size-8 place-items-center rounded-md"
          aria-label={t.close}
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      {!active ? (
        // Driver list
        <div className="min-h-0 flex-1 overflow-y-auto">
          {drivers.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">{t.noDrivers}</p>
          ) : (
            drivers.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => openConversation(d.id)}
                className="hover:bg-muted flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-0"
              >
                <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold">
                  {initials(d.name) || "—"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{d.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {d.lastBody ?? t.noMessages}
                  </span>
                </span>
                {d.lastAt && (
                  <span className="text-muted-foreground shrink-0 text-[10px]">
                    {dayFmt.format(new Date(d.lastAt))}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      ) : (
        // Conversation
        <>
          <div ref={scrollRef} className="bg-muted/30 min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {loading ? (
              <p className="text-muted-foreground py-6 text-center text-sm">…</p>
            ) : messages.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">{t.noMessages}</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={cn("flex", m.fromDriver ? "justify-start" : "justify-end")}>
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3 py-1.5 text-sm",
                      m.fromDriver
                        ? "bg-card text-foreground rounded-bl-sm border"
                        : "bg-primary text-primary-foreground rounded-br-sm"
                    )}
                  >
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div
                      className={cn(
                        "mt-0.5 text-right text-[10px]",
                        m.fromDriver ? "text-muted-foreground" : "text-primary-foreground/70"
                      )}
                    >
                      {timeFmt.format(new Date(m.createdAt))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="shrink-0 border-t p-2"
          >
            <p className="text-muted-foreground mb-1.5 px-1 text-[10px] leading-tight">{t.driverAppNote}</p>
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={t.inputPlaceholder}
                rows={1}
                className="border-input bg-card max-h-24 min-h-10 flex-1 resize-none rounded-md border px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <button
                type="submit"
                disabled={pending || input.trim() === ""}
                aria-label={t.send}
                className="bg-primary text-primary-foreground hover:bg-primary/90 grid size-10 shrink-0 place-items-center rounded-md transition-colors disabled:opacity-50"
              >
                <Send className="size-4" />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
