---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - /Users/jack/Nutstore Files/Jack坚果云-AI/workspace-VSCode/_bmad-output/planning-artifacts/prd.md
  - /Users/jack/Nutstore Files/Jack坚果云-AI/workspace-VSCode/_bmad-output/planning-artifacts/architecture.md
---

# workspace-VSCode - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for workspace-VSCode, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: 孙武 can 创建结构化指令包，包含指令内容、目标节点、执行要求与反馈要求。  
FR2: 系统 can 为每条指令生成唯一 CommandID，并记录发令时间与发令者身份。  
FR3: 孙武 can 选择或指定首节点（队长）作为指令链路起点，确定下行传导路径。  
FR4: 系统 can 将指令包写入指令链路并触发首节点接收事件，进入传导状态机。  
FR5: 孙武 can 查看已发出指令的当前状态（已接收、传导中、反馈中、闭环完成）。  
FR6: 节点（队长/队员） can 接收指令包并查看其结构化内容（指令目标、执行要求、反馈要求）。  
FR7: 节点 can 提交理解回执，确认已理解指令并返回理解状态。  
FR8: 节点（队长） can 向下游节点传导指令，将指令包发送至其负责的下级节点。  
FR9: 系统 can 记录每一次节点动作事件（接收、理解、传导），并生成对应事件日志。  
FR10: 系统 can 在节点未按时完成理解或传导时触发超时检测，并标记该节点为异常状态。  
FR11: 节点（队员） can 提交执行反馈，报告指令执行状态（完成/未完成/异常）。  
FR12: 节点（队长） can 聚合下游节点反馈，并向上游节点回传汇总状态。  
FR13: 系统 can 根据节点反馈更新指令链路状态，并判断是否达到闭环完成条件。  
FR14: 孙武 can 查看指令闭环结果与当前链路状态，包括已完成节点、未完成节点与异常节点。  
FR15: 孙武 can 基于闭环反馈结果发出下一轮指令或调整指令策略，形成新的指令循环。  
FR16: 孙武 can 在操作台查看每条指令的链路状态视图，包括当前节点位置与整体进度。  
FR17: 系统 can 实时展示各节点状态（已接收、已理解、已传导、已执行、异常）。  
FR18: 系统 can 在节点超时或链路断点时自动生成异常告警，并标记异常节点位置。  
FR19: 孙武 can 查看异常节点详情，包括 NodeID、当前状态与最近事件时间。  
FR20: 系统 can 在界面中突出显示异常链路段，帮助用户快速定位问题。  
FR21: 系统 can 通过实时事件推送更新链路状态，确保控制台状态刷新延迟 <= 1 秒。  
FR22: 系统 can 为每条指令记录完整审计日志，覆盖发令、接收、理解、传导、执行与反馈等关键事件。  
FR23: 系统 can 为每个事件生成结构化审计记录，至少包含 CommandID、NodeID、EventType、Timestamp。  
FR24: 孙武/管宁 can 查询任意指令的完整事件时间线（EventTimeline），用于复盘与责任定位。  
FR25: 系统 can 确保审计日志为只追加（append-only）记录，不允许覆盖或删除历史事件。  
FR26: 管宁/扁鹊 can 按 CommandID 或 NodeID 检索历史记录，快速定位链路异常与执行轨迹。  
FR27: 管宁 can 查看系统运行健康状态面板，包括链路活跃度、异常节点数与实时告警列表。  
FR28: 管宁 can 配置或调整节点信息（节点名称、角色类型、所属链路位置）。  
FR29: 系统 can 自动检测并标记异常节点（未回执、传导超时、执行失败）。  
FR30: 扁鹊 can 查看节点级技术诊断信息，包括最近事件记录、错误日志与连接状态。  
FR31: 扁鹊 can 根据诊断信息定位链路故障并恢复节点连接或状态，使指令链路重新进入正常运行。  
FR32: 墨子（外部系统集成者） can 通过 API 创建结构化指令包，并将其写入系统指令链路。  
FR33: 系统 can 为外部写入的指令返回 CommandID 与当前状态，用于后续状态追踪。  
FR34: 墨子 can 订阅指令状态事件流，实时获取指令进度、节点回执与闭环结果。  
FR35: 系统 can 通过回调或事件推送通知外部系统关键状态变化（闭环完成或异常发生）。  
FR36: 系统 can 对外部 API 请求实施鉴权与幂等控制，确保集成调用安全且不会产生重复指令。

