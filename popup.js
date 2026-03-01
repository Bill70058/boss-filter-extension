// ===================== 默认配置 =====================
const DEFAULT_WEIGHTS = [
  { key: 'skill',      name: '技能匹配', weight: 35 },
  { key: 'exp',        name: '工作经验', weight: 25 },
  { key: 'edu',        name: '学历背景', weight: 15 },
  { key: 'stability',  name: '稳定性',   weight: 15 },
  { key: 'salary',     name: '薪资匹配', weight: 10 },
];

const TEMPLATES = {
  tech: {
    title: '后端工程师',
    desc: '负责后端服务开发与维护，要求3年以上开发经验，熟悉至少一门主流后端语言（Java/Go/Python），了解常见中间件（Redis/MQ），有高并发或分布式系统经验优先，能独立承接需求，有良好沟通能力。'
  },
  product: {
    title: '产品经理',
    desc: '负责产品规划与迭代，要求2年以上产品工作经验，能独立输出PRD文档，具备数据分析能力，有ToB或ToC产品经验，擅长跨团队协作，逻辑清晰。'
  },
  sales: {
    title: '销售经理',
    desc: '负责客户开发与维护，要求2年以上销售经验，有成熟客户资源优先，擅长商务谈判，目标导向，有抗压能力，有同行业销售经验加分。'
  },
  operate: {
    title: '运营专员',
    desc: '负责用户增长与内容运营，要求1年以上运营经验，熟悉数据分析工具，有社区/内容/活动运营经验，思维活跃，执行力强，有爆款案例优先。'
  },
  design: {
    title: 'UI设计师',
    desc: '负责产品UI/UX设计，要求2年以上设计经验，熟练使用Figma/Sketch，有完整项目案例，理解用户体验设计原则，有动效设计能力加分。'
  },
  hr: {
    title: 'HR招聘专员',
    desc: '负责人才搜寻与招聘流程管理，要求1年以上招聘经验，熟悉各类招聘渠道，有批量招聘或技术岗招聘经验，沟通能力强，有一定抗压能力。'
  }
};

// ===================== 工具函数 =====================
const $ = id => document.getElementById(id);

function setStatus(msg, type = '') {
  const bar = $('status-bar');
  bar.textContent = msg;
  bar.className = 'status-bar' + (type ? ' ' + type : '');
}

