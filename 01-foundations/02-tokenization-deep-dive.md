# Tokenization（分词）深度解析

Tokenization（分词）是将文本转换为模型可处理的离散单元（token）的过程。它直接影响模型能力、成本与性能。

## 目录

- [分词为何重要](#为什么分词很重要)
- [分词算法](#分词算法)
- [词表设计权衡](#词表设计权衡)
- [特殊 token](#特殊-token)
- [多语种分词](#多语种分词)
- [用于成本估算的 Token 计数](#用于成本估算的-token-计数)
- [多语种分词](#多语种分词)
- [多模态分词](#多模态分词-像素到-token)
- [用于成本估算的 Token 计数](#用于成本估算的-token-计数)
- [常见分词问题](#常见分词问题)
- [实践中的分词模式](#实践中的分词模式)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 为什么分词很重要

### 对系统设计而言

1. **成本（Cost）**：LLM API 按 token 计费。分词效率会直接影响成本。
2. **上下文上限（Context limits）**：能放入上下文的内容由 token 数决定，而不是词数（word count）。
3. **能力（Capability）**：某些任务（字符计数、变位词 anagrams）之所以困难，是因为分词方式的影响。
4. **一致性（Consistency）**：同一段文本在不同模型中会被分词成不同结果。

### 用于理解 LLM 行为

**经典面试题**：为什么 GPT 在统计 `"strawberry"` 的字母时会很吃力？

因为 `"strawberry"` 会被分词为多个 subword（子词）。模型从来不会直接看到单个字符；它看到的是 subword 单元。统计字母需要对 token 的内部结构进行推理。

---

## 分词算法

### Byte Pair Encoding（BPE）

最常见的算法。由 GPT 系列、Llama、Qwen、DeepSeek 使用。

**训练算法：**
1. 从单个字节组成的词表开始（256 个 token）
2. 统计训练语料中所有相邻 token 对
3. 将最频繁的 token 对合并为一个新 token
4. 重复，直到达到词表大小

**示例：**
```
Corpus: "low lower lowest"
Initial: ['l', 'o', 'w', ' ', 'l', 'o', 'w', 'e', 'r', ' ', 'l', 'o', 'w', 'e', 's', 't']

Step 1: Most frequent pair is ('l', 'o'). Merge to 'lo'.
['lo', 'w', ' ', 'lo', 'w', 'e', 'r', ' ', 'lo', 'w', 'e', 's', 't']

Step 2: Most frequent pair is ('lo', 'w'). Merge to 'low'.
['low', ' ', 'low', 'e', 'r', ' ', 'low', 'e', 's', 't']

Step 3: Most frequent pair is ('low', 'e'). Merge to 'lowe'.
['low', ' ', 'lowe', 'r', ' ', 'lowe', 's', 't']

Continue until vocabulary size target...
```

**特性：**
- 在已训练词表下，分词结果是确定性的
- 常见词往往会成为单个 token
- 稀有词会拆分为子词

### WordPiece

由 BERT 家族模型使用。

**与 BPE 的关键区别：**
- BPE：按频率合并
- WordPiece：按似然提升合并

```
Score = freq(AB) / (freq(A) * freq(B))
```

这会偏向那些比随机共现更有意义的合并。

**视觉标记：**WordPiece 使用 `##` 前缀表示续接 token：
```
"embedding" becomes ["em", "##bed", "##ding"]
```

### Unigram（SentencePiece）

由 T5、ALBERT 和部分多语种模型使用。

**训练算法：**
1. 从较大的候选词表开始
2. 计算如果删除每个 token 会带来多少损失
3. 删除那些使损失增加最少的 token
4. 重复，直到达到词表大小

**关键区别：**它基于概率而不是频率工作。它可以从早期的次优合并中恢复。

### 对比

| 算法 | 合并准则 | 分词方式 | 使用者 |
|-----------|-----------------|--------------|---------|
| BPE | 频率 | 确定性 | GPT, Llama, Qwen |
| WordPiece | 似然 | 确定性 | BERT, DistilBERT |
| Unigram | 概率 | 概率性 | T5, mT5, XLNet |

---

## 词表设计权衡

### 词表规模

| 规模 | 示例 | 优点 | 缺点 |
|------|---------|------|------|
| 较小（10K） | 一些早期模型 | embedding 更小 | token 序列更长 |
| 中等（32K） | Llama 2, Mistral 7B | 平衡较好 | 多语种效率不足 |
| 较大（100K-152K） | GPT-4 (cl100k), Llama 3 (128K), DeepSeek V3 and V4.1 (~129K), Mistral Tekken (~131K), Qwen3 (~152K) | **开源模型的常见默认选择。** 压缩率高。 | embedding 表更大 |
| 超大（200K+） | GPT-4o 至 GPT-5.x (o200k, ~200K), Llama 4 (~202K), Gemma 3 (~262K) | 多模态和多语种效率 | LM Head 的内存压力更大 |

Anthropic 和 Google 未公布 Claude 与 Gemini 的词表大小，而 tiktoken 只覆盖 OpenAI 已发布的编码（GPT-4o 至 GPT-5.x 使用 o200k_base）。对于无法加载并确认其 tokenizer 的模型，应使用提供商的 token 计数 API 或响应中的 `usage` 字段计数，不要使用代理 tokenizer。

**词表扩展深度解析：**
- **Llama 3（128K）**：Meta 将 tiktoken 的 100K 个 token 与面向非英语语言的 28K 个额外 token 相结合，并报告称，相同文本所需 token 数最多比 Llama 2 少 15%。Llama 4 扩展至约 202K。
- **GPT-4o 至 GPT-5.x（o200k_base）**：将 cl100k 的词表翻倍，改善了代码与非英语文本的压缩率；即使每 token 价格不变，也能降低单位语义的成本。
- **同样价格，不同账单**：tokenizer 的变化无需改动标价就会影响账单。Anthropic 文档称，Claude 4.7 及更高版本模型使用了新的 tokenizer，对相同文本产生的 token 数量约比早期 Claude 模型多 30%，具体增幅取决于内容。每次切换模型家族时都应重新建立 token 计数基线。

### 字符 vs 子词 vs 词

| 粒度 | 示例 | `"running"` 的 token 数 | 权衡 |
|-------------|---------|---------------------|-----------|
| 字符 | ByT5 | `['r','u','n','n','i','n','g']` | 能处理任意文本，但序列很长 |
| 子词 | GPT | `['running']` 或 `['run','ning']` | 平衡较好 |
| 词 | 早期 NLP | `['running']` | 序列短，但无法处理 OOV |

现代 LLM 几乎都使用 subword 分词，以平衡词表大小和序列长度。

### Byte-Level BPE

GPT-2 引入了 byte-level BPE：
- 基础词表是 256 个字节，而不是字符
- 可以表示任意文本，不会有 UNK token
- Unicode 会自然地按字节序列处理

```python
# Character-level: Needs explicit handling of characters
text = "cafe"  # Unknown character might become [UNK]

# Byte-level: Works with any text (no UNK needed)
text = "cafe"  # Becomes bytes, then BPE operates on bytes
```

---

## 特殊 token

特殊 token 用于处理普通文本之外的结构化信息：

| Token | 用途 | 示例 |
|-------|---------|---------|
| BOS | 序列起始 | 表示生成开始 |
| EOS | 序列结束 | 表示完成 |
| PAD | 填充 | 将 batch 填充到相同长度 |
| UNK | 未知 token | OOV 的兜底（byte BPE 中较少见） |
| SEP | 分隔符 | 划分片段（BERT 风格） |

### 聊天模板

现代聊天模型使用特殊 token 来表示对话结构：

**Llama 2 格式：**
```
[INST] <<SYS>>
You are a helpful assistant.
<</SYS>>

User message here [/INST] Assistant response here
```

**ChatML（OpenAI 风格）：**
```
<|im_start|>system
You are a helpful assistant.<|im_end|>
<|im_start|>user
Hello!<|im_end|>
<|im_start|>assistant
Hi there!<|im_end|>
```

**这为什么重要：**
- 格式错误会导致效果变差
- 特殊 token 不在预训练数据中
- 像 transformers 这样的库会使用 `chat_template` 自动格式化

---

## 多语种分词

### 挑战

主要在英文上训练的 tokenizer 对其他语言的效率较差：

| 语言 | `"Hello"` 的 token 数 | 对应问候语的 token 数 |
|----------|-------------------|-------------------------------|
| English | 1（"Hello"） | - |
| Chinese | - | 2-3+ |
| Japanese | - | 3-5+ |
| Korean | - | 2-4+ |

**成本影响：**在以英文为中心的 tokenizer 上，非英语用户每个语义单位需支付的成本高 2-3 倍。现代更大的词表缩小了主要语言之间的差距，但并未消除它。

### 解决方案

1. **多语种训练语料**：在平衡的多语种数据上训练 tokenizer
2. **更大的词表**：给非英语 token 留出更多空间
3. **语言专用 tokenizer**：按语言族分别使用 tokenizer

**多语支持较好的模型：**
- mT5、XLM-R：在 100+ 种语言上训练
- 当前的 GPT、Claude 和 Qwen 模型：拥有大词表，覆盖广泛的多语种
- Gemini：从一开始就面向多语场景设计

相对于等价英文文本的近似 token 倍率（仅作说明；比率会随领域和文字系统变化，请在自己的语料上测量）：

| Tokenizer | 中文 | 日语 | 韩语 | 印地语 |
|-------|---------|----------|--------|--------|
| GPT-2 | 2.5x | 3.0x | 2.8x | 6.0x |
| GPT-4 (cl100k) | 1.4x | 1.6x | 1.5x | 3.2x |
| o200k（GPT-4o 至 GPT-5.x） | 1.1x | 1.2x | 1.1x | 1.4x |
| Llama 3（128K） | 1.2x | 1.3x | 1.2x | 1.5x |

---

## 多模态分词（像素到 token）

现代原生多模态模型不只是“看见”图像；它们会对图像进行分词。

### 图像分词（Vision Transformers）
图像会被切分为 patch（例如 14x14 像素）。每个 patch 会通过视觉编码器（如 SigLIP）生成一个视觉 token。
- **固定 token 成本**：大多数模型在特定分辨率下，每张图像使用固定数量的 token（例如每张图像 256 或 729 个 token）。
- **动态分辨率**：有些模型（Gemini 3）会根据图像宽高比和细节程度使用可变数量的 token。
- **无编码器**：Gemma 4 12B "Unified"（2026 年 6 月）跳过视觉编码器，通过轻量级线性层将原始图像 patch 和音频波形投射到 LLM embedding 空间。此时 token 成本直接取决于 patch 数量。

### 音频/视频分词
- **音频**：使用 EnCodec 等编解码器压缩为离散单元，然后表示为音频 token 序列。
- **视频**：按图像帧序列处理（时间分词）。1 秒、1FPS 的视频 token 成本可能和 1 张高分辨率图像相当。
- **智能体式视频处理**：自 2026 年 9 月 1 日起，Gemini API 在 Gemini 3.7 Flash、3.6 Flash 和 3.5 Flash-Lite 上提供可选的 `"processing": "agentic"` 模式（Google 文档还列出了 3.8 Flash）。模型自行决定检查哪些片段、以何种速度检查，以及通过哪种模态（帧、音频或转录文本）检查，而非按固定速率采样。Google 报告称，在标准视频基准上，token 最多减少 88%、成本最多降低 66%，且按正常 token 价格计费。静态 1 FPS 采样仍是默认方式，因此基于固定速率采样的成本模型对智能体模式 token 的估计可能高出约 8 倍。

---

## 用于成本估算的 Token 计数

### 快速估算规则

对于英文文本：
- **词数转 token：**约 1.3 个 token/词
- **字符转 token：**约 4 个字符/每个 token
- **页数转 token：**约每页 500-800 token

```python
def estimate_tokens(text: str) -> int:
    # Rough estimation for English
    word_count = len(text.split())
    return int(word_count * 1.3)
```

### 精确计数

使用模型特定的 tokenizer；如果 tokenizer 未公开，则使用提供商的计数端点：

```python
import tiktoken

# For OpenAI models (tiktoken ships OpenAI encodings only; o200k_base
# covers GPT-4o through GPT-5.x)
encoding = tiktoken.get_encoding("o200k_base")
tokens = encoding.encode("Your text here")
token_count = len(tokens)

# For open-weight models, use the model's own Hugging Face tokenizer
from transformers import AutoTokenizer
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B-Instruct")
tokens = tokenizer.encode("Your text here")
token_count = len(tokens)

# For Claude, the tokenizer is not public: call the count_tokens endpoint
import anthropic
client = anthropic.Anthropic()
count = client.messages.count_tokens(
    model="claude-sonnet-5-5",
    messages=[{"role": "user", "content": "Your text here"}],
)
token_count = count.input_tokens
```

Gemini 也提供等效的 `countTokens` 调用；对于 tiktoken 未映射的模型，OpenAI Responses API 提供输入 token 计数端点。绝不要用 tiktoken 估算 Claude 或 Gemini 的 token：不同词表会为相同文本得出不同的计数。

### 推理 token

使用推理模型时，可见答案只是输出账单的一部分。即使不返回原始推理过程，OpenAI、Anthropic 和 Google 模型仍会将思考或推理 token 作为输出计费，其数量取决于设置的 effort 或 thinking level。应根据真实流量中 API 的 `usage` 字段做预算，而不是根据可见回复的长度。

### 成本计算

```python
# USD per 1M tokens, standard tier list prices as of October 2026.
# Excludes cache reads/writes, batch discounts and long-context surcharges
# (OpenAI bills the whole request at higher rates above 272K input tokens).
PRICING = {
    "gpt-6-sol": {"input": 2.00, "output": 10.00},
    "gpt-6-luna": {"input": 0.10, "output": 0.50},
    "claude-sonnet-5-5": {"input": 2.00, "output": 10.00},
}

def calculate_cost(input_tokens: int, output_tokens: int, model: str) -> float:
    """Token counts come from the response's usage field (output includes
    reasoning tokens), not from re-tokenizing text with a different tokenizer."""
    rates = PRICING[model]
    return (
        (input_tokens / 1_000_000) * rates["input"] +
        (output_tokens / 1_000_000) * rates["output"]
    )
```

---

## 常见分词问题

### 问题 1：Token 边界错位

**问题：**文本操作可能无法与 token 边界对齐。

```python
text = "Hello world"
# Tokens: ["Hello", " world"]  # Note: space is part of second token

# Truncating at character 6 ("Hello ") splits a token
```

**解决方案：**在管理上下文时，始终按 token 边界截断。

### 问题 2：分词不一致

**问题：**同一文本在不同上下文中会有不同的分词结果。

```python
# GPT tokenizer example
"New York"     # Might be ["New", " York"]
"NewYork"      # Might be ["New", "York"]
" New York"    # Might be [" New", " York"]
```

**影响：**token 数会随周围文本变化。始终对完整上下文进行分词。

### 问题 3：代码与结构化数据

**问题：**代码和 JSON 往往分词效率较低。

```python
# Python code often tokenizes poorly
"def calculate_average(numbers):"
# Becomes many tokens: ["def", " calculate", "_", "average", "(", "numbers", "):", ...]

# JSON keys tokenize individually
'{"firstName": "John"}'
# Many tokens for structure
```

**缓解措施：**
- 有些模型拥有针对代码优化的 tokenizer
- 考虑在发送前压缩 JSON
- 可用时使用结构化输出模式

### 问题 4：空白字符处理

**问题：**不同 tokenizer 对空白字符的处理不同。

```python
# Leading spaces often become separate tokens
" Hello"  # [" ", "Hello"] or [" Hello"]

# Multiple spaces may merge or stay separate
"Hello  world"  # Behavior varies by tokenizer
```

**最佳实践：**在分词前先标准化空白字符。

---

## 实践中的分词模式

### 模式 1：上下文窗口管理

```python
def fit_to_context(
    system_prompt: str,
    user_message: str,
    history: list[str],
    max_tokens: int = 8000,
    reserve_for_output: int = 2000
) -> str:
    # Use the target model's tokenizer; o200k_base fits OpenAI models only
    encoding = tiktoken.get_encoding("o200k_base")
    
    available = max_tokens - reserve_for_output
    
    # System prompt always included
    tokens_used = len(encoding.encode(system_prompt))
    available -= tokens_used
    
    # User message always included
    tokens_used = len(encoding.encode(user_message))
    available -= tokens_used
    
    # Add history from most recent, drop oldest if needed
    included_history = []
    for msg in reversed(history):
        msg_tokens = len(encoding.encode(msg))
        if msg_tokens <= available:
            included_history.insert(0, msg)
            available -= msg_tokens
        else:
            break
    
    return format_prompt(system_prompt, included_history, user_message)
```

### 模式 2：按 token 边界切分

```python
def chunk_at_token_boundaries(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50
) -> list[str]:
    encoding = tiktoken.get_encoding("o200k_base")
    tokens = encoding.encode(text)
    
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk_tokens = tokens[start:end]
        chunk_text = encoding.decode(chunk_tokens)
        chunks.append(chunk_text)
        start = end - overlap
    
    return chunks
```

### 模式 3：Token 预算分配

```python
class TokenBudget:
    def __init__(self, total: int):
        self.total = total
        self.allocated = {}
    
    def allocate(self, component: str, tokens: int) -> bool:
        used = sum(self.allocated.values())
        if used + tokens > self.total:
            return False
        self.allocated[component] = tokens
        return True
    
    def remaining(self) -> int:
        return self.total - sum(self.allocated.values())

# Usage
budget = TokenBudget(total=8000)
budget.allocate("system_prompt", 500)
budget.allocate("retrieved_context", 2000)
budget.allocate("user_message", 200)
budget.allocate("output_reserve", 2000)
# Remaining: 3300 tokens for conversation history
```

---

## 面试题

### 问：为什么 LLM 在简单字符计数上会吃力？

**标准答案：**
Tokenization 会把文本转换为 subword 单元，而不是字符。当被问到“`strawberry` 里有多少个 `r`？”时，模型看到的是诸如 `["str", "aw", "berry"]` 这样的 token，而不是单个字母。

模型必须推理它并未直接观察到的 token 内部结构。这需要记住或计算 token 的字符组成，这是一种涌现能力，并不总是可靠。

解决方法是先让模型按字符拼出这个单词，再进行计数。这会迫使它生成字符级 token。

### 问：你会如何估算 token 数量用于成本规划？

**标准答案：**
粗略估算：英文文本可用词数乘以 1.3。

精确计数：使用模型特定的 tokenizer。
- OpenAI：对其提供的编码使用 tiktoken（GPT-4o 至 GPT-5.x 使用 o200k_base）；对于 tiktoken 未映射的模型，使用 Responses API 输入 token 计数端点或 `usage` 字段
- 开放权重模型：使用模型自身的 Hugging Face tokenizer
- Claude 和 Gemini：使用提供商的 token 计数端点（tokenizer 未公开）

重要考虑事项：
- 非英文文本会使用更多 token：在现代 128K-200K 词表上，主要语言约为 1.1-1.5 倍；在旧 tokenizer 和覆盖较少的文字系统上，可能达到 3 倍或更多
- 代码和结构化数据分词效率较低
- 始终为输出 token 预留额外预算（价格为输入的 3-6 倍；多数当前前沿模型为 5 倍），包括按输出计费且会随 effort level 增加的推理 token
- 包括 system prompt、工具定义和格式化 token
- 同一文本在每家供应商上的 token 成本不同，因此应比较每项完成任务的成本，而非每 token 的价格

在生产环境的成本估算中，我会抽样真实请求，并从 API 的 `usage` 字段测量实际 token 用量，然后加上安全余量。每次迁移模型时，我都会重新测量，因为 tokenizer 的变化（据 Anthropic 所述，Claude 4.7 及更高版本对相同文本的计数约比早期 Claude 模型多 30%）或新的默认 effort level 都会在价格不变时改变账单。

### 问：在模型之间切换 tokenizer 时会发生什么？

**标准答案：**
每个模型家族都有自己的 tokenizer。不能跨模型复用 token，因为：

1. **词表不同：**token ID 对应的字符串不同
2. **合并规则不同：**同一文本的切分方式不同
3. **特殊 token 不同：**聊天格式不同

实际影响：
- token 计数必须使用正确的 tokenizer
- 缓存的 embedding 是模型特定的
- Prompt 模板需要按模型分别调整
- 微调模型会继承其基础模型的 tokenizer

### 问：你会如何为 RAG 做分块（chunking）？

**标准答案：**
关键考虑点：

1. **按 token 边界切分：**在 token 中间切分会在解码时破坏文本
2. **考虑模板 token：**系统提示词和格式化都会消耗 token
3. **留出余量（headroom）：**检索到的片段和问题必须一起放入上下文窗口

实现思路：
```python
# Determine available tokens for chunks
available = max_context - system_prompt_tokens - question_tokens - output_reserve

# Chunk with overlap at token boundaries
chunks = chunk_at_token_boundaries(document, chunk_size=500, overlap=50)

# Select chunks until budget exhausted
selected = []
tokens_used = 0
for chunk in ranked_chunks:
    chunk_tokens = count_tokens(chunk)
    if tokens_used + chunk_tokens <= available:
        selected.append(chunk)
        tokens_used += chunk_tokens
```

---

## 参考资料

- Sennrich 等. “Neural Machine Translation of Rare Words with Subword Units（使用子词单元的稀有词神经机器翻译）” (BPE，2016)
- Wu 等. “Google's Neural Machine Translation System（Google 的神经机器翻译系统）” (WordPiece，2016)
- Kudo 和 Richardson. “SentencePiece: A simple and language independent subword tokenizer（SentencePiece：一种简单且与语言无关的子词分词器）” (2018)
- OpenAI tiktoken library: https://github.com/openai/tiktoken
- HuggingFace tokenizers: https://github.com/huggingface/tokenizers
- OpenAI tiktoken library: https://github.com/openai/tiktoken
- Anthropic token counting: https://platform.claude.com/docs/en/build-with-claude/token-counting
- HuggingFace tokenizers: https://github.com/huggingface/tokenizers

---

*上一节: [LLM 内部机制](01-llm-internals.md) | 下一节: [注意力机制](03-attention-mechanisms.md)*
