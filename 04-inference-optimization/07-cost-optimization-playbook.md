# AI 成本优化实践手册

AI 成本不再是“魔法成本”（magic cost）。它是可度量（measurable）、可预测（predictable）且可高度优化（highly optimizable）的。中低档位 API 的每 token 价格持续下降（2026 年 9 月，GPT-6 Sol 每 1M token $2/$10、GPT-6 Luna $0.10/$0.50，至少将 GPT-5.6 Sol 和 Luna 的标价减半；Claude Opus 5.5 则将 Opus 档降至 $4/$20；10 月 Claude Haiku 5.5 以 $0.10/$0.50 上市，是 Haiku 4.5 的十分之一；GPT-6.1 Terra 为 $1/$5，GPT-5.6 Terra 为 $2/$12），而 GPU 租赁价格在 2026 年上涨。因此成本杠杆主要在 **routing（路由）**、**caching（缓存）**与**服务档位选择**，而不只是选择更便宜的 provider（提供商）。本章讲解在不牺牲质量的前提下将推理成本（inference cost）降低 10 倍的策略。

## 目录

- [AI 的单位经济学（Unit Economics）](#ai-的单位经济学-unit-economics)
- [模型级联（Model Cascading，效率分层）](#模型级联-model-cascading-效率分层)
- [小语言模型（SLM，Small Language Models）](#生产环境中的小语言模型-slms)
- [服务档位与价格倍数](#服务档位与价格倍数)
- [Spot Instance 策略](#spot-instance-抢占式实例-策略)
- [“Token Tax（Token 税）”优化](#token-tax-token-税-优化)
- [面试问题（Interview Questions）](#面试问题-interview-questions)
- [参考资料（References）](#参考资料)

---

## AI 的单位经济学（Unit Economics）

在给定质量门槛和延迟 SLO 下，我们用 **Tokens per Dollar（每美元令牌数）** 来衡量成功。

| 组成部分（Component） | 成本驱动因子（Cost Driver） | 优化方式（Optimization） |
|-----------|-------------|--------------|
| **Compute（算力）** | GPU 时间（$/hr） | 更高利用率（Batching） |
| **VRAM** | KV Cache 大小 | GQA，量化（Quantization） |
| **Network（网络）** | Payload Size（载荷大小） | 压缩（Compression），本地部署（Local serving） |
| **API** | 按 Token 定价 | 缓存（Caching）、模型选择（Model selection）、服务档位 |

---

## 模型级联（Model Cascading，效率分层）

最有效的降本策略是使用**能完成该任务的最便宜模型**。

**级联模式（Cascade Pattern）**（截至 2026 年 11 月 2 日，每 1M 输入/输出 token 的标价）：
1. **Classifier（分类器）**：自托管小模型（0.5B）判断查询复杂度，成本接近 $0；也可使用托管决策模型。OpenAI Decisions API 返回带概率的类型化答案，仅按输入计费，未缓存价格为每 1M token $0.10（见[研究雷达主题 16](../RESEARCH-RADAR.md#_16-决策模型-带概率的类型化答案)）。应使用自己的流量校准阈值；早期决策模型研究报告其概率偏低。
2. **第 1 层（Tier 1，小型/低价）**：90% 的请求（问候、简单问答、抽取）走 GPT-6 Luna（$0.10/$0.50）、Claude Haiku 5.5（提示词不超过 100K token 时为 $0.10/$0.50）、DeepSeek V4.1-Flash 或自托管小模型（$）。
3. **第 2 层（Tier 2，中档）**：9% 的请求（复杂推理）走 GPT-6.1 Terra（$1/$5）、Claude Sonnet 5.5（$2/$10）、GPT-6 Sol（$2/$10）或 Gemini 3.8 Flash（至 2026 年 12 月 31 日的推广价 $0.75/$3.75；自 2027 年 1 月 1 日起 $1.50/$7.50）（$$$）。
4. **第 3 层（Tier 3，前沿推理）**：1% 的请求（专家级）走 Claude Opus 5.5（$4/$20）、GPT-6 Astra（$10/$50）或 Claude Fable 5.1（$10/$50），并采用高推理强度（$$$$$）。

**净结果（Net result）**：相比全部流量都送到第 2 层，成本降低 80%。

**缓存打破档位成本的单调性。**自 10 月 7 日起，Sonnet 5.5 的缓存读取为原价的 0.05x（每 1M token $0.10），Opus 5.5 为 0.05x（$0.20）；因此，缓存后的 Opus 5.5 token 仅为未缓存 Sonnet 5.5 token（$2）的十分之一。对于反复读取长缓存上下文的智能体循环，Opus 5.5 甚至可能比缓存较差的 Sonnet 流量便宜。级联模型应按包含缓存命中率的*逐任务实际成本*排序，而非按输入标价排序。

**提示词长度也会打破档位关系。**Claude Haiku 5.5 的提示词超过 100,000 token 后，整个请求按 $0.50/$2.50（5 倍）计费，缓存读取和写入也计入长度。若第 1 层路由不断累积智能体历史，即使路由没有变化，费用也会变为 5 倍；因此应把 Haiku 5.5 上下文限制或压缩在阈值以下，或将长提示词改路由到其他模型。

---

## 生产环境中的小语言模型（SLMs）

小型开源模型（IBM Granite 4.2 3B 和 8B、Gemma 4 12B、Qwen3.8-27B）及最便宜的 API 档位（GPT-6 Luna、Claude Haiku 5.5）在大多数基准测试上已达到或超过 2023 年原始 GPT-4 的水平。
- **使用场景（Use Case）**：实体抽取（Entity extraction）、情感分析（sentiment analysis）、简单 RAG、路由。
- **成本（Cost）**：与每 token $10 / $50 的最高档位（Claude Fable 5.1、GPT-6 Astra）相比，GPT-6 Luna 和 Claude Haiku 5.5（$0.10 / $0.50）每 token 约便宜 100 倍；自托管小模型只有在高利用率下才可能更便宜。Haiku 5.5 有两点限制：该价格只适用于不超过 100K token 的提示词；其新 tokenizer 对相同文本产生的 token 比 Haiku 4.5 多约 30%，因此单位文本的实际节省幅度较小。
- **延迟（Latency）**：短输出的响应时间 < 100ms。

### 价格底线：GPT-6 Luna 与 DeepSeek V4.1-Flash

DeepSeek V4 Flash（2026 年 4 月 24 日发布）上市时以每 1M token $0.14 / $0.28 重设价格底线，但价格后来发生变化。DeepSeek 于 2026 年 8 月 16 日引入高峰/非高峰计费，随后在 9 月 10 日发布 **V4.1-Flash**（`deepseek-flash`）：高峰时输入 $0.30、输出 $1.20，非高峰减半（$0.15 / $0.60）；缓存命中价格分别为高峰 $0.006、非高峰 $0.003。高峰仅为工作日 UTC 01:00-04:00 和 06:00-10:00，排除中国法定假日，因此周末全部为非高峰。**V4-Pro**（V4-Pro-0813）仍可使用，高峰 $1.32 / $3.96，非高峰 $0.66 / $1.98；原计划于 9 月 14 日把 V4-Pro 流量改路由到 V4.1-Flash，但在 9 月 11 日撤回了计划。

更便宜的闭源档位如今反而低于它：**GPT-6 Luna** 的价格为 $0.10 / $0.50（缓存输入 $0.01），其未缓存输入和输出价格甚至低于非高峰 V4.1-Flash（$0.15 / $0.60）；**Claude Haiku 5.5**（10 月 7 日）对不超过 100K token 的提示词也与 Luna 标价和缓存价相同。DeepSeek 仍有缓存命中价格优势（高峰 $0.006、非高峰 $0.003，对比 $0.01），并提供可自托管的 MIT 权重；自 10 月 17 日起，`deepseek-flash` 别名已由 V4.1-Flash-1017 构建版本提供服务，因此应对实际调用的别名重新评测。对高吞吐批量任务，实用的价格底线是“GPT-6 Luna 或 Claude Haiku 5.5，或把高缓存复用任务（共享知识库的 RAG、代码库智能体）排到非高峰运行的 DeepSeek V4.1-Flash”，具体选择取决于任务评测质量。提交前请核对 [DeepSeek 定价页](https://api-docs.deepseek.com/quick_start/pricing)和 [OpenAI 定价页](https://developers.openai.com/api/docs/pricing)。

---

## 服务档位与价格倍数

同一模型仅因档位不同，价格范围如今就可相差约 12x。因此成本模型应针对每类负载（交互、智能体内循环、离线任务）设定档位策略，而非只使用一个每 token 价格。

| 杠杆 | 相对 Standard 的倍数 | 适用场景（截至 2026 年 11 月 2 日） |
|-------|------------------------|--------------------------------|
| **Batch / Flex** | 0.5x | OpenAI Batch 和 Flex、Gemini Batch 和 Flex、Bedrock Flex、Anthropic Batch；OpenRouter 的 Batch API（2026 年 9 月 22 日）对 70+ 个模型通常优惠 50%，测试阶段批次完成时间的中位数为 7 分钟 |
| **非高峰调度** | 0.5x | DeepSeek 的非高峰时段及周末 |
| **缓存读取** | 通常 0.1x；Opus 5.5、Sonnet 5.5、GPT-6.1 Sol 和 GPT-6.1 Terra 为 0.05x；Fable 5.1 为 0.025x | 所有主要 API。Anthropic（5 分钟 TTL）和 OpenAI GPT-5.6+（30 分钟 TTL）的写入价格为 1.25x；Anthropic 1 小时缓存为 2x；OpenAI 12 小时缓存（10 月 20 日）为 2.5x |
| **Priority / Fast** | 约 1.75x 至 2.5x | OpenAI Fast 为 2x（GPT-5.5 为 2.5x）；Gemini Priority 约 1.8x；Bedrock Priority 为 1.75x；Anthropic Opus 5.5 fast mode 售价 $8/$40（2x），10 月 15 日结束研究预览，现已在 Claude API、Google Cloud 上由 Anthropic 管理的 Claude Models 和 Azure 托管的 Foundry 部署中提供；Opus 4.8 fast mode 将于 11 月 30 日移除 |
| **Ultrafast** | 6x | OpenAI：自 2026 年 9 月 29 日起在 GPT-6 Astra 上正式上线（Bedrock 上的 Astra 也提供）；GPT-6.1 Sol 自 10 月 8 日起向所有 API 用户开放（$12/$60） |
| **长上下文** | 整个请求重新计价 | OpenAI 超过 272K 输入 token（GPT-6 Sol $4/$15、GPT-6.1 Terra $2/$7.50）；Claude Haiku 5.5 超过 100K 提示词 token（含缓存读写，$0.50/$2.50，即 5 倍）；xAI 超过 200K 时所有 token 双倍计价；其他 Claude 4.6 及后续模型在 1M 以内价格不变 |
| **数据驻留** | 约 1.1x | Anthropic `inference_geo: "us"`、OpenAI 驻留端点、Bedrock 与 Google Cloud 上的区域性 Claude、Mistral EU |

有两个陷阱。跨过阈值后，长上下文附加费会作用于*整个*请求：将 280K-token 的 GPT-6 Sol 提示缩短到 270K，就能把输入费率减半、输出费率降低三分之一；Haiku 5.5 的 101K-token 提示输入约需 $0.05，而 99K-token 提示约需 $0.01。推广价也应按标价编制预算：Gemini 4 Argon 仅在 11 月 30 日前为 $2/$10，12 月 1 日起为 $4/$20；Gemini 3.8 Flash 的引入价在 12 月 31 日结束；OpenAI 对 GPT-5.6 Sol 促销价的承诺仅为“至少持续到 2026 年 11 月 21 日”。

---

## Spot Instance（抢占式实例）策略

对于非实时工作负载（batch processing、data extraction），使用 **GPU Spot Instances（GPU 抢占实例）**（AWS Spot、Google Cloud Spot VMs、Azure Spot）。

- **风险**：GPU 可能在短暂通知后被回收：AWS 提前两分钟通知，Google Cloud 和 Azure 约提前 30 秒。
- **缓解**：让任务可重启。为批处理进度设检查点，保持请求幂等，在收到回收信号时重新排队进行中的请求。支持将 KV 分层卸载到共享存储的引擎，可在回收后保留前缀缓存，但不能指望对进行中解码状态做在线迁移。

### 2026 年 GPU 价格：上涨，且长期合约更便宜

随着受内存带宽约束的推理需求增长，GPU 租赁价格在 2026 年上涨。Silicon Data 于 2026 年 11 月 1 日的指数为：B200 每 GPU 小时 $6.50、B300 $7.56、H200 $3.46、H100 $2.93。B200 指数仅 10 月就上涨约 11%（10 月初为 $5.86）；进入 9 月时年初至今已上涨 27.6%。期限结构颠倒了过去的建议：9 月 7 日 B200 的 3 个月合约指数为 $5.73，12 个月合约为 $5.39，因此锁定更长时间反而更便宜。10 月 1 日的按需标价：Lambda H100 SXM $3.99、B200 $6.69；RunPod 的 community/secure H100 为 $2.69/$3.49、B200 为 $5.98/$6.79、B300 为 $6.94/$7.89。应仔细阅读新兴云服务商的合同条款；SemiAnalysis 的 ClusterMAX 3.0 指出，某些 1 年期承诺的预付款高达 100%。

---

## “Token Tax（Token 税）”优化

- **提示缓存**：保持前缀在字节层面稳定（顶部不放时间戳或每用户 ID、工具顺序固定），使重复上下文按缓存读取价格计费：大多数模型为 0.1x，Opus 5.5、Sonnet 5.5、GPT-6.1 Sol 和 GPT-6.1 Terra 为 0.05x，Fable 5.1 为 0.025x。TTL 应与复用间隔匹配：OpenAI 的 12 小时缓存（写入为 2.5 倍）适合一天内复用数次、会错过 30 分钟缓存窗口的前缀。
- **输入主导智能体成本**：Anthropic 的 Claude Code 遥测数据（2026 年 9 月 24 日，供应商自报）显示，输入与输出 token 比从 189:1 升至 324:1。在这一比例下，决定成本的是缓存命中率和缓存输入价格，而非输出价格。Cursor 报告称，在将系统提示缩短约三分之二并动态加载工具后，用户 token 成本降低 7%（供应商自报）。
- **推理强度**：按路由显式设置。默认值因模型而异，且会随版本变化：Claude Opus 5.5 默认为 `medium`（Opus 5 为 `high`），Sonnet 5.5 和 Fable 5.1 默认为 `high`，GPT-6.1 Sol 和 GPT-6.1 Terra 默认为 `medium`。某些新模型根本无法关闭思考，此时强度是剩余的调节手段。
- **Output Truncation（输出截断）**：严格限制 `max_tokens`。
- **简洁输出指令**：要求简短回答（并规定固定输出 schema）能减少输出 token；应在自己的提示上测量节省幅度，而非假定固定比例，因为推理 token 常是主要部分，且不受这类指令影响。

---

## 面试问题（Interview Questions）

### 问：如何向 CFO 说明 AI 系统的成本合理性？

**高质量答案：**
我聚焦于**效率 ROI（ROI of Efficiency）**。第一，实施 “Model Cascading（模型级联）”，确保 90% 流量由每百万 token 定价远低于 $1 的模型处理。第二，实施 “Semantic Caching（语义缓存）”与提示缓存，避免为相同答案或相同上下文重复付费。第三，为每类负载指定服务档位（离线任务用半价批处理，只在 SLO 要求时用 priority）。第四，建立 “Inference Quotas（推理配额）” 和 “Chargeback Models（成本归集模型）”，使每个业务单元对其使用量负责。将 AI 视为具有分层定价的“Commodity Resource（商品化资源）”，我们就能从“无限试验（unbounded experimentation）”转向“可预测运营支出（predictable OpEx）”模型。

### 问：什么时候自建单节点 GPU 集群比调用 API 更便宜？

**高质量答案：**
“Crossover Point（拐点）”出现在**持续高吞吐**下，而且高度依赖所替代的 API 档位。按 2026 年 11 月数据计算：两张 H100 按 Silicon Data 指数价格（11 月 1 日每 GPU 小时 $2.93）计，每月约 $4,300，足以运行 70B 级开源模型。输入与输出为 3:1 时，Claude Sonnet 5.5 或 GPT-6 Sol（$2/$10）每百万 token 约 $4，盈亏平衡点在每月约 1B token；对比 Opus 5.5（$4/$20）约为 540M；对比 GPT-6.1 Terra（$1/$5，混合价格约 $2）约为 2B。对比 GPT-6 Luna 或 Claude Haiku 5.5（$0.10/$0.50，混合价格约 $0.20），平衡点约为每月 21B token，即全天每秒约 8,000 token，已达到或超过两张 GPU 运行 70B 模型的可持续能力，因此实际很难仅凭价格胜过最低价 API 档位。自托管 70B 与前沿 API 的质量也不等价，应与达到自己质量门槛的 API 档位比较，而不是与最贵档位比较。波动性或集中在工作时间的流量更适合 API，因为它允许你在空闲时段“为沉默付费”；智能体负载若能以 0.1x 或更低价格读取 API 缓存，盈亏平衡点会进一步后移。自托管在利用率稳定且较高、数据无法离开自身边界，或需要微调开源模型时胜出；2026 年上涨的 GPU 租赁价格又提高了门槛。

---

## 参考资料
- Google Cloud. 《Cost Optimization for Generative AI》（2024）
- Anyscale. 《LLM Inference: API vs. Self-Hosted Costs》（2024）
- OpenAI。[API 定价](https://developers.openai.com/api/docs/pricing)；Anthropic。[定价](https://platform.claude.com/docs/en/about-claude/pricing)；DeepSeek。[模型与定价](https://api-docs.deepseek.com/quick_start/pricing)
- Silicon Data。[B200 租赁指数](https://www.silicondata.com/products/silicon-index/b200)、[B300 指数](https://www.silicondata.com/products/silicon-index/b300)、[H200 指数](https://www.silicondata.com/products/silicon-index/h200)和 [H100 指数](https://www.silicondata.com/products/silicon-index/h100)
- OpenAI。[Decisions API 指南](https://developers.openai.com/api/docs/guides/decisions)

---

*下一页（Next）: [Diffusion Language Models](08-diffusion-llms.md)*
