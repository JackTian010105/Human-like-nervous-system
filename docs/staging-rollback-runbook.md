# Staging Rollback Runbook

Project: `Command Neural System`  
Scope: `staging`  
Owner: `Release Owner + Backend Owner`

## 1) Trigger Conditions

- 新版本发布后出现以下任一情况立即回滚：
- `/health` 连续 5 分钟异常
- `pnpm e2e:external-integration` 在 staging 失败
- 关键接口 (`/api/external/commands`, `/commands/operations/health`) 错误率持续升高
- 回调重试异常（`attempts=3` 后仍大量失败）超出阈值

## 2) Inputs (必须提前准备)

- 上一个稳定版本 `commit/tag`
- 可部署制品地址（镜像/tag 或构建产物）
- 当前环境配置快照（至少 `DATABASE_URL`, `EXTERNAL_API_TOKEN`）
- 回滚负责人与审批人

## 3) App Rollback

1. 暂停新发布流量（若有网关/路由切换，先切回旧版本）。
2. 部署上一个稳定版本制品。
3. 重启应用进程。
4. 执行验证：
- `GET /health` 返回 `{"status":"ok"}`
- `GET /commands/operations/health` 可访问
- 外部未授权请求返回 `401`

## 4) Config Rollback

1. 将配置恢复到发布前快照：
- `DATABASE_URL`
- `EXTERNAL_API_TOKEN`
- 其他新增配置项（如有）
2. 重启服务并再次执行健康检查。

## 5) Data Rollback Boundary

- 本系统当前为 append-only 审计与事件记录。
- 默认策略：**不执行 destructive 数据回滚**（不删历史日志）。
- 若必须做数据回滚，需单独审批并先导出备份。

## 6) Verification Checklist (Rollback 后)

- `/health` 正常
- `/commands` 能返回历史数据
- `/commands/alerts/timeouts` 可查询
- 外部幂等回放仍返回同一 `CommandID`
- 回调签名校验仍通过

## 7) Communication Template

- 事件：`staging rollback started`
- 原因：`<brief reason>`
- 目标版本：`<stable commit/tag>`
- 负责人：`<owner>`
- 状态更新频率：每 15 分钟
- 结束信号：`rollback completed + verification passed`

## 8) Post-Rollback

1. 记录事故时间线与影响范围。
2. 输出根因分析（RCA）。
3. 形成修复计划并重新走 staging checklist。

