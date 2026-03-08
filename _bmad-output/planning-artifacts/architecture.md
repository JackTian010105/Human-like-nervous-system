---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - /Users/jack/Nutstore Files/Jack坚果云-AI/workspace-VSCode/_bmad-output/planning-artifacts/prd.md
  - /Users/jack/Nutstore Files/Jack坚果云-AI/workspace-VSCode/_bmad-output/planning-artifacts/product-brief-workspace-VSCode-2026-03-08.md
  - /Users/jack/Nutstore Files/Jack坚果云-AI/workspace-VSCode/_bmad-output/planning-artifacts/prd-validation-report.md
workflowType: 'architecture'
project_name: 'workspace-VSCode'
user_name: 'Jack'
date: '2026-03-08T14:39:38+0800'
lastStep: 8
status: 'complete'
completedAt: '2026-03-08T14:55:00+0800'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
当前需求以“组织神经系统闭环”为核心，FR1-FR36 覆盖 7 个能力域：
1) 指令建模与下发
2) 节点理解与传导
3) 反馈闭环与中枢再判断
4) 链路可视化与告警
5) 审计与可追溯
6) 运行管理与故障排查
7) 外部集成与事件订阅

从架构视角看，这要求系统同时具备：写入链路（命令/回执/反馈）、状态权威（状态机）、读侧投影（控制台可视化）、以及可审计事件时间线。

**Non-Functional Requirements:**
架构决策受以下 NFR 强约束驱动：
- 实时与性能：控制台状态刷新 <= 1 秒，链路延迟 P95 <= 5 秒
- 可靠性：关键路径可用性 >= 99.5%
- 可扩展：>=100 并发链路、>=1000 节点规模目标
- 安全：传输/存储加密覆盖、鉴权覆盖、审计 append-only
- 集成：事件投递成功率、回调重试成功率、幂等写入约束
- 可访问性：键盘覆盖、对比度、关键状态双通道表达

**Scale & Complexity:**
项目属于高复杂度 process_control + web_app 控制台系统，且为 greenfield。
复杂度来源于：实时事件流、分布式状态一致性、异常恢复链路、审计与合规要求、以及多角色协同操作。

- Primary domain: process_control / web_app console
- Complexity level: high
- Estimated architectural components: 10-14（网关、命令服务、节点服务、状态机处理、超时监测、审计服务、读模型、实时网关、告警服务、认证授权等）

### Technical Constraints & Dependencies

- PRD 已将“统一指令模型”设为主约束，架构需保持领域语义一致
- 状态变化必须可追溯且可重建（EventSequence + Timeline）
- 审计日志必须 append-only，不可覆盖
- 实时推送需具备断线重连与顺序一致性保障
- 外部集成需满足幂等与回调真实性校验
- 域合规补强点（来自验证报告）：functional safety、ot security、engineering authority 仍需在架构层明确

### Cross-Cutting Concerns Identified

- 状态机一致性与非法状态跳转防护
- 事件顺序与幂等去重
- 超时检测与异常恢复编排
- 审计留痕与责任归属
- 认证授权与角色边界（孙武/管宁/扁鹊/墨子）
- 读写分离与实时投影一致性
- 可观测性（链路、节点、事件、告警）

## Starter Template Evaluation

### Primary Technology Domain

Full-stack Web Application（`web_app` 控制台 + 事件驱动后端）

### Starter Options Considered

1. Next.js + NestJS（分离式，推荐）
- 前端：`create-next-app@latest`
- 后端：`@nestjs/cli` + `nest new`
- 优点：成熟、可维护、与 PRD 的实时控制台 + 事件后端职责分离契合

2. 纯 NestJS（后端优先）
- 可先做 API 与事件链路，但会延后操作台落地，不利于“可视化闭环验收”

3. 单体全栈模板（如一体化脚手架）
- 启动快但后期职责边界易混，不利于状态机/审计/读写分离演进

### Selected Starter: Next.js + NestJS（分离式）

**Rationale for Selection:**
- 与当前架构蓝图一致（Console + Gateway/Services + Event/State/Audit）
- 便于把 `Command + Event + State Machine + Audit Log` 做成后端权威骨架
- 前端可以专注实时链路可视化与运维/排障界面