function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function setStorage(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

// ===================== 权重管理 =====================
let currentWeights = [...DEFAULT_WEIGHTS];

function renderWeights() {
  const list = $('weight-list');
  list.innerHTML = '';
  currentWeights.forEach((dim, i) => {
    const item = document.createElement('div');
    item.className = 'weight-item';
    item.innerHTML = `
      <span class="dim-name">${dim.name}</span>
      <input type="range" min="0" max="100" value="${dim.weight}" data-index="${i}" />
      <span class="weight-val" id="wval-${i}">${dim.weight}%</span>
    `;
    list.appendChild(item);
  });

  // 绑定滑块事件
  list.querySelectorAll('input[type="range"]').forEach(slider => {
    slider.addEventListener('input', function() {
      const idx = parseInt(this.dataset.index);
      currentWeights[idx].weight = parseInt(this.value);
      $('wval-' + idx).textContent = this.value + '%';
      updateWeightTotal();
    });
  });

  updateWeightTotal();
}

function updateWeightTotal() {
  const total = currentWeights.reduce((s, d) => s + d.weight, 0);
  $('total-val').textContent = total;
  const el = $('weight-total');
  el.className = 'weight-total ' + (total === 100 ? 'ok' : total > 100 ? 'over' : '');
}

// ===================== 历史记录 =====================
async function loadHistory() {
  const { history = [] } = await getStorage(['history']);
  const container = $('history-list');
  if (history.length === 0) {
    container.innerHTML = '<div class="empty-hint">暂无历史记录</div>';
    return;
  }
  container.innerHTML = '';
  history.slice(0, 10).forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="hist-job">${item.title || '未命名岗位'}</div>
      <div class="hist-desc">${item.desc || '无描述'}</div>
    `;
    div.addEventListener('click', () => {
      $('job-title').value = item.title || '';
      $('job-desc').value = item.desc || '';
      setStatus('已填入历史记录', 'info');
    });
    container.appendChild(div);
  });
}

async function saveToHistory(title, desc) {
  const { history = [], historyMax = 10 } = await getStorage(['history', 'historyMax']);
  const newItem = { title, desc, time: Date.now() };
  // 去重
  const filtered = history.filter(h => h.title !== title || h.desc !== desc);
  filtered.unshift(newItem);
  await setStorage({ history: filtered.slice(0, historyMax) });
}

// ===================== 初始化 =====================
async function init() {
  const data = await getStorage([
    'apiKey', 'model', 'concurrency', 'displayMode',
    'historyMax', 'weights', 'threshold', 'autoScrollTimes'
  ]);

  if (data.apiKey) $('api-key').value = data.apiKey;
  if (data.model) $('model-select').value = data.model;
  if (data.concurrency) $('concurrency').value = data.concurrency;
  if (data.displayMode) $('display-mode').value = data.displayMode;
  if (data.autoScrollTimes !== undefined) $('auto-scroll-times').value = String(data.autoScrollTimes);
  if (data.historyMax) $('history-max').value = data.historyMax;
  if (data.threshold !== undefined) $('threshold').value = data.threshold;

  if (data.weights && data.weights.length > 0) {
    currentWeights = data.weights;
  }
  renderWeights();
  loadHistory();

  // 监听来自 content.js 的结果消息
  chrome.runtime.onMessage.addListener(handleMessage);
}

function handleMessage(msg) {
  if (msg.type === 'FILTER_PROGRESS') {
    setStatus(`正在分析 ${msg.done}/${msg.total} ...`, 'info');
    $('stat-total').textContent = msg.total;
  }
  if (msg.type === 'FILTER_DONE') {
    const { pass, fail, total } = msg;
    setStatus(`✅ 完成！共分析 ${total} 人`, 'success');
    $('stat-total').textContent = total;
    $('stat-pass').textContent = pass;
    $('stat-fail').textContent = fail;
    $('result-stats').style.display = 'flex';
    setBtnState(false);
  }
  if (msg.type === 'FILTER_ERROR') {
    setStatus('❌ ' + msg.error, 'error');
    setBtnState(false);
  }
}

// ===================== 事件绑定 =====================

// Tab 切换
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    this.classList.add('active');
    $('tab-' + this.dataset.tab).classList.add('active');
  });
});

// 模板快捷填入
$('template-tags').addEventListener('click', e => {
  const tpl = e.target.dataset.tpl;
  if (!tpl || !TEMPLATES[tpl]) return;
  $('job-title').value = TEMPLATES[tpl].title;
  $('job-desc').value = TEMPLATES[tpl].desc;
  setStatus('已填入模板，请按需修改', 'info');
});

// 显示/隐藏 API Key
$('btn-toggle-key').addEventListener('click', function() {
  const input = $('api-key');
  if (input.type === 'password') {
    input.type = 'text';
    this.textContent = '隐藏';
  } else {
    input.type = 'password';
    this.textContent = '显示';
  }
});

// 保存设置
$('btn-save-settings').addEventListener('click', async () => {
  await setStorage({
    apiKey: $('api-key').value.trim(),
    model: $('model-select').value,
    concurrency: parseInt($('concurrency').value),
    autoScrollTimes: parseInt($('auto-scroll-times').value),
    displayMode: $('display-mode').value,
    historyMax: parseInt($('history-max').value),
    weights: currentWeights,
    threshold: parseInt($('threshold').value)
  });
  setStatus('✅ 设置已保存', 'success');
});

// 恢复默认权重
$('btn-reset-weights').addEventListener('click', () => {
  currentWeights = [...DEFAULT_WEIGHTS];
  renderWeights();
});

// 添加自定义维度
$('btn-add-dim').addEventListener('click', () => {
  const name = $('new-dim-name').value.trim();
  if (!name) return;
  const total = currentWeights.reduce((s, d) => s + d.weight, 0);
  if (total >= 100) {
    setStatus('⚠️ 总权重已达100%，请先降低其他维度', 'error');
    return;
  }
  currentWeights.push({ key: 'custom_' + Date.now(), name, weight: 0 });
  renderWeights();
  $('new-dim-name').value = '';
});

// 开始筛选
function setBtnState(loading) {
  const btn = $('btn-start');
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span><span>分析中...</span>';
  } else {
    btn.disabled = false;
    btn.innerHTML = '<span>🚀</span><span>开始AI筛选</span>';
  }
}

$('btn-start').addEventListener('click', async () => {
  const title = $('job-title').value.trim();
  const desc = $('job-desc').value.trim();
  const threshold = parseInt($('threshold').value) || 60;

  if (!title && !desc) {
    setStatus('请先填写岗位名称或需求描述', 'error');
    return;
  }

  const {
    apiKey,
    model = 'deepseek-chat',
    concurrency = 4,
    autoScrollTimes = 0,
    displayMode = 'highlight',
    weights
  } = await getStorage([
    'apiKey', 'model', 'concurrency', 'autoScrollTimes', 'displayMode', 'weights'
  ]);

  if (!apiKey) {
    setStatus('请先在【设置】中填写 API Key', 'error');
    return;
  }

  // 保存权重（如果在权重tab有修改）
  await setStorage({ weights: currentWeights, threshold });

  // 保存历史
  if (title || desc) await saveToHistory(title, desc);

  setBtnState(true);
  setStatus('正在扫描页面候选人...', 'info');
  $('result-stats').style.display = 'none';

  // 向 content.js 发送筛选指令
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, {
    type: 'START_FILTER',
    payload: {
      jobTitle: title,
      jobDesc: desc,
      apiKey,
      model,
      concurrency,
      autoScrollTimes,
      displayMode,
      threshold,
      weights: currentWeights
    }
  }, response => {
    if (chrome.runtime.lastError) {
      setStatus('❌ 无法连接页面，请刷新BOSS直聘页面后重试', 'error');
      setBtnState(false);
    }
  });
});

init();
