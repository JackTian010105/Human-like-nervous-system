export interface HealthResponse {
    status: "ok";
}
export interface CreateCommandDraftRequest {
    content: string;
    targetNode: string;
    executionRequirement: string;
    feedbackRequirement: string;
}
export interface CommandDraft {
    draftId: string;
    status: "DRAFT";
    content: string;
    targetNode: string;
    executionRequirement: string;
    feedbackRequirement: string;
    createdAt: string;
}
export interface CreateCommandDraftResponse {
    draft: CommandDraft;
}
export interface IssueCommandRequest {
    issuerId: string;
}
export interface CommandRecord {
    commandId: string;
    draftId: string;
    issuerId: string;
    createdAt: string;
    status: "CREATED" | "DISPATCHED_PENDING_RECEIVE" | "FEEDBACK_RETURNING" | "CLOSED";
    rootNodeId?: string;
    dispatchedAt?: string;
    closedAt?: string;
    previousCommandId?: string;
}
export interface IssueCommandResponse {
    command: CommandRecord;
}
export interface RootNodeCandidate {
    nodeId: string;
    nodeName: string;
    available: boolean;
}
export interface ListRootNodeCandidatesResponse {
    nodes: RootNodeCandidate[];
}
export interface BindRootNodeRequest {
    rootNodeId: string;
}
export interface CommandChainStart {
    commandId: string;
    fromNodeId: "CENTRAL";
    toNodeId: string;
    createdAt: string;
}
export interface CommandAuditEvent {
    eventId: string;
    commandId: string;
    nodeId: string;
    eventType: "ROOT_NODE_BOUND";
    timestamp: string;
}
export interface BindRootNodeResponse {
    command: CommandRecord;
    chainStart: CommandChainStart;
    auditEvent: CommandAuditEvent;
}
export interface ListCommandsResponse {
    commands: CommandRecord[];
}
export interface GetCommandResponse {
    command: CommandRecord;
}
export interface NodeCommandCard {
    commandId: string;
    nodeId: string;
    nodeStatus: "PENDING_RECEIVE" | "RECEIVED" | "UNDERSTOOD" | "ANOMALY_TIMEOUT";
    sourceNodeId: string;
    arrivedAt: string;
    content: string;
    targetNode: string;
    executionRequirement: string;
    feedbackRequirement: string;
    understandingStatus?: "UNDERSTOOD" | "NEED_CLARIFICATION";
    understandingQuestion?: string;
    understoodAt?: string;
    executionStatus?: "COMPLETED" | "NOT_COMPLETED" | "EXCEPTION";
    executionCompletedAt?: string;
    executionExceptionNote?: string;
}
export interface ListNodeCommandsResponse {
    commands: NodeCommandCard[];
}
export interface GetNodeCommandDetailResponse {
    command: NodeCommandCard;
}
export interface SubmitUnderstandingReceiptRequest {
    understandingStatus: "UNDERSTOOD" | "NEED_CLARIFICATION";
    question?: string;
}
export interface SubmitUnderstandingReceiptResponse {
    command: NodeCommandCard;
}
export interface PropagateCommandRequest {
    targetNodeIds: string[];
}
export interface PropagationEvent {
    commandId: string;
    fromNodeId: string;
    toNodeId: string;
    propagatedAt: string;
}
export interface PropagateCommandResponse {
    propagated: PropagationEvent[];
    invalidTargets: string[];
}
export interface TimeoutAlert {
    commandId: string;
    nodeId: string;
    timeoutType: "UNDERSTANDING_TIMEOUT" | "PROPAGATION_TIMEOUT";
    detectedAt: string;
    elapsedSeconds: number;
    lastEventAt: string;
}
export interface TriggerTimeoutScanResponse {
    generated: TimeoutAlert[];
}
export interface ListTimeoutAlertsResponse {
    alerts: TimeoutAlert[];
}
export interface ExceptionNodeDetail {
    commandId: string;
    nodeId: string;
    currentStatus: NodeCommandCard["nodeStatus"];
    lastEventAt: string;
    recentError: string;
}
export interface GetExceptionNodeDetailResponse {
    detail: ExceptionNodeDetail;
}
export interface SubmitExecutionFeedbackRequest {
    executionStatus: "COMPLETED" | "NOT_COMPLETED" | "EXCEPTION";
    exceptionNote?: string;
}
export interface SubmitExecutionFeedbackResponse {
    command: NodeCommandCard;
}
export interface FeedbackAggregationSummary {
    commandId: string;
    fromNodeId: string;
    completedCount: number;
    notCompletedCount: number;
    exceptionCount: number;
    pendingCount: number;
    pendingNodeIds: string[];
    aggregatedAt: string;
}
export interface SubmitFeedbackAggregationResponse {
    summary: FeedbackAggregationSummary;
}
export interface EvaluateClosureResponse {
    commandId: string;
    status: CommandRecord["status"];
    isClosed: boolean;
    unmetConditions: string[];
    evaluatedAt: string;
}
export interface CreateNextRoundCommandRequest {
    issuerId?: string;
    content?: string;
    targetNode?: string;
    executionRequirement?: string;
    feedbackRequirement?: string;
}
export interface CreateNextRoundCommandResponse {
    command: CommandRecord;
    inheritedFields: Array<"content" | "targetNode" | "executionRequirement" | "feedbackRequirement">;
    overridableFields: Array<"content" | "targetNode" | "executionRequirement" | "feedbackRequirement">;
}
export interface CommandChainNodeView {
    nodeId: string;
    sourceNodeId: string;
    nodeStatus: NodeCommandCard["nodeStatus"];
    arrivedAt: string;
}
export interface CommandChainProgress {
    totalNodes: number;
    completedNodes: number;
}
export interface GetCommandChainResponse {
    commandId: string;
    nodes: CommandChainNodeView[];
    progress: CommandChainProgress;
}
export interface RealtimeCommandEvent {
    commandId: string;
    eventType: string;
    eventSequence: number;
    timestamp: string;
    payload: Record<string, unknown>;
}
export interface AuditEvent {
    eventId: string;
    commandId: string;
    nodeId: string;
    eventType: string;
    timestamp: string;
    eventSequence: number;
    payload: Record<string, unknown>;
}
export interface ListAuditEventsResponse {
    events: AuditEvent[];
}
export interface AuditQuery {
    commandId?: string;
    nodeId?: string;
    eventType?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
}
export interface EventTimelineResponse {
    events: AuditEvent[];
    pagination?: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}
