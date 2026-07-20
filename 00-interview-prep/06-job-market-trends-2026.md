# AI 就业市场趋势 - 6 月 2026

> **最后验证：2026 年 6 月 10 日。** 本章提炼了当前 AI 招聘中真实发生的情况：公司发布的岗位名称、筛选的技能、薪酬范围，以及你会遇到的面试形式。资料来源包括 100+ 公开职位、招聘报告，以及 2026 年 4 月至 6 月期间的招聘人员信号。

> **6 月 2026 日更新：** 自 5 月扫描以来出现了两个影响市场的事件。Anthropic 发布了 **Claude Fable 5**（6 月 9 日，每 1M 为 $10/$50），将 Mythos 级能力推向全面可用，并带有 Opus 4.8 回退保护；预计会出现一波能力上限型产品工作，以及随之而来的评估、安全和路由相关岗位。DeepSeek 将其 **75% V4 Pro 折扣永久化**（5 月 22 日），加速了成本工程招聘趋势：能够利用模型层级之间 70 倍价格差的候选人在筛选中表现良好。下方薪酬行来自 5 月 17 日扫描；在这些事件影响的细分领域中，应将其视为下限。

本章面向规划下一步职业发展的工程师、构建评估标准的招聘经理，以及做组织设计决策的工程领导者。它补充了 [TRANSITION_GUIDE.md](../TRANSITION_GUIDE.md)（如何转型进入 AI 岗位）和[题库](01-question-bank.md)（该学习什么）。

---

## 目录

