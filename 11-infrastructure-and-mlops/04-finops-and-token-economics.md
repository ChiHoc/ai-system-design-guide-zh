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

**Reasoning models（推理模型）和 agents（代理）是成本放大器，而这两者最糟糕，因为它们是不可见的。** extended-thinking token 按 output 费率计费，但不会出现在响应里，所以一次“很短”的调用，其成本可能比可见输出暗示的高出一个数量级；已有分析把放大倍数估在约 3x 到 15x 之间，取决于任务。思考也比过去更难关闭：Claude Opus 5.5 无法关闭，Sonnet 5.5 的最低设置在工具调用之间仍会产生思考 token，因此应以推理 effort 控制预算。Agents 会在每一步把 *整套* token 栈放大，所以正确的度量单位是 **每个任务的成本，而不是每次调用的成本**。已有报告区间：一次 chat turn（聊天轮次）是几分钱，而一个 agentic（代理式）多步骤任务可能从几毛钱到几美元不等。

**智能体以输入为主，因此缓存输入价格决定账单。** Anthropic 的 Claude Code 遥测数据（2026 年 9 月 24 日，厂商报告）显示，从 3 月到 9 月，输入与输出 token 的比例从 189:1 上升到 324:1，单次请求的上下文增长 2.6 倍。在这个比例下，输出价格影响很小；缓存读取费率与命中率决定每任务成本。关键杠杆是 harness：Anthropic 称其 harness 变更把缓存未命中的输入减少一半以上；Cursor 报告称，通过缩减约 66% 的系统提示词、仅在需要时加载内置工具，并放置明确的缓存断点，用户 token 成本下降 7%（两者均为厂商报告）。

一个便于教学的单次请求成本公式：

```
cost = uncached_input × in_rate + cached_input × cache_read_rate + cache_write_tokens × write_rate
       + (output_tokens + reasoning_tokens) × out_rate
cost_per_task = cost_per_request × expected_steps × (1 + retry_rate) + runtime_meters
```

其中 `runtime_meters` 包括任何按时间而非 token 计费的项目（托管智能体会话、沙箱、实时语音分钟数）；所有费率还要先乘以下述服务层级、数据驻留和长上下文系数。

### 每 token 价格以外的定价结构

标价只是成本模型的起点。以下系数如今决定实际账单：