**Initialization Commands:**

```bash
# Frontend (Next.js)
pnpm create next-app@latest console --yes

# Backend (NestJS CLI)
npm i -g @nestjs/cli
nest new cns-api --strict --package-manager pnpm
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript-first
- Node.js >= 20（两端均满足）

**Styling Solution:**
- Next 默认 Tailwind（可保留或后续替换）

**Build Tooling:**
- Next App Router + Turbopack（默认）
- Nest CLI 标准构建链路

**Testing Framework:**
- Next/Nest 默认测试骨架已就位（后续按 story 扩展）

**Code Organization:**
- 前后端明确分仓/分目录边界
- 后端利于实现领域分层（Command/Node/Event/State）

**Development Experience:**
- 快速启动、标准化脚手架、与现有团队熟悉度高

**Version Notes (Web-verified):**
- Next.js 16 已发布（官方升级/安装文档）
- NestJS 当前主线为 v11（官方迁移指南）
- PostgreSQL 当前受支持主线含 17/18（官方版本策略）
- Redis Open Source 当前主线为 8.x（官方发布说明）

**Note:** 项目初始化应作为第一个实现故事执行。

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- 数据基线：PostgreSQL 17/18 + Redis 8.x
- 数据模式：CQRS（写侧权威 + 读侧投影）
- 安全基线：JWT + Refresh Token + RBAC
- 通信基线：REST + WS/SSE + Redis Streams
- 前端基线：Next.js App Router + TanStack Query + Zustand + shadcn/ui
- 部署基线：前后端分离 + Docker Compose + GitHub Actions + 三环境

**Important Decisions (Shape Architecture):**
- 事件持久化：PostgreSQL append-only command_events
- 实时一致性策略：事件推送主导，查询回补兜底
- 观测体系：OpenTelemetry + Prometheus/Grafana + Loki
- 服务间安全：MVP 内网可信 + 签名校验（后续 mTLS）

**Deferred Decisions (Post-MVP):**
- Kafka/NATS 等更重消息中间件替换
- mTLS 全链路零信任强化
- 多区域高可用与跨地域容灾

### Data Architecture

- **Primary DB:** PostgreSQL 17/18（权威写模型）
- **Cache/Stream:** Redis 8.x（实时、缓存、流式处理）
- **Data Pattern:** CQRS
  - 写侧：Command/Node/Event/ChainLink 事务写入
  - 读侧：事件驱动投影生成查询模型
- **Audit Strategy:** command_events append-only，不允许覆盖历史
- **Rationale:** 满足闭环可追溯、状态机权威与实时展示分离需求

### Authentication & Security

- **Authentication:** JWT + Refresh Token
- **Authorization:** RBAC（孙武/管宁/扁鹊/墨子）
- **Service-to-Service Security (MVP):** 内部可信网络 + 签名校验
- **Future Hardening:** mTLS（Post-MVP）
- **Rationale:** 在不牺牲 MVP 速度前提下保证鉴权与责任边界

### API & Communication Patterns

- **External API:** REST
- **Realtime Channel:** WebSocket 优先，SSE 备用
- **Event Backbone (MVP):** Redis Streams
- **Event Persistence:** PostgreSQL append-only command_events
- **Idempotency:** 外部写入以 Idempotency-Key / CommandID 约束
- **Ordering:** EventSequence 强制递增，支持状态重建
- **Rationale:** 与 PRD 的实时性、顺序一致性、审计留痕要求一致

### Frontend Architecture

- **Framework:** Next.js App Router
- **State Management:** TanStack Query + Zustand（轻量本地状态）
- **UI System:** shadcn/ui + Tailwind
- **Realtime Rendering Strategy:** 推送为主、查询回补为辅
- **Rationale:** 平衡开发效率、可维护性与实时交互能力

### Infrastructure & Deployment

- **Deployment Model:** 前后端分离部署
- **Runtime Strategy:** Docker Compose（dev/staging）
- **CI/CD:** GitHub Actions
- **Environments:** dev / staging / prod
- **Observability:** OpenTelemetry + Prometheus/Grafana + Loki
- **Rationale:** 支撑 MVP 快速迭代，并为后续可观测与扩展留接口

### Decision Impact Analysis

**Implementation Sequence:**
1. 建立数据与事件骨架（PostgreSQL + Redis + 事件表）
2. 实现状态机处理器与超时监测
3. 打通 REST + WS/SSE 与读模型投影
4. 落地 RBAC 与审计检索能力
5. 接入观测与 CI/CD，形成三环境流水线

**Cross-Component Dependencies:**
- 状态机正确性依赖 EventSequence 与 append-only 事件源
- 控制台一致性依赖读模型投影与实时推送协同
- 异常恢复能力依赖超时监测 + 告警 + 回补查询
- 外部集成可靠性依赖幂等策略与事件顺序保证

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
重点覆盖 5 类冲突点：命名、结构、格式、事件通信、过程一致性。

### Naming Patterns

**Database Naming Conventions:**
- 表名/列名统一 `snake_case`
- 主外键统一：`{entity}_id`
- 审计与事件字段统一小写下划线

**API Naming Conventions:**
- 路径统一 `kebab-case + plural resources`
- 示例：`/commands`, `/nodes`, `/api/external/commands`

**Code Naming Conventions:**
- TypeScript/前端状态统一 `camelCase`
- 类型/类名使用 `PascalCase`
- 常量使用 `UPPER_SNAKE_CASE`

### Structure Patterns

**Project Organization:**
- 领域优先组织：`command`, `node`, `event`, `audit`, `realtime`
- 避免按技术层扁平拆分导致跨域耦合

**File Structure Patterns:**
- 单元测试与源码同目录：`*.spec.ts`
- 集成/E2E 测试集中：
  - `apps/api/test/e2e`
  - `apps/console/test/e2e`

### Format Patterns

**API Response Formats:**
- 成功响应：`{ data, meta? }`
- 失败响应：`{ error: { code, message, details?, trace_id } }`

**Data Exchange Formats:**
- 时间字段统一 `ISO-8601 UTC` 字符串
- 分页信息统一在 `meta.pagination`：`page`, `page_size`, `total`

### Communication Patterns

**Event System Patterns:**
- 事件命名统一 `domain.action`
  - 示例：`command.created`, `node.acknowledged`
- 每个 `command_id` 强制单调 `event_sequence`
- 消费端按 `command_id + event_sequence` 去重与重放

**State Management Patterns:**
- 所有状态迁移必须经 `State Machine Processor`
- 禁止旁路直接改状态
- 读侧状态仅来源于事件投影，不直接拼装业务真相

### Process Patterns

**Error Handling Patterns:**
- 错误码体系统一，业务错误与系统错误分层
- 所有错误响应携带 `trace_id`，便于追踪与审计

**Loading State Patterns:**
- 前端实时状态以推送为主、查询回补为辅
- 网络抖动下优先保证状态可恢复与视图一致性

### Observability & Alerting Patterns

- 结构化日志 JSON，必须字段：
  - `trace_id`, `command_id`, `node_id`, `event_type`
- 日志级别统一：
  - `DEBUG`, `INFO`, `WARN`, `ERROR`
- 告警分级统一：
  - `P1`, `P2`, `P3`
- 关键 SLI：
  - 状态刷新延迟
  - 链路事件延迟
  - 超时率
  - 回调成功率

### Enforcement Guidelines

**All AI Agents MUST:**
- 严格遵守命名与响应格式，不得各自定义变体
- 任何状态变更必须走事件 + 状态机路径
- 新增接口/事件必须附带最小可观测字段与测试覆盖

**Pattern Enforcement:**
- CI 中执行 lint + schema contract + test gates
- 发现模式偏差需在 PR 说明中声明并给出迁移策略
- 任何破坏一致性的改动需先更新架构文档再实施

### Pattern Examples

**Good Examples:**
- `command.created` + `event_sequence` 连续递增
- `GET /commands/{id}` 返回 `{ data, meta }`
- 异常响应统一携带 `trace_id`

**Anti-Patterns:**
- 旁路直接更新 `commands.state`
- 同类接口返回格式不一致
- 事件命名混用 `CommandCreated` 与 `command.created`

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
workspace-VSCode/
├─ README.md
├─ pnpm-workspace.yaml
├─ package.json
├─ turbo.json
├─ .editorconfig
├─ .gitignore
├─ .github/
│  └─ workflows/
│     ├─ ci.yml
│     └─ cd.yml
├─ apps/
│  ├─ console/
│  │  ├─ package.json
│  │  ├─ next.config.ts
│  │  ├─ tailwind.config.ts
│  │  ├─ tsconfig.json
│  │  ├─ app/
│  │  │  ├─ layout.tsx
│  │  │  ├─ page.tsx
│  │  │  └─ (dashboard)/
│  │  │     ├─ commands/
│  │  │     ├─ nodes/
│  │  │     ├─ alerts/
│  │  │     └─ timeline/
│  │  ├─ features/
│  │  │  ├─ command/
│  │  │  ├─ node/
│  │  │  ├─ alerts/
│  │  │  ├─ timeline/
│  │  │  └─ realtime/
│  │  ├─ shared/
│  │  │  ├─ ui/
│  │  │  └─ lib/
│  │  └─ test/
│  │     └─ e2e/
│  └─ api/
│     ├─ package.json
│     ├─ nest-cli.json
│     ├─ tsconfig.json
│     ├─ src/
│     │  ├─ main.ts
│     │  ├─ app.module.ts
│     │  ├─ modules/
│     │  │  ├─ command/
│     │  │  ├─ node/
│     │  │  ├─ event/
│     │  │  ├─ audit/
│     │  │  ├─ realtime/
│     │  │  └─ auth/
│     │  ├─ state-machine/
│     │  ├─ read-model/
│     │  ├─ integrations/
│     │  │  └─ external-api/
│     │  └─ common/
│     └─ test/
│        ├─ integration/
│        └─ e2e/
├─ packages/
│  └─ shared/
│     ├─ contracts/
│     ├─ types/
│     ├─ eslint-config/
│     └─ tsconfig/
├─ tests/
│  └─ contracts/
└─ infra/
   ├─ docker/
   ├─ monitoring/
   └─ scripts/
```

