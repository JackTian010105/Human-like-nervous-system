import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Pool } from "pg";
import type {
  AuditEvent,
  CallbackDeliveryRecord,
  CommandDraft,
  CommandRecord
} from "@command-neural/shared-types";

interface PersistedNodeDelivery {
  commandId: string;
  nodeId: string;
  sourceNodeId: string;
  nodeStatus: "PENDING_RECEIVE" | "RECEIVED" | "UNDERSTOOD" | "ANOMALY_TIMEOUT";
  arrivedAt: string;
  understandingStatus?: "UNDERSTOOD" | "NEED_CLARIFICATION";
  understandingQuestion?: string;
  understoodAt?: string;
  executionStatus?: "COMPLETED" | "NOT_COMPLETED" | "EXCEPTION";
  executionCompletedAt?: string;
  executionExceptionNote?: string;
}

interface PersistedCallbackSubscription {
  subscriptionId: string;
  externalSystemId: string;
  callbackUrl: string;
  signingSecret: string;
  registeredAt: string;
}

interface PersistedExternalIdempotencyRecord {
  idempotencyKey: string;
  commandId: string;
  createdAtMs: number;
}

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool | null = null;
  private enabled = false;
  private readonly initCompleted: Promise<void>;
  private markInitCompleted!: () => void;

  constructor() {
    this.initCompleted = new Promise<void>((resolve) => {
      this.markInitCompleted = resolve;
    });
  }

  async onModuleInit(): Promise<void> {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      this.logger.warn("DATABASE_URL is not set, running in memory-only mode");
      this.markInitCompleted();
      return;
    }

    this.pool = new Pool({ connectionString });
    try {
      await this.pool.query("select 1");
      await this.ensureSchema();
      this.enabled = true;
      this.logger.log("PostgreSQL persistence enabled");
    } catch (error) {
      this.logger.error(`Failed to initialize PostgreSQL: ${String(error)}`);
      this.enabled = false;
    } finally {
      this.markInitCompleted();
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.pool !== null;
  }

  async waitUntilInitialized(): Promise<void> {
    await this.initCompleted;
  }

  async loadDrafts(): Promise<CommandDraft[]> {
    if (!this.pool || !this.enabled) {
      return [];
    }
    const result = await this.pool.query<{
      draft_id: string;
      status: "DRAFT";
      content: string;
      target_node: string;
      execution_requirement: string;
      feedback_requirement: string;
      created_at: Date | string;
    }>("select draft_id, status, content, target_node, execution_requirement, feedback_requirement, created_at from command_drafts order by created_at asc");
    return result.rows.map((row) => ({
      draftId: row.draft_id,
      status: row.status,
      content: row.content,
      targetNode: row.target_node,
      executionRequirement: row.execution_requirement,
      feedbackRequirement: row.feedback_requirement,
      createdAt: new Date(row.created_at).toISOString()
    }));
  }

  async loadCommands(): Promise<CommandRecord[]> {
    if (!this.pool || !this.enabled) {
      return [];
    }
    const result = await this.pool.query<{
      command_id: string;
      draft_id: string;
      issuer_id: string;
      created_at: Date | string;
      status: CommandRecord["status"];
      root_node_id: string | null;
      dispatched_at: Date | string | null;
      closed_at: Date | string | null;
      previous_command_id: string | null;
    }>("select command_id, draft_id, issuer_id, created_at, status, root_node_id, dispatched_at, closed_at, previous_command_id from commands order by created_at asc");
    return result.rows.map((row) => ({
      commandId: row.command_id,
      draftId: row.draft_id,
      issuerId: row.issuer_id,
      createdAt: new Date(row.created_at).toISOString(),
      status: row.status,
      rootNodeId: row.root_node_id ?? undefined,
      dispatchedAt: row.dispatched_at ? new Date(row.dispatched_at).toISOString() : undefined,
      closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : undefined,
      previousCommandId: row.previous_command_id ?? undefined
    }));
  }

  async loadAuditEvents(): Promise<AuditEvent[]> {
    if (!this.pool || !this.enabled) {
      return [];
    }
    const result = await this.pool.query<{
      event_id: string;
      command_id: string;
      node_id: string;
      event_type: string;
      event_sequence: number;
      occurred_at: Date | string;
      payload: Record<string, unknown>;
    }>("select event_id, command_id, node_id, event_type, event_sequence, occurred_at, payload from audit_events order by occurred_at asc");
    return result.rows.map((row) => ({
      eventId: row.event_id,
      commandId: row.command_id,
      nodeId: row.node_id,
      eventType: row.event_type,
      eventSequence: row.event_sequence,
      timestamp: new Date(row.occurred_at).toISOString(),
      payload: row.payload ?? {}
    }));
  }

  async loadCallbackDeliveries(): Promise<CallbackDeliveryRecord[]> {
    if (!this.pool || !this.enabled) {
      return [];
    }
    const result = await this.pool.query<{
      delivery_id: string;
      subscription_id: string;
      external_system_id: string;
      callback_url: string;
      command_id: string;
      event_type: string;
      event_sequence: number;
      occurred_at: Date | string;
      signature_header: string;
      signature_value: string;
      payload: Record<string, unknown>;
      attempts: number;
      max_attempts: 3;
      status: "SUCCESS" | "FAILED";
      last_error: string | null;
    }>("select delivery_id, subscription_id, external_system_id, callback_url, command_id, event_type, event_sequence, occurred_at, signature_header, signature_value, payload, attempts, max_attempts, status, last_error from callback_deliveries order by occurred_at asc");
    return result.rows.map((row) => ({
      deliveryId: row.delivery_id,
      subscriptionId: row.subscription_id,
      externalSystemId: row.external_system_id,
      callbackUrl: row.callback_url,
      commandId: row.command_id,
      eventType: row.event_type,
      eventSequence: row.event_sequence,
      timestamp: new Date(row.occurred_at).toISOString(),
      signatureHeader: row.signature_header,
      signatureValue: row.signature_value,
      payload: row.payload as unknown as CallbackDeliveryRecord["payload"],
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      status: row.status,
      lastError: row.last_error ?? undefined
    }));
  }

  async loadNodeDeliveries(): Promise<PersistedNodeDelivery[]> {
    if (!this.pool || !this.enabled) {
      return [];
    }
    const result = await this.pool.query<{
      command_id: string;
      node_id: string;
      source_node_id: string;
      node_status: PersistedNodeDelivery["nodeStatus"];
      arrived_at: Date | string;
      understanding_status: PersistedNodeDelivery["understandingStatus"] | null;
      understanding_question: string | null;
      understood_at: Date | string | null;
      execution_status: PersistedNodeDelivery["executionStatus"] | null;
      execution_completed_at: Date | string | null;
      execution_exception_note: string | null;
    }>(
      `select command_id, node_id, source_node_id, node_status, arrived_at, understanding_status, understanding_question, understood_at, execution_status, execution_completed_at, execution_exception_note
       from node_deliveries
       order by arrived_at asc`
    );
    return result.rows.map((row) => ({
      commandId: row.command_id,
      nodeId: row.node_id,
      sourceNodeId: row.source_node_id,
      nodeStatus: row.node_status,
      arrivedAt: new Date(row.arrived_at).toISOString(),
      understandingStatus: row.understanding_status ?? undefined,
      understandingQuestion: row.understanding_question ?? undefined,
      understoodAt: row.understood_at ? new Date(row.understood_at).toISOString() : undefined,
      executionStatus: row.execution_status ?? undefined,
      executionCompletedAt: row.execution_completed_at
        ? new Date(row.execution_completed_at).toISOString()
        : undefined,
      executionExceptionNote: row.execution_exception_note ?? undefined
    }));
  }

  async loadTimeoutAlerts(): Promise<{
    commandId: string;
    nodeId: string;
    timeoutType: "UNDERSTANDING_TIMEOUT" | "PROPAGATION_TIMEOUT";
    detectedAt: string;
    elapsedSeconds: number;
    lastEventAt: string;
  }[]> {
    if (!this.pool || !this.enabled) {
      return [];
    }
    const result = await this.pool.query<{
      command_id: string;
      node_id: string;
      timeout_type: "UNDERSTANDING_TIMEOUT" | "PROPAGATION_TIMEOUT";
      detected_at: Date | string;
      elapsed_seconds: number;
      last_event_at: Date | string;
    }>(
      `select command_id, node_id, timeout_type, detected_at, elapsed_seconds, last_event_at
       from timeout_alerts
       order by detected_at asc`
    );
    return result.rows.map((row) => ({
      commandId: row.command_id,
      nodeId: row.node_id,
      timeoutType: row.timeout_type,
      detectedAt: new Date(row.detected_at).toISOString(),
      elapsedSeconds: row.elapsed_seconds,
      lastEventAt: new Date(row.last_event_at).toISOString()
    }));
  }

  async loadCallbackSubscriptions(): Promise<PersistedCallbackSubscription[]> {
    if (!this.pool || !this.enabled) {
      return [];
    }
    const result = await this.pool.query<{
      subscription_id: string;
      external_system_id: string;
      callback_url: string;
      signing_secret: string;
      registered_at: Date | string;
    }>(
      `select subscription_id, external_system_id, callback_url, signing_secret, registered_at
       from external_callback_subscriptions
       order by registered_at asc`
    );
    return result.rows.map((row) => ({
      subscriptionId: row.subscription_id,
      externalSystemId: row.external_system_id,
      callbackUrl: row.callback_url,
      signingSecret: row.signing_secret,
      registeredAt: new Date(row.registered_at).toISOString()
    }));
  }

  async loadExternalIdempotencyRecords(): Promise<PersistedExternalIdempotencyRecord[]> {
    if (!this.pool || !this.enabled) {
      return [];
    }
    const result = await this.pool.query<{
      idempotency_key: string;
      command_id: string;
      created_at_ms: string | number;
    }>(
      `select idempotency_key, command_id, created_at_ms
       from external_idempotency_keys`
    );
    return result.rows.map((row) => ({
      idempotencyKey: row.idempotency_key,
      commandId: row.command_id,
      createdAtMs: Number(row.created_at_ms)
    }));
  }

  async upsertDraft(draft: CommandDraft): Promise<void> {
    if (!this.pool || !this.enabled) {
      return;
    }
    await this.pool.query(
      `insert into command_drafts (draft_id, status, content, target_node, execution_requirement, feedback_requirement, created_at)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (draft_id) do update set
         status=excluded.status,
         content=excluded.content,
         target_node=excluded.target_node,
         execution_requirement=excluded.execution_requirement,
         feedback_requirement=excluded.feedback_requirement`,
      [
        draft.draftId,
        draft.status,
        draft.content,
        draft.targetNode,
        draft.executionRequirement,
        draft.feedbackRequirement,
        draft.createdAt
      ]
    );
  }

  async upsertCommand(command: CommandRecord): Promise<void> {
    if (!this.pool || !this.enabled) {
      return;
    }
    await this.pool.query(
      `insert into commands (command_id, draft_id, issuer_id, created_at, status, root_node_id, dispatched_at, closed_at, previous_command_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (command_id) do update set
         draft_id=excluded.draft_id,
         issuer_id=excluded.issuer_id,
         status=excluded.status,
         root_node_id=excluded.root_node_id,
         dispatched_at=excluded.dispatched_at,
         closed_at=excluded.closed_at,
         previous_command_id=excluded.previous_command_id`,
      [
        command.commandId,
        command.draftId,
        command.issuerId,
        command.createdAt,
        command.status,
        command.rootNodeId ?? null,
        command.dispatchedAt ?? null,
        command.closedAt ?? null,
        command.previousCommandId ?? null
      ]
    );
  }

  async appendAuditEvent(event: AuditEvent): Promise<void> {
    if (!this.pool || !this.enabled) {
      return;
    }
    await this.pool.query(
      `insert into audit_events (event_id, command_id, node_id, event_type, event_sequence, occurred_at, payload)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [
        event.eventId,
        event.commandId,
        event.nodeId,
        event.eventType,
        event.eventSequence,
        event.timestamp,
        event.payload
      ]
    );
  }

  async appendCallbackDelivery(delivery: CallbackDeliveryRecord): Promise<void> {
    if (!this.pool || !this.enabled) {
      return;
    }
    await this.pool.query(
      `insert into callback_deliveries (delivery_id, subscription_id, external_system_id, callback_url, command_id, event_type, event_sequence, occurred_at, signature_header, signature_value, payload, attempts, max_attempts, status, last_error)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        delivery.deliveryId,
        delivery.subscriptionId,
        delivery.externalSystemId,
        delivery.callbackUrl,
        delivery.commandId,
        delivery.eventType,
        delivery.eventSequence,
        delivery.timestamp,
        delivery.signatureHeader,
        delivery.signatureValue,
        delivery.payload,
        delivery.attempts,
        delivery.maxAttempts,
        delivery.status,
        delivery.lastError ?? null
      ]
    );
  }

  async upsertNodeDelivery(delivery: PersistedNodeDelivery): Promise<void> {
    if (!this.pool || !this.enabled) {
      return;
    }
    await this.pool.query(
      `insert into node_deliveries
       (command_id, node_id, source_node_id, node_status, arrived_at, understanding_status, understanding_question, understood_at, execution_status, execution_completed_at, execution_exception_note)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (command_id, node_id) do update set
         source_node_id=excluded.source_node_id,
         node_status=excluded.node_status,
         arrived_at=excluded.arrived_at,
         understanding_status=excluded.understanding_status,
         understanding_question=excluded.understanding_question,
         understood_at=excluded.understood_at,
         execution_status=excluded.execution_status,
         execution_completed_at=excluded.execution_completed_at,
         execution_exception_note=excluded.execution_exception_note`,
      [
        delivery.commandId,
        delivery.nodeId,
        delivery.sourceNodeId,
        delivery.nodeStatus,
        delivery.arrivedAt,
        delivery.understandingStatus ?? null,
        delivery.understandingQuestion ?? null,
        delivery.understoodAt ?? null,
        delivery.executionStatus ?? null,
        delivery.executionCompletedAt ?? null,
        delivery.executionExceptionNote ?? null
      ]
    );
  }

  async appendTimeoutAlert(alert: {
    commandId: string;
    nodeId: string;
    timeoutType: "UNDERSTANDING_TIMEOUT" | "PROPAGATION_TIMEOUT";
    detectedAt: string;
    elapsedSeconds: number;
    lastEventAt: string;
  }): Promise<void> {
    if (!this.pool || !this.enabled) {
      return;
    }
    await this.pool.query(
      `insert into timeout_alerts (command_id, node_id, timeout_type, detected_at, elapsed_seconds, last_event_at)
       values ($1,$2,$3,$4,$5,$6)`,
      [
        alert.commandId,
        alert.nodeId,
        alert.timeoutType,
        alert.detectedAt,
        alert.elapsedSeconds,
        alert.lastEventAt
      ]
    );
  }

  async upsertCallbackSubscription(subscription: PersistedCallbackSubscription): Promise<void> {
    if (!this.pool || !this.enabled) {
      return;
    }
    await this.pool.query(
      `insert into external_callback_subscriptions
       (subscription_id, external_system_id, callback_url, signing_secret, registered_at)
       values ($1,$2,$3,$4,$5)
       on conflict (subscription_id) do update set
         external_system_id=excluded.external_system_id,
         callback_url=excluded.callback_url,
         signing_secret=excluded.signing_secret,
         registered_at=excluded.registered_at`,
      [
        subscription.subscriptionId,
        subscription.externalSystemId,
        subscription.callbackUrl,
        subscription.signingSecret,
        subscription.registeredAt
      ]
    );
  }

  async upsertExternalIdempotencyRecord(record: PersistedExternalIdempotencyRecord): Promise<void> {
    if (!this.pool || !this.enabled) {
      return;
    }
    await this.pool.query(
      `insert into external_idempotency_keys (idempotency_key, command_id, created_at_ms)
       values ($1,$2,$3)
       on conflict (idempotency_key) do update set
         command_id=excluded.command_id,
         created_at_ms=excluded.created_at_ms`,
      [record.idempotencyKey, record.commandId, record.createdAtMs]
    );
  }

  private async ensureSchema(): Promise<void> {
    if (!this.pool) {
      return;
    }
    await this.pool.query(`
      create table if not exists command_drafts (
        draft_id text primary key,
        status text not null,
        content text not null,
        target_node text not null,
        execution_requirement text not null,
        feedback_requirement text not null,
        created_at timestamptz not null
      );
    `);
    await this.pool.query(`
      create table if not exists commands (
        command_id text primary key,
        draft_id text not null,
        issuer_id text not null,
        created_at timestamptz not null,
        status text not null,
        root_node_id text null,
        dispatched_at timestamptz null,
        closed_at timestamptz null,
        previous_command_id text null
      );
    `);
    await this.pool.query(`
      create table if not exists audit_events (
        event_id text primary key,
        command_id text not null,
        node_id text not null,
        event_type text not null,
        event_sequence integer not null,
        occurred_at timestamptz not null,
        payload jsonb not null
      );
    `);
    await this.pool.query(`
      create index if not exists idx_audit_events_command_sequence
      on audit_events(command_id, event_sequence);
    `);
    await this.pool.query(`
      create table if not exists callback_deliveries (
        delivery_id text primary key,
        subscription_id text not null,
        external_system_id text not null,
        callback_url text not null,
        command_id text not null,
        event_type text not null,
        event_sequence integer not null,
        occurred_at timestamptz not null,
        signature_header text not null,
        signature_value text not null,
        payload jsonb not null,
        attempts integer not null,
        max_attempts integer not null,
        status text not null,
        last_error text null
      );
    `);
    await this.pool.query(`
      create table if not exists node_deliveries (
        command_id text not null,
        node_id text not null,
        source_node_id text not null,
        node_status text not null,
        arrived_at timestamptz not null,
        understanding_status text null,
        understanding_question text null,
        understood_at timestamptz null,
        execution_status text null,
        execution_completed_at timestamptz null,
        execution_exception_note text null,
        primary key (command_id, node_id)
      );
    `);
    await this.pool.query(`
      create table if not exists timeout_alerts (
        alert_id bigserial primary key,
        command_id text not null,
        node_id text not null,
        timeout_type text not null,
        detected_at timestamptz not null,
        elapsed_seconds integer not null,
        last_event_at timestamptz not null
      );
    `);
    await this.pool.query(`
      create table if not exists external_callback_subscriptions (
        subscription_id text primary key,
        external_system_id text not null,
        callback_url text not null,
        signing_secret text not null,
        registered_at timestamptz not null
      );
    `);
    await this.pool.query(`
      create table if not exists external_idempotency_keys (
        idempotency_key text primary key,
        command_id text not null,
        created_at_ms bigint not null
      );
    `);
  }
}
