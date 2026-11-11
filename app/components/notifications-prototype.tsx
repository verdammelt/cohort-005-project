// PROTOTYPE — throwaway. Answers "What does the notification UI look like in
// Cadence's sidebar shell?" (wayfinder ticket #8).
//
// Three variants of where Notifications live, switchable via ?variant=A|B|C,
// mounted in the real app shell so they sit against real pages:
//   A — Bell in the sidebar header, popover flyout beside the sidebar
//   B — "Notifications" nav item, full-height slide-over drawer on the right
//   C — Inline "Inbox" section inside the sidebar, no overlay at all
//
// Data is fake, keyed off the current user's role. Read/archive state lives in
// memory only. No Knock calls.
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Bell,
  CheckCheck,
  CircleCheck,
  CircleX,
  MessageSquare,
  MessagesSquare,
  Ticket,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { UserRole } from "~/db/schema";
import { PrototypeSwitcher } from "~/components/prototype-switcher";

type Kind =
  | "refund-approved"
  | "refund-declined"
  | "seats-claimed"
  | "new-questions"
  | "question-answered";

interface FakeNotification {
  id: number;
  kind: Kind;
  text: string;
  href: string;
  at: string;
  read: boolean;
  archived: boolean;
}

const kindIcon: Record<Kind, React.ReactNode> = {
  "refund-approved": <CircleCheck className="size-4 text-emerald-600" />,
  "refund-declined": <CircleX className="size-4 text-rose-600" />,
  "seats-claimed": <Ticket className="size-4 text-sky-600" />,
  "new-questions": <MessagesSquare className="size-4 text-amber-600" />,
  "question-answered": <MessageSquare className="size-4 text-violet-600" />,
};

function fakeNotificationsFor(
  role: UserRole | null,
  isTeamAdmin: boolean
): FakeNotification[] {
  const base = { read: false, archived: false };
  if (role === UserRole.Instructor) {
    return [
      { ...base, id: 1, kind: "new-questions", text: "5 new questions on React Foundations.", href: "/instructor/questions", at: "12m ago" },
      { ...base, id: 2, kind: "new-questions", text: "1 new question on Advanced TypeScript.", href: "/instructor/questions", at: "2h ago" },
      { ...base, id: 3, kind: "new-questions", text: "3 new questions on React Foundations.", href: "/instructor/questions", at: "Yesterday", read: true },
    ];
  }
  if (role === UserRole.Admin) return []; // Platform Admins are out of scope
  const student: FakeNotification[] = [
    { ...base, id: 10, kind: "question-answered", text: "Ines Ortega replied to your comment on “useEffect in depth”.", href: "/courses", at: "5m ago" },
    { ...base, id: 11, kind: "refund-approved", text: "Your refund request for Advanced TypeScript was approved. $99.00 is on its way back to you.", href: "/settings", at: "3h ago" },
    { ...base, id: 12, kind: "refund-declined", text: "Your refund request for CSS Mastery was declined. See the note from the Cadence team.", href: "/settings", at: "2 days ago", read: true },
    { ...base, id: 13, kind: "question-answered", text: "Ines Ortega replied to your comment on “Props vs state”.", href: "/courses", at: "Last week", read: true },
  ];
  if (!isTeamAdmin) return student;
  return [
    { ...base, id: 20, kind: "seats-claimed", text: "3 Seats claimed on React Foundations (47 left).", href: "/team", at: "20m ago" },
    { ...base, id: 21, kind: "seats-claimed", text: "12 Seats claimed on React Foundations (50 left).", href: "/team", at: "Yesterday", read: true },
    ...student,
  ];
}

const variants = [
  { key: "A", name: "Bell + popover" },
  { key: "B", name: "Nav item + drawer" },
  { key: "C", name: "Inline sidebar inbox" },
];

const STORAGE_KEY = "prototype-notification-variant";

/**
 * Returns slots the Sidebar renders in its header, nav and body, plus the
 * overlay and switcher the layout renders at the top level.
 */