### NonFunctional Requirements

NFR1: 控制台状态刷新延迟 <= 1 秒（状态变化到界面可见的最大传播时间）。  
NFR2: P95 链路事件处理延迟 <= 5 秒（默认按 1 小时统计）。  
NFR3: 系统可用性 >= 99.5%（按月统计，覆盖发令/回执/状态查询关键路径）。  
NFR4: 所有传输链路采用 HTTPS/TLS，传输加密覆盖率 = 100%。  
NFR5: 敏感字段存储加密率 = 100%（覆盖 CommandID 关联数据、NodeID 身份信息、事件日志）。  
NFR6: 访问鉴权覆盖率 = 100%（所有外部 API 与关键操作接口）。  
NFR7: 审计日志采用 append-only，不允许覆盖删除历史事件（日志修改率 = 0）。  
NFR8: 系统 must 支持 >= 100 条并发指令链路同时运行。  
NFR9: 系统 must 支持 >= 1,000 个节点注册并参与链路。  
NFR10: 在 >=100 并发链路 + >=1,000 节点规模下，P95 链路事件处理延迟 <= 5 秒。  
NFR11: 在 >=100 并发链路 + >=1,000 节点规模下，控制台状态刷新延迟 <= 1 秒。  
NFR12: Keyboard Coverage >= 90%（创建指令、查看链路、查看异常、检索记录等主要操作可通过键盘完成）。  
NFR13: Text Contrast Ratio >= 4.5:1（适用于状态文字、异常告警、操作标签）。  
NFR14: Critical Status Dual Encoding = 100%（关键状态必须“颜色 + 文本/图标”双重表达）。  
NFR15: API Availability >= 99.5%（按月统计）。  
NFR16: Event Delivery Success Rate >= 99.9%。  
NFR17: Callback Retry Success >= 99%，失败回调需在 <=3 次自动重试内成功或被明确记录为失败。  
NFR18: 外部写入接口必须满足幂等约束（同一 Idempotency-Key 在 24 小时内仅创建一次并返回一致结果）。

### Additional Requirements

- Starter Template：采用 Next.js + NestJS（分离式）作为 greenfield 启动基线。  
- 数据基线：PostgreSQL 17/18 作为权威写模型，Redis 8.x 负责实时/缓存/流式处理。  
- 数据模式：CQRS（写侧权威 + 读侧投影），控制台读取 Read Model。  
- 事件主干：Redis Streams（MVP），并将关键事件持久化到 PostgreSQL `command_events`。  
- 审计策略：`command_events` 必须 append-only，不允许覆盖历史。  
- 顺序一致性：每个 CommandID 强制递增 EventSequence，支持状态重建与非法跳转拒绝。  
- 通信模式：外部 API 走 REST；实时通道 WebSocket 优先，SSE 备用。  
- 幂等要求：外部写入使用 Idempotency-Key/CommandID 防重复写入。  
- 安全基线：JWT + Refresh Token + RBAC（孙武/管宁/扁鹊/墨子角色边界）。  
- 可观测性：OpenTelemetry + Prometheus/Grafana + Loki，覆盖链路事件与异常告警。  
- 部署与工程化：前后端分离，Docker Compose（dev/staging），GitHub Actions，三环境（dev/staging/prod）。  
- 实施顺序约束：先数据与事件骨架，再状态机与超时监测，再 REST + WS/SSE + 投影，再 RBAC 与审计查询能力。

### FR Coverage Map