### Architectural Boundaries

**API Boundaries:**
- 外部入口统一走 `apps/api` 的 REST API
- 实时通道由 `modules/realtime` 暴露（WS 优先，SSE 备用）
- 外部集成仅通过 `integrations/external-api` 边界进入
- 鉴权与授权边界固定在 `modules/auth`

**Component Boundaries:**
- Console 只消费 read-model 与实时事件，不直接拼写侧状态
- 功能按 `features/*` 纵向切分，UI 原子能力在 `shared/ui`
- 前端业务逻辑不得跨 feature 直接耦合数据源实现

**Service Boundaries:**
- 命令生命周期在 `modules/command` 与 `state-machine` 闭环
- 节点能力在 `modules/node`
- 审计记录在 `modules/audit`（append-only）
- 事件处理在 `modules/event` + `state-machine`，禁止旁路改状态

**Data Boundaries:**
- 写侧权威模型：PostgreSQL
- 读侧投影：`read-model` 子系统维护
- 实时/缓存/流：Redis
- 合同边界：`packages/shared/contracts` 作为前后端统一契约源

### Requirements to Structure Mapping

**Feature / FR Mapping:**
- FR1–FR5（指令建模与下发）→ `modules/command` + `features/command`
- FR6–FR10（节点理解与传导）→ `modules/node` + `modules/event` + `features/node`
- FR11–FR15（反馈闭环）→ `state-machine` + `read-model` + `features/timeline`
- FR16–FR21（链路可视化与告警）→ `modules/realtime` + `features/realtime` + `features/alerts`
- FR22–FR26（审计追溯）→ `modules/audit` + `features/timeline`
- FR27–FR31（运维/排障）→ `modules/node` + `modules/event` + `features/alerts`
- FR32–FR36（外部集成）→ `integrations/external-api` + `tests/contracts`

