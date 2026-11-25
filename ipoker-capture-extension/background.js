chrome.runtime.onMessage.addListener(message => {
  if (message?.type === 'capture-status') chrome.storage.local.set({lastCapture:message.result,lastError:''});
  if (message?.type === 'capture-error') chrome.storage.local.set({lastError:message.error});
});