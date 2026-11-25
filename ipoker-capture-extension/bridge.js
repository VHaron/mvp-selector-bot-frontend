(() => {
  if (window.__ipokerCaptureInstalled) return;
  window.__ipokerCaptureInstalled = true;
  const NativeWebSocket = window.WebSocket;
  function WrappedWebSocket(...args) {
    const ws = new NativeWebSocket(...args);
    try {
      const url = String(args[0] || '');
      if (!url.includes('schannel.ipoker.com')) return ws;
      // Forward only server-to-browser frames. Never intercept or transmit
      // client sends: those may contain temporary tokens or session secrets.
      ws.addEventListener('message', event => {
        const data = event.data;
        if (typeof data !== 'string') return;
        window.postMessage({
          __ipokerCapture: true,
          direction: 'received',
          kind: 'websocket',
          url,
          data,
          captured_at: new Date().toISOString()
        }, location.origin);
      });
    } catch {}
    return ws;
  }
  WrappedWebSocket.prototype = NativeWebSocket.prototype;
  Object.setPrototypeOf(WrappedWebSocket, NativeWebSocket);
  for (const key of ['CONNECTING','OPEN','CLOSING','CLOSED']) WrappedWebSocket[key] = NativeWebSocket[key];
  window.WebSocket = WrappedWebSocket;
})();