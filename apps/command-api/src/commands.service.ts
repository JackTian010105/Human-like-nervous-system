import { Injectable, OnModuleInit } from "@nestjs/common";
import { createHmac, randomUUID } from "node:crypto";
import { Subject } from "rxjs";
import type {
  AlertSeverity,
  AuditQuery,
  AuditEvent,
  BindRootNodeResponse,
  CommandDraft,
  CommandChainNodeView,
  CommandRecord,
  CreateNextRoundCommandRequest,
  CreateNextRoundCommandResponse,
  ExternalEventOrder,
  ExternalCreateCommandRequest,
  CreateCommandDraftRequest,
  EvaluateClosureResponse,
  ExceptionNodeDetail,
  FeedbackAggregationSummary,
  GetOperationsHealthResponse,
  NodeCommandCard,
  NodeConnectionStatus,
  NodeProfile,
  NodeRoleType,
  UpdateNodeConfigRequest,
  UpdateNodeConfigResponse,
  GetNodeDiagnosticsResponse,
  TriggerNodeRecoveryRequest,
  TriggerNodeRecoveryResponse,
  OperationsAlertItem,
  PropagateCommandResponse,
  RootNodeCandidate,
  GetCommandChainResponse,
  RealtimeCommandEvent,
  RegisterExternalCallbackRequest,
  RegisterExternalCallbackResponse,
  ListCallbackDeliveriesResponse,
  CallbackDeliveryRecord,
  TimeoutAlert
} from "@command-neural/shared-types";
import { DatabaseService } from "./database.service";

