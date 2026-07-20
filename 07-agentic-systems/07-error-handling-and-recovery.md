# 错误处理与恢复

Agent 在非确定性方式下会失败。错误处理已经从“Try-Catch 代码块”转向**Agentic Self-Correction**（Agentic 自我修正）和**Stateful Rollbacks**（有状态回滚），LangGraph 和 Microsoft Agent Framework 等框架提供了原生的 checkpoint/resume（检查点/恢复）原语。

## 目录

- [Agent 失败分类法](#agent-失败分类法)
- [自我修正循环](#自我修正循环)
- [有状态回滚（Checkpointing）](#有状态回滚-checkpointing)
- [“陷入循环”修复方案](#陷入循环-修复方案)
- [优雅降级](#优雅降级)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## Agent 失败分类法

1. **Hallucinated Tools（幻觉工具）**：调用不存在的工具。
2. **Schema Violation（Schema 违规）**：向真实工具传递了错误的参数。
3. **Environment Error（环境错误）**：工具存在，但外部 API 已宕机。
4. **Logical Stall（逻辑停滞）**：Agent 反复执行同一个失败动作（ReAct 循环之死）。

## 自我修正循环

现在，错误被视为**Tokens of Information（信息令牌）**。

- **模式（Pattern）**：当工具失败时，错误信息不会只是被记录下来；它会作为提示词反馈给模型：*“Action failed with error: X. Reflect on why this happened and provide an alternative strategy.”*
- **推理模型（Reasoning Models）**（Claude Opus 4.7 extended thinking、GPT-5.5 reasoning、DeepSeek-R2）：这些模型在这方面表现出色，因为它们会在隐藏的 Chain-of-Thought（思维链）中“内化”错误，从而带来更高的一次性恢复率。

## 有状态回滚（Checkpointing）

对于长时间运行的 Agent，Step 9 的错误不应让整个项目崩溃。

- **Checkpoints（检查点）**：高可靠性系统（使用 LangGraph 或类似方案）会在每次成功的工具调用后，将“State Snapshot（状态快照）”保存到数据库。
- **回滚（The Rollback）**：如果 Agent 进入逻辑停滞，supervisor agent 可以将**公共状态（common-state）**重置到 Step 5，也就是最后一个“安全”状态，并强制走不同路径。

## “陷入循环”修复方案

无限循环是 agentic 系统中的第一大成本黑洞。

**解决方案**：**Counter-Based Intervention（基于计数的干预）**。
1. 如果在同一次会话中看到相同的 `(Tool, Args)` 元组 3 次，orchestrator 会中断模型。
2. 它会注入一个强制性的**“Pivot Instruction（转向指令）”**：*“You have tried searching for 'X' three times. This path is dead. You MUST try a different tool or admit you are stuck.”*

## 优雅降级

如果高推理 Agent（Claude Opus 4.7、GPT-5.5 reasoning）持续失败，我们就回退到：
- **Simplified Agent（简化 Agent）**：一个更小的模型，配备更少、但更可靠的工具。
- **RAG-only Mode（仅 RAG 模式）**：禁用动作，只基于知识库提供概念性答案。
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
- Shinn et al. "Reflexion: Learning from Errors" (2024 update)
- Microsoft. "Managing Hallucinations in Agentic Systems" (2025)

---

*下一篇：[Human-in-the-Loop 模式](08-human-in-the-loop-patterns.md)*
