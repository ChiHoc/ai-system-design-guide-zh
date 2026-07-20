# 模型分类体系

本章提供了截至**2026年6月**的模型全景指南，涵盖模型家族、能力与生产系统中的选型标准。

> **最后核验：2026年6月28日。** 模型格局变化很快。请始终与供应商价格页与发布说明交叉核对。
>
> **2026年6月要闻：** Anthropic 发布了 **Claude Fable 5**（6月9日，`claude-fable-5`，每 1M 输入/输出 10/50 美元，1M 上下文），这是其最强大且公开发布的模型：一款 Mythos 级模型，已为通用可用做了安全化处理，并在敏感主题上有 Opus 4.8 回退保护。**Claude Mythos 5** 同日在 Project Glasswing 合作方中以不受限变体发布，取代 Mythos Preview，价格不到其一半。
>
> **6月10-26日更新：** 一波密集发布接续而至。**Google DeepMind DiffusionGemma**（6月10日，Apache 2.0）是 Google DeepMind 首个开源权重（open-weight）文本扩散模型：一个 26B MoE（约 4B 激活）的模型，在单张 H100 上并行去噪 token 块，生成速度约快 4 倍，牺牲了部分质量以换取速度，相对标准 Gemma 4 有一定取舍。**Gemini 3.5 Live Translate**（6月9日，基于 Gemini 3 Pro）通过 Gemini Live API 与 AI Studio 在公开预览中新增覆盖 70+ 语言的实时语音到语音翻译。**Cohere North Mini Code 1.0**（6月9日，Apache 2.0）是 Cohere 的首个开源编码模型，是一个 30B / 3B-active MoE，可在单张 H100 上运行。**Moonshot Kimi K2.7 Code**（6月12日，Modified MIT）基于 K2.6 调优，面向长时程软件任务（1T / 32B-active MoE，约少 30% 思考 token）。**Z.ai GLM-5.2**（6月13日获得 coding-plan 访问，6月16-17日以 MIT 方式开放权重）是约 753B / 40B-active MoE，拥有 1M 上下文，在 SWE-bench Pro 报告为 62.1，领先于 GPT-5.5 在该基准上的成绩，价格约为每 1M 输入/输出 1.40 / 4.40 美元。**xAI Grok Imagine Video 1.5** 于6月16日正式发布（图生视频并同步音频，0.080 美元/秒），**Grok 4.3** 于6月15日上架 Amazon Bedrock（1.25 / 2.50 美元每 1M，xAI 首个上架模型）。阿里官方 Qwen Cloud 更新日志显示，6月快照在 **Qwen 3.7-Max** 上新增视觉能力（其5月发布时为仅文本），但有部分独立报道将该视觉更新归于 Qwen 3.7-Plus，需使用前自行核验。另，Anthropic 于6月12日因美国出口管制指令暂停了 Claude Fable 5 与 Claude Mythos 5 的访问；Mythos 5 后续仅对有限美国机构放开。随后于6月26日，OpenAI 以有限方式向少量经美国政府批准的合作方预览 **GPT-5.6**（Sol、Terra、Luna），这是其下一代系列，出于双用途网络安全顾虑而限发；这与 Anthropic 的限制政策形成呼应。Sol 声称创造了新的 Terminal-Bench 2.1 记录，Terra 的目标为约 GPT-5.5 级效果但成本约减半。文中的编码成绩大多为厂商自报；请以独立榜单复核。
>
> **2026年5月回顾：** Anthropic Claude Opus 4.8（5月28日，价格与 Opus 4.7 相同，5/25 美元；Dynamic Workflows 研究预览提供数百个并发子代理；Fast 模式 10/50 美元约为 Opus 4.7 Fast 的 1/3）发布；OpenAI GPT-5.5（4月23日）和 GPT-5.5 Instant（5月5日，ChatGPT 默认版本）；Claude Opus 4.7（4月16日，支持 Bedrock/Vertex/Foundry）；Google Gemma 4（4月2日，Apache 2.0）与 Gemini 3.2 Flash（5月5日静默上线）；DeepSeek V4 Pro 与 V4 Flash（4月24日；V4 Pro 在 75% 折扣后于6月1日价格永久降为每 1M 0.435/0.87 美元）；Moonshot Kimi K2.6（4月20日，1T MoE / 32B active）；阿里 Qwen 3.6 Plus / 3.6-35B-A3B / 3.6 Max-Preview；Mistral Medium 3.5（4月29日，统一 chat/reasoning/coding/vision）；Meta Muse Spark（4月8日，首个闭源权重 Meta 模型）；Llama 4 Behemoth 计划暂停至2026秋季发布，因能力边界与安全性讨论。SWE-bench Verified 在 Fable 5 发布前榜首：Claude Mythos Preview 93.9%，GPT-5.5 88.7%，Claude Opus 4.8 88.6%；ARC-AGI-2 领先榜为 GPT-5.5，得分 85.0。Anthropic 将 Fable 5 描述为几乎所有测试基准上的最优；但发布公告未给出完整数值，需以公开榜单复核。

## 目录