interface NodeDelivery {
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

interface ExternalCallbackSubscription {
  subscriptionId: string;
  externalSystemId: string;
  callbackUrl: string;
  signingSecret: string;
  registeredAt: string;
}

const UNDERSTANDING_TIMEOUT_SECONDS = 5;
const PROPAGATION_TIMEOUT_SECONDS = 5;
const EXTERNAL_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CommandsService implements OnModuleInit {
  private readonly drafts: CommandDraft[] = [];
  private readonly commands: CommandRecord[] = [];
  private readonly issuedByDraft = new Map<string, CommandRecord>();
  private readonly idempotencyMap = new Map<string, CommandRecord>();
  private readonly nodeDeliveries: NodeDelivery[] = [];
  private readonly rootNodes: RootNodeCandidate[] = [
    { nodeId: "captain-A", nodeName: "队长A", available: true },
    { nodeId: "captain-B", nodeName: "队长B", available: true },
    { nodeId: "captain-C", nodeName: "队长C", available: false }
  ];
  private readonly downstreamByNode = new Map<string, string[]>([
    ["captain-A", ["member-A1", "member-A2", "member-A3"]],
    ["captain-B", ["member-B1", "member-B2", "member-B3"]],
    ["captain-C", ["member-C1", "member-C2", "member-C3"]]
  ]);
  private readonly timeoutAlerts: TimeoutAlert[] = [];
  private readonly realtime$ = new Subject<RealtimeCommandEvent>();
  private readonly eventSequenceByCommand = new Map<string, number>();
  private readonly auditEvents: AuditEvent[] = [];
  private readonly recentRealtimeEvents: RealtimeCommandEvent[] = [];
  private readonly externalIdempotencyMap = new Map<
    string,
    { command: CommandRecord; createdAtMs: number }
  >();
  private readonly callbackSubscriptions: ExternalCallbackSubscription[] = [];
  private readonly callbackDeliveries: CallbackDeliveryRecord[] = [];
  private readonly nodeProfiles = new Map<string, NodeProfile>();

  constructor(private readonly databaseService: DatabaseService) {
    this.bootstrapNodeProfiles();
  }

  async onModuleInit(): Promise<void> {
    await this.databaseService.waitUntilInitialized();
    if (!this.databaseService.isEnabled()) {
      return;
    }

    const [
      drafts,
      commands,
      auditEvents,
      callbackDeliveries,
      nodeDeliveries,
      timeoutAlerts,
      callbackSubscriptions,
      externalIdempotencyRecords
    ] = await Promise.all([
      this.databaseService.loadDrafts(),
      this.databaseService.loadCommands(),
      this.databaseService.loadAuditEvents(),
      this.databaseService.loadCallbackDeliveries(),
      this.databaseService.loadNodeDeliveries(),
      this.databaseService.loadTimeoutAlerts(),
      this.databaseService.loadCallbackSubscriptions(),
      this.databaseService.loadExternalIdempotencyRecords()
    ]);

    this.drafts.splice(0, this.drafts.length, ...drafts);
    this.commands.splice(0, this.commands.length, ...commands);
    this.auditEvents.splice(0, this.auditEvents.length, ...auditEvents);
    this.callbackDeliveries.splice(0, this.callbackDeliveries.length, ...callbackDeliveries);
    this.nodeDeliveries.splice(0, this.nodeDeliveries.length, ...nodeDeliveries);
    this.timeoutAlerts.splice(0, this.timeoutAlerts.length, ...timeoutAlerts);
    this.callbackSubscriptions.splice(0, this.callbackSubscriptions.length, ...callbackSubscriptions);

    this.issuedByDraft.clear();
    this.idempotencyMap.clear();
    this.eventSequenceByCommand.clear();
    this.recentRealtimeEvents.splice(0, this.recentRealtimeEvents.length);
    this.externalIdempotencyMap.clear();

    this.commands.forEach((command) => {
      this.issuedByDraft.set(command.draftId, command);
    });
    this.auditEvents.forEach((event) => {
      const current = this.eventSequenceByCommand.get(event.commandId) ?? 0;
      if (event.eventSequence > current) {
        this.eventSequenceByCommand.set(event.commandId, event.eventSequence);
      }
    });
    externalIdempotencyRecords.forEach((record) => {
      const command = this.commands.find((item) => item.commandId === record.commandId);
      if (!command) {
        return;
      }
      this.externalIdempotencyMap.set(record.idempotencyKey, {
        command,
        createdAtMs: record.createdAtMs
      });
    });
  }

  private bootstrapNodeProfiles(): void {
    const now = new Date().toISOString();
    this.rootNodes.forEach((node) => {
      this.nodeProfiles.set(node.nodeId, {
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        roleType: "CAPTAIN",
        chainPosition: "ROOT",
        active: node.available,
        connectionStatus: node.available ? "ONLINE" : "OFFLINE",
        lastSeenAt: now,
        updatedAt: now
      });
    });
    for (const [captainNodeId, memberNodeIds] of this.downstreamByNode.entries()) {
      memberNodeIds.forEach((memberNodeId, index) => {
        this.nodeProfiles.set(memberNodeId, {
          nodeId: memberNodeId,
          nodeName: memberNodeId,
          roleType: "MEMBER",
          parentNodeId: captainNodeId,
          chainPosition: `LEVEL_2_${index + 1}`,
          active: true,
          connectionStatus: "ONLINE",
          lastSeenAt: now,
          updatedAt: now
        });
      });
    }
  }

  createDraft(input: CreateCommandDraftRequest): CommandDraft {
    const draft: CommandDraft = {
      draftId: randomUUID(),
      status: "DRAFT",
      content: input.content,
      targetNode: input.targetNode,
      executionRequirement: input.executionRequirement,
      feedbackRequirement: input.feedbackRequirement,
      createdAt: new Date().toISOString()
    };

    this.drafts.push(draft);
    void this.databaseService.upsertDraft(draft).catch(() => undefined);
    return draft;
  }

  createExternalCommand(input: ExternalCreateCommandRequest): CommandRecord {
    const draft = this.createDraft({
      content: input.content,
      targetNode: input.targetNode,
      executionRequirement: input.executionRequirement,
      feedbackRequirement: input.feedbackRequirement
    });
    return this.issueCommand({
      draftId: draft.draftId,
      issuerId: input.issuerId?.trim() || `external:${input.externalSystemId}`
    });
  }

  createExternalCommandWithIdempotency(params: {
    input: ExternalCreateCommandRequest;
    idempotencyKey: string;
  }): { command: CommandRecord; replayed: boolean } {
    const nowMs = Date.now();
    const existing = this.externalIdempotencyMap.get(params.idempotencyKey);
    if (existing && nowMs - existing.createdAtMs <= EXTERNAL_IDEMPOTENCY_TTL_MS) {
      return { command: existing.command, replayed: true };
    }

    const command = this.createExternalCommand(params.input);
    this.externalIdempotencyMap.set(params.idempotencyKey, {
      command,
      createdAtMs: nowMs
    });
    void this.databaseService
      .upsertExternalIdempotencyRecord({
        idempotencyKey: params.idempotencyKey,
        commandId: command.commandId,
        createdAtMs: nowMs
      })
      .catch(() => undefined);
    return { command, replayed: false };
  }

  recordExternalAuthRejected(payload: {
    path: string;
    externalSystemId?: string;
    reason: string;
  }): void {
    this.emitRealtime("SYSTEM", "ExternalAuthRejected", payload);
  }

  recordNodeAccessDenied(payload: {
    nodeId: string;
    requesterNodeId?: string;
    commandId?: string;
    reason: "node_not_found" | "node_mismatch";
  }): void {
    const authorityCommandId = payload.commandId?.trim() || "SYSTEM";
    this.emitRealtime(authorityCommandId, "NodeAccessDenied", {
      nodeId: payload.nodeId,
      requesterNodeId: payload.requesterNodeId,
      commandId: payload.commandId,
      reason: payload.reason
    });
  }

  findDraft(draftId: string): CommandDraft | undefined {
    return this.drafts.find((item) => item.draftId === draftId);
  }

  issueCommand(params: {
    draftId: string;
    issuerId: string;
    idempotencyKey?: string;
  }): CommandRecord {
    const { draftId, issuerId, idempotencyKey } = params;

    if (idempotencyKey) {
      const existingByKey = this.idempotencyMap.get(idempotencyKey);
      if (existingByKey) {
        return existingByKey;
      }
    }

    const existingByDraft = this.issuedByDraft.get(draftId);
    if (existingByDraft) {
      if (idempotencyKey) {
        this.idempotencyMap.set(idempotencyKey, existingByDraft);
      }
      return existingByDraft;
    }

    const created: CommandRecord = {
      commandId: `CMD-${randomUUID()}`,
      draftId,
      issuerId,
      createdAt: new Date().toISOString(),
      status: "CREATED"
    };

    this.commands.push(created);
    this.issuedByDraft.set(draftId, created);
    if (idempotencyKey) {
      this.idempotencyMap.set(idempotencyKey, created);
    }
    this.emitRealtime(created.commandId, "CommandIssued", {
      issuerId: created.issuerId,
      status: created.status
    });
    void this.databaseService.upsertCommand(created).catch(() => undefined);
    return created;
  }

  listRootNodeCandidates(): RootNodeCandidate[] {
    return this.rootNodes;
  }

  findCommand(commandId: string): CommandRecord | undefined {
    return this.commands.find((item) => item.commandId === commandId);
  }

  findRootNode(rootNodeId: string): RootNodeCandidate | undefined {
    return this.rootNodes.find((item) => item.nodeId === rootNodeId);
  }

  bindRootNode(params: {
    commandId: string;
    rootNodeId: string;
  }): BindRootNodeResponse {
    const command = this.findCommand(params.commandId);
    if (!command) {
      throw new Error("command not found");
    }

    const now = new Date().toISOString();
    command.rootNodeId = params.rootNodeId;
    command.status = "DISPATCHED_PENDING_RECEIVE";
    command.dispatchedAt = now;
    this.upsertNodeDelivery({
      commandId: command.commandId,
      nodeId: params.rootNodeId,
      sourceNodeId: "CENTRAL",
      nodeStatus: "PENDING_RECEIVE",
      arrivedAt: now
    });
    this.emitRealtime(command.commandId, "RootNodeBound", {
      rootNodeId: params.rootNodeId,
      status: command.status
    });
    void this.databaseService.upsertCommand(command).catch(() => undefined);

    return {
      command,
      chainStart: {
        commandId: command.commandId,
        fromNodeId: "CENTRAL",
        toNodeId: params.rootNodeId,
        createdAt: now
      },
      auditEvent: {
        eventId: `EVT-${randomUUID()}`,
        commandId: command.commandId,
        nodeId: params.rootNodeId,
        eventType: "ROOT_NODE_BOUND",
        timestamp: now
      }
    };
  }

  listCommands(): CommandRecord[] {
    return [...this.commands].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listNodeCommands(nodeId: string): NodeCommandCard[] {
    return this.nodeDeliveries
      .filter((item) => item.nodeId === nodeId)
      .map((delivery) => this.toNodeCommandCard(delivery))
      .filter((item): item is NodeCommandCard => Boolean(item))
      .sort((a, b) => b.arrivedAt.localeCompare(a.arrivedAt));
  }

  getNodeCommand(nodeId: string, commandId: string): NodeCommandCard | undefined {
    const delivery = this.nodeDeliveries.find(
      (item) => item.nodeId === nodeId && item.commandId === commandId
    );
    if (!delivery) {
      return undefined;
    }
    return this.toNodeCommandCard(delivery);
  }

  submitUnderstandingReceipt(params: {
    nodeId: string;
    commandId: string;
    understandingStatus: "UNDERSTOOD" | "NEED_CLARIFICATION";
    question?: string;
  }): NodeCommandCard | undefined {
    const delivery = this.nodeDeliveries.find(
      (item) => item.nodeId === params.nodeId && item.commandId === params.commandId
    );
    if (!delivery) {
      return undefined;
    }

    const normalizedQuestion = params.question?.trim() || undefined;
    const isSameReceipt =
      delivery.nodeStatus === "UNDERSTOOD" &&
      delivery.understandingStatus === params.understandingStatus &&
      (delivery.understandingQuestion ?? undefined) === normalizedQuestion;
    if (isSameReceipt) {
      return this.toNodeCommandCard(delivery);
    }

    delivery.nodeStatus = "UNDERSTOOD";
    delivery.understandingStatus = params.understandingStatus;
    delivery.understandingQuestion = normalizedQuestion;
    delivery.understoodAt = new Date().toISOString();
    this.upsertNodeDelivery(delivery);
    this.emitRealtime(params.commandId, "UnderstandingSubmitted", {
      nodeId: params.nodeId,
      understandingStatus: params.understandingStatus
    });
    return this.toNodeCommandCard(delivery);
  }

  submitExecutionFeedback(params: {
    nodeId: string;
    commandId: string;
    executionStatus: "COMPLETED" | "NOT_COMPLETED" | "EXCEPTION";
    exceptionNote?: string;
  }): NodeCommandCard | undefined {
    const delivery = this.nodeDeliveries.find(
      (item) => item.nodeId === params.nodeId && item.commandId === params.commandId
    );
    if (!delivery) {
      return undefined;
    }

    delivery.executionStatus = params.executionStatus;
    delivery.executionCompletedAt = new Date().toISOString();
    delivery.executionExceptionNote = params.exceptionNote;
    this.upsertNodeDelivery(delivery);
    this.emitRealtime(params.commandId, "ExecutionFeedbackSubmitted", {
      nodeId: params.nodeId,
      executionStatus: params.executionStatus
    });
    return this.toNodeCommandCard(delivery);
  }

  aggregateDownstreamFeedback(params: {
    fromNodeId: string;
    commandId: string;
  }): FeedbackAggregationSummary {
    const downstreamIds = this.listDownstreamCandidates(params.fromNodeId);
    const related = this.nodeDeliveries.filter(
      (item) =>
        item.commandId === params.commandId &&
        item.sourceNodeId === params.fromNodeId &&
        downstreamIds.includes(item.nodeId)
    );

    let completedCount = 0;
    let notCompletedCount = 0;
    let exceptionCount = 0;
    const pendingNodeIds: string[] = [];

    downstreamIds.forEach((nodeId) => {
      const record = related.find((item) => item.nodeId === nodeId);
      if (!record || !record.executionStatus) {
        pendingNodeIds.push(nodeId);
        return;
      }
      if (record.executionStatus === "COMPLETED") {
        completedCount += 1;
        return;
      }
      if (record.executionStatus === "NOT_COMPLETED") {
        notCompletedCount += 1;
        return;
      }
      exceptionCount += 1;
    });

    return {
      commandId: params.commandId,
      fromNodeId: params.fromNodeId,
      completedCount,
      notCompletedCount,
      exceptionCount,
      pendingCount: pendingNodeIds.length,
      pendingNodeIds,
      aggregatedAt: new Date().toISOString()
    };
  }

  evaluateClosure(commandId: string): EvaluateClosureResponse {
    const command = this.findCommand(commandId);
    const evaluatedAt = new Date().toISOString();
    if (!command) {
      return {
        commandId,
        status: "FEEDBACK_RETURNING",
        isClosed: false,
        unmetConditions: ["command_not_found"],
        evaluatedAt
      };
    }

    const unmetConditions: string[] = [];
    if (!command.rootNodeId) {
      unmetConditions.push("root_node_not_bound");
    }

    if (command.rootNodeId) {
      const summary = this.aggregateDownstreamFeedback({
        fromNodeId: command.rootNodeId,
        commandId
      });
      if (summary.pendingCount > 0) {
        unmetConditions.push(`pending_nodes:${summary.pendingNodeIds.join(",")}`);
      }
    }

    if (unmetConditions.length === 0) {
      command.status = "CLOSED";
      command.closedAt = evaluatedAt;
      this.emitRealtime(command.commandId, "CommandClosed", {
        status: command.status
      });
      void this.databaseService.upsertCommand(command).catch(() => undefined);
      return {
        commandId,
        status: command.status,
        isClosed: true,
        unmetConditions: [],
        evaluatedAt
      };
    }

    command.status = "FEEDBACK_RETURNING";
    this.emitRealtime(command.commandId, "ClosureEvaluatedPending", {
      unmetConditions
    });
    void this.databaseService.upsertCommand(command).catch(() => undefined);
    return {
      commandId,
      status: command.status,
      isClosed: false,
      unmetConditions,
      evaluatedAt
    };
  }

  createNextRoundCommand(params: {
    previousCommandId: string;
    request: CreateNextRoundCommandRequest;
  }): CreateNextRoundCommandResponse | undefined {
    const previous = this.findCommand(params.previousCommandId);
    if (!previous) {
      return undefined;
    }
    const previousDraft = this.findDraft(previous.draftId);
    if (!previousDraft) {
      return undefined;
    }

    const nextDraft: CommandDraft = {
      draftId: randomUUID(),
      status: "DRAFT",
      content: params.request.content?.trim() || previousDraft.content,
      targetNode: params.request.targetNode?.trim() || previousDraft.targetNode,
      executionRequirement:
        params.request.executionRequirement?.trim() || previousDraft.executionRequirement,
      feedbackRequirement:
        params.request.feedbackRequirement?.trim() || previousDraft.feedbackRequirement,
      createdAt: new Date().toISOString()
    };
    this.drafts.push(nextDraft);

    const nextCommand: CommandRecord = {
      commandId: `CMD-${randomUUID()}`,
      draftId: nextDraft.draftId,
      issuerId: params.request.issuerId?.trim() || previous.issuerId,
      createdAt: new Date().toISOString(),
      status: "CREATED",
      previousCommandId: previous.commandId
    };
    this.commands.push(nextCommand);
    this.issuedByDraft.set(nextDraft.draftId, nextCommand);
    this.emitRealtime(nextCommand.commandId, "NextRoundCreated", {
      previousCommandId: previous.commandId
    });
    void this.databaseService.upsertDraft(nextDraft).catch(() => undefined);
    void this.databaseService.upsertCommand(nextCommand).catch(() => undefined);

    return {
      command: nextCommand,
      inheritedFields: ["content", "targetNode", "executionRequirement", "feedbackRequirement"],
      overridableFields: ["content", "targetNode", "executionRequirement", "feedbackRequirement"]
    };
  }

  getCommandChain(commandId: string): GetCommandChainResponse {
    const nodes: CommandChainNodeView[] = this.nodeDeliveries
      .filter((item) => item.commandId === commandId)
      .map((item) => ({
        nodeId: item.nodeId,
        sourceNodeId: item.sourceNodeId,
        nodeStatus: item.nodeStatus,
        arrivedAt: item.arrivedAt
      }))
      .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));

    const completedNodes = this.nodeDeliveries.filter(
      (item) => item.commandId === commandId && item.executionStatus === "COMPLETED"
    ).length;

    return {
      commandId,
      nodes,
      progress: {
        totalNodes: nodes.length,
        completedNodes
      }
    };
  }