**Cross-Cutting Concerns:**
- RBAC 全局拦截：`modules/auth`
- 一致命名与 schema：`packages/shared/contracts` + `packages/shared/types`
- 规范统一：`packages/shared/eslint-config` + `packages/shared/tsconfig`

### Integration Points

**Internal Communication:**
- API 模块间通过领域事件与显式 service 接口通信
- 状态迁移统一经 `state-machine`，并写入审计流
- 读侧由事件投影更新，供 console 查询

**External Integrations:**
- 外部系统写入命令：`/api/external/commands`
- 外部回调注册与事件订阅：`integrations/external-api`
- 统一幂等键与签名校验策略

**Data Flow:**
- 写入（REST）→ 事件（Redis Streams）→ 状态机 → 审计/投影 → 控制台实时展示
- 查询走 read-model，避免写侧查询放大

### File Organization Patterns

**Configuration Files:**
- 工作区级配置在仓库根目录
- 应用级配置分别位于 `apps/console` 与 `apps/api`
- 环境变量按 app 独立，公共约定在 `infra/`

**Source Organization:**
- 后端按领域模块 + 状态机 + 投影组织
- 前端按路由 + feature + shared 组织
- 共享契约与类型在 `packages/shared`

**Test Organization:**
- 单元测试同目录
- API 与 Console 的集成/E2E 分层
- 合同测试集中在 `tests/contracts`

