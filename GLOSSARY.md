# AI 系统设计词汇表

本指南中关键术语的快速参考。

---

## A

**Agentic Coding（智能体式编码）** - LLM 自动编辑文件、运行 shell 命令、编写测试并反复迭代，直到编码任务完成。以 Claude Code、OpenHands 和 Cline 为代表。

**Agentic System（智能体系统）** - 利用工具自主规划并执行多步任务的 LLM 应用。

**AI Control（AI 控制）** - 一种安全方法，假设模型可能未对齐，并设计部署协议（监控、关键动作延后、重采样、分解式认知）以在此情况下仍保持安全。与 alignment 不同，后者旨在从一开始就使模型可信。参见 [Research Radar](RESEARCH-RADAR.md)。

**AI Gateway（AI 网关）** - 你的应用与模型提供商（如 LiteLLM、OpenRouter、Portkey、Kong）之间的控制平面代理。提供一个 OpenAI 兼容 API，并集中化路由、降级、负载均衡、速率限制处理、虚拟密钥与预算、缓存及可观测性。参见 [AI Gateways and Model Routing](11-infrastructure-and-mlops/03-ai-gateways-and-model-routing.md)。

**Attention Mechanism（注意力机制）** - 使模型能够关注输入中相关部分的神经网络组件。Self-attention 会比较每个 token 与所有其他 token。

**ABAC（基于属性的访问控制）** - 基于用户、资源和环境属性，而非固定角色进行的访问控制。

---

## B

**Batching（批处理）** - 将多个请求一起处理以提高 GPU 利用率。Continuous batching 会在其他请求生成过程中持续加入新请求。

**Benchmark Saturation（基准饱和）** - 当前沿模型在某基准上接近上限，导致得分差异落入噪声范围（提示词措辞、运行方差）时，基准已无法区分模型。MMLU、HumanEval 和 GSM8K 已达到饱和。参见 [Benchmarks and Leaderboards](14-evaluation-and-observability/03-benchmarks-and-leaderboards.md)。

**BM25** - 传统基于关键词的排序算法。常与向量检索结合用于混合检索。

**Budget Tokens（预算 token）** - 适用于 Extended Thinking（Claude）或 reasoning（o3）的可配置计算预算。预算越高，内部推理步骤越多，从而带来更高准确率和更高成本。

---

## C

**C2PA（Content Credentials，内容凭证）** - 一种开放标准，通过加密将来源元数据（由谁创建、是否涉及 AI、做了哪些编辑）绑定到媒体资产上，采用防篡改的硬绑定与可抵抗重编码的水印式软绑定。它是 AI 内容标注法规背后的来源层；可移除，因此应结合水印与检测共同使用。参见 [Multimodal Generation](19-multimodal-generation/01-multimodal-generation.md)。

**Capability Index（Composite Benchmark，复合基准）** - 许多基准的加权汇总（如 Artificial Analysis Intelligence Index、Epoch Capability Index、HAL for agents），用于对前沿模型排序，使排序在单一基准饱和时仍能持续区分。

**Chain-of-Thought（CoT，思维链）** - 一种提示技术，在生成最终答案前引导模型进行逐步推理。

**Chunking（分块）** - 将文档切分为更小片段以便嵌入与检索。策略包括固定大小、语义分块与层次分块。

**Claude Code（Claude 代码）** - Anthropic 的终端原生自主编码智能体。通过 bash、text_editor 和 computer 工具在完整项目内读取、编辑并运行代码。由 CLAUDE.md 清单文件控制。

**Claude Fable 5（Claude Fable 5）** - Anthropic 最强的公开发布模型（2026-06-09，`claude-fable-5`）。一种 Mythos 级模型，已安全化以供公开使用：每 100 万 token 计费 $10/$50，1M 上下文，adaptive thinking 始终开启。敏感查询在不到 5% 会话中回退到 Claude Opus 4.8。无限制版本 Claude Mythos 5 仅限 Project Glasswing 合作伙伴使用。

**Cline（Cline）** - 开源 VS Code 扩展，提供具备工具调用能力的自主 AI 编码（文件编辑、终端、浏览器）。MCP 原生。

**Computer-Use（计算机控制）** - 一种模型能力（Claude 3.5+ 原生），通过模拟鼠标点击、键盘输入和截图来控制 GUI。支持浏览器和桌面自动化。

**Context7（Context7）** - MCP 服务器，在运行时获取最新库文档，解决 Coding Agent 的“训练数据过期”问题。

**Context Window（上下文窗口）** - 单次请求中 LLM 可处理的最大 token 数。范围通常为 4K 到 1M+。

