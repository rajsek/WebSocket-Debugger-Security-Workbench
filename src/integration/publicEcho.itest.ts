import { echoProbeMessage, publicEchoSocket } from './targets';

describe('public echo WebSocket integration', () => {
  it('connects to wss://echo.websocket.org and receives the probe echo', async () => {
    const messages = await collectEchoMessages(publicEchoSocket, echoProbeMessage);
    expect(messages).toContain(echoProbeMessage);
  }, 10_000);
});

function collectEchoMessages(url: string, probe: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const messages: string[] = [];
    const timeout = window.setTimeout(() => {
      socket.close();
      reject(new Error(`Timed out waiting for echo from ${url}. Messages: ${messages.join(' | ')}`));
    }, 8_000);

    socket.addEventListener('open', () => socket.send(probe));
    socket.addEventListener('message', (event) => {
      messages.push(String(event.data));
      if (event.data === probe) {
        window.clearTimeout(timeout);
        socket.close();
        resolve(messages);
      }
    });
    socket.addEventListener('error', () => {
      window.clearTimeout(timeout);
      reject(new Error(`WebSocket connection failed for ${url}.`));
    });
  });
}
