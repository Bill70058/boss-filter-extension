// ===================== BOSS直聘 AI筛选助手 v1.4 =====================
// 同时支持推荐页(li.card-item)和搜索页(li.geek-info-card)

const log = (...a) => console.log('[AI筛选]', ...a);

function makeCardHelpers(card) {
  // 辅助函数：取第一个匹配元素的文本
  const t = (sel) => {
    const el = card.querySelector(sel);
    return el ? el.innerText.trim() : '';
  };
  // 辅助函数：取所有匹配元素的文本数组
  const all = (sel) => Array.from(card.querySelectorAll(sel)).map(e => e.innerText.trim()).filter(Boolean);
  return { t, all };
}

function parseRecommendCard(card) {
  const { t, all } = makeCardHelpers(card);

  // 基本信息行：.base-info 下有多个 span，分别是 年龄/经验/学历/状态
  const baseSpans = all('.base-info span');
  const age        = baseSpans[0] || '';
  const experience = baseSpans[1] || '';
  const education  = baseSpans[2] || '';
  const status     = baseSpans[3] || '';

  // 期望：城市 + 职位
  const expectSpans = all('.expect-wrap .join-text-wrap span');
  const city    = expectSpans[0] || '';
  const jobType = expectSpans[1] || '';

  // 薪资期望
  const salary = t('.salary-wrap span');

  // 优势描述
  const description = t('.geek-desc .content');

  // 技能标签
  const tags = all('.tag-item');

  // 工作经历（时间线）
  const workExps = [];
  card.querySelectorAll('.work-exps .timeline-item').forEach(item => {
    const spans = Array.from(item.querySelectorAll('.join-text-wrap span')).map(s => s.innerText.trim());
    // time wrap: spans[0]-spans[1] = 时间段
    // content wrap: spans[2]=公司, spans[3]=职位
    const timeSpans = Array.from(item.querySelectorAll('.time span')).map(s => s.innerText.trim());
    const contentSpans = Array.from(item.querySelectorAll('.content span')).map(s => s.innerText.trim());
    const period  = timeSpans.filter(Boolean).join(' - ');
    const company = contentSpans[0] || '';
    const role    = contentSpans[1] || '';
    if (company) workExps.push(`${period} | ${company} · ${role}`);
  });

  // 教育经历
  const eduExps = [];
  card.querySelectorAll('.edu-exps .timeline-item').forEach(item => {
    const timeSpans    = Array.from(item.querySelectorAll('.time span')).map(s => s.innerText.trim());
    const contentSpans = Array.from(item.querySelectorAll('.content span')).map(s => s.innerText.trim());
    const period  = timeSpans.filter(Boolean).join(' - ');
    const school  = contentSpans[0] || '';
    const major   = contentSpans[1] || '';
    const degree  = contentSpans[2] || '';
    if (school) eduExps.push(`${period} | ${school} · ${major} · ${degree}`);
  });

  // BOSS平台亮点（部分候选人有平台推荐理由）
  const highlight = t('.recommend-reason .text, .highlight-info .text');

  return {
    name: t('.name'),
    salary,
    age,
    experience,
    education,
    status,
    city,
    jobType,
    description,
    tags,
    workExps,
    eduExps,
    highlight,
    // geekId 用于将来点击获取详细简历
    geekId: card.querySelector('.card-inner')?.getAttribute('data-geekid') || ''
  };
}

