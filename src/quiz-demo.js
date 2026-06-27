import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadSkillConfig } from './load-skill-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SAMPLE_ANSWERS = {
  L1: [
    {
      questionId: 'L1_001',
      answer: `## 题目分析
这是一个包含空指针异常的API接口修复问题。需要:
1. 定位NPE发生的位置
2. 添加空值检查
3. 返回合理的错误响应

## 实现方案
\`\`\`java
@RestController
public class UserController {
    @GetMapping("/user/{id}")
    public ResponseEntity<User> getUser(@PathVariable String id) {
        if (id == null || id.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        User user = userService.findById(id);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(user);
    }
}
\`\`\`

## 关键点
- 对输入参数做非空校验
- 对查询结果做非空判断
- 返回合适的HTTP状态码`,
      aiLog: '使用AI助手帮我检查代码中的空指针风险点，然后根据建议添加了防御性编程',
    },
    {
      questionId: 'L1_002',
      answer: `## 分析
需要在现有系统中添加日志记录功能，使用SLF4J+Logback。

## 实现
\`\`\`java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class OrderService {
    private static final Logger log = LoggerFactory.getLogger(OrderService.class);
    
    public void processOrder(Order order) {
        log.info("开始处理订单: {}", order.getId());
        try {
            // 业务逻辑
            log.debug("订单详情: {}", order);
        } catch (Exception e) {
            log.error("订单处理失败: {}", order.getId(), e);
            throw e;
        }
        log.info("订单处理完成: {}", order.getId());
    }
}
\`\`\`

## 要点
- 使用参数化日志避免字符串拼接
- 包含不同级别的日志
- 异常时记录完整堆栈`,
      aiLog: '向AI咨询了最佳日志实践，采用SLF4J作为日志门面',
    },
    {
      questionId: 'L1_003',
      answer: `## 思路
实现快速排序算法，利用AI辅助生成并理解代码。

## 实现
\`\`\`python
def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)

# 测试
arr = [3, 6, 8, 10, 1, 2, 1]
print(quick_sort(arr))  # [1, 1, 2, 3, 6, 8, 10]
\`\`\`

## 复杂度分析
- 时间复杂度: O(n log n) 平均, O(n²) 最坏
- 空间复杂度: O(n)`,
      aiLog: '让AI帮我生成快速排序的多种实现版本，对比了不同方案的优劣',
    },
  ],
  L4: [
    {
      questionId: 'L4_001',
      answer: `## 需求分析
实现用户登录接口，包含JWT令牌生成。需要:
1. 用户身份验证
2. JWT令牌生成与刷新
3. 安全防护

## 设计方案
\`\`\`typescript
interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

async function login(req: LoginRequest): Promise<LoginResponse> {
  // 1. 验证用户凭据
  const user = await authenticateUser(req.username, req.password);
  if (!user) throw new UnauthorizedError('用户名或密码错误');
  
  // 2. 生成JWT
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken, expiresIn: 3600 };
}
\`\`\`

## 安全考虑
- 密码使用bcrypt加密存储
- JWT密钥从环境变量读取
- 添加登录频率限制`,
      aiLog: '第一轮: 让AI生成登录接口基础实现。第二轮: 要求AI补充JWT刷新和安全性。第三轮: 审查AI生成的代码，修复了密钥硬编码问题',
    },
    {
      questionId: 'L4_002',
      answer: `## 分析
需要一个通用的缓存装饰器，支持TTL、缓存key生成等功能。

## 实现
\`\`\`python
import functools
import time
from typing import Optional, Callable

class Cache:
    def __init__(self, ttl: int = 60):
        self._store = {}
        self._ttl = ttl
    
    def get(self, key: str) -> Optional[any]:
        if key in self._store:
            value, expiry = self._store[key]
            if time.time() < expiry:
                return value
            del self._store[key]
        return None
    
    def set(self, key: str, value: any, ttl: Optional[int] = None):
        self._store[key] = (value, time.time() + (ttl or self._ttl))

_cache = Cache()

def cached(ttl: int = 60):
    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            key = f"{func.__name__}:{args}:{kwargs}"
            result = _cache.get(key)
            if result is not None:
                return result
            result = func(*args, **kwargs)
            _cache.set(key, result, ttl)
            return result
        return wrapper
    return decorator

@cached(ttl=120)
def expensive_operation(n):
    return sum(range(n))
\`\`\``,
      aiLog: '让AI生成了基础缓存装饰器，然后我手动添加了内存限制和过期策略',
    },
    {
      questionId: 'L4_003',
      answer: `## CRUD REST API实现
\`\`\`python
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
db = SQLAlchemy(app)

class Item(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    price = db.Column(db.Float, nullable=False)

@app.route('/api/items', methods=['GET'])
def list_items():
    items = Item.query.all()
    return jsonify([{'id': i.id, 'name': i.name, 'price': i.price} for i in items])

@app.route('/api/items', methods=['POST'])
def create_item():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'name is required'}), 400
    item = Item(name=data['name'], price=data.get('price', 0))
    db.session.add(item)
    db.session.commit()
    return jsonify({'id': item.id, 'name': item.name, 'price': item.price}), 201

@app.route('/api/items/<int:id>', methods=['PUT'])
def update_item(id):
    item = Item.query.get_or_404(id)
    data = request.get_json()
    item.name = data.get('name', item.name)
    item.price = data.get('price', item.price)
    db.session.commit()
    return jsonify({'id': item.id, 'name': item.name, 'price': item.price})

@app.route('/api/items/<int:id>', methods=['DELETE'])
def delete_item(id):
    item = Item.query.get_or_404(id)
    db.session.delete(item)
    db.session.commit()
    return '', 204
\`\`\``,
      aiLog: '与AI多轮协作完成了CRUD API，重点讨论了输入验证和错误处理',
    },
  ],
};

function loadConfig() {
  return loadSkillConfig();
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export async function runDemo() {
  console.log('🎯 运行示例评估演示...\n');

  const config = loadConfig();
  const { assess, toRadarData } = await import('./scorer.js');

  const levels = ['L1', 'L4'];
  const domains = ['电商', '金融科技'];
  const names = ['张三', '李四'];

  const reportDir = join(__dirname, '..', '.cache', 'data');
  ensureDir(reportDir);

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const name = names[i];
    const domain = domains[i];
    const answers = SAMPLE_ANSWERS[level];

    const result = assess(answers, level);
    const radarData = toRadarData(result.dimension_scores);

    const reportData = {
      candidate: name,
      level,
      domain,
      date: new Date().toISOString().split('T')[0],
      result,
      radar_data: radarData,
      feedback: result.feedback,
      answers,
    };

    const jsonPath = join(reportDir, `${name}_assessment.json`);
    writeFileSync(jsonPath, JSON.stringify(reportData, null, 2), 'utf-8');
    console.log(`✅ ${name} (${level}) - 总分: ${result.total_score} | 等级: ${result.grade}`);

    const assessmentJsonPath = join(reportDir, 'assessment.json');
    writeFileSync(assessmentJsonPath, JSON.stringify(reportData, null, 2), 'utf-8');

    const { execSync } = await import('child_process');
    try {
      execSync(`node "${join(__dirname, 'generate-report.js')}" --input "${assessmentJsonPath}"`, { stdio: 'pipe' });
    } catch { }
  }

  console.log('\n📊 演示评估完成！数据已保存到 data/ 目录');
  console.log('📄 HTML报告已生成到 reports/ 目录');
  console.log('\n运行 pnpm quiz 开始交互式作答');
}

runDemo().catch(console.error);
