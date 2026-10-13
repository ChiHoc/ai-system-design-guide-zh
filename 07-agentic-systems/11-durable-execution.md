# 面向长期运行 Agent 的 Durable Execution（持久化执行）

Agent（智能体）运行并不是一个请求/响应处理器。它会调用工具、读取文档、触发操作、等待审批，并在可能持续数分钟、数小时甚至数天的步骤之间携带状态。这与普通基础设施并不兼容：进程会被杀掉、节点会回收、部署会滚动重建 Pod。一个天真的 agent（智能体）循环如果只在内存中持有状态，在上述任何事件发生时都会丢失一切；天真的重试会重新执行副作用。**Durable execution（持久化执行）**是一套让长期运行的 agent 得以经受这一切的纪律。本章涵盖该模型、相关工具、它如何映射到 agent 循环，以及何时值得承担其复杂性。

## 目录

- [为什么 Agent 会打破常规故障模型](#为什么-agent-会打破常规故障模型)
- [持久化执行模型](#持久化执行模型)
- [工具](#工具)
- [将持久化执行映射到 Agent 循环](#将持久化执行映射到-agent-循环)
- [托管式智能体运行时：租用持久循环](#托管式智能体运行时-租用持久循环)
- [何时需要它](#何时需要它)
- [你是否需要持久化执行？](#你是否需要持久化执行)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 为什么 Agent 会打破常规故障模型

Agent（智能体）是长期运行、具状态、会产生副作用的进程，这打破了三类假设：

- **Exactly-once（恰好一次）副作用。**如果某次工具调用成功，但 Agent 在记录之前崩溃，恢复后的运行可能会重试该调用，从而导致重复支付、重复工单或重复部署。核心歧义在于，活动中途崩溃后，你无法判断副作用是已经提交，还是仅仅丢失了确认响应，因此天真重试会把它执行两次。
- **可在重启后继续的人机协同暂停。**Agent 可能需要因为审批而阻塞数小时或一天，同时又不能丢失进度或白白消耗计算资源。若暂停仅保存在进程内存中，下次部署就会消失。
- **已记录的非确定性。**你不能重放一次 LLM 调用并假装它是同一个事件；相同提示词可能产生不同响应。输出必须在第一次时被记录，并在恢复时复用。

天真重试会重新执行副作用；天真的 checkpoint（检查点）若只在步骤之间保存状态，仍会在执行副作用与记录其结果之间留下不安全窗口。需要讲清楚的区别是：**checkpoint（检查点）捕获的是状态，而 durable execution（持久化执行）捕获的是步骤日志**，仅凭状态快照无法安全地从副作用执行到一半的位置恢复。

---

## 持久化执行模型

核心模式是**workflow-as-code（工作流即代码）+ 追加写入的事件历史 + 确定性 replay（重放）**。像 Temporal 这样的系统会为每个 workflow（工作流）记录不可变的事件历史；如果一个 worker（工作节点）在 10 步中的第 5 步崩溃，另一个 worker 会重放历史来重建内存中的状态，并从第 6 步继续。

确定性约束的来源是这个承重概念：恢复是*通过重放*实现的，因此在重放期间，执行步骤必须与日志中的步骤一致，否则系统无法保证恢复。这意味着 **workflow（工作流）代码本身必须是 deterministic（确定性的）**：不能直接调用当前时间，不能直接生成随机数或 UUID，不能直接发起网络请求，不能在 workflow 代码内部产生非确定性的线程交错。非确定性和副作用会被下沉到 **activities（活动）** 中，它们的结果只记录一次，之后都从日志中重放。

构成要素：
- **Activities（活动）**是副作用和非确定性唯一存在的地方；每个活动都可独立重试。
- **Exactly-once（恰好一次）activities**使用 idempotency keys（幂等键），通常由 workflow（工作流）和步骤 ID 派生，这样重试的工具调用不会重复执行。
- **Durable timers（持久定时器）**会被持久化，并在 worker 重启和部署后继续存在，因此 workflow 可以等待数天而不必让进程一直占着。
- **Signals（信号）**把外部事件（审批、取消）推入正在运行的 workflow；配套的 **queries（查询）**则在不修改状态的前提下读取其当前状态（状态、监控）。当 workflow 等待 signal 或 timer 时，worker 处于空闲状态并且不消耗计算资源，直到事件到来，然后重放历史并继续执行。

基于重放的确定性所带来的代价是 **versioning（版本管理）**：因为长期运行的 workflow 需要重放旧历史，修改 workflow 代码可能会破坏重放并引发事故，除非进行谨慎的版本管理。这是最常被提及的运维风险。

---

## 工具

| 工具 | 状态存放位置 | 资源占用 | 说明 |
|------|-------------------|-----------|-------|
| **Temporal**（参考实现） | 独立集群（或 Temporal Cloud） | 高 | 事件历史加确定性重放；多语言支持；已在大规模场景验证；与 agent 框架集成最深入。 |
| **Restate** | 轻量引擎，sidecar 或嵌入式 | 低 | 为每一步写入日志；增加 Virtual Objects（虚拟对象），即按用户/会话键划分的有状态会话，并带自动并发控制。 |
| **DBOS** | Postgres 行 | 最低 | 一个可导入的库；工作流状态和事务型副作用可以共享同一个 Postgres 事务，从而让数据库步骤实现 exactly-once（恰好一次）；无需独立集群。 |
| **Inngest** | 托管式，事件驱动 | 低 | 对步骤进行独立重试，并提供面向 AI 的原语，以及内置的并发和限流以适配 LLM 速率限制。 |
| **AWS Step Functions** | AWS 托管 | 托管 | 工作流是声明式状态机（而不是通用代码）；最近新增了 agent-runtime 集成。 |

这些方案在持久化边界放置的位置上不同。Temporal 用运维开销换取规模；DBOS 把持久化能力收敛到你现有的数据库里；Restate 是面向 HTTP/gRPC 的持久化会话；Inngest 是事件驱动且 TS-first；Step Functions 是 AWS 原生，但更偏声明式而不是通用代码。

---

## 将持久化执行映射到 Agent 循环

核心映射是：**agent 循环变成一个 workflow，而每次模型调用和工具调用都变成一个 durable activity（持久活动）**。发生崩溃时，已完成的模型调用和工具调用会从日志中重放，而不是重新执行，因此你不会重复消耗 token，也不会再次触发副作用，而且你甚至可以在修复 bug 后继续恢复正在运行的应用。

2026 年的集成格局：
- **Temporal + OpenAI Agents SDK** 在 2026 年初达到正式可用（GA），将每次 agent 调用和工具调用都封装为 durable activity（持久活动）。
- **Temporal + Google ADK** 仍处于实验阶段，通过活动重新路由 LLM 调用，值得注意的是它只需要极少的代码改动（封装层会检测自己是否运行在 workflow 内部，否则回退到直接执行）。
- **LangGraph** 通过 **checkpointers（检查点器）** 提供更轻量、框架原生的持久化，在每个 super-step（超步）将图状态保存到持久化存储，并支持可选的持久化模式（退出时、异步，或每一步前同步）。它的指导原则与确定性规则一致：保持 workflow 确定且幂等，并把副作用包裹到 task（任务）中。
- **DBOS 和 Restate** 在库层面与 agent 框架集成，把 agent 运行和 sub-agent（子智能体）调用封装成持久化 workflow 和 child workflows（子工作流）。
- **Temporal + Amazon Bedrock AgentCore Runtime** 于 2026 年 9 月 21 日进入预发布阶段：Temporal 工作流运行持久化智能体循环，模型与工具调用作为带重试策略的活动，Strands Agents 提供编程模型，AgentCore Runtime 为 Temporal Serverless Workers 提供计算资源。

这里要诚实说明的张力是：**框架原生 checkpointing（检查点）只能恢复状态；完整的 durable-execution（持久化执行）引擎还额外提供 exactly-once（恰好一次）副作用、durable timers（持久定时器）、signals（信号）以及跨部署的 replay（重放）语义。** 当工具调用具有不可逆的外部效果时，这个差异最关键。对于主要依赖可恢复、幂等工具的 LLM 推理型 agent，框架级 checkpointing 再加上少数非幂等工具上的幂等键，通常就已经足够。

贯穿其中的典型模式是：当拟议动作有风险时，workflow 会暂停并通过 signal 等待人工审批，等待期间不消耗算力，然后再以持久方式恢复并继续执行，这正是 [human-in-the-loop（人机协同）](08-human-in-the-loop-patterns.md) 审批闸门的 crash-proof（崩溃安全）实现。

---

## 托管式智能体运行时：租用持久循环

截至 2026 年 9 月，Anthropic 和 OpenAI 都把智能体运行框架本身作为内置持久会话的托管运行时出售（OpenAI 的 Agents API 于 9 月 10 日加入 Claude Managed Agents 的行列）；AWS 还在自有云中提供 OpenAI 的方案。这在“框架检查点”和“自行运行持久执行引擎”之外增加了第三种选择：租用循环。

| 平台 | 状态（2026 年 10 月 1 日） | 持久性与控制功能 | 需核对的限制 |
|----------|--------------------------|---------------------------------|----------------------|
| **Claude Managed Agents** | 已发布 | 持久会话；达到 `budget_reached` 后暂停的会话硬预算（8 月 7 日）；通过 cron 定时部署（自 6 月 9 日起）；借助 `ant apply` 和已提交的 `claude-lock.json` 实现 agents-as-code（ant CLI 1.30.0，9 月 3 日）；服务器侧评估的自动权限策略和实时终端接入（9 月 10 日） | 按词元加运行时间每会话小时 $0.08 计费（空闲时间免费）；无 Batch 折扣 |
| **OpenAI Agents API** | 公开 beta（9 月 10 日） | 托管 Codex 运行框架：持久会话、上下文压缩、恢复、子智能体委派、通过 HTTP 的 MCP 服务器、运行中引导；OpenAI 托管或自托管沙箱；托管浏览器的计算机使用（9 月 29 日） | 发布时仅支持美国数据驻留且无 Zero Data Retention；按模型、工具和容器计费（沙箱每 20 分钟会话 $0.03 至 $0.48） |
| **Amazon Bedrock Managed Agents**（由 OpenAI 提供支持） | 预览（9 月 29 日） | 在 AWS 内运行的定制 OpenAI Agents API：逐智能体 IAM 角色、CloudTrail 日志、持久会话、重要操作前的人工审批 | 仅支持 us-east-1、us-east-2 和 us-west-2；预览期间不额外收费 |
| **AWS AgentCore Runtime V2** | 9 月 18 日宣布 | 从已初始化智能体的快照恢复各实例；P75 冷启动约 2 秒，原运行时约 5.4 至 30 秒（AWS 报告） | 通过 `platformVersion` V2 主动启用；费率更高，但 GB 小时数大幅减少 |
| **Microsoft Foundry Agent Service** | Routines 于 9 月 24 日 GA | 已发布智能体支持周期性、单次定时和事件触发 | 网络出站控制仍处预览 |

租用得到的是无需运维集群的崩溃恢复、上下文压缩、触发器、预算和审批。但它**不能为自有的副作用工具提供恰好一次语义**。托管运行时可以恢复会话，却无法判断你的支付 API 在崩溃前是否已提交，因此非幂等工具仍需要幂等键；多步骤副作用还需要在工具后方由你自己维护持久化工作流。其他成本是运行框架层的锁定（agents-as-code 文件、会话语义和事件格式均为厂商特有），以及数据驻留或保留方面的缺口；对于受监管数据，这些因素可能在技术比较前就排除某个平台。Bedrock Managed Agents 在 AWS 内运行 OpenAI 的框架，最能说明集成单元正从模型端点转向运行框架。

---

## 何时需要它

Durable execution（持久化执行）正在成为 *production*（生产）级 agent 可靠性的答案，而 2026 年的落地势头是真实存在的：继较早的 D 轮融资后，Temporal 于 2026 年 9 月 14 日以 $12.55B 估值完成 $550M 的 E 轮融资；据其报告，8 月有 1.9 万亿次计费动作（同比增长超过 350%）、付费客户超过 4,300 家，OpenAI 对 Temporal 的使用量在不到一年内增长 60 倍（均为公司报告数据）。一个广泛引用的厂商案例描述了一个 deep-research agent（深度研究智能体）在遇到竞态、脆弱的自定义重试逻辑和陈旧状态 bug 后，**从框架原型迁移到了 durable-execution（持久化执行）引擎**；这是厂商发布的说法，因此可以把方向视为真实存在，而把叙事框架视为厂商视角。

但这是一种刻意的复杂度权衡。相关约束（确定性、版本管理风险、全新的测试和监控模型）都是真实存在的，而对于主要是只读、短生命周期或单次执行的 agent，**框架原生 checkpointing（检查点）或队列加幂等键通常就已经足够**，而且运维成本低得多。DBOS 和 Restate 相比完整集群显著降低了进入门槛，所以如果你的顾虑是运维开销，那么库加 Postgres 的方式可能能拿到大部分价值。

---

## 你是否需要持久化执行？

按顺序判断：

1. **是否有任何工具调用会产生不可逆的外部副作用**（支付、邮件、部署、工单、跨系统写入）？如果没有：框架级 checkpointing（检查点）或重试/队列可能就足够。若有：继续。
2. **单次运行是否可能超出你的进程或部署周期，或者必须跨重启等待人工审批？** 如果没有：内存状态加完成时 checkpoint 可能就够了。若有：你需要 durable timers（持久定时器）和持久化暂停。
3. **在崩溃后把整个 agent 重跑一遍，是否会在成本、重复副作用或数小时进度丢失上不可接受？** 如果是：你需要 replay（重放）和 exactly-once（恰好一次），因此 durable execution（持久化执行）是合理的。
4. **选择哪一档：** 如果副作用主要是写你自己的 Postgres，而且你希望一次部署完成，选 DBOS；如果需要低运维、HTTP-native（HTTP 原生）的有状态会话，选 Restate；如果偏向事件驱动、TS-first（TypeScript 优先）、AI-native 的速率控制，选 Inngest；如果你全栈都在 AWS 上且能接受声明式状态机，选 Step Functions；如果是大规模、复杂的长期运行流程，并且需要最深入的 agent-framework 集成，选 Temporal；如果数据驻留、保留和定价适合，且倾向于租用循环而非自行运行，可选托管式智能体运行时（Claude Managed Agents、OpenAI Agents API、Bedrock Managed Agents）；如果 agent 主要是带可恢复工具的推理，也可以继续使用框架原生持久性（LangGraph checkpointers）并配合幂等键。

对于简单 CRUD、亚毫秒热路径、纯高吞吐流式处理，或者一个小团队且需求已经被“带死信处理器的队列”覆盖，这通常是过度设计。

---

## 面试题

### Q: 为什么对于带副作用的生产 agent，天真的重试和 checkpoint（检查点）都不够？

**优秀答案：**
因为 agent 崩溃会制造一个重试无法安全消除的歧义。如果 agent 调用了一个会扣卡的工具然后崩溃，仅凭状态快照，你无法判断扣款是在崩溃前已提交，还是仅仅丢失了确认回执，因此天真重试可能导致重复扣款。一个只在步骤之间保存 state（状态）的普通 checkpoint（检查点）仍然会在执行副作用与记录它已发生之间留下不安全窗口。durable execution（持久化执行）通过捕获 step journal（步骤日志）而不只是最新状态来关闭这个窗口：每个产生副作用的步骤都会被记录为带 idempotency key（幂等键）的 activity（活动），因此在重放时，已完成的 activity 会返回其记录结果，而不是重新执行。这为副作用提供 exactly-once（恰好一次）语义，并让 workflow 从它失败的精确位置恢复，而不是从头开始。

### Q: 什么时候 durable execution（持久化执行）是过度投入？你会改用什么？

**优秀答案：**
当 agent 没有不可逆副作用、运行时长足够短，能够装进进程和部署周期之内，并且失败后简单重跑也可以接受，比如只读研究或摘要 agent 搭配幂等工具时，durable execution（持久化执行）就显得过重。此时我会使用像 LangGraph checkpointer（检查点器）这样的框架原生持久化来恢复 state（状态），再给少量非幂等调用加幂等键，并配合带死信处理器的重试队列。像 Temporal 这样的完整引擎带来的确定性约束和版本管理风险是真实成本，所以我只会在 agent 有不可逆影响、必须跨重启等待人工审批，或者长到崩溃后重跑不可接受时才采用它。如果运维开销是主要阻碍，但我仍然需要持久化，那么像 DBOS 这样的库式方案可以利用现有的 Postgres，在不运行集群的前提下拿到大部分收益。

### 问：你会用 Temporal 构建智能体，还是租用 OpenAI Agents API、Claude Managed Agents 这样的托管式运行时？

**优秀答案：**
我会将智能体循环与副作用分开考虑。租用循环很有吸引力：无需运维集群就能得到持久会话、上下文压缩、触发器、会话支出上限和由策略评估的审批，而且厂商会针对自己的模型调优运行框架。但我会先核对三件事。合规：OpenAI Agents API 发布时只支持美国数据驻留，没有 Zero Data Retention，对受监管数据可能直接构成限制。语义：托管运行时能恢复会话，却不能保证我的支付或工单工具恰好执行一次，因此它们仍需要幂等键，或在工具接口后方拥有自己的持久工作流。锁定：agents-as-code 文件、事件格式和会话语义都是厂商特有的，以后迁移需要重写，模型选择也会与运行框架选择耦合。我通常采用混合方案：主要进行推理并使用幂等工具的智能体租用循环；不可逆的多步骤操作（退款、资源开通）保留在 Temporal 或 DBOS 工作流中，并作为单个工具暴露给智能体，让必须恰好执行一次的部分处于我能控制的位置。

---

## 参考资料

- Resonate, ["From where do deterministic constraints come?"](https://journal.resonatehq.io/p/from-where-do-deterministic-constraints)
- Restate, ["What is durable execution?"](https://www.restate.dev/what-is-durable-execution)
- Temporal, [OpenAI Agents SDK integration](https://temporal.io/blog/announcing-openai-agents-sdk-integration)、[Series D announcement](https://temporal.io/news/temporal-raises-300M-to-make-agentic-ai-real-for-companies) 和 [Series E announcement](https://temporal.io/news/temporal-raises-550m-at-a-12-55b-valuation)
- OpenAI, [Agents API 概览](https://developers.openai.com/api/docs/guides/agents-api/overview)
- Anthropic, [Claude Platform 发布说明（Managed Agents）](https://platform.claude.com/docs/en/release-notes/overview)
- Temporal, [prototype to production-ready agentic AI: a Grid Dynamics case study](https://temporal.io/blog/prototype-to-prod-ready-agentic-ai-grid-dynamics)
- Google ADK, [Temporal integration](https://adk.dev/integrations/temporal/)
- LangChain, [durable execution in LangGraph](https://docs.langchain.com/oss/python/langgraph/durable-execution)
- Diagrid, ["Checkpoints are not durable execution"](https://www.diagrid.io/blog/checkpoints-are-not-durable-execution-why-langgraph-crewai-google-adk-and-others-fall-short-for-production-agent-workflows)

---

*下一篇: [循环工程](12-loop-engineering.md)*