- [三大核心变化](#三大核心变化)
- [2026 年的岗位分类](#_2026-年的岗位分类)
- [按职业阶段划分的技能](#按职业级别划分的技能)
- [职位描述实际要求什么](#招聘信息实际要求什么)
- [薪酬现实](#薪酬现实)
- [地域与行业分布](#地理与行业分布)
- [面试流程模式](#面试流程模式)
- [值得关注的新兴岗位](#值得关注的新兴岗位)
- [战略要点](#战略要点)
- [参考资料](#参考资料)

---

## 三大核心变化

如果你只读一部分，请记住这三点。

### 1. 市场呈现冷热并存的矛盾状态。

2026 年第一季度出现了约 52,050 个科技岗位裁员（Oracle 30K、Amazon、Meta、Dell），是自 2023 年以来裁员最多的第一季度（[Kore1](https://www.kore1.com/tech-layoffs-2026/)；[Tom's Hardware](https://www.tomshardware.com/tech-industry/tech-industry-lays-off-nearly-80-000-employees-in-the-first-quarter-of-2026-almost-50-percent-of-affected-positions-cut-due-to-ai)）。与此同时，AI 岗位环比增长 +8.9%、同比增长 +4.8%，约有 275,000 个 AI 岗位空缺（[Allwork.space](https://allwork.space/2026/05/ai-hiring-is-rising-even-as-tech-layoffs-surge-140/)）。初级/入门级工程师受到的冲击最大，常规代码生成、QA 测试、基础前端工作被裁减的比例更高。高级和专业化 AI 岗位则保持韧性。

**含义：** 在 2026 年，“科技招聘”和“AI 招聘”不是同一个故事。如果你的职业定位是通用型中级软件工程师，你会感受到冷市场。如果你是高级 AI 专业人才，你正处在卖方市场。

### 2. 岗位名称正在收缩；工作内容正在分化。

大多数公司现在把“AI Engineer（AI 工程师）”作为总括性岗位名称，但在岗位内部，你会很快细分到 RAG（检索增强生成）、Agent（智能体）、Eval（评估）、Fine-tuning（微调）或平台工作。["大多数 AI 职位名称将在未来 18 个月内收缩为 ‘AI Engineer’；高声望标签只会在前沿实验室中保留"](https://www.ivanturkovic.com/2026/04/24/ai-job-titles-2026-naming-chaos/)。“Prompt Engineer（提示词工程师）”这一独立岗位名称已经基本从主流招聘网站上消失，技能保留了下来，但岗位名称没有（[PE Collective](https://pecollective.com/blog/is-prompt-engineering-a-real-career/)；[Medium - 提示词工程已死 2026](https://medium.com/write-a-catalyst/prompt-engineering-is-dead-2026-ai-systems-engineering-7acdbbcb2160)）。

**含义：** 如果你还在招聘“Prompt Engineer”，你已经落后 18 个月。请定义真实问题（评估严谨性？智能体调试？面向客户的调优？），并针对该具体岗位招聘。

### 3. Forward Deployed Engineer（前线部署工程师）是 2026 年爆发的岗位。

在 2025 年中期，FDE 还不是前沿实验室中的独立类别。到 2026 年 5 月，OpenAI、Anthropic 和 Google 都在招聘数百个相关岗位。Google/Box CEO 公开称其为“科技行业最紧缺的岗位”（[Fast Company](https://www.fastcompany.com/91541878/google-box-ceos-say-this-is-the-most-in-demand-job-in-tech)；[Hashnode FDE 指南](https://hashnode.com/blog/a-complete-2026-guide-to-the-forward-deployed-engineer)）。总薪酬在中高级岗位稳定在 $350-550K。

**含义：** 前沿 AI 买家（财富 500 强、政府、生物技术）要求现场工程支持作为合同交付物。FDE 这个岗位之所以存在，是因为买方重视它，而不是因为它是交付软件的最高效方式。

---

## 2026 年的岗位分类

### 成熟岗位名称（仍在强劲招聘）

| 岗位名称 | 描述 | 发布位置 |
|-------|-------------|-------------------|
| **AI Engineer（AI 工程师）** | 事实上的通用 AI 岗位名称。其他岗位名称正在向它收缩。 | 普遍存在，出现在大多数职位中 |
| **LLM Engineer（大语言模型工程师）** | 聚焦 Transformer 微调、RAG、智能体。不同于 ML Engineer。 | 中大型公司；[iSmart LLM JD 2026](https://www.ismartrecruit.com/job-descriptions/llm-engineer) |
| **ML Engineer / ML+AI Software Engineer（机器学习工程师 / ML+AI 软件工程师）** | 经典的训练与部署岗位。 | [levels.fyi ML/AI 方向](https://www.levels.fyi/t/software-engineer/focus/ml-ai) |
| **Applied AI Engineer（应用 AI 工程师）** | 前沿实验室中嵌入客户场景的变体。 | [Anthropic Applied AI](https://job-boards.greenhouse.io/anthropic/jobs/5116274008) |
| **Member of Technical Staff (MTS)（技术成员）** | 有意保持模糊的岗位名称，模糊研究与工程之间的边界。 | OpenAI、Anthropic、Thinking Machines、Mistral（[Scout AI 关于 MTS](https://scoutnow.ai/blog/rebirth-member-of-technical-staff)） |
| **AI Research Engineer / Research Scientist（AI 研究工程师 / 研究科学家）** | 仅限前沿实验室；偏好博士。 | [Sundeep Teki - AI Research Eng 2026](https://www.sundeepteki.org/advice/the-ultimate-ai-research-engineer-interview-guide-cracking-openai-anthropic-google-deepmind-top-ai-labs) |
| **AI Solutions Architect（AI 解决方案架构师）** | 在企业市场中需求很重。 | EY、Caterpillar、Deloitte（[EY 职位](https://careers.ey.com/ey/job/Amsterdam-AI-Solution-Architect-1083-HP/1258705801/)） |
| **AI Platform Engineer（AI 平台工程师）** | 负责内部 LLM-ops（大语言模型运维）平台。 | [Augment Code 规格 2026](https://www.augmentcode.com/guides/ai-platform-engineering-leader-job-spec) |
| **AI Engineering Manager（AI 工程经理）** | 单一岗位中薪酬最高；中位数 $293.5K（[AI Pulse 基准](https://theaimarketpulse.com/salaries/)）。 | 规模化创业公司及以上普遍存在 |
| **AI Product Manager（AI 产品经理）** | 几乎每个 B2B SaaS 都需要。 | 普遍存在（[Aakash Gupta](https://www.aakashg.com/product-manager-requirements/)） |
| **AI Technical Program Manager (TPM)（AI 技术项目经理）** | 专业方向包括：“Responsible AI TPM（负责任 AI 技术项目经理）”、“AI Infrastructure TPM（AI 基础设施技术项目经理）”、“GenAI Customer Performance TPM（生成式 AI 客户性能技术项目经理）” | Microsoft、AMD、Together AI |

### 2025 年以来的新岗位名称

| 岗位名称 | 出现原因 | 发布位置 |
|-------|----------------|-------------------|
| **Forward Deployed Engineer (FDE)（前线部署工程师）** | 前沿 AI 买家要求现场工程作为交付物。 | OpenAI、Anthropic、Google（[Anthropic FDE](https://job-boards.greenhouse.io/anthropic/jobs/4985877008)） |
| **AI Evaluation Engineer（AI 评估工程师）** | 评估工作成熟为一门独立学科。 | OpenAI（[Applied Evals](https://openai.com/careers/software-engineer-applied-evals-san-francisco/)、[Frontier Evals](https://openai.com/careers/research-engineer-frontier-evals-and-environments-san-francisco/)）、Apple、Scale AI、Distyl、Apex |
| **Agentic Systems Engineer / AI Agent Engineer（智能体系统工程师 / AI 智能体工程师）** | 智能体成为自身独立的工程工作面。 | Teradata、GE Vernova、Deloitte、OpenAI（[Agent Infrastructure SWE](https://openai.com/careers/software-engineer-agent-infrastructure-san-francisco/)） |
| **AI Reliability Engineer（AI 可靠性工程师）** | 生产级 AI 需要类似 SRE（站点可靠性工程）的纪律；不同于传统 SRE。 | Anthropic（[Staff/Sr AI Reliability](https://www.anthropic.com/jobs)）；AI SRE 作为一个类别正在由 Resolve.ai、Rootly 定义。 |
| **AI Security Engineer / LLM Red Team Specialist（AI 安全工程师 / 大语言模型红队专家）** | 提示注入防御和越狱研究成为一门学科。 | Life360（[Principal AI Security Engineer](https://www.remoterocketship.com/us/company/life360/jobs/principal-ai-security-engineer-ai-native-platform-united-states-remote/)）；[Practical DevSecOps](https://www.practical-devsecops.com/emerging-ai-security-roles/) 枚举了 10 个新兴 AI 安全岗位。 |
| **MCP Engineer / MCP Software Engineer（MCP 工程师 / MCP 软件工程师）** | MCP 采用使服务器开发成为自身专业方向。 | Descope（[MCP SWE](https://careers.descope.com/p/fe57f6224769-mcp-model-context-protocol-software-engineer)） |
| **AI Operator / Computer-Use Specialist（AI 操作员 / 计算机使用专家）** | 与 OpenAI Operator 和 Claude Cowork 相关。 | $75-120K 专家层级（[Coasty](https://coasty.ai/blog/best-computer-use-platform-2026-20260402)） |

### 正在消失或整合的角色

- **提示词工程师（独立岗位）：** 头衔正在消亡。技能仍然是基本要求。
- **蒸馏工程师：** 在微调/推理工程师招聘中以一种*职责*出现，而不是作为被广泛发布的独立岗位需求。

---

## 按职业级别划分的技能

### L4-L5（中级个人贡献者，3-5 年）

- Python 生产级熟练度 - **AI 职位发布中的 71%**（[Second Talent](https://www.secondtalent.com/resources/most-in-demand-ai-engineering-skills-and-salary-ranges/)）
- 至少熟悉一个主流 LLM（大语言模型）提供商 SDK（OpenAI、Anthropic、Bedrock）和一个编排框架 - 最常见的是 LangChain/LangGraph（智能体 AI 职位发布中的 34.3%；[Agentic Engineering Jobs](https://agentic-engineering-jobs.com/langchain-job-market-2026)）
- 向量数据库基础：Pinecone、Weaviate、pgvector - 具体工具经验可在数周内学会；概念理解最重要
- RAG（检索增强生成）：分块、混合搜索、BM25、重排序、检索评估
- 容器化：Docker（15.4%）、Kubernetes（17.6%）
- 云：AWS（32.9%）、Azure（26%）

### L6-L7（高级 / Staff）

- 端到端交付过生产级 LLM 系统 - “交付真实系统的行业经验比学术资历更能说明问题”
- 跨向量索引、GPU 内存、智能体状态的多租户隔离
- 评估框架（LangSmith / Langfuse / Braintrust）；由评估门禁控制的 CI/CD
- 微调 / LoRA / QLoRA / RLHF（基于人类反馈的强化学习）
- 成本优化 - token 预算、模型路由、缓存
- “将 LLM、向量存储和 RAG 作为标准系统设计的一部分来推理，而不是当作小众专业领域”（[Design Gurus](https://designgurus.substack.com/p/system-design-interviews-changed)）

### L8+（Principal / 领导型个人贡献者）

- 负责服务所有工程团队的智能体编排层、模型路由、LLMOps 平台
- 非确定性系统的运行时治理
- 为 SOC 2 / HIPAA / 欧盟 AI 法案合规进行架构设计 - 根据 AI 法案第 27 条触发 DPIA + FRIA
- “定义技术愿景并扩展工程团队，比单纯的编码能力更重要”

### 管理路线（工程经理 / 总监）

- AI 工程经理中位数 $293.5K - 单一角色中薪酬最高（[AI Pulse](https://theaimarketpulse.com/salaries/)）
- 招聘评分标准现在重视：“你能否把这个人放进一个有 PM 和初级工程师的房间，让他们推动技术方向且不把事情搞乱” - 受访的 7 名招聘经理中有 5 这样认为（[Design Gurus](https://designgurus.substack.com/p/system-design-interviews-changed)）
- 前沿实验室高度重视使命一致性和安全判断（[Anthropic 工程经理指南](https://www.gethireready.com/interview-guides/engineering-manager-anthropic)）

### PM 路线（AI 产品经理 / AI 技术项目经理）

- “AI 是新的基线，而不是加分技能”
- 4+ 年 PM 经验，理想情况下有 B2B SaaS 或 AI 驱动产品经验
- 关键点：“高级 AI PM 候选人中，技术流畅度 + 产品严谨性达标的少于 4 人中的 1 人”（[Aakash Gupta](https://www.aakashg.com/product-manager-requirements/)）
- “能够展示可运行原型的候选人，优于只能描述原型的候选人”

---

## 招聘信息实际要求什么

### 必备项（在 100+ 个职位发布中被列为必需）

- Python 生产代码，3+ 年经验
- LLM API 集成（OpenAI / Anthropic / Bedrock）
- RAG 流水线经验，包括向量数据库、分块、检索评估
- 生产级可观测性和评估流水线
- 云 + Kubernetes + IaC（基础设施即代码）
- 智能体调试 / 多步骤工作流追踪
- 面向安全敏感角色的提示词注入 / 越狱防护

### 加分项（明确列为“plus”或“bonus”）

- 论文发表或 OSS（开源软件）贡献；对应用型岗位而言，3-5 个项目的可运行作品集胜过一篇论文
- CUDA / GPU 级优化 - 在 NVIDIA/前沿实验室是必备项，在其他地方是加分项
- 蒸馏 / 模型压缩
- 分布式推理经验
- 用于遗留企业集成的 Java/C++
- 超出 RLHF 范围的强化学习

### 招聘信息中的热门技术栈（2026 年 5 月）

按出现频率排序：

1. **Python** - 所有 AI 职位发布中的 71%
2. **PyTorch / JAX** - 前沿实验室的通用要求
3. **LangChain / LangGraph** - 智能体职位发布中的 34.3%，排名第 1 的框架
4. **LlamaIndex** - 在 LangChain 招聘信息中的共现率为 38%
5. **AWS（32.9%）/ Azure（26%）/ GCP / Vertex / Bedrock**
6. **Kubernetes（17.6%）+ Docker（15.4%）**
7. **向量数据库：** Pinecone、Weaviate、Qdrant、Chroma、pgvector
8. **MCP（模型上下文协议）** - 现在是前沿团队的[“基础要求”](https://medium.com/@adnanmasood/the-rise-of-model-context-protocol-mcp-skills-5f0d6a1c3579)
9. **可观测性：** LangSmith、Langfuse、Braintrust、Arize
10. **推理引擎：** vLLM、SGLang、TensorRT-LLM
11. **Terraform / Helm / Ray / Kubeflow / MLflow / Feast** - 内部平台技术栈
12. **提供商 SDK：** OpenAI Agents SDK、Claude SDK、Vercel AI SDK、Mastra、Pydantic AI

### 按公司层级划分

- **前沿实验室**（Anthropic、OpenAI、xAI）：PyTorch/JAX、vLLM/自定义推理、内部评估、MCP 服务器、CUDA/GPU 级优化
- **成长型公司**（Cursor、Harvey、Sierra、Decagon、Glean、Perplexity）：TypeScript + Python 混合、LangGraph / OpenAI Agents SDK、Pinecone/pgvector、LangSmith/Braintrust 评估
- **企业**（Deloitte、EY、Caterpillar、Citi）：偏重 Azure、Bedrock、LangChain，关注治理/MLOps 和本地部署能力

### 非技术要求

- **沟通 / 跨职能协作** - 高级及以上岗位的基本要求
- **面向客户的能力** - 对 FDE（现场部署工程师）角色至关重要；Anthropic 要求 3+ 年“技术性、面向客户角色”经验
- **OSS 贡献** - Anthropic 明确表示：[“如果你做过有趣的独立研究、写过有洞察力的博客文章，或对开源软件做出过实质性贡献，请把它放在简历最顶部”](https://www.sundeepteki.org/advice/how-to-get-hired-at-openai-anthropic-and-google-deepmind-in-2026)
- **论文发表** - AI 研究工程师需要；Anthropic 技术员工中只有约 50% 拥有博士学位
- **使命一致性** - Anthropic 明确通过行为与价值观面试轮进行筛选
- **监管经验：** 面向企业的 SOC 2 / HIPAA / FedRAMP；面向欧盟业务的欧盟 AI 法案熟悉度（FRIA/DPIA）
- **安全许可** - Lockheed 和联邦相关角色需要

---

## 薪酬现实

> 仅使用公开来源范围。请用 [levels.fyi](https://www.levels.fyi/) 验证当前数据。除非另有说明，所有数字均为美元。

| 层级 / 公司 | 级别 | 总薪酬 |
|---|---|---|
| **Anthropic（旧金山）** | 高级 SWE | $316K 基本工资 / $563K 总薪酬 |
| **Anthropic（旧金山）** | Lead SWE | $332K 基本工资 / $785K 总薪酬 |
| **OpenAI（旧金山）** | 所有 SWE | $251K – $1.28M+ 总薪酬 |
| **OpenAI（旧金山）** | L5 SWE | $336K 基本工资 + $774K 股票 = $1.15M 总薪酬 |
| **OpenAI MTS / 研究科学家** | - | $245K – $685K 基本工资 |
| **Cursor（Anysphere）** | SWE | $850K – $1.28M 总薪酬 |
| **Sierra** | SWE | $200K – $460K 总薪酬；中位数 $450K |
| **Thinking Machines Lab** | 所有工程师 | $450K – $500K 基本工资（Q1 H-1B 申报） |
| Google AI 工程师 | L3-L6 | $183K – $583K 总薪酬；中位数 $280K |
| Microsoft AI 工程师 | 所有 | $238K – $355K+ 总薪酬；中位数 $282K |
| **美国全国 AI 工程师** | 入门（0-2 年） | $90-135K 基本工资 / $110-160K 总薪酬 |
| **美国全国 AI 工程师** | 中级（3-5 年） | $140-210K 基本工资 / $170-260K 总薪酬 |
| **美国全国 AI 工程师** | 高级（6-9 年） | $180-280K 基本工资 / $220-350K+ 总薪酬 |
| **美国全国 AI 工程师** | Staff/Principal（10+ 年） | $250-400K+ 基本工资 / $350-600K+ 总薪酬 |
| RAG 高级工程师 | - | $195-290K 基本工资；前沿公司 $400K+ 总薪酬 |
| LLM 微调专家 | - | $195K-$350K |
| AI 安全工程师 | - | $152-210K |
| LLM 红队专家 | - | $160-230K |
| **AI 工程经理** | - | $293.5K 中位数（单一角色中薪酬最高） |
| AI 产品经理 | - | $141K – $250K（中位数 $159K） |
| **智能体 AI 架构师** | - | $260K – $420K 基本工资 |
| AI 评估工程师 | - | 公开职位发布太少，无法形成稳定范围；公司通常按高级 SWE 薪酬带定级。使用美国全国高级行作为锚点。 |
| MCP / 集成工程师 | - | 新头衔，公开数据稀少；通常按高级平台工程定级。锚定高级 SWE 薪酬带。 |
| 伦敦（量化基金 / FAANG） | 高级 ML | £140-180K 基本工资；£200K+ 总薪酬 |
| 伦敦（Google DeepMind） | 高级 | £110-155K 基本工资 + RSU |
| 柏林 / 德国 | 高级 | €95-130K |
| **班加罗尔（顶级 GCC / AI 优先）** | 高级 | ₹1-2 Cr 总薪酬 |
| 班加罗尔（应届博士 / 顶级硕士） | 入门 | ₹22-32 LPA |
| 新加坡 | 平均 | S$221,200 |
| 新加坡（Principal/Lead） | 10+ 年 | S$323,505 |

**来源：** [levels.fyi Anthropic](https://www.levels.fyi/companies/anthropic/salaries/software-engineer)、[OpenAI](https://www.levels.fyi/companies/openai/salaries/software-engineer)、[Cursor](https://www.levels.fyi/companies/cursor/salaries/software-engineer)、[Sierra](https://www.levels.fyi/companies/sierra/salaries/software-engineer)、[Pin AI 薪酬指南 2026](https://www.pin.com/blog/ai-compensation-salary-guide/)、[Kore1 薪资指南](https://www.kore1.com/ai-engineer-salary-guide/)、[AI Pulse 基准](https://theaimarketpulse.com/salaries/)、[Career Check 伦敦 2026](https://www.careercheck.io/blog/ml-engineer-salary-london-2026)、[Zen van Riel 欧洲](https://zenvanriel.com/job/ai-engineer-salary-europe/)、[Scaler 印度](https://www.scaler.com/topics/ai-ml-engineer-salary-complete-guide/)。

### 薪酬洞察

前沿实验室 MTS（Member of Technical Staff，技术员工）薪酬（Anthropic/OpenAI 中位数约 $600-795K）与企业 AI 工程岗位（中级约 $170-260K）之间的差距是 **3-5 倍**。选择公司层级时要心里有数。

---

## 地理与行业分布

- **集中度：** 65%+ 的 AI 工程师位于旧金山 + 纽约
- **双层市场：** Indeed Hiring Lab 报告称，约 95% 的招聘公司尚未发布过 AI 岗位，采用主要集中在最大型企业中（[Indeed Hiring Lab 2026 年 1 月](https://www.hiringlab.org/2026/01/16/ai-adoption-accelerating-still-concentrated-among-largest-firms/)）
- **企业采用：** 截至 2026 年第一季度，72% 的企业至少有一个 AI 工作负载投入生产（[Medha Cloud](https://medhacloud.com/blog/ai-adoption-statistics-2026)）
- **咨询热潮：** BCG 报告称，$14.4B 2025 收入中的 25%（$3.6B）来自 AI 咨询（[Metaintro BCG](https://www.metaintro.com/blog/bcg-25-percent-ai-revenue-consulting-jobs-2026)）
- **国际招聘同比增长 82%**；67% 的公司提供搬迁套餐
- **远程友好：** LangChain 生态中 35.2% 为远程，48.4% 为混合办公，16.4% 严格现场办公
- **Indeed AI Tracker：** 2025 年 12 月占所有职位发布的 4.2%，在整体招聘疲软中保持增长

---

## 面试流程模式

AI 原生公司的 2026 年 5 月标准：

1. **招聘人员筛选**（30 分钟）- 文化/使命 + 薪酬 + 签证
2. **技术电话面试**（60-90 分钟）- 实用编码，偏生产风格
3. **带回家作业**（48 小时 - 3 天）- LangChain、Mistral、Eightfold 常见；构建一个小型 RAG（Retrieval-Augmented Generation，检索增强生成）/智能体系统。[“考察的不是你能否构建，而是如何构建：代码质量、评估、错误处理”](https://github.com/alexeygrigorev/ai-engineering-field-guide/blob/main/interview/01-interview-process.md)
4. **现场/虚拟循环面试**（4-6 小时）：编码轮 + AI 系统设计 + 项目深挖 + 行为面试。[“纯白板轮基本已经消失，即使 Google 的形式现在也是协作式的”](https://designgurus.substack.com/p/system-design-interviews-changed)
5. **招聘经理 / 价值观轮** - Anthropic 明确设置

### AI 岗位特定内容

- **系统设计轮** 现在会期待 LLM（Large Language Model，大语言模型）基础设施、GPU 调度、向量存储、RAG、评估门控 CI、成本/延迟权衡
- **AI 辅助编码轮** 在 Meta、Canva、Google、Microsoft、Sierra、Cursor 明确允许使用 AI 工具（Cursor、Copilot、Claude）- 评估提示词能力和输出验证能力
- **带回家作业透明度：** 添加一份“AI 审计说明”，说明你用 AI 做了什么、你改了什么、为什么改。透明胜过隐瞒
- **Sierra：** 仅限在旧金山或纽约办公室现场；“计划 + 构建 + 展示”2 小时智能体评估，不设算法轮
- **Cursor：** 8 小时带回家作业，使用其自家产品，文档有限并配有 Slack 频道；评估产品感、自主性、系统设计
- **Anthropic：** “听起来像是前一晚写出来的答案是一个负面信号”

### 前沿实验室特定内容

- **Anthropic：** 90 分钟、4 级逐步加难的编码题，测试你是否能写出干净、模块化、可吸收新需求的代码。明确设置价值观轮。
- **OpenAI：** “设计 OpenAI Playground” - 线框图 + API + 用于线程/消息历史的数据库模式；多租户安全云 IDE
- **Mistral（巴黎）：** 5 轮流程，不支持远程，包含专门的“LLM 理论”阶段，覆盖 Transformer 内部机制和对齐

---

## 值得关注的新兴岗位

这些岗位在 2026 年 5 月增长最快；如果你在规划 12 个月的职业轨迹，可以押注这些方向。

### 前线部署工程师（FDE）
- **原因：** 前沿 AI 买家（财富 500 强、政府、生物技术）要求将现场工程作为合同交付项
- **薪酬：** 前沿实验室中高级岗位 $350-550K
- **技能：** RAG、微调、蒸馏、MCP、面向客户沟通、客户现场评估
- **去处：** OpenAI、Anthropic、Google、ElevenLabs、Cohere、Mistral、扩张期公司

### AI 评估工程师
- **原因：** 评估已成熟为一门学科；生产环境需要评估门控的 CI/CD
- **薪酬：** 承包商 $100-110/小时；前沿实验室全职 $200-400K
- **技能：** LLM-as-judge（大语言模型裁判）校准、错误分析方法论、统计校正、数据集策划、回归检测
- **去处：** OpenAI（Applied Evals、Frontier Evals）、Apple、Scale AI、Distyl、Apex

### 智能体系统工程师
- **原因：** 多智能体和工具使用已成为一流的系统工程问题
- **薪酬：** 典型 $84-250K；Agentic AI（智能体式 AI）架构师 $260-420K
- **技能：** LangGraph / 多智能体编排、MCP、A2A 协议、智能体调试、工具设计、沙箱安全
- **去处：** Teradata、GE Vernova、Deloitte、OpenAI（Agent Infrastructure）

### AI 可靠性工程师
- **原因：** 生产 AI 需要类似 SRE（Site Reliability Engineering，站点可靠性工程）的纪律来应对非确定性系统
- **薪酬：** 前沿实验室高级岗位 $250-400K（Anthropic 发布 Staff/Sr 岗位）
- **技能：** AI 智能体事件响应、失控循环遏制、成本异常检测、多供应商回退
- **去处：** Anthropic；“AI SRE”类别正在由 Resolve.ai、Rootly 定义

### AI 安全工程师 / LLM 红队专家
- **原因：** 在 2026 年 5 月 AI 安全拐点之后，提示注入 + 越狱研究成为独立学科（Mythos 披露、Daybreak、MDASH、首个野外发现的 AI 构建零日漏洞）
- **薪酬：** $152-230K，取决于专业方向
- **技能：** 间接提示注入防御、越狱研究、宪法式分类器、模型供应链信任、MCP 威胁建模
- **去处：** Life360、前沿实验室、重视安全的企业

### MCP 工程师
- **原因：** MCP 生态成熟，使服务器开发成为独立专长
- **技能：** MCP 服务器设计（HTTP/STDIO）、OAuth 资源服务器模式、智能体卡片签名、MCP 安全
- **去处：** Descope、与 Anthropic 对齐的扩张期公司、财富 500 强企业的内部平台

---

## 战略要点

对于规划下一步的**工程师**：

1. **把自己定位为专家，而不是“提示词工程师”。** 选择一个学科（评估、智能体、RAG、FDE、MLOps）并建立深度。
2. **能运行的作品集 > 论文。** 交付 3-5 个具备生产级质量的项目，包含评估和可观测性。Anthropic、OpenAI 和扩张期公司在应用岗位上都更看重这一点，而不是发表论文。
3. **FDE 是高杠杆岗位。** 如果你能把技术深度与面向客户的沟通结合起来，前沿实验室的 FDE 薪酬是除独角兽公司创始人/Staff 股权之外的市场顶端。
4. **市场正在分化。** 通才型中级 SWE（Software Engineer，软件工程师）工作正在被削减。高级 AI 专家处于卖方市场。相应地规划你的轨迹。

对于构建评估标准的**招聘经理**：

1. **为具体问题招聘，而不是为“AI 工程师”招聘。** 如果你写一份泛泛的 AI 工程师 JD（Job Description，职位描述），你会得到泛泛的候选人。
2. **先评估已交付系统。** 一个模拟你真实工作负载的带回家作业（为我们的领域构建一个小型 RAG 智能体）比算法谜题更有预测性。
3. **AI 辅助编码轮现在已成标准。** 观察候选人如何提示 + 验证模型输出，比禁止使用 AI 更有信息量。
4. **薪酬分级很重要。** 前沿实验室薪酬正在给低 2 个层级带来留才压力。如果你是招聘 AI 人才的企业，应按本地市场再加 15-25% 的高级及以上 AI 溢价进行校准。

对于做组织设计的**工程领导者**：

1. **按工作映射角色，而不是按头衔映射。** “AI 工程师”是你的总括类别。其内部要命名明确的专业方向（RAG 负责人、智能体负责人、评估负责人、平台负责人）。
2. **评估工程师是真实岗位。** 不要让功能工程师负责他们正试图改进的指标。将度量与交付分离。
3. **FDE 只有在客户 ARR（Annual Recurring Revenue，年度经常性收入）超过约 $500K 时才划算。** 低于该水平，使用解决方案工程。高于该水平，FDE 通过文档无法泛化的客户特定工程创造与其薪酬相匹配的价值。
4. **AI 可靠性工程师是你还不知道自己需要的角色。** 当你的第一个智能体在凌晨 3 点陷入循环，并在循环保护触发前烧掉 $50K 的 API 支出时，你会希望自己早在 6 个月前就拥有这个角色。

---

## 参考资料

本章内容来源于截至 17 月 2026 日的 100+ 公开招聘信息、招聘报告和招聘人员信号。主要来源：

### 招聘市场报告
- [Ivan Turkovic - AI（人工智能）职位名称 2026：CTO（首席技术官）的命名混乱指南](https://www.ivanturkovic.com/2026/04/24/ai-job-titles-2026-naming-chaos/)
- [Kore1 - AI Engineer（人工智能工程师）薪资指南 2026](https://www.kore1.com/ai-engineer-salary-guide/)
- [Kore1 - 科技行业裁员 Q1 2026](https://www.kore1.com/tech-layoffs-2026/)
- [Pin - AI（人工智能）薪酬基准 2026](https://www.pin.com/blog/ai-compensation-salary-guide/)
- [Allwork.space - AI（人工智能）招聘增长与裁员对比](https://allwork.space/2026/05/ai-hiring-is-rising-even-as-tech-layoffs-surge-140/)
- [Tom's Hardware - Q1 2026 裁员](https://www.tomshardware.com/tech-industry/tech-industry-lays-off-nearly-80-000-employees-in-the-first-quarter-of-2026-almost-50-percent-of-affected-positions-cut-due-to-ai)
- [Indeed Hiring Lab - 2026 年 1 月招聘信息中的 AI（人工智能）](https://www.hiringlab.org/2026/01/22/january-labor-market-update-jobs-mentioning-ai-are-growing-amid-broader-hiring-weakness/)
- [Indeed Hiring Lab - AI（人工智能）采用集中度](https://www.hiringlab.org/2026/01/16/ai-adoption-accelerating-still-concentrated-among-largest-firms/)
- [Second Talent - 最受需求的 10 项 AI Engineering（人工智能工程）技能](https://www.secondtalent.com/resources/most-in-demand-ai-engineering-skills-and-salary-ranges/)
- [World Economic Forum - AI（人工智能）新增 1.3M 个岗位](https://www.weforum.org/stories/2026/01/ai-has-already-added-1-3-million-new-jobs-according-to-linkedin-data/)
- [AI Pulse - AI（人工智能）与 ML（机器学习）工程师薪资基准 2026](https://theaimarketpulse.com/salaries/)
- [Agentic Engineering Jobs - LangChain 市场 2026](https://agentic-engineering-jobs.com/langchain-job-market-2026)

### 薪酬数据
- [levels.fyi - Anthropic](https://www.levels.fyi/companies/anthropic/salaries/software-engineer)
- [levels.fyi - OpenAI](https://www.levels.fyi/companies/openai/salaries/software-engineer)
- [levels.fyi - Cursor](https://www.levels.fyi/companies/cursor/salaries/software-engineer)
- [levels.fyi - Sierra](https://www.levels.fyi/companies/sierra/salaries/software-engineer)
- [levels.fyi - Google AI（谷歌人工智能）](https://www.levels.fyi/companies/google/salaries/software-engineer/title/ai-engineer)
- [levels.fyi - Microsoft AI（微软人工智能）](https://www.levels.fyi/companies/microsoft/salaries/software-engineer/title/ai-engineer)
- [Entrepreneur - OpenAI 薪资（联邦申报文件）](https://www.entrepreneur.com/business-news/how-much-openai-employees-make-salaries-685000)
- [Career Check - 伦敦 ML Engineer（机器学习工程师）薪资 2026](https://www.careercheck.io/blog/ml-engineer-salary-london-2026)
- [Zen van Riel - 欧洲 AI Engineer（人工智能工程师）薪资](https://zenvanriel.com/job/ai-engineer-salary-europe/)
- [Scaler - 印度 AI/ML Engineer（人工智能/机器学习工程师）薪资](https://www.scaler.com/topics/ai-ml-engineer-salary-complete-guide/)
- [Morgan McKinley - 新加坡 AI/ML Engineer（人工智能/机器学习工程师）](https://www.morganmckinley.com/sg/salary-guide/data/ai-ml-engineer/singapore)

### 前沿实验室职业来源
- [Anthropic - 职业机会](https://www.anthropic.com/careers)
- [Anthropic - Forward Deployed Engineer（前线部署工程师）](https://job-boards.greenhouse.io/anthropic/jobs/4985877008)
- [Anthropic - Applied AI Engineer（应用人工智能工程师）](https://job-boards.greenhouse.io/anthropic/jobs/5116274008)
- [OpenAI 职业机会](https://openai.com/careers/search/)
- [OpenAI - Applied Evals（应用评测）](https://openai.com/careers/software-engineer-applied-evals-san-francisco/)
- [OpenAI - Frontier Evals & Environments（前沿评测与环境）](https://openai.com/careers/research-engineer-frontier-evals-and-environments-san-francisco/)
- [OpenAI - Agent Infrastructure SWE（智能体基础设施软件工程师）](https://openai.com/careers/software-engineer-agent-infrastructure-san-francisco/)
- [Sundeep Teki - 如何在 2026 年获得 OpenAI/Anthropic/DeepMind 录用](https://www.sundeepteki.org/advice/how-to-get-hired-at-openai-anthropic-and-google-deepmind-in-2026)
- [Sundeep Teki - AI Research Engineer（人工智能研究工程师）面试指南](https://www.sundeepteki.org/advice/the-ultimate-ai-research-engineer-interview-guide-cracking-openai-anthropic-google-deepmind-top-ai-labs)
- [Sundeep Teki - FDE（前线部署工程师）面试](https://www.sundeepteki.org/advice/the-definitive-guide-to-forward-deployed-engineer-interviews-in-2026)
- [Hashnode - FDE（前线部署工程师）完整 2026 指南](https://hashnode.com/blog/a-complete-2026-guide-to-the-forward-deployed-engineer)

### 面试流程来源
- [Design Gurus - System Design（系统设计）面试在 2026 年的变化](https://designgurus.substack.com/p/system-design-interviews-changed)
- [IGotAnOffer - Anthropic 面试流程](https://igotanoffer.com/en/advice/anthropic-interview-process)
- [Jobright - Anthropic 技术面试 2026](https://jobright.ai/blog/anthropic-technical-interview-questions-complete-guide-2026/)
- [Sierra - AI-Native（人工智能原生）面试](https://sierra.ai/blog/the-ai-native-interview)
- [Alexey Grigorev - AI Engineering（人工智能工程）实战指南（面试流程）](https://github.com/alexeygrigorev/ai-engineering-field-guide/blob/main/interview/01-interview-process.md)
- [interviewing.io - Meta AI-Assisted Coding Interview（人工智能辅助编码面试）](https://interviewing.io/blog/how-to-use-ai-in-meta-s-ai-assisted-coding-interview-with-real-prompts-and-examples)
- [Exponent - OpenAI System Design（系统设计）2026](https://www.tryexponent.com/blog/openai-system-design-interview)
- [Exponent - Anthropic System Design（系统设计）2026](https://www.tryexponent.com/blog/anthropic-system-design-interview)

### 新兴岗位报道
- [AI Career Lab - Agentic-AI（智能体式人工智能）岗位指南 2026](https://theaicareerlab.com/blog/agentic-ai-jobs-guide-2026)
- [Practical DevSecOps - 10 个热门新兴 AI Security（人工智能安全）岗位](https://www.practical-devsecops.com/emerging-ai-security-roles/)
- [Fast Company - Google/Box CEO：FDE（前线部署工程师）需求最高](https://www.fastcompany.com/91541878/google-box-ceos-say-this-is-the-most-in-demand-job-in-tech)
- [Computerworld - 从 AI（人工智能）转变中兴起的 FDE（前线部署工程师）职业](https://www.computerworld.com/article/4171867/heres-one-career-emerging-from-the-ai-shift-forward-deployed-engineers.html)
- [Rootly - AI SRE（人工智能站点可靠性工程）指南 2026](https://rootly.com/ai-sre-guide)
- [Resolve.ai - 什么是 AI SRE（人工智能站点可靠性工程）](https://resolve.ai/glossary/what-is-ai-sre)
- [Medium - MCP（模型上下文协议）技能的兴起](https://medium.com/@adnanmasood/the-rise-of-model-context-protocol-mcp-skills-5f0d6a1c3579)

### 合规与监管
- [EU AI Act（欧盟人工智能法案）实施时间线](https://artificialintelligenceact.eu/implementation-timeline/)
- [Secure Privacy - EU AI Act（欧盟人工智能法案）2026 合规](https://secureprivacy.ai/blog/eu-ai-act-2026-compliance)
- [Augment Code - EU AI Act（欧盟人工智能法案）2026 指南](https://www.augmentcode.com/guides/eu-ai-act-2026)

---

*另见：[题库](01-question-bank.md) | [答题框架](02-answer-frameworks.md) | [AI（人工智能）岗位行为面试](05-behavioral-for-ai-roles.md) | [岗位转型指南](../TRANSITION_GUIDE.md)*
