// PROTOTYPE — throwaway spike for "Does Knock hold up against Cadence?"
// (verdammelt/cohort-005-project#30). Lives only on the prototype/knock-fit
// branch. Not production code: no tests, minimal error handling.
import "dotenv/config";
import Knock, { signUserToken } from "@knocklabs/node";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { users } from "~/db/schema";

export const DISCUSSION_REPLY_WORKFLOW = "discussion-reply";
export const NEW_ENROLLMENT_WORKFLOW = "new-enrollment";
// Knock preference categories are set per workflow in the dashboard.
export const NEW_ENROLLMENT_CATEGORY = "new-enrollment";

export const knock = new Knock({ apiKey: process.env.KNOCK_API_KEY });

export const knockPublicConfig = {
  publicApiKey: process.env.KNOCK_PUBLIC_API_KEY ?? "",
  feedChannelId: process.env.KNOCK_FEED_CHANNEL_ID ?? "",
};

function recipientFor(userId: number) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new Error(`No user ${userId}`);
  return { id: String(user.id), name: user.name, email: user.email };
}

// Check 1: the server signs an RS256 token for whichever user the session holds.
export function signTokenFor(userId: number) {
  return signUserToken(String(userId), {
    signingKey: process.env.KNOCK_SIGNING_KEY,
    expiresInSeconds: 60 * 60,
  });
}

// Check 1 (negative): if enhanced security mode is on, the feed API must
// refuse a request that carries only the public key.
export async function probeFeedWithoutToken(userId: number) {
  const res = await fetch(
    `https://api.knock.app/v1/users/${userId}/feeds/${knockPublicConfig.feedChannelId}?page_size=1`,
    { headers: { Authorization: `Bearer ${knockPublicConfig.publicApiKey}` } }
  );
  return { status: res.status, body: (await res.text()).slice(0, 300) };
}

// Check 2: trigger a real catalogue Notification. Called from the real
// create-comment action when a Discussion Reply is posted.
export async function triggerDiscussionReply(args: {
  replierId: number;
  questionAuthorId: number;
  lessonId: number;
  questionId: number;
  replyId: number;
  body: string;
  url: string;
}) {
  if (args.replierId === args.questionAuthorId) return null;
  const result = await knock.workflows.trigger(DISCUSSION_REPLY_WORKFLOW, {
    recipients: [recipientFor(args.questionAuthorId)],
    actor: recipientFor(args.replierId),
    data: {
      lesson_id: args.lessonId,
      question_id: args.questionId,
      reply_id: args.replyId,
      body_preview: args.body.slice(0, 140),
      url: args.url,
    },
  });
  console.log("[knock-prototype] triggered discussion-reply", result);
  return result;
}

// Check 4: an off-by-default, opt-in Notification.
export async function triggerNewEnrollmentTo(instructorId: number, studentId: number) {
  return knock.workflows.trigger(NEW_ENROLLMENT_WORKFLOW, {
    recipients: [recipientFor(instructorId)],
    actor: recipientFor(studentId),
    data: { course_title: "Prototype course", url: "/instructor" },
  });
}

export async function identify(userId: number) {
  const r = recipientFor(userId);
  return knock.users.update(r.id, { name: r.name, email: r.email });
}

export async function getPreferences(userId: number) {
  try {
    return await knock.users.getPreferences(String(userId), "default");
  } catch (e) {
    return { error: String(e) };
  }
}

export async function setEnrollmentOptIn(userId: number, optedIn: boolean) {
  return knock.users.setPreferences(String(userId), "default", {
    categories: {
      [NEW_ENROLLMENT_CATEGORY]: { channel_types: { in_app_feed: optedIn } },
    },
  });
}

export async function unsetPreferences(userId: number) {
  return knock.users.unsetPreferences(String(userId), "default");
}

// Check 4: the dashboard can't save an explicit "off" for a channel type, so
// the environment default is written through the Management API instead.
// Needs KNOCK_SERVICE_TOKEN. A PUT replaces the whole default set.
const MAPI_DEFAULTS = "https://control.knock.app/v1/environments/development/defaults";

async function mapi(init?: RequestInit) {
  const res = await fetch(MAPI_DEFAULTS, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.KNOCK_SERVICE_TOKEN ?? ""}`,
      "Content-Type": "application/json",
    },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

export function getEnvironmentDefaults() {
  if (!process.env.KNOCK_SERVICE_TOKEN) return { status: 0, body: "KNOCK_SERVICE_TOKEN not set" };
  return mapi();
}

export function setEnrollmentDefaultOff() {
  return mapi({
    method: "PUT",
    body: JSON.stringify({
      preference_set: {
        categories: {
          [NEW_ENROLLMENT_CATEGORY]: { channel_types: { in_app_feed: false } },
        },
      },
    }),
  });
}
