# LLM 系统的访问控制

安全的访问控制对多用户和多租户的 LLM 应用至关重要。本章涵盖身份认证、授权和数据隔离模式。

## 目录

- [访问控制需求](#访问控制需求)
- [认证模式](#认证模式)
- [授权模型](#授权模型)
- [智能体与工具授权](#智能体与工具授权)
- [租户隔离](#租户隔离)
- [API Key 管理](#api-key-管理)
- [审计与合规](#审计与合规)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 访问控制需求

### 安全维度

| 维度 | 说明 | 控制措施 |
|-----------|-------------|----------|
| **身份认证** | 谁在发起请求？ | API keys、OAuth、JWT、工作负载身份 |
| **授权** | 他们可以做什么？ | RBAC, ABAC, policies |
| **隔离** | 他们能看到什么数据？ | Tenant filtering, encryption |
| **审计** | 他们做了什么？ | Logging, compliance reports |

### LLM 特有关注点

| 关注点 | 风险 | 缓解措施 |
|---------|------|------------|
| 提示词注入 | 绕过访问控制 | 输入校验 |
| 数据泄露 | 跨租户暴露 | 严格过滤 |
| 模型输出 | 暴露受保护信息 | 输出过滤 |
| 上下文污染 | 注入未授权数据 | 上下文校验 |
| 智能体凭据 | 被劫持的智能体或助手会话重复使用其 token | 限定范围、短时效、绑定发送方的 token |
| 跨工具服务器的混淆代理 | 一台服务器诱导凭据流向原本面向另一台服务器的目标 | 将每份凭据绑定到其签发方和受众 |

---

## 认证模式

### API Key 认证

```python
class APIKeyAuthenticator:
    def __init__(self, key_store):
        self.key_store = key_store
    
    async def authenticate(self, api_key: str) -> AuthResult:
        if not api_key:
            return AuthResult(authenticated=False, error="Missing API key")
        
        # Hash the key for lookup
        key_hash = self.hash_key(api_key)
        
        # Look up in store
        key_record = await self.key_store.get(key_hash)
        
        if not key_record:
            return AuthResult(authenticated=False, error="Invalid API key")
        
        if key_record.expired:
            return AuthResult(authenticated=False, error="Expired API key")
        
        if key_record.revoked:
            return AuthResult(authenticated=False, error="Revoked API key")
        
        return AuthResult(
            authenticated=True,
            user_id=key_record.user_id,
            tenant_id=key_record.tenant_id,
            scopes=key_record.scopes
        )
    
    def hash_key(self, key: str) -> str:
        return hashlib.sha256(key.encode()).hexdigest()
```

### 带 Scope 的 JWT

```python
class JWTAuthenticator:
    def __init__(self, public_key: str):
        self.public_key = public_key
    
    async def authenticate(self, token: str) -> AuthResult:
        try:
            payload = jwt.decode(
                token,
                self.public_key,
                algorithms=["RS256"],
                audience="llm-api"
            )
            
            return AuthResult(
                authenticated=True,
                user_id=payload["sub"],
                tenant_id=payload.get("tenant_id"),
                scopes=payload.get("scopes", []),
                expires_at=datetime.fromtimestamp(payload["exp"])
            )
        except jwt.ExpiredSignatureError:
            return AuthResult(authenticated=False, error="Token expired")
        except jwt.InvalidTokenError as e:
            return AuthResult(authenticated=False, error=str(e))
```

### 用工作负载身份替代静态密钥

静态 API 密钥是智能体集群的薄弱环节，攻击者如今会按名称搜寻它们。2026 年 8 月的 ChainDrop npm 蠕虫除云服务和 GitHub 凭据外，还窃取 OpenAI、Anthropic、Cursor、Codex 与 Gemini token。Mandiant 描述了一起入侵：攻击者接管正在运行的 AI 编码助手会话，助手推荐了已被投毒的软件包，失窃的 GitHub OAuth token 又让 Shai-Hulud 蠕虫在约 100 个内部仓库间传播。供应商也在调整：OpenAI 于 2026 年 8 月 29 日正式开放双向 TLS 和 X.509 工作负载身份联合，9 月 10 日增加 API 密钥过期设置及组织和项目级最长有效期，9 月 15 日允许管理员限制或禁用密钥创建。

相应规则是：

- **优先使用工作负载身份**（mTLS、联合签发的短时效 token）完成服务到供应商的调用。仍需保留密钥时，为每把密钥指定负责人、到期时间和费用上限。
- **把智能体或 AI 助手会话视为独立主体**，为其配置限定范围的凭据和监控，并让原始 API 密钥及长期 OAuth token 远离它。
- **协议支持时使用绑定发送方的 token**（DPoP，RFC 9449），使盗取单个 bearer token 不足以单独完成调用。

---

## 授权模型

### 基于角色的访问控制（RBAC）

```python
class RBACAuthorizer:
    ROLE_PERMISSIONS = {
        "admin": ["*"],
        "developer": ["generate", "embed", "fine_tune", "read_metrics"],
        "user": ["generate", "embed"],
        "viewer": ["read_metrics"]
    }
    
    def authorize(self, user: User, action: str) -> bool:
        permissions = self.ROLE_PERMISSIONS.get(user.role, [])
        
        if "*" in permissions:
            return True
        
        return action in permissions
```

### 基于属性的访问控制（ABAC）

```python
class ABACAuthorizer:
    def __init__(self, policy_engine):
        self.policy_engine = policy_engine
    
    async def authorize(
        self,
        subject: dict,       # Who (user attributes)
        action: str,         # What (operation)
        resource: dict,      # On what (resource attributes)
        context: dict        # When/where (environmental)
    ) -> AuthzResult:
        # Evaluate all applicable policies
        policies = await self.policy_engine.get_policies(action)
        
        for policy in policies:
            result = policy.evaluate(subject, action, resource, context)
            if result == PolicyResult.DENY:
                return AuthzResult(allowed=False, reason=policy.name)
            if result == PolicyResult.ALLOW:
                return AuthzResult(allowed=True)
        
        return AuthzResult(allowed=False, reason="No matching policy")
```

### 模型级权限

```python
class ModelAccessControl:
    MODEL_TIERS = {
        "claude-fable-5-1": ["enterprise"],
        "claude-opus-5-5": ["enterprise", "professional"],
        "gpt-6-sol": ["enterprise", "professional"],
        "claude-haiku-4-5": ["enterprise", "professional", "starter"],
        "gpt-6-luna": ["enterprise", "professional", "starter"]
    }
    
    def __init__(self, zdr_eligible: set[str]):
        # Load from your vendor agreements, not from code: retention terms are
        # per model (e.g. Fable 5.1 requires 30-day retention unless authorized)
        self.zdr_eligible = zdr_eligible

    def can_access_model(self, user: User, model: str) -> bool:
        if user.tier not in self.MODEL_TIERS.get(model, []):
            return False
        if user.tenant.requires_zdr and model not in self.zdr_eligible:
            return False
        return True
    
    def get_available_models(self, user: User) -> list[str]:
        return [
            model for model in self.MODEL_TIERS
            if self.can_access_model(user, model)
        ]
```

如今，模型访问还受到供应商侧的门控：Anthropic 文档将 Mythos 5.1 限定为 Project Glasswing 参与者（还列出 Life Sciences 和 Cyber Verification Programs 等后续通道）；OpenAI 的 `gpt-rosalind-research` 仅限可信访问；Gemini 3.8 Flash Cyber 仅通过 Google Fairwind Program 提供。上述检查背后的模型注册表应按模型和平台记录组织有权使用哪些模型、各自的数据保留条款和退役日期，使路由与回退永远不会选中租户无权使用的模型。

---

## 智能体与工具授权

智能体代表用户调用工具时，授权涉及三方：用户、作为 OAuth 客户端的智能体，以及每台工具服务器。2026 年既出现了标准化方向，也发生了具体故障。

**故障：授权服务器混淆。** 官方 MCP SDK 曾让 MCP 服务器决定哪台授权服务器接收客户端凭据，因此恶意或遭入侵的服务器可以指定自己的服务器，在用户完全无感知时获得已保存的 refresh token 和客户端密钥（TypeScript 中为 CVE-2026-104850，Python 中为 GHSA-qx49-fqc8-xw99，均为 CVSS 7.5；TypeScript 1.31.0 和 2.2.0、Python 1.30.0 和 2.2.0 已修复）。仅升级仍不够：机器对机器服务提供方必须配置预期签发方（TypeScript 为 `expectedIssuer`，Python 为 `issuer=`），而升级前保存的凭据在标记签发方或清除之前仍有暴露风险。连接多台服务器的智能体客户端天然可能成为混淆代理。规则是：**将每份凭据绑定到签发方，绝不让资源服务器选择秘密送往何处。**

**构件：**

| 需求 | 机制 | 状态 |
|------|-----------|--------|
| token 只能在一台服务器使用 | 受众绑定（RFC 8707 资源指示符） | MCP 授权规范的一部分 |
| 失窃 token 单独无法使用 | DPoP 绑定发送方的 token（RFC 9449） | MCP TypeScript 客户端 2.1.0 已于 2026 年 9 月 23 日支持；规范方案（SEP-1932）仍为开放草案 |
| 每个工具遵循最小权限 | 逐工具升级 scope 的挑战（HTTP 403 `insufficient_scope`） | MCP TypeScript 服务器 2.1.0 已支持 |
| 企业 IdP 控制智能体可用的服务器 | MCP Enterprise-Managed Authorization 背后的 ID-JAG 授权 | MCP 已支持；IETF 草案处于 -04 阶段，尚非 RFC |
| 无人值守智能体自身的身份 | 工作负载身份加 OAuth 协议家族，而非新协议 | IETF WIMSE 于 2026 年 9 月 15 日采纳 draft-ietf-wimse-aims-00；MCP 工作负载身份联合（SEP-1933）仍是开放草案 |

**审批也是授权。** 每次调用都由人工审批无法扩展，因此平台正转向策略：Claude Managed Agents 的自动权限策略（2026 年 9 月 10 日）让服务器评估每次智能体或 MCP 工具调用，并选择运行、拒绝或暂停等待审批。需要人工审批时，要将审批绑定到准确调用：关于审批洗白的研究（arXiv 2609.38983）显示，人批准的动作并不总是编码智能体运行框架最终执行的动作。

**用户委托的模型访问。** Sign in with ChatGPT（OpenAI 于 2026 年 9 月 29 日 DevDay 宣布，面向选定合作伙伴有限试用）采用带 PKCE 的 OAuth 2.0 和 OpenID Connect，并可选择让符合条件的 Responses API 请求使用用户自己的 ChatGPT 套餐。它便于身份接入，但也将登录和 AI 计费集中在一家模型厂商；应像评估任何 IdP 锁定风险一样权衡它。

包括 Enterprise-Managed Authorization 在内的协议细节见[工具使用与 MCP](../07-agentic-systems/03-tool-use-and-mcp.md)。

---

## 租户隔离

### 数据隔离模式

```python
class TenantIsolatedVectorStore:
    def __init__(self, vector_db):
        self.db = vector_db
    
    async def search(
        self,
        tenant_id: str,
        query_embedding: list[float],
        top_k: int = 10
    ) -> list[dict]:
        # CRITICAL: Always filter by tenant_id at database level
        results = await self.db.search(
            query_vector=query_embedding,
            top_k=top_k,
            filter={"tenant_id": {"$eq": tenant_id}}  # Mandatory filter
        )
        
        return results
    
    async def insert(
        self,
        tenant_id: str,
        documents: list[dict]
    ):
        # CRITICAL: Always include tenant_id in metadata
        for doc in documents:
            doc["metadata"]["tenant_id"] = tenant_id
        
        await self.db.insert(documents)
```

### 提示词隔离

```python
class TenantAwarePromptBuilder:
    def build_prompt(
        self,
        tenant_id: str,
        user_query: str,
        context: list[dict]
    ) -> str:
        # Verify all context belongs to tenant
        for doc in context:
            if doc.get("tenant_id") != tenant_id:
                raise SecurityError("Cross-tenant context detected")
        
        # Build isolated prompt
        return f"""
[Tenant: {tenant_id}]
Context from tenant documents:
{self.format_context(context)}

User query: {user_query}
"""
```

### 缓存隔离

```python
class TenantIsolatedCache:
    def __init__(self, cache_backend):
        self.cache = cache_backend
    
    def _scoped_key(self, tenant_id: str, key: str) -> str:
        return f"tenant:{tenant_id}:{key}"
    
    async def get(self, tenant_id: str, key: str) -> any:
        return await self.cache.get(self._scoped_key(tenant_id, key))
    
    async def set(self, tenant_id: str, key: str, value: any, ttl: int = 3600):
        await self.cache.set(
            self._scoped_key(tenant_id, key),
            value,
            ttl=ttl
        )
```

缓存隔离还延伸到推理引擎。共享前缀缓存是一条时间侧信道：如果租户 B 的请求因为租户 A 已缓存相同前缀而更快返回，B 就能推断 A 的提示词信息。vLLM 使用逐请求的 `cache_salt` 隔离租户；2026 年 9 月，一条代码路径发生回归（Harmony `/v1/responses` 端点的工具续接轮次丢失 salt），直到 0.30.0 才重新关闭该探测通道。应在每次请求中传入逐租户 salt，测试每个端点；多个租户共享同一供应商账户时，还应将租户专属内容放在可共享的缓存前缀之后。

---

## API Key 管理

### 密钥生命周期

```python
class APIKeyManager:
    KEY_PREFIX = "llm_"
    
    async def create_key(
        self,
        user_id: str,
        tenant_id: str,
        name: str,
        scopes: list[str],
        expires_in_days: int = 365
    ) -> APIKey:
        # Generate secure key
        raw_key = self.KEY_PREFIX + secrets.token_urlsafe(32)
        key_hash = self.hash_key(raw_key)
        
        # Store metadata (not the raw key)
        key_record = APIKeyRecord(
            id=generate_id(),
            hash=key_hash,
            user_id=user_id,
            tenant_id=tenant_id,
            name=name,
            scopes=scopes,
            created_at=datetime.now(),
            expires_at=datetime.now() + timedelta(days=expires_in_days)
        )
        
        await self.store.save(key_record)
        
        # Return raw key only once (not stored)
        return APIKey(
            id=key_record.id,
            key=raw_key,  # Only returned on creation
            name=name,
            scopes=scopes,
            expires_at=key_record.expires_at
        )
    
    async def revoke_key(self, key_id: str, reason: str):
        await self.store.update(key_id, {
            "revoked": True,
            "revoked_at": datetime.now(),
            "revoke_reason": reason
        })
        
        await self.audit_log.log("api_key_revoked", {
            "key_id": key_id,
            "reason": reason
        })
```

### 密钥轮转

```python
class KeyRotator:
    async def rotate_key(self, old_key_id: str) -> APIKey:
        old_key = await self.key_store.get(old_key_id)
        
        # Create new key with same permissions
        new_key = await self.key_manager.create_key(
            user_id=old_key.user_id,
            tenant_id=old_key.tenant_id,
            name=f"{old_key.name} (rotated)",
            scopes=old_key.scopes
        )
        
        # Grace period: old key still works temporarily
        await self.key_store.update(old_key_id, {
            "deprecated": True,
            "deprecated_at": datetime.now(),
            "grace_period_ends": datetime.now() + timedelta(days=7)
        })
        
        await self.notify_user(old_key.user_id, new_key)
        
        return new_key
```

---

## 审计与合规

### 审计日志

```python
class AuditLogger:
    async def log_request(
        self,
        request: LLMRequest,
        response: LLMResponse,
        auth: AuthResult
    ):
        audit_entry = {
            "timestamp": datetime.now().isoformat(),
            "request_id": request.id,
            "user_id": auth.user_id,
            "tenant_id": auth.tenant_id,
            "action": "llm_generate",
            "model": request.model,
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "cost": response.cost,
            "latency_ms": response.latency_ms,
            # Hash content for privacy
            "input_hash": self.hash_content(request.prompt),
            "output_hash": self.hash_content(response.content)
        }
        
        await self.audit_store.append(audit_entry)
```

### 合规报告

```python
class ComplianceReporter:
    async def generate_report(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> ComplianceReport:
        logs = await self.audit_store.query(
            tenant_id=tenant_id,
            start=start_date,
            end=end_date
        )
        
        return ComplianceReport(
            tenant_id=tenant_id,
            period=(start_date, end_date),
            total_requests=len(logs),
            unique_users=len(set(l["user_id"] for l in logs)),
            models_used=list(set(l["model"] for l in logs)),
            total_cost=sum(l["cost"] for l in logs),
            data_access_events=self.extract_data_access(logs),
            security_events=await self.get_security_events(tenant_id, start_date, end_date)
        )
```

---

## 面试题

### Q: 你如何在 RAG 系统中实现多租户隔离？

**优秀回答：**

“多租户隔离需要纵深防御：

**向量数据库层：**
- 每个向量都在元数据中包含 tenant_id
- 所有查询都在数据库层按 tenant_id 过滤
- 绝不在检索后再过滤（数据此时已经泄露到内存）

**缓存层：**
- 所有缓存键都以前缀 tenant_id 标识
- 语义缓存按租户隔离
- 即使查询完全相同，也绝不命中跨租户缓存

**提示词层：**
- 在纳入上下文之前，先校验上下文文档是否属于请求租户
- 绝不混合来自多个租户的上下文

**输出层：**
- 验证响应不包含跨租户信息
- 将输出过滤作为额外防护

**审计：**
- 记录所有带租户上下文的访问
- 监控跨租户访问尝试

关键原则是：tenant_id 必须是每个数据访问点的强制过滤条件，而不是可选参数。”

### Q: 你如何管理 LLM 服务的 API Key？

**优秀回答：**

“安全的 API Key 管理：

**创建：**
- 生成密码学安全随机密钥
- 只存储哈希值，明文密钥仅返回一次
- 关联用户、租户、Scope、过期时间

**校验：**
- 对传入密钥做哈希，并与存储的哈希值比对
- 检查过期和撤销状态
- 验证 Scope 与请求动作匹配

**轮转：**
- 支持带宽限期的密钥轮转
- 旧密钥在过渡期内可用（7 天）
- 提前通知用户即将到期

**安全：**
- 对失败的身份认证尝试进行限流
- 怀疑泄露时立即撤销
- 审计所有密钥操作

**Scope：**
- 细粒度：模型访问、操作类型、每日限制
- 默认最小权限

**我们持有的密钥，而不只是我们签发的密钥：**
- 我们调用模型供应商时，优先使用工作负载身份（mTLS 或联合 token），而不是静态密钥；仍需使用的密钥应指定负责人、到期时间和费用上限
- LLM API 密钥如今是供应链蠕虫的常见目标，因此要让它们远离开发者机器、智能体会话和 CI 日志

关键原则是：永不存储明文密钥，支持轮转，实施最小权限。”

### Q: 智能体代表用户调用五台 MCP 服务器的工具，如何授权？

**优秀回答：**

“设计时首先要防范混淆代理，因为智能体持有五台服务器的凭据，其中任何一台都可能恶意或遭入侵。

**将凭据绑定到签发方和受众。** 每个 token 都按受众绑定到对应服务器（RFC 8707），每份保存的凭据都标记签发它的授权服务器，绝不发送到其他地方。2026 年 9 月 MCP TypeScript SDK 的 CVE-2026-104850 正是缺失了这一约束（Python SDK 也有同样缺陷）：恶意服务器可以指定自己的授权服务器，收集 refresh token 和客户端密钥。只升级 SDK 还不够；机器对机器客户端必须显式指定预期签发方，升级前的凭据也须重新标记或清除。

**降低失窃 token 的作用。** 使用短时效 token；客户端和服务器都支持时，使用 DPoP 绑定发送方的 token。

**逐工具最小权限。** 默认 scope 应收窄，并支持逐工具升级权限的挑战，避免只读会话悄然调用写入工具。

**企业控制。** 企业运行 IdP 时，Enterprise-Managed Authorization 让管理员集中决定智能体可访问哪些服务器。无人值守智能体应拥有自己的工作负载身份，而不是持有用户的长期 token。

**审批与审计。** 高风险调用经过策略引擎或人工审批，审批绑定到实际执行的准确调用，每次调用都记录用户、智能体、服务器和 scope。

标准仍在演进（MCP 的 DPoP 和工作负载身份联合尚属草案，ID-JAG 还不是 RFC），因此我会将授权层封装在自有接口后，并预期更换其中的组件。”

---

## 参考资料

- OAuth 2.0: https://oauth.net/2/
- OWASP API Security: https://owasp.org/API-Security/
- RFC 8707，OAuth 2.0 资源指示符：https://www.rfc-editor.org/rfc/rfc8707
- RFC 9449，OAuth 2.0 持有证明（DPoP）：https://www.rfc-editor.org/rfc/rfc9449
- MCP TypeScript SDK 安全公告 GHSA-6qxp-vccf-f47h（CVE-2026-104850）：https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h
- IETF WIMSE，AI 身份管理系统（draft-ietf-wimse-aims）：https://datatracker.ietf.org/doc/draft-ietf-wimse-aims/
- OpenAI API 更新日志（工作负载身份、密钥到期）：https://developers.openai.com/api/docs/changelog

---

*上一篇：[LLM 安全](01-llm-security.md)*
