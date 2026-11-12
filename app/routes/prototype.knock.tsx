// PROTOTYPE — throwaway spike for "Does Knock hold up against Cadence?"
// (verdammelt/cohort-005-project#30). Lives only on the prototype/knock-fit
// branch.
//
// Assumption: the question is vendor fit (behaviour), not looks, so this is a
// single check harness rather than UI variants. Every panel dumps raw state.
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import Knock, { type Feed, type FeedStoreState } from "@knocklabs/client";
import type { Route } from "./+types/prototype.knock";
import { getCurrentUserId } from "~/lib/session";
import { db } from "~/db";
import { users } from "~/db/schema";
import {
  getEnvironmentDefaults,
  getPreferences,
  identify,
  knockPublicConfig,
  probeFeedWithoutToken,
  setEnrollmentDefaultOff,
  setEnrollmentOptIn,
  signTokenFor,
  triggerNewEnrollmentTo,
  unsetPreferences,
} from "~/lib/knock-prototype.server";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) return { userId: null } as const;

  const userToken = await signTokenFor(userId);
  const [probe, preferences, envDefaults] = await Promise.all([
    probeFeedWithoutToken(userId),
    getPreferences(userId),
    getEnvironmentDefaults(),
  ]);
  const others = db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .all()
    .filter((u) => u.id !== userId);

  return {
    userId,
    userToken,
    ...knockPublicConfig,
    probe,
    preferences,
    envDefaults,
    others,
  } as const;
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) return { error: "No user selected" };
  const form = await request.formData();
  const intent = String(form.get("intent"));
  try {
    switch (intent) {
      case "identify":
        return { intent, result: await identify(userId) };
      case "enrollment-to-me":
        return {
          intent,
          result: await triggerNewEnrollmentTo(
            userId,
            Number(form.get("studentId"))
          ),
        };
      case "opt-in":
        return { intent, result: await setEnrollmentOptIn(userId, true) };
      case "opt-out":
        return { intent, result: await setEnrollmentOptIn(userId, false) };
      case "default-off":
        return { intent, result: await setEnrollmentDefaultOff() };
      case "unset-prefs":
        await unsetPreferences(userId);
        return { intent, result: "unset" };
    }
  } catch (e) {
    return { intent, error: String(e) };
  }
  return { intent, error: "unknown intent" };
}

type Snapshot = Pick<FeedStoreState, "items" | "metadata" | "pageInfo" | "loading">;