**Asset Organization:**
- Console 静态资源在 `apps/console/public`
- 监控与部署资产在 `infra/`

### Development Workflow Integration

**Development Server Structure:**
- `apps/console` 与 `apps/api` 可并行本地启动
- Redis/PostgreSQL 由 `infra/docker` 启动本地依赖

**Build Process Structure:**
- monorepo 统一构建编排（workspace + task runner）
- 共享包先构建，再构建 app

**Deployment Structure:**
- 前后端分离部署
- CI/CD 按应用与环境分阶段发布
- 监控组件随 `infra/monitoring` 统一管理

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
技术选型与版本链路一致：Next.js + NestJS + PostgreSQL + Redis + OTel 组合无显式冲突。

**Pattern Consistency:**
命名、结构、格式、通信、过程五类规则与技术栈匹配，能约束多 AI agent 输出一致实现。

**Structure Alignment:**
目录结构与模块边界支持 CQRS、状态机、审计、实时投影，不存在明显边界重叠。

### Requirements Coverage Validation ✅

**Feature Coverage:**
FR1-FR36 已映射到具体模块/目录，核心链路（命令→事件→状态→投影）可落地。

**Functional Requirements Coverage:**
全部功能域（指令、节点、反馈、告警、审计、运维、集成）均有架构承载点。

**Non-Functional Requirements Coverage:**
实时、可用性、安全、可扩展、集成可靠性均有对应架构策略与组件支撑。

### Implementation Readiness Validation ✅

**Decision Completeness:**
关键决策已明确（数据、安全、通信、前端、部署）并具备执行顺序。

**Structure Completeness:**
项目树与边界清晰，可直接进入实现分解。

**Pattern Completeness:**
冲突高发项均有统一规则，可作为 AI agent 实施约束基线。

### Gap Analysis Results

**Critical Gaps:** 无
**Important Gaps:**
1. 建议补充 `functional_safety` 深化条目（安全目标/失效处置分级）
2. 建议补充 `engineering_authority` 治理条目（签审责任与变更门禁）
3. 建议补充状态机迁移真值表（事件→合法迁移→拒绝策略）

**Nice-to-Have Gaps:**
- 增加接口契约示例（OpenAPI/JSON Schema 示例片段）
- 增加告警分级与运行手册链接位

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context analyzed
- [x] Scale/complexity assessed
- [x] Constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**
- [x] Critical decisions documented
- [x] Technology stack specified
- [x] Integration patterns defined
- [x] Performance/security considered

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Boundaries established
- [x] Integration points mapped
- [x] Requirements mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION
**Confidence Level:** High

**Key Strengths:**
- 架构骨架与 PRD 高一致性
- 一致性规则可直接约束多 agent 并行开发
- 读写分离与事件驱动路径清晰

**Areas for Future Enhancement:**
- 强化高复杂域合规深度（functional safety / engineering authority）
- 在实施前补充状态机真值表与契约样例

### Implementation Handoff

**AI Agent Guidelines:**
- 严格按本架构文档与 patterns 执行
- 不得绕过状态机直接改状态
- 所有新增接口/事件必须遵守 contracts 与命名规范

**First Implementation Priority:**
- 先落地 Command + Event + State Machine + Audit Log 核心骨架
- 再接入 Read Model + Realtime Gateway + Console 可视化
