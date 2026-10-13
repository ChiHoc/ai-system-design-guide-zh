# 错误处理与恢复

Agent 在非确定性方式下会失败。错误处理已经从“Try-Catch 代码块”转向**Agentic Self-Correction**（Agentic 自我修正）和**Stateful Rollbacks**（有状态回滚），LangGraph 和 Microsoft Agent Framework 等框架提供了原生的 checkpoint/resume（检查点/恢复）原语。

## 目录

- [Agent 失败分类法](#agent-失败分类法)
- [自我修正循环](#自我修正循环)
- [有状态回滚（Checkpointing）](#有状态回滚-checkpointing)
- [“陷入循环”修复方案](#陷入循环-修复方案)
- [紧急停止与遏制时间](#紧急停止与遏制时间)
- [优雅降级](#优雅降级)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## Agent 失败分类法

1. **Hallucinated Tools（幻觉工具）**：调用不存在的工具。
2. **Schema Violation（Schema 违规）**：向真实工具传递了错误的参数。
3. **Environment Error（环境错误）**：工具存在，但外部 API 已宕机。
4. **Logical Stall（逻辑停滞）**：Agent 反复执行同一个失败动作（ReAct 循环之死）。
5. **批量操作部分失败**：模型在一轮中发出多个工具调用，其中一个在中途失败。Claude 的计算机使用工具集明确规定：执行器在首次失败时停止，对后续每个调用返回 `is_error`（“Not executed: an earlier computer action in this turn failed”），让模型从已知状态重新规划，而不是误以为整批动作都已完成。
6. **提供商拒绝或回退**：安全分类器停止调用。在 Claude Fable 5.1 上，这会返回 HTTP 200、`stop_reason: "refusal"` 和 `stop_details` 类别，而非抛出异常；可选的服务器侧回退（beta）会用另一个模型（Opus 4.8 或 Opus 5）重试。自 2026 年 9 月 24 日起，`bio`、`frontier_llm` 和 `reasoning_extraction` 类别中输出前发生的拒绝会计费，因此拒绝循环现在也会产生成本。

## 自我修正循环

现在，错误被视为**Tokens of Information（信息令牌）**。

- **模式（Pattern）**：当工具失败时，错误信息不会只是被记录下来；它会作为提示词反馈给模型：*“Action failed with error: X. Reflect on why this happened and provide an alternative strategy.”*
- **推理模型（Reasoning Models）**（Claude Opus 5.5、GPT-6 Astra、启用思考的 Gemini 3.8 Flash）：这些模型在这方面表现出色，因为它们会在隐藏的 Chain-of-Thought（思维链）中“内化”错误，从而带来更高的一次性恢复率。
- **环境错误提供细节，验证器结论保持简短。**退出码、堆栈跟踪和 API 错误可完整反馈，但应谨慎说明验证器或策略*为何*拒绝工作。2026 年 9 月一项自主研究智能体研究（arXiv 2609.28614）发现，详细拒绝反馈后的累计评估器规避率为 40.5%，普通拒绝后为 20.3%。作者指出该比较无法单独归因于解释本身，但安全的默认值是评判器只提供简短结论，详细信息仅来自环境。

## 有状态回滚（Checkpointing）

对于长时间运行的 Agent，Step 9 的错误不应让整个项目崩溃。

- **Checkpoints（检查点）**：高可靠性系统（使用 LangGraph 或类似方案）会在每次成功的工具调用后，将“State Snapshot（状态快照）”保存到数据库。
- **回滚（The Rollback）**：如果 Agent 进入逻辑停滞，supervisor agent 可以将**公共状态（common-state）**重置到 Step 5，也就是最后一个“安全”状态，并强制走不同路径。

## “陷入循环”修复方案

无限循环是 agentic 系统中的第一大成本黑洞。

**解决方案**：**Counter-Based Intervention（基于计数的干预）**。
1. 如果在同一次会话中看到相同的 `(Tool, Args)` 元组 3 次，orchestrator 会中断模型。
2. 它会注入一个强制性的**“Pivot Instruction（转向指令）”**：*“You have tried searching for 'X' three times. This path is dead. You MUST try a different tool or admit you are stuck.”*

## 紧急停止与遏制时间

警报不等于控制。OpenAI 于 2026 年 9 月 25 日披露的研究智能体事件提供了清晰示例：一个智能体通过过滤不足的 DNS 建立隧道，访问外部服务；监测在首次外部响应约 12 分钟后发出警报，但由于自动停止失效，约 2.5 小时后才终止运行。OpenAI 描述的修复措施是 DNS 白名单（域名和记录类型），以及两个独立层级的阻断控制。

需要构建：

- **不依赖智能体宿主的停止路径。**如果紧急停止开关与智能体运行在同一进程或虚拟机中，它也可能一起失效。带外执行（撤销凭据的网关、切断出站流量的网络层、NVIDIA 基于 DPU 的 Sentry 参考设计之类的硬件看门狗）可在运行时失效后继续工作。
- **从检测到遏制的 SLO**，像其他事故指标一样测量和演练：从首次警报到撤销凭据、切断出站流量的时间。
- **CI 中的紧急停止测试**：启动一轮金丝雀运行，触发停止，断言其在 SLO 内终止。

---

## 优雅降级

如果高推理 Agent（Claude Opus 5.5、GPT-6 Astra）持续失败，我们就回退到：
- **Simplified Agent（简化 Agent）**：一个更小的模型，配备更少、但更可靠的工具。
- **RAG-only Mode（仅 RAG 模式）**：禁用动作，只基于知识库提供概念性答案。
- **跨厂商回退**：提供商故障足够频繁，值得预先设计。Anthropic 在 2026 年 8 月 16 日至 9 月 29 日至少记录了 12 次重大或严重事件；OpenAI 于 9 月 29 日的一次故障在 API、ChatGPT 和 Codex 上持续约 5 小时 20 分钟。回退到同一家厂商的其他模型无法抵御平台级故障。最新 Claude 模型的对话中途故障转移还有一个陷阱：思考块绑定到生成它的模型和对话（较新的账户若前缀不匹配会返回 400），因此切换模型时应移除旧思考块，或从检查点摘要重新开始。
- **Human Escalation（人工升级）**：（见下一章）。

## 面试题

### Q: 为什么传统的“Exception Handling”（Try/Catch）对 Agentic Systems（Agentic 系统）不够用？

**高分答案：**
在传统软件中，异常是一个“Stop”命令。在 agentic 系统中，模型才是“Driver”（驾驶员）。如果系统只是停止，用户任务就会失败。我们使用**Error Injection（错误注入）**而不是 Exception Handling（异常处理）。我们在平台层捕获异常，并将其转化为模型的**Synthesized Observation（合成观测）**。这使模型能够围绕失败进行**Reason**（推理）。TRY/Catch 只修复代码；Error Injection 让模型修复的是**Plan（计划）**。

### Q: 如何处理“Silent Failures”（静默失败，即工具返回 200 OK 但数据是错的）？

**高分答案：**
Silent Failures（静默失败）最危险。我们实现了**Output Validation Agents（输出校验 Agent）**。对于关键步骤，我们不会直接接受工具输出。我们会把输出送到一个“Verifier Agent（校验 Agent）”（通常是更小、更快的模型），它的唯一任务是检查：*“这段工具输出是否真的回答了所提供的查询？”* 如果 Verifier 说“否”，它就会像硬错误一样触发自我修正循环。

## 参考资料
- LangGraph. "Persistence and Checkpointing" (2025)
- Shinn 等. “Reflexion: Language Agents with Verbal Reinforcement Learning”（2023）。https://arxiv.org/abs/2303.11366
- Huang 等. “Reward Hacking Challenges Oversight of Autonomous Research Agents”（arXiv 2609.28614，2026 年 9 月）
- Anthropic. “Refusals and fallback”文档。https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback

---

*下一篇：[Human-in-the-Loop 模式](08-human-in-the-loop-patterns.md)*