FR1: Epic 1 - 创建结构化指令包  
FR2: Epic 1 - 生成并记录唯一 CommandID  
FR3: Epic 1 - 指定首节点并定义链路起点  
FR4: Epic 1 - 写入链路并触发首节点接收  
FR5: Epic 1 - 查看指令当前状态  
FR6: Epic 2 - 节点接收并查看结构化指令  
FR7: Epic 2 - 提交理解回执  
FR8: Epic 2 - 队长向下游传导指令  
FR9: Epic 2 - 记录节点动作事件  
FR10: Epic 2 - 超时检测与异常标记  
FR11: Epic 3 - 末梢提交执行反馈  
FR12: Epic 3 - 队长聚合并回传反馈  
FR13: Epic 3 - 更新链路状态并判定闭环  
FR14: Epic 3 - 查看闭环结果与节点状态  
FR15: Epic 3 - 基于反馈发起下一轮指令  
FR16: Epic 4 - 查看指令链路状态视图  
FR17: Epic 4 - 实时展示节点状态  
FR18: Epic 4 - 自动生成异常告警  
FR19: Epic 4 - 查看异常节点详情  
FR20: Epic 4 - 突出显示异常链路段  
FR21: Epic 4 - 实时推送并保障 <=1 秒刷新  
FR22: Epic 5 - 全链路审计记录  
FR23: Epic 5 - 结构化审计事件字段  
FR24: Epic 5 - 查询 EventTimeline  
FR25: Epic 5 - 审计 append-only 不可覆盖  
FR26: Epic 5 - 按 CommandID/NodeID 检索  
FR27: Epic 5 - 运行健康状态面板  
FR28: Epic 5 - 节点配置调整  
FR29: Epic 5 - 自动检测异常节点  
FR30: Epic 5 - 节点级诊断信息查看  
FR31: Epic 5 - 故障定位与恢复  
FR32: Epic 6 - 外部 API 创建结构化指令  
FR33: Epic 6 - 返回 CommandID 与状态  
FR34: Epic 6 - 订阅指令状态事件流  
FR35: Epic 6 - 回调/推送关键状态变化  
FR36: Epic 6 - 外部 API 鉴权与幂等控制

## Epic List

### Epic 1: 结构化发令与链路启动
用户可以创建标准化指令包、指定首节点并启动可追踪链路。  
**FRs covered:** FR1, FR2, FR3, FR4, FR5

### Epic 2: 节点理解确认与下行传导
节点可以接收并理解指令，队长可向下游稳定传导，系统可识别传导超时。  
**FRs covered:** FR6, FR7, FR8, FR9, FR10

### Epic 3: 末梢反馈闭环与中枢再判断
末梢执行反馈可上行汇总，中枢可基于闭环结果继续下一轮指令。  
**FRs covered:** FR11, FR12, FR13, FR14, FR15

### Epic 4: 实时链路可视化与异常告警
长官可实时掌握节点状态并快速定位异常链路段。  
**FRs covered:** FR16, FR17, FR18, FR19, FR20, FR21

### Epic 5: 审计追溯与运行管理诊断
系统可提供全链路审计、历史检索、健康面板与故障定位恢复能力。  
**FRs covered:** FR22, FR23, FR24, FR25, FR26, FR27, FR28, FR29, FR30, FR31

### Epic 6: 外部集成接入与事件订阅
外部系统可安全幂等写入指令并订阅状态事件。  
**FRs covered:** FR32, FR33, FR34, FR35, FR36

<!-- Repeat for each epic in epics_list (N = 1, 2, 3...) -->

## Epic 1: 结构化发令与链路启动

用户可以创建标准化指令包、指定首节点并启动可追踪链路。

### Story 1.1: Set up initial project from starter template

As a 开发团队（实现方）,
I want 基于 Next.js + NestJS starter 完成项目初始化与基础连通,
So that 后续业务故事可以在统一工程骨架上连续实现与验证。

**Acceptance Criteria:**

**Given** 仓库为空或仅有规划文档
**When** 基于选定 starter 初始化前后端工程
**Then** 生成可运行的 Next.js Console 与 NestJS API 基础结构
**And** 工程目录与命名符合 architecture 约定

**Given** 初始化完成
**When** 安装依赖并执行本地启动
**Then** Console 与 API 可在开发环境成功启动
**And** 基础健康检查接口可访问

