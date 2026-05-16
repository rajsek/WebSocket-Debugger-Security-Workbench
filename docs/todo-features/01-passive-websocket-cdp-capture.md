# Passive WebSocket CDP Capture

Status: TODO

Importance: 10/10

Rank: 1

## What The Feature Is

Add a real passive capture mode that uses Chrome DevTools Protocol through the declared `debugger` permission to observe WebSocket traffic from the selected tab.

This should capture the browser's actual socket activity instead of creating a separate extension-owned socket. For bug-bounty preparation, this is the difference between "I can send test frames" and "I can prove what the target application actually did."

## What To Add

- A debugger adapter around `chrome.debugger.attach`, `chrome.debugger.sendCommand`, and `chrome.debugger.onEvent`.
- Capture for `Network.webSocketCreated`, `Network.webSocketWillSendHandshakeRequest`, `Network.webSocketHandshakeResponseReceived`, `Network.webSocketFrameSent`, `Network.webSocketFrameReceived`, `Network.webSocketFrameError`, and `Network.webSocketClosed`.
- A typed capture event model in the domain layer.
- UI state for capture status: detached, attaching, listening, failed, and permission denied.
- A visible passive-capture transcript with socket URL, request id, timestamps, frame direction, opcode/type, payload size, close status, and handshake metadata.
- Tests for CDP event parsing using captured fixture events.
- Manual verification against the local harness and a real loaded extension tab.

## How It Benefits Users

- Users can inspect existing app sockets without changing the app's behavior.
- Reports can include handshake, timing, frame, and close evidence from the browser runtime.
- Users can prove whether a finding came from the page session, extension session, or manually created socket.
- The tool becomes useful for discovery before any active testing happens.

## Why This Importance

10/10 because every serious bug-bounty workflow starts with trustworthy passive evidence. Without this, the tool is a sender/replayer with weak proof.

## Contract Notes

- Keep `debugger` explicit in the manifest and gated in the UI. Chrome does not accept `debugger` in `optional_permissions`.
- Detach cleanly when capture stops, the tab closes, or the user changes target.
- Do not treat `debuggerCaptureEnabled` as active capture until a CDP session is actually attached and receiving events.
