# Structured Generation（结构化生成）

Structured Generation（结构化生成）是让 LLM 以机器可读格式（JSON、YAML、CSV）输出内容的过程，并且要求达到 100% 的语法可靠性。这一领域已经从“基于 prompt 的请求”转向“引擎级约束”；到 2026 年，过去最后一种提示时代的技巧（强制工具调用以获取 JSON）在最新 Claude 模型上也不再有效。

## 目录

- [The JSON Mode Revolution](#the-json-mode-revolution-json-模式革命)
- [Function Calling & Tool Use](#function-calling-tool-use-函数调用与工具使用)
- [Constrained Decoding (CFG & Regex)](#constrained-decoding-cfg-regex-受限解码)
- [Multi-Stage Extraction Pattern](#multi-stage-extraction-pattern-多阶段抽取模式)
- [Validation & Formatting Errors](#validation-formatting-errors-校验与格式错误)
- [Interview Questions](#interview-questions-面试问题)
- [References](#references-参考资料)

---

## The JSON Mode Revolution（JSON 模式革命）

从历史上看，获取 JSON 的过程一直是“只返回 JSON，不要其他文本”的一场拉锯。
**标准做法**：使用供应商原生的 JSON schema 输出。

| 提供商 | 原生结构化输出 |
|----------|--------------------------|
| **OpenAI** | Chat Completions 使用带 `json_schema` 的 `response_format`，Responses API 使用 `text.format`；函数工具可设置 `strict: true` |
| **Anthropic** | 带 JSON schema 的 `output_config.format`（旧 `output_format` 参数已弃用）；工具定义可设置 `strict: true` |
| **Google** | 响应 schema 加 JSON 响应 MIME 类型 |

- **收益**：100% 的语法有效性。模型实际上不可能输出一个不是合法 JSON 的字符串。
- **幕后机制**：服务引擎在每一步都会对词表进行 masking（遮罩），确保下一步只能选择有效的 JSON 字符（例如 `{`、`"`、`:`、`[`）。
- **需要检查的两种例外**：输出被 `max_tokens` 截断，以及安全拒绝（Claude 返回 `stop_reason: "refusal"`）。解析前先检查停止原因。

---

## Function Calling & Tool Use（函数调用与工具使用）

Function calling（函数调用）是一种结构化生成方式，LLM 会“选择”某个函数并填充其参数。

```json
// Example Tool Call
{
  "name": "get_stock_price",
  "arguments": { "symbol": "AAPL", "interval": "1d" }
}
```

**细微差别**：**Parallel Function Calling（并行函数调用）** 现在已成为标准。模型可以同时决定调用 5 个不同的工具（例如，检查账户余额、检查信用分数、检查贷款利率），并汇总结果。

**最新 Claude 模型已弃用强制工具调用技巧。**过去两年，从 Claude 获取 JSON 的标准办法是定义带目标 schema 的工具，再用 `tool_choice` 强制调用。Claude Fable 5.1（2026 年 9 月 1 日）、Opus 5.5（9 月 22 日）和 Sonnet 5.5（9 月 28 日）对 `tool_choice` 类型 `any` 和 `tool` 返回 400；`auto` 与 `none` 仍可使用。以 `{` 开始回复的助手预填充，在 Claude 4.6 及后续模型上也已返回 400。替代方案：

| 旧模式 | 替代方案 |
|-------------|-------------|
| 仅为获取 JSON 而强制工具调用 | 带 JSON schema 的 `output_config.format` |
| 在智能体步骤中强制某个工具 | `tool_choice: auto`，在提示中点名工具，并设置 `strict: true` 以保证参数符合 schema |
| 预填充 `{` 以开始 JSON | 结构化输出 |

框架也在底层改变路由：langchain-anthropic 1.7.3（2026 年 9 月 22 日）在 Fable 和 Opus 5.5 上让 `with_structured_output` 走 JSON schema 路径，1.7.5 又加入 Sonnet 5.5。如果自己的封装硬编码了 `tool_choice`，升级后会失败。OpenAI 一侧，GPT-6 Astra 的工具调用必须使用 Responses API。

---

## Constrained Decoding (CFG & Regex)（受限解码）

对于自托管模型，我们使用 **Context-Free Grammars（上下文无关文法，CFG）** 或 **Regex（正则表达式）**。vLLM 和 SGLang 在结构化输出选项后提供语法后端（XGrammar、llguidance），llama.cpp 使用 GBNF 语法，Outlines 可直接配合 Hugging Face 模型。

```python
# Outlines pattern (1.x API)
import outlines
from outlines.types import Regex
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL = "Qwen/Qwen3-8B"  # any Hugging Face causal LM
model = outlines.from_transformers(
    AutoModelForCausalLM.from_pretrained(MODEL, device_map="auto"),
    AutoTokenizer.from_pretrained(MODEL),
)
phone = model("Extract the phone number: call me at 415-555-0199", Regex(r"\d{3}-\d{3}-\d{4}"))
# Result: The model can ONLY output telephone numbers.
```

编译语法也有成本：大型 schema 或语法可能显著增加首次请求延迟，应缓存编译结果，并尽可能保持 schema 扁平。

---

## Multi-Stage Extraction Pattern（多阶段抽取模式）

对于复杂的数据抽取（例如从医疗记录中提取 50 个字段），不要一次完成。
- **Stage 1（第一阶段，Text-to-Text）**：提取一组“杂乱但完整”的事实，自然语言即可。
- **Stage 2（第二阶段，Text-to-JSON）**：使用更小、更便宜的模型，把这些自然语言事实转换为严格的 JSON schema。
- **收益**：降低“高压下幻觉”——大模型在同时需要推理并遵循严格语法时会更吃力。对推理模型，这种影响较小，因为思考阶段不受 schema 约束，只有最终答案受约束。
- **在最新 Claude 模型上移除 `reasoning` 字段。**过去常把 `reasoning` 字符串放在 schema 首位，让模型在填写答案字段前“思考”。在 Claude Fable 5.1、Opus 5.5 和 Sonnet 5.5 上，JSON 输出或工具输入中的 `reasoning`、`thinking`、`trace` 字段被列为触发 `reasoning_extraction` 拒绝的因素。让原生思考完成这项工作；审计需要理由时，使用简短的 `explanation` 或 `evidence` 字段。

---

## Validation & Formatting Errors（校验与格式错误）

即使在“JSON mode”下，JSON 内部的 **Logic（逻辑）** 也可能是错的（例如，字段缺失或日期格式错误）。

**恢复模式**：
1. 解析前检查停止原因（`max_tokens`、`refusal`）。
2. 使用 **Pydantic/Zod** 校验输出。
3. 如果失败，将 **Traceback（回溯信息）** 返回给模型：
   `"Error: Field 'age' must be an integer, got 'twenty'. Fix and re-generate."`
4. 大多数模型会在第一次重试时修复这个错误。

应使用 JSON 解析器处理工具参数，绝不要按字符串模式匹配：较新的 Claude 模型可能以不同方式转义工具输入中的 Unicode 或斜杠。

---

## Interview Questions（面试问题）

### Q: 为什么 “JSON Mode” 比基于 prompt 的 JSON 请求更可靠？

**标准答案：**
基于 prompt 的请求依赖模型*愿意*遵循指令；而 “JSON Mode”（或 Constrained Decoding）依赖服务引擎*无法做别的事*。通过在推理层施加 “Logit Bias（对数几率偏置）” 或 “Grammar Mask（语法掩码）”，引擎将下一 token 的选择限制为仅符合 schema 的那些 token。这消除了“前导文本”（例如，“Sure, here is your JSON...”），并确保不会因采样随机性而得到格式错误的字符串。但它不保证*内容*正确、不保证 `max_tokens` 截断时响应完整，也不保证模型拒绝时有输出，因此流水线仍需验证和检查停止原因。

### Q: 一次向 LLM 请求过多结构化字段有什么风险？

**标准答案：**
这是 **Schema Complexity（schema 复杂度）** 与 **Information Integrity（信息完整性）** 之间的权衡。随着 schema 变大（例如 20+ 层级字段），模型的注意力会被用于维持 JSON 结构（括号、键、引号），而不是验证数据的准确性。这通常会导致“省略幻觉（Omission Hallucinations）”，即模型跳过字段或用占位数据填充。缓解方法是将抽取拆成多个较小的并行子 schema，或先用自然语言提取、再分第二阶段结构化，并明确允许“未知”值，避免迫使模型编造数据。

### 问：抽取流水线曾强制 Claude 调用工具以获取 JSON，升级到 Opus 5.5 后每个请求都返回 400。你会如何调整？

**标准答案：**
Opus 5.5、Sonnet 5.5 和 Fable 5.1 拒绝 `tool_choice` 的 `any` 与 `tool` 类型，因此强制工具调用技巧不再适用。如果工具只是 schema 的载体，我会改为原生结构化输出（带相同 JSON schema 的 `output_config.format`），契约也更清楚。如果该步骤确实需要模型调用特定工具，则改为 `tool_choice: auto`，在指令中点名工具，设置 `strict: true` 保证实际调用时参数符合 schema；然后测量跳过调用的比例，并针对这种情况增加重试。我还会搜索代码库和框架版本中同期其他硬编码假设（采样参数、助手预填充、`budget_tokens`、schema 中的 `reasoning` 字段），因为它们在同类模型上也会失败或触发拒绝。

---

## References（参考资料）
- OpenAI. "Structured Outputs Documentation" (August 2024 update)
- [Anthropic。严格工具使用与结构化输出](https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use)
- [Claude API 发布说明（移除强制工具使用）](https://platform.claude.com/docs/en/release-notes/overview)
- [Anthropic。“拒绝与回退”：将推理保留在思考块中](https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback#keep-reasoning-in-thinking-blocks)
- Outlines 项目。“输出类型：Regex、CFG、JSON”（Outlines 1.x 文档）
- Willard 与 Louf。“Efficient Guided Generation for Large Language Models”（2023）
- Dong 等人。“XGrammar: Flexible and Efficient Structured Generation Engine for Large Language Models”（2024）

---

*Next: [Prompt Optimization (DSPy)](07-prompt-optimization-dspy.md)*
