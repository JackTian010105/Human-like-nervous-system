---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
inputDocuments:
  - /Users/jack/Nutstore Files/Jack坚果云-AI/workspace-VSCode/_bmad-output/planning-artifacts/product-brief-workspace-VSCode-2026-03-08.md
documentCounts:
  briefCount: 1
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 0
  productBriefs: 1
  research: 0
  brainstorming: 0
  projectContext: 0
  projectDocs: 0
workflowType: 'prd'
projectName: 'workspace-VSCode'
author: 'Jack'
date: '2026-03-08T09:58:50+0800'
classification:
  projectType: web_app
  domain: process_control
  complexity: high
  projectContext: greenfield
---

# Product Requirements Document - workspace-VSCode

**Author:** Jack
**Date:** 2026-03-08

## Executive Summary

本项目面向高复杂度流程控制场景，构建“组织神经系统”可视化操作台，用于验证并运行一条可追踪、可验证、可回传的指令闭环。系统聚焦最小可行闭环：发令、理解回执、下行传导确认、末梢反馈聚合、中枢再判断。核心目标不是扩张规模，而是先证明指令在组织链路中可稳定传导且低失真，并形成可信反馈。

产品的首要用户是长官式验收者（孙武）与神经节点执行者（队长/队员）。系统通过统一结构化指令与强制回执机制，把“口头追问与抽查”转为“链路状态透明与异常可定位”，将执行质量从主观感受转化为可度量信号（如指令匹配度、二次解释率、节点沉默率、闭环完整度）。

### What Makes This Special

本产品的核心差异不是复杂智能能力，而是“统一指令模型（soul.md 风格）”作为全链路约束。所有节点基于同一语义模型接收、理解、传导与反馈，降低指令衰减、失真与丢失概率。  
其关键价值在于：通过统一指令模型，让各节点在传导链条内达到清晰、低失真的闭环；让用户获得“可验证、可信任”的指令系统，而非仅依赖经验驱动的管理动作。

## Project Classification

- Project Type: `web_app`（可视化操作台）
- Domain: `process_control`（流程/指令控制系统）
- Complexity: `high`
- Project Context: `greenfield`

## Success Criteria

### User Success

用户感知成功的核心结果：
- 指令可稳定传导
- 执行状态透明可见

对应量化标准：
- 闭环完整度 >= 90%
- 状态可追踪覆盖率 >= 95%

### Business Success

3 个月业务成功标准（能力验证导向）：
- 神经闭环稳定运行 >= 2 周
- 闭环完整度 >= 90%
- 指令状态可追踪覆盖率 >= 95%

### Technical Success

MVP 技术成功标准：
- 状态机一致性 >= 99%
- 关键事件记录覆盖率 >= 99%
- P95 链路延迟 <= 5 秒

### Measurable Outcomes

必须同时满足的阶段性量化结果：
- 闭环完整度 >= 90%
- 状态可追踪覆盖率 >= 95%
- 闭环连续稳定运行 >= 2 周
- 状态机一致性 >= 99%
- 关键事件记录覆盖率 >= 99%
- P95 链路延迟 <= 5 秒

## Product Scope

### MVP - Minimum Viable Product

- 目标：验证“指令可稳定传导并形成可验证闭环”
- 核心范围：结构化指令包、首节点理解回执、下行传导确认、末梢反馈聚合、指令链路可视化
- 关键约束：统一指令模型优先，先保证链路透明与反馈强制存在，不追求复杂智能化

### Growth Features (Post-MVP)

- 自动异常修复机制
- 指令质量优化与策略增强
- 多链路并行能力
- 组织规模扩展能力

### Vision (Future)

- 自适应指令优化能力（Adaptive Command Optimization）
- 组织神经网络扩展能力（Scalable Neural Command Network）
- 异常自愈与自动纠偏能力（Autonomous Error Recovery）

## User Journeys

### Journey 1 - Primary User (Success Path): 孙武（长官验收者）

- Opening Scene:
  孙武在需要快速统一队伍行为、且必须确保命令被准确执行与可追踪的场景下，通过系统发出结构化指令包（例如“全队列整齐、保持静默、等待下一步命令”）。

- Rising Action:
  系统将指令沿既定链路传导，首节点回传理解回执，下游节点持续更新执行状态，链路状态在操作台实时可见。

- Climax:
  孙武在操作台上一眼看到该指令已沿链路被所有节点正确理解、执行状态实时回传且无异常节点，无需追问即可确认闭环成立。