**Given** 项目首次集成数据库与缓存依赖
**When** 使用 Docker Compose 启动 PostgreSQL 与 Redis
**Then** API 可成功连接两者
**And** 连接配置通过环境变量管理

**Given** 初始化阶段完成
**When** 运行基础 CI 检查（lint/test 占位或最小检查）
**Then** 流水线可执行且结果可见
**And** 产出初始 README/启动说明供团队复现

### Story 1.2: 创建结构化指令包

As a 孙武（长官验收者）,
I want 在操作台创建结构化指令包并完成必填校验,
So that 指令在进入链路前就具备清晰、可执行、可反馈的统一语义。

**Acceptance Criteria:**

**Given** 孙武已登录且具备发令权限
**When** 打开“新建指令”并填写指令内容、目标节点、执行要求、反馈要求后提交
**Then** 系统成功创建一条“待发令”指令草稿
**And** 草稿包含完整结构化字段并通过格式校验

**Given** 孙武提交时缺少任一必填字段
**When** 系统执行校验
**Then** 系统拒绝提交
**And** 在对应字段显示明确错误原因（不可仅颜色提示）

**Given** 孙武提交的字段值不合法（如长度超限、格式错误）
**When** 系统执行业务规则校验
**Then** 系统拒绝提交并返回可读错误信息
**And** 不写入任何链路传导事件

**Given** 指令草稿创建成功
**When** 系统返回结果
**Then** 返回结果包含草稿标识、当前状态和可继续发令入口
**And** 前端可通过键盘完成后续“继续发令”操作路径

### Story 1.3: 生成 CommandID 并记录发令元数据

As a 孙武（长官验收者）,
I want 系统在提交指令时自动生成唯一 CommandID 并记录发令元数据,
So that 每条指令都可被唯一追踪与审计归责。

**Acceptance Criteria:**

**Given** 孙武提交了一条通过校验的结构化指令包
**When** 系统执行创建流程
**Then** 系统生成全局唯一的 CommandID
**And** CommandID 在数据库中不可重复（唯一约束生效）

**Given** 指令创建成功
**When** 系统落库指令主记录
**Then** 必须同时记录 issuerId（发令者）、createdAt（发令时间）、初始状态
**And** 返回结果中包含 CommandID 与当前状态

**Given** 同一请求因网络抖动被前端重复提交
**When** 后端接收到重复请求（同一幂等键）
**Then** 系统不重复创建新指令
**And** 返回首次创建结果（同一 CommandID）

**Given** 创建流程任一关键写入失败
**When** 系统处理失败事务
**Then** 不得产生部分成功数据（如有 CommandID 但无主记录）
**And** 返回可追踪错误码并写入失败审计事件

### Story 1.4: 指定首节点并建立链路起点

As a 孙武（长官验收者）,
I want 在发令时选择首节点（队长）并建立指令链路起点,
So that 指令能从中枢进入明确的下行传导路径。

**Acceptance Criteria:**

**Given** 已存在可发令的结构化指令（含 CommandID）
**When** 孙武在发令界面选择一个可用首节点并确认发令
**Then** 系统为该指令绑定 rootNodeId
**And** 创建链路起点记录（中枢 -> 首节点）

**Given** 孙武选择的首节点不可用（离线/禁用/无权限）
**When** 系统校验节点可用性
**Then** 系统拒绝建立链路起点
**And** 返回可读错误信息并提示重新选择

**Given** 发令确认成功
**When** 系统写入链路起点
**Then** 指令状态从“待发令”进入“已下发/待接收”
**And** 记录对应审计事件（包含 CommandID、NodeID、EventType、Timestamp）

**Given** 用户需要无鼠标操作
**When** 在首节点选择与确认发令流程中使用键盘
**Then** 可完成节点搜索、选择、确认
**And** 关键状态变化有文本/图标双重表达

### Story 1.5: 查看已发指令当前状态

As a 孙武（长官验收者）,
I want 在操作台查看已发指令的当前状态,
So that 我能无需追问即可确认链路是否在按预期推进。

**Acceptance Criteria:**

