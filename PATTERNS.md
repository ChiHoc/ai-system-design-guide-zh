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
| **Advisor / Executor（顾问 / 执行者）** | 便宜模型运行循环，在决策点咨询强模型 | 中等 |
| **Orchestrator + isolated subagents（编排器 + 隔离子智能体）** | 并行工作，避免上下文争用 | 高 |
| **托管执行框架（租用循环）** | 无需自行运维的持久会话与恢复 | 构建成本低；数据驻留与保留限制决定是否适合 |

**顾问 / 执行者**是 `2026` 年新增的模式，也是值得了解的成本-质量杠杆：低成本执行者驱动智能体循环，在决策点调用更强的顾问模型，并把对话记录传过去，接收计划或修正。这是成本主张而非质量主张：低推理努力的执行者与更强顾问配对后，可以突破该执行者单纯提高自身推理努力所形成的成本-质量曲线；但最高分仍然来自成本更高的最大推理努力配置。已发布的数据来自供应商基准测试，因此应在自己的任务上测量。咨询率是需要关注的指标：如果执行者几乎每一步都要咨询，那你实际上买到的只是一个延迟更高的昂贵模型。

**编排器加隔离子智能体**是单智能体与多智能体之争最终落地的形态。子智能体拥有自己的上下文并返回摘要，彼此之间没有对等通信渠道。隔离的是上下文，而不是状态：托管平台通常会让整个智能体阵容共享同一个沙箱、文件系统和凭据集。供应商平台会强制实施实践中保证该模式有效的限制，典型规则是只允许一层委派，并限制阵容规模（OpenAI Agents API 的 `max_concurrent_subagents` 默认为 6）；即使你的框架不强制，这也是良好的默认设置。