- Resolution:
  孙武基于可信状态回传快速做下一轮决策，管理动作从“反复催问”转为“按证据指挥”。

### Journey 2 - Primary User (Edge Case): 孙武（异常恢复路径）

- Opening Scene:
  孙武发出关键指令后，系统在规定时间窗内未收到关键节点完整回执。

- Rising Action:
  系统自动识别链路断点，标记异常节点并触发超时告警，展示异常节点位置与受影响链路段。

- Climax:
  孙武获得明确处置选项：重新下达指令或指定替代节点继续传导。

- Resolution:
  链路恢复后，系统继续跟踪闭环状态并保留异常轨迹，确保可审计与可复盘。

### Journey 3 - Admin/Operations: 管宁（系统运行维护者）

- Persona:
  角色名：管宁
  职责：维护组织神经系统运行秩序，监控链路状态、处理异常节点、调整节点配置并确保系统稳定运转。

- Opening Scene:
  每日运行周期开始，管宁进入操作台进行系统健康检查。

- Rising Action:
  管宁检查链路状态与异常列表，定位未回执或传导异常节点。

- Climax:
  管宁及时触发处理动作（告警处置、节点替换、配置调整），阻断异常扩散。

- Resolution:
  系统恢复稳定，异常处理过程留痕，形成后续优化输入。

### Journey 4 - Support/Troubleshooting: 扁鹊（故障诊断与修复）

- Persona:
  角色名：扁鹊
  核心任务：诊断并排查神经链路技术故障，定位异常、修复问题并恢复链路。

- Opening Scene:
  系统出现传导异常告警，扁鹊介入排障。

- Rising Action:
  扁鹊基于日志与事件记录进行定位分析。

- Climax:
  系统必须提供的关键信息：
  - CommandID
  - NodeID
  - EventTimeline

- Resolution:
  故障定位与修复后，链路恢复，修复记录纳入事件归档。

### Journey 5 - API/Integration: 墨子（外部系统集成者）

- Persona:
  角色名：墨子
  核心任务：通过 API 与外部系统集成，将外部事件转换为结构化指令包并接入系统；订阅状态与反馈事件实现自动化协同。

- Opening Scene:
  外部业务系统产生触发事件，需要驱动组织神经链路执行。

- Rising Action:
  墨子通过 API 写入结构化指令包，并订阅执行状态流与反馈事件流。

- Climax:
  外部系统可实时获知指令进度、异常节点与闭环结果，形成自动联动。

- Resolution:
  集成链路稳定运行，系统从“人工对接”升级为“事件驱动协同”。

### Journey Requirements Summary

以上旅程共同揭示的能力需求：
- 统一指令模型与结构化指令包能力
- 节点理解回执与下行传导确认机制
- 末梢反馈聚合与中枢再判断闭环
- 实时链路可视化与异常超时告警
- 异常定位与审计留痕（至少包含 CommandID/NodeID/EventTimeline）
- 角色化操作能力（指挥、运维、排障、集成）
- API 事件接入与状态订阅能力（为后续集成扩展预留）

## Domain-Specific Requirements

### Compliance & Regulatory

1) 指令全链路不可丢失留痕（Command Trace Integrity）
- 要求：每条指令具备完整可追踪记录，至少包含 CommandID、发令者、目标节点、状态变化、时间戳
- 底线指标：审计留痕完整率 = 100%
- 解释：任何指令都必须可追溯“产生-传导-执行-反馈”全流程

2) 节点责任可追溯（Node Accountability）
- 要求：系统可明确定位“哪一节点、何时、执行了什么动作”
- 必记录字段：NodeID、ActionType、ActionTimestamp、ActionResult
- 底线指标：任何异常必须可追溯到具体节点

3) 审计记录不可篡改（Audit Immutability）
- 要求：关键事件日志采用 append-only，不允许覆盖修改，保留历史版本
- 底线指标：事件日志修改率 = 0
- 约束：任何修改行为必须产生新的审计事件

4) 时间一致性（Temporal Consistency）
- 要求：链路事件基于统一时间源记录，确保审计与排障时序一致
- 价值：降低跨节点排障歧义，提升状态重建可信度

### Technical Constraints

1) 系统可用性（System Availability）
- 指标：系统可用性 >= 99.5%（按月统计）
- 影响面：发令、回执、状态查询不可因系统不可用中断

2) 指令链路延迟（Command Propagation Latency）
- 指标：P95 链路延迟 <= 5 秒（默认按 1 小时统计）
- 目的：保证闭环响应速度满足指挥场景要求

