// Note: drop this into background/service-worker context (manifest v3 service_worker)
const GA_MEASUREMENT_ID = "G-J2W71P0P6R"; // replace
const GA_API_SECRET = "lwPUQ3KoQ2mWu51dIuAVww"; // replace or leave blank if you will proxy
const MEASUREMENT_ENDPOINT = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;

import { v4 as uuidv4 } from "uuid"; // or your small uuid generator

type AnalyticsEvent = {
  name: string;
  params?: Record<string, any>;
};

const CLIENT_ID_KEY = "analytics_client_id";
const OPT_OUT_KEY = "analytics_opt_out";
const USAGE_COUNTER_KEY = "usage_counter";
const SESSION_ID_KEY = "analytics_session_id";
const SESSION_TS_KEY = "analytics_session_ts";
const SESSION_ROTATE_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_ENGAGEMENT_MS = 100; // minimal >0 so GA treats it as engagement

async function getClientId(): Promise<string> {
  const res = await chrome.storage.local.get(CLIENT_ID_KEY);
  if (res && res[CLIENT_ID_KEY]) return res[CLIENT_ID_KEY];
  const id = uuidv4();
  await chrome.storage.local.set({ [CLIENT_ID_KEY]: id });
  return id;
}

async function isOptedOut(): Promise<boolean> {
  const res = await chrome.storage.local.get(OPT_OUT_KEY);
  return !!res[OPT_OUT_KEY];
}

// Rotate session id every 30 minutes so GA4 groups events into sessions
async function getSessionId(): Promise<string> {
  const res = await chrome.storage.local.get([SESSION_ID_KEY, SESSION_TS_KEY]);
  const now = Date.now();
  if (res && res[SESSION_ID_KEY] && res[SESSION_TS_KEY]) {
    const ts = Number(res[SESSION_TS_KEY]) || 0;
    if (now - ts < SESSION_ROTATE_MS) {
      return res[SESSION_ID_KEY];
    }
  }
  const sessionId = uuidv4();
  await chrome.storage.local.set({ [SESSION_ID_KEY]: sessionId, [SESSION_TS_KEY]: now });
  return sessionId;
}

// Helper that ensures each event params contains session_id and engagement_time_msec
async function enrichParamsWithSession(params?: Record<string, any>, extraEngagementMs?: number) {
  const session_id = await getSessionId();
  const engagement_time_msec = typeof extraEngagementMs === "number" ? extraEngagementMs : DEFAULT_ENGAGEMENT_MS;
  return {
    ...(params || {}),
    session_id,
    engagement_time_msec,
  };
}

async function sendEvent(event: AnalyticsEvent, engagementMs?: number) {
  if (await isOptedOut()) return;
  // If api secret is blank, either proxy to your server or skip sending.
  if (!GA_API_SECRET || GA_API_SECRET.includes("REPLACE")) {
    console.warn("GA API secret missing — configure proxy or API secret.");
    return;
  }

  const client_id = await getClientId();
  const params = await enrichParamsWithSession(event.params, engagementMs);

  const payload = {
    client_id,
    events: [
      {
        name: event.name,
        params,
      },
    ],
  };

  try {
    await fetch(MEASUREMENT_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("Analytics send failed", err);
  }
}

// Convenience analytic events
export async function trackFeatureUse(featureName: string, extra?: Record<string, any>) {
  await sendEvent({ name: "feature_use", params: { feature: featureName, ...extra } });
  // bump usage counter
  const s = await chrome.storage.local.get(USAGE_COUNTER_KEY);
  const count = (s[USAGE_COUNTER_KEY] || 0) + 1;
  await chrome.storage.local.set({ [USAGE_COUNTER_KEY]: count });
}

export async function trackPopupOpen() {
  // send a small engagement to mark session active
  await sendEvent({ name: "popup_open" }, 50);
  // store timestamp for duration measurement
  await chrome.storage.local.set({ "_popup_open_ts": Date.now() });
}

export async function trackPopupClose() {
  const s = await chrome.storage.local.get("_popup_open_ts");
  const start = s["_popup_open_ts"];
  if (start) {
    const durationMs = Date.now() - start;
    // send popup session duration as engagement time so GA attributes session time
    await sendEvent({ name: "popup_session_duration", params: { duration_ms: durationMs } }, durationMs);
    await chrome.storage.local.remove("_popup_open_ts");
  } else {
    await sendEvent({ name: "popup_close" });
  }
}

// Optional: call this periodically from UI to add engagement (e.g., every 30s while open)
export async function trackHeartbeat(additionalEngagementMs = 30000) {
  // sends a lightweight heartbeat event that increases engagement_time_msec
  await sendEvent({ name: "engagement_heartbeat", params: {} }, additionalEngagementMs);
}

export async function setUninstallTrackingUrl(baseUrl: string) {
  const client_id = await getClientId();
  const url = `${baseUrl}?client_id=${encodeURIComponent(client_id)}`;
  try {
    chrome.runtime.setUninstallURL(url);
  } catch (e) {
    console.warn("Failed to set uninstall URL", e);
  }
}

export async function setOptOut(value: boolean) {
  await chrome.storage.local.set({ [OPT_OUT_KEY]: value });
}
