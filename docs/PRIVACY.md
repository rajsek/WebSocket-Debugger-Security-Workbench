PRIVACY POLICY — WebSocket Debugger + Security Workbench

Last updated: 2026-08-03

This document explains what telemetry the "WebSocket Debugger + Security Workbench" Chrome extension collects, how it is used, and how you can control it. Include a short privacy summary in your Chrome Web Store listing and link to this document as the Privacy Policy.

1. Summary (short)
- We collect minimal telemetry to improve the extension: anonymized usage events (feature usage, popup opens, session durations), and uninstall events. We do NOT collect your email, account name, full URLs with query strings, or request/response payloads.
- Telemetry is pseudonymous: we generate a random client_id and session_id that cannot be used to directly identify you.
- You may opt out at any time from the extension settings.

2. What we collect
- client_id: a randomly generated UUID stored locally in the extension to identify a device-like installation for aggregated metrics.
- session_id: a rotating UUID used to group events into sessions (rotates every 30 minutes).
- events: event name and minimal parameters describing actions (e.g., feature: "connect_ws", popup_open, popup_session_duration).
- engagement_time_msec: per-event engagement value used to measure session activity.
- uninstall marker: when you uninstall, the extension may call an uninstall URL with the client_id to record the uninstall event.

No PII
- We do not collect or transmit names, emails, user account IDs, or full URLs with query strings. Developers may not add code that sends such data without explicit consent.

3. Why we collect this data
- To understand which features are used and for how long, so we can prioritize improvements and fix reliability issues.
- To detect uninstall rates and correlate them with usage patterns (no PII attached).

4. Where data is sent
- Telemetry is sent to Google Analytics 4 (GA4) using the Measurement Protocol. The extension sends events containing the pseudonymous client_id and session_id.
- If a serverless proxy is used (recommended), events are posted to our proxy which forwards to GA4. The GA API secret is stored server-side only when a proxy is used.
- If you embed the GA API secret in the extension (not recommended), it will be present in the extension bundle (this practice is discouraged).

5. Retention and deletion
- We retain aggregated analytics in GA4 according to Google’s retention settings. Client-level identifiers stored by us (client_id, session_id) are retained only on the user’s device in chrome.storage.local.
- If you request deletion, we will instruct how to clear local data. For server-side stored records (if you deploy a proxy), we will delete records associated with a client_id on request within a reasonable timeframe.

6. Opt-out and controls
- In-extension opt-out: The extension includes a toggle to opt out of analytics. When opted out, no further telemetry is sent.
- Uninstall: Upon uninstall, the browser may invoke a configured uninstall URL that includes the client_id — only to record that the installation was removed. You can disable the uninstall URL by disabling analytics in settings.

7. Security
- We minimize the data sent and strip any fields that look like PII or long free-text before sending.
- Do not embed private API secrets in the extension for production; use a serverless proxy (Cloudflare Workers, Vercel) and store the GA API secret as an environment variable.

8. Contact
If you have questions about privacy, or want to request deletion of telemetry associated with a specific client_id, contact: rajisekar.d@gmail.com

9. Changes to this policy
We may update this policy. The latest version will be published in the repository and linked from the Chrome Web Store listing.