3) 关键数据安全（Command Data Protection）
- 传输加密：100% HTTPS/TLS
- 敏感字段存储加密率 = 100%
- 访问鉴权覆盖率 = 100%
- 覆盖对象：CommandID 相关数据、NodeID 身份信息、事件日志

### Integration Requirements

1) API 幂等性保证（Idempotent Command Submission）
- 约束：外部写入 API 必须支持 Idempotency-Key 或 CommandID 幂等控制
- 规则：同一 Idempotency-Key 在 24 小时内仅允许成功创建一次，重复请求返回同一结果
- 目标：防止重试导致重复指令与链路污染

2) 事件顺序与回调签名（Event Ordering & Callback Signature）
- 顺序重建：每个 CommandID 事件携带递增 EventSequence，支持外部系统按序重建状态
- 来源校验：所有回调请求携带 HMAC-SHA256 签名，外部系统可验证真实性
- 目标：避免乱序导致状态误判，防止伪造回调

### Risk Mitigations

1) 节点静默失效（Silent Node Failure）
- 风险：节点未执行或离线但未被及时识别，链路表面正常、实际断裂
- 缓解：链路阶段强制回执 + timeout watchdog；超时自动标记异常并触发告警/替代节点机制

2) 事件顺序错乱（Event Ordering Drift）
- 风险：事件到达顺序与实际发生顺序不一致，引发状态机错误或闭环误判
- 缓解：引入单调递增 EventSequence + 统一时间戳（或逻辑时钟），按序重建并拒绝非法状态跳转

## Web App Specific Requirements

### Project-Type Overview

本产品以 `web_app` 形态交付，定位为高实时性的指令链路操作台（process control console）。
核心目标是让指令传导与反馈状态在可视化界面中持续可见，支持指挥、运维、排障与集成角色基于统一状态做快速决策。

### Technical Architecture Considerations

- 前端架构：`SPA`（Single Page Application）
- 实时通信：采用 Server Push 模式优先，避免轮询导致状态滞后
  - 首选：WebSocket
  - 备用：SSE
- 事件驱动模型：基于 CommandEvent Stream 推送状态变化
  - 典型事件：
    - CommandCreated
    - NodeAcknowledged
    - CommandPropagated
    - ExecutionReported
    - FeedbackReturned
    - TimeoutDetected
- 设计原则：链路状态变化必须快速传播到控制台，避免“人工追问回潮”

### Browser Matrix

- 最低浏览器支持：
  - Chrome：最新两个大版本
  - Edge：最新两个大版本
- 兼容策略：
  - 核心功能在最低支持范围内必须可用
  - 实时推送能力在支持范围内需稳定运行

### Responsive Design

- 主要使用场景：桌面控制台优先
- 响应式要求：
  - 页面在常见桌面分辨率下保证信息密度与可读性
  - 在较小视窗下保持关键状态面板、异常告警、链路视图可访问
- 设计取向：
  - 优先保障“指令状态可见性”而非装饰性布局

### SEO Strategy

- 适用性：Not Applicable（N/A）
- 原因：本系统为内部认证控制台（authenticated internal console），不面向公开索引流量，核心价值在实时指令链路可见性与操作可靠性而非搜索发现。
- 基线要求：
  - 禁止公开索引（默认 `noindex` 策略）
  - 公开入口仅保留必要的登录与权限边界说明

### Performance Targets

- 实时状态刷新上限延迟：`<= 1 秒`
  - 定义：状态变化发生到操作台可见的最大传播时间
- 与已有技术指标对齐：
  - P95 链路延迟 <= 5 秒（系统级）
  - 控制台展示延迟 <= 1 秒（界面级）
- 性能目标说明：
  - 支撑异常快速定位和即时指挥判断
  - 避免低频轮询造成决策迟滞

### Accessibility Baseline

本项目当前不承诺完整 WCAG 2.1 AA，但设定基础可用性底线：
- 键盘基本可操作（核心操作可通过键盘完成）
- 颜色对比度基本可读（关键文字与状态信息清晰可辨）
- 关键状态不只依赖颜色表达（需辅以文本/图标/标记）

### Real-Time Transport

- 传输策略：
  - 默认 WebSocket 持续连接推送
  - 在网络或环境限制下可降级为 SSE
- 推送对象：
  - 指令状态变化
  - 节点回执
  - 异常告警
  - 链路断点