**Given** 系统中已有已发出的指令
**When** 孙武进入指令列表或指令详情页
**Then** 系统展示每条指令当前状态（已接收/传导中/反馈中/闭环完成）
**And** 状态展示可按 CommandID 检索与过滤

**Given** 某条指令状态发生变化
**When** 后端产生状态变更事件
**Then** 控制台在 1 秒内更新该指令状态
**And** 若实时通道暂时中断，前端自动回补查询并恢复一致状态

**Given** 孙武查看单条指令详情
**When** 打开该指令
**Then** 可看到基础元数据（CommandID、发令者、发令时间、首节点）与当前状态
**And** 状态来源于权威读模型，不允许前端本地拼装推断

**Given** 用户仅使用键盘操作
**When** 在状态列表中执行检索、筛选与进入详情
**Then** 主要路径可完成
**And** 关键状态不只依赖颜色表达

## Epic 2: 节点理解确认与下行传导

节点可以接收并理解指令，队长可向下游稳定传导，系统可识别传导超时。

### Story 2.1: 节点接收并查看结构化指令

As a 队长/队员（神经节点）,
I want 在节点工作台接收并查看结构化指令内容,
So that 我能准确理解目标、执行要求与反馈要求而不依赖口头补充。

**Acceptance Criteria:**

**Given** 指令已下发到某节点且该节点具备访问权限
**When** 节点打开“待处理指令”列表
**Then** 系统展示该节点可见的指令卡片
**And** 每条卡片至少包含 CommandID、指令摘要、来源节点、到达时间、当前节点状态

**Given** 节点进入指令详情
**When** 打开指定 CommandID
**Then** 可查看结构化字段（指令目标、执行要求、反馈要求、时间要求）
**And** 字段展示与发令端保持一致，不允许节点侧二次改写原始指令文本

**Given** 节点尝试访问无权限指令
**When** 发起详情查询
**Then** 系统拒绝访问并返回鉴权错误
**And** 记录安全审计事件（含 NodeID、CommandID、时间戳）

**Given** 实时状态发生变化（如由“待接收”变为“已接收”）
**When** 事件到达节点工作台
**Then** 界面在 1 秒内更新
**And** 关键状态同时使用文本/图标与颜色表达

### Story 2.2: 节点提交理解回执

As a 队长/队员（神经节点）,
I want 在接收指令后提交理解回执,
So that 上游能确认我已正确理解并可继续传导或执行。

**Acceptance Criteria:**

**Given** 节点已打开某条可处理指令详情
**When** 节点填写并提交理解回执（理解状态、疑问说明可选）
**Then** 系统记录一次 UnderstandingSubmitted 事件
**And** 当前节点状态更新为“已理解”

**Given** 节点未填写必填回执项（如理解状态）
**When** 提交回执
**Then** 系统拒绝提交
**And** 返回明确字段级错误提示

**Given** 同一节点对同一指令重复提交相同回执（网络重试）
**When** 后端收到重复请求
**Then** 系统按幂等规则处理不重复写入
**And** 返回一致结果且不产生重复状态迁移

**Given** 回执提交成功
**When** 上游查看链路状态
**Then** 能在 1 秒内看到该节点“已理解”状态
**And** 审计时间线可查询该回执事件（CommandID、NodeID、EventType、Timestamp）

### Story 2.3: 队长下行传导并记录分发事件

As a 队长（中继节点）,
I want 将已理解的指令下行传导到指定下游节点,
So that 指令可以持续沿链路推进且每次传导都可追踪。

**Acceptance Criteria:**

**Given** 队长节点对某指令状态为“已理解”
**When** 队长选择一个或多个下游节点发起传导
**Then** 系统创建对应链路分发记录
**And** 为每个目标节点生成可追踪的传导事件

**Given** 队长提交传导请求
**When** 系统完成写入
**Then** 事件日志至少包含 CommandID、fromNodeId、toNodeId、EventType、Timestamp、EventSequence
**And** 指令状态更新为“传导中”

**Given** 传导目标包含无效或不可用节点
**When** 系统校验目标节点
**Then** 系统拒绝无效目标并返回节点级失败原因
**And** 有效目标可按策略继续或整体回滚（由配置策略决定且可审计）

