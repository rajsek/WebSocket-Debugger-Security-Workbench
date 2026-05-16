export interface TestEndpointPreset {
  label: string;
  shortLabel: string;
  url: string;
}

export const testEndpointPresets: TestEndpointPreset[] = [
  { label: 'Echo WebSocket (.org)', shortLabel: 'Echo .org', url: 'wss://echo.websocket.org' },
  { label: 'Echo WebSocket (.in)', shortLabel: 'Echo .in', url: 'wss://echo.websocket.in/' },
  { label: 'Postman raw echo', shortLabel: 'Postman', url: 'wss://ws.postman-echo.com/raw' },
];
