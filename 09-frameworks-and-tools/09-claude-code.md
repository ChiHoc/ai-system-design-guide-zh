# Claude Code：自主编码代理

Claude Code 是 Anthropic 的 **终端原生自主编码代理（terminal-native autonomous coding agent）**。与只会建议补全内容的 IDE 插件不同，Claude Code 的行为更像一名全栈软件工程师：它会读取你的代码库、编辑文件、运行命令、执行测试，并持续迭代直到任务完成。

## 目录

- [Claude Code 是什么](#claude-code-是什么)
- [核心架构](#核心架构)
- [核心工具](#核心工具)
- [CLAUDE.md 清单模式](#claude-md-清单模式)
- [运行 Claude Code](#architecture)
- [子代理与并行](#test-commands)
- [自定义 MCP 集成](#coding-standards)
- [安全与权限模型](#forbidden-patterns)
- [生产环境：CI 流水线](#architecture-decisions)
- [对比：Claude Code 与替代方案](#运行-claude-code)
- [面试问题](#面试问题)
- [参考资料](#参考资料)

---

## Claude Code 是什么

Claude Code 于 2025 年初由 Anthropic 发布，它是：

- **一个 CLI 工具**：终端里的 `claude` 命令
- **一个 MCP 原生代理**：使用 bash、text_editor 和 computer 工具
- **一个 SDK（Software Development Kit，软件开发工具包）**：可嵌入 Python/TypeScript 应用
- **不只是聊天机器人**：它会自主进行规划、实现和验证

```
# Install
pip install claude-code  # or: npm install -g @anthropic-ai/claude-code

# Run interactively
claude

# Run headlessly (for CI)
claude -p "Add unit tests for all functions in src/utils.py" --output-format json
```

**与 Copilot/Cursor 的关键区别：**
- Copilot/Cursor：你接受或拒绝它给出的代码建议
- Claude Code：**自主完成整个任务**，并通过运行测试来验证结果

---

## 核心架构

```
┌─────────────────────────────────────────────────────────┐
│                   CLAUDE CODE ARCHITECTURE               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User Request                                           │
│       ↓                                                 │
│  ┌─────────────┐    ┌──────────────┐                   │
│  │  Claude 3.7 │    │  CLAUDE.md   │                   │
│  │   Sonnet    │ ←  │  (manifest)  │                   │
│  │ (Extended   │    └──────────────┘                   │
│  │  Thinking)  │                                       │
│  └──────┬──────┘                                       │
│         │ Tool calls                                    │
│         ↓                                               │
│  ┌──────────────────────────────────────┐              │
│  │           TOOL LAYER                 │              │
│  │  ┌─────────┐ ┌───────────┐ ┌──────┐ │              │
│  │  │  bash   │ │text_editor│ │  MCP │ │              │
│  │  └────┬────┘ └─────┬─────┘ └──┬───┘ │              │
│  └───────┼────────────┼──────────┼─────┘              │
│          │            │          │                      │
│   Shell cmds     File edits    Custom tools             │
│   (test, lint,   (read/write)  (DB, APIs,               │
│    git, build)                  internal)               │
└─────────────────────────────────────────────────────────┘
```

Claude Code 以 **Claude 3.7 Sonnet** 作为主干模型（backbone model），并在复杂规划任务中默认启用 Extended Thinking（增强思考）。

---

## 核心工具

Claude Code 有三种原生工具，并支持自定义 MCP（Model Context Protocol，模型上下文协议）工具：

### 1. `bash` — Shell 执行

```python
# Claude calls this internally:
bash(command="pytest tests/ -v --tb=short", timeout=60)
# Returns: stdout, stderr, exit_code
```

**Claude 会用它来做什么：**
- 运行测试套件（`pytest`、`jest`、`cargo test`）
- 执行 Git 操作（`git diff`、`git commit`、`git log`）
- 执行构建命令（`npm build`、`make`、`docker build`）
- 安装包（`pip install`、`npm install`）

bash 会话在多轮交互中是**持久的**，环境变量和工作目录会在同一会话内持续保留。

### 2. `text_editor` — 文件操作

```python
# Read a file
text_editor(command="view", path="/project/src/auth.py")

# Find in file
text_editor(command="view", path="/project/src/auth.py", view_range=[1, 50])

# Edit (surgical replacement)
text_editor(
    command="str_replace",
    path="/project/src/auth.py",
    old_str="def authenticate(user, password):",
    new_str="def authenticate(user: str, password: str) -> AuthResult:"
)

# Create new file
text_editor(command="create", path="/project/tests/test_auth.py", file_text="...")
```

**为什么外科式替换优于重写：**
- 保留文件上下文
- 降低幻觉风险（只改动需要改动的部分）
- 生成可原子化、可审查的 diff

### 3. `computer` — GUI 自动化（可选）

可进行完整桌面控制（截图、鼠标、键盘），用于浏览器测试和 UI 验证。需要沙箱环境。

---

## CLAUDE.md 清单模式

`CLAUDE.md` 文件是高效使用 Claude Code 的**最重要模式**。它会把持久的项目上下文注入到每个 Claude Code 会话中。

```markdown
# CLAUDE.md — Project: E-Commerce API

## Architecture
- Python 3.11 FastAPI backend
- PostgreSQL 15 with Alembic migrations
- Redis for session caching
- All API responses must be Pydantic models

## Test Commands
- Run all tests: `pytest tests/ -v`
- Run single test: `pytest tests/test_auth.py::test_login -v`
- Lint: `ruff check . --fix`
- Type check: `mypy src/`

## Coding Standards
- Always add type hints
- Never use `global` variables
- All database queries through SQLAlchemy ORM, never raw SQL
- New features require tests with >80% coverage

## Forbidden Patterns
- Do NOT use `os.system()` — use `subprocess.run()` instead
- Do NOT commit secrets — use environment variables
- Do NOT modify `alembic/versions/` — create new migrations

## Architecture Decisions
- Auth: JWT tokens, 1hr expiry, refresh token pattern
- Errors: Always return RFC 7807 Problem Details format
- Logging: structlog with JSON output, always include request_id
```

**CLAUDE.md 文件的嵌套：**
```
project/
  CLAUDE.md          # global project rules
  src/
    auth/
      CLAUDE.md      # auth-specific rules (stricter security)
    payments/
      CLAUDE.md      # payment-specific rules (PCI compliance notes)
```

Claude 在目录中工作时会自动读取最近的 CLAUDE.md。

---

## 运行 Claude Code

### 交互模式

```bash
# Start session (reads CLAUDE.md automatically)
claude

# With specific model
claude --model claude-3-7-sonnet-20250219

# With MCP config
claude --mcp-config .claude/mcp.json
```

### 无头模式（用于脚本）

```bash
# Single task, JSON output
claude -p "Fix all type errors in src/" \
  --output-format json \
  --max-turns 20

# Pipe from file
echo "Refactor src/utils.py to use async/await" | claude -p -

# Stream output
claude -p "Add logging to all API endpoints" --output-format stream-json
```

### Python SDK

```python
import asyncio
from claude_code_sdk import query, ClaudeCodeOptions

async def run_coding_task(task: str) -> str:
    options = ClaudeCodeOptions(
        max_turns=30,
        allowed_tools=["bash", "str_replace_based_edit_tool"],
        system_prompt_suffix="Always run tests after making changes.",
    )
    
    messages = []
    async for message in query(prompt=task, options=options):
        messages.append(message)
    
    return messages[-1].content[0].text

result = asyncio.run(run_coding_task(
    "Add input validation to all POST endpoints in src/api/"
))
```

---

## 子代理与并行

Claude Code 支持面向大型代码库的**子代理调度**：

```
Main Claude Code session
    ↓
"This codebase has 5 modules. I'll spawn sub-agents for each."
    ├── Sub-agent 1: Fix auth module tests
    ├── Sub-agent 2: Add type hints to utils/
    ├── Sub-agent 3: Migrate payments to async
    └── Sub-agent 4: Update API documentation
```

每个子代理并行运行，然后主代理审核并合并结果。

**何时使用子代理：**
- 代码库超过 50K 行
- 彼此独立的并行修改（无共享状态）
- 模块级重构任务

---

## 自定义 MCP 集成

Claude Code 会从 `~/.claude/config.json` 或 `.claude/mcp.json` 读取 MCP 服务器：

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "description": "Live library documentation"
    },
    "postgres": {
      "command": "uvx",
      "args": ["mcp-server-postgres"],
      "env": {"DATABASE_URL": "postgresql://localhost/myapp"},
      "description": "Direct DB access for schema inspection"
    },
    "jira": {
      "command": "uvx",
      "args": ["mcp-server-jira"],
      "env": {"JIRA_URL": "https://company.atlassian.net"},
      "description": "Task tracking integration"
    }
  }
}
```

有了这个配置，Claude Code 可以：
1. 在写代码前先查阅最新的库文档（Context7）
2. 在写 SQL 前先读取真实的数据库 schema（postgres MCP）
3. 在完成实现后将 Jira 工单标记为已完成（jira MCP）

---

## 安全与权限模型

Claude Code 采用**分层权限模型**：

```
Permission Level    Who approves       What it covers
────────────────────────────────────────────────────────
Auto               Claude (no prompt)  Read files, run tests
Ask per-turn       User confirms       Shell command execution
Explicit allow     User pre-approves   Specific commands/dirs
Blocked            Never runs          Network calls outside allowlist
```

### 配置

```json
{
  "permissions": {
    "allow": [
      "bash(pytest*)",           // Always allow test runs
      "bash(ruff*)",             // Always allow linting
      "bash(git diff*)",         // Always allow git reads
      "str_replace_based_edit_tool"  // Always allow file edits
    ],
    "deny": [
      "bash(rm -rf*)",           // Block destructive deletions
      "bash(curl https://external*)", // Block external network
      "bash(pip install*)"       // Block package installs without approval
    ]
  }
}
```

### 生产环境安全规则

1. **始终使用沙箱**：在 Docker 容器或 E2B 云 VM 中运行
2. **Git 隔离**：开始前创建特性分支；合并前审查 diff
3. **人工检查点**：生产部署时，要求人工审查最终 diff
4. **密钥扫描**：对每次 Claude Code 输出运行 `truffleHog` 或 `git-secrets`
5. **速率限制**：设置 `max_turns` 以防止失控循环（推荐：20-30）

---

## 生产环境：CI 流水线

### GitHub Actions 集成

```yaml
# .github/workflows/ai-fix.yml
name: AI Bug Fix
on:
  issues:
    types: [labeled]

jobs:
  ai-fix:
    if: github.event.label.name == 'ai-fix'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Claude Code
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          pip install claude-code
          
          ISSUE_BODY="${{ github.event.issue.body }}"
          
          claude -p "Fix the following bug: $ISSUE_BODY
          
          Rules:
          - Read the relevant files first
          - Make minimal changes
          - Run tests and verify they pass
          - Do not change unrelated code
          " --output-format json --max-turns 15 > result.json
      
      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v5
        with:
          title: "AI Fix: ${{ github.event.issue.title }}"
          body: "Automated fix by Claude Code"
          branch: "ai-fix/${{ github.event.issue.number }}"
```

### CI 成本模型

| 任务类型 | 平均回合数 | 平均 Token 数 | 预估成本 |
|-----------|-----------|------------|----------------|
| 小型缺陷修复 | 8 | 15K | $0.23 |
| 测试生成 | 12 | 25K | $0.38 |
| 功能实现 | 20 | 50K | $0.75 |
| 大规模重构 | 30 | 100K | $1.50 |

*在每天 100 次 CI 运行的情况下：约 $75-150/天，具体取决于任务组合。*

---

## 对比：Claude Code 与替代方案

| 特性 | Claude Code | Cursor/Windsurf | Cline | OpenHands |
|---------|-------------|-----------------|-------|-----------|
| **界面** | CLI + SDK | IDE（VS Code 分支） | VS Code 插件 | Web UI + CLI |
| **模型** | 仅 Claude | 任意（GPT、Claude、Gemini） | 任意 | 任意 |
| **自主性** | 完全 | 中等（需要点击） | 完全 | 完全 |
| **CI/无头模式** | ✅ 原生支持 | ❌ | ✅ | ✅ |
| **MCP 支持** | ✅ 原生支持 | ✅ | ✅ | ✅ |
| **CLAUDE.md** | ✅ | ❌（类似：.cursorrules） | ❌ | ❌ |
| **开源** | ❌ | ❌ | ✅ | ✅ |
| **最适合** | 后端开发者、CI/CD | UI/前端开发者、可视化场景 | 任意开发者 | 自托管团队 |

### SWE-bench Verified 得分（2026 年 5 月）

| 代理 | 得分 | 备注 |
|-------|-------|-------|
| GPT-5.5（原始模型领先者） | 88.7% | SWE-Bench Verified 排行榜第 1 |
| Claude Opus 4.7（原始模型） | 87.6% | 在 SWE-Bench Pro 上以 64.3% 领先 |
| Claude Code（Opus 4.7 / Sonnet 4.6） | ~87% | Anthropic 官方代理 |
| OpenHands + Claude Sonnet 4.6 | ~75% | 开源框架 |
| Aider + Claude Sonnet 4.6 / GPT-5.5 | ~74% | 开源 CLI |
| Devin（商业产品） | ~65% | Cognition AI 产品 |
| SWE-agent + GPT-5.5 | ~55% | 普林斯顿研究基线 |

---

## 面试问题

### 问：Claude Code 与 GitHub Copilot 有何不同？

**高分答案：**
Copilot 是一个 **补全工具（completion tool）**，它会在你输入时预测接下来几行代码。Claude Code 是一个 **自主代理（autonomous agent）**，你给它一个任务（例如“为这个 API 添加认证”），它会读取代码库、规划实现、编辑多个文件、运行测试、修复失败，直到测试通过才结束。两者的体验本质不同：Copilot 帮你更快地编码；Claude Code 则在你审核输出的同时**替你完成编码**。

### 问：什么是 CLAUDE.md，为什么它很关键？

**高分答案：**
CLAUDE.md 就像是专门为 AI 同事编写的 `README`。没有它，Claude Code 会把你的项目当成通用的 Python/JS 项目。有了它，Claude 就知道你的精确测试命令、禁止模式（不要使用原生 SQL，改用 ORM）、架构决策（JWT 认证、特定错误格式）和编码规范。它把通用代理（general-purpose agent）变成了**项目专家（project-specialist）**。我见过一份写得好的 CLAUDE.md 能让任务完成速度提升 2-3 倍，并减少 60% 的错误。

### 问：如何在生产 CI 中安全运行 Claude Code？

**高分答案：**
有三层：
1. **沙箱**：在没有外部网络访问的 Docker 容器中运行 Claude Code。只允许访问 git 仓库和测试运行器。
2. **权限白名单**：使用权限配置精准白名单化允许的 bash 命令（测试运行器、linter），并阻止破坏性操作（`rm -rf`、未经审查的 `pip install`）。
3. **人工闸门**：Claude Code 输出一个带 diff 的分支。人类在 PR 中审查 diff 后再合并。Claude 永远不会直接合并到 main。这样可以把最终决策保留在人类判断中。

### 问：如何控制高并发 CI 中 Claude Code 的成本？

**高分答案：**
我会从三个方面优化：
1. **任务范围（Task scoping）**：Claude Code 在独立且边界明确的任务（缺陷修复、测试生成）上最具成本效益。我不会把它用于开放式探索，因为这类工作还是人类更便宜。
2. **最大回合数（Max turns）**：设置 `max_turns=15` 可以防止循环推理导致的失控作业，避免单次消耗超过 $10+。
3. **模型路由**：对于简单缺陷修复（语法错误、明显拼写错误），我会通过 SDK 使用 Claude 3.5 Haiku，成本便宜 5 倍。对于架构重构，我会使用启用 Extended Thinking 的 Claude 3.7 Sonnet。

---

## 参考资料

- Anthropic. "Claude Code: Building Agentic Coding Experiences"（2025）— https://docs.anthropic.com/claude-code
- Anthropic. "Claude Code SDK Documentation" — https://github.com/anthropics/claude-code
- Anthropic. "CLAUDE.md Best Practices" — https://docs.anthropic.com/claude-code/settings#claudemd
- SWE-bench Verified Leaderboard — https://www.swebench.com/

---

*下一篇：[OpenCoder / AI 编码代理全景](10-opencoderguide.md)*
