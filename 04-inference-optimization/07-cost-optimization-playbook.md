# AI 成本优化实践手册

AI 成本不再是“魔法成本”（magic cost）。它是可度量（measurable）、可预测（predictable）且可高度优化（highly optimizable）的。过去一年 API 价格下降了 30%-60%，成本杠杆现在主要在 **routing（路由）** 与 **caching（缓存）**，而不只是选择更便宜的 provider（提供商）。本章讲解在不牺牲质量的前提下将推理成本（inference cost）降低 10 倍的策略。

## 目录

- [AI 的单位经济学（Unit Economics）](#ai-的单位经济学-unit-economics)
- [模型级联（Model Cascading，效率分层）](#模型级联-model-cascading-效率分层)
- [小语言模型（SLM，Small Language Models）](#生产环境中的小语言模型-slms)
- [Spot Instance 策略](#spot-instance-抢占式实例-策略)
- [“Token Tax（Token 税）”优化](#token-tax-token-税-优化)
- [面试问题（Interview Questions）](#面试问题-interview-questions)
- [参考资料（References）](#参考资料)

---

## AI 的单位经济学（Unit Economics）

我们用 **Tokens per Dollar（每美元令牌数）** 来衡量成功。

| 组成部分（Component） | 成本驱动因子（Cost Driver） | 优化方式（Optimization） |
|-----------|-------------|--------------|
| **Compute（算力）** | GPU 时间（$/hr） | 更高利用率（Batching） |
| **VRAM** | KV Cache 大小 | GQA，量化（Quantization） |
| **Network（网络）** | Payload Size（载荷大小） | 压缩（Compression），本地部署（Local serving） |
| **API** | 按 Token 定价 | 缓存（Caching）、模型选择（Model selection） |

---

## 模型级联（Model Cascading，效率分层）

最有效的降本策略是使用**能完成该任务的最便宜模型**。

**级联模式（Cascade Pattern）:**
1. **Classifier（分类器）**：一个小模型（0.5B）判断查询复杂度（$0.00）。
2. **第 1 层（Tier 1，SLM）**：90% 的请求（问候、简单问答）走 8B 模型（$）。
3. **第 2 层（Tier 2，Frontier）**：9% 的请求（复杂推理）走 405B / Claude Sonnet 4.6 / GPT-5.5 / Gemini 3.1 Pro 级模型（$$$）。
4. **第 3 层（Tier 3，Reasoning）**：1% 的请求（专家级）走如 Claude Opus 4.7 或 GPT-5.5 with extended thinking（带延展思考）这类 thinking models（思维模型）（$$$$$）。

**净结果（Net result）**：相比全部流量都送到第 2 层，成本降低 80%。

---

## 生产环境中的小语言模型（SLMs）

3B-8B 模型（Llama 4 8B、Gemini 3.1 Flash、Claude Haiku 4.5）在大多数基准测试上已达到或超过 2023 年原始 GPT-4 的水平。
- **使用场景（Use Case）**：实体抽取（Entity extraction）、情感分析（sentiment analysis）、简单 RAG。
- **成本（Cost）**：比 frontier 模型便宜 100 倍运行成本。
- **延迟（Latency）**：响应时间 < 100ms。

### DeepSeek V4 成本底线（Floor）

DeepSeek V4 Flash（发布时间 2026 年 4 月 24 日）将便宜的 frontier-class inference（前沿级推理）成本底线重置为 **$0.14 / $0.28 每百万 token（1M tokens）**，并提供 1M 上下文窗口，且 cache-hit 输入价格为 $0.0028/M。DeepSeek V4 Pro 在 2026 年 5 月 22 日将 75% 折扣永久化后，大致比 Claude Opus 4.7 便宜约 10 倍（$0.435 / $0.87 vs $5 / $25 每 1M）。对于 prefix（前缀）高复用、缓存密集的高吞吐场景（如共享知识库的 RAG、批量分类、代码库 agents），V4 Flash 或 V4 Pro 在你开始任何级联前，就已经成为主导的成本优化杠杆。提交前请先在 [DeepSeek pricing page（定价页）](https://api-docs.deepseek.com/quick_start/pricing) 验证。

---

## Spot Instance（抢占式实例）策略

对于非实时工作负载（batch processing、data extraction），使用 **GPU Spot Instances（GPU 抢占实例）**（AWS Spot、Azure Spot、Lambda Labs）。

- **风险**：GPU 可能在 30 秒通知内被回收。
- **缓解**：**Live KV-Cache Migration（在线 KV 缓存迁移）**。服务框架（serving frameworks）可在收到 “Reclamation Signal（回收信号）” 后立即将进行中的请求 KV cache 流式迁移到其他节点，从而确保工作不丢失。

---

## “Token Tax（Token 税）”优化

- **System Prompt Caching（系统提示词缓存）**：将常见前缀硬编码（hard-code）以获得 90% 折扣。
- **Output Truncation（输出截断）**：严格限制 `max_tokens`。
- **Negative Prompting（负向提示）**：设置 “Don't be wordy（不要啰嗦）” 可节省约 15% 的输出 token（因此降低成本）。

---

## 面试问题（Interview Questions）

### 问：如何向 CFO 说明 AI 系统的成本合理性？

**高质量答案：**
我聚焦于**效率 ROI（ROI of Efficiency）**。第一，实施 “Model Cascading（模型级联）”，确保 90% 流量由每百万 token 成本低于一分钱的模型处理。第二，实施 “Semantic Caching（语义缓存）”，避免对同一答案重复付费。第三，建立 “Inference Quotas（推理配额）” 和 “Chargeback Models（成本归集模型）”，使每个业务单元对其使用量负责。将 AI 视为具有分层定价的“Commodity Resource（商品化资源）”，我们就能从“无限试验（unbounded experimentation）”转向“可预测运营支出（predictable OpEx）”模型。

### 问：什么时候自建单节点 GPU 集群比调用 API 更便宜？

**高质量答案：**
“Crossover Point（拐点）”通常出现在**持续高吞吐**下。如果你的应用基线是全天候 24/7、每秒 5-10 请求，那么 H100 预留实例的固定成本会比 API 的可变 token 成本更便宜。然而，如果你的流量“高峰波动”（spiky）或明显集中在工作时间，API 通常更便宜，因为它允许你在空闲时段“为沉默付费”（pay for the silence）。对大多数企业来说，在 70B 级模型下，盈亏平衡通常在每月约 5 亿 token。

---

## 参考资料
- Google Cloud. 《Cost Optimization for Generative AI》（2024）
- Anyscale. 《LLM Inference: API vs. Self-Hosted Costs》（2024）

---

*下一页（Next）: [Diffusion Language Models](08-diffusion-llms.md)*
