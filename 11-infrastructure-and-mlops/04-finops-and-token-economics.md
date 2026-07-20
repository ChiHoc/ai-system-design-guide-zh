# FinOps 和 Token Economics（令牌经济学）

本章讨论的是大规模运行 LLM 的**经济性与纪律性**：如何建模、归因、预算，并从结构上降低 AI 支出。这里不是对推理内部机制的重复说明；关于战术性杠杆（quantization（量化）、batching（批处理）、speculative decoding（推测解码）、KV cache（KV 缓存）），请参见 [Cost Optimization Playbook](../04-inference-optimization/07-cost-optimization-playbook.md) 和 [inference chapters（推理章节）](../04-inference-optimization/01-inference-fundamentals.md)。

本章的锚点发现来自 Datadog 的 2026 State of AI Engineering：**system prompts（系统提示）约占输入 token 的 69%，但只有约 28% 的调用使用了 prompt caching（提示缓存）。** 在大多数生产栈中，单一最大、且最省力的降本杠杆正被闲置。AI 产品也以 cost-of-goods business（成本货业务）的方式运行，而不是 zero-marginal-cost SaaS（零边际成本 SaaS），因此 margin thinking（毛利思维）现在已经成了工程问题。

## 目录

- [成本模型](#成本模型)
- [缓存：最高的成本杠杆](#缓存-最高的成本杠杆)
- [Batch 和 Async 经济学](#batch-和-async-经济学)
- [FinOps 纪律](#finops-纪律)
- [结构性成本决策](#结构性成本决策)
- [成本反模式](#成本反模式)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 成本模型

定价通常按每百万 token 报价，分为 input 和 output 两部分，且 **output 成本显著高于 input**，通常高出 3-5 倍，有时甚至更多，因为生成是 autoregressive（自回归）且受 compute-bound（计算瓶颈）约束，而输入则是一个并行的 prefill（预填充）过程。（当前各模型价格见 [Pricing and Costs](../02-model-landscape/03-pricing-and-costs.md)；它们下降得很快，所以请建模 *结构*，而不是分钱。）

每次请求都会分解为叠加的支出层。分别建模这些层，才能让成本变得可预测且可归因：

| 层 | 由什么驱动 | 行为 | 主要杠杆 |
|-------|-----------|----------|---------------|
| system prompt / instructions（系统提示 / 指令） | 固定脚手架、tool defs（工具定义）、few-shot（少样本） | 约占输入 token 的 69%；若未缓存，每次调用都要付费 | Prompt caching |
| retrieved / context tokens（检索 / 上下文 token） | RAG chunks（RAG 片段）、注入文档、长上下文 | 随 k 和 chunk 大小线性增长；可能碾压其他所有项 | RAG vs long context；chunk 预算 |
| conversation / memory（对话 / 记忆） | 聊天历史、agent scratchpad（代理草稿区） | 若不总结，会无限增长 | Windowing、summarization、compaction |
| model tier（模型层级） | Frontier vs mid vs small/self-host | 不同层级之间可相差 10-100 倍 | Right-sizing、cascade、routing |
| output length（输出长度） | 详细程度、格式、`max_tokens` | 按更高的 output 费率计费 | `max_tokens` 上限、简洁输出契约 |
| reasoning / thinking tokens（推理 / 思考 token） | extended-thinking（扩展思考）模式 | 按 output 费率计费，但在响应中不可见 | 按任务复杂度控制思考 |
| retry / overhead（重试 / 开销） | 短暂错误、guardrail（护栏）重跑 | 失败时成倍放大 | 有界重试、circuit breakers（熔断器） |
| agent multi-step（代理多步骤） | plan-act-observe（计划-行动-观察）循环、sub-agents（子代理） | 每一步都会把整套栈乘上去 | 步数上限、每次运行预算 |

**Reasoning models（推理模型）和 agents（代理）是成本放大器，而这两者最糟糕，因为它们是不可见的。** extended-thinking token 按 output 费率计费，但不会出现在响应里，所以一次“很短”的调用，其成本可能比可见输出暗示的高出一个数量级；已有分析把放大倍数估在约 3x 到 15x 之间，取决于任务。Agents 会在每一步把 *整套* token 栈放大，所以正确的度量单位是 **每个任务的成本，而不是每次调用的成本**。已有报告区间：一次 chat turn（聊天轮次）是几分钱，而一个 agentic（代理式）多步骤任务可能从几毛钱到几美元不等。

一个便于教学的单次请求成本公式：

```
cost = Σ(layer_input_tokens × in_rate) + (output_tokens + reasoning_tokens) × out_rate
cost_per_task = cost_per_request × expected_steps × (1 + retry_rate)
```

其中缓存作为可缓存输入部分的折扣。

---

## 缓存：最高的成本杠杆

之所以这是头号杠杆，恰恰因为前述锚点数据：约占输入 token 69% 的那一层（system prompt）是静态的，非常适合缓存，但只有约 28% 的调用把它缓存了。潜在收益与实际收益之间的差距，就是当前最大、最便宜的节省空间。

**Provider prefix caching（提供商前缀缓存）** 允许你对重复的 prompt prefix（提示前缀）享受大幅折扣。公开数据中折扣大致在 50%（OpenAI，超过阈值后自动启用，无写入费）到约 90%（Anthropic，显式 `cache_control` 断点，带少量写入溢价，通常经过几次读取后即可回本）再到约 75%（Google）之间。教学时必须明确指出的关键 caveat（注意事项）是：这些“50-95% savings（节省）”指的是**仅缓存前缀**，不是整张账单。

真正捕获它的方法（纪律性）：
- **让 prompt 按 static-to-dynamic（静态到动态）排序。** 将 system instructions（系统指令）、tool definitions（工具定义）和 few-shot examples（少样本示例）放前面（稳定前缀），把用户查询放最后。Exact-prefix matching（精确前缀匹配）意味着前部任何改动都会使整个下游缓存失效。
- **稳定前缀。** 缓存区域里不要放 timestamps（时间戳）、request IDs（请求 ID）或每次调用都变的 nonce；固定 tool-definition 的顺序。
- **关注 TTL economics（TTL 经济性）。** 如果存在写入溢价，那么只有在读取次数超过 break-even（盈亏平衡）点后缓存才划算，因此突发且低复用的流量可能并不会受益。
- **把每次调用的 cache-hit rate（缓存命中率）当作一等指标来监控。** Prompt 重写、模型版本升级和顺序调整都会悄悄拉低命中率。

与 prefix caching 不同，**exact-match（精确匹配）和 semantic caching（语义缓存）** 是针对重复 *query（查询）* 直接返回整条响应。Exact-match 以字面请求为键（便宜、零误报）；semantic caching 会对查询做 embedding（嵌入）并为相似命中返回缓存响应（对自然语言流量命中率更高，但存在需要防范的误命中风险）。可以分层使用：先 exact-match，再 semantic，再 prefix，并分别衡量各层命中率。从概念上说，这就是同一 KV 复用在计费层面的变现，见 [KV Cache and Context Caching](../04-inference-optimization/02-kv-cache-and-context-caching.md)。

---

## Batch 和 Async 经济学

OpenAI 和 Anthropic 都提供大约 **50% 的 batch processing（批处理）折扣**（输入和输出都算），采用 asynchronous（异步）方式，完成上限大约为 24 小时。决策规则很简单：**只要没有人或系统在等待 token，就使用 batch。** 高价值的 batch 工作负载包括 evaluation（评测）和 regression suites（回归套件）、大规模分类与标注、语料级 summarization（总结）和文档处理、prompt 或 model 变化后的 backfill（补跑），以及 A/B testing（A/B 测试）prompt 变体。对于产品的整个 offline tier（离线层）来说，不做 batch 就等于把大约一半的钱留在桌上。

第三条通道是 **provisioned/reserved throughput（预留/保留吞吐）**（AWS Bedrock Provisioned Throughput、Azure OpenAI PTUs）：按小时计费的预留容量，不论是否使用。已有报告称，在持续型工作负载上可节省约 15-70%，只有在利用率高且稳定时才经济。心理模型类似云计算：对尖峰或不确定需求，按 token 付费（包括 batch）；一旦利用率高且稳定，就用预留容量。

---

## FinOps 纪律

FinOps Foundation 的框架：在许多部署中，**inference（推理）占整个 GenAI 支出的 80-90%**，因此纪律的核心是每次请求的推理经济学，而不是训练。运营核心如下：

- **Attribution（归因）。** 按团队、功能、客户/租户、模型、路由和环境标记每次调用。技术上的使能方式是在 API 前放一个 token proxy（令牌代理）或 [gateway](03-ai-gateways-and-model-routing.md)，用于识别每次调用的来源。没有归因，就无法计算 unit economics（单元经济性），也看不出哪些用例赚回了自己的成本。
- **先 showback（展示性分摊），后 chargeback（费用回收）。** 先从可视化仪表板开始（按 provider、model、team、tenant 切分，并带每日预测和突增告警），等标签足够可信后再转入对账计费。
- **Unit economics（单元经济性）。** 跟踪每用户、每次对话、每个已解决 ticket（工单）或 case（案例）的成本，以及 AI 成本占收入和毛利的比例。把 AI 产品当作 cost-of-goods business 来教。
- **Margin reality（毛利现实）。** 已有报告快照显示，AI 产品的 gross margins（毛利率）比传统 SaaS 低约 25-30 个百分点，因为每次请求都有可变的 token 成本。这也是为什么 **outcome-based pricing（按结果定价）** 正在上升的原因，例如按每个已解决支持工单收费的固定价格。要求是：在按结果定价之前，先知道你的每次解决成本。
- **工具。** Gateways 提供实时的每次请求控制和支出上限；FinOps platforms（FinOps 平台）（Helicone、Vantage、Finout、Amnic，以及云成本工具）提供跨云分摊和 chargeback。成熟栈会同时运行两者。标准化某个工具之前，要先核实其当前状态；这一类工具变化很快。

---

## 结构性成本决策

这些架构级选择带来的成本变化可达 2-50x，远超单次调用调优：

- **Right-sizing（合适尺寸）、cascades（级联）和 routing（路由）。** 把请求路由到能满足质量门槛的最便宜模型，只在低置信度时升级。已有报告显示，在约 95% 的质量保留下可节省 45-85%（FrugalGPT 是经典参考），其中升级率是实时成本变量。见 [AI Gateways and Model Routing](03-ai-gateways-and-model-routing.md)。
- **Self-host（自托管）与 API 的 break-even（盈亏平衡）。** 相对 frontier API 的已报告盈亏平衡点在每月数千万到数亿 token 的区间，但真正需要警惕的是隐藏成本：原始 GPU 租赁只是真实成本的 30-40%，因此要乘上约 2.5-3x 的系数，而且工程人力通常超过基础设施成本。对 2026 年的大多数团队来说，计入完整栈后，managed APIs（托管 API）更便宜；只有在高、可预测、利用率高的体量，或者出于数据驻留原因时，自托管才更有优势。见 [LLM Infrastructure](01-llm-infrastructure.md)。
- **RAG vs long context（长上下文）。** 检索比塞进一个长上下文便宜得多，因为你只为少量相关 chunk 付费，而不是为一个巨大的 prompt 付费。Long context 适合小型、静态文档集；RAG 适合大型或频繁变化的语料，以及高查询量。见 [RAG Fundamentals](../06-retrieval-systems/01-rag-fundamentals.md)。
- **Distillation（蒸馏）。** 在锁定的 eval（评测）上，把小模型微调到只比 frontier model 低几个准确率点，已被报告可使每 token 成本降低 5-40x，并且在高体量下可在数周到数月内回本；它适合窄而高频的任务，不适合开放式、长尾工作。见 [Knowledge Distillation](../03-training-and-adaptation/05-knowledge-distillation.md) 和 [distillation case study（蒸馏案例研究）](../16-case-studies/19-customer-distillation-pipeline.md)。
- **Output 和 prompt engineering（提示工程）。** 简洁的输出契约、`max_tokens` 上限、structured outputs（结构化输出），以及当模型已经可靠时裁剪 few-shot 示例，已有报告显示可在几乎不损失质量的情况下减少 20-40% 的 token。

---

## 成本反模式

| 反模式 | 机制 | 修复 |
|--------------|-----------|-----|
| 不做缓存 | 每次都为静态 system prompt（约占输入的 69%）重复付费 | 稳定前缀 + provider prefix caching |
| 模型过大 | 本可由小模型处理的任务却用 frontier model | Right-size、cascade、route |
| 输出无限制 | 没有 `max_tokens`，格式冗长 | 上限和简洁输出契约 |
| 默认开启 reasoning | 对琐碎任务启用 extended thinking | 按任务复杂度控制思考 |
| 重试风暴 | 短暂错误触发无限重试 | 有界重试和 circuit breakers |
| 代理循环失控 | plan-act 循环永不终止；把工具错误当成“重试” | 在循环内设置硬性的步数、token 和重试上限 |
| 记忆无限增长 | 历史记录不做总结而不断累积 | Windowing 和 summarization |
| 长上下文塞满 | 默认把巨大的上下文当检索方式 | 对大型或变化中的语料使用 RAG |
| 无归因 | 未打标签的共享支出 | Gateway token proxy 加标签 |
| 离线工作走实时链路 | 用同步 API 做评测、补跑、标注 | Batch API |

已有真实事故把代理循环这一行说得很具体：失控的 agents 曾在一个周末内烧掉数万美元，直到有人发现。防线不是事后告警，而是在循环内部设置硬上限。

---

## 面试题

### Q: 你的 LLM 账单在流量持平的情况下环比翻倍。你怎么定位并修复？

**强答案：**
先做归因：如果每次调用没有通过 gateway 或 proxy 按 feature（功能）、team（团队）、model（模型）和 route（路由）打标签，那这是第一修复项，因为看不见就无法排查。有了归因之后，我会把支出拆成 token-spend layers（token 支出层），并查找常见元凶：某次 prompt 变更打破了 cache-hit rate（缓存命中率）（system prompt 约占输入 token 的 69%，所以缓存回退影响极大）、简单任务却开启了 extended thinking（按 output 费率计费且在响应中不可见）、agent loop（代理循环）的步数悄悄增加、输出或对话历史无限增长，或者重试风暴。最高 ROI 的修复通常总是先恢复 prompt caching，然后 right-size 模型并限制输出。我还会把任何离线工作（evals、backfills）迁移到 batch API，差不多能打五折，并为每个功能设置预算和突增告警，这样下一次翻倍会在第一天就提醒到人。

### Q: 为什么 AI 产品的 gross margins（毛利率）比 SaaS 更差，工程师该怎么做？

**强答案：**
因为每次请求都带着可变的 token 成本，所以 AI 产品更像 cost-of-goods business，而不是 zero-marginal-cost software（零边际成本软件）；已有报告显示，毛利率大约比典型 SaaS 低 25-30 个百分点。工程师从两个方向应对。结构上：缓存静态 prompt 前缀、right-size 并 cascade 模型、优先用 RAG 而不是 long-context stuffing（长上下文填充）、把高频窄任务蒸馏到小模型上，以及把离线层做 batch。运营上：把 unit economics（例如每次对话成本、每个已解决结果成本）做成仪表，让定价可以逐步转向 outcome-based models（按结果定价）；而这只有在你知道每次解决成本时才可行。成本杠杆是工程责任，而不只是财务责任。

---

## 参考资料

- Datadog, [State of AI Engineering 2026](https://www.datadoghq.com/state-of-ai-engineering/)
- FinOps Foundation, [Optimizing GenAI Usage](https://www.finops.org/wg/optimizing-genai-usage/) 和 [FinOps for AI](https://www.finops.org/wg/finops-for-ai-overview/)
- Anthropic, [prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching); OpenAI, [prompt caching](https://platform.openai.com/docs/guides/prompt-caching)
- Anthropic, [Message Batches API](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing); OpenAI, [Batch API](https://platform.openai.com/docs/guides/batch)
- Chen et al., "FrugalGPT" arXiv:2305.05176
- Bessemer, [the AI pricing and monetization playbook](https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook)

---

*上一章：[AI Gateways 和 Model Routing（模型路由）](03-ai-gateways-and-model-routing.md)*