export default function KnockPrototype({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<typeof action>();
  const feedRef = useRef<Feed | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const push = (line: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()} ${line}`, ...l].slice(0, 50));

  // Check 1 + 3: authenticate the headless feed with the signed token for the
  // DevUI user. Re-runs on user switch, tearing the old client down.
  useEffect(() => {
    if (loaderData.userId === null) return;
    const knock = new Knock(loaderData.publicApiKey);
    knock.authenticate({ id: String(loaderData.userId) }, loaderData.userToken);
    const feed = knock.feeds.initialize(loaderData.feedChannelId, { page_size: 3 });
    feedRef.current = feed;
    const sync = () => {
      const s = feed.getState();
      setSnapshot({ items: s.items, metadata: s.metadata, pageInfo: s.pageInfo, loading: s.loading });
    };
    feed.store.subscribe(sync);
    feed.listenForUpdates();
    feed.on("items.received.realtime", () => push("realtime: new item"));
    feed
      .fetch()
      .then((r) => push(`fetch → ${r ? r.status : "no result"}`))
      .catch((e) => push(`fetch failed: ${e}`));
    push(`authenticated as user ${loaderData.userId}`);
    return () => {
      feed.teardown();
      knock.teardown();
      feedRef.current = null;
    };
  }, [loaderData.userId, loaderData.userId === null ? null : loaderData.userToken]);

  const run = (label: string, fn: (feed: Feed) => Promise<unknown>) => async () => {
    const feed = feedRef.current;
    if (!feed) return;
    try {
      const r = await fn(feed);
      push(`${label} → ${JSON.stringify(r)?.slice(0, 200)}`);
    } catch (e) {
      push(`${label} failed: ${e}`);
    }
  };

  if (!loaderData.userId) {
    return <p className="p-8">Select a user in the DevUI panel.</p>;
  }

  const btn = "rounded border px-2 py-1 text-sm hover:bg-muted";
  const pre = "max-h-80 overflow-auto rounded bg-muted p-2 text-xs";

  return (
    <div className="space-y-6 p-6">
      <div className="rounded border border-dashed border-amber-500 bg-amber-50 p-3 text-sm">
        PROTOTYPE: Knock vendor-fit spike (#30). Throwaway.
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">1. Signed user tokens</h2>
        <p className="text-sm">
          Feed authenticated as user <b>{loaderData.userId}</b>. Switch user in
          DevUI: the feed below should switch with it.
        </p>
        <p className="text-sm">
          Feed request with the public key only (no token):{" "}
          <b>HTTP {loaderData.probe.status}</b>{" "}
          {loaderData.probe.status === 200
            ? "⚠ accepted, so enhanced security mode is OFF"
            : "✓ refused, so enhanced security mode is ON"}
        </p>
        <pre className={pre}>{loaderData.probe.body}</pre>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">2. Triggering (real path)</h2>
        <p className="text-sm">
          As another user, post a Discussion Reply under this user's Discussion
          Question on a lesson page. Switch back here: it should be in the feed.
        </p>
        <fetcher.Form method="post">
          <button className={btn} name="intent" value="identify">
            Identify me in Knock
          </button>
        </fetcher.Form>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">3. Headless feed API</h2>
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={run("fetch", (f) => f.fetch())}>Refetch</button>
          <button className={btn} onClick={run("fetchNextPage", (f) => f.fetchNextPage())}>
            Next page (after cursor)
          </button>
          <button className={btn} onClick={run("markAllAsSeen", (f) => f.markAllAsSeen())}>
            Mark all seen (bulk)
          </button>
          <button className={btn} onClick={run("markAllAsRead", (f) => f.markAllAsRead())}>
            Mark all read (bulk)
          </button>
        </div>
        <pre className={pre}>
          {JSON.stringify({ metadata: snapshot?.metadata, pageInfo: snapshot?.pageInfo, loading: snapshot?.loading }, null, 2)}
        </pre>
        <ul className="space-y-1">
          {snapshot?.items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 rounded border p-2 text-sm">
              <span className={item.read_at ? "" : "font-bold"}>
                [{item.source.key} · categories: {JSON.stringify(item.source.categories)}] {item.actors[0] && "name" in item.actors[0] ? String(item.actors[0].name) : "no actor"}{" "}
                · seen:{item.seen_at ? "y" : "n"} read:{item.read_at ? "y" : "n"} ·{" "}
                {JSON.stringify(item.data)}
              </span>
              <button className={btn} onClick={run("markAsSeen", (f) => f.markAsSeen(item))}>seen</button>
              <button className={btn} onClick={run("markAsRead", (f) => f.markAsRead(item))}>✓ read</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">4. Off-by-default, opt-in preference (new Enrollment)</h2>
        <fetcher.Form method="post" className="flex flex-wrap items-center gap-2">
          <select name="studentId" className="rounded border p-1 text-sm">
            {loaderData.others.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
          <button className={btn} name="intent" value="enrollment-to-me">
            Trigger new-enrollment → me
          </button>
          <button className={btn} name="intent" value="opt-in">Opt in</button>
          <button className={btn} name="intent" value="opt-out">Opt out</button>
          <button className={btn} name="intent" value="unset-prefs">Unset my prefs (back to defaults)</button>
          <button className={btn} name="intent" value="default-off">
            Set environment default: new-enrollment in-app OFF
          </button>
        </fetcher.Form>
        <p className="text-sm">Environment default preference set (Management API):</p>
        <pre className={pre}>{JSON.stringify(loaderData.envDefaults, null, 2)}</pre>
        <p className="text-sm">My own preference set (recipient level only):</p>
        <pre className={pre}>{JSON.stringify(loaderData.preferences, null, 2)}</pre>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Last server action</h2>
        <pre className={pre}>{JSON.stringify(fetcher.data, null, 2)}</pre>
        <h2 className="font-semibold">Client log</h2>
        <pre className={pre}>{log.join("\n")}</pre>
      </section>
    </div>
  );
}