- 可靠性要求：
  - 连接断开后具备自动重连机制
  - 事件应支持顺序重建（配合 EventSequence）
  - 与审计留痕体系保持一致

### Implementation Considerations

- MVP 阶段不引入复杂前端智能分析能力，优先保证：
  - 状态可见
  - 告警即时
  - 链路可追踪
- 前后端契约应围绕统一指令模型，确保界面状态与事件语义一致。

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** 问题验证型（Problem Validation MVP）
**战略意图:** 以最短路径验证核心假设“指令可稳定传导并形成可验证闭环”，优先可证伪性与学习速度，而非功能完备度。
**Resource Requirements:** 极简跨职能小队（约 3 人）
- 产品/架构：0.5
- 前端工程师：1
- 后端工程师：1
- 测试/运维：0.5

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- 孙武成功路径（闭环可见、无需追问）
- 孙武异常路径（超时告警、替代节点/重下发）
- 管宁运维路径（链路巡检、异常处置）
- 扁鹊排障路径（基于事件日志定位修复）

**Must-Have Capabilities:**
- 统一指令模型（结构化指令包）
- 首节点理解回执
- 下行传导确认
- 末梢反馈聚合
- 指令链路可视化（实时状态）
- 异常超时监测与告警
- 基础审计留痕（可追踪、可归责、不可篡改）

### Post-MVP Features

**Phase 2 (Post-MVP):**
1. 自动异常修复能力（Automated Recovery）
2. 多链路并行与规模扩展（Multi-Command / Multi-Chain Support）
3. API 与外部系统集成能力（Integration & Event Subscription）

**Phase 3 (Expansion):**
1. 自适应指令优化能力（Adaptive Command Optimization）
2. 组织神经网络扩展能力（Scalable Neural Command Network）
3. 异常自愈与自动纠偏能力（Autonomous Error Recovery）

### Risk Mitigation Strategy

**Technical Risks:**
- 风险：节点增多或网络波动时，实时事件流可能状态不同步
- 缓解：事件日志 + EventSequence 顺序重建；客户端自动重连与状态重放

**Market Risks:**
- 风险：用户仍依赖口头追问/私下沟通，不愿切换到系统状态驱动
- 缓解：在试运行组织强制以系统链路状态作为唯一执行依据，以效率提升驱动行为迁移

**Resource Risks:**
- 风险：小团队下开发与运维负担集中，导致进度延误
- 缓解：严格锁定 MVP 范围，仅做“闭环验证”最小能力，非核心能力延后到 Phase 2

## Functional Requirements

### 指令建模与下发

- FR1: 孙武 can 创建结构化指令包，包含指令内容、目标节点、执行要求与反馈要求。
- FR2: 系统 can 为每条指令生成唯一 CommandID，并记录发令时间与发令者身份。
- FR3: 孙武 can 选择或指定首节点（队长）作为指令链路起点，确定下行传导路径。
- FR4: 系统 can 将指令包写入指令链路并触发首节点接收事件，进入传导状态机。
- FR5: 孙武 can 查看已发出指令的当前状态（已接收、传导中、反馈中、闭环完成）。

### 节点理解与传导

- FR6: 节点（队长/队员） can 接收指令包并查看其结构化内容（指令目标、执行要求、反馈要求）。
- FR7: 节点 can 提交理解回执，确认已理解指令并返回理解状态。
- FR8: 节点（队长） can 向下游节点传导指令，将指令包发送至其负责的下级节点。
- FR9: 系统 can 记录每一次节点动作事件（接收、理解、传导），并生成对应事件日志。
- FR10: 系统 can 在节点未按时完成理解或传导时触发超时检测，并标记该节点为异常状态。

### 反馈闭环与中枢再判断

- FR11: 节点（队员） can 提交执行反馈，报告指令执行状态（完成/未完成/异常）。
- FR12: 节点（队长） can 聚合下游节点反馈，并向上游节点回传汇总状态。
- FR13: 系统 can 根据节点反馈更新指令链路状态，并判断是否达到闭环完成条件。
- FR14: 孙武 can 查看指令闭环结果与当前链路状态，包括已完成节点、未完成节点与异常节点。
- FR15: 孙武 can 基于闭环反馈结果发出下一轮指令或调整指令策略，形成新的指令循环。

### 链路可视化与告警