function parseSearchCard(card) {
  const { t, all } = makeCardHelpers(card);
  const labels = all('.info-labels .label-text');

  let age = '';
  let experience = '';
  let education = '';
  let status = '';
  let salary = '';

  labels.forEach((txt) => {
    if (!txt) return;
    if (!age && /\d+\s*岁/.test(txt)) { age = txt; return; }
    if (!experience && (/年/.test(txt) || txt.includes('应届'))) { experience = txt; return; }
    if (!education && /(博士|硕士|本科|大专|专科|中专|高中)/.test(txt)) { education = txt; return; }
    if (!status && /(在职|离职|到岗|考虑机会)/.test(txt)) { status = txt; return; }
    if (!salary && /(\d+\s*-\s*\d+\s*K|面议)/i.test(txt)) { salary = txt; }
  });

  const expectRaw = all('.expect-exp-box li span');
  const expectSpans = expectRaw.filter((txt) => !['期望', '期望城市', '最近关注'].includes(txt));
  const city = expectSpans[0] || '';
  const jobType = expectSpans[1] || '';

  const workExps = [];
  card.querySelectorAll('.work-exp-box .work-exp-item').forEach((item) => {
    const parts = Array.from(item.querySelectorAll('.t-tooltip-slot > div, .t-tooltip-slot'))
      .map((el) => el.innerText.trim())
      .filter(Boolean);
    const company = parts[0] || '';
    const role = parts[1] || '';
    if (company || role) {
      workExps.push(`${company}${role ? ` · ${role}` : ''}`);
    }
  });

  const eduExps = [];
  card.querySelectorAll('.edu-exp-box li').forEach((item) => {
    const parts = Array.from(item.querySelectorAll('.t-tooltip-slot > div, .t-tooltip-slot'))
      .map((el) => el.innerText.trim())
      .filter(Boolean);
    const school = parts[0] || '';
    const major = parts[1] || '';
    if (school || major) {
      eduExps.push(`${school}${major ? ` · ${major}` : ''}`);
    }
  });

  const tags = all('.card-labels .card-label');
  const geekLink = card.querySelector('a[data-expect], a[data-jid]');

  return {
    name: t('.name .name-label') || t('.name'),
    salary,
    age,
    experience,
    education,
    status,
    city,
    jobType,
    description: t('.info-detail'),
    tags,
    workExps,
    eduExps,
    highlight: t('.recommend-reason .reason-text'),
    geekId: geekLink?.getAttribute('data-expect') || geekLink?.getAttribute('data-jid') || ''
  };
}

// ===================== 精准解析卡片（基于真实DOM结构）=====================
function parseCard(card) {
  if (card.matches('li.geek-info-card')) {
    return parseSearchCard(card);
  }
  return parseRecommendCard(card);
}

// ===================== 格式化候选人信息供AI分析 =====================
function formatCandidateForAI(info) {
  return `
姓名：${info.name}
年龄/经验/学历/状态：${info.age} / ${info.experience} / ${info.education} / ${info.status}
期望职位/城市：${info.jobType} / ${info.city}
期望薪资：${info.salary}
技能标签：${info.tags.join('、') || '无'}

【工作经历】
${info.workExps.length ? info.workExps.join('\n') : '无'}

【教育经历】
${info.eduExps.length ? info.eduExps.join('\n') : '无'}

【自我优势描述】
${info.description || '无'}

【平台推荐亮点】
${info.highlight || '无'}
`.trim();
}

// ===================== 找候选人卡片 =====================
function findCandidateCards() {
  const cards = Array.from(document.querySelectorAll('li.card-item, li.geek-info-card'));
  if (cards.length >= 1) {
    const recommendCount = cards.filter(card => card.matches('li.card-item')).length;
    const searchCount = cards.filter(card => card.matches('li.geek-info-card')).length;
    log(`✅ 找到 ${cards.length} 张候选人卡片 (推荐:${recommendCount}, 搜索:${searchCount})`);
    return cards;
  }
  log('❌ 未找到候选人卡片（li.card-item / li.geek-info-card）');
  return [];
}

// ===================== 等待Vue渲染 =====================
function waitForCards(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let cards = findCandidateCards();
    if (cards.length >= 1) { resolve(cards); return; }

    log('等待候选人列表渲染...');
    let resolved = false;
    const deadline = Date.now() + timeoutMs;

    const done = (c) => { if (!resolved) { resolved = true; observer.disconnect(); clearInterval(timer); resolve(c); } };
    const fail = () => { if (!resolved) { resolved = true; observer.disconnect(); clearInterval(timer); reject(new Error('候选人列表未出现（超时15秒），请确认页面已加载完毕')); } };

    const check = () => {
      const c = findCandidateCards();
      if (c.length >= 1) done(c);
      else if (Date.now() > deadline) fail();
    };

    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = setInterval(check, 500);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCardUniqueKey(card) {
  const link = card.querySelector('a[data-lid], a[data-expect], a[data-jid]');
  const byAttr = link?.getAttribute('data-lid')
    || link?.getAttribute('data-expect')
    || link?.getAttribute('data-jid')
    || card.querySelector('.card-inner')?.getAttribute('data-geekid');
  return byAttr || card.innerText.trim().slice(0, 120);
}

function getScrollContainer(card) {
  let el = card;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 20) {
      return el;
    }
    el = el.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function scrollToBottom(container) {
  if (container === document.body || container === document.documentElement || container === document.scrollingElement) {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  } else {
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }
}

function waitForMoreCards(prevCount, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const deadline = Date.now() + timeoutMs;

    const done = () => {
      if (resolved) return;
      resolved = true;
      observer.disconnect();
      clearInterval(timer);
      resolve(true);
    };
    const fail = () => {
      if (resolved) return;
      resolved = true;
      observer.disconnect();
      clearInterval(timer);
      reject(new Error('未检测到新候选人卡片'));
    };
    const check = () => {
      const now = findCandidateCards().length;
      if (now > prevCount) done();
      else if (Date.now() > deadline) fail();
    };

    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = setInterval(check, 400);
    check();
  });
}

