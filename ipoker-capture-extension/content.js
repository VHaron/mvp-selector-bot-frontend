(() => {
  const API = 'https://ipoker-parser-backend-test-testing.up.railway.app/api/admin/ipoker/capture';
  let queue = [], timer = null, sending = false;
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || !event.data?.__ipokerCapture) return;
    queue.push({direction:event.data.direction,kind:event.data.kind,url:event.data.url,data:event.data.data,captured_at:event.data.captured_at});
    if (queue.length >= 25) void flush(); else if (!timer) timer = setTimeout(() => void flush(), 3000);
  });
  async function flush() {
    clearTimeout(timer); timer = null;
    if (sending || !queue.length) return;
    const token = await chrome.storage.local.get('adminToken');
    if (!token.adminToken) return;
    const batch = queue.splice(0, 100); sending = true;
    try {
      const response = await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-Parser-Admin-Token':token.adminToken},body:JSON.stringify({frames:batch})});
      if (!response.ok) throw new Error('HTTP '+response.status);
      const result = await response.json();
      chrome.runtime.sendMessage({type:'capture-status',result});
    } catch (error) {
      queue = batch.concat(queue).slice(-1000);
      chrome.runtime.sendMessage({type:'capture-error',error:String(error)});
    } finally { sending = false; if(queue.length) timer=setTimeout(()=>void flush(),3000); }
  }
  chrome.runtime.onMessage.addListener(message => { if(message?.type==='flush') void flush(); });
})();