- FR16: 孙武 can 在操作台查看每条指令的链路状态视图，包括当前节点位置与整体进度。
- FR17: 系统 can 实时展示各节点状态（已接收、已理解、已传导、已执行、异常）。
- FR18: 系统 can 在节点超时或链路断点时自动生成异常告警，并标记异常节点位置。
- FR19: 孙武 can 查看异常节点详情，包括 NodeID、当前状态与最近事件时间。
- FR20: 系统 can 在界面中突出显示异常链路段，帮助用户快速定位问题。
- FR21: 系统 can 通过实时事件推送更新链路状态，确保控制台状态刷新延迟 <= 1 秒。

### 审计与可追溯

- FR22: 系统 can 为每条指令记录完整审计日志，覆盖发令、接收、理解、传导、执行与反馈等关键事件。
- FR23: 系统 can 为每个事件生成结构化审计记录，至少包含 CommandID、NodeID、EventType、Timestamp。
- FR24: 孙武/管宁 can 查询任意指令的完整事件时间线（EventTimeline），用于复盘与责任定位。
- FR25: 系统 can 确保审计日志为只追加（append-only）记录，不允许覆盖或删除历史事件。
- FR26: 管宁/扁鹊 can 按 CommandID 或 NodeID 检索历史记录，快速定位链路异常与执行轨迹。

### 运行管理与故障排查

- FR27: 管宁 can 查看系统运行健康状态面板，包括链路活跃度、异常节点数与实时告警列表。
- FR28: 管宁 can 配置或调整节点信息（节点名称、角色类型、所属链路位置）。
- FR29: 系统 can 自动检测并标记异常节点（未回执、传导超时、执行失败）。
- FR30: 扁鹊 can 查看节点级技术诊断信息，包括最近事件记录、错误日志与连接状态。
- FR31: 扁鹊 can 根据诊断信息定位链路故障并恢复节点连接或状态，使指令链路重新进入正常运行。

### 外部集成与事件订阅

- FR32: 墨子（外部系统集成者） can 通过 API 创建结构化指令包，并将其写入系统指令链路。
- FR33: 系统 can 为外部写入的指令返回 CommandID 与当前状态，用于后续状态追踪。
- FR34: 墨子 can 订阅指令状态事件流，实时获取指令进度、节点回执与闭环结果。
- FR35: 系统 can 通过回调或事件推送通知外部系统关键状态变化（闭环完成或异常发生）。
- FR36: 系统 can 对外部 API 请求实施鉴权与幂等控制，确保集成调用安全且不会产生重复指令。

## Non-Functional Requirements

### Performance

- NFR-P1: 控制台状态刷新延迟 <= 1 秒（状态变化到界面可见的最大传播时间）。
- NFR-P2: P95 链路事件处理延迟 <= 5 秒（默认按 1 小时统计）。
- NFR-P3: 系统可用性 >= 99.5%（按月统计，覆盖发令/回执/状态查询关键路径）。

### Security

- NFR-S1: 所有传输链路采用 HTTPS/TLS，传输加密覆盖率 = 100%。
- NFR-S2: 敏感字段存储加密率 = 100%（覆盖 CommandID 关联数据、NodeID 身份信息、事件日志）。
- NFR-S3: 访问鉴权覆盖率 = 100%（所有外部 API 与关键操作接口）。
- NFR-S4: 审计日志采用 append-only，不允许覆盖删除历史事件（日志修改率 = 0）。

### Scalability

- NFR-SC1: 系统 must 支持 >= 100 条并发指令链路同时运行。
- NFR-SC2: 系统 must 支持 >= 1,000 个节点注册并参与链路。
- NFR-SC3: 在 >=100 并发链路 + >=1,000 节点规模下，仍满足：
  - P95 链路事件处理延迟 <= 5 秒
  - 控制台状态刷新延迟 <= 1 秒

### Accessibility

- NFR-A1: Keyboard Coverage >= 90%（创建指令、查看链路、查看异常、检索记录等主要操作可通过键盘完成）。
- NFR-A2: Text Contrast Ratio >= 4.5:1（适用于状态文字、异常告警、操作标签）。
- NFR-A3: Critical Status Dual Encoding = 100%（关键状态必须“颜色 + 文本/图标”双重表达）。

### Integration

- NFR-I1: API Availability >= 99.5%（按月统计）。
- NFR-I2: Event Delivery Success Rate >= 99.9%。
- NFR-I3: Callback Retry Success >= 99%，失败回调需在 <=3 次自动重试内成功或被明确记录为失败。
- NFR-I4: 外部写入接口必须满足幂等约束（同一 Idempotency-Key 在 24 小时内仅创建一次并返回一致结果）。