  listDownstreamCandidates(nodeId: string): string[] {
    return this.downstreamByNode.get(nodeId) ?? [];
  }

  isKnownNode(nodeId: string): boolean {
    if (this.rootNodes.some((item) => item.nodeId === nodeId)) {
      return true;
    }
    for (const members of this.downstreamByNode.values()) {
      if (members.includes(nodeId)) {
        return true;
      }
    }
    return false;
  }

  getNodeProfile(nodeId: string): NodeProfile | undefined {
    return this.nodeProfiles.get(nodeId);
  }

  updateNodeConfig(nodeId: string, input: UpdateNodeConfigRequest): UpdateNodeConfigResponse | undefined {
    const profile = this.nodeProfiles.get(nodeId);
    if (!profile) {
      return undefined;
    }
    const now = new Date().toISOString();
    const updatedRoleType = input.roleType ?? profile.roleType;
    const updated: NodeProfile = {
      ...profile,
      nodeName: input.nodeName?.trim() || profile.nodeName,
      roleType: updatedRoleType,
      parentNodeId: input.parentNodeId?.trim() || profile.parentNodeId,
      chainPosition: input.chainPosition?.trim() || profile.chainPosition,
      active: input.active ?? profile.active,
      connectionStatus: this.toConnectionStatus(updatedRoleType, input.active ?? profile.active),
      updatedAt: now
    };

    this.nodeProfiles.set(nodeId, updated);
    this.syncRootNodeAvailability(updated);
    this.emitRealtime("SYSTEM", "NodeConfigUpdated", {
      nodeId,
      roleType: updated.roleType,
      active: updated.active
    });

    const auditEvent = [...this.auditEvents]
      .reverse()
      .find((event) => event.commandId === "SYSTEM" && event.eventType === "NodeConfigUpdated");
    if (!auditEvent) {
      return undefined;
    }
    return { node: updated, auditEvent };
  }

