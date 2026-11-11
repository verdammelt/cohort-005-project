# Hosted notification providers for Cadence v1 in-app notifications

**Date checked:** 2026-11-11. Prices, package versions and docs change often, so re-check before deciding.
**Scope:** hosted SaaS only, with a free or low-cost tier. No self-hosting. In-app inbox first, with email as a later tiebreaker. Sources are primary only: vendor docs, pricing pages, official GitHub repos and the npm registry (`npm view` / `npm pack` run on 2026-11-11). Anything marked **unverified** could not be confirmed from a primary source.

## Question

Which hosted notification providers fit Cadence's constraints for v1 in-app notifications, and how do they compare? The constraints:

- React Router framework mode, React 19, shadcn + Tailwind v4.
- INTEGER user ids and cookie sessions.
- Notifications are shown on page load or navigation. Websockets come later.
- The vendor is called synchronously inside a server action, with no job queue.
- Local dev today uses a `.outbox/` fallback.

---

## Knock

- **Pricing:**
  - Free: 10,000 messages/month.
  - Starter: $250/month with 50,000 messages, then $0.005 each ([pricing](https://knock.app/pricing)).
  - A message is one message delivered to one user on one channel. In-app feed messages count toward this ([plans](https://docs.knock.app/manage-your-account/knock-plans)).
  - The Free plan has restrictions on "environments, branding, log retention, and rate limits". The details are **unverified** ([plans](https://docs.knock.app/manage-your-account/knock-plans)).
- **React inbox:** `@knocklabs/react` (v0.15.1, peer `react ^17||^18||^19`, [npm](https://www.npmjs.com/package/@knocklabs/react)).
  - Components: `KnockProvider`, `KnockFeedProvider`, `NotificationIconButton`, `NotificationFeedPopover`.
  - Theming: CSS variables prefixed `--rnf-`, `renderItem` to replace cells, `colorMode="dark"` ([feed docs](https://docs.knock.app/in-app-ui/react/feed)).
- **Headless:** yes. Hooks `useKnockClient`, `useNotifications`, `useNotificationStore`, plus `feedClient.markAsSeen/markAllAsSeen/markAsRead` ([headless](https://docs.knock.app/in-app-ui/react/headless/feed)).
- **Server SDK:** `@knocklabs/node` (v1.41.1).
  - Call shape: `new Knock({ apiKey })` then `await knock.workflows.trigger('key', { recipients: ['123'], data })`.
  - Throws `APIError` subclasses. By default it retries 2 times on connection errors, 408/409/429 and 5xx, and times out after **1 minute**. Both are configurable with `maxRetries` and `timeout` ([repo](https://github.com/knocklabs/knock-node)).
- **Identity:**
  - User ids are strings of at most 256 characters, with no `/` or `#`. Integer ids should be converted to strings. Ids can't be changed after they are set ([users](https://docs.knock.app/concepts/users)).
  - Client auth uses the public key plus a user token: an RS256 JWT with `sub` set to the user id, signed with a private signing key.
  - The Node helper is `signUserToken('123')`, exported from `@knocklabs/node` ([repo](https://github.com/knocklabs/knock-node)).
  - "Enhanced security mode" is **off by default** and set per environment. When it is on, unsigned requests are rejected ([security](https://docs.knock.app/in-app-ui/security-and-authentication)).
- **Feed state:**
  - Engagement statuses are seen, read, interacted, link_clicked and archived, each with a timestamp. Several can apply at once ([statuses](https://docs.knock.app/send-notifications/message-statuses)).
  - Per-user preferences are available through the API ([set_preferences](https://docs.knock.app/api-reference/users/set_preferences)).
- **Live updates:** socket-based real-time updates, cross-tab sync through BroadcastChannel, and auto-disconnect for inactive tabs ([feed docs](https://docs.knock.app/in-app-ui/react/feed)).
- **Local dev and testing:**
  - Development and production environments have separate keys and data ([environments](https://docs.knock.app/concepts/environments)).
  - "Sandbox mode" renders messages without sending them downstream ([plans](https://docs.knock.app/manage-your-account/knock-plans)).
  - There is no offline mode or official mock ([environments](https://docs.knock.app/concepts/environments)).
- **Other channels:** email and other channels. Each channel delivery counts as a separate message ([plans](https://docs.knock.app/manage-your-account/knock-plans)).

## Novu (Cloud)

- **Pricing:**
  - Free: $0 with 10,000 workflow runs/month, 5 workflows, unlimited subscribers, 2 environments (Dev and Prod), 24h activity-feed retention and 3 team members.
  - Pro: from $30/month with 30,000+ runs (then $1.20 per 1,000), 20 workflows, 7-day retention and "Remove Novu branding". Free therefore shows Novu branding ([pricing](https://novu.co/pricing)).
  - Novu bills per workflow run, not per channel message ([pricing](https://novu.co/pricing)).
  - Whether the 24h retention applies to stored inbox notifications or only to logs is **unverified**.
- **React inbox:** `@novu/react` (v3.19.2, peer `react ^18||^19`, [npm](https://www.npmjs.com/package/@novu/react)).
  - `<Inbox>` has an `appearance` prop that takes `baseTheme`, `variables` (`colorPrimary`, `colorBackground`, `borderRadius`…) and `elements`.
  - `elements` accepts **Tailwind class strings** or style objects, with callbacks for conditional styling. Motion is controlled with `--nv-*` CSS variables ([styling](https://docs.novu.co/platform/inbox/configuration/styling)).
  - Render props: `renderNotification`, `renderSubject`, `renderBody`, `renderBell` ([customize items](https://docs.novu.co/platform/inbox/advanced-customization/customize-notification-items)).
- **Headless:** `NovuProvider` with hooks `useNotifications` (paginated and real-time), `useCounts` (unread/unseen/total) and `useNovu`. There is also a `@novu/js` client ([headless](https://docs.novu.co/platform/inbox/headless-mode), [@novu/js](https://docs.novu.co/platform/sdks/javascript)).
- **Server SDK:** `@novu/api` (v3.19.1).
  - Call shape: `new Novu({ secretKey })` then `await novu.trigger({ workflowId, to: '123', payload })`.
  - Errors are `NovuError` and `ConnectionError`/`RequestTimeoutError`. Retries can be configured with `retryConfig`. The default retry strategy is "provided by the API" ([repo](https://github.com/novuhq/novu-ts)).
  - The default timeout is **unverified**.
- **Identity:**
  - `subscriberId` is your stable internal user id, and integer ids work as strings ([subscribers](https://docs.novu.co/platform/concepts/subscribers)).
  - Client auth uses `subscriberHash = HMAC-SHA256(secretKey, subscriberId)` as hex.
  - HMAC is **optional**: it is a dashboard toggle on the In-App integration. When it is on, the Inbox won't load without the hash ([prod checklist](https://docs.novu.co/platform/inbox/prepare-for-production)).
- **Feed state:** read, seen, archived and snoozed, plus severity ([headless](https://docs.novu.co/platform/inbox/headless-mode), [snooze](https://docs.novu.co/platform/inbox/features/snooze)). Preferences can be global or per workflow, per channel ([subscribers](https://docs.novu.co/platform/concepts/subscribers)).
- **Live updates:** websocket. The hooks auto-update, and `novu.on('notifications.notification_received')` is available ([headless](https://docs.novu.co/platform/inbox/headless-mode)).
- **Local dev and testing:**
  - **Keyless mode:** `<Inbox />` with no props shows demo data that expires after 24h. It still calls Novu Cloud ([setup](https://docs.novu.co/platform/inbox/setup-inbox)).
  - `npx novu dev` opens a Local Studio that tunnels to your local Bridge endpoint. It needs network access ([studio](https://docs.novu.co/framework/studio)).
  - Separate Dev and Prod environments are included on Free ([pricing](https://novu.co/pricing)).
- **Other channels:** email, SMS, chat and push are all on Free ([pricing](https://novu.co/pricing)).

## MagicBell

- **Pricing:**
  - Builder (free): 1,000 deliveries/month and 1 project.
  - Startup: $249/month with 50,000 deliveries, then $0.0025 each, and 5 projects ([pricing](https://www.magicbell.com/pricing)).
  - Each channel a user receives counts as a delivery, so in-app counts ([pricing FAQ](https://www.magicbell.com/pricing)).
  - With 1 project on Free, there is no separate dev and prod project unless you pay.
- **React inbox:** `@magicbell/react` (v1.14.0, [npm](https://www.npmjs.com/package/@magicbell/react)).
  - Components: `ContextProvider`, `Inbox`, `FloatingInbox`, `UserPreferences`, `ToastContainer`.
  - Styling: CSS variables (`--magicbell-bg-default`…), className targeting and an **`unstyled` prop** ([react docs](https://www.magicbell.com/docs/libraries/magicbell-react)).
- **Headless:** `@magicbell/react-headless` (v5.5.1, published 2026-05) still exists, but the current docs don't document its hooks (**unverified**). The `magicbell-js` `UserClient` offers user-scoped API access plus realtime ([JS client](https://www.magicbell.com/docs/libraries/magicbell-js)).
- **Server SDK:** `magicbell-js` with `ProjectClient` (`new Client({ token })`).
  - Call shape: `client.broadcasts.createBroadcast({ title, content, recipients: [{ externalId: '123' }] })` ([JS client](https://www.magicbell.com/docs/libraries/magicbell-js), [broadcast](https://www.magicbell.com/docs/primitive/broadcast)).
  - Retry defaults are **unverified**.
- **Identity:**
  - Users are identified by `user_external_id` and/or `user_email`. The type is not specified, so a stringified integer is fine.
  - The client uses an **HS256 user JWT** signed with the project Secret Key, with payload `{ user_email, user_external_id, api_key }` ([user auth](https://www.magicbell.com/docs/api/authentication/user)).
  - The JWT appears to be required, since `ContextProvider` takes the token. Whether it can be disabled is **unverified**.
- **Feed state:** unseen, unread, read and archived, with seen/read/archived timestamps ([notification](https://www.magicbell.com/docs/primitive/notification)). The `UserPreferences` component handles per-category preferences ([react docs](https://www.magicbell.com/docs/libraries/magicbell-react)).
- **Live updates:** websocket ([in-app channel](https://www.magicbell.com/docs/channels/in_app)).
- **Local dev and testing:** no sandbox or offline mode was found. The test tools on the site cover push and Slack only ([test](https://www.magicbell.com/test)).
- **Other channels:** email (SendGrid, Mailgun…), SMS, push and Slack ([JS client](https://www.magicbell.com/docs/libraries/magicbell-js)).

## Courier

- **Pricing:**
  - Developer (free): up to 10k sends/month.
  - Business: pay-as-you-go at $0.005 per send ([pricing](https://www.courier.com/pricing)).
  - The pricing page doesn't say whether Inbox is on every plan (**unverified**).
- **React inbox:** `@trycourier/courier-react` (v9.3.5, peer `react >=18`, [npm](https://www.npmjs.com/package/@trycourier/courier-react)).
  - Components: `<CourierInbox>`, `<CourierInboxPopupMenu>`, `<CourierToast>`, `<CourierPreferences>` ([react sdk](https://www.courier.com/docs/platform/inbox/web/react-sdk)).
  - The React package depends on `@trycourier/courier-ui-inbox` (Web Components), and `courier-ui-core` calls `attachShadow` (npm package source).
  - The inbox renders in **Shadow DOM**. As a result, "external CSS and Tailwind stylesheets won't directly pierce the component", so you style it with JSON theme objects (`setLightTheme`/`setDarkTheme`) ([web components](https://www.courier.com/docs/sdk-libraries/courier-ui-inbox-web)).
  - The React render props are `renderListItem`, `renderHeader`, `renderMenuButton`, `renderEmptyState`, `renderLoadingState`, `renderErrorState` and `renderPaginationItem` (from the `@trycourier/courier-react-components` 2.3.5 type definitions). Whether Tailwind classes work inside those is **unverified**.
- **Headless:** yes. `useCourier()` returns `shared` (signIn), `inbox` (feeds, `totalUnreadCount`, actions) and `preferences` ([search summary of react SDK docs](https://www.courier.com/docs/platform/inbox/web/react-sdk); [v8 migration](https://www.courier.com/docs/sdk-libraries/courier-react-v8-migration-guide)).
- **Server SDK:** `@trycourier/courier` (v10.0.0, Node 20+).
  - Call shape: `client.send.message({ message: { to: { user_id: '123' }, content: { title, body } } })` ([repo](https://github.com/trycourier/courier-node)).
  - Source defaults are `maxRetries ?? 2` and `DEFAULT_TIMEOUT = 60000` (from `client.js` in the npm tarball).
- **Identity:**
  - `user_id` is a string.
  - Client auth **requires a JWT**, minted server-side with `client.auth.issueToken({ scope: 'user_id:123 inbox:read:messages inbox:write:events', expires_in: '2 days' })`. There is no client-key or HMAC alternative ([JWT](https://www.courier.com/docs/tutorials/inbox/how-to-send-jwt)).
  - The token costs one extra API round-trip per token mint.
- **Feed state:** read/unread, opened, archived and clicked, with feeds and tabs ([web components](https://www.courier.com/docs/sdk-libraries/courier-ui-inbox-web)). Preferences come through `<CourierPreferences>` ([react sdk](https://www.courier.com/docs/platform/inbox/web/react-sdk)).
- **Live updates:** websocket through `inbox.listenForUpdates()`. Without it, the inbox "loads once" ([react sdk](https://www.courier.com/docs/platform/inbox/web/react-sdk)). That matches v1's page-load model.
- **Local dev and testing:** environments (dev, staging, prod) have separate keys ([environments](https://www.courier.com/docs/platform/content/notification-designer/environments-api-keys/)). There is no offline or mock story.
- **Other channels:** email plus many providers ([inbox overview](https://www.courier.com/docs/platform/inbox/inbox-overview)).

## SuprSend

- **Pricing:**
  - Free: 10,000 notifications/month, in-app feed **with SuprSend branding**.
  - Essentials: $100/month billed annually ($1,200/year), 50,000 notifications, $2 per 1,000 over, branding removed ([pricing](https://www.suprsend.com/pricing)).
- **React inbox:** `@suprsend/react` (v1.5.0). The old `@suprsend/react-inbox` is **deprecated on npm** ("Package no longer supported") ([npm](https://www.npmjs.com/package/@suprsend/react-inbox)).
  - Components: `SuprSendProvider`, `Inbox`, `NotificationFeed`.
  - Theming uses an `ITheme` object and `themeType` light/dark. You can also target `ss-*` class names.
  - Render props: `bellComponent`, `badgeComponent`, `notificationComponent`, `headerRightComponent`, `loaderComponent`, `noNotificationsComponent`. Multi-tab `stores` are supported ([customising](https://docs.suprsend.com/docs/react-customising-feed)).
- **Headless:** `SuprSendFeedProvider` with `useFeedClient` (`markAsSeen/Read/Unread/Archived`) and `useFeedData` ([headless](https://docs.suprsend.com/docs/react-sdk-headless-feed)). Preferences are available through `suprSendClient.user.preferences.*` ([prefs](https://docs.suprsend.com/docs/preferences-react-headless)).
- **Server SDK:** `@suprsend/node-sdk` (v1.15.1).
  - Call shape: `new Suprsend(key, secret)` then `client.workflows.trigger(new WorkflowTriggerRequest({ workflow: 'slug', recipients: [{ distinct_id: '123' }], data }))` ([repo](https://github.com/suprsend/suprsend-node-sdk)).
  - Retry and timeout defaults are **unverified**.
- **Identity:**
  - `distinct_id` is a string.
  - Client auth uses the public API key plus, in "enhanced security mode", an **ES256 JWT** with claims `entity_type:'subscriber'`, `entity_id`, `iat`, `exp` and an optional `scope.tenant_id`. It is signed with a PEM signing key.
  - When enhanced mode is off, the public key alone works. It is "recommended for Production". Whether it is off by default is **unverified** ([auth](https://docs.suprsend.com/docs/client-authentication)).
  - `refreshUserToken` handles rotation ([auth](https://docs.suprsend.com/docs/client-authentication)).
- **Feed state:** seen, read/unread and archived. Archived items are hidden by default ([headless](https://docs.suprsend.com/docs/react-sdk-headless-feed)). Preferences cover categories and channels ([user prefs](https://docs.suprsend.com/docs/user-preferences)).
- **Live updates:** websocket ("feed socket") ([headless](https://docs.suprsend.com/docs/react-sdk-headless-feed)).
- **Local dev and testing:** separate testing and production workspaces with distinct keys ([api keys](https://docs.suprsend.com/docs/developer/api-keys)). There is no offline mode.
- **Other channels:** "Unlimited channels" on Free ([pricing](https://www.suprsend.com/pricing)).

## Stream (Activity Feeds v3)

- **Pricing:**
  - Build (free): 125,000 API calls and 5,000 activities.
  - Start: $499/month billed annually or $599/month billed monthly, with 1.25M calls and 50,000 activities.
  - "Maker" program: free for companies with fewer than 5 team members and under $10k monthly revenue ([pricing](https://getstream.io/activity-feeds/pricing/)).
  - The page doesn't say whether this is v2 or v3 pricing (**unverified**).
- **React inbox:** **none.** `@stream-io/feeds-react-sdk` is hooks-only, with no prebuilt notification bell ([notification feeds](https://getstream.io/activity-feeds/docs/react/notification-feeds/)).
- **Headless:** yes. `useCreateFeedsClient`, `useAggregatedActivities`, `useNotificationStatus`, `useFeedActivities` ([quick start](https://getstream.io/activity-feeds/docs/react/), [notification feeds](https://getstream.io/activity-feeds/docs/react/notification-feeds/)).
- **Server SDK:** `@stream-io/node-sdk`. Call shape: `client.feeds.addActivity({ feeds: ['notification:123'], type, text, user_id })` ([node notification feeds](https://getstream.io/activity-feeds/docs/node/notification-feeds/)).
- **Identity:**
  - The user id is a "unique string" ([search summary of node docs](https://getstream.io/activity-feeds/docs/node/)). Its character set is **unverified**.
  - Client auth uses an **HS256 JWT** from `createUserToken`, signed with the API secret. Node issues 1h tokens by default ([tokens](https://getstream.io/activity-feeds/docs/node/tokens-and-authentication)).
  - Development-mode apps can toggle **"Disable Authentication Checks"** ([tokens](https://getstream.io/activity-feeds/docs/node/tokens-and-authentication)).
- **Feed state:** `is_seen` and `is_read` only. There is **no archive** ([notification feeds](https://getstream.io/activity-feeds/docs/react/notification-feeds/)). There is no per-user preference centre, since this is a feeds product rather than a notification orchestrator (**unverified**).
- **Live updates:** websocket events `feeds.notification_feed.updated` and `feeds.activity.added` ([notification feeds](https://getstream.io/activity-feeds/docs/react/notification-feeds/)).
- **Local dev and testing:** auth checks can be disabled in development mode. There is no offline mode.
- **Other channels:** no email. Push only through `push_types` ([node notification feeds](https://getstream.io/activity-feeds/docs/node/notification-feeds/)).

## Considered and excluded

- **OneSignal:** in-app messages are mobile-only and "not available for web". OneSignal "does not currently store the history of messages sent to each individual user", so there is no inbox ([activity feed](https://documentation.onesignal.com/docs/en/create-an-activity-feed), [in-app](https://documentation.onesignal.com/docs/en/in-app-messages-setup)).
- **Engagespot:** its pricing page returned 404 on 2026-11-11. `@engagespot/node` was last published 2024-11 and `@engagespot/react-component` 2025-05 (npm registry). There is no current primary pricing source, so it is excluded as uncertain.
- **Pusher Beams:** a push-notification product with no in-app feed. It is out of scope and was not researched further (**unverified**).

---

## Comparison

| Provider | Free tier | First paid | React inbox / theming | Headless | Server trigger | Client auth (enforced?) | Feed state | Prefs | Realtime | Dev/test | Email later |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Knock** | 10k msgs/mo | $250/mo, 50k | Yes; `--rnf-` CSS vars, `renderItem` | Yes (hooks) | `workflows.trigger` | RS256 JWT; optional per env | seen/read/interacted/archived | Yes | Yes | Dev env, sandbox mode | Yes |
| **Novu Cloud** | 10k runs/mo, branding, 2 envs | $30/mo, 30k runs | Yes; `appearance` with **Tailwind classes**, render props | Yes (hooks, `@novu/js`) | `novu.trigger` | HMAC hash; optional toggle | read/seen/archived/snoozed | Yes | Yes | Dev+Prod envs, keyless demo Inbox, `npx novu dev` | Yes |
| **MagicBell** | 1k deliveries/mo, 1 project | $249/mo, 50k | Yes; CSS vars, `unstyled` | Partial (react-headless undocumented, JS UserClient) | `broadcasts.createBroadcast` | HS256 JWT; seems required | unseen/unread/read/archived | Yes | Yes | None on Free (1 project) | Yes |
| **Courier** | 10k sends/mo | $0.005/send PAYG | Yes but **Shadow DOM**; JSON themes, render props | Yes (`useCourier`) | `send.message` | JWT via `issueToken`; **mandatory** | read/opened/archived/clicked | Yes | Opt-in `listenForUpdates` | Envs | Yes |
| **SuprSend** | 10k/mo, branding | $100/mo (annual), 50k | Yes; theme obj, render props | Yes (hooks) | `workflows.trigger` | ES256 JWT; optional "enhanced" | seen/read/unread/archived | Yes | Yes | Test/prod workspaces | Yes |
| **Stream Feeds** | 5k activities, 125k calls (Maker: free <$10k MRR) | $499/mo annual | **No** prebuilt UI | Yes (hooks only) | `feeds.addActivity` | HS256 JWT; can disable in dev | seen/read only | No (unverified) | Yes | Disable auth checks | No |

All providers use string user ids, so Cadence's integer ids become `String(user.id)`. None works without network access.

## Shortlist (2–3)

1. **Novu Cloud.** It is the closest fit to shadcn + Tailwind v4, because `appearance.elements` takes Tailwind class strings. It has a full headless hooks layer, the cheapest paid step ($30), Dev and Prod environments on Free, and simple optional HMAC auth.
2. **Knock.** It has the most mature feed semantics (seen/read/interacted/archived), CSS-variable theming plus `renderItem` and headless hooks, and an explicit sandbox mode. Enhanced security is optional per environment. The catches are a $250 paid step and in-app messages counting toward the 10k.
3. **SuprSend.** It has a cheap first paid tier, a full React component set with render props and headless hooks, and archive and preferences. Free tier branding and a recently deprecated React package are the watch-outs.

Courier was not shortlisted because Shadow DOM blocks Tailwind styling and JWT auth is mandatory. Stream was not shortlisted because it has no prebuilt inbox and no archive. MagicBell was not shortlisted because its free tier is 1,000 deliveries with a single project.

## Open questions / things research couldn't settle

- **Local dev without network:** no provider offers an offline or mock mode. Cadence would need its own adapter boundary, like the `.outbox/` email fallback, to run tests and dev without a key. Novu's keyless Inbox still calls the cloud.
- **Synchronous failure handling:**
  - The Knock and Courier SDKs default to 2 retries and a 60s timeout. Inside a server action that could block the request for minutes, so set `maxRetries` and `timeout` low and decide whether a failed notify should fail the action.
  - Novu's default timeout and the SuprSend and MagicBell retry defaults are unverified.
- **Novu Free retention:** does the "24h activity feed retention" affect stored inbox items or only logs?
- **Knock Free limits:** which restrictions on environments and branding apply?
- **SuprSend enhanced security:** is it on or off by default?
- **Courier free plan:** does it include Inbox? And do Tailwind classes apply inside the `renderListItem` output inside the shadow root?
- **Stream pricing version:** does the pricing page reflect Feeds v3?
- **Tailwind v4 coexistence:** whether each vendor's bundled CSS conflicts with Tailwind v4 layers was not tested.

## Sources

- Knock: https://knock.app/pricing · https://docs.knock.app/manage-your-account/knock-plans · https://docs.knock.app/in-app-ui/security-and-authentication · https://docs.knock.app/in-app-ui/react/feed · https://docs.knock.app/in-app-ui/react/headless/feed · https://docs.knock.app/concepts/users · https://docs.knock.app/concepts/environments · https://docs.knock.app/send-notifications/message-statuses · https://docs.knock.app/api-reference/users/set_preferences · https://github.com/knocklabs/knock-node
- Novu: https://novu.co/pricing · https://docs.novu.co/platform/inbox/prepare-for-production · https://docs.novu.co/platform/inbox/configuration/styling · https://docs.novu.co/platform/inbox/advanced-customization/customize-notification-items · https://docs.novu.co/platform/inbox/headless-mode · https://docs.novu.co/platform/inbox/features/snooze · https://docs.novu.co/platform/inbox/setup-inbox · https://docs.novu.co/platform/concepts/subscribers · https://docs.novu.co/framework/studio · https://docs.novu.co/platform/sdks/javascript · https://github.com/novuhq/novu-ts
- MagicBell: https://www.magicbell.com/pricing · https://www.magicbell.com/docs/libraries/magicbell-react · https://www.magicbell.com/docs/libraries/magicbell-js · https://www.magicbell.com/docs/api/authentication/user · https://www.magicbell.com/docs/primitive/notification · https://www.magicbell.com/docs/primitive/broadcast · https://www.magicbell.com/docs/channels/in_app · https://github.com/magicbell/magicbell-js
- Courier: https://www.courier.com/pricing · https://www.courier.com/docs/platform/inbox/web/react-sdk · https://www.courier.com/docs/sdk-libraries/courier-ui-inbox-web · https://www.courier.com/docs/tutorials/inbox/how-to-send-jwt · https://www.courier.com/docs/sdk-libraries/courier-react-v8-migration-guide · https://www.courier.com/docs/platform/inbox/inbox-overview · https://www.courier.com/docs/platform/content/notification-designer/environments-api-keys/ · https://github.com/trycourier/courier-node
- SuprSend: https://www.suprsend.com/pricing · https://docs.suprsend.com/docs/client-authentication · https://docs.suprsend.com/docs/react-inbox-integration · https://docs.suprsend.com/docs/react-customising-feed · https://docs.suprsend.com/docs/react-sdk-headless-feed · https://docs.suprsend.com/docs/preferences-react-headless · https://docs.suprsend.com/docs/user-preferences · https://docs.suprsend.com/docs/developer/api-keys · https://github.com/suprsend/suprsend-node-sdk
- Stream: https://getstream.io/activity-feeds/pricing/ · https://getstream.io/activity-feeds/docs/react/ · https://getstream.io/activity-feeds/docs/react/notification-feeds/ · https://getstream.io/activity-feeds/docs/node/notification-feeds/ · https://getstream.io/activity-feeds/docs/node/tokens-and-authentication
- OneSignal: https://documentation.onesignal.com/docs/en/create-an-activity-feed · https://documentation.onesignal.com/docs/en/in-app-messages-setup
- npm registry (versions, peer deps, deprecations, tarball source), queried 2026-11-11: `@knocklabs/react`, `@knocklabs/node`, `@novu/react`, `@novu/api`, `@magicbell/react`, `@magicbell/react-headless`, `magicbell-js`, `@trycourier/courier-react`, `@trycourier/courier-react-components`, `@trycourier/courier-ui-core`, `@trycourier/courier`, `@suprsend/react`, `@suprsend/react-inbox`, `@suprsend/node-sdk`, `@stream-io/feeds-react-sdk`, `@stream-io/node-sdk`, `@engagespot/node`, `@engagespot/react-component`