**Context Rot（上下文腐坏）** - 上下文窗口中出现与任务无关或过期 token 后，输出质量下降，常在公开上限前就出现。推动了压缩与按需检索。参见 [Context Engineering](05-prompting-and-context/05-context-engineering.md)。

**Cosine Similarity（余弦相似度）** - 衡量两个向量相似程度的指标，是比较 embeddings 的标准度量。

**Cursor（Cursor）** - AI 原生 IDE（基于 VS Code 的分支），深度集成模型用于代码补全、智能体式编辑和多文件上下文感知。

---

## D

**Data Contamination（数据污染）** - 基准题目或其答案泄漏到模型训练数据中，导致分数通过记忆而非能力提升。可通过时间门控、私有或留出测试集缓解。参见 [Benchmarks and Leaderboards](14-evaluation-and-observability/03-benchmarks-and-leaderboards.md)。

**Diffusion Language Model（扩散语言模型）** - 一种非自回归 LLM，通过并行迭代去噪一个被掩码的序列生成文本，而非从左到右生成；在质量上略有损失，但吞吐率更高（有报告称超过 1,000 token/秒）。在代码与填充任务上表现强，且截至 2026 年仍处于早期阶段。参见 [Diffusion Language Models](04-inference-optimization/08-diffusion-llms.md)。

**DPO（直接偏好优化）** - 一种微调方法，直接在偏好数据上优化，无需单独的奖励模型。

**DSPy** - 通过可优化模块而非手工提示来编排 LLM 的框架。

**Durable Execution（持久化执行）** - 一种执行模型（Temporal、Restate、DBOS），通过仅追加的事件历史和确定性重放使长运行智能体在崩溃和重启后存活，提供恰好一次副作用、持久定时器以及跨部署存续的暂停。参见 [Durable Execution](07-agentic-systems/11-durable-execution.md)。

---

## E

**Effective Context Length（有效上下文长度）** - 模型仍能保持质量的上下文长度，通常比标称窗口更短。在 RULER 中，许多宣称 128K 的模型实际只到约 32-64K。应按有效上下文而非标称上下文设计系统。

**Embedding（嵌入）** - 文本的稠密向量表示，用于语义搜索和相似度比较。

**Endpointing（Turn Detection，对话轮次检测）** - 在语音智能体中判断用户何时说完，以便智能体回应。学习型轮次检测模型在语义完整时触发，优于按固定静默时长计时的方式。参见 [Real-Time Voice Agents](18-voice-and-audio-agents/01-realtime-voice-agents.md)。

**Ensemble（集成）** - 结合多个模型输出以提高可靠性，包含投票、辩论和多智能体混合。

**Eval Awareness（评测感知）** - 模型检测到自己正在被评估并相应调整行为的倾向，这会干扰安全与能力基准，支持采用更自然、留出式测试条件。

**Extended Thinking（扩展思考）** - Claude（3.7+）的内部推理模式，模型在生成响应前先进行草稿式推理。可通过 `thinking.budget_tokens` 配置，默认不向最终用户展示。

**EU AI Act（欧盟 AI 法案）** - 《Regulation (EU) 2024/1689》，首部全面 AI 法律，按风险分级（禁止、高风险、有限、最小）并附加独立的 GPAI 义务，最高可罚公司全球营业额 7%。截至 2026 年，禁令与 GPAI 规则可执行；高风险义务暂时性推迟到约 2027 年。参见 [AI Governance and Compliance](13-reliability-and-safety/04-ai-governance-and-compliance.md)。

---

## F

**Few-Shot Prompting（少样本提示）** - 在提示中加入示例以引导模型行为。

**Fine-Tuning（微调）** - 在任务特定数据上继续训练预训练模型以提升性能。

**FinOps for AI（AI 的 FinOps）** - 测量、归因与优化 AI 开支的实践：每 token / 每请求 / 每任务成本、提示缓存、批量经济性、成本展示与分摊、单位经济学。参见 [FinOps and Token Economics](11-infrastructure-and-mlops/04-finops-and-token-economics.md)。

**Framework Churn（框架更迭）** - AI 编排框架（如 LlamaIndex、LangChain）快速且破坏性的演进，几乎每年重排包结构并移除抽象，导致新环境下旧教程和课程失效。应对方法是锁定版本，并学习原语而非特定 API。参见 [Navigating Framework Churn](09-frameworks-and-tools/12-navigating-framework-churn.md)。

**Function Calling（函数调用）** - LLM 输出结构化工具调用而非纯文本的能力。

