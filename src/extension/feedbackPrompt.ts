// src/extension/feedbackPrompt.ts
// Feedback prompt helper: track usage, decide when to show the weekly rating/feedback prompt.

const FIRST_USE_KEY = "feedback_first_use_ts";
const USE_COUNT_KEY = "feedback_use_count";
const PROMPT_COUNT_KEY = "feedback_prompt_count";
const LAST_PROMPT_KEY = "feedback_last_prompt_ts";
const DONT_ASK_KEY = "feedback_dont_ask";

const MIN_USES = 5;
const MIN_DAYS = 7 * 24 * 3600 * 1000; // 7 days
const PROMPT_INTERVAL = 7 * 24 * 3600 * 1000; // 7 days
const MAX_PROMPTS = 2;

type PromptState = {
  first: number;
  count: number;
};

export async function recordUseOccurrence(): Promise<PromptState> {
  const now = Date.now();
  const res = await chrome.storage.local.get([FIRST_USE_KEY, USE_COUNT_KEY]);
  const first = res[FIRST_USE_KEY] || now;
  const count = (res[USE_COUNT_KEY] || 0) + 1;
  await chrome.storage.local.set({ [FIRST_USE_KEY]: first, [USE_COUNT_KEY]: count });
  return { first, count };
}

export async function shouldShowPrompt(): Promise<boolean> {
  const now = Date.now();
  const res = await chrome.storage.local.get([FIRST_USE_KEY, USE_COUNT_KEY, PROMPT_COUNT_KEY, LAST_PROMPT_KEY, DONT_ASK_KEY]);
  if (res[DONT_ASK_KEY]) return false;
  const useCount = res[USE_COUNT_KEY] || 0;
  const first = res[FIRST_USE_KEY] || 0;
  const promptCount = res[PROMPT_COUNT_KEY] || 0;
  const lastPrompt = res[LAST_PROMPT_KEY] || 0;

  if (promptCount >= MAX_PROMPTS) return false;
  if (useCount < MIN_USES) return false;
  if (now - first < MIN_DAYS) return false;
  if (now - lastPrompt < PROMPT_INTERVAL) return false;
  return true;
}

export async function notePromptShown() {
  const now = Date.now();
  const res = await chrome.storage.local.get([PROMPT_COUNT_KEY]);
  const count = (res[PROMPT_COUNT_KEY] || 0) + 1;
  await chrome.storage.local.set({ [PROMPT_COUNT_KEY]: count, [LAST_PROMPT_KEY]: now });
}

export async function setDontAskAgain() {
  await chrome.storage.local.set({ [DONT_ASK_KEY]: true });
}