export type NodeRoleType = "CAPTAIN" | "MEMBER" | "EXTERNAL";
export type NodeConnectionStatus = "ONLINE" | "OFFLINE" | "DEGRADED" | "RECOVERING";
export interface NodeProfile {
    nodeId: string;
    nodeName: string;
    roleType: NodeRoleType;
    parentNodeId?: string;
    chainPosition?: string;
    active: boolean;
    connectionStatus: NodeConnectionStatus;
    lastSeenAt: string;
    updatedAt: string;
}
export interface UpdateNodeConfigRequest {
    nodeName?: string;
    roleType?: NodeRoleType;
    parentNodeId?: string;
    chainPosition?: string;
    active?: boolean;
}
export interface RegisterNodeRequest {
    nodeId: string;
    nodeName: string;
    roleType: NodeRoleType;
    parentNodeId?: string;
    chainPosition?: string;
    active?: boolean;
}
export interface RegisterNodeResponse {
    node: NodeProfile;
    created: boolean;
    auditEvent?: AuditEvent;
}
export interface UpdateNodeConfigResponse {
    node: NodeProfile;
    auditEvent: AuditEvent;
}
export interface GetNodeDiagnosticsResponse {
    diagnostics: {
        node: NodeProfile;
        recentEvents: AuditEvent[];
        recentErrors: string[];
        activeAlerts: OperationsAlertItem[];
    };
}
export interface TriggerNodeRecoveryRequest {
    reason?: string;
}
export interface TriggerNodeRecoveryResponse {
    nodeId: string;
    recoveryStatus: "RECOVERING";
    triggeredAt: string;
    eventType: "RecoveryTriggered";
}
export interface ExternalCreateCommandRequest {
    externalSystemId: string;
    content: string;
    targetNode: string;
    executionRequirement: string;
    feedbackRequirement: string;
    issuerId?: string;
}
export interface ExternalCreateCommandResponse {
    command: CommandRecord;
    idempotencyKey: string;
    replayed: boolean;
}
export interface ListExternalEventsResponse {
    events: RealtimeCommandEvent[];
}
export type ExternalEventOrder = "asc" | "desc";
export interface RegisterExternalCallbackRequest {
    externalSystemId: string;
    callbackUrl: string;
    signingSecret: string;
}
export interface RegisterExternalCallbackResponse {
    subscriptionId: string;
    externalSystemId: string;
    callbackUrl: string;
    registeredAt: string;
}
export interface CallbackDeliveryRecord {
    deliveryId: string;
    subscriptionId: string;
    externalSystemId: string;
    callbackUrl: string;
    commandId: string;
    eventType: string;
    eventSequence: number;
    timestamp: string;
    signatureHeader: string;
    signatureValue: string;
    payload: RealtimeCommandEvent;
    attempts: number;
    maxAttempts: 3;
    status: "SUCCESS" | "FAILED";
    lastError?: string;
}
export interface ListCallbackDeliveriesResponse {
    deliveries: CallbackDeliveryRecord[];
}
export interface ExternalIntegrationMetricsResponse {
    generatedAt: string;
    windowMinutes: number;
    apiRequests: {
        total: number;
        success: number;
        unauthorized: number;
        badRequest: number;
        serverError: number;
        availabilityRate: number;
    };
    callbackDeliveries: {
        total: number;
        success: number;
        failed: number;
        eventDeliverySuccessRate: number;
        retried: number;
        retrySuccess: number;
        retrySuccessRate: number;
    };
}
export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM";
export interface OperationsAlertItem {
    commandId: string;
    nodeId: string;
    timeoutType: TimeoutAlert["timeoutType"];
    severity: AlertSeverity;
    detectedAt: string;
    elapsedSeconds: number;
    lastEventAt: string;
}
export interface OperationsHealthPanel {
    updatedAt: string;
    activeChains: number;
    anomalyNodeCount: number;
    realtimeAlertCount: number;
    alerts: OperationsAlertItem[];
}
export interface GetOperationsHealthResponse {
    panel: OperationsHealthPanel;
}