| 系数 | 适用范围 | 影响 | 设计应对 |
|------------|------------------|--------|-----------------|
| 长上下文价格跳变 | OpenAI 输入超过 272K（整个请求）、xAI 提示达到 200K+（所有 token 价格翻倍）、Gemini 3.1 Pro Preview 超过 200K | GPT-6 Sol 每 100 万 token 的输入/输出价格从 $2/$10 变为 $4/$15；273K token 的提示输入成本约为 272K 的两倍 | 保持低于阈值或改用检索；Anthropic（Claude 4.6 及以后）在 1M 以内按统一价格计费 |
| 服务层级 | 所有主要供应商 | Batch 和 Flex 为 0.5 倍；OpenAI Fast 为 2 倍（GPT-5.5 为 2.5 倍）、Ultrafast 为 6 倍；Gemini Priority 约 1.8 倍；Bedrock Priority 为 1.75 倍；Claude Opus 5.5 的 fast mode 为 $8/$40，而标准价为 $4/$20 | 按工作负载类别设置层级策略（见[批处理与异步经济学](#batch-和-async-经济学)） |
| 数据驻留 | Anthropic `inference_geo: "us"`（Claude 4.6 及以后为 1.1 倍）、OpenAI 驻留端点、Bedrock 与 Google Cloud 区域端点、Mistral EU | 每个 token 约加价 10% | 只对有要求的租户固定地理位置 |
| 推广期定价 | Gemini 3.8 Flash 的 $0.75/$3.75 维持至 2026 年 12 月 31 日，此后为 $1.50/$7.50；GPT-5.6 Sol 的 $4/$20 优惠仅承诺“至少持续到”11 月 21 日（标价 $5/$30） | 基于优惠价制定的预算可能低估最多 2 倍 | 按标价预测 |
| 收费的拒绝响应 | Anthropic：自 2026 年 9 月 24 日起，`bio`、`frontier_llm` 和 `reasoning_extraction` 类别在输出前的拒绝也收费 | 探测这些领域的红队与评估套件会产生成本 | 按 `stop_details.category` 拆分支出 |
| 运行时计费项 | Claude Managed Agents：运行会话每小时 $0.08，另计 token，且无 Batch 折扣；OpenAI Agents API：托管沙箱容器费率；gpt-live-1：每会话分钟 $0.05，另计后端 token | token 之外的第二类计费 | 将空闲及运行时行为纳入每任务成本模型 |

---

## 缓存：最高的成本杠杆

之所以这是头号杠杆，恰恰因为前述锚点数据：约占输入 token 69% 的那一层（system prompt）是静态的，非常适合缓存，但只有约 28% 的调用把它缓存了。潜在收益与实际收益之间的差距，就是当前最大、最便宜的节省空间。

**Provider prefix caching（提供商前缀缓存）** 对前缀写入收取少量溢价，对后续读取提供大幅折扣。到 2026 年末，主要厂商的读取价格大致收敛到输入费率的 0.1 倍，最新模型甚至更低：

| 供应商 | 缓存写入 | 缓存读取 | 有效期与机制 |
|----------|-------------|------------|-------------------|
| OpenAI（GPT-5.6 及以后） | 输入费率的 1.25 倍 | 0.1 倍（GPT-6.1 Sol 为 0.05 倍） | 超过 1,024 token 后自动缓存；有效期固定为 30 分钟 |
| Anthropic | 1.25 倍（5 分钟）或 2 倍（1 小时） | 0.1 倍；Opus 5.5 为 0.05 倍；Fable 5.1 为 0.025 倍 | 显式 `cache_control` 断点 |
| Google（Gemini 3.8 Flash） | 存储费每 100 万 token 每小时 $0.50（推广价；2027 年 1 月 1 日起为 $1.00） | $0.075，对应输入 $0.75（推广价截至 2026 年 12 月 31 日，为 0.1 倍；2027 年 1 月 1 日起分别为 $0.15 和 $1.50） | 缓存存续期间按存储计费 |

由于读取折扣很大，1.25 倍写入在第一次缓存命中时就回本，2 倍的一小时写入则从第二次命中起划算（盈亏平衡点约为 1.1 次读取）。过去关于 OpenAI 缓存约五折且不收写入费的说法不适用于当前旗舰模型：GPT-5.6 及以后按 1.25 倍收取写入费；即使不收写入费的 GPT-5.5 和 GPT-5.4，读取价格也是 0.1 倍。教学时还应明确两个限制：标称节省仅作用于**缓存前缀**，而非整张账单；同一家厂商内部的读取费率如今可相差 4 倍，所以要按模型分别计算缓存后的每任务成本，而不能套用同一个系数。

真正捕获它的方法（纪律性）：
- **让 prompt 按 static-to-dynamic（静态到动态）排序。** 将 system instructions（系统指令）、tool definitions（工具定义）和 few-shot examples（少样本示例）放前面（稳定前缀），把用户查询放最后。Exact-prefix matching（精确前缀匹配）意味着前部任何改动都会使整个下游缓存失效。
- **稳定前缀。** 缓存区域里不要放 timestamps（时间戳）、request IDs（请求 ID）或每次调用都变的 nonce；固定 tool-definition 的顺序。必须在会话中途加入工具时，Anthropic 的 `inline-tools-2026-09-15` beta 可在对话中途的 system message 中加入工具，而不使已有缓存前缀失效。
- **关注 TTL economics（TTL 经济性）。** OpenAI 的 TTL 固定为 30 分钟，前缀复用间隔更长就不会命中；Anthropic 可用 2 倍写入费购买 1 小时 TTL。突发但低复用的流量可能完全无法从缓存获益。
- **把每次调用的 cache-hit rate（缓存命中率）当作一等指标来监控。** Prompt 重写、模型版本升级和顺序调整都会悄悄拉低命中率。两家厂商如今都提供诊断能力：OpenAI 于 2026 年 8 月 20 日推出提示缓存仪表盘，并于 9 月 8 日正式发布 Responses API 中的 Prompt Cache Diagnostics；Anthropic 的缓存诊断于 9 月 23 日正式发布。

与 prefix caching 不同，**exact-match（精确匹配）和 semantic caching（语义缓存）** 是针对重复 *query（查询）* 直接返回整条响应。Exact-match 以字面请求为键（便宜、零误报）；semantic caching 会对查询做 embedding（嵌入）并为相似命中返回缓存响应（对自然语言流量命中率更高，但存在需要防范的误命中风险）。可以分层使用：先 exact-match，再 semantic，再 prefix，并分别衡量各层命中率。从概念上说，这就是同一 KV 复用在计费层面的变现，见 [KV Cache and Context Caching](../04-inference-optimization/02-kv-cache-and-context-caching.md)。

---

## Batch 和 Async 经济学

OpenAI、Anthropic、Google 和 Bedrock 都为**异步工作提供大约 50% 的折扣**（输入和输出都算）：Batch API 的完成时间上限约为 24 小时，OpenAI、Google 和 Bedrock 还提供同样按 0.5 倍计费、适合容忍延迟的同步 Flex 层级。OpenRouter 于 2026 年 9 月 22 日增加跨供应商 Batch API（70 多种模型通常享受五折；OpenRouter 报告称，beta 期间批次完成时间的中位数为 7 分钟，90% 在一小时内完成）。决策规则很简单：**只要没有人或系统在等待 token，就使用 batch。** 高价值的 batch 工作负载包括 evaluation（评测）和 regression suites（回归套件）、大规模分类与标注、语料级 summarization（总结）和文档处理、prompt 或 model 变化后的 backfill（补跑），以及 A/B testing（A/B 测试）prompt 变体。对于产品的整个 offline tier（离线层）来说，不做 batch 就等于把大约一半的钱留在桌上。

第三条通道是 **provisioned/reserved throughput（预留/保留吞吐）**（AWS Bedrock Provisioned Throughput 提供 1 或 6 个月承诺期；Bedrock Reserved 层级提供 1 或 3 个月容量预留；另有 Azure OpenAI PTU）：按小时计费的预留容量，不论是否使用。已有报告称，在持续型工作负载上可节省约 15-70%，只有在利用率高且稳定时才经济。Anthropic 不再出售 Priority Tier 容量承诺（既有合同持续至到期），因此要获得 Claude 保证容量，现在需要定制协议或云平台的预留及优先层级。心理模型类似云计算：对尖峰或不确定需求，按 token 付费（包括 batch）；一旦利用率高且稳定，就用预留容量。

第四条通道是**为速度付费**：OpenAI Fast 层级（2 倍；2026 年 7 月 30 日由 Priority 更名）和 Ultrafast（6 倍；9 月 29 日起在 GPT-6 Astra 正式提供）、Gemini Priority（约 1.8 倍）、Bedrock Priority（1.75 倍），以及 Claude fast mode（研究预览，仅 Claude API）。同一模型仅因层级不同，就可能从 0.5 倍到 6 倍，价格相差 12 倍，因此成本模型需要按工作负载类别设置层级策略：

| 工作负载 | 等待方 | 层级 |
|----------|----------------|------|
| 评估、回填、批量标注 | 无人等待 | Batch（0.5 倍） |
| 后台智能体、异步内容增强 | 系统等待，数分钟可接受 | 有条件时使用 Flex（0.5 倍） |
| 聊天、交互式智能体 | 人等待，数秒可接受 | Standard |
| 语音与严格延迟 SLO | 人等待，亚秒级 | Fast 或 Priority（1.75-2 倍）；仅在测得的 SLO 足以支持时使用 Ultrafast（6 倍） |

---

## FinOps 纪律

FinOps Foundation 的框架：在许多部署中，**inference（推理）占整个 GenAI 支出的 80-90%**，因此纪律的核心是每次请求的推理经济学，而不是训练。运营核心如下：

- **Attribution（归因）。** 按团队、功能、客户/租户、模型、路由和环境标记每次调用。技术上的使能方式是在 API 前放一个 token proxy（令牌代理）或 [gateway](03-ai-gateways-and-model-routing.md)，用于识别每次调用的来源。没有归因，就无法计算 unit economics（单元经济性），也看不出哪些用例赚回了自己的成本。
- **先 showback（展示性分摊），后 chargeback（费用回收）。** 先从可视化仪表板开始（按 provider、model、team、tenant 切分，并带每日预测和突增告警），等标签足够可信后再转入对账计费。
- **Unit economics（单元经济性）。** 跟踪每用户、每次对话、每个已解决 ticket（工单）或 case（案例）的成本，以及 AI 成本占收入和毛利的比例。把 AI 产品当作 cost-of-goods business 来教。
- **Margin reality（毛利现实）。** 已有报告快照显示，AI 产品的 gross margins（毛利率）比传统 SaaS 低约 25-30 个百分点，因为每次请求都有可变的 token 成本。这也是为什么 **outcome-based pricing（按结果定价）** 正在上升的原因，例如按每个已解决支持工单收费的固定价格。要求是：在按结果定价之前，先知道你的每次解决成本。
- **默认拒绝超预算请求。** 供应商上限控制较粗。Anthropic 的使用层级（Start、Build、Scale）分别有 $500、$1,000、$200,000 的月度支出上限；触顶后，整个组织会收到带 `enforced_spend_limit_reached`、没有 `retry-after` 的 HTTP 429，直到下个月 1 日 00:00 UTC 才重置。Claude Managed Agents 的会话预算（2026 年 8 月 7 日）则以 `budget_reached` 暂停单个会话，这才是合适的粒度。应将自己的按功能和按会话预算设置得远低于供应商上限，让失控功能触发内部告警，而非导致所有产品被供应商切断。
- **工具。** Gateways 提供实时的每次请求控制和支出上限；FinOps platforms（FinOps 平台）（Helicone、Vantage、Finout、Amnic，以及云成本工具）提供跨云分摊和 chargeback。成熟栈会同时运行两者。标准化某个工具之前，要先核实其当前状态；这一类工具变化很快（例如 Helicone 于 2026 年 3 月被 Mintlify 收购），因此应保持成本数据可导出至自有数仓。

---

## 结构性成本决策

这些架构级选择带来的成本变化可达 2-50x，远超单次调用调优：

- **Right-sizing（合适尺寸）、cascades（级联）和 routing（路由）。** 把请求路由到能满足质量门槛的最便宜模型，只在低置信度时升级。已有报告显示，在约 95% 的质量保留下可节省 45-85%（FrugalGPT 是经典参考），其中升级率是实时成本变量。见 [AI Gateways and Model Routing](03-ai-gateways-and-model-routing.md)。
- **Self-host（自托管）与 API 的 break-even（盈亏平衡）。** 相对 frontier API 的已报告盈亏平衡点在每月数千万到数亿 token 的区间，但真正需要警惕的是隐藏成本：原始 GPU 租赁只是真实成本的 30-40%，因此要乘上约 2.5-3x 的系数，而且工程人力通常超过基础设施成本。2026 年进一步使盈亏平衡点偏向 API：GPU 租赁价格上涨（进入 9 月时，Silicon Data 的 B200 指数年内上涨 27.6%，10 月 1 日为每 GPU 小时 $5.86）；API 价格则下降（GPT-6 Luna 每 100 万输入/输出 token $0.10/$0.50，在路由和分类任务层级低于大多数自托管开放权重模型）。对大多数团队来说，计入完整栈后，托管 API 更便宜；只有在高、可预测、利用率高的体量，或者出于数据驻留原因时，自托管才更有优势。见 [LLM Infrastructure](01-llm-infrastructure.md)。
- **RAG vs long context（长上下文）。** 检索比塞进一个长上下文便宜得多，因为你只为少量相关 chunk 付费，而不是为一个巨大的 prompt 付费。Long context 适合小型、静态文档集；RAG 适合大型或频繁变化的语料，以及高查询量。见 [RAG Fundamentals](../06-retrieval-systems/01-rag-fundamentals.md)。
- **Distillation（蒸馏）。** 在锁定的 eval（评测）上，把小模型微调到只比 frontier model 低几个准确率点，已被报告可使每 token 成本降低 5-40x，并且在高体量下可在数周到数月内回本；它适合窄而高频的任务，不适合开放式、长尾工作。要规划学生模型的长期运行位置：OpenAI 正逐步关闭其微调平台，现有客户自 2027 年 1 月 6 日起也无法创建新的微调任务，因此开放权重或其他平台是更稳妥的选择。见 [Knowledge Distillation](../03-training-and-adaptation/05-knowledge-distillation.md) 和 [distillation case study（蒸馏案例研究）](../16-case-studies/19-customer-distillation-pipeline.md)。
- **Output 和 prompt engineering（提示工程）。** 简洁的输出契约、`max_tokens` 上限、structured outputs（结构化输出），以及当模型已经可靠时裁剪 few-shot 示例，已有报告显示可在几乎不损失质量的情况下减少 20-40% 的 token。
- **谁为推理付费。** 一种新选项正在出现：Sign in with ChatGPT（于 2026 年 9 月 29 日 OpenAI DevDay 公布，目前仅面向选定合作伙伴限量试点）可让符合条件的 Responses API 请求使用用户自己的 ChatGPT 套餐，而非开发者的 API 账户。如果扩大开放，它会将部分推理成本从产品损益表中移出，但代价是身份与 AI 计费绑定到一家供应商。

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
| 离线工作走实时链路 | 用同步 API 做评测、补跑、标注 | Batch API 或 Flex 层级 |
| 提示刚好超过长上下文阈值 | OpenAI 对超过 272K 输入 token 的整个请求按长上下文费率计费 | 缩短提示或使用检索以保持低于阈值，也可路由到统一价格模型 |
| 对所有请求启用数据驻留 | 无此需求的租户每 token 多付约 1.1 倍 | 在网关按租户固定地理位置 |
| 用推广价制定预算 | 入门费率结束（Gemini Flash 于 2027 年 1 月 1 日涨价一倍） | 按标价预测 |
| 对支出上限的 429 重试 | 上限要到下个月 1 日才重置 | 根据错误代码分支处理；故障切换并告警 |

已有真实事故把代理循环这一行说得很具体：失控的 agents 曾在一个周末内烧掉数万美元，直到有人发现。防线不是事后告警，而是在循环内部设置硬上限；托管运行时如今也原生提供这类上限（如 Claude Managed Agents 的会话预算）。

---

## 面试题

### Q: 你的 LLM 账单在流量持平的情况下环比翻倍。你怎么定位并修复？

**强答案：**
先做归因：如果每次调用没有通过 gateway 或 proxy 按 feature（功能）、team（团队）、model（模型）和 route（路由）打标签，那这是第一修复项，因为看不见就无法排查。有了归因之后，我会把支出拆成 token-spend layers（token 支出层），并查找常见元凶：某次 prompt 变更打破了 cache-hit rate（缓存命中率）（system prompt 约占输入 token 的 69%，所以缓存回退影响极大）、简单任务却开启了 extended thinking（按 output 费率计费且在响应中不可见）、agent loop（代理循环）的步数悄悄增加、输出或对话历史无限增长，或者重试风暴。还要检查那些在流量持平时隐藏的定价结构因素：提示增长后跨过长上下文阈值（OpenAI 对超过 272K 输入 token 的整个请求按更高费率计费）、流量转移到 Fast 或绑定数据驻留的层级、更换模型后缓存读取费率不同，或推广价已经结束。最高 ROI 的修复通常仍是先恢复提示缓存，然后选择合适规模的模型并限制输出。我还会把离线工作（评估、回填）迁移到 Batch API 或 Flex 层级，约可打五折，并设置按功能预算和突增告警，让下一次翻倍在第一天就触发通知。

### Q: 为什么 AI 产品的 gross margins（毛利率）比 SaaS 更差，工程师该怎么做？

**强答案：**
因为每次请求都带着可变的 token 成本，所以 AI 产品更像 cost-of-goods business，而不是 zero-marginal-cost software（零边际成本软件）；已有报告显示，毛利率大约比典型 SaaS 低 25-30 个百分点。工程师从两个方向应对。结构上：缓存静态 prompt 前缀、right-size 并 cascade 模型、优先用 RAG 而不是 long-context stuffing（长上下文填充）、把高频窄任务蒸馏到小模型上，以及把离线层做 batch。运营上：把 unit economics（例如每次对话成本、每个已解决结果成本）做成仪表，让定价可以逐步转向 outcome-based models（按结果定价）；而这只有在你知道每次解决成本时才可行。成本杠杆是工程责任，而不只是财务责任。

---

### Q: 某团队想把 300K token 上下文的工作负载从 Claude Sonnet 5.5 迁到 GPT-6 Sol，因为两者标价均为 $2/$10。你会检查什么？

**强答案：**
标价相同是最没有信息量的一点。第一，长上下文价格跳变：输入超过 272K token 后，OpenAI 对整个 GPT-6 Sol 请求按 $4/$15 计费，而 Claude 在 1M 以内保持统一价格。未缓存时，一个输入 300K、输出 2K 的调用在 Sonnet 5.5 上约为 $0.62（输入 $0.60，加输出 $0.02），在 GPT-6 Sol 上约为 $1.23；除非把上下文裁减至 272K 以下或改用检索，否则所谓“同价”迁移会使单次调用成本大约翻倍。第二，缓存：标准上下文长度下，两者的缓存读取标价均为 $0.20，但 OpenAI 的 TTL 固定为 30 分钟，因此我会检查工作负载的复用间隔；两者写入均按 1.25 倍计费。第三，推理：Sonnet 5.5 默认高 effort，且无法完全关闭思考，因此应在自己的追踪中比较所有计费输出，而非只看可见输出。第四，数据驻留（固定区域时两边均约加价 10%）与服务层级。最后，运行评估套件检查质量，测试强制工具选择等请求格式差异。我会根据实测的每任务成本决定，而非只看费率表。

---

## 参考资料

- Datadog, [State of AI Engineering 2026](https://www.datadoghq.com/state-of-ai-engineering/)
- FinOps Foundation, [Optimizing GenAI Usage](https://www.finops.org/wg/optimizing-genai-usage/) 和 [FinOps for AI](https://www.finops.org/wg/finops-for-ai-overview/)
- Anthropic, [prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching); OpenAI, [prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)
- Anthropic, [定价](https://platform.claude.com/docs/en/about-claude/pricing)、[服务层级](https://platform.claude.com/docs/en/api/service-tiers)和[速率限制](https://platform.claude.com/docs/en/api/rate-limits)；OpenAI，[定价](https://developers.openai.com/api/docs/pricing)
- Anthropic, [Message Batches API](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing); OpenAI, [Batch API](https://platform.openai.com/docs/guides/batch)
- Anthropic，[Claude Opus 5.5 与编码会话遥测](https://claude.com/blog/claude-opus-5-5-built-for-coding-sessions-that-use-more-context)
- Chen et al., "FrugalGPT" arXiv:2305.05176
- Bessemer, [the AI pricing and monetization playbook](https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook)

---

*上一章：[AI Gateways 和 Model Routing（模型路由）](03-ai-gateways-and-model-routing.md)*