---

## G

**GGUF** - llama.cpp、Ollama 和 LM Studio 用于本地推理的量化模型文件格式。量化级别在质量与体积之间权衡，Q4_K_M 通常是实用甜点区。参见 [On-Device and Edge Deployment](04-inference-optimization/09-on-device-and-edge-deployment.md)。

**Guardrails（护栏）** - 输入/输出校验，用于防止有害或偏离主题的响应。

**Grounding（事实依据锚定）** - 将 LLM 响应与事实来源连接以减少幻觉。

**Grok 4.3（Grok 4.3）** - xAI 的前沿推理模型。在推理基准上与 GPT-5.5、Claude Opus 4.7、Gemini 3.1 Pro 具备竞争力。可通过 xAI API 与 X 内部访问。

**GRPO（群体相对策略优化）** - DeepSeek-R1 背后的 RL 算法：去除 PPO 的价值/评论家网络，并从一组采样完成样本内的奖励分布计算优势。比 PPO 更便宜；其变体（Dr.GRPO、DAPO、GSPO）修复了长度偏置和零方差坍缩。参见 [Training Reasoning Models](03-training-and-adaptation/08-rlvr-and-reasoning-models.md)。

---

## H

**Hallucination（幻觉）** - 模型生成看似合理但事实错误的信息。

**Harness (Scaffold) Variance（Harness/Scaffold 方差）** - 同一模型权重在不同提示、工具访问、推理投入或智能体 scaffold 下，基准分数可出现 10-20 分波动。解释了为何不同供应商自报指标不可跨实验室直接比较，只有同一 harness 的数值才可比。参见 [Benchmarks and Leaderboards](14-evaluation-and-observability/03-benchmarks-and-leaderboards.md)。

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

---

## L

**LangChain（LangChain）** - 用于构建具备 chains、agents 与集成能力的 LLM 应用框架。

**Leaderboard Illusion（排行榜错觉）** - Cohere 等（arXiv:2504.20879）的批判：LMArena 等 crowd-preference 排行榜受私有 best-of-N 测试、不平等数据访问和模型静默淘汰的扭曲。虽然 LMArena 对影响程度有争议，但实践上应阅读带置信区间的风格控制 Elo，并将 Arena 视为偏好指标，而非正确性真值。

**LlamaIndex（LlamaIndex）** - 面向 LLM 应用中文档处理与检索的数据框架。

**LiveCodeBench（LiveCodeBench）** - 基于真实竞赛编程平台问题评估编程模型的基准。对于生产编码任务，比 HumanEval 更可靠。

**LoRA（低秩适配）** - 参数高效微调方法，训练小规模适配矩阵而非完整模型权重。

**LLM-as-Judge（LLM 评审）** - 使用一个 LLM 去评估另一个 LLM 的输出。

**Loop Engineering（循环工程）** - 设计并持续改进包裹智能体的控制循环（触发器、内层 reason-act-observe 循环、验证循环、事件驱动调用、基于评测的改进循环）的学科，而非每一轮都手工提示模型。参见 [Loop Engineering](07-agentic-systems/12-loop-engineering.md)。

**Loopmaxxing（循环极限化）** - 一种反模式，误以为更多迭代自动解决任务。它在没有可验证退出条件的目标上会失败，导致循环不收敛且成本失控。是 token-maxxing 的多步衍生。参见 [Loop Engineering](07-agentic-systems/12-loop-engineering.md)。

---

## M

**MCP（Model Context Protocol，模型上下文协议）** - 与 LLM 进行标准化工具/资源集成的开放协议。由 Anthropic 于 2024-11 发起；治理于 2025-12 移交给 Linux Foundation 的 Agentic AI Foundation；被 Anthropic、OpenAI、Google、Microsoft、AWS 采用。2.0 版本（2026-03 正式）新增可流式 HTTP 传输与 OAuth 2.1 鉴权。

**Memory Poisoning（记忆中毒）** - 攻击向智能体长期记忆中植入恶意或虚假条目，使其在未来会话中重新出现并影响判断。已纳入 OWASP 2026 Agentic Top 10 的 ASI06。防御倾向于在写入时做来源保护，而非仅在读取时清洗。参见 [Research Radar](RESEARCH-RADAR.md)。

**Mixture of Agents（MoA，多智能体混合）** - 多个智能体共同贡献并生成综合响应的集成模式。

**Model Routing（模型路由）** - 根据任务、成本、延迟、能力或语义为每个请求选择模型，常用级联策略（先用便宜模型，低置信度时升级）和跨供应商降级。参见 [AI Gateways and Model Routing](11-infrastructure-and-mlops/03-ai-gateways-and-model-routing.md)。

