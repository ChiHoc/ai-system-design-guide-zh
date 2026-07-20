# AI 设计模式速查表

常见模式的快速检索表。详细实现请参见各章节。

---

## 检索模式（Retrieval Patterns）

| 模式 | 使用场景 | 关键权衡 |
|---------|----------|--------------|
| **Basic RAG（基础检索增强生成，Retrieval-Augmented Generation）** | 对文档进行简单问答 | 易于实现，但准确率有限 |
| **Hybrid Search（混合检索）** | 结合语义检索 + 关键词检索 | 召回率更高，但复杂度更高 |
| **Reranking（重排）** | 高精度检索 | 准确率与延迟之间的权衡 |
| **Query Expansion（查询扩展）** | 歧义查询 | 召回率更高，但 token 更多 |
| **HyDE（Hypothetical Document Embeddings，假设文档嵌入）** | 预期不会有直接匹配 | 有创造性，但可能产生幻觉 |
| **Parent-Child Chunking（父子分块）** | 需要上下文关联信息 | 内存开销更高 |

```
Query → Embed → Vector Search → Rerank → Top-K → Generate
              ↓
         BM25 Search ─────────┘ (hybrid)
```

---

## 生成模式（Generation Patterns）

| 模式 | 使用场景 | 关键权衡 |
|---------|----------|--------------|
| **Zero-Shot（零样本）** | 简单任务 | 速度快，但可靠性较低 |
| **Few-Shot（少样本）** | 需要格式控制 | token 成本 |
| **Chain-of-Thought（思维链）** | 推理任务 | 延迟更高，会展示推理过程 |
| **Self-Consistency（一致性采样）** | 高风险答案 | 成本增加 3-5 倍 |
| **Structured Output（结构化输出）** | API 响应 | 创造性受限 |

---

## Agent 模式（Agent Patterns）

| 模式 | 使用场景 | 复杂度 |
|---------|----------|------------|
| **ReAct** | 使用工具的 agent | 中等 |
| **Plan-and-Execute（规划-执行）** | 多步骤任务 | 高 |
| **Multi-Agent Debate（多 Agent 辩论）** | 验证 | 高 |
| **Human-in-the-Loop（人在回路）** | 高风险操作 | 中等 |
| **Swarm / Handoff（群体协作 / 交接）** | 专业化子代理 | 高 |

```
┌─────────────────────────────────────────┐
│              REACT LOOP                  │
│                                         │
│  Observe → Think → Act → Observe → ...  │
│              ↓                          │
│         [Tool Call]                     │
│              ↓                          │
│         [Result]                        │
└─────────────────────────────────────────┘
```

---

## 具备 Agentic 能力的编码模式（Agentic Coding Patterns）（2026）

| 模式 | 使用场景 | 关键工具 |
|---------|----------|----------------|
| **Scaffold → Implement → Verify（搭建 → 实现 → 验证）** | 完整功能开发 | Claude Code / OpenHands |
| **Read-Plan-Edit（读取-规划-编辑）** | 重构现有代码 | Claude Code text_editor |
| **Test-Driven Agent（测试驱动 Agent）** | 高可靠性代码 | Agent 先写测试 |
| **Shadow Review（影子审查）** | PR 质量门禁 | Agent 在合并前审查 diff |
| **CLAUDE.md Manifest（CLAUDE.md 清单）** | 项目上下文注入 | Claude Code 的 CLAUDE.md 文件 |
| **Sub-Agent Parallelism（子代理并行）** | 大型代码库变更 | 每个模块使用多个代理 |

```
┌────────────────────────────────────────────────────────┐
│              AGENTIC CODING LOOP                        │
│                                                        │
│  Understand → Plan → Implement → Run Tests → Fix       │
│      ↑             (bash + text_editor tools)    │     │
│      └──────────── Iterate until tests pass ────┘     │
│                                                        │
│  [CLAUDE.md injects: coding style, test commands,     │
│   forbidden patterns, architecture decisions]          │
└────────────────────────────────────────────────────────┘
```

**何时使用哪种工具：**
```
Need full autonomy + CLI → Claude Code
Need open-source + any LLM → OpenHands / Cline
Need tight IDE integration → Cursor / Windsurf
Need reproducible pipelines → OpenHands in Docker CI
```

---

## 可靠性模式（Reliability Patterns）