export function useNotificationsPrototype(
  role: UserRole | null,
  isTeamAdmin: boolean
) {
  const [searchParams] = useSearchParams();
  const [variant, setVariant] = useState(searchParams.get("variant") ?? "A");
  const [items, setItems] = useState(() =>
    fakeNotificationsFor(role, isTeamAdmin)
  );
  const [open, setOpen] = useState(false);

  // Keep the variant across navigations (NavLinks drop the search param).
  useEffect(() => {
    const fromUrl = searchParams.get("variant");
    if (fromUrl) {
      setVariant(fromUrl);
      sessionStorage.setItem(STORAGE_KEY, fromUrl);
    } else {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) setVariant(stored);
    }
  }, [searchParams]);

  useEffect(() => {
    setItems(fakeNotificationsFor(role, isTeamAdmin));
  }, [role, isTeamAdmin]);

  useEffect(() => setOpen(false), [variant]);

  const visible = items.filter((n) => !n.archived);
  const unread = visible.filter((n) => !n.read).length;

  const api = {
    items: visible,
    unread,
    markRead: (id: number) =>
      setItems((xs) => xs.map((n) => (n.id === id ? { ...n, read: true } : n))),
    markAllRead: () => setItems((xs) => xs.map((n) => ({ ...n, read: true }))),
    archive: (id: number) =>
      setItems((xs) =>
        xs.map((n) => (n.id === id ? { ...n, archived: true, read: true } : n))
      ),
    reset: () => setItems(fakeNotificationsFor(role, isTeamAdmin)),
    open,
    setOpen,
  };

  const switcher = (
    <>
      <PrototypeSwitcher
        variants={variants}
        current={variant}
        onChange={(key) => {
          setVariant(key);
          sessionStorage.setItem(STORAGE_KEY, key);
        }}
      />
      <StatePanel api={api} variant={variant} />
    </>
  );

  return {
    headerSlot: variant === "A" ? <VariantABell api={api} /> : null,
    navSlot: variant === "B" ? <VariantBNavItem api={api} /> : null,
    sectionSlot: variant === "C" ? <VariantCInbox api={api} /> : null,
    overlay:
      variant === "A" ? (
        <VariantAPopover api={api} />
      ) : variant === "B" ? (
        <VariantBDrawer api={api} />
      ) : null,
    switcher,
  };
}

type Api = {
  items: FakeNotification[];
  unread: number;
  markRead: (id: number) => void;
  markAllRead: () => void;
  archive: (id: number) => void;
  reset: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
};

/** Surfaces the prototype's in-memory state. Not part of any variant. */
function StatePanel({ api, variant }: { api: Api; variant: string }) {
  if (!import.meta.env.DEV) return null;
  return (
    <div className="fixed bottom-16 left-1/2 z-[100] -translate-x-1/2 rounded-md bg-black/80 px-3 py-1 font-mono text-xs text-white">
      variant={variant} · visible={api.items.length} · unread={api.unread} ·
      open={String(api.open)} ·{" "}
      <button onClick={api.reset} className="underline">
        reset
      </button>
    </div>
  );
}

function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-5 text-white",
        className
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

// ─── Variant A: bell in sidebar header + popover flyout ─────────────────────

function VariantABell({ api }: { api: Api }) {
  return (
    <button
      onClick={() => api.setOpen(!api.open)}
      className="relative ml-auto rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      aria-label="Notifications"
      data-notification-trigger
    >
      <Bell className="size-5" />
      <UnreadBadge count={api.unread} className="absolute -right-1 -top-1" />
    </button>
  );
}

