import React from 'react';
import { notePromptShown, setDontAskAgain } from '../extension/feedbackPrompt';

type FeedbackPromptProps = {
  onClose: () => void;
};

const STORE_URL = 'https://chromewebstore.google.com/detail/websocket-debugger-+-secu/nlmbgbnhoampplflhohbionappfpapaa';
const FEEDBACK_URL = 'https://github.com/rajsek/WebSocket-Debugger-Security-Workbench/issues/new';

export function FeedbackPrompt({ onClose }: FeedbackPromptProps) {
  function sendTelemetry(response: string) {
    try {
      chrome.runtime.sendMessage({ action: 'trackFeatureUse', featureName: 'feedback_prompt_response', extra: { choice: response } });
    } catch {
      // Telemetry must never prevent the user from dismissing the prompt.
    }
  }

  async function handleRateNow() {
    sendTelemetry('rate');
    await notePromptShown();
    await setDontAskAgain();
    chrome.tabs.create({ url: STORE_URL });
    onClose();
  }

  async function handleFeedback() {
    sendTelemetry('feedback');
    await notePromptShown();
    await setDontAskAgain();
    chrome.tabs.create({ url: FEEDBACK_URL });
    onClose();
  }

  async function handleLater() {
    sendTelemetry('later');
    await notePromptShown();
    onClose();
  }

  async function handleNever() {
    sendTelemetry('never');
    await setDontAskAgain();
    await notePromptShown();
    onClose();
  }

  return (
    <section className="feedback-prompt" aria-label="Help improve WebSocket Workbench">
      <div className="feedback-prompt-copy">
        <strong>Help improve WebSocket Workbench</strong>
        <p>Would you be willing to rate the extension or share feedback? We&apos;ll only ask a couple times.</p>
      </div>
      <div className="feedback-prompt-actions">
        <button type="button" onClick={handleRateNow}>Rate</button>
        <button type="button" onClick={handleFeedback}>Feedback</button>
        <button type="button" onClick={handleLater}>Later</button>
        <button type="button" onClick={handleNever}>Don&apos;t ask</button>
      </div>
    </section>
  );
}