async function autoScrollAndLoadMore(prevCount) {
  const sampleCard = findCandidateCards()[0];
  const container = sampleCard ? getScrollContainer(sampleCard) : (document.scrollingElement || document.documentElement);

  // 连续推到底，兼容部分页面的懒加载阈值触发
  for (let i = 0; i < 3; i++) {
    scrollToBottom(container);
    await sleep(500);
    if (findCandidateCards().length > prevCount) return true;
  }

  try {
    await waitForMoreCards(prevCount, 8000);
    return true;
  } catch {
    return findCandidateCards().length > prevCount;
  }
}

// ===================== 徽章注入 =====================
let badgeMap = new Map();

function injectBadge(card) {
  card.querySelector('.ai-filter-badge')?.remove();
  const badge = document.createElement('span');
  badge.className = 'ai-filter-badge';
  badge.dataset.state = 'loading';
  badge.innerHTML = '<span class="badge-spinner"></span><span class="badge-label">分析中</span>';

  // 不依赖 :has，直接在 hover 时提升当前卡片层级，兼容复杂层叠场景
  badge.addEventListener('mouseenter', () => card.classList.add('ai-hovering'));
  badge.addEventListener('mouseleave', () => card.classList.remove('ai-hovering'));

  // 插在名字后面
  const nameEl = card.querySelector('.name');
  if (nameEl) {
    nameEl.insertAdjacentElement('afterend', badge);
  } else {
    card.prepend(badge);
  }

  badgeMap.set(card, badge);
  return badge;
}

function updateBadge(card, result, displayMode, threshold) {
  const badge = badgeMap.get(card);
  if (!badge) return;

  const { score, reason, risks } = result;
  const level = score >= 80 ? 'high' : score >= (threshold || 60) ? 'mid' : 'low';
  const labels = { high: '强推', mid: '可考虑', low: '不推荐' };

  badge.dataset.state = level;
  badge.innerHTML = `
    <span class="badge-score">${score}</span>
    <span class="badge-label">${labels[level]}</span>
    <span class="ai-filter-tooltip">
      <div class="tip-score">AI评分：<strong>${score}</strong> 分</div>
      ${reason ? `<div class="tip-reason">✅ ${reason}</div>` : ''}
      ${risks && risks !== 'null' ? `<div class="tip-risk">⚠️ ${risks}</div>` : ''}
    </span>
  `;

  card.classList.remove('ai-highlight', 'ai-dimmed');
  if (displayMode === 'highlight' && level === 'high') card.classList.add('ai-highlight');
  else if (displayMode === 'collapse' && level === 'low') card.classList.add('ai-dimmed');
}

function clearAllBadges() {
  document.querySelectorAll('.ai-filter-badge').forEach(b => b.remove());
  document.querySelectorAll('.ai-highlight, .ai-dimmed, .ai-hovering').forEach(el => {
    el.classList.remove('ai-highlight', 'ai-dimmed', 'ai-hovering');
  });
  badgeMap.clear();
}

// ===================== DeepSeek API =====================
async function callDeepSeek({ apiKey, model, jobTitle, jobDesc, candidateInfo, weights }) {
  const weightStr = (weights || []).map(w => `${w.name}（${w.weight}%）`).join('、') || '综合评估';
  const candidateText = formatCandidateForAI(candidateInfo);

  const prompt = `你是资深HR，根据以下信息评估候选人与岗位的匹配程度。

【招聘岗位】${jobTitle || '未指定'}
【岗位要求】${jobDesc || '未指定'}

【候选人简历】
${candidateText}

【评分维度权重】${weightStr}

请综合以上信息打分，仅输出以下JSON，不要有任何其他文字：
{"score":75,"reason":"推荐理由（1-2句，突出匹配点）","risks":"风险或不足（1-2句，如无则填null）"}`;

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 250
    })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `API HTTP ${resp.status}`);
  }

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '';
  log('AI返回:', text.slice(0, 200));

  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error('AI返回格式异常');
  return JSON.parse(match[0]);
}