  getNodeDiagnostics(nodeId: string): GetNodeDiagnosticsResponse | undefined {
    const profile = this.nodeProfiles.get(nodeId);
    if (!profile) {
      return undefined;
    }
    const recentEvents = this.auditEvents
      .filter((event) => event.nodeId === nodeId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 10);

    const activeAlerts = this.timeoutAlerts
      .filter((item) => item.nodeId === nodeId)
      .map((item) => this.toOperationsAlert(item))
      .sort((a, b) => {
        const bySeverity = this.severityRank(b.severity) - this.severityRank(a.severity);
        if (bySeverity !== 0) {
          return bySeverity;
        }
        return b.detectedAt.localeCompare(a.detectedAt);
      });

    const recentErrors = activeAlerts.map(
      (item) => `${item.timeoutType} (${item.severity}) at ${item.detectedAt}`
    );

    return {
      diagnostics: {
        node: profile,
        recentEvents,
        recentErrors,
        activeAlerts
      }
    };
  }

  triggerNodeRecovery(
    nodeId: string,
    request: TriggerNodeRecoveryRequest
  ): TriggerNodeRecoveryResponse | undefined {
    const profile = this.nodeProfiles.get(nodeId);
    if (!profile) {
      return undefined;
    }
    const triggeredAt = new Date().toISOString();
    const updated: NodeProfile = {
      ...profile,
      connectionStatus: "RECOVERING",
      updatedAt: triggeredAt
    };
    this.nodeProfiles.set(nodeId, updated);
    this.emitRealtime("SYSTEM", "RecoveryTriggered", {
      nodeId,
      reason: request.reason?.trim() || "manual_recovery"
    });
    return {
      nodeId,
      recoveryStatus: "RECOVERING",
      triggeredAt,
      eventType: "RecoveryTriggered"
    };
  }