**Given** 队长重复发起同一批次传导（重试场景）
**When** 系统处理重复请求
**Then** 不产生重复分发记录
**And** 返回同一批次处理结果用于上游确认

### Story 2.4: 理解/传导超时检测与异常标记

As a 管宁（运行维护者）,
I want 系统自动检测节点理解或传导超时并标记异常,
So that 我能及时处置链路断点，避免指令静默失效。

**Acceptance Criteria:**

**Given** 指令进入“待理解”或“待传导”阶段
**When** 超过对应超时阈值且未收到预期事件
**Then** Timeout Monitor 触发 TimeoutDetected 事件
**And** 目标节点状态被标记为“异常”

**Given** 节点被标记为异常
**When** 孙武或管宁查看操作台
**Then** 可看到异常节点、超时阶段、持续时长与最近事件时间
**And** 异常链路段在界面中突出显示

**Given** 出现超时异常
**When** 系统写入审计记录
**Then** 必须记录 CommandID、NodeID、timeoutType、detectedAt、EventSequence
**And** 记录为 append-only 不可覆盖

**Given** 节点在告警后补交回执或完成传导
**When** 系统收到补偿事件
**Then** 状态机按合法迁移更新状态
**And** 保留“异常 -> 恢复”完整事件链供复盘查询

## Epic 3: 末梢反馈闭环与中枢再判断

末梢执行反馈可上行汇总，中枢可基于闭环结果继续下一轮指令。

### Story 3.1: 末梢节点提交执行反馈

As a 队员（末梢节点）,
I want 提交执行结果反馈（完成/未完成/异常）,
So that 上游可以基于真实执行结果更新链路状态。

**Acceptance Criteria:**

**Given** 队员收到可执行指令
**When** 队员提交执行反馈
**Then** 系统记录 ExecutionReported 事件
**And** 反馈至少包含 CommandID、NodeID、执行状态、完成时间、异常说明（可选）

**Given** 队员提交异常状态
**When** 填写异常原因并提交
**Then** 系统将异常信息写入事件载荷
**And** 上游可在详情中直接查看异常上下文

**Given** 队员重复提交相同反馈（重试）
**When** 后端处理重复请求
**Then** 不产生重复执行事件
**And** 返回同一反馈结果

### Story 3.2: 队长聚合下游反馈并回传上游

As a 队长（中继节点）,
I want 聚合下游节点反馈并向上游回传汇总状态,
So that 中枢能够快速掌握链路执行全貌。

**Acceptance Criteria:**

**Given** 队长管理的多个下游节点已产生反馈
**When** 队长触发反馈聚合
**Then** 系统生成聚合结果（完成数、未完成数、异常数、未回执数）
**And** 记录 FeedbackReturned 事件

**Given** 存在未回执下游节点
**When** 生成聚合结果
**Then** 汇总中必须明确列出未回执节点列表
**And** 聚合状态不得误判为“闭环完成”

**Given** 聚合结果回传成功
**When** 上游查看该指令
**Then** 可看到最新汇总状态与更新时间
**And** 审计时间线可追踪本次聚合事件

### Story 3.3: 系统判定闭环完成条件并更新链路状态

As a 系统（状态机处理器）,
I want 根据反馈事件自动判定闭环是否成立,
So that 指令生命周期可以被一致、可验证地推进。

**Acceptance Criteria:**

**Given** 指令处于反馈回传阶段
**When** 收到新的反馈或聚合事件
**Then** 状态机按合法迁移规则更新状态
**And** 拒绝非法状态跳转并记录拒绝原因

**Given** 所有必需节点反馈齐备且满足闭环条件
**When** 系统执行判定
**Then** 指令状态迁移为 CLOSED（闭环完成）
**And** 写入闭环完成事件及判定时间

**Given** 存在异常/未回执节点
**When** 系统执行判定
**Then** 指令保持在反馈中或异常状态
**And** 在状态详情中暴露未满足闭环的具体条件

### Story 3.4: 中枢基于闭环结果发起下一轮指令

