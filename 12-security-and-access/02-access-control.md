# LLM 系统的访问控制

安全的访问控制对多用户和多租户的 LLM 应用至关重要。本章涵盖身份认证、授权和数据隔离模式。

## 目录

- [访问控制需求](#访问控制需求)
- [认证模式](#认证模式)
- [授权模型](#授权模型)
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
| **身份认证** | 谁在发起请求？ | API keys, OAuth, JWT |
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
        "gpt-4o": ["enterprise", "professional"],
        "gpt-4o-mini": ["enterprise", "professional", "starter"],
        "claude-3.5-sonnet": ["enterprise"],
        "claude-3.5-haiku": ["enterprise", "professional", "starter"]
    }
    
    def can_access_model(self, user: User, model: str) -> bool:
        allowed_tiers = self.MODEL_TIERS.get(model, [])
        return user.tier in allowed_tiers
    
    def get_available_models(self, user: User) -> list[str]:
        return [
            model for model, tiers in self.MODEL_TIERS.items()
            if user.tier in tiers
        ]
```

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

关键原则是：永不存储明文密钥，支持轮转，实施最小权限。”

---

## 参考资料

- OAuth 2.0: https://oauth.net/2/
- OWASP API Security: https://owasp.org/API-Security/

---

*上一篇：[安全基础](01-llm-security.md)*