- [模型分类](#模型分类)
- [前沿模型（2026年5月）](#前沿模型-2026年6月)
- [推理模型](#开源模型)
- [开源模型](#开源模型)
- [专用模型](#专项模型)
- [嵌入模型](#嵌入模型)
- [模型选型框架与语义路由](#模型选择框架)
- [主权 AI 与数据驻留](#主权-ai-与数据驻留)
- [能力对比](#能力对比)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 模型分类

### 按能力等级（2026年4月现状）

| Tier（层级） | Characteristics（特征） | Examples（示例） | Use Case（使用场景） |
|------|-----------------|----------|----------|
| **Frontier（前沿）** | State-of-the-art（最先进） reasoning（推理）、agentic mastery（代理化能力） | Claude Fable 5, Claude Opus 4.8, GPT-5.5, Gemini 3.1 Pro, Grok 4.3 | 复杂推理、编码、生产级智能代理 |
| **Fast/Efficient（快速/高效）** | 亚 200ms、成本优化 | Gemini 3.1 Flash, GPT-5.5-mini, Claude Haiku 4.5, DeepSeek V4 Flash | 大流量流式、UI、实时场景 |
| **Battle-Tested（经过验证）** | 成熟、广泛部署、稳定 | Claude Sonnet 4.6, GPT-5.5 Instant, Gemini 3.1 Pro | 企业生产工作负载 |
| **Small/Edge（小型/边缘）** | 私有化、边缘部署、专项 | Llama 4 Scout, Mistral Small 4, Phi-4 | 本地隐私、本地设备、MoE-efficient（高效混合专家） |
| **Reasoning-Heavy（重推理）** | 长链式 CoT（Chain of Thought，思维链） | Claude Opus 4.8（thinking）, GPT-5.5 reasoning, Gemini 3.1 Pro Deep Think, DeepSeek-R1 | 数学、代码调试、多步逻辑 |

### 按推理模式（2025–2026）

| Mode（模式） | Capability（能力） | Models（模型） | Use Case（使用场景） |
|------|------------|--------|----------|
| **Standard（标准）** | 快速、直观响应 | GPT-5.5-mini, Claude Sonnet 4.6 | 聊天、简单抽取 |
| **Extended Thinking（扩展思考）** | 输出前先进行内部草稿 CoT（链式思维） | Claude Opus 4.8, GPT-5.5 reasoning, DeepSeek-R1 | 数学、代码调试、规划 |
| **Hybrid（混合）** | 用户可控推理深度 | Claude Opus 4.8, GPT-5.5 | 复杂度可变任务 |

---

## 前沿模型（2026年6月）

### Claude Fable 5（Anthropic）- 2026年6月新增

| Attribute（属性） | Value（数值） |
|-----------|-------|
| Model ID（模型ID） | `claude-fable-5` |
| Context Window（上下文窗口） | 1M tokens（使用 Opus 4.7 分词器；在相同文本下大约多 30% token） |
| Max Output（最大输出） | 128K tokens |
| Input Cost（输入成本） | 10.00 美元 / 1M tokens |
| Output Cost（输出成本） | 50.00 美元 / 1M tokens |
| Thinking（思考机制） | Adaptive thinking（自适应思考），始终开启（无独立扩展思考开关） |
| Multimodal（多模态） | 文本 + 视觉（Anthropic 称其在视觉任务上达到最新最优） |
| Benchmarks（基准） | 按 Anthropic 表述，在几乎所有测试基准上达到最优；在 Cognition 的 FrontierCode 上得分最高，在 Hebbia Finance Benchmark、ViBench 与 CursorBench 上居首。标准数值分数（SWE-bench、GPQA）未在发布公告中公布。 |
| Released（发布日期） | 2026年6月9日（在 Claude API、Claude Platform on AWS、Amazon Bedrock、Vertex AI、Microsoft Foundry 上 GA） |

**它是什么：** 一款 Mythos 级模型，已安全化为通用可用。此前 Mythos 系列（Mythos Preview 的 SWE-bench Verified 为 93.9%）受双用途网络安全顾虑约束，仅对约 11 个 Project Glasswing 合作方开放。Fable 5 通过配套保守型安全策略，将该能力层级对更大范围用户开放。

**Opus 4.8 回退保护机制：** 当 Fable 5 的分类器检测到请求属于三类之一（攻击性网络技术、生物武器相关的生物与化学领域内容，或试图蒸馏模型的行为）时，系统会默默将该请求转交给**Claude Opus 4.8** 并告知用户。Anthropic 称该机制在不足 5% 会话中触发，并被刻意调得偏保守，因此部分无害请求也会被拦截。从架构上看，这是**模型分层路由作为安全控制**的生产实践，而不仅是成本控制。

**最佳适用：** 最高难度推理、长时程代理化工作、视觉负载重任务，以及能力上限比单位成本更关键的工作负载。Anthropic 称其可持续更久地进行自治运行，优于所有先前 Claude 模型。

**注意项：** 相比 Opus 4.8 的每 token 成本翻倍（10/50 vs 5/25）；因此仅将其用于受能力上限约束的任务。Mythos 级流量需要 30 天数据保留要求（不会用于训练；有访问日志；几乎全部场景下 30 天后删除），在合规审核中需关注。订阅计划中于6月9日至22日包含，不额外计费，之后改为按用量积分。发布时没有 Fable 级快模式，也未见公开缓存/批量折扣，需查询价格页。

### Claude Mythos 5（Anthropic）- 受限访问

| Attribute（属性） | Value（数值） |
|-----------|-------|
| Model ID（模型ID） | `claude-mythos-5` |
| Status（状态） | 限量可用：Project Glasswing 合作方与部分生物研究者 |
| Relationship（关系） | 与 Fable 5 同一底层模型，在部分场景下取消了防护限制 |
| Pricing（定价） | 10 / 50 美元每 1M（低于 Mythos Preview 的不到一半） |
| Released（发布日期） | 2026年6月9日 |

**为什么重要：** 在可比或略强能力下，以更低成本取代 Claude Mythos Preview。Fable/Mythos 分离形成了双轨发布模式：一条为带安全护栏的通用版，一条为通过审核的合作方不受限版本。

### Claude Opus 4.8（Anthropic）- 2026年5月

| Attribute（属性） | Value（数值） |
|-----------|-------|
| Context Window（上下文窗口） | 1M tokens（全窗口统一计费标准） |
| Input Cost（输入成本） | 5.00 美元 / 1M tokens（与4.7一致） |
| Output Cost（输出成本） | 25.00 美元 / 1M tokens（与4.7一致） |
| Cache: 5m write（5分钟写入缓存） | 6.25 美元 / 1M tokens |
| Cache: 1h write（1小时写入缓存） | 10.00 美元 / 1M tokens |
| Cache: hit / refresh（命中/刷新） | 0.50 美元 / 1M tokens |
| Batch API（批处理） | 2.50 / 12.50 美元每 1M（5折） |
| Fast mode（research preview）（快速模式，研究预览） | 10 / 50 美元每 1M（快约 2.5 倍；比 Opus 4.7 快速模式 30 / 150 美元便宜 3 倍） |
| Extended Thinking（扩展思考） | Native，adaptive（原生，自适应） |
| Multimodal（多模态） | 文本 + 高分辨率视觉 |
| SWE-bench Verified（SWE-bench Verified） | 88.6% |
| SWE-Bench Pro（SWE-Bench Pro） | 69.2%（较 Opus 4.7 的 64.3% 提升） |
| Terminal-Bench 2.1（终端基准） | 74.6%（GPT-5.5 仍以 78.2% 领先） |
| GDPval-AA（GDPval-AA） | 1890 Elo（较 Opus 4.7 的 1753 提升） |
| OSWorld-Verified（OSWorld-Verified） | 82.3% |
| Online-Mind2Web（在线 Mind2Web） | 84% |
| Released（发布日期） | 2026年5月28日（Claude API、AWS Bedrock、Vertex AI 全量上线） |

**最佳适用：** Claude Code 中的长期自治编码、代码库规模迁移、需要并发子代理的代理化工作流，以及对对齐性与诚实性收益有要求的任务。

**较 Opus 4.7 的关键新增：**
- **Dynamic Workflows（动态工作流，研究预览）：** Claude 会规划工作，在单个 Claude Code 会话中并行运行数百个子代理，验证其输出并回报。适用于数十万行级代码库迁移。
- **Mid-task system messages（任务中系统消息）：** Messages API 现支持会话中途注入 system message，可在不中断会话的情况下引导长任务。
- **可选 fast mode（可选快速模式）**：以约 2.5 倍速度运行，每 1M 10/50 美元，价格约为 Opus 4.7 快速模式的三分之一。
- **Effort-control toggle（推理强度开关）**在 `claude.ai` 与 Cowork 提供，用户可按回合调整思考深度。
- **Claude Code 速率限制扩展。**

**注意项：** 分词器与 Opus 4.7 相同（在同一固定文本下，相比 4.7 前分词器可多出最高 35% tokens）。GPT-5.5 仍以 SWE-Bench Verified 88.7%居首，并在 Terminal-Bench 2.1 中以 78.2%领先。GPQA Diamond 相对 Opus 4.7 下降 0.6 分。Anthropic 的分词器变更意味着同一文本在旧模型与当前模型的 token 数与计费不可直接对比。截至2026年5月29日，**仍无 Claude Sonnet 4.8 发布**；Sonnet 4.6 仍为生产主力。

### Claude Opus 4.7（Anthropic）

| Attribute（属性） | Value（数值） |
|-----------|-------|
| Context Window（上下文窗口） | 1M tokens |
| Max Output（最大输出） | 128K tokens |
| Input Cost（输入成本） | 5.00 美元 / 1M tokens（与4.6一致） |
| Output Cost（输出成本） | 25.00 美元 / 1M tokens（与4.6一致） |
| Extended Thinking（扩展思考） | Native，自适应模式 |
| Multimodal（多模态） | 文本 + 高分辨率视觉 |
| SWE-bench Verified (Adaptive)（SWE-bench Verified，适应式） | 87.6%（2026年5月13日） |
| Released（发布日期） | 2026年4月16日（API、Bedrock、Vertex、Microsoft Foundry 全量上线） |

**最佳适用：** 自治编码代理（驱动 Claude Code）、多文件重构、复杂推理。定价与4.6相同，大多数场景可直接升级使用。
**注意项：** 对成本敏感场景可优先 Sonnet 4.6；Opus 4.7 主要用于需要峰值编码/代理化质量的任务。

### Claude Mythos Preview（Anthropic）- 已被 Mythos 5 取代

| Attribute（属性） | Value（数值） |
|-----------|-------|
| Status（状态） | 限制性研究预览，仅限 Project Glasswing 合作方（约11家机构，如 AWS、Apple、Cisco、Google、Microsoft、NVIDIA、Palo Alto 等） |
| Restriction reason（限制原因） | 双用途网络安全能力 |
| SWE-bench Verified（SWE-bench Verified） | 93.9%（2026年5月13日；Fable 5 / Mythos 5 发布前发布的 SOTA） |
| Released（发布日期） | 2026年4月7日（受限合作预览）；于2026年6月9日被 Mythos 5 取代，且价格不足其一半 |

**最佳适用：** 历史参考。其能力层级已于2026年6月9日以 Claude Fable 5 的形式全面对外开放；新的 Glasswing 项目应优先使用 Mythos 5。

### Claude Opus 4.6（Anthropic）

| Attribute（属性） | Value（数值） |
|-----------|-------|
| Context Window（上下文窗口） | 1M tokens |
| Max Output（最大输出） | 128K tokens |
| Input Cost（输入成本） | 5.00 美元 / 1M tokens |
| Output Cost（输出成本） | 25.00 美元 / 1M tokens |
| Extended Thinking（扩展思考） | 原生自适应思考（可配置 budget_tokens） |
| Multimodal（多模态） | 文本 + 视觉 |
| Highlights（亮点） | Anthropic 近期最强模型；编码与推理表现突出 |
| Released（发布日期） | 2026年2月 |

**最佳适用：** 最复杂的推理、自治式软件工程、代理化工作流。
**注意项：** 成本较高；不需峰值能力时请使用 Sonnet 4.6。

### Claude Sonnet 4.6（Anthropic）

| Attribute（属性） | Value（数值） |
|-----------|-------|
| Context Window（上下文窗口） | 1M tokens |
| Input Cost（输入成本） | 3.00 美元 / 1M tokens |
| Output Cost（输出成本） | 15.00 美元 / 1M tokens |
| Extended Thinking（扩展思考） | 支持 |
| Multimodal（多模态） | 文本 + 视觉 |
| Highlights（亮点） | 可覆盖此前需 Opus 级别的任务，成本/质量平衡最佳 |
| Released（发布日期） | 2026年2月 |

**最佳适用：** 生产环境编码代理（驱动 Claude Code）、规模化复杂推理。
**注意项：** 现已覆盖大多数 Opus 级任务且成本更低。对绝大多数工作负载是稳妥默认选型。

### GPT-5.4（OpenAI）

| Attribute（属性） | Value（数值） |
|-----------|-------|
| Context Window（上下文窗口） | 272K tokens（标准）；可扩展 |
| Input Cost（输入成本） | 2.50 美元 / 1M tokens |
| Output Cost（输出成本） | 15.00 美元 / 1M tokens |
| Multimodal（多模态） | 文本、视觉、native computer use（原生计算机使用） |
| Highlights（亮点） | 内建计算机使用能力；较 GPT-5.2 减少 33% 事实性错误；融合编码与代理化优势 |
| Released（发布日期） | 2026年3月 |

**最佳适用：** 具备计算机使用的代理化工作流、编码、专业任务。
**注意项：** 长上下文区间计价在 272K+ 处翻倍。

### GPT-5.4-mini（OpenAI）

| Attribute（属性） | Value（数值） |
|-----------|-------|
| Context Window（上下文窗口） | 272K tokens |
| Input Cost（输入成本） | 0.75 美元 / 1M tokens |
| Output Cost（输出成本） | 4.50 美元 / 1M tokens |
| Highlights（亮点） | 高频 GPT-5 级工作负载下性价比最佳 |
| Released（发布日期） | 2026年3月 |

**最佳适用：** 高频 API 调用、成本优化推理、生产级聊天机器人。

### GPT-5.4 Pro（OpenAI）

| Attribute（属性） | Value（数值） |
|-----------|-------|
| Context Window（上下文窗口） | 272K tokens |
| Input Cost（输入成本） | 30.00 美元 / 1M tokens |
| Output Cost（输出成本） | 180.00 美元 / 1M tokens |
| Highlights（亮点） | 最高推理能力，面向最硬任务的高端层 |
| Released（发布日期） | 2026年3月 |

**最佳适用：** 竞赛级数学、复杂多步推理。
**注意项：** 成本极高；高吞吐场景应优先使用标准版 GPT-5.4 或 mini。

### GPT-5.6 Sol / Terra / Luna（OpenAI）- 2026年6月新增（有限预览）

| Attribute（属性） | Value（数值） |
|-----------|-------|
| Variants（变体） | Sol（旗舰）、Terra（平衡）、Luna（快、低成本） |
| Status（状态） | 通过 API 与 Codex 向少量经美国政府批准的合作伙伴限量预览；计划“coming weeks”内全面公开 |
| Pricing（定价） | 预览期未完全公开；Terra 宣称具备约 GPT-5.5 级质量、成本约减半 |
| Reasoning（推理） | 新增“max”推理 effort（强度）与“ultra”模式，后者使用子代理加速复杂工作 |
| Benchmarks（基准） | Sol 创造新的 Terminal-Bench 2.1 纪录，并在网络安全上为 OpenAI 最强模型；厂商称其在 ExploitBench 上与 Anthropic 的 Mythos Preview 相当，且输出 token 大约少三分之一（厂商自报） |
| Released（发布日期） | 2026年6月26日 |

**它是什么：** OpenAI 的下一代旗舰系列。与 Anthropic 几周前发布的 Fable 5 和 Mythos 5 一样，这次发布因美国政府双用途网络安全顾虑而受限，对应地形成了 2026年6月政府限制式前沿模型发布的显著趋势。OpenAI 表示其不认可将该审批流程作为长期默认机制。

**最佳适用：** 一旦全面可用，适用于前沿编码、网络安全研究、长时程代理化工作流。短期内应视为预览版，并以 GPT-5.5 作为可用生产层。

### GPT-5.5（OpenAI）- 2026年5月发布 NEW

| 属性 | 值 |
|-----------|-------|
| 上下文窗口（Context Window） | 1M tokens |
| 输入成本（Input Cost） | $5.00 / 1M tokens |
| 输出成本（Output Cost） | $30.00 / 1M tokens |
| 多模态（Multimodal） | 文本、图像、音频、视频 |
| ARC-AGI-2 | 85.0%（2026年5月13日 - 领先） |
| 发布于（Released） | 2026年4月23日 |

**最适合：** 最高质量的多模态工作负载；当前 ARC-AGI-2 领先者。被定位为“面向真实工作的全新智能类别（new class of intelligence for real work）”——取代 GPT-5.4，成为顶级推理 + 多模态首选。
**注意事项：** 输入成本约为 GPT-5.4 的 2 倍（$2.50 → $5.00），输出成本也约为 2 倍（$15 → $30）。对于价格不值得的聊天类工作负载，使用 GPT-5.5 Instant。

### GPT-5.5 Instant（OpenAI）- 2026年5月发布 NEW

| 属性 | 值 |
|-----------|-------|
| 状态（Status） | 自2026年5月5日起，ChatGPT 默认模型及 API 中的 `chat-latest` |
| 幻觉降低（Hallucination Reduction） | 在高风险提示（医学/法律/金融）上，相比 GPT-5.3 Instant 减少 52.5% |
| AIME 2025 | 81.2%（较 GPT-5.3 Instant 的 65.4% 提升） |
| 响应长度（Response Length） | 比前代少约 30% 的单词/行 |
| 发布于（Released） | 2026年5月5日 |

**最适合：** ChatGPT 等价默认工作负载、即时聊天、幻觉降低很重要的高风险领域。
**注意事项：** 取代 GPT-5.3 Instant 作为聊天默认模型。GPT-5.2-chat-latest 和 GPT-5.3-chat-latest 已于2026年5月8日弃用。

### GPT-Realtime-2、Translate、Whisper（OpenAI）- 2026年5月发布 NEW

| 属性 | 值 |
|-----------|-------|
| 能力（Capability） | 具备 GPT-5 级推理的实时语音 |
| 翻译覆盖范围（Translate Coverage） | 70+ 输入语言 → 13 种输出语言 |
| 定价（Pricing） | $32 / $64 每 1M 音频 tokens（输入/输出） |
| 发布于（Released） | 2026年5月7日 |

**最适合：** 实时语音代理、多语言翻译、语音优先产品。Realtime API Beta 已于2026年5月12日移除 - Realtime-2 是受支持路径。

### Gemini 3.1 Pro（Google）

| 属性 | 值 |
|-----------|-------|
| 上下文窗口（Context Window） | 1M tokens |
| 输入成本（Input Cost） | $2.00 / 1M tokens（标准）；$4.00（200K+） |
| 输出成本（Output Cost） | $12.00 / 1M tokens（标准）；$18.00（200K+） |
| 多模态（Multimodal） | 原生：文本、视觉、音频、视频 |
| 亮点（Highlights） | 业界领先的 Google 推理；强大的 agentic（代理式）和编码能力 |
| 发布于（Released） | 2026年2月 |

**最适合：** 复杂推理、多模态分析、长上下文工作负载。
**注意事项：** 取代 Gemini 3 Pro Preview。Gemini 2.5 Pro/Flash 已于2026年6月弃用。

### Gemini 3.1 Flash（Google）

| 属性 | 值 |
|-----------|-------|
| 上下文窗口（Context Window） | 1M tokens |
| 输入成本（Input Cost） | $0.10 / 1M tokens |
| 输出成本（Output Cost） | $3.00 / 1M tokens |
| 多模态（Multimodal） | 原生：文本、视觉、音频、视频 |
| 亮点（Highlights） | Google 最快模型；高吞吐场景下性价比最佳 |
| 发布于（Released） | 2026年3月 |

**最适合：** 实时多模态应用、高吞吐流水线、长上下文 RAG。

### Gemini 3.2 Flash（Google）- 2026年5月发布 NEW

| 属性 | 值 |
|-----------|-------|
| 状态（Status） | 已在 iOS Gemini 应用和 Google AI Studio 静默上线，时间为2026年5月5日（尚无正式公告） |
| 发布于（Released） | 2026年5月5日 |

**最适合：** 可能是 3.1 Flash 面向高吞吐工作负载的后继版本。请按预览版（preview）对待，定价与完整能力披露尚待官方正式发布。

### Gemini Deep Research / Deep Research Max（Google）- 2026年5月发布 NEW

| 属性 | 值 |
|-----------|-------|
| 基于（Built on） | Gemini 3.1 Pro |
| 能力（Capabilities） | MCP 支持；原生图表/信息图生成；扩展测试时计算；异步后台工作流 |
| 发布于（Released） | 2026年4月21日 |

**最适合：** 研究代理、文档综合、长时间异步工作流。MCP 支持使其成为 Google 首个具备一流工具集成的研究代理产品。

### Gemini Robotics-ER 1.6（Google DeepMind）- 2026年5月发布 NEW

| 属性 | 值 |
|-----------|-------|
| 领域（Domain） | 物理机器人、具身推理 |
| 新能力（New capability） | 读取仪表与瞄准镜 |
| 部署（Deployment） | Boston Dynamics Spot |
| 发布于（Released） | 2026年4月14日 |

**最适合：** 需要视觉-语言落地来驱动物理动作的机器人应用。可通过 Gemini API 和 AI Studio 使用。

### Grok 4（xAI）

| 属性 | 值 |
|-----------|-------|
| 上下文窗口（Context Window） | 256K tokens |
| 输入成本（Input Cost） | $3.00 / 1M tokens |
| 输出成本（Output Cost） | $15.00 / 1M tokens |
| 亮点（Highlights） | 原生工具使用与实时搜索；推理能力具竞争力 |
| 发布于（Released） | 2025年7月（Grok 4.20 beta：2026年2月） |

**最适合：** 实时网络研究、推理密集型任务、实时 X/网页集成。
**注意事项：** 高吞吐场景可用 Grok 4.1 Fast，价格为 $0.20 / $0.50。

### 模型对比：Frontier Tier（2026年6月）

| 模型 | 推理 | 编码 | 上下文 | 代理式 | 成本 |
|-------|-----------|--------|---------|---------|------|
| Claude Fable 5 | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ | $$$$$ |
| Claude Mythos 5（受限） | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ | $$$$$ |
| Claude Opus 4.8 | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ | $$$$ |
| Claude Opus 4.7 | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ | $$$$ |
| GPT-5.5 | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ | $$$$ |
| Claude Opus 4.6 | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ | $$$$ |
| GPT-5.4 | ★★★★★ | ★★★★★ | ★★★★ | ★★★★★ | $$$ |
| Claude Sonnet 4.6 | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ | $$$ |
| Gemini 3.1 Pro | ★★★★★ | ★★★★ | ★★★★★ | ★★★★ | $$ |
| Grok 4 | ★★★★ | ★★★★ | ★★★★ | ★★★★ | $$$ |
| GPT-5.4-mini | ★★★★ | ★★★★ | ★★★★ | ★★★ | $ |
| Gemini 3.1 Flash | ★★★ | ★★★ | ★★★★★ | ★★★ | $ |
| GPT-5.5 Instant | ★★★★ | ★★★★ | ★★★★ | ★★★★ | $$ |

### 生产历程与成熟度

尽管前沿模型在基准测试上领先，许多企业系统仍依赖**经过实战检验**的模型：

| 模型家族 | 自生产以来 | 成熟度说明 |
|--------------|------------------|---------------|
| **GPT-4o** | 2024年5月 | 生态最成熟；延迟波动最低；速率限制最高。 |
| **Claude 3.5 Sonnet / 3.7 Sonnet** | 2024年6月 | 工具调用可靠性和结构化输出的金标准。 |
| **Gemini 2.5 Pro** | 2025年3月 | 已在大规模场景验证；长上下文稳定。2026年6月起因 3.x 系列而被淘汰。 |
| **o1 / o3** | 2024年9月 | 推理模型已知失效模式较清楚；o3 已取代 o1。 |

**为什么仍然使用“旧”一代前沿模型？**
1. **一致性**：新模型在“发布窗口”内可能出现延迟尖峰和行为变化。
2. **成本效率**：新版本发布后，上一代通常会便宜 50% 到 80%。
3. **安全护栏调优**：安全和审核层更成熟。

---

## 开源模型

### Llama 4 家族（Meta）-- 2026年4月发布 NEW

| 模型 | 参数量 | 上下文 | 架构 | 说明 |
|-------|------------|---------|--------------|-------|
| Llama 4 Scout | 17B active / 16 experts (MoE) | 10M | 稀疏 MoE | 行业领先的 10M 上下文；可在单张 H100 上运行；胜过 Gemma 3、Gemini 2.0 Flash-Lite |
| Llama 4 Maverick | 17B active / 128 experts (MoE) | 1M | 稀疏 MoE | 胜过 GPT-4o 和 Gemini 2.0 Flash；在相近活跃参数下可比 DeepSeek V3 |
| Llama 4 Behemoth | ~288B active（估计） | - | Dense MoE | 仍在训练；在 STEM 基准上优于 GPT-4.5、Gemini 2.0 Pro |

**优势：**
- 首个采用 Mixture-of-Experts（MoE，混合专家）架构的 Llama 代际
- 从底层原生多模态（文本、图像、视频输入）
- Hugging Face 上开源权重；可通过 Meta AI 在 WhatsApp、Messenger、Instagram 使用
- Scout 的 10M token 上下文窗口在开源模型中处于行业领先

### Llama 3.x 家族（Meta）-- 前一代

| 模型 | 参数量 | 上下文 | 许可证 | 说明 |
|-------|------------|---------|---------|-------|
| Llama 3.3 70B | 70B | 128K | Llama 3.3 | 仍被广泛部署；通用能力强 |
| Llama 3.1 405B | 405B | 128K | Llama 3.1 | Meta 最大的稠密模型；正被 Llama 4 取代 |

**说明：** Llama 3.x 仍在生产环境中广泛使用，但得益于 MoE，Llama 4 Scout/Maverick 以更低活跃参数提供更高性能。

### DeepSeek 家族

| 模型 | 参数量 | 上下文 | 状态 | 说明 |
|-------|------------|---------|--------|-------|
| **DeepSeek V4 Pro** | 1.6T total / 49B active (MoE) | 1M | GA | 2026年4月24日发布。在 1M tokens 下，约使用 V3.2 的 27% 计算量 / 10% 内存。SWE-bench Verified 80.6%。NIST CAISI 评测（2026年5月）显示其距离美国前沿模型约差 8 个月（Elo 约 800）。Hugging Face 开源权重。**API：每 1M 输入/输出分别为 $0.435 / $0.87（75% 折扣于2026年5月22日永久生效，2026年6月1日起执行）。** 缓存命中输入价 $0.003625/M。 |
| **DeepSeek V4 Flash** | 284B total / 13B active (MoE) | 1M | GA | 面向高吞吐工作负载的较小活跃参数变体。**API：每 1M 为 $0.14 / $0.28（缓存命中 $0.0028/M）。** 截至2026年5月，这是最便宜的前沿级 1M 上下文 API。 |
| DeepSeek-V3.2 | 671B (MoE) | 128K | Frontier | 通用型；98% 缓存命中折扣（基础价每 1M 为 $0.28/$0.42）。新项目中大多被 V4 Flash 取代。 |
| DeepSeek-V3 | 671B (MoE, 37B active) | 128K | Frontier | 以远低于训练成本的代价达到 GPT-4o 水平；开源权重。 |
| DeepSeek-R1 | 671B (MoE) | 128K | Reasoning | 在数学/代码上接近 o1；首个开源推理模型。 |
| DeepSeek-R1-Distill | 7B–70B | - | Reasoning | 蒸馏到更小模型；高性价比推理。 |

**2026年5月背景：** DeepSeek V4 Pro（2026年4月24日发布，75% 促销折扣于2026年5月22日永久化）在多项基准上缩小了与美国前沿模型的差距，且成本远低。按每 1M $0.435 / $0.87 计算，V4 Pro 大约比 Claude Opus 4.7（$5 / $25）便宜 10 倍左右，且在同类任务上比 GPT-5.5（$5 / $30）便宜 5 到 10 倍。V4 Flash 将门槛进一步降至每 1M $0.14 / $0.28，并保持相同的 1M 上下文窗口。两者的 98% 缓存命中折扣使其成为高吞吐 RAG 和分类工作负载中首选，前提是提示词对缓存友好。DeepSeek R2（R1 的推理后继）据报仍因华为 Ascend 训练挑战而延迟。

### Moonshot Kimi 家族 - 2026年5月发布 NEW

| 模型 | 参数量 | 上下文 | 说明 |
|-------|------------|---------|-------|
| **Kimi K2.6** | 1T total / 32B active (MoE) | - | 2026年4月20日发布。Modified MIT 许可证。原生视频输入；Agent Swarm 可扩展到 300 个子代理和 4,000 个协同步骤。在 SWE-Bench Pro（58.6%）上与 GPT-5.5 持平；SWE-bench Verified 约 80.2%。 |
| **Kimi K2.7 Code** | 1T total / 32B active (MoE) | 256K | 2026年6月12日发布 NEW。基于 K2.6 的编码优化版本（Modified MIT），配备 MoonViT 视觉编码器。Moonshot 自家的 Kimi Code Bench v2 上较 K2.6 提升约 21.8%（厂商基准），思考 tokens 约少 30%。API 约为每 1M $0.95 / $4.00。 |
| Kimi K2-Thinking-0905 | - | - | 首个在 AIME 2025 上达到 100% 的模型（推理变体）。 |

**最适合：** 长周期 agentic（代理式）工作负载、视频理解、开源权重代理栈替代闭源前沿。

### Alibaba Qwen 3.x 家族 - 2026年5月发布 NEW

| 模型 | 参数量 | 许可证 | 说明 |
|-------|------------|---------|-------|
| **Qwen 3.6 Max-Preview** | ~1T MoE | 商业预览 | 约在2026年4月20日至27日发布。262K 上下文。按阿里巴巴称，在六项编码基准上领先。 |
| **Qwen 3.6-Plus** | - | - | 2026年4月2日发布。增强编码能力。 |
| **Qwen 3.6-35B-A3B** | 35B / 3B active MoE | Apache 2.0 | 2026年4月16日发布。开源权重主力模型。 |
| Qwen2.5-Coder-32B | 32B | Apache 2.0 | 前一代开源编码领先模型。 |
| Qwen2.5-72B | 72B | Apache 2.0 | 前一代多语言领先模型。 |
| Qwen2.5-7B | 7B | Apache 2.0 | 高效自托管方案。 |

### Mistral 家族

| 模型 | 参数量 | 上下文 | 说明 |
|-------|------------|---------|-------|
| **Mistral Medium 3.5** | 128B dense | 256K | 2026年5月发布。2026年4月29日发布。将 Magistral（推理）+ Pixtral（视觉）+ Devstral 2（编码）合并为一个模型。SWE-Bench Verified 77.6%。输入 token 价格为 $1.50/M。 |
| **Voxtral TTS** | 4B 开源权重 | streaming | 2026年5月发布（3月23日发布，CC BY-NC 4.0）。70ms 延迟，9 种语言，3 秒语音克隆。 |
| Mistral Large 3 | 675B (MoE, 41B active) | 256K | 稀疏 MoE；与最佳开源权重模型持平；在 LMArena 非推理类中排名第 2。 |
| Mistral Small 4 | - | 256K | 混合指令/推理/编码；2026年3月发布。 |
| Mistral 3（14B/8B/3B） | 3B–14B | - | 统一家族：多语言、多模态、Apache 2.0。 |
| Mixtral 8x22B | 141B (MoE) | - | 前一代；仍适用于吞吐场景。 |

### Google Gemma 家族 - 2026年5月发布 NEW

| 模型 | 参数量 | 上下文 | 许可证 | 说明 |
|-------|------------|---------|---------|-------|
| **Gemma 4（31B dense）** | 31B | 256K | Apache 2.0 | 2026年4月2日发布。支持 140+ 种语言；原生视觉/音频；函数调用。 |
| **Gemma 4（26B-A4B MoE）** | 26B / 4B active | 256K | Apache 2.0 | 稀疏 MoE 变体。 |
| **Gemma 4 E4B** | 8B | 256K | Apache 2.0 | 适合边缘设备。 |
| **Gemma 4 E2B** | 5.1B / 2.3B active | 256K | Apache 2.0 | 最小变体；面向移动端/嵌入式。 |
| **DiffusionGemma（26B-A4B MoE）** | 26B / ~4B active | 256K | Apache 2.0 | 2026年6月10日发布 NEW。Google DeepMind 的首个开源权重文本扩散模型；通过并行去噪 token 块实现约 4 倍更快生成（单张 H100 上 1000+ tokens/秒）。质量低于标准 Gemma 4；面向低延迟和内联编辑。 |

### 智谱 / Z.ai GLM 家族 - 2026年6月发布 NEW

| 模型 | 参数量 | 上下文 | 许可证 | 说明 |
|-------|------------|---------|---------|-------|
| **GLM-5.2** | ~753B total / ~40B active (MoE) | 1M | MIT | 2026年6月13日开放 coding-plan 接口；6月16日至17日开放权重。面向长周期代理式编码和工具使用。厂商报告称 SWE-Bench Pro 为 62.1（高于 GPT-5.5 在该基准上的 58.6），长周期编码得分接近闭源前沿；这些数据为厂商披露。API 约为每 1M $1.40 / $4.40；权重在 Hugging Face。 |

**最适合：** 需要 1M 上下文和宽松许可证的开源权重代理式编程与长周期工具使用。请在独立排行榜上验证基准声明。

### Meta Muse Spark（闭源权重）- 2026年5月战略转向

| 属性 | 值 |
|-----------|-------|
| 许可证（License） | **闭源权重（Closed weights）** - Meta Superintelligence Labs 首个专有模型 |
| 能力（Capabilities） | 具备 Instant / Thinking / Contemplating 模式的多模态推理 |
| 发布于（Released） | 2026年4月8日 |

**战略意义：** 这是自最初 Llama 时代以来 Meta 的首个非开源模型。它表明，前沿级能力可能需要闭源开发反馈闭环。Llama 4 Behemoth 的发布也因能力顾虑而同步暂停至2026年秋季。开源与闭源的平衡如今呈双层结构：闭源前沿领先 6 到 12 个月；开源权重则通过蒸馏、强化学习和生态迭代逐步追赶。

---

## 专项模型

### 编码卓越（2026年6月）

| 模型 | 专长 | 胜出原因 |
|-------|----------------|-------------|
| **Claude Fable 5** | 能力上限 | Mythos 级编码现已普遍可用；在 Cognition 的 FrontierCode 上获得最高前沿分数，并据 Anthropic 在 CursorBench 上达到 SOTA；价格为 Opus 4.8 的 2 倍 |
| **GPT-5.5** | 单次编码领先（已发布） | SWE-bench Verified 88.7%；Terminal-Bench 2.1 为 78.2% |
| **Claude Opus 4.8** | 长时程代理式编码 | SWE-bench Verified 88.6%；SWE-Bench Pro 69.2%；Claude Code 中具备带并行子代理的 Dynamic Workflows |
| **Claude Opus 4.7** | 前代旗舰编码 | SWE-bench Verified 87.6%；SWE-Bench Pro 64.3% |
| **Claude Sonnet 4.6** | 主力编码模型 | 以更低成本驱动 Claude Code；1M 上下文 |
| **Llama 4 Maverick** | 开源编码 | 开源权重；在编码基准上具竞争力 |
| **Qwen 3.6 Coder / Qwen2.5-Coder-32B** | 自托管编码 | 自托管 IDE 的最佳性价比之一 |
| **DeepSeek V4 Pro / R1-Distill-70B** | 开源推理 + 代码 | 70B 级最佳开源推理；V4 Pro 为 1.6T/49B-active MoE 开源权重 |
| **Z.ai GLM-5.2** | 开源代理式编码 | 2026年6月；~753B / 40B-active MoE，1M 上下文，MIT；厂商披露称 SWE-Bench Pro 为 62.1，高于 GPT-5.5；约每 1M $1.40 / $4.40 |
| **Kimi K2.7 Code** | 开源长时程编码 | 2026年6月；1T / 32B-active MoE，Modified MIT；基于 K2.6 针对软件工程调优，使用更少的思考 tokens |
| **Cohere North Mini Code 1.0** | 开源轻量级编码 | 2026年6月；可在单张 H100 上运行的 30B / 3B-active MoE，Apache 2.0；Cohere 首个开源编码模型 |

### 推理与数学（Reasoning & Math）

| 模型 | 方法 | 最适合 |
|-------|----------|----------|
| **Claude Fable 5** | 常驻自适应思维，处于 Mythos 能力层级 | 最难的推理问题，重视能力上限而非成本 |
| **Claude Opus 4.8 (thinking)** | 具备并行子代理的自适应思维 | 软件规划、代码库规模工作、代理式推理（agentic reasoning） |
| **GPT-5.5 reasoning** | 最大算力推理（maximum-compute reasoning） | 竞赛数学（AIME 2025 Instant 81.2%），ARC-AGI-2 85.0% 领先 |
| **Gemini 3.1 Pro Deep Think** | 持续链式思考（sustained chain-of-thought） | 科学推理（scientific reasoning）、GPQA Diamond 领先 |
| **DeepSeek-R1** | 基于强化学习的思考（RL-based thinking） | 开源逻辑推理（open-source logical inference）、竞赛数学 |
| **Grok 4.3 (DeepSearch)** | 基于网络事实的推理（web-grounded reasoning） | 需要实时信息的研究任务 |

### 长上下文（1M+）

| 模型 | 窗口 | 召回表现 |
|-------|--------|-------------------|
| **Llama 4 Scout** | 10M | 行业领先的开源权重上下文窗口（open-weight context window） |
| **Gemini 3.1 Pro / Flash** | 1M | 在 1M 上下文下质量最佳；已在大规模场景验证 |
| **Claude Fable 5** | 1M | Anthropic 报告称其在长会话中通过持久记忆提升了长上下文表现 |
| **Claude Opus 4.8 / 4.7 / Sonnet 4.6** | 1M | 标准价格下完整支持 1M；召回可靠 |
| **Llama 4 Maverick** | 1M | 采用 MoE（Mixture of Experts，专家混合）效率实现 1M 开源权重上下文 |

---

## 嵌入模型

### API 嵌入模型（2026 年 5 月）

| 模型 | 维度 | 最大 Token 数 | MTEB 分数 | 成本/1M |
|-------|------------|------------|------------|---------|
| OpenAI text-embedding-3-large | 3072 | 8191 | 64.6 | $0.13 |
| OpenAI text-embedding-3-small | 1536 | 8191 | 62.3 | $0.02 |
| Voyage-3 | 1024 | 32000 | 67.8 | $0.06 |
| Cohere embed-v3 | 1024 | 512 | 66.4 | $0.10 |
| Google text-embedding-004 | 768 | 2048 | 66.1 | $0.025 |

### 开源嵌入模型

| 模型 | 维度 | 最大 Token 数 | MTEB | 备注 |
|-------|------------|------------|------|-------|
| BGE-large-en-v1.5 | 1024 | 512 | 63.9 | 指令微调（instruction-tuned） |
| E5-mistral-7b-instruct | 4096 | 32768 | 66.6 | 指令适配能力强 |
| Nomic-embed-text-v1.5 | 768 | 8192 | 62.3 | 长上下文，开源 |
| GTE-Qwen2-7B | 3584 | 32K | 72.1 | 开源嵌入领域的最先进水平（state-of-the-art open embedding） |

### 嵌入选型指南

| 要求 | 推荐 | 原因 |
|-------------|-------------|-----|
| 最佳质量 | Voyage-3 或 text-embedding-3-large | MTEB 最高 |
| 成本效率 | text-embedding-3-small | $0.02/1M |
| 自托管 | GTE-Qwen2-7B | 开源 MTEB 最强 |
| 长文档 | Nomic 或 Voyage-3 | 8K+ 上下文 |
| 多语言 | Cohere embed-v3 | 面向多语言（multilingual）构建 |

---

## 模型选择框架

### 决策树

```
What is your primary constraint?

├── Cost → Use smaller model, consider open source
│   ├── Very cost sensitive → DeepSeek V4 Flash, GPT-5.5-mini, Claude Haiku 4.5, Gemini 3.1 Flash
│   └── Moderate budget → Claude Sonnet 4.6, GPT-5.5 Instant, DeepSeek V4 Pro
│
├── Quality + Reasoning → Use frontier models
│   ├── Highest reasoning → Claude Fable 5, Claude Opus 4.8 (thinking), GPT-5.5 reasoning, Gemini 3.1 Pro Deep Think
│   └── Coding + reasoning → Claude Opus 4.8 with Dynamic Workflows, Claude Sonnet 4.6 (Extended Thinking), GPT-5.5
│
├── Latency → Use fast models
│   ├── <100ms response → Gemini 3.1 Flash, GPT-5.5-mini
│   └── <500ms response → Claude Haiku 4.5, Claude Opus 4.8 fast mode, Grok 4.1 Fast
│
├── Self-hosting → Use open models
│   ├── Maximum capability → Llama 4 Maverick, DeepSeek-V3
│   ├── Good balance → Llama 4 Scout, Llama 3.3 70B, Qwen2.5-72B
│   └── Edge/mobile → Mistral 3 3B, Phi-4
│
└── Privacy → Self-host or use on-prem
    └── Choose open models with appropriate license
```

### 语义路由

静态决策树正在被 **语义路由器（Semantic Routers）** 取代：
- **工作原理**：一个小而快的嵌入模型会将查询向量化。如果它匹配“已知简单（known easy）”聚类，就路由到低成本模型（Gemini 3.1 Flash、DeepSeek V4 Flash、Claude Haiku 4.5）。如果命中“agentic/logic”聚类，就路由到 Claude Opus 4.8 或带 reasoning 的 GPT-5.5。
- **收益**：在没有硬编码规则的情况下自动完成成本优化。
- **实现**：使用 `semantic-router`（Python）或自定义 Weaviate/Pinecone 分类器。

---

## 主权 AI 与数据驻留

**2026 年监管现实：**
企业必须遵守 GDPR（欧盟）、DPDPA（印度）、沙特阿拉伯 PDPL，以及行业性规则。“主权 AI（Sovereign AI）”现已成为一个产品类别。

| 解决方案 | 提供方 | 用例 |
|----------|----------|----------|
| **Azure Government/Sovereign** | Microsoft | 40+ 区域的专属基础设施；已获美国政府/EU NIS2 批准 |
| **AWS Sovereign Cloud** | Amazon | 物理隔离的 VPC；符合 GDPR 的欧盟区域 |
| **Google Distributed Cloud** | Google | 空气隔离（air-gapped）的本地 Gemini 部署 |
| **Private Llama 4 / 3.3** | Meta（自托管） | 最大化数据主权；开源权重（Llama 4 MoE 或 3.3 dense） |
| **DeepSeek（自托管）** | DeepSeek（开源） | 开源权重；数据不离开你的基础设施 |
| **Mistral Large 3（自托管）** | Mistral（Apache 2.0） | 675B MoE；开源权重；多语言能力强 |

**权衡**：主权云通常比标准全球区域贵 **20%-30%**，但对金融和政府场景是强制要求。

### 规模化成本对比（2026 年 5 月）

假设每天 1M 请求，1K 输入 + 500 输出 token：

| 模型 | 每日输入成本 | 每日输出成本 | 每月总成本 |
|-------|----------------|-----------------|-------------|
| Claude Sonnet 4.6 | $3,000 | $7,500 | $315,000 |
| GPT-5.4 | $2,500 | $7,500 | $300,000 |
| Gemini 3.1 Pro | $2,000 | $6,000 | $240,000 |
| GPT-5.4-mini | $750 | $2,250 | $90,000 |
| Gemini 3.1 Flash | $100 | $1,500 | $48,000 |
| 自托管 Llama 4 Scout* | - | - | ~$15,000 |
| 自托管 Llama 3.3 70B* | - | - | ~$50,000 |

*自托管 Llama 4 Scout 可运行在单张 H100 上；Llama 3.3 70B 假设使用 4x H100 GPU

---

## 能力对比

### 基准表现（2026 年 5 月）

| 模型 | MMLU | HumanEval | SWE-bench Verified | 备注 |
|-------|------|-----------|--------------------|-------|
| **Claude Opus 4.6** | - | - | - | 推理与编码均属顶级；具体分数请查看最新数据 |
| **GPT-5.4** | - | - | - | 相比 GPT-5.2，事实性错误减少 33%；编码 + agentic 能力强 |
| **Claude Sonnet 4.6** | - | - | - | 在许多任务上接近 Opus 级别 |
| **Gemini 3.1 Pro** | - | - | - | Google 的最先进推理能力 |
| **Grok 4** | - | - | - | 竞争力推理；支持实时网络集成 |
| **Llama 4 Maverick** | - | - | - | 在公开报告基准上超过 GPT-4o、Gemini 2.0 Flash |
| **DeepSeek-R1** | 90.8 | 92.6 | 49.2% | 首个开源推理模型；数学/代码能力强 |

*来源：各技术报告以及 LMSYS Chatbot Arena / LMArena，2026 年 4 月。最新模型（Opus 4.6、GPT-5.4、Gemini 3.1）的基准分数变化很快——务必以当前排行榜核实。*

### 任务特定推荐（2026 年 5 月）

| 任务 | 推荐模型 | 原因 |
|------|--------------------|-----|
| **自主编程代理** | Claude Sonnet 4.6 / Opus 4.6 | 驱动 Claude Code；1M 上下文；工具可靠性顶级 |
| **复杂推理** | GPT-5.4 Pro、Claude Opus 4.6 (thinking)、DeepSeek-R1 | 最大推理能力 |
| **代理式计算机使用** | GPT-5.4 | 首个原生支持 computer-use 能力的通用模型 |
| **高并发 API** | Gemini 3.1 Flash、GPT-5.4-mini | 同类中每 token 成本最低 |
| **长上下文 RAG** | Gemini 3.1 Pro/Flash（1M）、Claude Sonnet 4.6（1M） | 已验证的远距离召回 |
| **超长上下文** | Llama 4 Scout（10M） | 行业领先的 10M 上下文；开源权重 |
| **多模态实时** | Gemini 3.1 Flash | 原生实时音频/视频/文本 |
| **私有化生产** | Llama 4 Maverick、Llama 3.3 70B、Qwen2.5-72B | 高能力且可本地控制 |
| **开源编程** | Llama 4 Maverick、Qwen2.5-Coder-32B | 开源权重，编码基准强 |
| **创作/聊天** | GPT-5.4 | 对话质量和指令遵循能力强 |

---

## 面试题

### 问：你会如何为生产级 RAG 系统选择模型？

**强答案：**
我会从以下维度评估：

**1. 质量要求：**
- 用真实业务领域的代表性查询做测试
- 衡量答案正确率、幻觉率（hallucination rate）、引用准确率（citation accuracy）

**2. 成本分析：**
```
Monthly cost = requests/day × 30 × avg_tokens × rate
```
始终对前 2-3 个候选模型做完整测算。

**3. 延迟要求：**
- 如果需要 <200ms TTFT：Gemini 3.1 Flash、Claude Haiku 4.5、GPT-5.4-mini
- 如果质量最重要：可接受 2-3 秒，使用 Claude Opus 4.6 或 GPT-5.4

**4. 运行要求：**
- 自托管：Llama 4 Scout/Maverick、DeepSeek-V3
- 合规 / 数据驻留：Azure Sovereign 或自托管

**5. 实际选型：**
- 原型阶段从 Claude Sonnet 4.6 或 GPT-5.4 开始
- 对 80% 的查询进行 Gemini 3.1 Flash 的 A/B 测试（成本）
- 通过语义路由保留 frontier 模型处理困难查询

### 问：解释专有模型与开源模型之间的权衡。

**强答案：**
| 因素 | 专有模型（OpenAI、Anthropic） | 开源模型（Llama、DeepSeek） |
|--------|--------------------------------|-----------------------------|
| 质量 | 通常更高（略高） | 正在快速追赶 |
| 成本 | 按 token 定价 | 计算 + 运维 |
| 控制权 | 有限 | 完全 |
| 隐私 | 数据会发送给提供方 | 保留在本地（on-prem） |
| 更新 | 自动 | 手动 |
| 可定制性 | 有限微调（fine-tuning） | 完整微调（full fine-tuning） |
| 运维开销 | 无 | 显著 |

**关键洞察（2026）**：DeepSeek-V3/R1 以及现在的 Llama 4 已改变这场讨论——开源模型在许多基准上已经匹配甚至超过 GPT-4o。随着 Llama 4 Maverick 在推理上追平 DeepSeek V3 且激活参数只有其一半，差距比以往更小。

### 问：GPT-5.4 Pro 和 Claude Opus 4.6 的 Extended Thinking 有什么区别？

**强答案：**
两者都使用内部 chain-of-thought，但机制不同：

- **GPT-5.4 Pro**：OpenAI 的最大算力推理等级（maximum-compute reasoning tier，$30/$180 per 1M tokens）。会为推理分配高算力。内部思路不对外暴露。是 o3 线的继任者。
- **Claude Opus 4.6 Adaptive Thinking**：会在独立的 `<thinking>` 区块返回思考 token。可配置 `budget_tokens`。便于调试时查看推理链。完整 1M 上下文，最大输出 128K。

**生产选择**：如果重视调试和建立信任，Claude 的可见思考更透明。如果追求数学和竞赛任务上的最强原始推理能力，GPT-5.4 Pro 更占优。如果追求性价比推理，Claude Sonnet 4.6 或 GPT-5.4-mini 都是强选择。

---

## 参考资料

- Anthropic: https://platform.claude.com/docs/en/about-claude/models/overview
- OpenAI Platform: https://developers.openai.com/api/docs/models
- Google AI: https://ai.google.dev/gemini-api/docs/models
- Meta Llama: https://www.llama.com/
- DeepSeek: https://api-docs.deepseek.com/
- xAI Grok: https://docs.x.ai/developers/models
- Mistral AI: https://docs.mistral.ai/models/
- LMArena Leaderboard: https://lmarena.ai/
- Hugging Face Open LLM Leaderboard: https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard

---

*下一篇：*[能力评估](02-capability-assessment.md)
