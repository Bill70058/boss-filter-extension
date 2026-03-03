// ===================== BOSS直聘 AI筛选助手 v1.4 =====================
// 同时支持推荐页(li.card-item)和搜索页(li.geek-info-card)

const log = (...a) => console.log('[AI筛选]', ...a);

function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function setStorage(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

function isChatPage() {
  if (location.pathname.startsWith('/web/chat')) return true;
  const hasChatList = !!document.querySelector('.geek-item-wrap .geek-item');
  const hasInput = !!document.querySelector('textarea, div[contenteditable="true"]');
  const hasSend = !!findSendButton();
  return hasChatList && hasInput && hasSend;
}

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

function adjustTooltipPlacement(badge) {
  const tooltip = badge.querySelector('.ai-filter-tooltip');
  if (!tooltip) return;

  tooltip.classList.remove('ai-tooltip-up');

  const prevDisplay = tooltip.style.display;
  const prevVisibility = tooltip.style.visibility;
  tooltip.style.visibility = 'hidden';
  tooltip.style.display = 'block';

  const tipRect = tooltip.getBoundingClientRect();
  const badgeRect = badge.getBoundingClientRect();
  const spaceBelow = window.innerHeight - badgeRect.bottom;

  if (tipRect.height + 12 > spaceBelow) {
    tooltip.classList.add('ai-tooltip-up');
  }

  tooltip.style.display = prevDisplay;
  tooltip.style.visibility = prevVisibility;
}

function injectBadge(card) {
  card.querySelector('.ai-filter-badge')?.remove();
  const badge = document.createElement('span');
  badge.className = 'ai-filter-badge';
  badge.dataset.state = 'loading';
  badge.innerHTML = '<span class="badge-spinner"></span><span class="badge-label">分析中</span>';

  // 不依赖 :has，直接在 hover 时提升当前卡片层级，兼容复杂层叠场景
  badge.addEventListener('mouseenter', () => {
    card.classList.add('ai-hovering');
    adjustTooltipPlacement(badge);
  });
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

function getBadgeState(card) {
  return card.querySelector('.ai-filter-badge')?.dataset?.state || '';
}

function isCardAlreadyScored(card) {
  const state = getBadgeState(card);
  return state === 'high' || state === 'mid' || state === 'low';
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
  if (isChatPage()) {
    chrome.runtime.sendMessage({ type: 'FILTER_ERROR', error: '当前在聊天页，请使用自动回复功能' });
    return;
  }
  isRunning = true;

  try {
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
    let skipped = 0;
    let total = findCandidateCards().length;
    const processed = new Set();

    // 保留已评分结果：只重试未评分/失败中的卡片
    findCandidateCards().forEach((card) => {
      const key = getCardUniqueKey(card);
      if (isCardAlreadyScored(card)) {
        processed.add(key);
        skipped++;
        return;
      }
      // 清理非完成态徽章，避免重复展示“分析中/失败”
      card.querySelector('.ai-filter-badge')?.remove();
      card.classList.remove('ai-hovering');
      badgeMap.delete(card);
    });

    chrome.runtime.sendMessage({ type: 'FILTER_PROGRESS', done: 0, total });
    log(`开始自动筛选，自动滚动次数: ${scrollRounds}，跳过已评分: ${skipped}`);

    for (let round = 0; round <= scrollRounds; round++) {
      const allCards = findCandidateCards();
      const newCards = [];

      allCards.forEach(card => {
        const key = getCardUniqueKey(card);
        if (processed.has(key)) return;
        if (isCardAlreadyScored(card)) {
          processed.add(key);
          skipped++;
          return;
        }
        processed.add(key);
        newCards.push(card);
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

    chrome.runtime.sendMessage({ type: 'FILTER_DONE', total: done, pass, fail, skipped });

  } catch (err) {
    chrome.runtime.sendMessage({ type: 'FILTER_ERROR', error: err.message });
  } finally {
    isRunning = false;
  }
}

// ===================== 自动回复（未读消息）=====================
let autoReplyRunning = false;
let autoReplyTimer = null;

function parseKeywords(str) {
  return (str || '')
    .split(/[,\n，、;；]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function normalizeText(text) {
  return (text || '').toLowerCase();
}

function extractJobTokens(job) {
  const raw = (job || '').trim();
  if (!raw) return [];
  const parts = raw.split(/[\s/\\\-、，,|]+/).map(s => s.trim()).filter(Boolean);
  const tokens = new Set([raw, ...parts]);
  return Array.from(tokens);
}

function filterPresetsByJobHint(message, presets) {
  const msg = normalizeText(message);
  const withHit = presets.filter(p => {
    const tokens = extractJobTokens(p.job);
    if (!tokens.length) return false;
    return tokens.some(t => msg.includes(normalizeText(t)));
  });
  return withHit.length ? withHit : presets;
}

function filterPresetsByQuestionHint(message, presets) {
  const msg = normalizeText(message);
  const withHit = presets.filter(p => {
    const keys = parseKeywords(p.keywords || '');
    if (!keys.length) return false;
    return keys.some(k => msg.includes(normalizeText(k)));
  });
  if (withHit.length) return withHit;

  // 如果没有关键词命中，只有在“待遇/时间类问题”时才保留无关键词预设
  const isBenefitsQuestion = /(上班时间|待遇|薪资|工资|吃住|包吃|包住|食宿|社保|公积金|休息|休假|加班|排班|月休|倒班)/i
    .test(message || '');
  if (!isBenefitsQuestion) return [];
  return presets.filter(p => !parseKeywords(p.keywords || '').length);
}

function getUnreadChatItems() {
  const items = Array.from(document.querySelectorAll('.geek-item-wrap .geek-item, .geek-item'));
  return items.filter(item => {
    const badge = item.querySelector('.badge-count');
    if (!badge) return false;
    const count = parseInt(badge.innerText.trim(), 10);
    return Number.isNaN(count) ? true : count > 0;
  });
}

function getChatItemMeta(item) {
  return {
    id: item.getAttribute('data-id') || item.id || item.getAttribute('d-c') || '',
    name: item.querySelector('.geek-name')?.innerText.trim() || '',
    job: item.querySelector('.source-job')?.innerText.trim() || '',
    preview: item.querySelector('.push-text')?.innerText.trim() || ''
  };
}

async function callDeepSeekMatch({ apiKey, model, message, presets }) {
  const presetBriefs = presets.map(p => ({
    id: p.id,
    job: p.job || '',
    keywords: parseKeywords(p.keywords || '').slice(0, 10),
    reply: (p.reply || '').slice(0, 80)
  }));

  const prompt = `你是招聘HR助手，请判断候选人消息是否触发任意预设回复。
规则：
1) 如果候选人明确提到岗位名称/岗位关键词，只能匹配岗位一致或高度相关的预设。
2) 如果候选人没有提到岗位，但提到待遇问题（薪资/上班时间/吃住/社保等），可匹配通用或最相关岗位预设。
3) 如果预设包含关键词（keywords），必须与候选人问题意图一致，且至少命中一个关键词；否则返回 null。
4) 如果预设没有关键词，仅当候选人问题是待遇/时间类（薪资/上班时间/吃住/社保/休息/加班等）才可匹配；否则返回 null。
5) 不确定时返回 null，宁可不匹配。

候选人消息：
${message}

预设列表（id/岗位/回复摘要）：
${JSON.stringify(presetBriefs, null, 2)}

如果触发，返回最合适的预设id；如果不触发，返回null。
仅输出JSON，不要有多余文字。
{"match":"preset_id_or_null"}`;

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 120
    })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `API HTTP ${resp.status}`);
  }
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '';
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  const obj = JSON.parse(match[0]);
  const id = obj.match;
  return id && id !== 'null' ? id : null;
}

function matchPresetByKeyword(message, presets) {
  const msg = normalizeText(message);
  for (const p of presets) {
    const keys = parseKeywords(p.keywords);
    if (!keys.length) continue;
    if (keys.some(k => msg.includes(normalizeText(k)))) return p.id;
  }
  return null;
}

async function waitForMessageInput(timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  const isVisible = (el) => !!(el && (el.offsetParent || el.getClientRects().length));

  while (Date.now() < deadline) {
    const textarea = Array.from(document.querySelectorAll('textarea')).find(isVisible);
    if (textarea) return { type: 'textarea', el: textarea };
    const editable = Array.from(document.querySelectorAll('div[contenteditable="true"]')).find(isVisible);
    if (editable) return { type: 'editable', el: editable };
    await sleep(300);
  }
  return null;
}

function findSendButton() {
  const isVisible = (el) => !!(el && (el.offsetParent || el.getClientRects().length));
  const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"]'))
    .filter(isVisible);
  return candidates.find(el => /发送|send/i.test(el.innerText.trim()));
}

function fillMessageInput(input, text) {
  if (input.type === 'textarea') {
    input.el.focus();
    input.el.value = text;
    input.el.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    input.el.focus();
    input.el.innerText = text;
    input.el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

async function sendReply(text) {
  const input = await waitForMessageInput();
  if (!input) throw new Error('未找到消息输入框');
  fillMessageInput(input, text);
  await sleep(200);
  const btn = findSendButton();
  if (!btn) throw new Error('未找到发送按钮');
  btn.click();
  await sleep(400);
}

async function scanAndAutoReply(payload) {
  if (autoReplyRunning) return;
  if (!isChatPage()) {
    chrome.runtime.sendMessage({ type: 'AUTO_REPLY_ERROR', error: '仅在聊天页可使用自动回复' });
    return;
  }
  autoReplyRunning = true;

  try {
    const { apiKey, model, mode = 'ai', presets = [] } = payload || {};
    if (!presets.length) return;
    const normalizedPresets = presets.map((p, i) => ({
      id: p.id || `p_${i}`,
      job: p.job || '',
      keywords: p.keywords || '',
      reply: p.reply || ''
    }));

    const { autoReplyState = {} } = await getStorage(['autoReplyState']);
    const unreadItems = getUnreadChatItems();
    let done = 0;
    let replied = 0;
    let skipped = 0;

    chrome.runtime.sendMessage({ type: 'AUTO_REPLY_PROGRESS', done, total: unreadItems.length });

    for (const item of unreadItems) {
      const meta = getChatItemMeta(item);
      done++;
      if (!meta.preview) {
        skipped++;
        chrome.runtime.sendMessage({ type: 'AUTO_REPLY_PROGRESS', done, total: unreadItems.length });
        continue;
      }
      if (meta.id && autoReplyState[meta.id] === meta.preview) {
        skipped++;
        chrome.runtime.sendMessage({ type: 'AUTO_REPLY_PROGRESS', done, total: unreadItems.length });
        continue;
      }

      let matchedId = null;
    if (mode === 'keyword') {
        let filtered = filterPresetsByJobHint(meta.preview, normalizedPresets);
        filtered = filterPresetsByQuestionHint(meta.preview, filtered);
        matchedId = matchPresetByKeyword(meta.preview, filtered);
      } else {
        if (!apiKey) {
          skipped++;
          chrome.runtime.sendMessage({ type: 'AUTO_REPLY_PROGRESS', done, total: unreadItems.length });
          continue;
        }
        let filtered = filterPresetsByJobHint(meta.preview, normalizedPresets);
        filtered = filterPresetsByQuestionHint(meta.preview, filtered);
        matchedId = await callDeepSeekMatch({ apiKey, model, message: meta.preview, presets: filtered });
      }

      const preset = normalizedPresets.find(p => p.id === matchedId);
      if (!preset || !preset.reply) {
        skipped++;
        chrome.runtime.sendMessage({ type: 'AUTO_REPLY_PROGRESS', done, total: unreadItems.length });
        continue;
      }

      item.scrollIntoView({ block: 'center' });
      item.click();
      await sleep(700);
      await sendReply(preset.reply);
      replied++;
      if (meta.id) autoReplyState[meta.id] = meta.preview;
      chrome.runtime.sendMessage({ type: 'AUTO_REPLY_PROGRESS', done, total: unreadItems.length });
    }

    await setStorage({ autoReplyState });
    chrome.runtime.sendMessage({ type: 'AUTO_REPLY_DONE', replied, skipped });
  } catch (err) {
    chrome.runtime.sendMessage({ type: 'AUTO_REPLY_ERROR', error: err.message });
  } finally {
    autoReplyRunning = false;
  }
}

async function setupAutoReplyWatcher() {
  if (window.top !== window.self) return;
  if (!isChatPage()) return;
  const data = await getStorage(['autoReplyEnabled', 'autoReplyInterval', 'autoReplyMode', 'autoReplyPresets', 'apiKey', 'model']);
  if (!data.autoReplyEnabled) return;
  const intervalSec = Math.max(15, parseInt(data.autoReplyInterval, 10) || 30);
  const payload = {
    apiKey: data.apiKey,
    model: data.model || 'deepseek-chat',
    mode: data.autoReplyMode || 'ai',
    presets: Array.isArray(data.autoReplyPresets) ? data.autoReplyPresets : []
  };
  if (autoReplyTimer) clearInterval(autoReplyTimer);
  autoReplyTimer = setInterval(() => {
    scanAndAutoReply(payload);
  }, intervalSec * 1000);
  scanAndAutoReply(payload);
}

function initFloatingPanel() {
  if (window.top !== window.self) return;
  if (document.getElementById('ai-filter-fab')) return;

  const fab = document.createElement('button');
  fab.id = 'ai-filter-fab';
  fab.type = 'button';
  fab.title = '打开AI筛选助手';
  fab.textContent = '🎯';

  const panel = document.createElement('div');
  panel.id = 'ai-filter-panel';
  panel.innerHTML = `
    <div class="ai-panel-head">
      <span class="ai-panel-title">AI筛选助手</span>
      <button type="button" class="ai-panel-close" aria-label="关闭">×</button>
    </div>
    <iframe class="ai-panel-frame" src="${chrome.runtime.getURL('popup.html')}"></iframe>
  `;

  const closeBtn = panel.querySelector('.ai-panel-close');

  const openPanel = () => {
    panel.classList.add('ai-open');
    fab.classList.add('ai-open');
  };
  const closePanel = () => {
    panel.classList.remove('ai-open');
    fab.classList.remove('ai-open');
  };

  fab.addEventListener('click', openPanel);
  closeBtn?.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('ai-open')) {
      closePanel();
    }
  });

  document.documentElement.appendChild(fab);
  document.documentElement.appendChild(panel);
}

// ===================== 消息监听 =====================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_FILTER') {
    sendResponse({ ok: true });
    startFilter(msg.payload);
  }
  if (msg.type === 'START_AUTO_REPLY') {
    sendResponse({ ok: true });
    scanAndAutoReply(msg.payload);
  }
  return true;
});

log('v1.5 已加载，路径:', location.pathname);

// ===================== Frame 自检：只有包含候选人的 frame 才工作 =====================
// 在任意 frame 加载后，先打印 frame 信息方便排查
log(
  `frame加载: ${location.href.slice(0, 80)}, 推荐卡片: ${document.querySelectorAll('li.card-item').length}, 搜索卡片: ${document.querySelectorAll('li.geek-info-card').length}`
);

initFloatingPanel();
setupAutoReplyWatcher();