**托管执行框架**选项在 2026 年 9 月增多，OpenAI Agents API（公共 beta）和基于它的 Amazon Bedrock Managed Agents（预览）加入 Claude Managed Agents。它们都代为运行持久会话和崩溃恢复。排除条件通常是数据处理而非功能（Agents API 发布时仅支持美国驻留，不支持零数据保留），且没有托管运行时能为你自己的有副作用工具提供恰好一次语义。见[持久执行](07-agentic-systems/11-durable-execution.md#托管式智能体运行时-租用持久循环)。

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
| **AGENTS.md / CLAUDE.md 清单** | 项目上下文注入 | AGENTS.md 跨工具通用；不存在 CLAUDE.md 时 Claude Code 会读取它 |
| **Sub-Agent Parallelism（子代理并行）** | 大型代码库变更 | 每个模块使用多个代理 |

```
┌────────────────────────────────────────────────────────┐
│              AGENTIC CODING LOOP                       │
│                                                        │
│  Understand → Plan → Implement → Run Tests → Fix       │
│      ↑             (bash + text_editor tools)    │     │
│      └──────────── Iterate until tests pass ────┘      │
│                                                        │
│  [AGENTS.md / CLAUDE.md injects: coding style,         │
│   test commands, forbidden patterns,                   │
│   architecture decisions]                              │
└────────────────────────────────────────────────────────┘
```

**何时使用哪种工具：**
```
Need full autonomy + CLI → Claude Code / Codex CLI
Need open-source + any LLM → OpenHands / Cline / OpenCode
Need tight IDE integration → Cursor / Windsurf
Need reproducible pipelines → OpenHands in Docker CI
Need a harness you don't operate → OpenAI Agents API / Claude Managed Agents
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
| **拒答感知路由** | 安全拒答作为成功返回 | 根据 `stop_reason` 而非 HTTP 状态分支 |

```python
# Reliability stack
@circuit_breaker(failure_threshold=5)
@retry(max_attempts=3, backoff=exponential)
@timeout(seconds=30)
@fallback(model="claude-sonnet-5-5")  # a different vendor from the primary
async def generate(prompt):
    return await primary_model.generate(prompt)
```

回退必须跨供应商，因为一次事故可能影响同一供应商的全部服务（OpenAI 于 2026 年 9 月 29 日的事故同时使 API、ChatGPT 和 Codex 降级约 5 小时 20 分钟）。回退改变的不只是端点，也包括行为：Claude 思考块绑定生成它的模型，不能重放到另一个模型；Claude 安全拒答以 HTTP 200 和 `stop_reason: "refusal"` 返回，因此状态码检查永远看不到。见[设计模式](15-ai-design-patterns/01-design-patterns.md#模式-retry-with-fallback-重试-回退)。

---

## 缓存模式（Caching Patterns）

| 模式 | 命中率 | 使用场景 |
|---------|----------|----------|
| **Exact Match（精确匹配）** | 低 | 完全相同的查询 |
| **Semantic Cache（语义缓存）** | 中 | 相似查询 |
| **提示词（前缀）缓存** | 智能体循环中高 | 稳定前缀（系统提示、工具、历史）；提供方缓存读取按输入的 0.025 倍至 0.1 倍计费，自托管引擎（vLLM、SGLang）直接复用 KV 缓存 |
| **Response Cache（响应缓存）** | 不同 | 确定性输出 |

---

## 安全模式（Security Patterns）

| 模式 | 威胁 | 实现方式 |
|---------|--------|----------------|
| **Input Validation（输入验证）** | Prompt injection（提示词注入） | 清洗、检测 |
| **Output Filtering（输出过滤）** | 数据泄露 | PII 检测、黑名单 |
| **Tenant Isolation（租户隔离）** | 跨租户访问 | 查询时过滤 |
| **Rate Limiting（限流）** | 滥用 | 按用户/租户限额 |
| **出站允许列表** | 外泄、评估环境逃逸 | 网络默认拒绝，包括 DNS、包代理和发布端点 |
| **绑定审批** | 审批洗白 | 审批哈希绑定精确动作，执行时重新验证 |
| **技能固定** | 指令被静默改变 | 验证技能清单摘要；任何变化重新审批 |
| **执行框架隔离** | 仓库配置在沙箱外运行代码（GitSpawn） | 将智能体执行框架本身放入沙箱；把 `.git/config` 和智能体配置文件视作代码 |
| **监控并终止** | 告警未被及时处理 | 监控接自动停止，像故障转移一样测试；OpenAI 一次训练运行约 12 分钟后告警，但自动停止失效，约 2.5 小时后才被终止 |

```
Input → Validate → Sanitize → LLM → Filter → Validate → Output
```

---

## 评估模式（Evaluation Patterns）

| 模式 | 使用场景 | 指标 |
|---------|----------|---------|
| **Golden Set（黄金集）** | 回归测试 | 通过率 |
| **LLM-as-Judge（LLM 作为裁判）** | 质量评分 | 每条件二元通过/失败，对照人工标签校准 |
| **Human Eval（人工评估）** | 基准真值 | 一致率 |
| **A/B Testing（A/B 测试）** | 线上对比 | 用户指标 |

---

## 成本优化模式（Cost Optimization Patterns）

| 模式 | 节省 | 权衡 |
|---------|---------|----------|
| **Model Routing（模型路由）** | 50-70% | 复杂度 |
| **提示词（前缀）缓存** | 缓存输入 token 节省 90-97.5% | 写入溢价（1.25 倍；Anthropic 1 小时缓存 2 倍）；TTL 管理 |
| **响应 / 语义缓存** | 20-40% | 陈旧性 |
| **Prompt Compression（提示压缩）** | 10-30% | 质量风险 |
| **Batch / Flex 层级** | 50% | 延迟（异步或尽力而为） |

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
| **没有 AGENTS.md / 清单** | Agent 缺乏项目上下文 | 始终提供编码清单 |
| **处处最大推理强度** | 3-10x 成本且无收益 | 每条路由固定强度；部分模型（Opus 5.5、Sonnet 5.5）已无法关闭思考，因此 effort 是剩余调节手段 |
| **浮动模型默认值** | 工具或 SDK 更换默认值后行为静默改变 | 固定模型 ID 与推理强度；每次变化重跑评估 |

---

## 模式选择指南（Pattern Selection Guide）

**开始一个新项目？**
1. 从 Basic RAG（基础检索增强生成）开始
2. 当精度重要时添加 reranking（重排）
3. 对关键词密集内容添加 hybrid search（混合检索）

**需要可靠性？**
1. 从 retry（重试）+ timeout（超时）开始
2. 对外部调用添加 circuit breaker（断路器）
3. 对关键路径添加不同供应商的 fallback models（回退模型）

**有成本压力？**
1. 先为稳定前缀开启提供方提示词缓存，再为重复问题添加语义缓存
2. 按查询复杂度添加 model routing（模型路由），每条路由固定推理强度
3. 在允许延迟的情况下进行 batch processing（批处理）

*详见 [15-ai-design-patterns/](15-ai-design-patterns/) 获取详细实现*