function VariantAPopover({ api }: { api: Api }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!api.open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (ref.current?.contains(target)) return;
      if (target.closest("[data-notification-trigger]")) return;
      api.setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  });
  if (!api.open) return null;
  return (
    <div
      ref={ref}
      className="fixed left-58 top-2 z-50 w-96 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl"
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-sm font-semibold">Notifications</span>
        {api.unread > 0 && (
          <button
            onClick={api.markAllRead}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <CheckCheck className="size-3.5" /> Mark all as read
          </button>
        )}
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        {api.items.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            You're all caught up.
          </p>
        )}
        {api.items.map((n) => (
          <Link
            key={n.id}
            to={n.href}
            onClick={() => {
              api.markRead(n.id);
              api.setOpen(false);
            }}
            className={cn(
              "flex gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-accent",
              !n.read && "bg-primary/5"
            )}
          >
            <span
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                n.read ? "bg-transparent" : "bg-primary"
              )}
            />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", !n.read && "font-medium")}>{n.text}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{n.at}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Variant B: nav item + slide-over drawer, grouped, archivable ───────────

function VariantBNavItem({ api }: { api: Api }) {
  return (
    <button
      onClick={() => api.setOpen(true)}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        api.open
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Bell className="size-4" />
      Notifications
      <UnreadBadge count={api.unread} className="ml-auto" />
    </button>
  );
}

function VariantBDrawer({ api }: { api: Api }) {
  if (!api.open) return null;
  const fresh = api.items.filter((n) => !n.read);
  const earlier = api.items.filter((n) => n.read);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => api.setOpen(false)}
      />
      <aside className="relative flex h-full w-[28rem] flex-col border-l bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Notifications</h2>
            <p className="text-xs text-muted-foreground">
              {api.unread} new · {api.items.length} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            {api.unread > 0 && (
              <button
                onClick={api.markAllRead}
                className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
              >
                Mark all as read
              </button>
            )}
            <button
              onClick={() => api.setOpen(false)}
              className="rounded-md p-1 hover:bg-accent"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {api.items.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <Bell className="mb-3 size-10 opacity-30" />
              <p className="text-sm">Nothing here yet.</p>
            </div>
          )}
          {[
            { label: "New", list: fresh },
            { label: "Earlier", list: earlier },
          ].map(
            ({ label, list }) =>
              list.length > 0 && (
                <section key={label} className="mb-6">
                  <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </h3>
                  <ul className="space-y-2">
                    {list.map((n) => (
                      <li
                        key={n.id}
                        className={cn(
                          "group flex items-start gap-3 rounded-lg border p-3",
                          !n.read && "border-primary/40 bg-primary/5"
                        )}
                      >
                        <span className="mt-0.5 rounded-md bg-muted p-1.5">
                          {kindIcon[n.kind]}
                        </span>
                        <Link
                          to={n.href}
                          onClick={() => {
                            api.markRead(n.id);
                            api.setOpen(false);
                          }}
                          className="min-w-0 flex-1"
                        >
                          <p className="text-sm">{n.text}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {n.at}
                          </p>
                        </Link>
                        <button
                          onClick={() => api.archive(n.id)}
                          className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100"
                          title="Archive"
                        >
                          <X className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
          )}
        </div>
      </aside>
    </div>
  );
}

// ─── Variant C: inline inbox inside the sidebar, no overlay ─────────────────

function VariantCInbox({ api }: { api: Api }) {
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? api.items : api.items.filter((n) => !n.read);
  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="mb-2 flex items-center justify-between px-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Inbox
        </span>
        <UnreadBadge count={api.unread} />
      </div>
      {list.length === 0 ? (
        <p className="px-3 py-2 text-xs text-sidebar-foreground/50">
          No new notifications.
        </p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {list.map((n) => (
            <li key={n.id}>
              <Link
                to={n.href}
                onClick={() => api.markRead(n.id)}
                className={cn(
                  "flex gap-2 rounded-md px-3 py-2 text-xs transition-colors hover:bg-sidebar-accent",
                  n.read
                    ? "text-sidebar-foreground/50"
                    : "text-sidebar-foreground"
                )}
              >
                <span className="mt-0.5 shrink-0">{kindIcon[n.kind]}</span>
                <span className="line-clamp-2">{n.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={() => setShowAll(!showAll)}
        className="mt-1 px-3 text-xs text-sidebar-foreground/50 underline hover:text-sidebar-foreground"
      >
        {showAll ? "Show new only" : "Show earlier"}
      </button>
    </div>
  );
}
