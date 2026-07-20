# AI 系统设计面试中的常见陷阱

本章涵盖 AI 系统设计面试中候选人常犯的错误、它们为何会影响你的评估，以及如何避免。

## 目录

- [架构陷阱](#架构陷阱)
- [技术知识陷阱](#技术知识陷阱)
- [沟通陷阱](#沟通陷阱)
- [面试策略陷阱](#面试策略陷阱)
- [AI 特有陷阱](#ai-特有陷阱)
- [自我复盘清单](#自查清单)

---

## 架构陷阱

### 陷阱 1：跳过数据管道（Data Pipeline）

**出错表现：**
候选人会详细设计推理路径（inference path），却几乎不提数据是如何进入系统的。

**为什么重要：**
数据质量决定 AI 系统质量。再漂亮的 RAG（Retrieval-Augmented Generation，检索增强生成）架构，如果文档摄入（ingestion）流水线产出的都是垃圾块（garbage chunks），也毫无价值。

**面试官会注意到：**
- 没有提及文档如何处理
- 假设 embedding（嵌入）会“自动出现”
- 忽略更新与删除

**更好的做法：**
```
"Before discussing retrieval, let me walk through the data pipeline:

1. Document ingestion: File upload, API integration, crawler
2. Preprocessing: Format conversion, cleaning, metadata extraction
3. Chunking: [Strategy] based on document structure
4. Embedding: Batch processing with [model]
5. Indexing: Upsert to vector database with metadata
6. Updates: Incremental re-indexing on document changes"
```

---

### 陷阱 2：一刀切模型选型（One-Size-Fits-All Model Selection）

**出错表现：**
候选人说会对所有场景都用 GPT-4（或任何单一模型）。

**为什么重要：**
不同任务有不同要求。用前沿模型（frontier model）做分类是浪费；用小模型做复杂推理会失败。

**面试官会注意到：**
- 没有讨论成本影响
- 没有考虑延迟要求
- 没有模型级联（model cascade）或路由

**更好的做法：**
```
"Model selection varies by task:

- Intent classification: Fine-tuned BERT or GPT-5.5-mini
- Simple responses: Claude Haiku 4.5, GPT-5.5-mini, or DeepSeek V4 Flash
- Complex reasoning: Claude Sonnet 4.6 or GPT-5.5
- Code generation: Claude Sonnet 4.6 (Opus 4.8 for the hardest cases)

I would implement a router that classifies query complexity 
and routes to the appropriate model. This typically reduces 
costs 60-70% with minimal quality impact."
```

---

### 陷阱 3：忽视评估层（Evaluation Layer）

**出错表现：**
候选人只描述系统如何搭建，却没说明如何验证其是否有效。

**为什么重要：**
AI 系统会以微妙方式失败。没有评估，你可能上线有缺陷的系统并且始终无法发现退化。

**面试官会注意到：**
- 没有提到测试集
- 没有定义质量指标
- 没有生产问题监控

**更好的做法：**
```
"Evaluation has three layers:

1. Offline: Golden test set evaluated on every change
   - Retrieval: Precision@5, Recall@5, MRR
   - Generation: Faithfulness, relevance (RAGAS)
   - End-to-end: Answer correctness vs ground truth

2. Online: Sampled evaluation in production
   - LLM-as-judge on 5% of requests
   - User feedback (thumbs up/down)
   - Completion rate for task-oriented queries

3. Alerting: Automated detection
   - Quality score drops below threshold
   - Latency exceeds SLA
   - Error rate spikes"
```

---

### 陷阱 4：低估多租户复杂度（Multi-Tenancy）

**出错表现：**
候选人把多租户 RAG 简单理解为“加一个 tenant_id 字段”。

**为什么重要：**
多租户 AI 系统一般有独特故障模式，围绕数据泄露、隔离性和公平资源分配展开。

**面试官会注意到：**
- 后检索过滤（post-retrieval filtering，重大红旗）
- 没有讨论缓存隔离
- 没有考虑噪声邻居（noisy neighbor）

**更好的做法：**
```
"Multi-tenancy for RAG is harder than traditional systems:

1. Retrieval isolation: Filter BEFORE retrieval at the database level
   WRONG: retrieve(query, top_k=100) then filter by tenant
   RIGHT: retrieve(query, top_k=10, filter={tenant_id: X})

2. Context isolation: Never mix tenants in LLM context

3. Cache isolation: Scope all cache keys by tenant
   cache_key = f'{tenant_id}:{query_hash}'

4. Embedding isolation: Consider tenant-specific embedding spaces
   for highest security requirements

5. Audit: Log tenant context for all operations

I would also run regular isolation tests with adversarial 
queries designed to probe for cross-tenant leakage."
```

---

### 陷阱 5：缺乏优雅降级（Graceful Degradation）

**出错表现：**
当 LLM（Large Language Model，大语言模型）提供方宕机、被限流或返回错误时，系统没有回退方案。

**为什么重要：**
LLM 提供方会发生宕机。速率限制也会被触发。故障处理能力决定系统是生产可用还是仅能做原型。

**面试官会注意到：**
- 没提回退方案
- 没提重试策略
- 单一提供方依赖

**更好的做法：**
```
"Reliability layers:

1. Retry with backoff: Transient errors get retried
   - Exponential backoff with jitter
   - Max 3 attempts

2. Fallback providers: If primary fails, try secondary
   - OpenAI → Anthropic → local model
   - Abstract the interface to enable swapping

3. Cached responses: Return cached results for known queries
   - Exact match cache for repeated questions
   - Semantic cache for similar questions

4. Graceful degradation: Partial functionality on failure
   - Retrieval fails → return direct LLM response with disclaimer
   - LLM fails → return relevant chunks without synthesis

5. Circuit breaker: Fail fast when provider is degraded
   - Prevents cascading latency issues"
```

---

## 技术知识陷阱

### 陷阱 6：混淆 Embedding 与生成模型

**出错表现：**
候选人把 embedding model（嵌入模型）用于生成文本，或把生成当成检索来处理。

**需要掌握：**
- **Embedding models（嵌入模型）：** 将文本映射为向量（text → vector）。用于搜索/检索（search/retrieval）。
- **Generation models（生成模型）：** 根据提示词（prompt）生成文本。用于响应（response）。

**它们如何协作：**
RAG 先用 embedding model 做检索，再把检索到的块交给 generation model 生成。

---

### 陷阱 7：误解上下文窗口（Context Windows）

**出错表现：**
- 误以为 128K 上下文意味着 128K 个有用 token
- 忽略 system prompt、检索块和对话历史占用
- 忽视“信息埋没在中间”现象（lost in the middle）

**需要掌握：**
- 上下文窗口是上限而非目标
- 注意力对中间内容会衰减
- 实际可用的有效上下文远小于上限

**更合理的表述方式：**
```
"While current frontier models advertise 1M-token windows, I design for much smaller effective context:

- System prompt: ~500 tokens
- Retrieved context: 3-5 chunks × 500 tokens = 1.5-2.5K
- Conversation history: Last 5 turns × 300 tokens = 1.5K
- Buffer for output: ~2K

Total active context: ~7K tokens, well below limit.

This keeps the model focused on relevant information and 
avoids the lost-in-the-middle problem documented in Liu et al."
```

---

### 陷阱 8：不了解 Token 成本经济学

**出错表现：**
候选人只谈功能，不理解成本含义。

**需要掌握：**
- 计费按 token 计算，输入与输出常常分开计价
- 大多数提供商里输出 token 成本约为输入 token 的 2-4 倍
- 流式输出通常不改变计费

**快速参考（2026 年 6 月，需确认是否仍然有效）：**

| 模型 | 输入/100万 token | 输出/100万 token |
|-------|----------|-----------|
| Claude Fable 5 | $10 | $50 |
| Claude Opus 4.8 | $5 | $25 |
| GPT-5.5 | $5 | $30 |
| Claude Sonnet 4.6 | $3 | $15 |
| Gemini 3.1 Pro | $2 | $12 |
| Claude Haiku 4.5 | $1 | $5 |
| DeepSeek V4 Flash | $0.14 | $0.28 |

**成本计算示例：**
```
10,000 queries/day
Average: 2K input tokens, 500 output tokens
Model: Claude Sonnet 4.6

Daily cost = 10K × (2K × $3/1M + 500 × $15/1M)
          = 10K × ($0.006 + $0.0075)
          = 10K × $0.0135
          = $135/day = ~$4K/month
```

**缓存杠杆（通常是区分候选人的关键）：**
```
Same workload, but 1.5K of the 2K input is a shared prefix
(system prompt + tool schemas) served from cache at 10% of
the input price:

Daily cost = 10K × (0.5K × $3/1M + 1.5K × $0.30/1M + 500 × $15/1M)
          = 10K × ($0.0015 + $0.00045 + $0.0075)
          = ~$94/day = ~$2.8K/month   (30% saved by prompt shape alone)

Design implication: keep the static content (instructions, schemas)
at the front of the prompt and the dynamic content at the end, so
the prefix stays byte-identical across requests and the cache hits.
```

---

### 陷阱 9：对 RAG 组件理解过于表面

**出错表现：**
候选人能背出组件（chunking、embedding、retrieval、generation），却说不清每个组件里的权衡。

**对分块（chunking）应达到的深度：**
- 为什么要分块？（上下文限制、检索精度）
- 分块大小权衡如何选？（小块更精确，大块有更多上下文）
- 为什么要重叠（overlap）？（避免边界处丢失上下文）
- 什么时候用语义分块（semantic chunking）？（结构变化大的复杂文档）

**对检索（retrieval）应达到的深度：**
- 为什么要混合检索（hybrid search）？（稠密检索适合语义，稀疏检索适合关键词）
- 什么是重排序（reranking）？（两阶段：先高召回再精排）
- 没有结果时如何处理？（回退策略）

---

### 陷阱 10：将提示词（Prompt）当“魔法”

**出错表现：**
候选人含糊其辞地说“然后我们再 prompt 模型……”却没有讨论提示工程（Prompt Engineering）。

**面试官希望看到：**
- 提示词结构（system、context、user）
- 指令清晰度
- 输出格式定义
- 需要时使用 few-shot 示例
- 对边界情况（edge case）有防御

**更好的做法：**
```
"The generation prompt has this structure:

SYSTEM:
You are a support assistant for [Product]. Answer questions 
using ONLY the provided context. If the context does not 
contain the answer, say 'I don't have information about that.'
Always cite the source document.

CONTEXT:
[Retrieved chunks with source metadata]

USER:
[User's question]

I specify the output format explicitly and use few-shot 
examples for complex response structures. For this use case, 
I also include negative examples showing when to abstain."
```

**面试中值得主动点名的提示词失败模式：**

| 失败模式 | 典型表现 | 防御方式 |
|--------------|--------------------|---------|
| 信息埋没在中间 | 关键指令放在 token 40K 附近被忽略 | 将规则放在开头与结尾，中间放数据 |
| 指令层级失效 | 检索到的文档文本覆盖了 system prompt | 用分隔符包裹不可信内容；将其视为数据而非指令 |
| 格式漂移 | 长会话或模型更新后 JSON 输出质量下降 | 使用引擎级结构化输出（json_schema、tool schemas），而不是“请返回 JSON” |
| 失去缓存命中 | 提示词前端的时间戳使每次请求都失去前缀缓存 | 静态内容放前面，动态内容放最后 |
| 提示词-模型耦合 | 一个提供商上调好的提示词，在模型切换后悄悄退化 | 用模型 ID 版本化提示词；模型变更后重跑评估 |

在面试中自发说出其中两到三个，会让提示词相关答案从初级跃升到高级，因为这些几乎都是真实线上事故。

---

## 沟通陷阱

### 陷阱 11：单向输出、不互动（Monologuing Without Interaction）

**出错表现：**
候选人连续讲 10-15 分钟，不与面试官进行交互校准。

**为什么重要：**
面试是对话。单向输出会漏掉面试官真正关心的点。

**更好的做法：**
每 3-5 分钟做一次同步：
- “我应该更深入讲检索，还是先讲生成？”
- “在我展开细节前，这个架构你看起来是否合理？”
- “你希望我重点讲哪个组件？”

---

### 陷阱 12：没有先给出结构化开场

**出错表现：**
候选人开口就讲，没有先说明会覆盖哪些内容。

**为什么重要：**
面试官有自己的心智模型。如果他们无法把你的回答映射到预期，就会觉得你表达混乱。

**更好的做法：**
先给出路线图：
```
"I will structure my answer in four parts:
1. High-level architecture
2. Deep dive on the RAG pipeline
3. Scaling and reliability
4. Evaluation approach

Let me start with the high-level architecture..."
```

---

### 陷阱 13：术语堆砌但不解释（Technical Jargon Without Explanation）

**出错表现：**
候选人提到“PagedAttention”或“GQA”却不解释。

**为什么重要：**
如果面试官不懂这个术语，你会显得是在“抛名词”。如果他懂，还可能追问你却答不上来。

**更好的做法：**
引入术语时给简短解释：
```
"I would use vLLM which implements PagedAttention. 
This manages the KV cache like virtual memory, reducing 
fragmentation and enabling higher throughput."
```

---

### 陷阱 14：固执捍卫错误结论

**出错表现：**
当面试官暗示某方案有问题时，候选人反而坚持己见不调整。

**为什么重要：**
僵化是警讯。可教化能力（coachability）更受青睐。

**更好的做法：**
```
Interviewer: "What about the case where..."
You: "That is a good point. I had not considered [X]. 
Let me revise my approach..."
```

---

## 面试策略陷阱

### 陷阱 15：解答了另一个问题

**出错表现：**
候选人对某项技术兴趣过高，开始设计超出题目需求的系统。

**示例：**
被要求设计一个简单问答系统，却设计了一个复杂的多智能体（multi-agent）自主研究系统。

**更好的做法：**
先按需求设计，再给出可扩展方向：
```
"This design meets the core requirements. If we wanted to 
extend it to handle more complex multi-step queries, we 
could add an agent layer, but I would not start there."
```

---

### 陷阱 16：未管理时间

**出错表现：**
候选人把 20 分钟都花在架构上，没时间讲评估、可靠性和扩展。

**更好的做法：**
明确分配时间：
- 明确需求澄清：3-5 分钟
- 顶层设计：5-7 分钟
- 深入展开：10-15 分钟
- 评估/可靠性：5-7 分钟
- 提问/收尾：3-5 分钟

注意看时间并动态调整。

---

### 陷阱 17：不画图

**出错表现：**
候选人只口头描述架构，不画图。

**为什么重要：**
可视化沟通更清楚，也能体现你和利益相关方沟通的能力。

**更好的做法：**
边讲边画框和箭头，标注清晰。讨论过程中持续引用该图。

---

## AI 特有陷阱

### 陷阱 18：把 AI 组件当黑箱

**出错表现：**
候选人把“调用 LLM”当作一个原子操作，却不理解内部发生了什么。

**高级岗位的期望：**
- 理解 prefill（预填充）与 decode（解码）阶段
- 知道影响延迟的因素（TTFT 与 TPS）
- 理解 KV cache（键值缓存）的影响
- 了解 batching（批处理）效应

---

### 陷阱 19：忽视幻觉风险（Hallucination）

**出错表现：**
候选人设计系统时对 LLM 输出盲目信任。

**为什么重要：**
幻觉是 LLM 的固有特性。生产系统必须对其进行防护与处理。

**更好的做法：**
```
"Hallucination mitigation has multiple layers:

1. Retrieval grounding: Answer from context only
2. Citation enforcement: Every claim cites a source
3. Abstention: Model says 'I don't know' when appropriate
4. Output validation: Check for impossible claims
5. Confidence display: Show users when to verify"
```

---

### 陷阱 20：把安全性当事后补丁

**出错表现：**
安全只在最后考虑，甚至不考虑。

**为什么重要：**
AI 系统有新的攻击面（prompt injection、data leakage）。安全必须从设计阶段就嵌入。

**更好的做法：**
将安全内置到设计中：
```
"For the retrieval layer, I use metadata filtering at the 
database level to ensure tenant isolation. The system prompt 
uses instruction hierarchy to resist injection. Output 
passes through a content filter before reaching the user."
```

---

## 自查清单

### 面试前

- [ ] 已复习 RAG（检索增强生成）架构模式
- [ ] 了解当前模型定价（大致区间）
- [ ] 能解释 chunking（分块）策略
- [ ] 理解 embedding（向量嵌入）与 generation（生成）
- [ ] 了解常见评估指标
- [ ] 能讨论至少一个向量数据库
- [ ] 理解多租户（multi-tenancy）挑战
- [ ] 能讨论 prompt engineering（提示词工程）技术

### 面试过程中

- [ ] 提出了澄清性问题
- [ ] 说明了优先级和权衡
- [ ] 画了图
- [ ] 提到了评估方法
- [ ] 讨论了失效模式
- [ ] 处理了安全性/隔离性
- [ ] 与面试官保持沟通同步
- [ ] 在各部分之间管理了时间

### 每部分结束后

- [ ] 我是否解释了为什么，而不只是是什么？
- [ ] 我是否提到了权衡？
- [ ] 我是否在适用时使用了具体数字？
- [ ] 我是否避免了不必要的复杂性？

---

*另请参见：[问题库](01-question-bank.md) | [答案框架](02-answer-frameworks.md) | [白板练习](04-whiteboard-exercises.md)*
