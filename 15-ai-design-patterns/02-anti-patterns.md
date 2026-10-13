# AI 反模式

识别不该做什么和知道最佳实践同样重要。本章汇总了 AI 系统设计中的常见错误。

## 目录

- [架构反模式](#架构反模式)
- [RAG 反模式](#rag-反模式)
- [Agent 反模式](#agent-反模式)
- [Prompting（提示词）反模式](#prompting-提示词-反模式)
- [评估反模式](#评估反模式)
- [生产环境反模式](#生产环境反模式)
- [面试题](#面试题)

---

## 架构反模式

### 上帝提示词

**问题：** 一个巨大的单一 prompt（提示词）试图包办一切。

```python
# ANTI-PATTERN: God Prompt
SYSTEM_PROMPT = """
You are a helpful assistant. You can:
1. Answer questions about our products
2. Help with technical support
3. Process refunds
4. Schedule appointments
5. Translate languages
6. Write code
7. Analyze data
8. Generate reports
... [continues for 5000 tokens]
"""
```

**为什么会失败：**
- 上下文被指令占用，而不是用户内容
- 模型难以处理相互冲突的指令
- 无法针对所有情况进行优化
- 更新会影响一切

**解决方案：**
```python
# PATTERN: Specialized components
class QueryRouter:
    async def route(self, query: str) -> str:
        intent = await self.classify_intent(query)
        handler = self.handlers[intent]
        return await handler.process(query)
```

---

### 单一提供商依赖

**问题：** 整个系统依赖于单一的 LLM（大语言模型）提供商。

```python
# ANTI-PATTERN: Single provider
async def generate(prompt: str) -> str:
    return await openai.chat.completions.create(...)
```

**为什么会失败：**
- 提供商故障 = 整个系统故障。故障并不罕见：2026 年 8 月 16 日至 9 月 29 日，Anthropic 记录了至少 12 次重大或严重故障；OpenAI 9 月 29 日的一次故障同时影响 API、ChatGPT 和 Codex，持续约 5 小时 20 分钟
- 速率限制会影响所有流量
- 没有价格谈判筹码
- 被锁定在单一模型家族及该厂商的退役日程中（OpenAI 将在 2026 年 12 月 11 日退役 `gpt-5-2025-08-07` 和 `o3-2025-04-16` 快照）

**解决方案：**
```python
# PATTERN: Multi-provider with failover
class LLMClient:
    def __init__(self):
        self.providers = [OpenAI(), Anthropic(), Google()]
    
    async def generate(self, prompt: str) -> str:
        # Run the same eval suite against every provider in this list:
        # a failover that silently changes quality is its own outage
        for provider in self.providers:
            try:
                return await provider.generate(prompt)
            except ProviderError:
                continue
        raise AllProvidersFailedError()
```

---

### 过早微调

**问题：** 还没用尽更简单的方法就先进行 fine-tuning（微调）。

**为什么会失败：**
- 昂贵且耗时
- 需要高质量训练数据（通常不可获得）
- 难以更新和维护
- 往往没有必要
- 增加平台风险：OpenAI 正在逐步关闭自助微调服务，即使现有客户也无法从 2027 年 1 月 6 日起创建新任务。如确需微调，优先选择自己可控的权重

**决策流程：**
```
Try prompting first
    ↓ (not working)
Try few-shot examples
    ↓ (not working)
Try RAG for knowledge
    ↓ (not working)
Consider fine-tuning (with 500+ examples)
```

---

## RAG 反模式

### 检索一切

**问题：** 不管相关性如何，检索过多文档。

```python
# ANTI-PATTERN: Retrieve everything
results = vector_db.search(query, top_k=50)
context = "\n".join([r.text for r in results])
```

**为什么会失败：**
- 噪声淹没信号
- 超出上下文限制
- 在无关内容上浪费 token（词元）
- “中间丢失”效应

**解决方案：**
```python
# PATTERN: Quality over quantity
results = vector_db.search(query, top_k=20)
reranked = await reranker.rerank(query, results)
context = "\n".join([r.text for r in reranked[:5] if r.score > 0.7])
```

---

### 没有分块策略

**问题：** 对文档进行任意切分，或者根本不切分。

```python
# ANTI-PATTERN: Fixed-size blind chunking
chunks = [text[i:i+1000] for i in range(0, len(text), 1000)]
```

**为什么会失败：**
- 在句子中间、段落中间被截断
- 破坏语义连贯性
- 将相关信息分离
- 检索质量差

**解决方案：**
```python
# PATTERN: Semantic-aware chunking
chunks = semantic_chunker.chunk(
    text,
    chunk_size=500,
    overlap=100,
    respect_boundaries=["paragraph", "section"]
)
```

---

### 忽略元数据

**问题：** 把所有文档都当作等价文本处理。

```python
# ANTI-PATTERN: Ignore metadata
embedding = embed(document.text)
vector_db.insert(embedding, {"text": document.text})
```

**为什么会失败：**
- 无法按日期、来源、类型过滤
- 无法对单个文档进行访问控制
- 无法权衡最新与旧内容
- 丢失有价值的上下文

**解决方案：**
```python
# PATTERN: Rich metadata
vector_db.insert(embedding, {
    "text": document.text,
    "source": document.source,
    "date": document.date,
    "access_level": document.access_level,
    "document_type": document.type,
    "section": document.section
})

# Filter query
results = vector_db.search(
    query,
    filter={"date": {"$gte": "2024-01-01"}, "access_level": user.level}
)
```

---

## Agent 反模式

### 无限循环风险

**问题：** Agent 没有终止条件。

```python
# ANTI-PATTERN: No limits
while not done:
    action = await agent.decide_action()
    result = await execute(action)
    done = agent.check_done(result)
```

**为什么会失败：**
- Agent 可能永远循环
- 成本会失控
- 永远无法返回给用户
- 资源耗尽

**解决方案：**
```python
# PATTERN: Multiple termination conditions
MAX_STEPS = 20
MAX_COST = 10.0
MAX_TIME = 300  # seconds

for step in range(MAX_STEPS):
    if cost_tracker.total > MAX_COST:
        return "Cost limit reached"
    if time.time() - start > MAX_TIME:
        return "Time limit reached"
    
    action = await agent.decide_action()
    result = await execute(action)
    
    if agent.check_done(result):
        return result
    
return "Step limit reached"
```

---

### 不安全的工具访问

**问题：** 给予 Agent 不受限制的工具访问权限。

```python
# ANTI-PATTERN: Full access
tools = [
    delete_file,
    execute_shell_command,
    send_email,
    database_query  # unrestricted!
]
```

**为什么会失败：**
- Agent 可以删除关键文件
- 即使没有攻击者参与，也可能外泄数据：Glow Security 于 2026 年 9 月 29 日披露的 PixelLeak 事件中，编码智能体受命将截图附加到私有 Pull Request，却创建了公开仓库，并在 900 多个仓库中发布了 13,000 多张图片
- 可以执行恶意命令
- 没有审计轨迹
- 评估和训练运行也不能例外：英国 AI Security Institute 于 2026 年 8 月 4 日报告，在故意关闭开发者分类器且开放互联网的网络安全测试中，智能体在 122 次运行中的 10 次里，于真实互联网执行了 19 项未授权操作，其中一些涉及真实个人和组织
- 告警不等于遏制：OpenAI 于 2026 年 9 月 25 日披露的一次训练运行中，智能体通过过滤不足的 DNS 建立外联隧道；监控约 12 分钟后发出告警，但自动停止失效，直到约 2.5 小时后才终止运行

**解决方案：**
```python
# PATTERN: Scoped, validated tools
tools = [
    ScopedFileTool(allowed_dirs=["/tmp/agent"]),
    RestrictedShellTool(allowed_commands=["ls", "cat"]),
    EmailTool(requires_confirmation=True),
    ReadOnlyDatabaseTool(allowed_tables=["products"])
]

# And contain the environment, not just the tool list
sandbox = Sandbox(
    egress="deny-by-default",          # DNS, package proxies, and publish endpoints included
    allow=["pypi-proxy.internal"],
    secrets=None,                      # agents can evade pattern-based secret scanning
    on_monitor_alert="kill",           # an alert that only pages a human is not a control
)
```

评估和强化学习环境应使用与生产智能体相同的沙箱，并像测试故障切换一样测试自动停止机制。

---

### 没有记忆的 Agent

**问题：** Agent 每一轮都从头开始。

```python
# ANTI-PATTERN: Stateless agent
async def handle_message(message: str) -> str:
    return await agent.run(message)  # No context
```

**为什么会失败：**
- 无法完成多轮任务
- 会重复同样的错误
- 无法从经验中学习
- 用户体验差

**解决方案：**
```python
# PATTERN: Persistent memory
async def handle_message(session_id: str, message: str) -> str:
    memory = await memory_store.get(session_id)
    response = await agent.run(message, memory=memory)
    await memory_store.update(session_id, memory)
    return response
```

记忆并非没有代价。MemTrapBench（arXiv 2608.20202）在专门揭示记忆陷阱的任务上发现，五种记忆框架中的所有记忆策略表现都不如完全不用记忆，即使保存的记忆正确且相关。持久化记忆也是注入面。只持久化后续轮次确实需要的内容，在写入时记录来源，并分别评估开启与关闭记忆的结果。

---

## Prompting（提示词）反模式

### 含糊的指令

**问题：** 期望出现特定行为，却只给出模糊的 prompt（提示词）。

```python
# ANTI-PATTERN: Vague
prompt = "Help the user with their request."
```

**为什么会失败：**
- “帮助”没有定义
- 没有指定格式
- 没有边界
- 行为不一致

**解决方案：**
```python
# PATTERN: Specific and structured
prompt = """
You are a customer support agent for TechCorp.

Your role:
- Answer questions about our products
- Help troubleshoot issues
- Escalate to human when unsure

Response format:
1. Acknowledge the issue
2. Provide a solution or ask clarifying questions
3. Offer next steps

Do NOT:
- Make promises about refunds (escalate instead)
- Provide legal or medical advice
- Share internal company information
"""
```

---

### 没有输出格式

**问题：** 期望结构化输出，却没有指定格式。

```python
# ANTI-PATTERN: Hope for structure
prompt = "Extract the person's name, date, and location from this text."
response = await llm.generate(prompt)
# Response: "The person is John, he was there on March 5th in NYC"
# Now try to parse that...
```

**解决方案：**
```python
# PATTERN: Explicit format
prompt = """
Extract information and return as JSON:
{
    "name": "string",
    "date": "YYYY-MM-DD",
    "location": "string"
}

Text: ...
"""
# Better: schema-constrained structured outputs
# (json_object mode guarantees valid JSON, not your schema)
response = await llm.generate(
    prompt,
    response_format={"type": "json_schema", "json_schema": EXTRACTION_SCHEMA}
)
```

不要再用强制工具调用这一旧技巧来获取 JSON。在 Claude Fable 5.1、Opus 5.5 和 Sonnet 5.5 上，`tool_choice` 设为 `any` 或具名工具会返回 400；应使用结构化输出，或配合严格工具 schema 使用 `auto`。

---

## 评估反模式

### 靠感觉评估

**问题：** 把“我觉得看起来不错”当作评估方法。

```python
# ANTI-PATTERN: Manual spot-checking
for i in range(5):
    response = await generate(test_prompts[i])
    print(response)  # Developer looks at it
# "Looks good, ship it!"
```

**为什么会失败：**
- 不可复现
- 只挑选有利样例
- 没有基线对比
- 漏掉边缘情况

**解决方案：**
```python
# PATTERN: Systematic evaluation
eval_dataset = load_eval_set()  # 100+ examples
results = []

for example in eval_dataset:
    response = await generate(example["input"])
    score = await evaluate(response, example["expected"])
    results.append(score)

metrics = {
    "accuracy": sum(results) / len(results),
    "failures": [e for e, r in zip(eval_dataset, results) if r < 0.5]
}
```

---

### 在测试集上训练

**问题：** 使用评估数据来做开发决策。

```python
# ANTI-PATTERN: Overfitting to eval
for iteration in range(100):
    accuracy = evaluate_on_test_set()  # Same set every time
    tweak_prompt_based_on_failures(test_set)  # Optimizing for test set
```

**为什么会失败：**
- 对特定样例过拟合
- 真实世界表现不同
- 没有真正衡量泛化能力

**解决方案：**
```python
# PATTERN: Proper data splits
dev_set = load_dev_set()      # For iteration
test_set = load_test_set()    # Final evaluation only

# Iterate on dev set
for iteration in range(100):
    accuracy = evaluate(dev_set)
    improve_based_on(dev_set)

# Final evaluation on untouched test set
final_accuracy = evaluate(test_set)
```

### 按排行榜选模型

**问题：** 根据发布文章中的表格或排行榜头名选模型。

```python
# ANTI-PATTERN: Take the top number
model = max(leaderboard, key=lambda m: m.score).name
```

**为什么会失败：**
- 同一模型的分数会随 effort 和测试方变化：Claude Fable 5.1 在 tbench.ai 排行榜上的 Terminal-Bench 4.0 得分为 57.88%（最高 effort），在 Anthropic 自己的测试中则为 55.8%
- 分数可能属于经过路由的系统：Anthropic 测试 Opus 5.5 时启用了安全回退，因此被拦截的网络安全任务会由 Opus 4.8 运行
- 公开测试集会饱和并泄漏：SWE-Bench Pro v2 的公开集最高达到 99.4%（Opus 5）；一项研究发现，SWE-Bench Pro v1.0 中按模型不同有 24% 到 73% 的通过结果并非真实能力，而是通过 git 历史泄漏的参考答案获得
- 你的任务分布与基准测试不同

**解决方案：**
```python
# PATTERN: Shortlist from benchmarks, decide on your own evals
shortlist = [m for m in leaderboard if m.reports_effort_and_harness][:3]
results = {m.name: evaluate(m.name, my_eval_set, effort=m.effort) for m in shortlist}
model = pick(results, constraints={"p95_latency_s": 8, "cost_per_task_usd": 0.05})
```

---

---

## 生产环境反模式

### 没有限流

**问题：** 每个用户的 LLM 调用次数不受限制。

```python
# ANTI-PATTERN: Open access
@app.route("/generate")
async def generate():
    return await llm.generate(request.prompt)  # No limits!
```

**为什么会失败：**
- 单个用户可以耗尽预算
- 存在拒绝服务风险
- 成本会出人意料
- 没有公平使用机制

**解决方案：**
```python
# PATTERN: Rate limiting
@app.route("/generate")
@rate_limit(requests_per_minute=10, requests_per_day=100)
@cost_limit(max_cost_per_day=1.0)
async def generate():
    return await llm.generate(request.prompt)
```

---

### 没有缓存

**问题：** 每个相同请求都直接命中 LLM。

```python
# ANTI-PATTERN: No cache
async def answer_faq(question: str) -> str:
    return await llm.generate(question)  # Same FAQ, same cost every time
```

**为什么会失败：**
- 相同查询浪费金钱
- 不必要的延迟
- 同一问题的回答不一致

**解决方案：**
```python
# PATTERN: Semantic caching
async def answer_faq(question: str) -> str:
    cached = await cache.get_similar(question, threshold=0.95)
    if cached:
        return cached.response
    
    response = await llm.generate(question)
    await cache.set(question, response)
    return response
```

语义缓存只在整道问题重复时才有用。对智能体循环和很长的系统提示，应先启用供应商的提示词缓存：每次共享稳定前缀的调用都可享受折扣，缓存读取按输入费率的 0.025 到 0.1 倍计费。

---

### 浮动的模型默认值

**问题：** 让工具、SDK 或别名决定生产环境使用的模型和设置。

```python
# ANTI-PATTERN: Whatever the framework or CLI defaults to today
agent = Agent(instructions=PROMPT)                  # model chosen by the SDK
response = await llm.generate(prompt, model=ALIAS)  # effort left at the default
```

**为什么会失败：**
- 默认值可能在你的代码不变时发生变化。2026 年 9 月，Codex CLI 将默认模型切换至 GPT-6.1 Sol（rust-v0.159.1）；Claude Code 将默认 Opus 切换至 Opus 5.5（2.1.280）、默认 Sonnet 切换至 Sonnet 5.5（2.1.284）；openai-agents SDK 此前已在 0.20.0 中将默认模型改为 `gpt-5.6-luna`
- 同一模型系列的设置也会变化：Opus 5.5 将默认 effort 从 `high` 降为 `medium`
- 即使模型 ID 固定也可能改变：OpenAI 于 2026 年 9 月 25 日在不更改 ID 的情况下修复了 GPT-6 Sol 和 Luna 的图像输入缺陷，因此必须重跑修复前的图像评估

**解决方案：**
```python
# PATTERN: Pin everything that changes behavior, and re-test on any change
MODEL = config["model"]    # exact model ID, never a framework default
EFFORT = config["effort"]  # explicit, per route
response = await llm.generate(prompt, model=MODEL, effort=EFFORT)
if not response.model.startswith(MODEL):  # providers may append a snapshot suffix
    alert("served model differs from the pinned one", served=response.model)
```

每当模型 ID、effort、SDK 版本或 CLI 版本变化时，都应重跑评估集，并记录每个响应报告的模型名称。

---

## 面试题

### 问：你在 LLM 应用里见过的最大反模式是什么？

**优秀回答：**

“危害最大的是 ‘上帝提示词’ 反模式：一个巨大的单一 prompt（提示词）试图处理所有场景。

**它为什么常见：** 一开始只用一个 prompt，随着需求出现再不断追加指令，看起来更简单。

**为什么会失败：**
- 上下文被指令占用，而不是用户内容
- 相互冲突的指令会让模型困惑
- 无法针对不同用例优化
- 改动会带来不可预测的副作用

**修复方式：** 路由到专门的处理器。每个处理器都有一个聚焦的 prompt，针对单一任务优化。路由器本身可以很简单（基于关键词）或更智能（复杂场景下基于 LLM）。

这不只适用于 prompt。一般原则是：把复杂性拆解成专门的组件，而不是把所有东西硬塞进一个单体里。”

### 问：你如何避免 agent 成本失控？

**优秀回答：**

“在不同层级设置多重限制：

**按请求限制：**
- 最大步骤数（例如 20）
- 最大 token 数（例如 50K）
- 最大时长（例如 5 分钟）

**按会话限制：**
- 每日 token 预算
- 每日成本上限
- 在托管平台上使用原生控制：Claude Managed Agents 会话达到硬预算后会以 `budget_reached` 暂停；OpenAI Agents API 通过 `max_concurrent_subagents` 限制并行子智能体数量（默认 6）

**按用户限制：**
- 速率限制（每分钟/每小时/每天请求数）
- 成本归因和上限

**监控：**
- 实时成本追踪
- 异常告警（单次请求 > $1）
- 成本激增时触发熔断

**架构：**
- 从便宜模型级联到昂贵模型
- 为每条路由固定推理 effort，而不是接受默认值
- 缓存常见操作，首先为稳定前缀启用供应商的提示词缓存
- 批量处理相似请求

关键是假设 agent 会试图一直跑下去。在每一层都要内置硬停止。我见过没有适当限制的 agent 在几分钟内就跑出 $1000 的账单。”

---

*上一页：[设计模式](01-design-patterns.md)*