**Multi-Tenancy（多租户）** - 通过共享基础设施为多个客户提供服务，并保持数据隔离。

---

## O

**o3** - OpenAI 的高算力推理模型（2025-01 发布）。使用内部思维链分配测试时计算。提供标准版和 "mini" 版本，在数学、代码和科学领域表现突出。

**OCR（光学字符识别）** - 从图像或扫描文档中提取文本。

**OpenHands（OpenHands）** - 开源自主软件工程智能体（前称 OpenDevin）。支持多个后端 LLM，并在 Docker 沙箱中运行。

---

## P

**pass^k** - 智能体可靠性指标：任务在所有 k 次独立尝试中都被解决的比例（对比 pass@k，即至少一次解决）。它揭示了可靠性断崖：一个 pass@1 约 60% 的智能体在 pass^8 时可降至约 25%。这是生产环境更相关的一致性信号。

**Prompt Caching（提示缓存）** - 重用重复提示前缀的 KV 缓存。Anthropic（cache_control）、Google（隐式）以及部分 OpenAI 端点原生支持。可将长固定前缀成本降低 60-90%。

**Prompt Injection（提示注入）** - 恶意输入操控 LLM 行为的攻击。

**Prefix Caching（前缀缓存）** - 在请求间重用通用提示前缀的 KV 缓存。

---

## Q

**QLoRA（量化 LoRA）** - LoRA 与 4-bit 量化结合，用于内存高效微调。

**Quantization（量化）** - 降低模型精度（如 FP16 到 INT4）以减少内存并提高速度。

---

## R

**RAG（检索增强生成）** - 检索相关文档并将其作为 LLM 生成上下文的模式。

**RBAC（基于角色的访问控制）** - 基于预定义角色与权限的访问控制。

**ReAct（ReAct）** - 在 Reasoning（推理）与 Acting（行动）步骤之间交替的智能体模式。

**Reranking（重排序）** - 第二阶段打分以提高检索精度。Cross-encoder 精度通常高于 bi-encoder。

**RLHF（基于人类反馈的强化学习）** - 使用人类偏好来对齐模型行为的训练方法。

**RLVR（基于可验证奖励的强化学习）** - 推理模型主流的后训练方案：用可程序验证器（数学、代码或逻辑且有可校验答案）来奖励策略，而非学习型奖励模型，基本规避了奖励模型作弊。参见 [Training Reasoning Models](03-training-and-adaptation/08-rlvr-and-reasoning-models.md)。

## S

**Self-Consistency（自洽）** - 通过对多个推理路径进行采样，并选择最常见的答案。

**Semantic Search（语义检索）** - 通过语义而非关键词查找文档，使用 embeddings。

**Speculative Decoding（投机解码）** - 使用较小的草稿模型提出 token，再由大模型验证。

**Speech-to-Speech (S2S)（语音到语音）** - 一种 voice-agent 架构，其中单个多模态模型直接接收音频输入并直接输出音频，而不是采用 STT 到 LLM 再到 TTS 的级联流水线。更自然、延迟更低，但更难调试和控制。见 [Real-Time Voice Agents](18-voice-and-audio-agents/01-realtime-voice-agents.md)。

**Structured Outputs（结构化输出）** - OpenAI 的（以及 Anthropic 的 tool-mode）能力，可保证模型输出符合所提供的 JSON Schema。比传统 JSON 模式更严格。

**SWE-bench Verified（SWE-bench 已验证子集）** - SWE-bench 的 500 个问题的人工验证子集，用于衡量真实 GitHub issue 的解决；这是 2024-2026 年的权威编码基准。如今已接近饱和且部分存在污染，因此该领域正转向 SWE-bench Pro 和抗污染的实时变体。请先阅读 harness，再相信分数。见 [Benchmarks and Leaderboards](14-evaluation-and-observability/03-benchmarks-and-leaderboards.md)。

**System Prompt（系统提示）** - 为 LLM 对话设置上下文和行为的指令。

---

## T

**Temperature（温度）** - 控制 LLM 输出随机性的参数。越低 = 越确定。

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

**Windsurf** - 由 Codeium 开发的 AI-native IDE，具有紧密的 agentic 集成。使用 “Flows”（确定性的 agentic 序列）。Cursor 的替代方案。

---

## Z

**Zero-Shot（零样本）** - 不提供示例的提示方式，依赖模型已有知识。

---

*另见：[PATTERNS.md](PATTERNS.md) 获取设计模式速查*