| 模式 | 解决问题 | 实现方式 |
|---------|----------------|----------------|
| **Retry with Backoff（带退避重试）** | 短暂性失败 | 指数退避 |
| **Circuit Breaker（断路器）** | 级联失败 | 达到阈值后快速失败 |
| **Fallback Model（回退模型）** | 主模型不可用 | 次级模型 |
| **Timeout（超时）** | 响应过慢 | 取消 + 回退 |
| **Bulkhead（舱壁）** | 资源隔离 | 独立池 |

```python
# Reliability stack
@circuit_breaker(failure_threshold=5)
@retry(max_attempts=3, backoff=exponential)
@timeout(seconds=30)
@fallback(model="gpt-4o-mini")
async def generate(prompt):
    return await primary_model.generate(prompt)
```

---

## 缓存模式（Caching Patterns）

| 模式 | 命中率 | 使用场景 |
|---------|----------|----------|
| **Exact Match（精确匹配）** | 低 | 完全相同的查询 |
| **Semantic Cache（语义缓存）** | 中 | 相似查询 |
| **KV Cache（KV 缓存）** | 高 | 相同前缀 |
| **Response Cache（响应缓存）** | 不同 | 确定性输出 |

---

## 安全模式（Security Patterns）

| 模式 | 威胁 | 实现方式 |
|---------|--------|----------------|
| **Input Validation（输入验证）** | Prompt injection（提示词注入） | 清洗、检测 |
| **Output Filtering（输出过滤）** | 数据泄露 | PII 检测、黑名单 |
| **Tenant Isolation（租户隔离）** | 跨租户访问 | 查询时过滤 |
| **Rate Limiting（限流）** | 滥用 | 按用户/租户限额 |

```
Input → Validate → Sanitize → LLM → Filter → Validate → Output
```

---

## 评估模式（Evaluation Patterns）

| 模式 | 使用场景 | 指标 |
|---------|----------|---------|
| **Golden Set（黄金集）** | 回归测试 | 通过率 |
| **LLM-as-Judge（LLM 作为裁判）** | 质量评分 | 1-5 分量表 |
| **Human Eval（人工评估）** | 基准真值 | 一致率 |
| **A/B Testing（A/B 测试）** | 线上对比 | 用户指标 |

---

## 成本优化模式（Cost Optimization Patterns）

| 模式 | 节省 | 权衡 |
|---------|---------|----------|
| **Model Routing（模型路由）** | 50-70% | 复杂度 |
| **Caching（缓存）** | 20-40% | 陈旧性 |
| **Prompt Compression（提示压缩）** | 10-30% | 质量风险 |
| **Batch Processing（批处理）** | 30-50% | 延迟 |

```
Query → Classify → Route → [Small Model] or [Large Model]
                      ↓
              [Cheap: 80%]  [Expensive: 20%]
```

---

## 需要避免的反模式（Anti-Patterns to Avoid）

| 反模式 | 问题 | 更优做法 |
|--------------|---------|-----------------|
| **Context Stuffing（上下文塞满）** | token 浪费 | 只检索相关内容 |
| **Retry Forever（无限重试）** | 资源耗尽 | 使用断路器 |
| **Trust All Output（完全信任输出）** | 幻觉 | 验证、建立依据 |
| **Single Model（单一模型）** | 单点故障 | 多提供商 |
| **No Observability（缺少可观测性）** | 盲目调试 | 全量追踪 |
| **Infinite Agentic Loop（无限 Agent 循环）** | Agent 无进展地自转 | 最大轮次 + Critic agent |
| **Over-trusting Computer-Use（过度信任 Computer-Use）** | Agent 点击错误 UI 元素 | 截图验证 + HITL |
| **No CLAUDE.md / Manifest（没有 CLAUDE.md / Manifest）** | Agent 缺乏项目上下文 | 始终提供编码清单 |
| **Thinking Mode Always On（思考模式始终开启）** | 3-10x 成本且无收益 | 由复杂度分类器控制 |

---

## 模式选择指南（Pattern Selection Guide）

**开始一个新项目？**
1. 从 Basic RAG（基础检索增强生成）开始
2. 当精度重要时添加 reranking（重排）
3. 对关键词密集内容添加 hybrid search（混合检索）

**需要可靠性？**
1. 从 retry（重试）+ timeout（超时）开始
2. 对外部调用添加 circuit breaker（断路器）
3. 对关键路径添加 fallback models（回退模型）

**有成本压力？**
1. 先实现 semantic caching（语义缓存）
2. 按查询复杂度添加 model routing（模型路由）
3. 在允许延迟的情况下进行 batch processing（批处理）

*详见 [15-ai-design-patterns/](15-ai-design-patterns/) 获取详细实现*
