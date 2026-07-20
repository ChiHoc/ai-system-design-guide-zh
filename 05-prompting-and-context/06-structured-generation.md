# Structured Generation（结构化生成）

Structured Generation（结构化生成）是让 LLM 以机器可读格式（JSON、YAML、CSV）输出内容的过程，并且要求达到 100% 的可靠性。这一领域已经从“基于 prompt 的请求”转向“引擎级约束”。

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
**标准做法**：使用原生 `response_format: { type: "json_schema" }`（OpenAI/Gemini）或工具输出 schema（Anthropic）。

- **收益**：100% 的语法有效性。模型实际上不可能输出一个不是合法 JSON 的字符串。
- **幕后机制**：服务引擎在每一步都会对词表进行 masking（遮罩），确保下一步只能选择有效的 JSON 字符（例如 `{`、`"`、`:`、`[`）。

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

---

## Constrained Decoding (CFG & Regex)（受限解码）

对于自托管模型（Llama-cpp、通过 Outlines 的 vLLM），我们使用 **Context-Free Grammars（上下文无关文法，CFG）** 或 **Regex（正则表达式）**。

```python
# Outlines Pattern
model = outlines.models.transformers("meta-llama/Llama-4-8B")
generator = outlines.generate.regex(model, r"(\d{3})-\d{3}-\d{4}")
# Result: The model can ONLY output telephone numbers.
```

---

## Multi-Stage Extraction Pattern（多阶段抽取模式）

对于复杂的数据抽取（例如从医疗记录中提取 50 个字段），不要一次完成。
- **Stage 1（第一阶段，Text-to-Text）**：提取一组“杂乱但完整”的事实，自然语言即可。
- **Stage 2（第二阶段，Text-to-JSON）**：使用更小、更便宜的模型，把这些自然语言事实转换为严格的 JSON schema。
- **收益**：降低“高压下幻觉”——大模型在同时需要推理并遵循严格语法时会更吃力。

---

## Validation & Formatting Errors（校验与格式错误）

即使在“JSON mode”下，JSON 内部的 **Logic（逻辑）** 也可能是错的（例如，字段缺失或日期格式错误）。

**恢复模式**：
1. 使用 **Pydantic/Zod** 校验输出。
2. 如果失败，将 **Traceback（回溯信息）** 返回给模型：
   `"Error: Field 'age' must be an integer, got 'twenty'. Fix and re-generate."`
3. 大多数模型会在第一次重试时修复这个错误。

---

## Interview Questions（面试问题）

### Q: 为什么 “JSON Mode” 比基于 prompt 的 JSON 请求更可靠？

**标准答案：**
基于 prompt 的请求依赖模型*愿意*遵循指令；而 “JSON Mode”（或 Constrained Decoding）依赖服务引擎*无法做别的事*。通过在推理层施加 “Logit Bias（对数几率偏置）” 或 “Grammar Mask（语法掩码）”，引擎将下一 token 的选择限制为仅符合 schema 的那些 token。这消除了“前导文本”（例如，“Sure, here is your JSON...”），并确保你不会因为高 temperature 或随机性而得到一个格式错误的字符串。

### Q: 一次向 LLM 请求过多结构化字段有什么风险？

**标准答案：**
这是 **Schema Complexity（schema 复杂度）** 与 **Information Integrity（信息完整性）** 之间的权衡。随着 schema 变大（例如 20+ 层级字段），模型的注意力会被用于维持 JSON 结构（括号、键、引号），而不是验证数据的准确性。这通常会导致“省略幻觉（Omission Hallucinations）”，即模型跳过字段或用占位数据填充。缓解方式是使用 “Chain-of-Density” 抽取，或将抽取拆分为多个并行子任务。

---

## References（参考资料）
- OpenAI. "Structured Outputs Documentation" (August 2024 update)
- Outlines Project. "Context-Free Grammar Guided Generation" (2024)
- Willard et al. "Efficient Guided Generation for LLMs" (2023)

---

*Next: [Prompt Optimization (DSPy)](07-prompt-optimization-dspy.md)*
