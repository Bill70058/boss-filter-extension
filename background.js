// Service Worker - 消息中转
// content.js -> background -> popup 的消息桥接

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 将 content.js 的进度/结果消息转发给 popup
  if (['FILTER_PROGRESS', 'FILTER_DONE', 'FILTER_ERROR'].includes(msg.type)) {
    // 广播给所有扩展页面（popup）
    chrome.runtime.sendMessage(msg).catch(() => {
      // popup 可能已关闭，忽略错误
    });
  }
  sendResponse({ ok: true });
  return true;
});

console.log('[AI筛选助手] Background service worker 启动 ✅');
