# 研究雷达

一份精心策划的前沿主题地图，面向想知道下一步该学什么的实践者。[基准与排行榜](14-evaluation-and-observability/03-benchmarks-and-leaderboards.md)中的排行榜会告诉你今天哪个模型领先；本页会告诉你哪些想法即将改变你的构建方式。

它按主题组织，而不是按论文组织。每个主题都会先说明它为什么对交付生产系统的人重要，再指向关键支撑论文，并链接到本指南中与该想法相关的位置。该快照反映了大约 2026 年第二季度的研究趋势；研究本质上是暂定的，因此请把具体结果视为方向性信号，并在把系统押注其上之前阅读一手来源。

## 目录

- [如何使用本页](#如何使用本页)
- [重大转变](#重大转变)
- [1. 上下文工程成为一门系统学科](#_1-上下文工程成为一门系统学科)
- [2. 测试时计算的局限](#_2-测试时计算的局限)
- [3. RL 后训练：它实际做了什么](#_3-rl-后训练-它实际做了什么)
- [4. 潜在推理与替代推理](#_4-潜在推理与替代推理)
- [5. 高效长上下文架构](#_5-高效长上下文架构)
- [6. Agent 可靠性与失效模式](#_6-agent-可靠性与失败模式)
- [7. Agent 与记忆安全](#_7-agent-与记忆安全)
- [8. AI 控制与评估前沿](#_8-ai-控制与评估前沿)
- [9. 记忆与检索进展](#_9-记忆与检索进展)
- [10. 多模态：世界模型、VLA 与 Omni](#_10-多模态-世界模型、vla-与-omni)
- [11. 更小、更便宜、更快](#_11-更小、更便宜、更快)
- [12. 测试时训练：在推理时学习](#_12-测试时训练-在推理中学习)
- [一条 90 天学习路径](#_90-天学习路径)
- [它如何映射到本指南](#这如何映射到指南)

---

## 如何使用本页

先阅读[重大转变](#重大转变)了解元趋势，然后进入与你所构建内容相关的主题。如果你构建 Agent（智能体），优先阅读主题 1、6、7 和 8。如果你优化推理，优先阅读 2、5 和 11。如果你从事检索或记忆相关工作，优先阅读 1 和 9。[90 天学习路径](#_90-天学习路径)按顺序安排了最高杠杆的阅读材料。

关于引用的说明：arXiv ID 遵循 `YYMM.NNNNN` 约定，因此 `2606.xxxxx` 表示 2026 年 6 月。少量来自 2025 年末的基础论文也被纳入，因为它们是当前趋势中被积极引用的参考点，并已相应标注。凡是经验结果类主张，都会表述为“论文报告称”，因为结果可能会被修订。

---

## 重大转变

五个元趋势位于具体论文之下：

1. **上下文是新的瓶颈，而且它是一个系统问题。** 2026 年的共识是，1M-token 窗口是一份需要管理的预算，而不是可以随意填充的免费空间。上下文工程已经从提示技巧发展为学习型策略、服务层压缩和操作系统风格的记忆层级。
2. **更多思考并不是免费的，而且有时会造成伤害。** 测试时计算存在可测量的局限和反向缩放区间。前沿方向是*自适应*计算，也就是按输入分配开销，而不是最大化计算。
3. **RL 后训练更多是在锐化能力，而不是新增能力。** 现在已有大量工作质疑，带有可验证奖励的 RL（强化学习）到底增加了多少真正的新能力，而不是重新加权基础模型已经知道的内容；这会改变 RL 何时值得其成本。
4. **Agent 还不安全也不可靠，其中一部分问题被证明很难。** 间接提示注入存在不可能性结果；记忆投毒是新的持久攻击面；重复运行下的 Agent 可靠性远低于最佳情况。应对方式正在从预防转向隔离与控制。
5. **基准已经不再足够，而且模型可能知道自己正在被测试。** 评估本身就是研究前沿：评估感知、支持拒答的评分、CoT（思维链）可监控性和裁判可靠性都是活跃问题。

---

## 1. 上下文工程成为一门系统学科

**为什么重要：** 长时间运行的 Agent 会随着上下文中充满过期工具输出而退化，即上下文腐化。修复方法已经从“总结历史”升级为训练好的上下文管理器、服务层压缩和按需分页上下文。如果你让 Agent 自主运行超过几分钟，这是最值得理解的高杠杆领域。

- **Learning Agent-Compatible Context Management for Long-Horizon Tasks (AdaCoM)**（[arXiv:2605.30785](https://arxiv.org/abs/2605.30785)）训练一个外部 LLM（大语言模型），通过 RL 编辑冻结 Agent 的上下文，将上下文管理视为学习型策略，而不是启发式方法。
- **Parallel Context Compaction for Long-Horizon LLM Agent Serving**（[arXiv:2605.23296](https://arxiv.org/abs/2605.23296)）把总结移出关键路径，将压缩重新定义为服务/系统层面的关注点。
- **The Missing Memory Hierarchy: Demand Paging for LLM Context Windows**（[arXiv:2603.09023](https://arxiv.org/abs/2603.09023)）把操作系统风格的按需分页引入上下文窗口。
- **Less Context, Better Agents**（[arXiv:2606.10209](https://arxiv.org/abs/2606.10209)）是少见的、对真实企业工具使用中的工具响应膨胀进行量化的研究，显示剪枝加总结优于完整历史。
- Anthropic 关于有效上下文工程、长时间运行 Agent 的测试框架，以及记忆工具的工程文章，仍然是实践者的词汇体系来源，包括即时检索、结构化记笔记、压缩、工具结果清理。

**连接位置：** [上下文工程](05-prompting-and-context/05-context-engineering.md)、[Agent 记忆与状态](07-agentic-systems/05-agent-memory-and-state.md)。

---

## 2. 测试时计算的局限

**为什么重要：** “调高思考预算”不是免费的质量杠杆。多个 2026 年结果显示，在超过临界 token 数后会出现反向缩放，并且收益会递减直至平台期。生产环境中的要点是设置有成本意识、按难度自适应的预算，而不是最大预算。（不要将其与测试时*训练*混淆，后者会在推理时更新模型权重；见[主题 12](#_12-测试时训练-在推理中学习)。）

- **When More Thinking Hurts: Overthinking in LLM Test-Time Compute Scaling**（[arXiv:2604.10739](https://arxiv.org/abs/2604.10739)）展示了超过临界 token 阈值后的反向缩放，并提出了有成本意识的停止策略。对于任何交付推理模型的人来说，这是最具可操作性的单一发现。
- **Test-Time Scaling Is Not Effective for Knowledge-Intensive Tasks Yet**（[arXiv:2509.06861](https://arxiv.org/abs/2509.06861)，趋势中）从信息论角度论证，仅靠计算无法超越模型中已有的知识，并且扩展推理可能会放大自信的幻觉。
- **Scaling over Scaling: Test-Time Scaling Plateau**（[arXiv:2505.20522](https://arxiv.org/abs/2505.20522)，趋势中）以闭式形式说明收益在何处变平。
- **SelfBudgeter**（[arXiv:2505.11274](https://arxiv.org/abs/2505.11274)）和 **AdaCtrl**（[arXiv:2505.18822](https://arxiv.org/abs/2505.18822)）让模型预测或暴露一个可控的 token 预算，这是实际可用的调节旋钮。

**连接位置：** [上下文工程：扩展思考](05-prompting-and-context/05-context-engineering.md)、[成本优化](04-inference-optimization/07-cost-optimization-playbook.md)。

## 3. RL 后训练：它实际做了什么

**为什么重要：** 是否投入 RL（强化学习）后训练，取决于一个存在争议的经验问题：带可验证奖励的 RL（RLVR，Reinforcement Learning with Verifiable Rewards）是在增加新能力，还是只是更精准地采样基础模型已经会做的东西？答案决定了什么时候 RL 值得其成本，而不是采用监督微调或蒸馏。

- **pass@k 争论**：“RLVR 的极限”立场（[limit-of-rlvr.github.io](https://limit-of-rlvr.github.io/)）认为 RL 提升了 pass@1，但基础模型在高 pass@k 下能追平它，因此 RL 是在打磨而非增加能力；反方观点（[arXiv:2506.14245](https://arxiv.org/abs/2506.14245)）认为，在正确指标下，RLVR 会奖励正确推理并拓展能力边界。综合研究（[arXiv:2512.07783](https://arxiv.org/pdf/2512.07783)）发现，只有当任务在预训练中覆盖不足，且 RL 数据位于模型能力边缘时，RL 才主要带来真正收益，这也推动了一个独立的 **mid-training（中期训练）** 阶段。
- **On-policy distillation（同策略蒸馏）**（[Thinking Machines Lab](https://thinkingmachines.ai/blog/on-policy-distillation/)；配方和失败模式见 [arXiv:2604.13016](https://arxiv.org/html/2604.13016v1)）使用学生模型自己的 rollout（轨迹）并由教师模型评分来训练学生，据报告在向小模型灌输推理能力方面，样本效率约为 RL 的 10 倍。这正在成为构建廉价推理模型的新默认方案。
- **会思考的过程奖励模型（ThinkPRM）**（[arXiv:2504.16828](https://arxiv.org/abs/2504.16828)，热门趋势）通过编写验证 chain-of-thought（CoT，思维链），而不是训练判别式评分器，使步骤级验证变得可负担。

**关联内容：** [RLHF 和 DPO](03-training-and-adaptation/04-rlhf-and-dpo.md)、[知识蒸馏](03-training-and-adaptation/05-knowledge-distillation.md)。

---

## 4. 潜在推理与替代推理

**为什么重要：** Chain-of-thought（思维链）通过消耗 token 来思考。越来越多的研究路线在 latent space（潜在空间）中推理，例如 recurrent depth（循环深度），或通过 diffusion（扩散）进行推理，从而打开了一条不消耗输出 token 的新计算轴。即使它还不是你的默认方案，也值得跟踪，因为它会改变推理的延迟和成本模型。

- **潜在 / 循环深度推理**：典型架构通过将循环块展开到任意深度来扩展测试时计算（[Huginn, arXiv:2502.05171](https://arxiv.org/pdf/2502.05171)）；looped language models（循环语言模型）正在与主流开放模型竞争（[Ouro, arXiv:2510.25741](https://arxiv.org/html/2510.25741v2)）；一个 2026 结果稳定了循环，使深度扩展不再崩塌（[arXiv:2605.26733](https://arxiv.org/abs/2605.26733)）。
- **用于推理的 diffusion LLM（扩散式大语言模型）** 正在成熟为一条可行的快速推理路径：通过 product-of-experts（专家乘积）桥接实现并行解码，在恢复大部分自回归准确率的同时报告了大幅加速（[arXiv:2606.08048](https://arxiv.org/abs/2606.08048)），随后还出现了用于 diffusion-LLM 推理的 RL 配方（[arXiv:2606.08501](https://arxiv.org/abs/2606.08501)）。
- **CoT 忠实性注意事项**：可见的 chain-of-thought 可能并不反映真实计算（[arXiv:2603.26410](https://arxiv.org/pdf/2603.26410)），当你依赖 CoT 进行调试或监控时，这一点很重要（见主题 8）。

**关联内容：** [Chain-of-Thought（思维链）](05-prompting-and-context/03-chain-of-thought.md)、[推理基础](04-inference-optimization/01-inference-fundamentals.md)。

---

## 5. 高效长上下文架构

**为什么重要：** 低成本服务长上下文现在是一个架构决策，而不仅仅是 KV-cache（键值缓存）技巧。可训练稀疏注意力已经从研究进入已发布的前沿模型，并且是解决二次注意力成本的生产答案。

- **可训练稀疏注意力（NSA/DSA 谱系）：** Native Sparse Attention（原生稀疏注意力）（[arXiv:2502.11089](https://arxiv.org/abs/2502.11089)，基础性工作）引入了硬件对齐、原生可训练的稀疏注意力；DeepSeek 的稀疏注意力通过 lightning indexer（闪电索引器）将其产品化，使注意力随序列长度大致从二次复杂度变为线性复杂度，并催生了一波索引器论文。这是廉价长上下文背后的蓝图。
- **MoE scaling laws（混合专家扩展定律）**（[arXiv:2603.21862](https://arxiv.org/abs/2603.21862)）将任意计算预算映射到最优 mixture-of-experts（MoE，混合专家）配置，并认为 FLOPs-per-token（每 token 浮点运算量）不足以作为不同 MoE 层类型之间的公平指标。
- **潜在 / 学习式上下文压缩**：大规模预训练的 encoder-decoder（编码器-解码器）上下文压缩器（[arXiv:2606.09659](https://arxiv.org/abs/2606.09659)）让 agent（智能体）可以浏览压缩上下文，并按需展开相关片段，这是不同于 KV-cache 压缩的一层。
- **次二次混合架构**（Mamba/Transformer、linear-attention（线性注意力））在长上下文中持续匹配 Transformer，并支撑长视频和 omni（全模态）模型。

**关联内容：** [注意力机制](01-foundations/03-attention-mechanisms.md)、[KV Cache 和上下文缓存](04-inference-optimization/02-kv-cache-and-context-caching.md)、[服务基础设施](04-inference-optimization/06-serving-infrastructure.md)。

---

## 6. Agent 可靠性与失败模式

**为什么重要：** 单次演示会掩盖 agent 在规模化时的不同失败方式：错误会在多 agent 系统中级联传播，而同一个 agent 在一次通过任务后，重新运行时可能失败。可靠性是可测量的工程属性，相关基准是新的。

- **可靠性科学（pass^k）：** 可靠性基准衡量重复运行中的一致性、扰动鲁棒性和容错性；最佳情况（pass@1）与可靠（pass^k）性能之间存在巨大差距（tau2-bench 显示，在 8 次运行中，agent 从约 60% 降至约 25%）。设计和预算应面向 pass^k，而不是 pass@1。
- **多 agent 系统中的错误级联**：关于一个 agent 的错误如何放大全系统影响的传播动力学模型（[arXiv:2603.04474](https://arxiv.org/abs/2603.04474)），以及在策略违规前预警崩溃的图曲率信号（[arXiv:2603.13325](https://arxiv.org/abs/2603.13325)）。这是监控失控多 agent 运行的基础原语。
- **多 agent 计算机使用**（[arXiv:2606.01533](https://arxiv.org/abs/2606.01533)）给出了一个具体的 planner-DAG-plus-parallel-workers（规划器-DAG 加并行工作器）配方，是并行化计算机使用工作的清晰参考。
- 一条警示：在自生成 rollout 上使用 GRPO，本身并不能弥合多 agent 协调差距（[arXiv:2606.07845](https://arxiv.org/abs/2606.07845)），所以不要假设朴素 RL 能修复协调问题。

**关联内容：** [多 Agent 编排](07-agentic-systems/04-multi-agent-orchestration.md)、[错误处理与恢复](07-agentic-systems/07-error-handling-and-recovery.md)、[评估 Agentic 系统](07-agentic-systems/10-evaluating-agentic-systems.md)。

---

## 7. Agent 与记忆安全

**为什么重要：** 这是 2026 中发展最快的风险领域，其中一部分问题被证明很难。如果你发布使用工具或配备记忆的 agent，这些结果应该推动你的架构转向 least-privilege（最小权限）和 containment（隔离约束）。

- **间接提示注入尚未解决，且可能无法解决。** 一场有 464 名参与者的红队竞赛发现，全部 13 个前沿模型都会被隐蔽的间接注入攻破（[arXiv:2603.15714](https://arxiv.org/abs/2603.15714)），而 contextual-integrity（上下文完整性）的不可能性结果认为，攻击者总能构造出一个上下文，使被阻止的信息流看起来合法（[arXiv:2605.17634](https://arxiv.org/abs/2605.17634)）。结论是：从“阻止注入”转向基于能力、最小权限、隔离约束的架构。
- **记忆投毒是新的持久攻击面。** Sleeper memory poisoning（休眠记忆投毒）植入潜伏的投毒记忆，并在未来会话中重新浮现（[arXiv:2605.15338](https://arxiv.org/abs/2605.15338)）；memory control-flow attacks（记忆控制流攻击）将投毒记忆重新定义为一次写入、多次读取的控制信号，用来覆盖用户指令（[arXiv:2603.15125](https://arxiv.org/abs/2603.15125)）。OWASP 的 2026 Agentic Top 10 新增了专门的“Memory and Context Poisoning（记忆与上下文投毒）”条目（ASI06）。防御应发生在存储时的 provenance（来源追踪），而不是检索时的清洗。
- **蒸馏作为攻击：** 通过在从受保护模型蒸馏出的良性、相邻领域输出上进行微调，可以恢复有害能力（[arXiv:2601.13528](https://arxiv.org/abs/2601.13528)），这是任何暴露受保护 API 的人都需要考虑的威胁模型。

**关联内容：** [Agentic 安全与沙箱](07-agentic-systems/09-agentic-security-and-sandboxing.md)、[提示注入防御](05-prompting-and-context/08-prompt-injection-defense.md)、[LLM 安全](12-security-and-access/01-llm-security.md)、[安全与治理](17-tool-use-and-computer-agents/07-safety-and-governance.md)。

---

## 8. AI 控制与评估前沿

**为什么重要：** 两个与实践者高度相关的研究方向正在成熟。AI 控制（AI control）为部署你并不完全信任的智能体提供了具体协议。而评估（evaluation）本身也已经成为一个研究问题，因为模型能够检测并博弈评估。

- **AI 控制协议：** 在对抗性测试平台中，“为定罪而重采样”（resample-for-incrimination）加上“关键动作延后处理”（defer-on-critical-actions）将安全性从约 50% 提升到约 96%，并且关键动作延后处理即使面对了解协议的红队也很稳健（[arXiv:2511.02997](https://arxiv.org/abs/2511.02997)，热门）；分解式认知（factored cognition，即可信模型负责分解，不可信模型解决隔离子任务）强化了监控（[arXiv:2512.02157](https://arxiv.org/abs/2512.02157)）。这是一套可部署到不可信智能体上的行动手册，而大多数生产技术栈中基本缺失。
- **评估感知：** 模型常常知道自己正在被评估（[arXiv:2505.23836](https://arxiv.org/abs/2505.23836)，热门），这会混淆每一种安全性与能力评估，并说明应采用留出式、自然化的测试条件。
- **感知拒答的评分：** 关于模型为何产生幻觉的统计解释（[arXiv:2509.04664](https://arxiv.org/abs/2509.04664)）表明，奖励猜测而非“我不知道”的基准会训练出幻觉，因此评估设计应该奖励经过校准的拒答。
- **思维链可监控性**（[arXiv:2510.27378](https://arxiv.org/abs/2510.27378)；立场论文 [arXiv:2507.11473](https://arxiv.org/abs/2507.11473)）将思维链（CoT, chain-of-thought）视为一种脆弱但有价值的安全信号，值得保留，而不是在训练中抹除。
- **生产安全控制：** 能够经受分布偏移的探针现在已经随前沿模型交付（[arXiv:2601.11516](https://arxiv.org/abs/2601.11516)），分类器级联将越狱防御成本降低了约 40 倍（[arXiv:2601.04603](https://arxiv.org/abs/2601.04603)）。

**关联内容：** [LLM 评估](14-evaluation-and-observability/01-llm-evaluation.md)、[基准与排行榜](14-evaluation-and-observability/03-benchmarks-and-leaderboards.md)、[可靠性与安全性](13-reliability-and-safety/)。

---

## 9. 记忆与检索进展

**为什么重要：** 检索正在变得智能体化（模型获得检索原语，而不是固定流水线），记忆正在获得真正的工程化与安全性处理，并且该领域已经有了关于记忆系统能做什么、不能做什么的坚实新证据。

- **智能体式检索接口：** 将关键词、语义和分块读取工具暴露给模型，而不是固定的 RAG（retrieval-augmented generation，检索增强生成）工作流（[A-RAG, arXiv:2602.03442](https://arxiv.org/abs/2602.03442)）；将智能体式 RAG 系统化为 POMDP（partially observable Markov decision process，部分可观测马尔可夫决策过程）提供了结构性框架（[arXiv:2603.07379](https://arxiv.org/abs/2603.07379)）。
- **RL 训练的搜索智能体：** Search-R1 及后续方法通过检索词元掩蔽训练交错的推理与搜索，这是深度研究系统的一项基础技术，而大多数技术栈很可能尚未具备。
- **对记忆的批判性审视：** 智能体记忆剖析综述（[arXiv:2602.19320](https://arxiv.org/abs/2602.19320)）提供了现实校验，记录了当前记忆系统中的基准饱和、指标与效用错位以及延迟开销。
- **学会遗忘与巩固：** 受睡眠启发的巩固机制将主动干扰（陈旧条目覆盖当前条目）从随记忆数量线性增长降低到对数增长（[SleepGate, arXiv:2603.14517](https://arxiv.org/abs/2603.14517)），将遗忘重新定义为一个设计目标。
- **深度研究评估：** 通过受控语料将检索器与智能体隔离的基准（[BrowseComp-Plus, arXiv:2508.06600](https://arxiv.org/abs/2508.06600)）显示，检索器质量主导深度研究准确率。

**关联内容：** [智能体式 RAG](06-retrieval-systems/08-agentic-rag.md)、[记忆架构](08-memory-and-state/01-memory-architectures.md)、[长期记忆](08-memory-and-state/03-long-term-memory.md)、[RAG 评估](06-retrieval-systems/13-rag-evaluation-patterns.md)。

---

## 10. 多模态：世界模型、VLA 与 Omni

**为什么重要：** 三条前沿正在汇合：能够原生输出动作的全模态模型、可实时导航的交互式世界模型，以及用于机器人的视觉-语言-动作模型。即使你不构建机器人，这些架构模式（双系统控制、潜在动作预训练、预测式嵌入世界模型）也正在扩散到智能体中。

- **能够输出动作的全模态世界模型：** 开放模型在一个技术栈中原生理解并生成文本、图像、视频、音频和动作（[NVIDIA Cosmos 3](https://research.nvidia.com/labs/cosmos-lab/)；[Emu3.5, arXiv:2510.26583](https://arxiv.org/abs/2510.26583)，这是“原生下一状态预测产生世界模型”这一论点最清晰的表达）。
- **交互式实时世界模型**（“神经游戏引擎”）：从提示生成可实时导航的仿真（DeepMind Project Genie 3；开放蓝图见 [DreamX-World, arXiv:2606.16993](https://arxiv.org/abs/2606.16993)），同时以预测式（非生成式）JEPA 替代方案作为注重效率的对照（V-JEPA 2 及后续方法）。
- **视觉-语言-动作（VLA）：** 具身“思考”将推理与动作交错，并支持跨具身形态迁移（[Gemini Robotics 1.5, arXiv:2510.03342](https://arxiv.org/abs/2510.03342)）；双系统模式（慢速推理中的快速控制）；以及从无标注视频进行潜在动作预训练，这为机器人预训练解锁了互联网规模数据。
- **通过生成进行推理：** “用视频思考”将视频生成作为推理基底（[arXiv:2511.04570](https://arxiv.org/abs/2511.04570)），这是一种真正新的推理模态。

**关联内容：** [多模态 RAG](06-retrieval-systems/12-multimodal-rag.md)、[模型分类法](02-model-landscape/01-model-taxonomy.md)、[计算机使用智能体](17-tool-use-and-computer-agents/04-computer-use-agents.md)。

---

## 11. 更小、更便宜、更快

**为什么重要：** 成本前沿正在像能力前沿一样快速移动。前沿级推理正在小模型中出现，低比特推理正在变得感知推理，而推测解码仍在持续改进。

- **小型推理模型：** 据称，一个 3B 稠密模型通过“先多样性、再 RL（reinforcement learning，强化学习）、再蒸馏”的配方达到前沿可验证推理分数（[VibeThinker-3B, arXiv:2606.16140](https://arxiv.org/abs/2606.16140)），可部署在设备端。
- **感知推理的量化：** 4-bit 几乎无损，但 3-bit 和 2-bit 对推理的损害远大于非推理任务，而量化感知训练有所帮助（[arXiv:2601.14888](https://arxiv.org/html/2601.14888v1)）。FP4 训练（不只是推理）正在 Blackwell 级硬件上成为现实（[NVFP4 pretraining, arXiv:2509.25149](https://arxiv.org/html/2509.25149v2)）。
- **推测解码** 持续进展：流水线式草稿生成与验证（[arXiv:2603.03251](https://arxiv.org/abs/2603.03251)），以及能够从免费验证反馈中在线自适应的草稿模型（[arXiv:2603.12617](https://arxiv.org/abs/2603.12617)）。
- **多模态词元压缩** 是视觉模型服务成本的主导杠杆，压缩发生在编码期间，而不是编码之后。

**关联内容：** [量化深度解析](03-training-and-adaptation/07-quantization-deep-dive.md)、[推测解码](04-inference-optimization/03-speculative-decoding.md)、[成本优化](04-inference-optimization/07-cost-optimization-playbook.md)。

---

## 12. 测试时训练：在推理中学习

**为什么重要：** 这是本页最容易被混淆的术语，因此值得单独成节。测试时*训练*会在推理时更新模型的**权重**；测试时*计算*（主题 2）保持权重冻结，只是花费更多前向传播 token。杠杆不同，成本也不同。TTT（Test-Time Training，测试时训练）在 2026 仍处于研究阶段，但它是观察一个真实问题的最清晰视角：当冻结模型在真正新颖的任务上达到平台期时，修复方法可能不是思考更久或检索更多，而是短暂地*学习*。

**一个名称，三种思路。** 三者都在推理时基于仅在推理时可用的数据运行梯度下降；区别在于更新的对象：

- **作为架构的 TTT**（[Sun 等，arXiv:2407.04620](https://arxiv.org/abs/2407.04620)）：一种序列层，其隐藏状态本身就是一个小模型，每个 token 通过一次自监督梯度步骤更新。它是注意力的一种线性成本替代方案，当内部学习器为线性时会退化为线性注意力。论文报告称，在 Mamba 达到平台期的地方，它会随着上下文增长持续改进（在低于 1.3B 的规模）。该方法被扩展到分钟级视频生成（[arXiv:2504.05298](https://arxiv.org/abs/2504.05298)），并由 MesaNet（[arXiv:2506.05233](https://arxiv.org/abs/2506.05233)）实现了每 token 计算最优。
- **作为按任务适配的 TTT**（[Akyürek 等，arXiv:2411.07279](https://arxiv.org/abs/2411.07279)）：在测试输入及其增强样本上临时微调模型（通常是按任务的 LoRA），完成预测后丢弃更新。其核心结果是一个 8B Llama-3 在 ARC-AGI-1 公开集上达到 53.0%（61.9% 与程序合成集成，论文称其匹配平均人类表现），而单靠上下文学习会达到平台期。谱系包括最初的视觉 TTT（[arXiv:1909.13231](https://arxiv.org/abs/1909.13231)）以及在检索邻居上进行测试时训练（[Hardt 和 Sun，arXiv:2305.18466](https://arxiv.org/abs/2305.18466)）。一个相关的 RL（Reinforcement Learning，强化学习）变体 TTRL（[arXiv:2504.16084](https://arxiv.org/abs/2504.16084)）会在测试时根据多数投票伪奖励更新权重。
- **作为记忆的 TTT**（[TTT-E2E，arXiv:2512.23675](https://arxiv.org/abs/2512.23675)，由 Stanford/Berkeley/UCSD/NVIDIA/Astera 推动）：在长上下文流式到来时对模型进行训练，让上下文存在于权重中，而不是 KV cache（键值缓存）中，从而获得与长度无关的恒定延迟。坦诚的限制是：论文报告称它在超出其注意力窗口后无法完成大海捞针任务（约 6%，而完整注意力在 128K 时约为 99%），所以权重中的上下文带来的是主旨，而不是逐字回忆。记忆治理失败模式见 [Agent Memory and State](07-agentic-systems/05-agent-memory-and-state.md)。

**TTT 与测试时计算，一张表说明：**

| | 测试时训练 | 测试时计算（主题 2） |
|---|---|---|
| 改变什么 | 权重（通常是临时 LoRA） | 什么都不变；权重保持冻结 |
| 花费什么 | 推理时的反向传播 | 额外前向传播 / token |
| 看起来像 | 模型为这一个问题学习，然后忘记 | 模型思考更久并尝试更多草稿 |
| 状态 | 有状态；一次请求可以改变权重 | 无状态；输入的纯函数 |

它们可以叠加：ARC 结果将一次 TTT 权重更新与增强投票配对，后者是一种测试时计算技巧。

**什么时候有帮助，什么时候有害。** 它有助于分布偏移、上下文学习达到平台期的真正新颖任务（ARC 是代表案例），以及长上下文效率。它的坏处包括成本（服务时进行梯度步骤；实践者报告称延迟大约为 1.7-2.5 倍）、单实例过拟合、会破坏缓存和可复现性的有状态性，以及服务复杂性，因为每个请求都改变权重，这与 vLLM 风格批处理背后的冻结权重假设相冲突。还有一个真实的安全角度：由于适配损失是在攻击者可影响输入上的自监督损失，精心构造的输入可以污染测试时更新（测试时数据投毒文献目前大多集中在视觉领域）。

**成熟度（2026）：** 主要仍是研究和竞赛，不是线上服务。它最经受实战检验的场景是离线 ARC-Prize 流水线；架构和记忆变体已在 3-5B 参数规模验证，但没有公开证据表明有前沿模型在其服务路径中部署 TTT 层。与之相对，测试时*计算*已经在各处生产环境中使用。实际结论是：先使用提示、检索或普通微调，并持续关注 TTT 作为新颖任务适配和长上下文效率的前沿方向。

**它连接到哪里：** [测试时计算的边界](#_2-测试时计算的局限)（它的冻结权重同胞）、[Agent Memory and State](07-agentic-systems/05-agent-memory-and-state.md)（记忆变体）、[Fine-Tuning Strategies](03-training-and-adaptation/02-fine-tuning-strategies.md) 和 [Knowledge Distillation](03-training-and-adaptation/05-knowledge-distillation.md)（它临时借用的适配能力）。

---

## 90 天学习路径

如果你按这个顺序阅读，就能先覆盖最高杠杆的想法：

1. **第 1-2 周，上下文工程。** Anthropic 的有效上下文工程文章，然后是 AdaCoM 和“Less Context, Better Agents”研究。这会立即改善你运行的任何智能体。
2. **第 3-4 周，测试时计算边界。** “When More Thinking Hurts”和自适应预算论文。它会改变你设置思考预算和为推理定价的方式。
3. **第 5-6 周，智能体安全。** 间接注入竞赛和不可能性结果，然后是记忆投毒论文和 OWASP ASI06。它会将你的智能体架构重塑为最小权限。
4. **第 7-8 周，AI 控制和评测前沿。** 控制协议论文、评测感知以及知晓弃答的评分。它会改变你部署不可信智能体的方式，以及你信任自己评测的方式。
5. **第 9-10 周，RL 后训练争论。** pass@k 论文和 on-policy distillation（同策略蒸馏）。它会决定 RL 对你来说何时值得其成本。
6. **第 11-12 周，高效架构。** 可训练稀疏注意力和 MoE（Mixture of Experts，专家混合）缩放律，再加上推理感知量化。长上下文和推理的成本前沿。

将每个主题与相关指南章节配对，这样研究就会落在具体基础上，而不是停留在抽象层面。

---

## 这如何映射到指南

这些主题大多是在深化现有章节，而不是替代它们。如果你要扩展指南，最清晰的新章节候选是 **AI 控制协议**（基本缺失，且对智能体部署者有生产相关性）、**记忆安全和 OWASP ASI06**（一个快速发展的集群，且有专门的风险条目），以及作为一等概念的**有效上下文差距**。其余内容最适合作为“前沿（2026）”提示框加入各自所属章节，并链接回这里，这样本页可以继续作为单一雷达，而各章节仍保持可教学性。

---

*另见：[Benchmarks and Leaderboards](14-evaluation-and-observability/03-benchmarks-and-leaderboards.md)，了解如何阅读排行榜；以及 [PATTERNS.md](PATTERNS.md)，了解这些想法会流向哪些生产模式。*