As a 孙武（长官验收者）,
I want 基于闭环反馈快速发起下一轮指令或调整策略,
So that 指挥循环可以持续运转并逐步优化执行质量。

**Acceptance Criteria:**

**Given** 某条指令已形成闭环结果或异常结果
**When** 孙武在详情页选择“发起下一轮”
**Then** 系统可基于上一轮上下文预填新指令草稿
**And** 明确标注继承字段与可修改字段

**Given** 孙武完成新一轮指令确认
**When** 提交新指令
**Then** 新指令获得新的 CommandID
**And** 与上一轮指令建立可追溯关联关系

## Epic 4: 实时链路可视化与异常告警

长官可实时掌握节点状态并快速定位异常链路段。

### Story 4.1: 指令链路全景视图

As a 孙武（长官验收者）,
I want 在操作台查看单条指令的链路全景,
So that 我能一眼判断指令推进位置与整体进度。

**Acceptance Criteria:**

**Given** 指令已进入传导流程
**When** 孙武打开链路视图
**Then** 页面展示从中枢到末梢的节点关系与当前节点位置
**And** 展示总体进度（已完成/总节点）

**Given** 链路存在多层级节点
**When** 用户展开或折叠节点层级
**Then** 界面保持结构一致且不丢失节点状态
**And** 节点点击可进入详情

### Story 4.2: 节点状态实时推送展示

As a 孙武（长官验收者）,
I want 通过实时推送看到节点状态变化,
So that 我无需人工刷新也能掌握最新态势。

**Acceptance Criteria:**

**Given** 控制台已建立 WS/SSE 连接
**When** 后端产生状态变化事件
**Then** 前端在 1 秒内更新对应节点状态
**And** 状态更新按 EventSequence 顺序应用

**Given** 实时连接中断
**When** 客户端自动重连
**Then** 系统执行状态重放或查询回补
**And** 恢复后界面状态与权威读模型一致

### Story 4.3: 异常告警与异常节点详情

As a 孙武（长官验收者）,
I want 在异常发生时即时收到告警并查看节点详情,
So that 我可以快速定位并决策处置动作。

**Acceptance Criteria:**

**Given** 出现节点超时或链路断点
**When** 系统识别异常
**Then** 自动生成异常告警
**And** 告警包含 CommandID、NodeID、异常类型、发生时间

**Given** 孙武点击异常节点
**When** 打开异常详情
**Then** 可查看当前状态、最近事件时间、最近错误信息
**And** 可直接跳转相关事件时间线

### Story 4.4: 异常链路段高亮与快速定位

As a 孙武（长官验收者）,
I want 在链路图中高亮异常链路段,
So that 我能在复杂节点网络中快速识别断点位置。

**Acceptance Criteria:**

**Given** 指令链路存在一个或多个异常节点
**When** 展示链路图
**Then** 异常链路段被显著高亮
**And** 关键状态同时使用颜色与文本/图标双编码

**Given** 用户使用键盘导航
**When** 聚焦异常列表与链路节点
**Then** 可在主要路径完成定位与详情查看
**And** 满足基础键盘可操作要求

## Epic 5: 审计追溯与运行管理诊断

系统可提供全链路审计、历史检索、健康面板与故障定位恢复能力。

### Story 5.1: 全链路审计事件记录（append-only）

As a 系统审计责任方（孙武/管宁）,
I want 每条指令关键动作都被结构化记录且不可篡改,
So that 任何闭环结果都可复盘和归责。

**Acceptance Criteria:**

**Given** 指令生命周期发生关键动作
**When** 系统写入审计日志
**Then** 每条事件包含 CommandID、NodeID、EventType、Timestamp、EventSequence
**And** 日志采用 append-only，不允许覆盖删除

**Given** 发生日志变更请求
**When** 请求尝试修改历史事件
**Then** 系统拒绝直接修改
**And** 若需更正必须追加新事件记录变更说明

### Story 5.2: EventTimeline 查询与历史检索

As a 孙武/管宁（管理者）,
I want 按 CommandID 或 NodeID 检索完整事件时间线,
So that 我能快速复盘执行轨迹并定位责任节点。

**Acceptance Criteria:**