  propagateCommand(params: {
    fromNodeId: string;
    commandId: string;
    targetNodeIds: string[];
  }): PropagateCommandResponse {
    const allowedTargets = new Set(this.listDownstreamCandidates(params.fromNodeId));
    const propagated: PropagateCommandResponse["propagated"] = [];
    const invalidTargets: string[] = [];

    params.targetNodeIds.forEach((targetNodeId) => {
      if (!allowedTargets.has(targetNodeId)) {
        invalidTargets.push(targetNodeId);
        return;
      }
      const now = new Date().toISOString();
      this.upsertNodeDelivery({
        commandId: params.commandId,
        nodeId: targetNodeId,
        sourceNodeId: params.fromNodeId,
        nodeStatus: "PENDING_RECEIVE",
        arrivedAt: now
      });
      this.emitRealtime(params.commandId, "CommandPropagated", {
        fromNodeId: params.fromNodeId,
        toNodeId: targetNodeId
      });
      propagated.push({
        commandId: params.commandId,
        fromNodeId: params.fromNodeId,
        toNodeId: targetNodeId,
        propagatedAt: now
      });
    });

    return { propagated, invalidTargets };
  }

  triggerTimeoutScan(now = new Date()): TimeoutAlert[] {
    const generated: TimeoutAlert[] = [];

    this.nodeDeliveries.forEach((delivery) => {
      if (delivery.nodeStatus !== "PENDING_RECEIVE" && delivery.nodeStatus !== "UNDERSTOOD") {
        return;
      }

      const arrivedAt = new Date(delivery.arrivedAt).getTime();
      const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - arrivedAt) / 1000));

