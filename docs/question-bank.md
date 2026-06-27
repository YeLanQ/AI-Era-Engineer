# 题库系统

## 架构概述

题库系统从 **JSON 文件 → SQLite 数据库** 演进。`questions/` 目录下的 JSON 文件为原始数据源，首次启动时由 `seed-db.js` 导入到 SQLite，之后所有 CRUD 操作均通过数据库进行。

```
questions/domains.json  ───┐
questions/data/{code}.json ─┤──→ seed-db.js → data/question-bank.db
                            │                    ↑
                     Web 题库管理页面 ────────────┘
                     (question-bank.html)
```

## 数据库表结构

### `domains` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `name` | TEXT | 领域显示名称（如"电商"） |
| `code` | TEXT UNIQUE | 领域编码，用于题目关联（如"电商"） |
| `description` | TEXT | 领域简要描述 |
| `scenario` | TEXT | 评估场景描述文本 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |

### `questions` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | 题目 ID（如 `L1_001`） |
| `domain_code` | TEXT FK | 关联 `domains.code`，级联删除 |
| `level` | TEXT | 等级（L1/L4/L7/L10） |
| `title` | TEXT | 题目标题 |
| `difficulty` | TEXT | 难度（入门/中级/高级/专家） |
| `ai_allowed` | INTEGER | 是否允许使用 AI（0/1） |
| `time_limit` | INTEGER | 建议用时（分钟） |
| `description` | TEXT | 题目详细描述 |
| `dimensions` | TEXT | 评估维度 JSON 数组（如 `["C","H"]`） |
| `hints` | TEXT | 提示要点 JSON 数组 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |

## 数据源: `questions/` 目录

JSON 文件作为原始数据源，在首次启动时自动导入数据库。

### `questions/domains.json`

定义业务领域场景：

| 领域 | 编码 | 说明 |
|------|------|------|
| 电商 | 电商 | 百万级订单、双十一大促等场景 |
| 金融科技 | 金融科技 | 高并发资金交易、风控等场景 |
| SaaS | SaaS | 多租户架构、订阅管理场景 |
| 传统企业 | 传统企业 | 遗留系统迁移、数字化转型场景 |

### `questions/data/{code}.json`

每个领域 48 道题，按 4 个级别各 12 道分布。

题目 JSON 结构：

```json
{
  "id": "L1_001",
  "level": "L1",
  "title": "修复一个包含NPE的API接口",
  "difficulty": "入门",
  "ai_allowed": true,
  "time_limit": 60,
  "description": "详细描述...",
  "dimensions": ["C", "H"],
  "hints": ["关注边界条件", "确保异常处理完整"]
}
```

## 数据库模块: `src/db.js`

`src/db.js` 封装了所有数据库操作，使用 `sql.js`（SQLite 的纯 JS 实现）。

### 生命周期

```javascript
import { initDB, seedFromJSON, isSeeded } from './db.js'

// 1. 初始化数据库（创建表结构）
await initDB()

// 2. 首次启动时从 JSON 导入
if (!isSeeded()) seedFromJSON()
```

### 领域操作

| 函数 | 说明 |
|------|------|
| `getDomains()` | 返回所有领域 |
| `getDomain(code)` | 按编码查单个领域 |
| `createDomain({name, code, description, scenario})` | 创建领域 |
| `updateDomain(code, data)` | 更新领域 |
| `deleteDomain(code)` | 删除领域（级联删除题目） |

### 题目操作

| 函数 | 说明 |
|------|------|
| `getQuestions({domain?, level?})` | 按条件查询题目 |
| `getQuestion(id)` | 按 ID 查单个题目 |
| `createQuestion(data)` | 创建题目 |
| `updateQuestion(id, data)` | 更新题目 |
| `deleteQuestion(id)` | 删除题目 |
| `getNextQuestionId(domain_code, level)` | 生成下一个题目 ID（如 `L1_013`） |

### 种子数据

```bash
pnpm db:seed    # 手动执行种子导入
```

Web 服务器启动时自动检测并执行种子导入。

## Web 管理页面: `question-bank.html`

访问 `http://localhost:3000/question-bank.html` 打开题库管理界面。

### 功能

- **领域管理** — 左侧面板列出所有领域，支持新建、编辑、删除
- **题目管理** — 右侧表格列出选中领域下的题目，支持按等级筛选和关键词搜索
- **新建题目** — 填写 ID（可自动生成）、等级、标题、难度、时限、评估维度、描述、提示要点
- **删除确认** — 删除领域或题目时弹出确认对话框
- **实时生效** — 修改后自动清除缓存，下次答题时使用最新数据

### 页面导航

各页面底部或顶部均有导航链接：答题系统 ↔ 人工审核 ↔ 题库管理。

## 缓存机制: `src/load-question-bank.js`

```javascript
import { loadDomains, loadQuestions } from './load-question-bank.js'

const domains = loadDomains()                // 读取数据库，结果缓存
const questions = loadQuestions('电商', 'L1', 3)  // 按领域+等级筛选，随机取 3 题
clearQuestionCache()                         // 手动清除缓存（API 修改后自动调用）
```
