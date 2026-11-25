(() => {
  if (window.__ipokerCaptureInstalled) return;
  window.__ipokerCaptureInstalled = true;
  const NativeWebSocket = window.WebSocket;
  function WrappedWebSocket(...args) {
    const ws = new NativeWebSocket(...args);
    try {
      const url = String(args[0] || '');
      if (!url.includes('schannel.ipoker.com')) return ws;
      ws.addEventListener('message', event => {
        let data = event.data;
        if (typeof data !== 'string') return;
        window.postMessage({__ipokerCapture: true, direction: 'received', kind: 'websocket', url, data, captured_at: new Date().toISOString()}, location.origin);
      });
      const originalSend = ws.send.bind(ws);
      ws.send = data => {
        try {
          if (typeof data === 'string') window.postMessage({__ipokerCapture: true, direction: 'sent', kind: 'websocket', url, data, captured_at: new Date().toISOString()}, location.origin);
        } catch {}
        return originalSend(data);
      };
    } catch {}
    return ws;
  }
  WrappedWebSocket.prototype = NativeWebSocket.prototype;
  Object.setPrototypeOf(WrappedWebSocket, NativeWebSocket);
  for (const key of ['CONNECTING','OPEN','CLOSING','CLOSED']) WrappedWebSocket[key] = NativeWebSocket[key];
  window.WebSocket = WrappedWebSocket;
})();