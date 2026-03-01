# 🎯 BOSS直聘 · AI候选人筛选助手

> 基于 DeepSeek AI，在 BOSS直聘搜索页/推荐页快速筛选匹配候选人

---

## 📦 安装步骤

1. **下载插件**：解压 `boss-filter-extension` 文件夹到本地任意位置

2. **生成图标**（可选）：
   - 在 `icons/` 文件夹中放置三个 PNG 图标：`icon16.png`、`icon48.png`、`icon128.png`
   - 也可以先跳过，Chrome 会用默认图标

3. **安装到 Chrome**：
   - 打开 Chrome，地址栏输入：`chrome://extensions/`
   - 右上角开启「开发者模式」
   - 点击「加载已解压的扩展程序」
   - 选择 `boss-filter-extension` 文件夹

4. **配置 API Key**：
   - 点击浏览器右上角插件图标 🎯
   - 切换到「设置」Tab
   - 填入 DeepSeek API Key（格式：`sk-xxxxxxx`）
   - 点击「保存设置」

---

## 🚀 使用方法

1. 打开 [BOSS直聘](https://www.zhipin.com) 并搜索候选人
2. 点击插件图标，在「筛选」Tab 填写岗位需求
3. 可选：在「权重配置」Tab 调整各维度权重
4. 点击「开始AI筛选」
5. 等待分析完成，查看候选人卡片上的评分徽章

---

## 🎨 评分说明

| 颜色 | 含义 | 分数段 |
|------|------|--------|
| 🟢 绿色「强推」 | 高度匹配 | 80-100 |
| 🔵 蓝色「可考虑」 | 基本匹配 | 60-79（默认门槛） |
| 🔴 红色「不推荐」 | 匹配度低 | 0-59 |

> 悬停徽章可查看 AI 推荐理由和风险提示

---

## ⚙️ 配置项说明

| 配置 | 说明 |
|------|------|
| API Key | DeepSeek API 密钥，本地存储不上传 |
| AI 模型 | `deepseek-chat` 快速推荐；`deepseek-reasoner` 推理更强但较慢 |
| 并发请求数 | 同时处理候选人数量，建议 4（避免触发限流） |
| 最低匹配分 | 低于此分候选人将被标红或折叠，默认 60 |
| 展示方式 | 仅徽章 / 高亮优质 / 折叠低分 |
| 权重配置 | 技能匹配、工作经验、学历、稳定性、薪资各维度权重，可自定义 |

---

## ❓ 常见问题

**Q：点击筛选提示"未找到候选人列表"？**
A：请确认当前在 BOSS直聘搜索结果页或推荐页，部分页面 DOM 更新后需要刷新重试。

**Q：如何降低 API 费用？**
A：选择 `deepseek-chat` 模型，并减少单次筛选的候选人数量（滚动前先筛选当前页）。

**Q：分析速度慢？**
A：适当提高并发数（最高 6），或等待网络响应。

---

## 📁 文件结构

```
boss-filter-extension/
├── manifest.json       # 插件配置
├── popup.html          # 设置面板 UI
├── popup.js            # 面板逻辑
├── content.js          # 页面注入脚本（核心）
├── content.css         # 徽章/高亮样式
├── background.js       # Service Worker
├── icons/              # 图标文件夹
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```
# boss-filter-extension
# boss-filter-extension