      const timeoutType =
        delivery.nodeStatus === "PENDING_RECEIVE"
          ? "UNDERSTANDING_TIMEOUT"
          : "PROPAGATION_TIMEOUT";
      const threshold =
        timeoutType === "UNDERSTANDING_TIMEOUT"
          ? UNDERSTANDING_TIMEOUT_SECONDS
          : PROPAGATION_TIMEOUT_SECONDS;

      if (elapsedSeconds < threshold) {
        return;
      }

      const exists = this.timeoutAlerts.find(
        (item) =>
          item.commandId === delivery.commandId &&
          item.nodeId === delivery.nodeId &&
          item.timeoutType === timeoutType
      );
      if (exists) {
        return;
      }

      delivery.nodeStatus = "ANOMALY_TIMEOUT";
      const alert: TimeoutAlert = {
        commandId: delivery.commandId,
        nodeId: delivery.nodeId,
        timeoutType,
        detectedAt: now.toISOString(),
        elapsedSeconds,
        lastEventAt: delivery.arrivedAt
      };
      this.timeoutAlerts.push(alert);
      generated.push(alert);
      this.emitRealtime(delivery.commandId, "TimeoutDetected", {
        nodeId: delivery.nodeId,
        timeoutType
      });
      void this.databaseService.appendTimeoutAlert(alert).catch(() => undefined);
    });

    return generated;
  }

  listTimeoutAlerts(): TimeoutAlert[] {
    return [...this.timeoutAlerts].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  }

  getExceptionNodeDetail(commandId: string, nodeId: string): ExceptionNodeDetail | undefined {
    const node = this.nodeDeliveries.find(
      (item) => item.commandId === commandId && item.nodeId === nodeId
    );
    if (!node) {
      return undefined;
    }

    const timeout = this.timeoutAlerts
      .filter((item) => item.commandId === commandId && item.nodeId === nodeId)
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))[0];

    const lastEventAt = node.executionCompletedAt || node.understoodAt || node.arrivedAt;

    return {
      commandId,
      nodeId,
      currentStatus: node.nodeStatus,
      lastEventAt,
      recentError: timeout ? timeout.timeoutType : "N/A"
    };
  }

  getRealtimeStream() {
    return this.realtime$.asObservable();
  }

  listExternalEvents(commandId?: string, order: ExternalEventOrder = "desc"): RealtimeCommandEvent[] {
    const source = commandId
      ? this.recentRealtimeEvents.filter((item) => item.commandId === commandId)
      : this.recentRealtimeEvents;
    if (commandId && order === "asc") {
      return [...source].sort((a, b) => a.eventSequence - b.eventSequence).slice(0, 200);
    }
    return [...source].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 200);
  }

  registerExternalCallback(
    request: RegisterExternalCallbackRequest
  ): RegisterExternalCallbackResponse {
    const registeredAt = new Date().toISOString();
    const subscription: ExternalCallbackSubscription = {
      subscriptionId: `SUB-${randomUUID()}`,
      externalSystemId: request.externalSystemId,
      callbackUrl: request.callbackUrl,
      signingSecret: request.signingSecret,
      registeredAt
    };
    this.callbackSubscriptions.push(subscription);
    void this.databaseService.upsertCallbackSubscription(subscription).catch(() => undefined);
    this.emitRealtime("SYSTEM", "ExternalCallbackRegistered", {
      externalSystemId: request.externalSystemId,
      callbackUrl: request.callbackUrl
    });
    return {
      subscriptionId: subscription.subscriptionId,
      externalSystemId: subscription.externalSystemId,
      callbackUrl: subscription.callbackUrl,
      registeredAt: subscription.registeredAt
    };
  }

  listCallbackDeliveries(commandId?: string): ListCallbackDeliveriesResponse {
    const deliveries = commandId
      ? this.callbackDeliveries.filter((item) => item.commandId === commandId)
      : this.callbackDeliveries;
    return {
      deliveries: [...deliveries]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 200)
    };
  }

  listAuditEvents(commandId?: string): AuditEvent[] {
    if (!commandId) {
      return [...this.auditEvents];
    }
    return this.auditEvents.filter((event) => event.commandId === commandId);
  }

  queryAuditEvents(query: AuditQuery): AuditEvent[] {
    return this.auditEvents
      .filter((event) => {
        if (query.commandId && event.commandId !== query.commandId) {
          return false;
        }
        if (query.nodeId && event.nodeId !== query.nodeId) {
          return false;
        }
        if (query.eventType && event.eventType !== query.eventType) {
          return false;
        }
        if (query.from && event.timestamp < query.from) {
          return false;
        }
        if (query.to && event.timestamp > query.to) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.commandId === b.commandId) {
          return a.eventSequence - b.eventSequence;
        }
        return a.timestamp.localeCompare(b.timestamp);
      });
  }

  getOperationsHealthPanel(severity?: AlertSeverity): GetOperationsHealthResponse {
    const activeChains = this.commands.filter((item) => item.status !== "CLOSED").length;
    const anomalyNodeIds = new Set(
      this.nodeDeliveries
        .filter((item) => item.nodeStatus === "ANOMALY_TIMEOUT")
        .map((item) => `${item.commandId}:${item.nodeId}`)
    );

    const alerts = this.timeoutAlerts
      .map((item) => this.toOperationsAlert(item))
      .filter((item) => (severity ? item.severity === severity : true))
      .sort((a, b) => {
        const bySeverity = this.severityRank(b.severity) - this.severityRank(a.severity);
        if (bySeverity !== 0) {
          return bySeverity;
        }
        return b.detectedAt.localeCompare(a.detectedAt);
      });

    return {
      panel: {
        updatedAt: new Date().toISOString(),
        activeChains,
        anomalyNodeCount: anomalyNodeIds.size,
        realtimeAlertCount: alerts.length,
        alerts
      }
    };
  }

  private upsertNodeDelivery(delivery: NodeDelivery): void {
    const idx = this.nodeDeliveries.findIndex(
      (item) => item.commandId === delivery.commandId && item.nodeId === delivery.nodeId
    );
    if (idx >= 0) {
      this.nodeDeliveries[idx] = delivery;
      void this.databaseService.upsertNodeDelivery(delivery).catch(() => undefined);
      return;
    }
    this.nodeDeliveries.push(delivery);
    void this.databaseService.upsertNodeDelivery(delivery).catch(() => undefined);
  }

  private toNodeCommandCard(delivery: NodeDelivery): NodeCommandCard | undefined {
    const command = this.findCommand(delivery.commandId);
    if (!command) {
      return undefined;
    }
    const draft = this.findDraft(command.draftId);
    if (!draft) {
      return undefined;
    }

    return {
      commandId: command.commandId,
      nodeId: delivery.nodeId,
      nodeStatus: delivery.nodeStatus,
      sourceNodeId: delivery.sourceNodeId,
      arrivedAt: delivery.arrivedAt,
      content: draft.content,
      targetNode: draft.targetNode,
      executionRequirement: draft.executionRequirement,
      feedbackRequirement: draft.feedbackRequirement,
      understandingStatus: delivery.understandingStatus,
      understandingQuestion: delivery.understandingQuestion,
      understoodAt: delivery.understoodAt,
      executionStatus: delivery.executionStatus,
      executionCompletedAt: delivery.executionCompletedAt,
      executionExceptionNote: delivery.executionExceptionNote
    };
  }

  private emitRealtime(commandId: string, eventType: string, payload: Record<string, unknown>): void {
    const current = this.eventSequenceByCommand.get(commandId) ?? 0;
    const next = current + 1;
    this.eventSequenceByCommand.set(commandId, next);
    const event: RealtimeCommandEvent = {
      commandId,
      eventType,
      eventSequence: next,
      timestamp: new Date().toISOString(),
      payload
    };
    this.realtime$.next(event);
    this.recentRealtimeEvents.push(event);
    if (this.recentRealtimeEvents.length > 1000) {
      this.recentRealtimeEvents.shift();
    }
    this.enqueueSignedCallbackDeliveries(event);
    this.auditEvents.push({
      eventId: `AUD-${randomUUID()}`,
      commandId,
      nodeId:
        typeof payload.nodeId === "string"
          ? payload.nodeId
          : typeof payload.rootNodeId === "string"
          ? payload.rootNodeId
          : "CENTRAL",
      eventType,
      eventSequence: event.eventSequence,
      timestamp: event.timestamp,
      payload: event.payload
    });
    const latest = this.auditEvents[this.auditEvents.length - 1];
    void this.databaseService.appendAuditEvent(latest).catch(() => undefined);
  }

  private enqueueSignedCallbackDeliveries(event: RealtimeCommandEvent): void {
    this.callbackSubscriptions.forEach((subscription) => {
      const payloadRaw = JSON.stringify(event);
      const signatureValue = createHmac("sha256", subscription.signingSecret)
        .update(payloadRaw)
        .digest("hex");
      const deliveryOutcome = this.simulateCallbackDispatch(subscription.callbackUrl);
      const delivery: CallbackDeliveryRecord = {
        deliveryId: `DLV-${randomUUID()}`,
        subscriptionId: subscription.subscriptionId,
        externalSystemId: subscription.externalSystemId,
        callbackUrl: subscription.callbackUrl,
        commandId: event.commandId,
        eventType: event.eventType,
        eventSequence: event.eventSequence,
        timestamp: event.timestamp,
        signatureHeader: "X-Signature-HMAC-SHA256",
        signatureValue,
        payload: event,
        attempts: deliveryOutcome.attempts,
        maxAttempts: 3,
        status: deliveryOutcome.status,
        lastError: deliveryOutcome.lastError
      };
      this.callbackDeliveries.push(delivery);
      void this.databaseService.appendCallbackDelivery(delivery).catch(() => undefined);
      if (this.callbackDeliveries.length > 5000) {
        this.callbackDeliveries.shift();
      }
    });
  }

  private simulateCallbackDispatch(
    callbackUrl: string
  ): { attempts: number; status: "SUCCESS" | "FAILED"; lastError?: string } {
    const maxAttempts = 3;
    for (let attempts = 1; attempts <= maxAttempts; attempts += 1) {
      const shouldFail = callbackUrl.includes("fail");
      if (!shouldFail) {
        return { attempts, status: "SUCCESS" };
      }
      if (attempts === maxAttempts) {
        return {
          attempts,
          status: "FAILED",
          lastError: "callback_delivery_failed_after_3_retries"
        };
      }
    }
    return {
      attempts: maxAttempts,
      status: "FAILED",
      lastError: "callback_delivery_failed_after_3_retries"
    };
  }

  private toOperationsAlert(alert: TimeoutAlert): OperationsAlertItem {
    let severity: AlertSeverity = "MEDIUM";
    if (alert.timeoutType === "UNDERSTANDING_TIMEOUT" && alert.elapsedSeconds >= 10) {
      severity = "HIGH";
    }
    if (alert.timeoutType === "PROPAGATION_TIMEOUT") {
      severity = alert.elapsedSeconds >= 10 ? "CRITICAL" : "HIGH";
    }

    return {
      commandId: alert.commandId,
      nodeId: alert.nodeId,
      timeoutType: alert.timeoutType,
      severity,
      detectedAt: alert.detectedAt,
      elapsedSeconds: alert.elapsedSeconds,
      lastEventAt: alert.lastEventAt
    };
  }

  private severityRank(severity: AlertSeverity): number {
    switch (severity) {
      case "CRITICAL":
        return 3;
      case "HIGH":
        return 2;
      default:
        return 1;
    }
  }

  private syncRootNodeAvailability(profile: NodeProfile): void {
    const rootNode = this.rootNodes.find((item) => item.nodeId === profile.nodeId);
    if (!rootNode) {
      return;
    }
    rootNode.nodeName = profile.nodeName;
    rootNode.available = profile.active;
  }

  private toConnectionStatus(roleType: NodeRoleType, active: boolean): NodeConnectionStatus {
    if (!active) {
      return "OFFLINE";
    }
    if (roleType === "EXTERNAL") {
      return "DEGRADED";
    }
    return "ONLINE";
  }
}