// ===================== 并发控制 =====================
async function processWithConcurrency(tasks, concurrency = 4) {
  const results = new Array(tasks.length);
  let idx = 0;
  const worker = async () => {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

// ===================== 主流程 =====================
let isRunning = false;

async function startFilter(payload) {
  if (isRunning) return;
  isRunning = true;

  try {
    clearAllBadges();

    try {
      await waitForCards(15000);
    } catch (e) {
      chrome.runtime.sendMessage({ type: 'FILTER_ERROR', error: e.message });
      return;
    }

    const {
      apiKey, model, concurrency, displayMode, threshold, weights, jobTitle, jobDesc, autoScrollTimes = 0
    } = payload;
    const scrollRounds = Math.max(0, parseInt(autoScrollTimes, 10) || 0);
    let done = 0;
    let pass = 0;
    let fail = 0;
    let total = findCandidateCards().length;
    const processed = new Set();

    chrome.runtime.sendMessage({ type: 'FILTER_PROGRESS', done: 0, total });
    log(`开始自动筛选，自动滚动次数: ${scrollRounds}`);

    for (let round = 0; round <= scrollRounds; round++) {
      const allCards = findCandidateCards();
      const newCards = [];

      allCards.forEach(card => {
        const key = getCardUniqueKey(card);
        if (!processed.has(key)) {
          processed.add(key);
          newCards.push(card);
        }
      });

      if (newCards.length > 0) {
        total = Math.max(total, done + newCards.length);
        chrome.runtime.sendMessage({ type: 'FILTER_PROGRESS', done, total });
        newCards.forEach(card => injectBadge(card));

        const tasks = newCards.map((card, i) => async () => {
          const info = parseCard(card);
          log(`[轮次${round + 1}] [${i + 1}/${newCards.length}] ${info.name} | ${info.experience} | ${info.education}`);

          try {
            const result = await callDeepSeek({ apiKey, model, jobTitle, jobDesc, candidateInfo: info, weights });
            updateBadge(card, result, displayMode, threshold);
            done++;
            if (result.score >= (threshold || 60)) pass++;
            else fail++;
            chrome.runtime.sendMessage({ type: 'FILTER_PROGRESS', done, total });
            return { ok: true };
          } catch (err) {
            log(`[轮次${round + 1}] 失败:`, err.message);
            const badge = badgeMap.get(card);
            if (badge) {
              badge.dataset.state = 'error';
              badge.innerHTML = `<span class="badge-label" title="${err.message}">⚠️ 失败</span>`;
            }
            done++;
            chrome.runtime.sendMessage({ type: 'FILTER_PROGRESS', done, total });
            return { ok: false };
          }
        });

        await processWithConcurrency(tasks, concurrency || 4);
      } else {
        log(`[轮次${round + 1}] 无新增候选人`);
      }

      if (round === scrollRounds) break;

      const before = findCandidateCards().length;
      log(`自动滚动加载第 ${round + 1}/${scrollRounds} 次，滚动前候选人: ${before}`);
      const loaded = await autoScrollAndLoadMore(before);
      const after = findCandidateCards().length;
      total = Math.max(total, after, done);
      log(`自动滚动完成，第 ${round + 1}/${scrollRounds} 次，候选人: ${before} -> ${after}${loaded ? '' : '（未检测到新增）'}`);

      if (!loaded && after <= before) {
        log('未加载到更多候选人，提前结束后续滚动轮次');
        break;
      }
    }

    chrome.runtime.sendMessage({ type: 'FILTER_DONE', total: done, pass, fail });

  } catch (err) {
    chrome.runtime.sendMessage({ type: 'FILTER_ERROR', error: err.message });
  } finally {
    isRunning = false;
  }
}

// ===================== 消息监听 =====================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_FILTER') {
    sendResponse({ ok: true });
    startFilter(msg.payload);
  }
  return true;
});

log('v1.5 已加载，路径:', location.pathname);

// ===================== Frame 自检：只有包含候选人的 frame 才工作 =====================
// 在任意 frame 加载后，先打印 frame 信息方便排查
log(
  `frame加载: ${location.href.slice(0, 80)}, 推荐卡片: ${document.querySelectorAll('li.card-item').length}, 搜索卡片: ${document.querySelectorAll('li.geek-info-card').length}`
);
