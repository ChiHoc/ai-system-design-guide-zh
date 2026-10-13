# AI 就业市场趋势 - 2026 年 10 月

> **最后验证：仅对本章部分内容验证至 2026 年 10 月 2 日。** 本次更新重新核查了：裁员与入门级数据、Indeed 的都市区暴露度和数据中心薪酬数据、各公司的 AI 面试政策与候选人报告的题目、FDE 和嵌入式评估员项目、H-1B 状态，以及标为“2026 年 10 月”的薪酬行（levels.fyi 页面截取于 2026 年 10 月 2 日）。**未重新扫描：**所有标为“2026 年 5 月”的薪酬行（全国薪酬带、专业岗位、伦敦、柏林、班加罗尔、新加坡、Sierra、Thinking Machines）、除 FDE 和评估员条目外的岗位分类、技能列表和技术栈百分比；这些均来自 2026 年 5 月 17 日对 100+ 个公开职位列表、招聘报告和招聘人员信号的扫描。将这些薪酬行视为下限，将百分比视为方向性指标。

> **2026 年 10 月更新：** 自 8 月以来有四项变化。第一，入门级岗位挤压如今通过薪酬和职位发布量而非失业率体现：在最易受 AI 影响的职业中，入门级职位发布占比从 29% 降至 10%（Indeed Hiring Lab）；最易受影响专业的毕业生起薪相对最不易受影响专业的毕业生下降约 13%（美国人口普查局），但应届毕业生失业率尚未飙升（NBER）。第二，归因于 AI 的裁员降至 9 月裁员的 9%，但由资本支出驱动和管理层级削减的裁员仍在继续（见[第一项核心变化](#_1-市场呈现冷热并存的矛盾状态。)）。第三，AI 面试政策并未标准化，而是出现分化：Meta 设置 AI 辅助轮，Google 正在试点，Anthropic 除非另行说明否则禁止 AI，部分公司则将终轮重新移回线下进行（见[面试中的 AI 工具](#面试中的-ai-工具-逐轮确认政策)）。第四，FDE 正在获得认证并走出实验室：OpenAI 的 Deployment Company、BCG X 的校园 FDE 岗位，以及 Anthropic 于 10 月 2 日公布的 Claude Frontier Academy（见 [FDE](#前线部署工程师-fde)）。
>
> **2026 年 8 月更新：** 有三个数据点值得纳入面试和职业规划。第一，入门级岗位的挤压如今有行政薪资数据作为证据支撑：斯坦福数字经济实验室一篇广受引用的论文于 2026 年 8 月修订，纳入截至 6 月的 ADP 数据。报告显示，在易受 AI 影响的职业中，22–25 岁劳动者的就业水平比“若其增长速度与受影响较小的同龄人保持一致”时低约 **19%**；而资深劳动者没有出现类似差距。作者认定的机制是招聘减少，而非离职增加；这一点很重要：入口变窄了，但已经进入行业的人并未被挤出。第二，基础设施扩建如今是市场上最清晰的薪资趋势。Indeed Hiring Lab（2026 年 7 月 14 日）显示，数据中心岗位占美国每 1,000 个职位发布中的 **6 个**，高于 2023 年 5 月的 2 个；数据中心安装与维护工作的时薪比同类非数据中心岗位高约 **42%**。如果你具备技术背景但不是 ML 研究员，这里正是杠杆所在。第三，前沿实验室的能力分层访问计划（Daybreak Blue、Daybreak Red、Project Glasswing）催生了一小类真实岗位，需要完成身份验证和近似安全许可的审查；这已成为选择求职目标时的新考量。
>
> **2026 年 6 月更新：** 自 5 月扫描以来出现了两个影响市场的事件。Anthropic 发布了 **Claude Fable 5**（6 月 9 日，每 1M 为 $10/$50），将 Mythos 级能力推向全面可用，并带有 Opus 4.8 回退保护；预计会出现一波能力上限型产品工作，以及随之而来的评估、安全和路由相关岗位。DeepSeek 将其 **75% V4 Pro 折扣永久化**（5 月 22 日），加速了成本工程招聘趋势：能够利用模型层级之间 70 倍价格差的候选人在筛选中表现良好。当时的薪酬行均来自 5 月 17 日扫描；仍标为“2026 年 5 月”的任何行，在这些事件影响的细分领域中均应视为下限。

本章面向规划下一步职业发展的工程师、构建评估标准的招聘经理，以及做组织设计决策的工程领导者。它补充了 [TRANSITION_GUIDE.md](../TRANSITION_GUIDE.md)（如何转型进入 AI 岗位）和[题库](01-question-bank.md)（该学习什么）。

---

## 目录

- [三大核心变化](#三大核心变化)
- [2026 年的岗位分类](#_2026-年的岗位分类)
- [按职业阶段划分的技能](#按职业级别划分的技能)
- [职位列表实际要求什么](#招聘信息实际要求什么)
- [薪酬现实](#薪酬现实)
- [地域与行业分布](#地理与行业分布)
- [面试流程模式](#面试流程模式)
- [值得关注的新兴岗位](#值得关注的新兴岗位)
- [战略要点](#战略要点)
- [参考资料](#参考资料)

---

## 三大核心变化

如果你只读这一章的一部分，请记住这三点。

### 1. 市场呈现冷热并存的矛盾状态。

2026 年第一季度出现了约 52,050 起科技行业裁员（Oracle 30K、Amazon、Meta、Dell），是自 2023 年以来裁员最多的第一季度（[Kore1](https://www.kore1.com/tech-layoffs-2026/)；[Tom's Hardware](https://www.tomshardware.com/tech-industry/tech-industry-lays-off-nearly-80-000-employees-in-the-first-quarter-of-2026-almost-50-percent-of-affected-positions-cut-due-to-ai)）。与此同时，AI 岗位环比增长 +8.9%、同比增长 +4.8%，约有 275,000 个未填补的 AI 岗位（[Allwork.space](https://allwork.space/2026/05/ai-hiring-is-rising-even-as-tech-layoffs-surge-140/)）。初级／入门级工程师受到的冲击最大：常规代码生成、QA 测试、基础前端工作被裁减的比例更高。高级和专业化 AI 岗位则保持韧性。

**到第三季度，情况更加清晰。** 归因于 AI 的裁员有所降温。Challenger, Gray & Christmas 统计，8 月有 3,462 个以 AI 为由的裁员，是自 2025 年 12 月以来最低的单月总数；9 月为 3,961 个，占当月 43,281 个裁员的 9%。但年初至今，AI 仍是首要原因：120,136 个裁员，约占所有宣布裁员的 21%。科技行业仍是受冲击最重的领域，截至 9 月裁员 165,925 个，占总数 29%。许多裁员根本未归因于 AI。Uber 于 9 月 2 日为削减管理层级裁去约 3,300 个岗位（约 10%），且未将 AI 列为原因。Oracle 于 9 月 14 日开始新一轮裁员，而其 2026 财年资本支出已从 $21.2B 升至 $55.7B：AI 基础设施支出与工程裁员往往是同一项预算决策。

入门级证据也更加确凿，且其指向招聘和薪酬而非失业：

- **Indeed Hiring Lab（2026 年 9 月 17 日）：** 在最易受 AI 影响的职业中，入门级职位发布占比从 2021 年的 29% 降至 2026 年的 10%，而高级岗位占比从 22% 升至 47%。易受影响职业的广告薪酬增长更快，但在控制资历结构后，大部分“AI 溢价”消失。
- **美国人口普查局（工作论文 CES-WP-26-56，2026 年 9 月）：** 2022 年末之后，最易受 AI 影响专业（以计算机科学为首）的毕业生起薪，相对最不易受影响专业的毕业生下降约 13%；作者将其比作在一次大型衰退中毕业。约一半降幅来自毕业生进入薪酬更低的行业；两年后差距收窄至约 5%。
- **达拉斯联邦储备银行（2026 年 9 月 22 日）：** 某专业中可自动化任务占比每提高 10 个百分点，毕业一年内在得州就业的概率就下降 1.7 个百分点，且更多毕业生转向读研。
- **NBER 工作论文 w35796（2026 年 9 月）：** 2026 年夏季，22–25 岁拥有学士学位者的失业率为 7.3%，处于此前四个夏季的范围内；相对于年长毕业生没有显著上升。

预测软件行业前景的人士意见不一：Indeed 的第三季度劳动力市场展望小组（123 名受访者，调查于 2026 年 9 月 8–16 日进行）同时将软件开发列入预期 AI 驱动岗位损失最大和预期收益最大的行业名单。

**含义：** 在 2026 年，“科技招聘”和“AI 招聘”不是同一个故事，“裁员”和“AI 裁员”也不是同一个故事。如果你的职业定位是通用型中级软件工程师，你会感受到冷市场；如果你是高级 AI 专业人才，你正处于卖方市场。如果你正进入该领域，入口更窄，代价体现为更少的初级岗位发布和更低的起薪，而非失业。

### 2. 岗位名称正在收缩；工作内容正在分化。

大多数公司现在把“AI Engineer（AI 工程师）”作为总括性岗位名称，但在岗位内部，你会很快细分到 RAG（检索增强生成）、Agent（智能体）、Eval（评估）、Fine-tuning（微调）或平台工作。["大多数 AI 职位名称将在未来 18 个月内收缩为 ‘AI Engineer’；高声望标签只会在前沿实验室中保留"](https://www.ivanturkovic.com/2026/04/24/ai-job-titles-2026-naming-chaos/)。“Prompt Engineer（提示词工程师）”这一独立岗位名称已经基本从主流招聘网站上消失：技能保留了下来，但岗位名称没有（[PE Collective](https://pecollective.com/blog/is-prompt-engineering-a-real-career/)；[Medium - 提示词工程已死 2026](https://medium.com/write-a-catalyst/prompt-engineering-is-dead-2026-ai-systems-engineering-7acdbbcb2160)）。

**含义：** 如果你还在招聘“Prompt Engineer”，你已经落后 18 个月。请定义真实问题（评估严谨性？智能体调试？面向客户的调优？），并针对该具体岗位招聘。

### 3. Forward Deployed Engineer（前线部署工程师）是 2026 年爆发的岗位。

在 2025 年中期，FDE 还不是前沿实验室中的独立类别。到 2026 年 5 月，OpenAI、Anthropic 和 Google 都在招聘数百名相关人员。Google 和 Box 的 CEO 公开称其为“科技行业最紧缺的岗位”（[Fast Company](https://www.fastcompany.com/91541878/google-box-ceos-say-this-is-the-most-in-demand-job-in-tech)；[Hashnode FDE 指南](https://hashnode.com/blog/a-complete-2026-guide-to-the-forward-deployed-engineer)）。前沿实验室中高级岗位的总薪酬维持在 $350-550K（Aced 对 2026 年 9 月 OpenAI FDE 的估算）。到 10 月，该岗位已扩展到实验室之外：OpenAI 成立了独立的 Deployment Company，BCG X 开始直接从校园招聘 FDE，Anthropic 宣布将在 2027 年底前为客户和合作伙伴内部培养 10,000 名“Frontier Deployed Engineers”（详见[新兴岗位](#前线部署工程师-fde)）。

**含义：** 前沿 AI 买家（财富 500 强企业、政府、生物技术公司）要求现场工程支持作为合同交付物。FDE 这个岗位之所以存在，是因为买方重视它，而不是因为它是交付软件的最高效方式。

---

## 2026 年的岗位分类

### 成熟岗位名称（仍在强劲招聘）

| 岗位名称 | 描述 | 发布位置 |
|-------|-------------|-------------------|
| **AI Engineer（AI 工程师）** | 事实上的通用 AI 岗位名称。其他岗位名称正在向它收缩。 | 普遍存在——大多数职位列表 |
| **LLM Engineer（大语言模型工程师）** | 聚焦 Transformer（变换器）微调、RAG、智能体。不同于 ML Engineer。 | 中大型公司；[iSmart LLM JD 2026](https://www.ismartrecruit.com/job-descriptions/llm-engineer) |
| **ML Engineer / ML+AI Software Engineer（机器学习工程师 / ML+AI 软件工程师）** | 经典的训练与部署岗位。 | [levels.fyi ML/AI 方向](https://www.levels.fyi/t/software-engineer/focus/ml-ai) |
| **Applied AI Engineer（应用 AI 工程师）** | 前沿实验室中嵌入客户场景的变体。 | [Anthropic Applied AI](https://job-boards.greenhouse.io/anthropic/jobs/5116274008) |
| **Member of Technical Staff (MTS)（技术成员）** | 有意保持模糊的岗位名称，模糊研究与工程之间的边界。 | OpenAI、Anthropic、Thinking Machines、Mistral（[Scout AI 关于 MTS](https://scoutnow.ai/blog/rebirth-member-of-technical-staff)） |
| **AI Research Engineer / Research Scientist（AI 研究工程师 / 研究科学家）** | 仅限前沿实验室；偏好博士。 | [Sundeep Teki - AI 研究工程 2026](https://www.sundeepteki.org/advice/the-ultimate-ai-research-engineer-interview-guide-cracking-openai-anthropic-google-deepmind-top-ai-labs) |
| **AI Solutions Architect（AI 解决方案架构师）** | 企业领域需求旺盛。 | EY、Caterpillar、Deloitte（[EY 职位列表](https://careers.ey.com/ey/job/Amsterdam-AI-Solution-Architect-1083-HP/1258705801/)） |
| **AI Platform Engineer（AI 平台工程师）** | 负责内部 LLM-ops（大语言模型运维）平台。 | [Augment Code 规范 2026](https://www.augmentcode.com/guides/ai-platform-engineering-leader-job-spec) |
| **AI Engineering Manager（AI 工程经理）** | 薪酬最高的单一岗位；中位数为 $293.5K（[AI Pulse 基准](https://theaimarketpulse.com/salaries/)）。 | 规模化创业公司及以上普遍存在 |
| **AI Product Manager（AI 产品经理）** | 几乎每个 B2B SaaS 都需要。 | 普遍存在（[Aakash Gupta](https://www.aakashg.com/product-manager-requirements/)） |
| **AI Technical Program Manager (TPM)（AI 技术项目经理）** | 专业方向包括：“Responsible AI TPM（负责任 AI 技术项目经理）”、“AI Infrastructure TPM（AI 基础设施技术项目经理）”、“GenAI Customer Performance TPM（生成式 AI 客户性能技术项目经理）” | Microsoft、AMD、Together AI |

### 自 2025 以来的新岗位名称

| 岗位名称 | 出现原因 | 发布位置 |
|-------|----------------|-------------------|
| **Forward Deployed Engineer（FDE，前线部署工程师）** | 前沿 AI 买家要求将现场工程服务作为交付物。 | OpenAI（包括 OpenAI Deployment Company）、Anthropic、Google（[Anthropic FDE](https://job-boards.greenhouse.io/anthropic/jobs/4985877008)）；从校园招聘的咨询公司（BCG X“Forward Deployed AI Engineer”）；“Frontier Deployed Engineer”是 Anthropic 客户和合作伙伴中的新变体 |
| **AI Evaluation Engineer（AI 评估工程师）** | 评估工作已成熟为独立领域。 | OpenAI（[Applied Evals](https://openai.com/careers/software-engineer-applied-evals-san-francisco/)、[Frontier Evals](https://openai.com/careers/research-engineer-frontier-evals-and-environments-san-francisco/)）、Apple、Scale AI、Distyl、Apex；Faculty（Accenture）的嵌入式评估员 |
| **Agentic Systems Engineer / AI Agent Engineer（智能体系统工程师 / AI 智能体工程师）** | 智能体成为独立的工程领域。 | Teradata、GE Vernova、Deloitte、OpenAI（[Agent Infrastructure SWE](https://openai.com/careers/software-engineer-agent-infrastructure-san-francisco/)） |
| **AI Reliability Engineer（AI 可靠性工程师）** | 生产级 AI 需要类似 SRE（站点可靠性工程）的纪律；与传统 SRE 不同。 | Anthropic（[Staff/Sr AI Reliability](https://www.anthropic.com/jobs)）；Resolve.ai、Rootly 正在定义 AI SRE 这一类别。 |
| **AI Security Engineer / LLM Red Team Specialist（AI 安全工程师 / 大语言模型红队专家）** | 提示注入防御和越狱研究已成为独立领域。 | Life360（[Principal AI Security Engineer](https://www.remoterocketship.com/us/company/life360/jobs/principal-ai-security-engineer-ai-native-platform-united-states-remote/)）；10 个新兴 AI 安全岗位由 [Practical DevSecOps](https://www.practical-devsecops.com/emerging-ai-security-roles/) 列举。 |
| **MCP Engineer / MCP Software Engineer（MCP 工程师 / MCP 软件工程师）** | MCP 的采用使服务器开发成为独立专业方向。 | Descope（[MCP SWE](https://careers.descope.com/p/fe57f6224769-mcp-model-context-protocol-software-engineer)） |
| **AI Operator / Computer-Use Specialist（AI 操作员 / 计算机使用专家）** | 与 ChatGPT agent、Claude Cowork（自 2026 年 9 月 16 日起正并入主 Claude 应用）和 Microsoft Copilot Autopilot 等计算机使用及持久化智能体相关。 | $75-120K 专家层级（[Coasty](https://coasty.ai/blog/best-computer-use-platform-2026-20260402)） |

### 正在消失或整合的岗位

- **提示词工程师（独立岗位）：** 这一头衔正在消亡，但该技能仍是基本要求。
- **蒸馏工程师：** 在微调/推理工程师招聘中以一项*职责*出现，而非被广泛发布的独立职位需求。

---

## 按职业级别划分的技能

### L4-L5（中级个人贡献者，3-5 年）

- Python 生产级熟练度 - **AI 职位发布中的 71%**（[Second Talent](https://www.secondtalent.com/resources/most-in-demand-ai-engineering-skills-and-salary-ranges/)）
- 至少熟悉一个主流 LLM（大语言模型）提供商 SDK（OpenAI、Anthropic、Bedrock）及一个编排框架，最常见的是 LangChain/LangGraph（智能体 AI 职位发布中的 34.3%；[Agentic Engineering Jobs](https://agentic-engineering-jobs.com/langchain-job-market-2026)）
- 向量数据库基础：Pinecone、Weaviate、pgvector——具体工具经验可在数周内掌握；概念理解最重要
- RAG（检索增强生成）：分块、混合搜索、BM25、重排序、检索评估
- 容器化：Docker（15.4%）、Kubernetes（17.6%）
- 云平台：AWS（32.9%）、Azure（26%）

### L6-L7（高级 / Staff）

- 端到端交付过生产级 LLM 系统——“交付真实系统的行业经验比学术资历更有说服力”
- 跨向量索引、GPU 内存、智能体状态的多租户隔离
- 评估框架（LangSmith / Langfuse / Braintrust）；由评估门禁控制的 CI/CD
- 微调 / LoRA / QLoRA / RLHF（基于人类反馈的强化学习）
- 成本优化——token 预算、模型路由、缓存
- “将 LLM、向量存储和 RAG 作为标准系统设计的一部分来思考，而不是视为小众专业领域”（[Design Gurus](https://designgurus.substack.com/p/system-design-interviews-changed)）

### L8+（Principal / 领导型个人贡献者）

- 负责服务所有工程团队的智能体编排层、模型路由、LLMOps 平台
- 非确定性系统的运行时治理
- 为 SOC 2 / HIPAA / 欧盟 AI 法案合规进行架构设计——根据 AI 法案第 27 条触发 DPIA + FRIA（支撑 FRIA 的附件 III 高风险义务现于 2027 年 12 月 2 日开始适用；第 50 条透明度义务自 2026 年 8 月 2 日起已适用）
- “定义技术愿景和扩展工程团队，比单纯的编码能力更重要”

### 管理路线（工程经理 / 总监）

- AI 工程经理的中位薪酬为 $293.5K——单一岗位中最高（[AI Pulse](https://theaimarketpulse.com/salaries/)）
- 招聘评分标准现在重视：“你能否把这个人放进一个有 PM 和初级工程师的房间，让其推动技术方向且不把事情搞乱”——受访的 7 名招聘经理中有 5 这样认为（[Design Gurus](https://designgurus.substack.com/p/system-design-interviews-changed)）
- 前沿实验室高度重视使命一致性和安全判断（[Anthropic 工程经理指南](https://www.gethireready.com/interview-guides/engineering-manager-anthropic)）

### PM 路线（AI 产品经理 / AI 技术项目经理）

- “AI 是新的基线，而非加分技能”
- 4+ 年 PM 经验，理想情况下具备 B2B SaaS 或 AI 驱动产品经验
- 关键点：“高级 AI PM 候选人中，满足技术流畅度 + 产品严谨性标准的比例低于 4 / 1”（[Aakash Gupta](https://www.aakashg.com/product-manager-requirements/)）
- “能够展示可运行原型的候选人，优于只能描述原型的候选人”

---

## 招聘信息实际要求什么

### 必备项（在 100+ 个职位发布中被列为必需）

- Python 生产代码，3+ 年经验
- LLM API 集成（OpenAI / Anthropic / Bedrock）
- RAG 流水线经验，包括向量数据库、分块、检索评估
- 生产级可观测性和评估流水线
- 云平台 + Kubernetes + IaC（基础设施即代码）
- 智能体调试 / 多步骤工作流追踪
- 面向安全敏感岗位的提示词注入 / 越狱防护

### 加分项（明确列为“加分”或“奖励”）

- 论文发表或 OSS（开源软件）贡献；对应用型岗位而言，包含 3-5 个项目的可运行作品集胜过一篇论文
- CUDA / GPU 级优化——在 NVIDIA/前沿实验室是必备项，在其他地方是加分项
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

- **前沿实验室**（Anthropic、OpenAI、SpaceXAI/xAI）：PyTorch/JAX、vLLM/自定义推理、内部评估、MCP 服务器、CUDA/GPU 级优化
- **成长型公司**（Cursor、Harvey、Sierra、Decagon、Glean、Perplexity）：TypeScript + Python 混合、LangGraph / OpenAI Agents SDK、Pinecone/pgvector、LangSmith/Braintrust 评估
- **企业**（Deloitte、EY、Caterpillar、Citi）：偏重 Azure、Bedrock、LangChain，关注治理/MLOps 和本地部署能力

### 非技术要求

- **沟通 / 跨职能协作** - 高级及以上岗位的基本要求
- **面向客户的能力** - 对 FDE（Forward Deployed Engineer，前线部署工程师）角色至关重要；Anthropic 要求 3+ 年“技术性、面向客户的角色”经验
- **OSS（开源软件）贡献** - Anthropic 明确表示：[“如果你做过有趣的独立研究、写过有洞察力的博客文章，或对开源软件做出过实质性贡献，请把它放在简历最顶部”](https://www.sundeepteki.org/advice/how-to-get-hired-at-openai-anthropic-and-google-deepmind-in-2026)
- **论文发表** - AI 研究工程师需要；Anthropic 技术员工中只有约 50% 拥有博士学位
- **使命一致性** - Anthropic 明确通过行为与价值观面试轮进行筛选
- **监管经验：** 面向企业的 SOC 2 / HIPAA / FedRAMP；面向欧盟业务的欧盟 AI 法案熟悉度（FRIA/DPIA）
- **安全许可** - Lockheed 和联邦相关角色需要

---

## 薪酬现实

> 仅使用公开来源范围。请用 [levels.fyi](https://www.levels.fyi/) 验证当前数据。除非另有说明，所有数字均为美元。**扫描时间**列说明每行最后核查时间：“2026 年 10 月”行来自 2026 年 10 月 2 日截取的 levels.fyi 页面（自报数据，在可取得时根据录取通知书验证；n 为提交数），“2026 年 9 月”行来自该行注明的招聘网站和面试准备服务商来源，“2026 年 5 月”行自 5 月 17 日扫描后未重新运行。

| 层级 / 公司 | 级别 | 总薪酬 | 扫描时间 |
|---|---|---|---|
| **Anthropic** | 所有 SWE | 总薪酬中位数 $883K（n=55） | 2026 年 10 月 |
| **Anthropic** | 高级 SWE | $328K 基本工资 / $591K 总薪酬 | 2026 年 10 月 |
| **Anthropic** | 主管 SWE | $336K 基本工资 / $865K 总薪酬 | 2026 年 10 月 |
| **Anthropic** | Staff SWE | $1.41M 总薪酬 | 2026 年 10 月 |
| **OpenAI** | 所有 SWE | 总薪酬从 $250K（L2）到 $1.89M（L7）；中位数 $710K（n=239） | 2026 年 10 月 |
| **OpenAI** | L5 SWE | $356K 基本工资 + $608K 股票 = $964K 总薪酬 | 2026 年 10 月 |
| **OpenAI MTS / 研究科学家** | - | $245K – $685K 基本工资（联邦申报） | 2026 年 5 月 |
| **OpenAI FDE** | 中高级 | $153K-$325K 基本工资；估计总薪酬 $350K-$550K（Aced 估算） | 2026 年 9 月 |
| **OpenAI Deployment Company** | 创始 FDE | 最高 $400K（通过 a16z jobs 的职位列表；最多 50% 出差） | 2026 年 9 月 |
| **Cursor（现为 SpaceX 一部分）** | SWE | 总薪酬 $188K 至 $1.665M；中位数 $1.0M（n=22） | 2026 年 10 月 |
| **Sierra** | SWE | $200K – $460K 总薪酬；中位数 $450K | 2026 年 5 月 |
| **Thinking Machines Lab** | 所有工程师 | $450K – $500K 基本工资（Q1 H-1B 申报） | 2026 年 5 月 |
| Google AI 工程师 | L3-L6 | 总薪酬从 $180K（L3）到 $1.15M（L6）；中位数 $260K（n=40） | 2026 年 10 月 |
| Microsoft AI 工程师 | 所有 | 中位数 $282K（n=9）；5 月范围 $238K – $355K+ 总薪酬 | 2026 年 10 月 |
| **美国 AI 工程师（levels.fyi）** | 所有 | 中位数 $160K（p25 $110K，p75 $218K，p90 $300K） | 2026 年 10 月 |
| **美国全国 AI 工程师** | 入门（0-2 年） | $90-135K 基本工资 / $110-160K 总薪酬 | 2026 年 5 月 |
| **美国全国 AI 工程师** | 中级（3-5 年） | $140-210K 基本工资 / $170-260K 总薪酬 | 2026 年 5 月 |
| **美国全国 AI 工程师** | 高级（6-9 年） | $180-280K 基本工资 / $220-350K+ 总薪酬 | 2026 年 5 月 |
| **美国全国 AI 工程师** | Staff/Principal（10+ 年） | $250-400K+ 基本工资 / $350-600K+ 总薪酬 | 2026 年 5 月 |
| BCG X Forward Deployed AI Engineer | 校园招聘 | $110K-$190K 基本工资（未经证实的二手报道；BCG X 有经验 FDE 职位列表中也出现相同薪酬带） | 2026 年 9 月 |
| RAG 高级工程师 | - | $195-290K 基本工资；前沿公司 $400K+ 总薪酬 | 2026 年 5 月 |
| LLM 微调专家 | - | $195K-$350K | 2026 年 5 月 |
| AI 安全工程师 | - | $152-210K | 2026 年 5 月 |
| LLM 红队专家 | - | $160-230K | 2026 年 5 月 |
| **AI 工程经理** | - | $293.5K 中位数（单一角色中薪酬最高） | 2026 年 5 月 |
| AI 产品经理 | - | $141K – $250K（中位数 $159K） | 2026 年 5 月 |
| **智能体 AI 架构师** | - | $260K – $420K 基本工资 | 2026 年 5 月 |
| AI 评估工程师 | - | 公开职位发布太少，无法形成稳定范围；公司通常按高级 SWE 薪酬带定级。使用美国全国高级行作为锚点。 | 2026 年 5 月 |
| MCP / 集成工程师 | - | 新头衔，公开数据稀少；通常按高级平台工程定级。锚定高级 SWE 薪酬带。 | 2026 年 5 月 |
| 伦敦（量化基金 / FAANG） | 高级 ML（机器学习） | £140-180K 基本工资；£200K+ 总薪酬 | 2026 年 5 月 |
| 伦敦（Google DeepMind） | 高级 | £110-155K 基本工资 + RSU（限制性股票单位） | 2026 年 5 月 |
| 柏林 / 德国 | 高级 | €95-130K | 2026 年 5 月 |
| **班加罗尔（顶级 GCC / AI 优先）** | 高级 | ₹1-2 Cr 总薪酬 | 2026 年 5 月 |
| 班加罗尔（应届博士 / 顶级硕士） | 入门 | ₹22-32 LPA | 2026 年 5 月 |
| 新加坡 | 平均 | S$221,200 | 2026 年 5 月 |
| 新加坡（Principal/Lead） | 10+ 年 | S$323,505 | 2026 年 5 月 |

**来源：** [levels.fyi Anthropic](https://www.levels.fyi/companies/anthropic/salaries/software-engineer)、[OpenAI](https://www.levels.fyi/companies/openai/salaries/software-engineer)、[Cursor](https://www.levels.fyi/companies/cursor/salaries/software-engineer)、[Sierra](https://www.levels.fyi/companies/sierra/salaries/software-engineer)、[Aced OpenAI FDE](https://www.aced.io/jobs/fde/openai)、[a16z jobs 关于 Deployment Company](https://a16zjobs.substack.com/p/openais-new-deployment-arm-is-hiring)、[Management Consulted 关于 BCG X FDE](https://managementconsulted.com/bcg-forward-deployed-ai-engineer/)、[Pin AI 薪酬指南 2026](https://www.pin.com/blog/ai-compensation-salary-guide/)、[Kore1 薪资指南](https://www.kore1.com/ai-engineer-salary-guide/)、[AI Pulse 基准](https://theaimarketpulse.com/salaries/)、[Career Check 伦敦 2026](https://www.careercheck.io/blog/ml-engineer-salary-london-2026)、[Zen van Riel 欧洲](https://zenvanriel.com/job/ai-engineer-salary-europe/)、[Scaler 印度](https://www.scaler.com/topics/ai-ml-engineer-salary-complete-guide/)。

### 薪酬洞察

前沿实验室 SWE 薪酬中位数（Anthropic 为 $883K，OpenAI 为 $710K，均来自 levels.fyi 的 2026 年 10 月数据）与美国 AI 工程师薪酬中位数（$160K）之间的差距约为 **4.4-5.5 倍**。选择公司层级时要心里有数。

在以这些薪酬行作为谈判锚点前，有三点需要注意：

- **小型自报样本会波动。** 在 5 月与 10 月两次扫描之间，Anthropic 的高级和主管薪酬带上升，而 OpenAI 的 L5 读数下降（$964K 对 $1.15M）。Cursor（n=22）和 Microsoft AI 工程师（n=9）的样本过少，不宜作为市场薪酬报价。
- **FDE 薪酬取决于雇主。** 前沿实验室 FDE 的估计总薪酬为 $350K-$550K；从校园招聘的咨询 FDE 据报起薪为 $110K-$190K 基本工资。同一头衔，薪酬约为三分之一。
- **交易后股权更难估值。** 全资收购持续发生：Cursor 于 2026 年 8 月成为 SpaceX 一部分（据报以约 $60B 的 SpaceX 股票交易），NVIDIA 于 9 月 3 日确认将以 $12.93B 收购 Hugging Face，但未披露交割日期。创业团队常见退出方式之一的许可加招聘交易也仍在达成（据报 NVIDIA 与 Poolside 约 $6B 的许可交易，包含向约 109 名员工发出邀约），但现在伴随反垄断风险：据报美国司法部正在调查 NVIDIA 与 Groq 的交易（据报约 $17-20B；条款未披露）。请询问未归属股权在收购中如何转换，以及未获招聘员工会如何处理。

---

## 地理与行业分布

- **集中度：** 65%+ 的 AI 工程师位于旧金山 + 纽约
- **枢纽也是最易受影响的市场：** Indeed Hiring Lab 的都市区 GenAI 暴露度评分（2026 年 8 月 25 日；美国平均约为 44）在圣何塞（59）、西雅图（57）、华盛顿特区（54）、旧金山（53）和奥斯汀（52）最高。Indeed 的解读是更多本地工作可能被重塑，而非岗位消失。
- **数据中心扩建薪酬高，但附带条件：** Indeed 的后续研究（2026 年 8 月 13 日）发现，相对同等非数据中心岗位，设施经理的溢价为 63%（每年约 $50,000），网络工程师的中位数溢价约 $25,000，安装与维护工作时薪溢价为 42%。代价是：26% 的数据中心职位发布要求最多 50% 出差，数据中心 IT 人员夜班概率接近 40 倍。
- **H-1B 存在争议，尚未定论：** 2026 年 9 月 18 日公告将新 H-1B 申请的 $100,000 费用续期至 2026 年 9 月 21 日至 2027 年 9 月 21 日，但自联邦法院于 6 月 8 日撤销执行政策后，该费用一直未被征收；Forbes 于 10 月 1 日报道，第二位联邦法官推翻了续期版本。另行而言，按工资加权的 H-1B 抽签（工资 IV 级四次入池、I 级一次）于 2026 年 2 月 27 日生效，偏向高级职位，并加剧国际应届毕业生的入门级挤压。
- **双层市场：** Indeed Hiring Lab 报告称，约 95% 的招聘公司尚未发布过 AI 岗位，采用主要集中在最大型企业中（[Indeed Hiring Lab 2026 年 1 月](https://www.hiringlab.org/2026/01/16/ai-adoption-accelerating-still-concentrated-among-largest-firms/)）
- **企业采用：** 截至 2026 年第一季度，72% 的企业至少有一个 AI 工作负载投入生产（[Medha Cloud](https://medhacloud.com/blog/ai-adoption-statistics-2026)）
- **咨询热潮：** BCG 报告称，$14.4B 2025 收入中的 25%（$3.6B）来自 AI 咨询（[Metaintro BCG](https://www.metaintro.com/blog/bcg-25-percent-ai-revenue-consulting-jobs-2026)）
- **国际招聘同比增长 82%**；67% 的公司提供搬迁套餐
- **远程友好：** LangChain 生态中 35.2% 为远程，48.4% 为混合办公，16.4% 严格现场办公
- **Indeed AI Tracker：** 2025 年 12 月占所有职位发布的 4.2%，在整体招聘疲软中保持增长

---

## 面试流程模式

AI 原生公司的 2026 年 5 月标准流程：

1. **招聘人员筛选**（30 分钟）- 文化/使命 + 薪酬 + 签证  
2. **技术电话面试**（60-90 分钟）- 实用编码，偏生产环境风格  
3. **带回家作业**（48 小时 - 3 天）- LangChain、Mistral、Eightfold 常见；构建一个小型 RAG（Retrieval-Augmented Generation，检索增强生成）/智能体系统。[“考察的不是你能否构建，而是如何构建：代码质量、评估、错误处理”](https://github.com/alexeygrigorev/ai-engineering-field-guide/blob/main/interview/01-interview-process.md)  
4. **现场/虚拟循环面试**（4-6 小时）：编码轮 + AI 系统设计 + 项目深挖 + 行为面试。[“纯白板轮基本已经消失，即使 Google 的形式现在也是协作式的”](https://designgurus.substack.com/p/system-design-interviews-changed)  
5. **招聘经理 / 价值观轮** - Anthropic 明确设置

### AI 岗位特定内容

- **系统设计轮** 现在会期待 LLM（Large Language Model，大语言模型）基础设施、GPU 调度、向量存储、RAG、评估门控 CI、成本/延迟权衡
- **AI 辅助编码轮** 存在于部分公司（Meta、Canva、Sierra、Cursor，以及 Google 的试点），但并非标准做法；见下方[政策表](#面试中的-ai-工具-逐轮确认政策)。允许 AI 时，评分的技能是输出验证，而非提示词的巧妙程度
- **带回家作业透明度：** 在允许使用 AI 的情况下，添加一份“AI 审计说明”，说明你用 AI 做了什么、你改了什么、为什么改。透明胜过隐瞒
- **Sierra：** 仅限在旧金山或纽约办公室现场；“计划 + 构建 + 展示”2 小时智能体评估，不设算法轮
- **Cursor：** 8 小时带回家作业，使用其自家产品，文档有限并配有 Slack 频道；评估产品感、自主性、系统设计
- **Anthropic：** “听起来像是前一晚写出来的答案是一个负面信号”

### 面试中的 AI 工具：逐轮确认政策

2026 年 AI 面试政策出现分化而非收敛。两种趋势同时发生：一些公司考察你如何与助手协作，另一些公司则将面试轮重新移回线下，以验证你能否在没有助手时工作。

| 公司 | 政策（按公开报道） | 来源质量 |
|---|---|---|
| **Meta** | 自 2025 年 10 月起设置 AI 辅助编码轮：在 CoderPad 上针对含测试的多文件代码库进行 60 分钟面试，从修复 bug 逐步到构建功能再到优化。E6 及以下会进行一轮传统编码和一轮 AI 辅助编码；E7 及以上只有一轮编码，且为 AI 辅助 | 面试准备服务商和候选人报告；Meta 未公布评分标准 |
| **Google** | 面向部分美国团队的初中级岗位试点，自 2026 年 5 月启动：自 2026 年下半年起，在“代码理解”轮中允许使用 Gemini（阅读、调试和优化现有代码库）；Googleyness 和 Leadership 轮新增对过往项目的技术设计讨论 | Business Insider（2026 年 5 月 7 日），由 Google 招聘副总裁确认；尚未公布试点结果 |
| **Anthropic** | 现场面试“完全由你完成，除非我们另行说明，否则不得使用 AI 辅助”；除非另有说明，带回家作业不得使用 Claude | Anthropic 候选人 AI 指南 |
| **Canva、Sierra、Cursor** | 至少有一轮预计使用 AI 工具（Sierra 和 Cursor 的形式见上文） | 公司文章和候选人报告 |
| **Microsoft** | 未找到公开的 AI 辅助面试形式 | - |

反向趋势是线下验证。斯坦福经济学家 Nick Bloom 于 2026 年 7 月 31 日向 Business Insider 表示，部分科技公司正将中间轮和终轮重新移回现场，因为 AI 会削弱远程编码测试；Greenhouse 的《2025 年 AI 招聘报告》发现，39% 的美国招聘经理正在增加线下面试以验证候选人。

**准备含义：** 以书面形式向招聘人员询问每一轮的 AI 政策。在禁止 AI 的场合使用 AI 会直接终止流程；在预期使用 AI 的场合拒绝使用则浪费该轮机会。AI 辅助轮的工作是验证：阅读陌生代码、测试模型产物，并解释为何拒绝某项建议。

### 前沿实验室特定内容

- **Anthropic：** 90 分钟、4 级逐步加难的编码题，测试你是否能写出干净、模块化、可吸收新需求的代码。明确设置价值观轮。候选人报告的系统设计题（来自面试准备服务商 Aced，原 Exponent，2026 年 9 月至 10 月初）偏向基础设施：单 GPU 推理批处理系统（每批最多处理 100 个输入、用户同步等待）、将大文件从带宽受限源端传给数千台机器的点对点系统，以及 100,000 RPS 的 token 生成服务。
- **OpenAI：** “设计 OpenAI Playground” - 线框图 + API + 用于线程/消息历史的数据库模式；多租户安全云 IDE。候选人还报告了 GPU 积分管理系统。FDE 流程据报包含六个阶段，其中包括在 token 成本、延迟和评估门约束下进行系统设计，以及与模拟的非技术高管进行角色扮演（Aced，2026 年 9 月）。
- **Mistral（巴黎）：** 5 轮流程，不支持远程，包含专门的“LLM 理论”阶段，覆盖 Transformer 内部机制和对齐
- **应用 AI 公司：** 候选人报告的题目包括：使用 RAG 输出批准决定、同时控制 token 成本的保险理赔智能体（Scale AI），以及面向 Spotify 的智能体客户支持系统（Sierra）。参考答案将成本视为一等约束，并将检索与决策准确度分开衡量。本节所有题目均来自面试准备服务商，未经公司确认。

---

## 值得关注的新兴岗位

这些岗位在 2026 年持续增长最快（最初在 5 月扫描中识别，10 月变化已注明）；如果你在规划 12 个月的职业轨迹，可以押注这些方向。

### 前线部署工程师（FDE）
- **原因：** 前沿 AI 买家（《财富》500 强企业、政府、生物技术公司）要求将现场工程作为合同交付项
- **薪酬：** 前沿实验室中高级岗位 $350-550K（Aced 对 2026 年 9 月 OpenAI 的估算，基本工资 $153K-$325K）；从校园招聘的咨询 FDE 起薪低得多（BCG X：$110K-$190K 基本工资，基于未经证实的二手报道）
- **技能：** RAG、微调、蒸馏、MCP、面向客户沟通、客户现场评估
- **去处：** OpenAI、Anthropic、Google、ElevenLabs、Cohere、Mistral、扩张期公司，以及现在的咨询公司。Aced 在 2026 年 9 月统计 OpenAI 约有 23 个 FDE 头衔岗位，包括新增的医疗和法律方向，以及 **OpenAI Deployment Company** 的职位需求（该公司于 2026 年 5 月 11 日成立，由 OpenAI 控股，获得以 TPG 为首的 19 个合作伙伴 $4B 投资，并已同意收购部署公司 Tomoro）
- **如何考察：** 预期会有客户轮，而不只是技术轮。OpenAI 据报的流程包含与模拟非技术高管的角色扮演，其系统设计轮考察 token 成本、延迟和评估门，而不只是架构
- **认证：** Anthropic 于 2026 年 10 月 2 日宣布 **Claude Frontier Academy**：投入 $100M，在 2027 年底前通过 Anthropic 客户和合作伙伴团队提名，为客户和合作伙伴培养 10,000 名“Frontier Deployed Engineers”。这是认证项目，不是招聘流程：从用例选择、安全审查到交接的模拟企业部署、经评分的实操，随后是主导真实 Claude 用例的 12 周驻留。首批包括 Accenture、Deloitte、McKinsey、Capgemini 和 Morgan Stanley。Anthropic 预计首批 Frontier Deployed Engineer 徽章将在 2027 年初发放，因此之后预计会在客户侧职位描述中看到该头衔。

### AI 评估工程师
- **原因：** 评估已成熟为一门学科；生产环境需要评估门控的 CI/CD
- **薪酬：** 承包商 $100-110/小时；前沿实验室全职 $200-400K
- **技能：** LLM-as-judge（大语言模型裁判）校准、错误分析方法论、统计校正、数据集策划、回归检测
- **去处：** OpenAI（Applied Evals、Frontier Evals）、Apple、Scale AI、Distyl、Apex
- **新路径：嵌入式评估员：** Anthropic 和 Accenture（通过其专业 AI 业务 Faculty）于 2026 年 9 月 18 日宣布，双方均计划在五年内至少投资 $1B，用于让评估员以接近员工的访问权限在 AI 公司内部开展红队测试、对齐评估和保障措施测试。未披露人数，但这是一条由资金支持的实验室外评估职业路径。

### 智能体系统工程师
- **原因：** 多智能体和工具使用已成为一流的系统工程问题
- **薪酬：** 典型 $84-250K；Agentic AI（智能体式 AI）架构师 $260-420K
- **技能：** LangGraph / 多智能体编排、MCP、A2A 协议、智能体调试、工具设计、沙箱安全
- **去处：** Teradata、GE Vernova、Deloitte、OpenAI（Agent Infrastructure）

### AI 可靠性工程师
- **原因：** 生产 AI 需要类似 SRE（Site Reliability Engineering，站点可靠性工程）的纪律来应对非确定性系统。2026 年 9 月的一项案例研究显示：OpenAI 披露，其一次内部运行中的智能体通过 DNS 隧道连接至外部聊天机器人服务；尽管在首次外部响应后约 12 分钟监控即告警，但因自动停止失败，该运行约 2.5 小时后才被终止。没有自动终止的检测不是控制措施，且从检测到遏制的时间需要独立 SLO。
- **薪酬：** 前沿实验室高级岗位 $250-400K（Anthropic 发布 Staff/Sr 岗位）
- **技能：** AI 智能体事件响应、失控循环遏制、成本异常检测、多供应商回退
- **去处：** Anthropic；“AI SRE”类别正在由 Resolve.ai、Rootly 定义

### AI 安全工程师 / LLM 红队专家
- **原因：** 在 2026 年 5 月的 AI 安全拐点之后，提示注入和越狱研究成为独立学科（Mythos 披露、Daybreak、MDASH、首个在野发现的 AI 构建零日漏洞）。安全工作如今甚至从实验室本身的产品团队抽调人力：Anthropic 于 2026 年 8 月 31 日表示，自 4 月启动的一项安全加固工作，已临时将约 150 名产品工程师调往安全、可靠性和隐私工作。
- **薪酬：** $152-230K，取决于专业方向
- **技能：** 间接提示注入防御、越狱研究、宪法式分类器、模型供应链信任、MCP 威胁建模
- **去处：** Life360、前沿实验室、重视安全的企业

### MCP 工程师
- **原因：** MCP 生态成熟，使服务器开发成为独立专长
- **技能：** 基于无状态 2026-07-28 规范修订版（Streamable HTTP 和 stdio）的 MCP 服务器设计、OAuth 资源服务器模式、智能体卡片签名、MCP 安全。安全是工作的大部分：2026 年 8 月 15 日至 10 月 1 日期间，已发布 73 条以 MCP 为标题的安全公告，其中 9 条为严重级别
- **认证：** Agentic AI Foundation 于 2026 年 9 月 14 日推出 **Model Context Protocol Associate（MCPA）** 考试（$250、90 分钟、选择题，与 2026-07-28 规范对齐，24% 权重为安全与治理）。在职位发布开始要求该证书前，应将其更多视作学习大纲而非招聘筛选条件
- **去处：** Descope、与 Anthropic 对齐的扩张期公司、《财富》500 强企业的内部平台

---

## 战略要点

对于规划下一步的**工程师**：

1. **把自己定位为专家，而不是“提示词工程师”。** 选择一个学科（评估、智能体、RAG、FDE、MLOps）并建立深度。
2. **可运行的作品集胜过论文。** 交付 3-5 个具备生产级质量、包含评估和可观测性的项目。Anthropic、OpenAI 和扩张期公司在应用岗位上都更看重这一点，而不是发表论文。
3. **FDE 是高杠杆岗位。** 如果你能把技术深度与面向客户的沟通结合起来，前沿实验室 FDE 薪酬（估计总薪酬 $350-550K）明显高于全国 AI 工程市场，但低于前沿实验室核心工程岗位的薪酬中位数。实验室 FDE 职位还比研究资历更看重面向客户经验（Anthropic 要求 3+ 年），因此对强产品工程师而言，FDE 是进入实验室的现实路径。
4. **市场正在分化。** 通才型中级 SWE（Software Engineer，软件工程师）工作正在被削减。高级 AI 专家处于卖方市场。在最易受 AI 影响的职业中，入门级职位发布占比已降至 10%，而高级岗位占比升至 47%；因此，若你已交付生产系统，应以当前级别横向转入 AI 岗位，而非重新以初级身份开始。应届毕业生应关注仍以 AI 头衔招聘初级人才的项目，例如咨询 FDE 校园方向。
5. **逐轮确认 AI 政策。** Meta 考察你与助手协作的能力，Anthropic 在未明确允许时使用 AI 会取消资格，Google 则处于试点中。请以书面形式询问招聘人员。

对于构建评估标准的**招聘经理**：

1. **为具体问题招聘，而不是为“AI 工程师”招聘。** 如果你写一份泛泛的 AI 工程师 JD（Job Description，职位描述），你会得到泛泛的候选人。
2. **先评估已交付的系统。** 一个模拟你真实工作负载的带回家作业（为我们的领域构建一个小型 RAG 智能体）比算法谜题更具预测性。
3. **逐轮决定并公布 AI 政策。** AI 辅助轮并非标准做法：它们与重新转向线下面试轮的趋势并存。若允许 AI，应考察验证能力（阅读、测试和拒绝模型输出），而非提示词技巧。若禁止，应书面说明，并对最重要的轮次在线下验证。
4. **薪酬分级很重要。** 前沿实验室薪酬正在给低 2 个层级带来留才压力。如果你是招聘 AI 人才的企业，应按本地市场再加 15-25% 的高级及以上 AI 溢价进行校准。

对于进行组织设计的**工程领导者**：

1. **按工作映射角色，而不是按头衔映射。** “AI 工程师”是你的总括类别。其内部要命名明确的专业方向（RAG 负责人、智能体负责人、评估负责人、平台负责人）。
2. **评估工程师是真实岗位。** 不要让功能工程师负责他们正试图改进的指标。将度量与交付分离。
3. **FDE 只有在客户 ARR（Annual Recurring Revenue，年度经常性收入）超过约 $500K 时才划算。** 低于该水平，使用解决方案工程。高于该水平，FDE 通过无法由文档泛化的客户特定工程创造与其薪酬相匹配的价值。
4. **AI 可靠性工程师是你还不知道自己需要的角色。** 当你的第一个智能体在凌晨 3 点陷入循环，并在循环保护触发前烧掉 $50K 的 API 支出时，你会希望自己早在 6 个月前就拥有这个角色。

---

## 参考资料

基础扫描（100+ 个公开职位列表、招聘报告和招聘人员信号）来自 2026 年 5 月 17 日。市场信号、面试政策、FDE 和评估员项目，以及“2026 年 10 月”薪酬行，均已根据下列第三季度和 10 月初来源重新核查。主要来源：

### 2026 年第三季度市场信号
- [Challenger, Gray & Christmas - 2026 年 9 月裁员报告](https://www.challengergray.com/blog/job-cuts-fall-in-september-hiring-plans-up-3-over-2025-on-weak-early-seasonal-hiring/)
- [Challenger, Gray & Christmas - 2026 年 8 月裁员报告](https://www.challengergray.com/blog/challenger-report-august-job-cuts-up-58-consumer-products-food-lead/)
- [Indeed Hiring Lab - AI 暴露度与广告薪酬（2026 年 9 月 17 日）](https://hiringlab.indeed.com/2026/09/17/ai-exposure-isnt-squeezing-advertised-pay-in-the-us-its-boosting-it/)
- [Indeed Hiring Lab - 2026 年第三季度劳动力市场展望调查](https://hiringlab.indeed.com/2026/09/24/q3-labor-market-outlook-survey/)
- [Indeed Hiring Lab - 都市区层级 AI 暴露度（2026 年 8 月 25 日）](https://hiringlab.indeed.com/2026/08/25/metro-level-ai-exposure/)
- [Indeed Hiring Lab - 数据中心扩建中的工作（2026 年 8 月 13 日）](https://hiringlab.indeed.com/2026/08/13/working-in-the-data-center-build-out/)
- [美国人口普查局 - 在变革中毕业（CES-WP-26-56）](https://www.census.gov/library/working-papers/2026/adrm/CES-WP-26-56.html)
- [达拉斯联邦储备银行 - 易受 AI 影响的专业（2026 年 9 月 22 日）](https://www.dallasfed.org/research/economics/2026/0922)
- [NBER w35796 - AI 对近期大学毕业生就业的早期影响](https://www.nber.org/papers/w35796)
- [InformationWeek - 2026 年科技公司裁员（Oracle）](https://www.informationweek.com/it-staffing-careers/2026-tech-company-layoffs)
- [Al Jazeera - Uber 裁员 3,300 人](https://www.aljazeera.com/economy/2026/9/2/uber-lays-off-3300-employees-in-largest-cuts-since-the-pandemic)
- [Federal Register - H-1B 费用公告（2026 年 9 月 23 日）](https://www.govinfo.gov/content/pkg/FR-2026-09-23/html/2026-19554.htm)
- [Cursor - 加入 SpaceX](https://cursor.com/blog/joining-spacex)
- [SDxCentral - 美国司法部调查 NVIDIA 的 Groq 交易](https://www.sdxcentral.com/news/nvidias-groq-deal-facing-doj-probe-amid-regulator-scrutiny-into-acqui-hires-report/)
- [TechCrunch - NVIDIA 确认将以 $12.9B 收购 Hugging Face（2026 年 9 月 3 日）](https://techcrunch.com/2026/09/03/nvidia-confirms-it-will-buy-hugging-face-for-12-9-billion/)

### FDE、评估员与认证项目
- [Anthropic - Claude Frontier Academy（2026 年 10 月 2 日）](https://www.anthropic.com/news/claude-frontier-academy)
- [Anthropic - 与 Accenture 的嵌入式评估（2026 年 9 月 18 日）](https://www.anthropic.com/news/accenture-embedded-evaluation)
- [Anthropic - 改进我们的对齐与安全工作（2026 年 8 月 31 日）](https://www.anthropic.com/news/improving-alignment-security-efforts)
- [Advent International - OpenAI 推出 OpenAI Deployment Company](https://www.adventinternational.com/news/openai-launches-the-openai-deployment-company-to-help-businesses-build-around-intelligence/)
- [Aced - OpenAI FDE 岗位与流程](https://www.aced.io/jobs/fde/openai)
- [Management Consulted - BCG X Forward Deployed AI Engineer](https://managementconsulted.com/bcg-forward-deployed-ai-engineer/)
- [Linux Foundation Training - MCPA 认证](https://training.linuxfoundation.org/certification/model-context-protocol-associate-mcpa/)
- [OpenAI - 不对齐报告（DNS 出站事件）](https://alignment.openai.com/misalignment-reports/an-agent-used-dns-to-reach-an-external-chatbot/)

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
- [Sundeep Teki - 如何获得 OpenAI/Anthropic/DeepMind 的录用 2026](https://www.sundeepteki.org/advice/how-to-get-hired-at-openai-anthropic-and-google-deepmind-in-2026)
- [Sundeep Teki - AI Research Engineer（人工智能研究工程师）面试指南](https://www.sundeepteki.org/advice/the-ultimate-ai-research-engineer-interview-guide-cracking-openai-anthropic-google-deepmind-top-ai-labs)
- [Sundeep Teki - FDE（前线部署工程师）面试](https://www.sundeepteki.org/advice/the-definitive-guide-to-forward-deployed-engineer-interviews-in-2026)
- [Hashnode - FDE（前线部署工程师）完整指南 2026](https://hashnode.com/blog/a-complete-2026-guide-to-the-forward-deployed-engineer)

### 面试流程来源
- [Design Gurus - System Design（系统设计）面试的变化 2026](https://designgurus.substack.com/p/system-design-interviews-changed)
- [IGotAnOffer - Anthropic 面试流程](https://igotanoffer.com/en/advice/anthropic-interview-process)
- [Jobright - Anthropic 技术面试问题完整指南 2026](https://jobright.ai/blog/anthropic-technical-interview-questions-complete-guide-2026/)
- [Sierra - AI-Native（人工智能原生）面试](https://sierra.ai/blog/the-ai-native-interview)
- [Alexey Grigorev - AI Engineering（人工智能工程）实战指南（面试流程）](https://github.com/alexeygrigorev/ai-engineering-field-guide/blob/main/interview/01-interview-process.md)
- [interviewing.io - Meta AI-Assisted Coding Interview（人工智能辅助编程面试）](https://interviewing.io/blog/how-to-use-ai-in-meta-s-ai-assisted-coding-interview-with-real-prompts-and-examples)
- [Exponent - OpenAI System Design（系统设计）面试 2026](https://www.tryexponent.com/blog/openai-system-design-interview)
- [Exponent - Anthropic System Design（系统设计）面试 2026](https://www.tryexponent.com/blog/anthropic-system-design-interview)
- [Anthropic - 候选人 AI 指南](https://www.anthropic.com/candidate-ai-guidance)
- [Business Insider - Google 面试改革与 Gemini 试点（2026 年 5 月）](https://www.businessinsider.com/google-job-interview-software-engineers-ai-assistant-coding-2026-5)
- [Business Insider - 企业将面试重新移回线下（2026 年 7 月）](https://www.businessinsider.com/ai-job-interviews-in-person-nick-bloom-rto-2026-7)
- [DG Learning - Meta AI 辅助编码轮内幕](https://dglearning.substack.com/p/inside-metas-new-ai-enabled-coding)
- [Aced - Anthropic 系统设计面试](https://www.aced.io/blog/anthropic-system-design-interview)
- [Exponent via WashU McKelvey - 45+ 道 AI 工程师面试题（2026 年 9 月）](https://mckelveyconnect.washu.edu/blog/2026/09/17/45-ai-engineer-interview-questions-answers-2026-guide/)

### 新兴岗位报道
- [AI Career Lab - Agentic-AI（智能体式人工智能）岗位指南 2026](https://theaicareerlab.com/blog/agentic-ai-jobs-guide-2026)
- [Practical DevSecOps - 顶尖新兴 AI Security（人工智能安全）岗位 10](https://www.practical-devsecops.com/emerging-ai-security-roles/)
- [Fast Company - Google/Box CEO：FDE（前线部署工程师）是需求最高的岗位](https://www.fastcompany.com/91541878/google-box-ceos-say-this-is-the-most-in-demand-job-in-tech)
- [Computerworld - 因 AI（人工智能）转变而兴起的 FDE（前线部署工程师）职业](https://www.computerworld.com/article/4171867/heres-one-career-emerging-from-the-ai-shift-forward-deployed-engineers.html)
- [Rootly - AI SRE（人工智能站点可靠性工程）指南 2026](https://rootly.com/ai-sre-guide)
- [Resolve.ai - 什么是 AI SRE（人工智能站点可靠性工程）](https://resolve.ai/glossary/what-is-ai-sre)
- [Medium - MCP（模型上下文协议）技能的兴起](https://medium.com/@adnanmasood/the-rise-of-model-context-protocol-mcp-skills-5f0d6a1c3579)

### 合规与监管
- [EU AI Act（欧盟人工智能法案）实施时间线](https://artificialintelligenceact.eu/implementation-timeline/)
- [Secure Privacy - EU AI Act（欧盟人工智能法案）合规 2026](https://secureprivacy.ai/blog/eu-ai-act-2026-compliance)
- [Augment Code - EU AI Act（欧盟人工智能法案）指南 2026](https://www.augmentcode.com/guides/eu-ai-act-2026)

---

*另见：[题库](01-question-bank.md) | [答题框架](02-answer-frameworks.md) | [AI（人工智能）岗位行为面试](05-behavioral-for-ai-roles.md) | [岗位转型指南](../TRANSITION_GUIDE.md)*
