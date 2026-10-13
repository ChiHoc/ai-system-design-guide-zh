# 案例研究：AI 代码助手

本案例研究涵盖设计一个生产级代码助手，该助手可提供实时建议、代码生成和调试帮助。

## 目录

- [问题陈述](#问题陈述)
- [需求分析](#需求分析)
- [架构设计](#架构设计)
- [代码生成流水线](#代码生成流水线)
- [质量保障](#质量保障)
- [性能优化](#性能优化)
- [结果与指标](#结果与指标)
- [面试讲解](#面试演练)

---

## 问题陈述

**公司：** 正在构建 IDE 扩展的开发者工具公司

**目标：**
- 开发者输入时进行实时代码补全
- 根据自然语言生成多行代码
- 提供代码解释和调试辅助
- 支持 20+ 种编程语言

**约束：**
- 补全延迟 < 200ms（输入流）
- 生成延迟 < 3s（可接受的停顿）
- 安全：代码不离开客户基础设施（企业版选项）
- 成本：在规模化下可持续（数百万开发者）

---

## 需求分析

### 功能需求

| 功能 | 描述 | 延迟目标 |
|---------|-------------|----------------|
| 行内补全 | 补全当前行/代码块 | < 200ms |
| 多行生成 | 根据注释生成函数/类 | < 3s |
| 代码解释 | 解释选中的代码 | < 5s |
| 错误修复 | 针对错误建议修复方案 | < 2s |
| 重构 | 建议改进 | < 5s |
| 文档生成 | 生成文档字符串 | < 2s |

### 质量需求

| 维度 | 目标 | 测量方式 |
|-----------|--------|-------------|
| 接受率 | > 30% | 建议被接受 / 已展示 |
| 语法正确性 | > 99% | 成功编译/解析 |
| 安全性 | 0 个漏洞 | SAST 扫描通过率 |
| 相关性 | > 85% | 用户评分 |

---

## 架构设计

### 高层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    CODE ASSISTANT ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐                                                │
│  │     IDE     │                                                │
│  │  Extension  │                                                │
│  └──────┬──────┘                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    GATEWAY / ROUTER                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │    │
│  │  │ Debounce │  │  Auth    │  │ Feature  │              │    │
│  │  │          │  │          │  │  Flags   │              │    │
│  │  └──────────┘  └──────────┘  └──────────┘              │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│         ┌──────────────────┼──────────────────┐                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  Completion │    │ Generation  │    │ Explanation │         │
│  │   Service   │    │  Service    │    │  Service    │         │
│  │  (fast)     │    │ (quality)   │    │ (quality)   │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                 │
│                            ▼                                     │
│                    ┌─────────────┐                              │
│                    │   Model     │                              │
│                    │   Layer     │                              │
│                    └─────────────┘                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

架构采用流程图展示。三个按延迟与质量划分的服务层（补全优先低于 200ms，生成和解释优先质量）共享同一模型层：

```mermaid
flowchart TD
    IDE[IDE Extension<br/>VS Code / JetBrains]
    IDE --> GW

    subgraph GW[Gateway / Router]
        DB[Debounce]
        AU[Auth]
        FF[Feature Flags]
    end

    GW --> CS[Completion Service<br/>fast: under 200ms]
    GW --> GS[Generation Service<br/>quality: 1-5s]
    GW --> ES[Explanation Service<br/>quality: 1-5s]

    CS --> ML[Model Layer]
    GS --> ML
    ES --> ML
```

### 上下文组装

```python
class CodeContextAssembler:
    """
    Assemble context for code completion.
    Challenge: Balance context richness with latency.
    """
    
    def __init__(self, max_tokens: int = 4000):
        self.max_tokens = max_tokens
    
    def assemble(
        self,
        cursor_position: dict,
        file_content: str,
        open_files: list[dict],
        project_context: dict
    ) -> str:
        context_parts = []
        remaining_tokens = self.max_tokens
        
        # Priority 1: Immediate context (before and after cursor)
        immediate = self.get_immediate_context(
            file_content, cursor_position, tokens=2000
        )
        context_parts.append(immediate)
        remaining_tokens -= count_tokens(immediate)
        
        # Priority 2: Related imports and definitions
        if remaining_tokens > 500:
            related = self.get_related_definitions(
                file_content, cursor_position, tokens=min(1000, remaining_tokens)
            )
            context_parts.append(related)
            remaining_tokens -= count_tokens(related)
        
        # Priority 3: Other open files (same module/package)
        if remaining_tokens > 500:
            other_files = self.get_relevant_open_files(
                open_files, cursor_position, tokens=remaining_tokens
            )
            context_parts.append(other_files)
        
        return self.format_context(context_parts)
    
    def get_immediate_context(
        self,
        content: str,
        cursor: dict,
        tokens: int
    ) -> str:
        lines = content.split("\n")
        cursor_line = cursor["line"]
        
        # Get lines before cursor (more important)
        before_ratio = 0.7
        before_tokens = int(tokens * before_ratio)
        after_tokens = tokens - before_tokens
        
        # Expand outward from cursor
        before_lines = lines[:cursor_line]
        after_lines = lines[cursor_line:]
        
        # Truncate to fit
        before_text = self.truncate_to_tokens(
            "\n".join(before_lines), before_tokens, from_end=True
        )
        after_text = self.truncate_to_tokens(
            "\n".join(after_lines), after_tokens, from_end=False
        )
        
        return f"{before_text}\n<CURSOR>\n{after_text}"
```

上下文组装是一个按优先级分配预算的过程。模型只能看到未超出 4000 个 token 上限的内容，所以顺序很重要：先放当前代码（始终要保留），再放相关定义，最后在预算还有剩余时才放其他已打开文件：

```mermaid
flowchart TD
    Start[Cursor event<br/>budget = 4000 tokens]
    Start --> P1[P1: Immediate context<br/>2000 tokens before+after cursor<br/>70/30 split toward before]
    P1 --> R1{Remaining<br/>over 500}
    R1 -->|no| Final[Format context<br/>send to model]
    R1 -->|yes| P2[P2: Related definitions<br/>imports, types, callees<br/>up to 1000 tokens]
    P2 --> R2{Remaining<br/>over 500}
    R2 -->|no| Final
    R2 -->|yes| P3[P3: Other open files<br/>same module / package<br/>fill remaining budget]
    P3 --> Final
```

---

## 代码生成流水线

### 补全服务

推理模型不适合逐次按键的补全：仅思考 token 就会耗尽 200ms 预算。行内补全改用自行托管的小型中间填充（FIM）模型，也满足“代码不离开客户基础设施”的选项。

```python
class InlineCompletion:
    """
    Sub-200ms FIM completions from a small self-hosted model inside the
    customer VPC. Served by vLLM (pin >= 0.30.0) with speculative decoding
    set at server start, e.g.
    vllm serve <checkpoint> --speculative-config '{"method": "eagle3", ...}'
    """
    def __init__(self, client):
        self.client = client   # OpenAI-compatible client for the in-VPC server
        self.model = "fim-8b"  # your FIM-tuned checkpoint of an Apache 2.0 base

    async def complete(self, prefix: str, suffix: str) -> str:
        resp = await self.client.completions.create(
            model=self.model,
            prompt=self.build_fim_prompt(prefix, suffix),  # sentinel tokens are model-specific
            max_tokens=64,
            temperature=0.0,
            stop=["\n\n"],
        )
        return resp.choices[0].text
```

**基础模型与许可证。** 候选包括 IBM Granite 4.2（3B 和 8B 稠密模型，Apache 2.0）等宽松许可的小模型；如果延迟预算允许，也可选 Qwen3.8-27B（Apache 2.0）。基准测试前先读许可证：Qwen3.8-Flash-Next 采用 Qwen Community License 1.0，无论营收多少，代码助手业务都需单独取得许可，而本产品正属此类。推理服务方面，推测解码已不止 Medusa：vLLM 支持 EAGLE-3、MTP、草稿模型和 DFlash；Inco AI 报告 DFlash 2 在 Qwen3.8-27B 上提速 2.7 至 3.4 倍（供应商报告数据）。

### 生成服务（代理式重构）

```python
class AgenticGeneration:
    """
    Claude Sonnet 5.5 for multi-file refactors, run as a tool-using agent.
    """
    async def refactor_module(self, folder_path: str):
        agent = CodingAgent(
            model="claude-sonnet-5-5",
            effort="medium",  # start here and sweep; thinking: disabled returns 400
            tools=["ls", "read_file", "write_file", "test_runner"],
        )
        
        # Agent explores codebase, understands dependencies, and applies fix
        return await agent.run(f"Refactor {folder_path} to use async/await.")
```

> [!TIP]
> **生产选择（2026 年 10 月）。** Claude Sonnet 5.5（$2 / $10）是 IDE 内代理式工作的默认选择。Anthropic 报告 Terminal-Bench 4.0 上 Sonnet 5.5 为 70.6%，Opus 5.5（xhigh effort）为 66.4%；两者均为供应商报告数据，也都未登上 tbench.ai 排行榜。该榜单 2026 年 9 月 21 日更新时最高为 58.18%（GPT-6 Astra，max effort）。2025 年的“切换思考模式”做法已不适用：Sonnet 5.5 上 `thinking: {type: "disabled"}` 会返回 400，因此要调整的是 effort，而 `between_tools` 是最低思考设置。应按任务而非按 token 评估性价比：DeepSWE v1.1 上 GPT-6 Astra（xhigh）、Gemini 3.8 Flash（high）和 Claude Opus 5（max）的 pass@1 均为 74%，每任务成本分别为 $4.43、$2.36 和 $11.84。

### 模型供应商策略

企业买家如今会问助手背后的模型归谁所有，模型供应商也会问助手归谁所有。Cursor 于 2026 年 8 月 14 日宣布加入 SpaceX（据报道为约 600 亿美元的股票交易），此后 Cursor 博客出现了 Grok 模型发布消息。两周后的 8 月 28 日，OpenAI 告知 SpaceX 将逐步终止向 Cursor 提供 OpenAI 模型的合同，拟于 2026 年 11 月 12 日停止供应，并在此前不向 Cursor 提供未来模型；这也排除了 GPT-6 Astra（9 月 3 日发布，OpenAI 在通知中点名了 Astra）。所有权变化使一家领先代码产品可能在约 11 周通知期内失去整个前沿模型系列。因此，**模型中立成为产品要求**，且要从两个方向落实：

- 所有模型调用经由带租户级模型允许清单的网关路由，让企业无需改代码即可排除供应商，失去供应商时也只需改路由，而非重写系统。评估套件至少要能对两个模型系列运行，以便被迫切换时有已测量的质量基线。同一网关还服务于要求代码留在 VPC 的租户：将其生成与重构流量发往租户自己的 Bedrock、Google Cloud 或 Foundry 账户，或自托管开放权重模型，绝不发往供应商公共端点。
- 按租户跟踪各供应商的数据使用和保留条款。允许供应商使用流量的折扣端点（例如 Meta Muse Spark 1.3 的贡献者档 $0.10 / $0.20）必须由租户主动选择。
- 预期客户会提出超出 SOC 2 的保障问题。AIUC-1 是一种新兴答案：面向代理的安全、保障与可靠性认证，采用对抗性测试审计，且须至少每季度测试及每年审计才能保持认证（Cursor 于 2026 年 8 月 13 日宣布取得认证）。

---

## 质量保障

### 多阶段验证

验证器是一个失败即停的关卡。便宜的检查（语法）先执行并强制拦截；昂贵的检查（测试执行）最后执行，并且仅在上下文允许时运行。任何阻塞性失败都会短路其余步骤：

```mermaid
flowchart TD
    G[Generated Code] --> SY[Stage 1: Syntax Check<br/>fast, blocking]
    SY -->|fail| RJ[Reject: syntax_error]
    SY -->|ok| SEC[Stage 2: Security Scan<br/>medium, blocking]
    SEC -->|critical| RJV[Reject: vulnerability]
    SEC -->|ok or warnings| TY[Stage 3: Type Check<br/>medium, advisory<br/>typescript / python]
    TY --> TST{Test context<br/>available}
    TST -->|yes| TR[Stage 4: Test Execution<br/>slow, optional]
    TST -->|no| PASS[Present to user<br/>with warnings]
    TR -->|pass| PASS
    TR -->|fail| WARN[Present to user<br/>with test-fail label]
```

```python
class CodeVerifier:
    """
    Verify generated code before presenting to user.
    """
    
    async def verify(self, code: str, language: str, context: str) -> VerificationResult:
        results = {}
        
        # Stage 1: Syntax check (fast, blocking)
        syntax_ok = self.check_syntax(code, language)
        if not syntax_ok:
            return VerificationResult(passed=False, reason="syntax_error")
        
        # Stage 2: Security scan (medium, blocking)
        security = await self.security_scan(code, language)
        if security.has_critical:
            return VerificationResult(passed=False, reason="security_vulnerability")
        results["security"] = security
        
        # Stage 3: Type check if applicable (medium)
        if language in ["typescript", "python"]:
            type_result = await self.type_check(code, context, language)
            results["types"] = type_result
        
        # Stage 4: Test execution if available (slow, optional)
        if self.has_test_context(context):
            test_result = await self.run_tests(code, context)
            results["tests"] = test_result
        
        return VerificationResult(
            passed=True,
            details=results,
            warnings=security.warnings if security else []
        )
    
    def check_syntax(self, code: str, language: str) -> bool:
        parsers = {
            "python": self.parse_python,
            "javascript": self.parse_javascript,
            "typescript": self.parse_typescript,
            # ... other languages
        }
        
        parser = parsers.get(language)
        if not parser:
            return True  # Cannot verify, assume OK
        
        try:
            parser(code)
            return True
        except SyntaxError:
            return False
    
    async def security_scan(self, code: str, language: str) -> SecurityResult:
        # Run static analysis
        if language == "python":
            result = await self.run_bandit(code)
        elif language in ["javascript", "typescript"]:
            result = await self.run_eslint_security(code)
        else:
            result = await self.run_semgrep(code, language)
        
        return result
```

### 验收优化

```python
class AcceptanceOptimizer:
    """
    Learn from user acceptance patterns to improve suggestions.
    """
    
    def __init__(self):
        self.feedback_store = FeedbackStore()
    
    async def record_feedback(
        self,
        suggestion_id: str,
        accepted: bool,
        edited: bool,
        context_hash: str
    ):
        await self.feedback_store.record({
            "suggestion_id": suggestion_id,
            "accepted": accepted,
            "edited": edited,
            "context_hash": context_hash,
            "timestamp": datetime.now()
        })
    
    async def should_show_suggestion(
        self,
        suggestion: str,
        confidence: float,
        user_context: dict
    ) -> bool:
        # Historical acceptance rate for similar suggestions
        historical_rate = await self.get_historical_rate(
            user_context["user_id"],
            user_context["language"],
            confidence
        )
        
        # Threshold based on user preferences
        threshold = user_context.get("suggestion_threshold", 0.3)
        
        # Only show if likely to be accepted
        return (confidence * historical_rate) > threshold
```

---

## 性能优化

### 延迟优化

| 技术 | 影响 | 实现 |
|-----------|--------|----------------|
| 请求防抖 | -50ms | IDE 中 150ms 防抖 |
| 连接池 | -30ms | 持久化 HTTP/2 |
| 模型预热 | -100ms | 预加载模型 |
| 推测解码（Speculative decoding） | -40% | 草稿模型 + 验证 |
| 边缘缓存 | -80ms | 常见模式使用 CDN |

### 缓存策略

```python
class CompletionCache:
    """
    Multi-level cache for completions.
    """
    
    def __init__(self):
        self.local_cache = LRUCache(max_size=10000)  # In-memory
        self.redis_cache = Redis()  # Distributed
    
    def get_cache_key(self, context: str) -> str:
        # Hash context for cache key
        # Include language and cursor position
        return hashlib.sha256(context.encode()).hexdigest()[:16]
    
    async def get(self, context: str) -> str | None:
        key = self.get_cache_key(context)
        
        # Check local first
        local = self.local_cache.get(key)
        if local:
            return local
        
        # Check distributed
        remote = await self.redis_cache.get(f"completion:{key}")
        if remote:
            self.local_cache.set(key, remote)
            return remote
        
        return None
    
    async def set(self, context: str, completion: str):
        key = self.get_cache_key(context)
        
        # Set in both caches
        self.local_cache.set(key, completion)
        await self.redis_cache.setex(
            f"completion:{key}",
            3600,  # 1 hour TTL
            completion
        )
```

---

## 结果与指标

### 性能结果

| 指标 | 目标 | 达成 |
|--------|--------|----------|
| 完成延迟（p50） | < 200ms | 145ms |
| 完成延迟（p99） | < 500ms | 380ms |
| 生成延迟（p50） | < 3s | 2.1s |
| 语法正确性 | > 99% | 99.5% |
| 安全性（0 高严重级别） | 100% | 99.8% |
| 接受率 | > 30% | 34% |

### 成本分析（2026 年 10 月）

| 请求类型 | 假设 | 每 100 万次请求成本 | 备注 |
|--------------|------------|----------------------|-------|
| **行内补全，自托管 8B 模型** | 约 2K 输入 / 30 输出；每张 H100 约 15 次补全/秒，满足 200ms SLO | 约 $50 | H100 每 GPU 小时 $2.77（Silicon Data 指数，2026 年 10 月 1 日）。须实测自身吞吐量；按键间的前缀缓存可提高吞吐量 |
| **通过 API 行内补全（GPT-6 Luna）** | 相同 token 量，每 100 万 token 为 $0.10 / $0.50 | 约 $215 | 自托管池饱和时的溢出路径；不适用于要求代码留在 VPC 的租户 |
| **多行生成（Claude Sonnet 5.5）** | 8K 输入 / 500 输出，预先关闭思考（`between_tools`）以满足 3 秒预算 | 约 $21,000 | 每请求 $0.021；若思考约 1K token，成本增加约 $0.01，延迟增加数秒 |
| **代理式重构（Claude Sonnet 5.5）** | 约 750K 输入，90% 缓存命中；约 6K 输出 | 约 $390,000 | 每任务 $0.39；推导见[自主编程代理成本拆解](07-autonomous-coding-agent.md#成本拆解-cost-breakdown) |

*混合成本（98% 补全、2% 代理式重构）：每 100 万次请求约 $7,850，其中超过 99% 来自代理式任务。补全服务集群的成本几乎可以忽略；代理的提示缓存命中率才决定预算。命中率降至 50% 时，同样的重构任务约需 $1.08，接近三倍。*

---

## 面试演练

**面试官：**“为 IDE 设计一个 AI 代码助手。”

**有力回答：**

1. **澄清需求**（1 分钟）
   - “补全和生成的目标延迟分别是多少？”
   - “是否需要企业部署和本地部署选项？”
   - “企业客户是否排除某些模型供应商，或要求特定的数据使用条款？”
   - “需要支持哪些语言？”

2. **识别关键挑战**（1 分钟）
   - “核心矛盾是延迟与质量。补全需要 < 200ms 才能保证输入流畅，而高质量代码又需要丰富上下文和验证。”

3. **双层架构**（3 分钟）
   - “我会将补全（快）和生成（质量）分开：”
   - “补全：更小的模型、最少上下文、推测解码”
   - “生成：前沿模型、best-of-N、语法与安全验证”

4. **上下文组装**（2 分钟）
   - “上下文至关重要。我会按以下优先级：当前代码 > 导入/定义 > 打开的文件”
   - “对于补全，我会将 token 上限设为 2K 以保证速度”
   - “对于生成，我可以使用 8K+ token 来获得更好的理解”

5. **质量保障**（2 分钟）
   - “每条建议都会经过：语法检查、安全扫描，必要时还会做类型检查”
   - “对于生成任务，我会使用 best-of-N，提供 8 个候选，过滤无效结果，然后打分并选择”
   - “这样可以在安全漏洞到达开发者之前将其拦截”

6. **延迟优化**（2 分钟）
   - “在 IDE 中做请求防抖、连接池、模型预热”
   - “使用推测解码实现 40% 的延迟降低”
   - “缓存常见模式（导入、样板代码）”

---

## 参考资料

- GitHub Copilot 架构：https://github.blog/
- Codestral：https://mistral.ai/news/codestral/
- CodeLlama：https://ai.meta.com/blog/code-llama-large-language-model-coding/
- OpenAI，“SpaceX 收购 Cursor 后我们的决定”（2026 年 8 月 28 日）：https://openai.com/index/our-decision-on-cursor-following-its-acquisition-by-spacex
- Cursor，“Cursor 现已成为 SpaceX 的一部分”（2026 年 8 月 14 日）：https://cursor.com/blog/joining-spacex

---

*下一篇：[内容审核案例研究](05-content-moderation.md)*
