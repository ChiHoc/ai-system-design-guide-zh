# 人类在环模式（Human-in-the-Loop Patterns）

没有任何 agent 是 100% 可靠的。**Human-in-the-Loop（HITL，人类在环）** 是在高风险环境中确保安全性和准确性的桥梁。生产级技术栈已经超越了“Approval Buttons（审批按钮）”，转向 **Co-Reasoning（共推理）** 和 **Interrupt-Based Steering（基于中断的引导）**，并在 LangGraph（interrupt+resume）和 Microsoft Agent Framework 等框架中原生暴露。

## 目录

- [HITL 频谱](#hitl-频谱)
- [中断与断点](#中断与断点)
- [时间旅行调试（状态编辑）](#时间旅行调试-状态编辑)
- [共推理（共享草稿区）](#共推理-共享草稿区)
- [基于置信度的升级机制](#基于置信度的升级机制)
- [面试问题](#面试问题)
- [参考文献](#参考文献)

---

## HITL 频谱

| 模式 | Agent 自主性 | 人类角色 | 最适合用于 |
|---------|---------------|------------|----------|
| **Human-in-command（人类主导）** | 低 | 驱动每一步 | 高风险法律/医疗 |
| **Human-as-filter（人类过滤器）** | 中 | 批准/编辑最终输出 | 内容生成 |
| **Human-as-backup（人类备用）** | 高 | 仅在出错时介入 | 客户支持 |
| **Human-on-the-loop（人在回路外监督）** | 最高 | 任务完成后审计日志 | 高吞吐分析 |

---

## 中断与断点

现代架构（LangGraph、Microsoft Agent Framework）使用 **Deterministic Breakpoints（确定性断点）**。

- **模式**：系统被硬编码为在调用某个特定敏感工具之前“暂停”，例如 `execute_purchase` 或 `delete_user`。
- **决策**：环境等待用户发送 `approve` 或 `reject` 信号。
- **状态保留**：agent 的推理状态会在数据库中“冻结”，直到人类介入。

---

## 时间旅行调试（状态编辑）

标准 agent 是“单向”的。如果它在第 3 步犯错，整个会话通常就被毁了。
- **创新点**：**State Injection（状态注入）**。人类审阅者可以“回到”第 3 步的状态，编辑 agent 的 observation 或 thought，然后“恢复”执行。
- **影响**：它让人类无需从零开始，就能把 agent 从错误路径上“引回正轨”。

---

## 共推理（共享草稿区）

人类不再是“Judge（裁判）”，而是成为 **“Partner（伙伴）”**。
- agent 会把自己的 **Scratchpad（草稿区）**（内部思考）展示给人类。
- 其典型表述为：*“我计划因为 Fact B 而使用 Tool A。你觉得这样对吗？”*
- **收益**：在推理错误转化为动作之前就把它捕捉出来。

---

## 基于置信度的升级机制

使用支持 “Logprobs” 或内置推理步骤的模型时，我们会计算一个 **Uncertainty Score（不确定性分数）**。

- 如果该分数超过阈值，agent 会**自动暂停**并向人类操作员发送通知。
- **示例**：一个 agent 在尝试解决复杂账单争议时意识到用户意图含糊不清。它会停下来并说：*“我并不完全确定该如何处理这个特定的退款案例。请稍等，我去请一位人工专家来看一下。”*

---

## 面试问题

### Q: 你会如何设计一个不会让人类操作员“疲劳”的 HITL 系统？

**优秀回答：**
我们使用 **Threshold Tuning（阈值调优）**。我们不会对每一个动作都请求批准。我们只在以下情况触发 HITL：1）高风险的“Writing（写入）”工具，2）低置信度的推理步骤，或 3）违反业务设定的 “Policy（策略）” 的动作。此外，我们会向人类提供 **Contextual Summary（上下文摘要）**，而不是完整日志，只展示 agent 想做什么的 1 句 “Diff（差异）”。这把 “Review cognitive load（审核认知负荷）” 从分钟级降到了秒级。

### Q: HITL 中 “Over-Reliance（过度依赖）” 的风险是什么，你会如何缓解？

**优秀回答：**
过度依赖发生在人类开始在不阅读日志的情况下直接点 “Approve（批准）” 时。我们通过 **Forced Review Checkpoints（强制复核检查点）** 来缓解，例如要求人类必须至少修改拟议计划中的一个词；或者通过 **Synthetic Error Injections（合成错误注入）** 来缓解，即有意向人类展示一个“错误”计划，1% 的时间如此，以观察他们是否能发现。如果他们通过了这个 “Trap（陷阱）”，就继续；如果失败，就会被标记为需要额外培训。

## 参考文献
- Wu 等人. “Co-reasoning: Human-AI Collaboration Patterns” (2025)
- LangChain. “Human-in-the-loop in LangGraph” (2024/2025)
- Anthropic. “Designing for Safety and Human Oversight” (2024)

---

*下一篇：[Agentic 安全与沙箱](09-agentic-security-and-sandboxing.md)*