**Given** 用户输入 CommandID 或 NodeID
**When** 发起检索
**Then** 系统返回按 EventSequence 排序的时间线
**And** 支持按事件类型和时间范围过滤

**Given** 检索结果较大
**When** 用户翻页或滚动
**Then** 返回稳定分页结果
**And** 不出现重复或缺失事件

### Story 5.3: 运行健康面板与异常总览

As a 管宁（运行维护者）,
I want 查看系统健康面板与异常总览,
So that 我能持续监控链路稳定性并优先处理高风险问题。

**Acceptance Criteria:**

**Given** 管宁进入运行管理页面
**When** 系统加载健康面板
**Then** 展示链路活跃度、异常节点数、实时告警列表
**And** 指标数据有明确更新时间

**Given** 存在多个异常告警
**When** 用户按严重级别筛选
**Then** 列表按优先级排序展示
**And** 支持一键跳转到对应指令与节点详情

### Story 5.4: 节点配置管理与诊断恢复

As a 管宁/扁鹊（运维与排障角色）,
I want 调整节点配置并查看诊断信息以恢复故障节点,
So that 指令链路可以尽快恢复到正常运行状态。

**Acceptance Criteria:**

**Given** 节点存在配置错误或连接异常
**When** 管宁更新节点名称、角色类型或链路位置配置
**Then** 系统保存变更并记录配置审计事件
**And** 变更仅对有权限角色开放

**Given** 扁鹊进入节点诊断页
**When** 查看技术信息
**Then** 可看到最近事件记录、错误日志、连接状态
**And** 可执行恢复动作并记录 RecoveryTriggered 事件

## Epic 6: 外部集成接入与事件订阅

外部系统可安全幂等写入指令并订阅状态事件。

### Story 6.1: 外部 API 创建结构化指令

As a 墨子（外部系统集成者）,
I want 通过 API 写入结构化指令包,
So that 外部事件可以进入组织神经系统统一处理。

**Acceptance Criteria:**

**Given** 外部系统持有有效凭证
**When** 调用创建指令 API
**Then** 系统创建指令并返回 CommandID 与当前状态
**And** 写入对应审计事件

**Given** 请求字段缺失或不合法
**When** 调用 API
**Then** 系统返回标准错误响应
**And** 不创建任何指令数据

### Story 6.2: 外部写入幂等与鉴权控制

As a 平台安全责任方,
I want 外部写入接口具备鉴权和幂等机制,
So that 集成调用安全可信且不会污染链路。

**Acceptance Criteria:**

**Given** 外部请求未通过鉴权
**When** 调用写入 API
**Then** 系统拒绝请求并返回鉴权错误
**And** 记录安全审计事件

**Given** 同一 Idempotency-Key 在 24 小时内重复提交
**When** 系统处理请求
**Then** 只创建一次指令
**And** 重复请求返回同一结果与同一 CommandID

### Story 6.3: 外部事件订阅与状态推送

As a 墨子（外部系统集成者）,
I want 订阅指令状态事件流,
So that 外部系统能实时获得进度、回执与闭环结果。

**Acceptance Criteria:**

**Given** 外部系统已完成订阅配置
**When** 指令状态发生关键变化
**Then** 系统推送对应事件（如闭环完成、异常发生）
**And** 事件包含 CommandID、EventType、EventSequence、Timestamp

**Given** 外部回调投递失败
**When** 触发重试机制
**Then** 系统在 <=3 次内自动重试
**And** 成功或最终失败都被明确记录

### Story 6.4: 事件顺序重建与回调签名验证

As a 墨子（外部系统集成者）,
I want 接收可重建顺序且可验签的回调事件,
So that 外部系统不会因乱序或伪造请求产生错误状态。

**Acceptance Criteria:**

**Given** 同一 CommandID 下发生多次事件
**When** 外部系统接收回调
**Then** 每个事件都携带递增 EventSequence
**And** 外部系统可据此重建状态顺序

**Given** 系统发送回调请求
**When** 外部系统校验签名
**Then** 请求头包含 HMAC-SHA256 签名
**And** 验签失败的请求可被外部系统安全拒绝
