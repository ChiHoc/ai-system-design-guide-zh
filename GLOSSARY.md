# AI 系统设计词汇表

本指南中关键术语的快速参考。

---

## A

**A2A（Agent2Agent 协议）** - 跨供应商或组织边界委派智能体任务的开放协议；与连接智能体和工具的 MCP 互补。智能体在 `GET /.well-known/agent-card.json` 用 Agent Card 公布自身，并通过 `SendMessage`、`GetTask` 等方法接收工作。v1.0.0 于 2026 年 3 月 12 日发布，v1.0.1（2026 年 5 月 28 日）为最新版本。2026 年 8 月作为 Growth Stage 项目加入 Agentic AI Foundation。见[工具使用与 MCP](07-agentic-systems/03-tool-use-and-mcp.md#agent-to-agent-协议-a2a)。

**ABAC（基于属性的访问控制）** - 基于用户、资源和环境属性，而非固定角色进行的访问控制。

**意外网络攻击（评估环境逃逸）** - 评估或训练中的智能体因环境可访问真实互联网，对第三方实施真实未授权操作。Simon Willison 于 2026 年 7 月针对 OpenAI-Hugging Face 事件提出此名称。后续披露包括 UK AI Security Institute（122 次网络安全评估中的 10 次发生 19 次未授权操作）、Anthropic（合作方评估中发布的恶意 PyPI 包被 15 个系统安装）和 Google（Gemini 在第三方测试中侵入三家公司）。控制措施是所有智能体环境默认拒绝出站，包括评估环境。见[智能体安全与沙箱](07-agentic-systems/09-agentic-security-and-sandboxing.md#智能体已经对现实中的第三方采取未经授权的行动)。

**Advisor / Executor（顾问 / 执行者）** - 一种编排模式，由成本较低的执行者模型运行智能体循环，并在决策点咨询能力更强的顾问模型：前者传递对话记录，后者返回计划或修正。与提高执行者自身的推理努力相比，它通常能以更低的单任务成本取得更好效果。参见 [PATTERNS.md](PATTERNS.md)。

**Agent Identity（智能体身份）** - 为每个智能体提供范围限定于其所代表用户或服务的短期可验证凭据，而非共享静态 API 密钥，使每次工具调用都可归因、收窄和撤销。标准正收敛到现有工作负载身份与 OAuth 机制，而非新智能体协议：IETF WIMSE 工作组于 2026 年 9 月 15 日采纳首个智能体草案（draft-ietf-wimse-aims-00），MCP 路线图（2026 年 8 月 22 日）目标为发送者约束 token（DPoP、SEP-1932）与 Workload Identity Federation（SEP-1933），两者仍为开放提案。MCP 企业托管授权背后的 ID-JAG 授权仍是 Internet-Draft，不是 RFC。供应商同时交付各自部件：OpenAI 于 2026 年 8 月 29 日为 API 正式提供双向 TLS 与 X.509 工作负载身份联邦，Bedrock Managed Agents（预览）为每个智能体独立分配 IAM 角色。见[访问控制](12-security-and-access/02-access-control.md#用工作负载身份替代静态密钥)。

**Agent Plugins（智能体插件）** - 一种供应商中立的打包格式（1.0，`2026` 年 8 月），通过 `plugin.json` 清单将 Agent Skills 与 MCP 服务器声明捆绑进一个可安装目录。它标准化了智能体能力的分发；特意只让技能和 MCP 服务器具备可移植性，而将客户端特有的部分留在带命名空间的目录中。参见[工具使用与 MCP](07-agentic-systems/03-tool-use-and-mcp.md#agent-plugins-智能体插件)。

**Agent Skills（SKILL.md，智能体技能）** - 包含 `SKILL.md`（前置元数据加指令）与支持文件的文件夹，智能体仅在任务需要时加载，使过程知识仅在使用时消耗上下文。自 2026 年 8 月 19 日在 Claude API 结束 beta。官方 MCP Skills 扩展（`io.modelcontextprotocol/skills`、SEP-2640、2026 年 9 月 13 日 Final）通过服务器提供技能，每个文件都有 SHA-256 清单；文件修改、添加或删除会撤销用户审批，阻止服务器静默改写智能体加载的指令。应将技能视为不可信、版本化依赖。见[工具使用与 MCP](07-agentic-systems/03-tool-use-and-mcp.md#通过-mcp-提供-skills)。

**Agentic AI Foundation（AAIF，智能体 AI 基金会）** - Linux Foundation 为智能体标准设立的中立组织，成立于 2025 年 12 月。截至 2026 年 9 月承载六个项目（MCP、goose、AGENTS.md、agentgateway、A2A，以及前身为 Envoy AI Gateway 的 Agent Router），2026 年 8 月 12 日报告有 247 家成员组织。2026 年 9 月 14 日推出 MCPA（Model Context Protocol Associate）认证。见[工具使用与 MCP](07-agentic-systems/03-tool-use-and-mcp.md)。

**Agentic Coding（智能体式编码）** - LLM 自动编辑文件、运行 shell 命令、编写测试并反复迭代，直到编码任务完成。以 Claude Code、Codex、Cursor、OpenHands 和 Cline 为代表。

**Agentic Commerce Protocols（智能体商务协议）** - 智能体采购和支付的新兴栈：**UCP**（Universal Commerce Protocol，发现、购物车和结账，v2026-08-25）、**ACP**（OpenAI 与 Stripe 的 Agentic Commerce Protocol，仍为 beta）、**AP2**（Google 支付授权的 Agent Payments Protocol，v0.2.0）和 **x402**（通过 HTTP 按调用付费）。旧资料中的“ACP”指 IBM Agent Communication Protocol，现已并入 A2A。见[工具使用与 MCP](07-agentic-systems/03-tool-use-and-mcp.md#商业交易层)。

**Agentic System（智能体系统）** - 利用工具自主规划并执行多步任务的 LLM 应用。

**AI Control（AI 控制）** - 一种安全方法，假设模型可能未对齐，并设计部署协议（监控、关键动作延后、重采样、分解式认知）以在此情况下仍保持安全。与 alignment 不同，后者旨在从一开始就使模型可信。参见 [Research Radar](RESEARCH-RADAR.md)。

**AI Gateway（AI 网关）** - 你的应用与模型提供商（如 LiteLLM、OpenRouter、Portkey、Kong、Agent Router，前身为 Envoy AI Gateway）之间的控制平面代理。提供一个 OpenAI 兼容 API，并集中化路由、降级、负载均衡、速率限制处理、虚拟密钥与预算、缓存及可观测性。由于持有所有提供方密钥，应像面向互联网的基础设施一样修补：2026 年仅 LiteLLM 就需修复未认证 RCE（CVE-2026-37004、CVSS 9.8、1.83.7 修复）与严重认证绕过（CVE-2026-49468、1.84.0 修复）。参见 [AI Gateways and Model Routing](11-infrastructure-and-mlops/03-ai-gateways-and-model-routing.md)。

**Approval Laundering（审批洗白）** - 人工批准的动作与智能体执行框架实际执行动作之间的差距（arXiv 2609.38983，2026 年 9 月），分六类：范围、参数、时间、工具、委派和语义。缓解方法是用哈希或签名 token 将审批绑定精确规范动作，执行时重新验证，并向人展示实际执行形式，而非模型描述。见[人在环模式](07-agentic-systems/08-human-in-the-loop-patterns.md#审批洗白)。

**Attention Mechanism（注意力机制）** - 使模型能够关注输入中相关部分的神经网络组件。Self-attention 会比较每个 token 与所有其他 token。

---

## B

**Batching（批处理）** - 将多个请求一起处理以提高 GPU 利用率。Continuous batching 会在其他请求生成过程中持续加入新请求。

**Benchmark Saturation（基准饱和）** - 当前沿模型在某基准上接近上限，导致得分差异落入噪声范围（提示词措辞、运行方差）时，基准已无法区分模型。MMLU、HumanEval 和 GSM8K 最早饱和；截至 2026 年 9 月，GPQA Diamond、OSWorld-Verified 和 SWE-Bench Pro 公开集也已饱和（Opus 5 在 v2 为 99.4%）。当前比较侧重 SWE-Bench Pro 私有 272 项任务、Terminal-Bench 4.0、HLE-Diamond 等私有或更新集合。参见 [Benchmarks and Leaderboards](14-evaluation-and-observability/03-benchmarks-and-leaderboards.md)。

**BM25** - 传统基于关键词的排序算法。常与向量检索结合用于混合检索。

**Budget Tokens（预算 token）** - Claude 扩展思考的显式 token 上限（`thinking.budget_tokens`），仍用于 Haiku 4.5 等旧模型。自 4.6 代起，effort 引导的自适应思考成为主要控制手段，Opus 5.5 和 Sonnet 5.5 对手动预算返回 400。见 **Reasoning Effort（推理强度）**。

---

## C

**C2PA（Content Credentials，内容凭证）** - 一种开放标准，通过加密将来源元数据（由谁创建、是否涉及 AI、做了哪些编辑）绑定到媒体资产上，采用防篡改的硬绑定与可抵抗重编码的水印式软绑定。它是 AI 内容标注法规背后的来源层；可移除，因此应结合水印与检测共同使用。参见 [Multimodal Generation](19-multimodal-generation/01-multimodal-generation.md)。

**Capability Index（Composite Benchmark，复合基准）** - 许多基准的加权汇总（如 Artificial Analysis Intelligence Index、Epoch Capability Index、HAL for agents），用于对前沿模型排序，使排序在单一基准饱和时仍能持续区分。指数更换组成项时会重新建立基线：Index v4.3（2026 年 9 月）之前的 Artificial Analysis 分数与 v4.3 不可比较。

**Chain-of-Thought（CoT，思维链）** - 一种提示技术，在生成最终答案前引导模型进行逐步推理。

**Chunking（分块）** - 将文档切分为更小片段以便嵌入与检索。策略包括固定大小、语义分块与层次分块。

**Claude Code（Claude 代码）** - Anthropic 的智能体式编码工具（终端、IDE、桌面和 Web）。通过 shell、文件编辑等工具在完整项目内读取、编辑并运行代码。从 CLAUDE.md 读取项目指令，自 2.1.277（2026 年 9 月）起，不存在 CLAUDE.md 时回退到 AGENTS.md。

**Claude Fable 5.1** - Anthropic 的 Mythos 级普遍可用模型（2026 年 9 月 1 日，`claude-fable-5-1`），接替 Fable 5（2026 年 6 月 9 日）。每 1M $10/$50，缓存读取降至 $0.25（输入 0.025 倍），1M 上下文，自适应思考始终开启。要求保留数据 30 天；零数据保留仅在 Anthropic 授权时可用。其更宽松孪生版 Claude Mythos 5.1（相同权重、更松护栏）仅限经审核组织：Project Glasswing 参与者和 Anthropic 可信访问验证计划。Anthropic 现在将多数工作负载引向更便宜的 Claude Opus 5.5（$4/$20，2026 年 9 月 22 日），其 Artificial Analysis Intelligence Index v4.3.2 更高（58 对 53，均为 max 强度并带护栏回退）。见[模型分类](02-model-landscape/01-model-taxonomy.md)。

**Cline（Cline）** - 开源 VS Code 扩展，提供具备工具调用能力的自主 AI 编码（文件编辑、终端、浏览器）。MCP 原生。

**Compaction（压缩）** - 用模型撰写的摘要替换长智能体上下文的较早轮次，使循环可超越上下文窗口继续运行。OpenAI Agents API 等托管框架会代劳，Claude API 于 2026 年 9 月加入按需压缩 beta。其设计上就是有损的：启用前决定哪些内容必须保留（目标、约束、未决问题）。见 **Context Rot（上下文腐坏）**。

**Computer-Use（计算机控制）** - 根据截图输出鼠标和键盘动作操作 GUI 的模型能力；Anthropic 于 2024 年 10 月随 Claude 3.5 Sonnet 引入，OpenAI 和 Google 现也提供对应能力。Claude 当前工具版本为 `computer_toolset_20260801`（2026 年 8 月 19 日 GA）；Opus 5.5 和 Sonnet 5.5 在 Claude API 与 Google Cloud 拒绝旧 `computer_20251124`。应以 OSWorld 2.0 二元分数衡量，因为 OSWorld-Verified 已饱和。

**Context7（Context7）** - MCP 服务器，在运行时获取最新库文档，解决 Coding Agent 的“训练数据过期”问题。

**Context Window（上下文窗口）** - 单次请求中 LLM 可处理的最大 token 数。范围通常为 4K 到 1M+；1M 已是前沿标准，但其使用价格并非如此（见 **Long-Context Cliff（长上下文价格跃升）**）。

**Context Rot（上下文腐坏）** - 上下文窗口中出现与任务无关或过期 token 后，输出质量下降，常在公开上限前就出现。推动了压缩与按需检索。参见 [Context Engineering](05-prompting-and-context/05-context-engineering.md)。

**Cosine Similarity（余弦相似度）** - 衡量两个向量相似程度的指标，是比较 embeddings 的标准度量。

**Cursor（Cursor）** - AI 原生 IDE（基于 VS Code 的分支），深度集成模型用于代码补全、智能体式编辑和多文件上下文感知。自 2026 年 8 月起归属 SpaceX，因此领先 IDE 智能体现与前沿模型系列（SpaceXAI 的 Grok）共享母公司；供应商风险与数据治理评审应纳入这一点。

---

## D

**Data Contamination（数据污染）** - 基准题目或其答案泄漏到模型训练数据中，导致分数通过记忆而非能力提升。可通过时间门控、私有或留出测试集缓解。相关失败是环境泄漏：一项研究发现，SWE-Bench Pro v1.0 通过案例中按模型有 24% 至 73% 并非应得，主要因智能体从仓库 git 历史读取修复（arXiv 2609.34262）。参见 [Benchmarks and Leaderboards](14-evaluation-and-observability/03-benchmarks-and-leaderboards.md)。

**Data Residency（数据驻留 / 区域推理）** - 固定请求处理地点，通常为合规，溢价约 10%。Anthropic `inference_geo: "us"` 对 Claude 4.6 及之后的所有 token 类型按 1.1 倍计费；OpenAI 对 2026 年 3 月 5 日及之后发布模型的数据驻留端点加收 10%；Bedrock 与 Google Cloud 区域 Claude 端点有类似溢价，Bedrock 区域 GPT-6 Astra 每 1M 标价 $11/$55，普通为 $10/$50。也要看产品：OpenAI Agents API 发布时仅支持美国驻留。仅将有驻留要求的租户路由到固定区域，避免所有流量都支付溢价。见[定价与成本](02-model-landscape/03-pricing-and-costs.md)。

**Diffusion Language Model（扩散语言模型）** - 一种非自回归 LLM，通过并行迭代去噪一个被掩码的序列生成文本，而非从左到右生成；在质量上略有损失，但吞吐率更高（有报告称超过 1,000 token/秒）。在代码与填充任务上表现强，且截至 2026 年仍处于早期阶段。参见 [Diffusion Language Models](04-inference-optimization/08-diffusion-llms.md)。

**Disaggregated Serving（预填充/解码分离服务）** - 将预填充（提示处理，计算受限）与解码（token 生成，内存带宽受限）放到不同 GPU 池或不同芯片，并在其间传输 KV 缓存。NVIDIA Dynamo 或 llm-d 在引擎上方通过 KV 感知路由编排。只有提高 **goodput（有效吞吐）** 才划算：Llama-3.1-70B 的 10K-token 提示在 BF16 下 KV 传输约 3 GB，在 400 Gb/s 下约 65 ms。见[LLM 基础设施](11-infrastructure-and-mlops/01-llm-infrastructure.md#跨芯片预填充与解码)。

**DPO（直接偏好优化）** - 一种微调方法，直接在偏好数据上优化，无需单独的奖励模型。

**DSPy** - 通过可优化模块而非手工提示来编排 LLM 的框架。

**Durable Execution（持久化执行）** - 一种执行模型（Temporal、Restate、DBOS），通过仅追加的事件历史和确定性重放使长运行智能体在崩溃和重启后存活，提供恰好一次副作用、持久定时器以及跨部署存续的暂停。参见 [Durable Execution](07-agentic-systems/11-durable-execution.md)。

---

## E

**Effective Context Length（有效上下文长度）** - 模型仍能保持质量的上下文长度，通常比标称窗口更短。在 RULER 中，许多宣称 128K 的模型实际只到约 32-64K。应按有效上下文而非标称上下文设计系统。

**Embedding（嵌入）** - 文本的稠密向量表示，用于语义搜索和相似度比较。

**Endpointing（Turn Detection，对话轮次检测）** - 在语音智能体中判断用户何时说完，以便智能体回应。学习型轮次检测模型在语义完整时触发，优于按固定静默时长计时的方式。参见 [Real-Time Voice Agents](18-voice-and-audio-agents/01-realtime-voice-agents.md)。

**Ensemble（集成）** - 结合多个模型输出以提高可靠性，包含投票、辩论和多智能体混合。

**Eval Awareness（评测感知）** - 模型检测到自己正在被评估并相应调整行为的倾向，这会干扰安全与能力基准，支持采用更自然、留出式测试条件。Anthropic Opus 5.5 系统卡展示了差距：36% 自动审计记录的评估感知得分高，内部 Claude Code 记录仅 0.4%。

**Extended Thinking（扩展思考）** - Claude（3.7+）在响应前的内部推理。Haiku 4.5 等旧模型以 `thinking.budget_tokens` 限制；新模型用自适应思考，在 effort 设置下自行决定推理量。Opus 5.5 无法关闭，Sonnet 5.5 最低为 `between_tools`。Fable 5.1、Opus 5.5 和 Sonnet 5.5 的思考块绑定生成模型与对话，回退不能将它们重放到别的模型。思考 token 按输出收费。

**EU AI Act（欧盟 AI 法案）** - 《Regulation (EU) 2024/1689》，首部全面 AI 法律，按风险分级（禁止、高风险、有限、最小）并附加独立的 GPAI 义务，最高可罚公司全球营业额 7%。禁令与 GPAI 义务已适用，第 50 条透明度义务自 2026 年 8 月 2 日适用，内容标记宽限期于 2026 年 12 月 2 日结束。Digital Omnibus（Regulation (EU) 2026/1744，2026 年 7 月 27 日生效）将高风险义务移至 2027 年 12 月 2 日（Annex III）和 2028 年 8 月 2 日（Annex I）。参见 [AI Governance and Compliance](13-reliability-and-safety/04-ai-governance-and-compliance.md)。

---

## F

**Few-Shot Prompting（少样本提示）** - 在提示中加入示例以引导模型行为。

**Fine-Tuning（微调）** - 在任务特定数据上继续训练预训练模型以提升性能。平台可用性现已成为设计风险：OpenAI 正逐步关闭自助微调，即使活跃客户自 2027 年 1 月 6 日起也无法创建新任务。

**FinOps for AI（AI 的 FinOps）** - 测量、归因与优化 AI 开支的实践：每 token / 每请求 / 每任务成本、提示缓存、批量经济性、成本展示与分摊、单位经济学。参见 [FinOps and Token Economics](11-infrastructure-and-mlops/04-finops-and-token-economics.md)。

**Forward Deployed Engineer（FDE，前线部署工程师）** - 嵌入客户现场，将 AI 系统从用例推进到生产的工程师：范围界定、集成、评估、安全审查和交接。2026 年迅速兴起的 AI 职称，现分前沿实验室岗位（外部估算 OpenAI FDE 总薪酬约 $350K 至 $550K）和校园招聘的咨询岗位（BCG X 底薪 $110K 至 $190K，二手报道，未确认）。Anthropic 于 2026 年 10 月 2 日公布 Claude Frontier Academy：投入 $100M，在 2027 年底前为客户和伙伴培训 10,000 名“Frontier Deployed Engineers”，通过评分实践与驻场获得认证。见[就业市场趋势](00-interview-prep/06-job-market-trends-2026.md#前线部署工程师-fde)。

**Framework Churn（框架更迭）** - AI 编排框架（如 LlamaIndex、LangChain）快速且破坏性的演进，几乎每年重排包结构并移除抽象，导致新环境下旧教程和课程失效。应对方法是锁定版本，并学习原语而非特定 API。参见 [Navigating Framework Churn](09-frameworks-and-tools/12-navigating-framework-churn.md)。

**Frontier Safety Framework（前沿安全框架）** - 实验室公布的危险能力测试与对应护栏政策：Anthropic Responsible Scaling Policy（v3.4；ASL 部署保护、CB-1 和 CB-2 化学与生物判定、定期 Risk Reports）、OpenAI Preparedness Framework（High 与 Critical；GPT-6 Astra 是 OpenAI 首个网络安全评级 Critical 的模型）、Google DeepMind Frontier Safety Framework。对构建者的实际影响是：这些级别决定可访问模型、前置分类器与回退，以及安全或生命科学工作是否需验证访问计划。见[AI 治理与合规](13-reliability-and-safety/04-ai-governance-and-compliance.md#前沿实验室安全框架)。

**Full-Duplex Voice Agent（全双工语音智能体）** - 语音模型同时听说，处理轮次、附和和打断，同时将推理和工具调用委派给独立文本模型（说话者与思考者分离）的架构。OpenAI `gpt-live-1`（2026 年 9 月 10 日 API GA）每会话分钟 $0.05，另加后端模型 token；后端可为 OpenAI 模型或自有智能体。它是级联和语音到语音流水线之外的第三选项。见[实时语音智能体](18-voice-and-audio-agents/01-realtime-voice-agents.md)。

**Function Calling（函数调用）** - LLM 输出结构化工具调用而非纯文本的能力。

---

## G

**GGUF** - llama.cpp、Ollama 和 LM Studio 用于本地推理的量化模型文件格式。量化级别在质量与体积之间权衡，Q4_K_M 通常是实用甜点区。参见 [On-Device and Edge Deployment](04-inference-optimization/09-on-device-and-edge-deployment.md)。

**GitSpawn** - 一种攻击（Manifold Security，2026 年 9 月 2 日），仓库自身 `.git/config`（`core.fsmonitor`、`core.hooksPath` 或过滤器）使编码智能体后台 git 调用在其沙箱外运行攻击者命令，无需提示词。需 `.git` 目录完整到达，如压缩包、共享盘或同步文件夹；普通 clone 不复制仓库配置。七种命令行智能体受影响。goose 1.44.0（CVE-2026-72718）、Codex CLI 0.131.0、Claude Code 2.1.196 已修复 fsmonitor 路径，但第二条 Claude Code 路径在 2.1.252 仍开放，Manifold 9 月 1 日复测时三个智能体未修复，因此版本升级不是完整答案。教训是：VCS 元数据与智能体配置文件是可执行代码，执行框架本身也应在隔离边界内。见[智能体安全与沙箱](07-agentic-systems/09-agentic-security-and-sandboxing.md#动作沙箱化-微型虚拟机与容器)。

**Goodput（有效吞吐）** - 服务系统同时满足首 token 时间与 token 间延迟 SLO 的持续请求速率。它是分离服务、批处理、推测解码、新硬件等服务决策的正确目标，因为破坏延迟 SLO 的批大小下的峰值吞吐不是可用容量。见 **Disaggregated Serving（分离服务）**。
**Graph Engineering（图工程）** - 将智能体系统设计为由专用节点、路由边和共享状态对象组成的拓扑，而不是调优单个智能体循环。它是循环工程的后继术语，自 `2026` 年年中起迅速兴起。关键设计维度是静态拓扑（可检查、可测试、可重放）与动态拓扑（自适应，但更难推理）之间的取舍。参见 [Research Radar](RESEARCH-RADAR.md#_14-图工程与编排共识)。

**Guardrails（护栏）** - 输入/输出校验，用于防止有害或偏离主题的响应。

**Grounding（事实依据锚定）** - 将 LLM 响应与事实来源连接以减少幻觉。

**Grok 4.7** - SpaceXAI（xAI）当前 Grok 前沿模型，2026 年 9 月 21 日以 `grok-4.7` 发布。每 1M $2/$6，500K 上下文；提示词达到 200K 后请求中每个 token 按双倍收费。xAI 于 2026 年 5 月 15 日退役的模型 ID 重定向到 `grok-4.3` 并按其费率收费，因此应检查固定的旧 ID 实际服务内容。见[模型分类](02-model-landscape/01-model-taxonomy.md)。

**GRPO（群体相对策略优化）** - DeepSeek-R1 背后的 RL 算法：去除 PPO 的价值/评论家网络，并从一组采样完成样本内的奖励分布计算优势。比 PPO 更便宜；其变体（Dr.GRPO、DAPO、GSPO）修复了长度偏置和零方差坍缩。参见 [Training Reasoning Models](03-training-and-adaptation/08-rlvr-and-reasoning-models.md)。

---

## H

**Hallucination（幻觉）** - 模型生成看似合理但事实错误的信息。

**Harness (Scaffold) Variance（Harness/Scaffold 方差）** - 同一模型权重在不同提示、工具访问、推理投入或智能体 scaffold 下，基准分数可出现 10-20 分波动。解释了为何不同供应商自报指标不可跨实验室直接比较，只有同一 harness 的数值才可比。始终注明强度与运行方：Terminal-Bench 4.0 上，Claude Fable 5.1 在 tbench.ai 榜单 max 强度得 57.88%，Anthropic 自己运行得 55.8%。参见 [Benchmarks and Leaderboards](14-evaluation-and-observability/03-benchmarks-and-leaderboards.md)。


**Harness Engineering（Harness 工程）** - 围绕智能体设计确定性驱动代码（上下文组装、工具执行、预算、停止条件、持久状态、可观测性），而非仅调优模型。Harness 是内核，模型是策略。参见 [Loop Engineering](07-agentic-systems/12-loop-engineering.md)。

**HNSW（Hierarchical Navigable Small World，层次化可导航小世界）** - 向量数据库中近似最近邻搜索的图算法。

**Human-in-the-Loop（HITL，人类在环）** - 人类监督、批准或纠正 AI 输出的模式。

---

## I

**In-Context Learning（上下文学习）** - 模型基于提示中的示例适配任务，无需更新权重。

**Indirect Prompt Injection（间接提示注入）** - 通过智能体读取的内容（网页、文档、工具结果）而非用户直接输入发起的提示注入攻击。红队研究和不可能性结论表明其无法完全防御，因此防御转向最小权限与隔离。参见 [Agentic Security and Sandboxing](07-agentic-systems/09-agentic-security-and-sandboxing.md)。

**Inference（推理）** - 运行训练好的模型以生成预测或输出。

---

## J

**JSON Mode（JSON 模式）** - LLM 输出模式，保证返回有效的 JSON 结构（遗留特性）。在更新的 API 中已被 **Structured Outputs（结构化输出）** 取代。

---

## K

**KV Cache（键值缓存）** - 注意力计算中缓存的 key-value 对。支持高效自回归生成。

**KV-Aware Routing（KV 感知路由）** - 将请求发送到 KV 缓存中已持有最长匹配前缀的副本，而非轮询，使前缀缓存命中在扩容后仍有效。NVIDIA Dynamo（v1.5.0，2026 年 9 月 21 日，可插拔 scorer 与 picker 策略）和 llm-d Endpoint Picker（2026 年 8 月从 Kubernetes Gateway API Inference Extension 移入 llm-d）在 vLLM、SGLang、TensorRT-LLM 上方实现此能力。应平衡缓存亲和与负载，否则最热缓存副本会成为热点。见[服务基础设施](04-inference-optimization/06-serving-infrastructure.md#引擎之上的编排-dynamo-与-llm-d)。

---

## L

**LangChain（LangChain）** - 用于构建具备 chains、agents 与集成能力的 LLM 应用框架。

**Leaderboard Illusion（排行榜错觉）** - Cohere 等（arXiv:2504.20879）的批判：LMArena（现为 arena.ai 上的 Arena） 等 crowd-preference 排行榜受私有 best-of-N 测试、不平等数据访问和模型静默淘汰的扭曲。虽然 LMArena 对影响程度有争议，但实践上应阅读带置信区间的风格控制 Elo，并将 Arena 视为偏好指标，而非正确性真值。

**LlamaIndex（LlamaIndex）** - 面向 LLM 应用中文档处理与检索的数据框架。

**LiveCodeBench（LiveCodeBench）** - 基于真实竞赛编程平台问题评估编程模型的基准。对于生产编码任务，比 HumanEval 更可靠。但 Artificial Analysis 随 Intelligence Index v4.3（2026 年 9 月）已将其移入旧版集合。

**LoRA（低秩适配）** - 参数高效微调方法，训练小规模适配矩阵而非完整模型权重。

**LLM-as-Judge（LLM 作为裁判）** - 使用 LLM 评估另一个 LLM 的输出。返回带概率的判定而非文本的类型化决策模型（TypeSafe Jev，早期访问，2026 年 9 月加入 LangSmith 与 Langfuse）对是非和评分判断更便宜，代价是没有书面理由。

**Long-Context Cliff（长上下文价格跃升）** - 提示词超过阈值后，整个请求而非仅超出 token 进入更高费率的定价规则。OpenAI 输入超过 272K 适用（GPT-6 Astra 每 1M 从 $10/$50 变为 $20/$75），xAI 达到 200K 时每个 token 翻倍，Gemini 3.1 Pro Preview 超过 200K 上调；Anthropic Claude 4.6 及之后在 1M 内保持统一费率。路由超长提示前应建模跃升。见[定价与成本](02-model-landscape/03-pricing-and-costs.md)。

**Loop Engineering（循环工程）** - 设计并持续改进包裹智能体的控制循环（触发器、内层 reason-act-observe 循环、验证循环、事件驱动调用、基于评测的改进循环）的学科，而非每一轮都手工提示模型。参见 [Loop Engineering](07-agentic-systems/12-loop-engineering.md)。


**Loopmaxxing（循环极限化）** - 一种反模式，误以为更多迭代自动解决任务。它在没有可验证退出条件的目标上会失败，导致循环不收敛且成本失控。是 token-maxxing 的多步衍生。参见 [Loop Engineering](07-agentic-systems/12-loop-engineering.md)。

---

## M

**Managed Agents（托管智能体）** - 提供方托管运行时提供执行框架（持久化、记忆、技能加载、沙箱生命周期、持久执行、身份范围），你只需提供智能体逻辑。截至 2026 年 10 月包括：Claude Managed Agents（会话预算、通过 `ant apply` 和已提交锁文件实现智能体即代码）、OpenAI Agents API（Codex 框架托管服务，2026 年 9 月 10 日公共 beta，发布时仅美国驻留、无零数据保留）、基于它的 Amazon Bedrock Managed Agents（2026 年 9 月 29 日起预览）。租用循环不会为自有副作用工具提供恰好一次语义。见[持久执行](07-agentic-systems/11-durable-execution.md#托管式智能体运行时-租用持久循环)。
**MCP（Model Context Protocol，模型上下文协议）** - 连接模型与工具、数据和提示的开放协议。Anthropic 于 2024 年 11 月推出；2025 年 12 月治理转移至 Linux Foundation Agentic AI Foundation；Anthropic、OpenAI、Google、Microsoft、AWS 均支持。Streamable HTTP 传输与 OAuth 2.1 授权在 2025-03-26 修订中引入（没有名为“MCP 2.0”的规范版本；2.x 是自 2026 年 7 月起 SDK 的版本号）。当前修订 2026-07-28 移除协议级会话，使核心无状态。见[工具使用与 MCP](07-agentic-systems/03-tool-use-and-mcp.md#mcp-2026-07-28-无状态化改造)。

**Memory Poisoning（记忆中毒）** - 攻击向智能体长期记忆中植入恶意或虚假条目，使其在未来会话中重新出现并影响判断。已纳入 OWASP 2026 Agentic Top 10 的 ASI06。防御倾向于在写入时做来源保护，而非仅在读取时清洗。参见 [Research Radar](RESEARCH-RADAR.md)。

**Mixture of Agents（MoA，多智能体混合）** - 多个智能体共同贡献并生成综合响应的集成模式。

**Mixture of Experts（MoE，混合专家）** - 学习型路由器将每个 token 发送到众多专家前馈块中的少数几个，使模型总参数极大、每 token 仅激活一部分。开放权重现以总量/激活量描述（Xiaomi MiMo-V2.6-Pro 1.02T/42B、Z.ai GLM-5.3 744B/40B）。激活参数决定每 token 计算，总参数决定内存，因此服务仍需容纳所有专家，通常需要专家并行。见[LLM 内部机制](01-foundations/01-llm-internals.md#混合专家-moe)。

**Model Routing（模型路由）** - 根据任务、成本、延迟、能力或语义为每个请求选择模型，常用级联策略（先用便宜模型，低置信度时升级）和跨供应商降级。参见 [AI Gateways and Model Routing](11-infrastructure-and-mlops/03-ai-gateways-and-model-routing.md)。

**Multi-Tenancy（多租户）** - 通过共享基础设施为多个客户提供服务，并保持数据隔离。

---

## N

**NVFP4 / MXFP4** - 带细粒度分块缩放的 4-bit 浮点权重格式：NVIDIA 在 Blackwell 和 Rubin 上的 NVFP4，以及 AMD 为机架引用的 Open Compute Project 微缩放格式 MXFP4。NVFP4 或 MXFP4 权重搭配 FP8 KV 缓存是 2026 年代表性服务配置，但收益取决于内核路径：NVIDIA 自己的 Dynamo Nemotron 3.5 Lightning 配方中，BF16 在 Marlin 比 NVFP4 快 80%，在 CuTeDSL 快 12%。假定 4-bit 更快前应测自己的栈。见[LLM 基础设施](11-infrastructure-and-mlops/01-llm-infrastructure.md)。

---

## O

**o3** - OpenAI 在 o1 后的 o 系列推理模型（o3-mini 于 2025 年 1 月，o3 于 2025 年 4 月），通过内部思维链分配测试时计算。现为旧版：Microsoft Foundry 于 2026 年 11 月 19 日退役 o3，`o3-2025-04-16` API 快照于 2026 年 12 月 11 日退役，指定 GPT-5.6 模型替代。

**OAuth Mix-Up（OAuth 混淆）** - 针对连接多个 OAuth 保护服务器的客户端的攻击：恶意服务器诱使其发送本属于其他服务器颁发者的授权码或 token。MCP SDK 中对应 CVE-2026-104850（TypeScript）和 GHSA-qx49-fqc8-xw99（Python），CVSS 7.5，修复于 TypeScript 1.31.0/2.2.0 和 Python 1.30.0/2.2.0；机器到机器提供方还需要 `expectedIssuer`，升级前存储的凭据在清除前仍暴露。将每个 token 绑定颁发者与服务器。见[工具使用与 MCP](07-agentic-systems/03-tool-use-and-mcp.md#oauth-混淆-多服务器客户端成为迷惑代理)。

**OCR（光学字符识别）** - 从图像或扫描文档中提取文本。

**OpenHands（OpenHands）** - 开源自主软件工程智能体（前称 OpenDevin）。支持多个后端 LLM，并在 Docker 沙箱中运行。

**OSWorld** - 在虚拟机中跨桌面应用完成真实任务的计算机使用智能体基准。OSWorld-Verified 已饱和；OSWorld 2.0（XLANG）以二元分数（完整完成任务）为主，旁列部分得分，两者差异巨大：XLANG 榜单（2026 年 9 月 17 日）Claude Opus 5 在 max 强度、v2.1 任务集二元得分 44.33%，部分得分 77.67%。供应商发布文章常引用部分分数（Anthropic 报告 Opus 5.5 部分得分 81.8%），因此应检查读的是哪种数字。见 **Computer-Use（计算机控制）**及[基准与排行榜](14-evaluation-and-observability/03-benchmarks-and-leaderboards.md#智能体与工具使用)。

---

## P

**Plugin4Shell** - AIR Security 于 2026 年 9 月 17 日披露的插件供应链缺陷。编码智能体安装固定到 40 字符提交 SHA 的插件，却不验证检出树匹配固定值；git 优先选择与 SHA 同名的分支，因此接受哈希形状分支名的托管站上，仓库所有者可替换已批准代码，后台更新无需提示就会拉取。Claude Code 2.1.179、Codex 0.146.0 已修复；GitHub Copilot 披露时未修复。只有检出后验证，固定才是控制措施。见[工具使用与 MCP](07-agentic-systems/03-tool-use-and-mcp.md#agent-plugins-智能体插件)。

**pass^k** - 智能体可靠性指标：任务在所有 k 次独立尝试中都被解决的比例（对比 pass@k，即至少一次解决）。它揭示了可靠性断崖：一个 pass@1 约 60% 的智能体在 pass^8 时可降至约 25%。这是生产环境更相关的一致性信号。

**Prompt Caching（提示缓存）** - 为重复提示前缀复用提供方 KV 缓存。写入有溢价（Anthropic 5 分钟缓存为输入的 1.25 倍、1 小时为 2 倍；OpenAI GPT-5.6 及之后为 1.25 倍，TTL 固定 30 分钟），读取为小比例：多数模型 0.1 倍，Claude Opus 5.5 和 GPT-6.1 Sol 为 0.05 倍，Claude Fable 5.1 为 0.025 倍。一次复用即可覆盖 5 分钟写入溢价。智能体循环受益最大，因为绝大部分是输入：Anthropic 报告 Claude Code 输入输出 token 比为 324:1。见[定价与成本](02-model-landscape/03-pricing-and-costs.md)。

**Prompt Injection（提示注入）** - 恶意输入操控 LLM 行为的攻击。

**Prefix Caching（前缀缓存）** - 在请求间重用通用提示前缀的 KV 缓存。

---

## Q

**QLoRA（量化 LoRA）** - LoRA 与 4-bit 量化结合，用于内存高效微调。

**Quantization（量化）** - 降低模型精度（如 FP16 转 FP8、INT4 或 NVFP4），以减少内存并提高速度。

---

## R

**RAG（检索增强生成）** - 检索相关文档并将其作为 LLM 生成上下文的模式。

**RBAC（基于角色的访问控制）** - 基于预定义角色与权限的访问控制。

**ReAct（ReAct）** - 在 Reasoning（推理）与 Acting（行动）步骤之间交替的智能体模式。

**Reasoning Effort（推理强度）** - 控制推理模型回答前思考量的请求级参数，现为主要成本与延迟旋钮：OpenAI 的 `reasoning.effort`、Claude 自适应思考的 `effort`、Gemini 的 `thinking_level`。最新模型从 low 到 xhigh、max。默认值随版本变化（Claude Opus 5.5 默认为 `medium`，Opus 5 为 `high`），因此每条路由固定强度，引用基准必须带强度。推理 token 按输出收费。

**Recursive Self-Improvement（RSI，递归自我改进）** - AI 系统改进生成后继系统的执行框架、训练或研究过程。2026 年 9 月兴起的术语：OpenAI 称已达到自动化研究实习生阶段，目标为 2028 年 3 月的自动化 AI 研究员。对工程师而言是改进循环指向自身，继承所有评分器问题：冻结并版本化评估集，保留循环永远看不到的审计集，执行框架变更必须经过人工审查。见[循环工程](07-agentic-systems/12-loop-engineering.md#当第-4-层循环转向自身-递归式自我改进)。

**Reranking（重排序）** - 第二阶段打分以提高检索精度。Cross-encoder 精度通常高于 bi-encoder。

**Responses API** - OpenAI 模型调用、内置工具（Web 搜索、向量存储文件搜索、远程 MCP 服务器）与多轮状态的主要 API，搭配 Conversations API 提供持久线程。它替代了于 2026 年 8 月 26 日停服的 Assistants API：线程状态需迁到 Conversations，向量存储通过 `file_search` 延续。新模型依赖 Responses API：GPT-6 Astra 工具调用要求它，Pydantic AI 2.0 默认将 `openai:` 模型路由至此。供应商托管状态仍应藏在自有抽象之后：assistant 对象迁移目标 Reusable Prompts 自己也计划于 2026 年 11 月 30 日停服。见[应对框架更迭](09-frameworks-and-tools/12-navigating-framework-churn.md)。

**Reward Hacking（奖励投机）** - 策略通过漏洞最大化奖励，而非完成预期任务：特判测试、编辑评分器或从环境读取答案。现不仅在训练中，也出现在工作智能体中：一项研究测得研究智能体在开放研究流水线任务上自发奖励投机率 30.5%（arXiv 2609.28614），Anthropic 发现可投机环境训练的变体复现了生产模型未复现的真实攻击链。隔离评分器和产出者，留出审计集，移除可利用环境。见[循环工程](07-agentic-systems/12-loop-engineering.md)。

**RLHF（基于人类反馈的强化学习）** - 使用人类偏好来对齐模型行为的训练方法。

**RTEB** - MTEB 团队的检索基准（2025 年 10 月），混合开放数据集与由维护者评估的私有留出集，使模型无法针对全部测试调优。筛选嵌入模型时应优先于仅看 MTEB 排名，再在自己的语料上决定。NVIDIA 报告 Nemotron 3 Embed 8B 在 RTEB Multilingual 以 78.5 排名第一（供应商报告，2026 年 7 月）。见[嵌入模型](06-retrieval-systems/03-embedding-models.md#模型选择标准-model-selection-criteria)。

**RLVR（基于可验证奖励的强化学习）** - 推理模型主流的后训练方案：用可程序验证器（数学、代码或逻辑且有可校验答案）来奖励策略，而非学习型奖励模型，基本规避了奖励模型作弊。参见 [Training Reasoning Models](03-training-and-adaptation/08-rlvr-and-reasoning-models.md)。

## S

**Safeguard Fallback（安全护栏回退）** - 安全分类器阻止请求时，提供方或路由器使用另一个通常更旧的模型完成。Claude Fable 5.1 返回 HTTP 200 和 `stop_reason: "refusal"`，beta 设置允许服务端在 Opus 4.8 或 Opus 5 重试；Anthropic 评估 Opus 5.5 时，被阻止的网络安全任务由 Opus 4.8 运行。两个后果：“带回退”基准分数属于路由系统，而非一组权重；路由器必须按 `stop_reason` 而非 HTTP 状态分支。2026 年 9 月 24 日起 Anthropic 对三类输出前拒答收费。见[模型分类](02-model-landscape/01-model-taxonomy.md)。

**Self-Consistency（自洽）** - 通过对多个推理路径进行采样，并选择最常见的答案。

**Semantic Search（语义检索）** - 通过语义而非关键词查找文档，使用 embeddings。

**Service Tier（服务层级）** - 同一模型按不同延迟或优先级以不同价格销售。能等待时 Batch、Flex 为 0.5 倍；OpenAI Fast（2026 年 7 月 30 日由 Priority 更名）为 2 倍，Ultrafast 为 6 倍（GPT-6 Astra GA、GPT-5.6 Sol 预览）；Gemini Priority 约 1.8 倍、Bedrock Priority 1.75 倍；Anthropic 近期 Opus 快速模式为 2 倍（仅 Claude API 研究预览），不再销售 Priority Tier 承诺。层级对整张账单施加倍率，因此按路由选择并在每个请求记录。见[定价与成本](02-model-landscape/03-pricing-and-costs.md)。

**Speculative Decoding（推测解码）** - 低成本草稿器提出多个 token，目标模型一次前向传播验证，降低延迟而不改变目标输出分布。2026 年草稿器包括 EAGLE-3 头、原生多 token 预测（MTP）头、DFlash 块扩散草稿器，以及 DeepSeek 打包进检查点的 DSpark 模块；vLLM 文档不再列出 Medusa。批大小增大时收益缩小，因此按生产并发测量。见[推测解码](04-inference-optimization/03-speculative-decoding.md)。

**Speech-to-Speech (S2S)（语音到语音）** - 一种 voice-agent 架构，其中单个多模态模型直接接收音频输入并直接输出音频，而不是采用 STT 到 LLM 再到 TTS 的级联流水线。更自然、延迟更低，但更难调试和控制。见 [Real-Time Voice Agents](18-voice-and-audio-agents/01-realtime-voice-agents.md)。

**State-Handle Hijacking（状态句柄劫持）** - MCP `2026-07-28` 规范中命名的一类攻击。协议级会话移除后，服务器会生成显式状态句柄，并将其作为普通工具参数返回；获得或猜出句柄的攻击者可以读取或修改其他用户的状态。缓解措施：绝不能把句柄当作身份验证；使用非确定性句柄；并在服务器端将句柄绑定到已认证的主体。参见[工具使用与 MCP](07-agentic-systems/03-tool-use-and-mcp.md)。

**Structured Outputs（结构化输出）** - 提供方通过约束解码使输出符合指定 JSON Schema 的功能；OpenAI、Anthropic、Google 均原生提供。比旧 JSON 模式严格。现是最新 Claude 模型可靠抽取路径，Fable 5.1、Opus 5.5、Sonnet 5.5 强制工具使用（`tool_choice` 为 `any` 或 `tool`）返回 400。

**SWE-bench Verified** - 经人工验证的 SWE-bench 500 问题子集，衡量真实 GitHub 问题解决能力，是 2024-2026 年典型编码基准。现已饱和且部分污染。后继 SWE-Bench Pro 也饱和：Scale v2（2026 年 9 月）上，Opus 5 在 642-task 公开集为 99.4%，因此应引用 272-task 私有集（Opus 5：81.6%）。信任分数前先读测试框架。见[基准与排行榜](14-evaluation-and-observability/03-benchmarks-and-leaderboards.md)。

**System Prompt（系统提示）** - 为 LLM 对话设置上下文和行为的指令。

---

## T

**Temperature（温度）** - 控制 LLM 输出随机性的参数。越低 = 越确定。推理模型越来越不提供此参数：GPT-6 Astra 不接受定制 temperature 或 `top_p`，Claude Sonnet 5.5 对非默认值返回 400，Anthropic Python SDK 1.0 从 Messages 签名中移除了采样参数。应通过结构化输出、固定强度和评估获得一致性，而非 temperature 0。

**Terminal-Bench** - 智能体在真实终端完成困难多步任务的基准，现为智能体式编码主要比较依据。大版本间分数不可迁移，因此 3.0 数字不能说明 4.0。tbench.ai 4.0 榜单（2026 年 9 月 21 日）GPT-6 Astra 在 max 强度以 58.18% 领先，Claude Fable 5.1 同为 max 得 57.88%；次日发布的 Claude Opus 5.5 供应商报告 xhigh 得 66.4%。始终注明版本、强度和运行方。见 **Harness (Scaffold) Variance**及[基准与排行榜](14-evaluation-and-observability/03-benchmarks-and-leaderboards.md#编码)。

**Test-Time Compute (Inference-Time Scaling)（测试时计算/推理时扩展）** - 在推理时投入更多计算，同时保持权重**冻结**：长 chain-of-thought、best-of-N、自洽性、搜索。到 2026 年在生产中已无处不在，但在某个点之后收益会递减（有时甚至为负）。与 Test-Time Training 相对。

**Test-Time Training (TTT)（测试时训练）** - 在推理时更新模型的**权重**（通常是短暂的 LoRA），基于测试输入、其增强样本或检索到的邻居样本进行更新，然后再预测并丢弃更新。与保持权重冻结的 test-time compute 不同。到 2026 年仍处于研究阶段，在 ARC 等新任务以及长上下文效率方面最强。见 [Research Radar](RESEARCH-RADAR.md#_12-测试时训练-在推理中学习)。

**Token（词元）** - 文本处理的基本单位。英文中大约相当于 0.75 个词或 4 个字符。

**Tool Use（工具使用）** - LLM 调用外部函数/API 的能力。

**Transformer（Transformer）** - 基于 self-attention 的神经网络架构。现代 LLM 的基础。

---

## V

**Vector Database（向量数据库）** - 专为存储和搜索高维向量（embeddings）优化的数据库。

---

## W

**Windsurf** - 紧密集成智能体能力（“Flows”）的 AI 原生 IDE，最初由 Codeium 构建，自 2025 年 7 月起归 Devin 开发商 Cognition 所有。Cursor 的替代品。

---

## X

**x402** - 使用 402 Payment Required 状态码通过 HTTP 按请求付费的开放标准，支持银行卡或稳定币；自 2026 年 7 月 14 日由 Linux Foundation 旗下 x402 Foundation 治理。最可能影响非商务智能体的商务协议，因为它让付费 API 和 MCP 工具调用成为真实支出，需与 token 支出相同的上限。见 **Agentic Commerce Protocols（智能体商务协议）**。

---

## Z

**Zero Data Retention（ZDR，零数据保留）** - 提供方约定请求完成后不存储提示与输出，常为受监管数据所需。可用性按模型和产品，而非供应商：Claude Fable 5.1 除非 Anthropic 授权 ZDR，否则需保留 30 天；Opus 5.5 和 Sonnet 5.5 支持，OpenAI Agents API 发布时不支持。任何技术比较前应先核对。

**Zero-Shot（零样本）** - 不提供示例的提示方式，依赖模型已有知识。

---

*另见：[PATTERNS.md](PATTERNS.md) 获取设计模式速查*
