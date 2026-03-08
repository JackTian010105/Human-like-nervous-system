import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  MessageEvent,
  NotFoundException,
  Patch,
  Param,
  Post
} from "@nestjs/common";
import { Query } from "@nestjs/common";
import { Sse } from "@nestjs/common";
import { map, Observable } from "rxjs";
import type {
  AuditQuery,
  BindRootNodeRequest,
  BindRootNodeResponse,
  CreateNextRoundCommandRequest,
  CreateNextRoundCommandResponse,
  CreateCommandDraftResponse,
  EvaluateClosureResponse,
  GetOperationsHealthResponse,
  GetNodeDiagnosticsResponse,
  GetExceptionNodeDetailResponse,
  GetCommandChainResponse,
  ListAuditEventsResponse,
  EventTimelineResponse,
  GetCommandResponse,
  IssueCommandResponse,
  IssueCommandRequest,
  GetNodeCommandDetailResponse,
  ListCommandsResponse,
  ListNodeCommandsResponse,
  PropagateCommandRequest,
  PropagateCommandResponse,
  ListRootNodeCandidatesResponse,
  ListTimeoutAlertsResponse,
  SubmitFeedbackAggregationResponse,
  SubmitUnderstandingReceiptRequest,
  SubmitUnderstandingReceiptResponse,
  SubmitExecutionFeedbackRequest,
  SubmitExecutionFeedbackResponse,
  TriggerTimeoutScanResponse,
  TriggerNodeRecoveryRequest,
  TriggerNodeRecoveryResponse,
  UpdateNodeConfigResponse
} from "@command-neural/shared-types";
import { CommandsService } from "./commands.service";
import { validateCreateCommandDraftRequest, validateUpdateNodeConfigRequest } from "./commands.validation";

@Controller("commands")
export class CommandsController {
  constructor(private readonly commandsService: CommandsService) {}

  @Post("drafts")
  createDraft(@Body() body: unknown): CreateCommandDraftResponse {
    const validation = validateCreateCommandDraftRequest(body);

    if (!validation.ok) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: validation.errors
      });
    }

    const draft = this.commandsService.createDraft(validation.value);
    return { draft };
  }

  @Get("root-candidates")
  listRootCandidates(): ListRootNodeCandidatesResponse {
    return { nodes: this.commandsService.listRootNodeCandidates() };
  }

  @Get()
  listCommands(): ListCommandsResponse {
    return { commands: this.commandsService.listCommands() };
  }

  @Get(":commandId")
  getCommand(@Param("commandId") commandId: string): GetCommandResponse {
    const command = this.commandsService.findCommand(commandId);
    if (!command) {
      throw new NotFoundException({
        message: "Command not found",
        commandId
      });
    }

    return { command };
  }

  @Get(":commandId/chain")
  getCommandChain(@Param("commandId") commandId: string): GetCommandChainResponse {
    const command = this.commandsService.findCommand(commandId);
    if (!command) {
      throw new NotFoundException({
        message: "Command not found",
        commandId
      });
    }
    return this.commandsService.getCommandChain(commandId);
  }

  @Get("/nodes/:nodeId/commands")
  listNodeCommands(
    @Param("nodeId") nodeId: string,
    @Headers("x-node-id") requesterNodeId?: string
  ): ListNodeCommandsResponse {
    this.ensureNodeAccess(nodeId, requesterNodeId);
    return { commands: this.commandsService.listNodeCommands(nodeId) };
  }

  @Get("/nodes/:nodeId/commands/:commandId")
  getNodeCommand(
    @Param("nodeId") nodeId: string,
    @Param("commandId") commandId: string,
    @Headers("x-node-id") requesterNodeId?: string
  ): GetNodeCommandDetailResponse {
    this.ensureNodeAccess(nodeId, requesterNodeId, commandId);
    const command = this.commandsService.getNodeCommand(nodeId, commandId);
    if (!command) {
      throw new NotFoundException({
        message: "Node command not found",
        nodeId,
        commandId
      });
    }

    return { command };
  }

  @Get("/nodes/:nodeId/downstream-candidates")
  listDownstreamCandidates(
    @Param("nodeId") nodeId: string,
    @Headers("x-node-id") requesterNodeId?: string
  ): { nodeIds: string[] } {
    this.ensureNodeAccess(nodeId, requesterNodeId);
    return { nodeIds: this.commandsService.listDownstreamCandidates(nodeId) };
  }

  @Get("/alerts/timeouts")
  listTimeoutAlerts(): ListTimeoutAlertsResponse {
    return { alerts: this.commandsService.listTimeoutAlerts() };
  }

  @Get("/alerts/timeouts/:commandId/:nodeId")
  getExceptionNodeDetail(
    @Param("commandId") commandId: string,
    @Param("nodeId") nodeId: string
  ): GetExceptionNodeDetailResponse {
    const detail = this.commandsService.getExceptionNodeDetail(commandId, nodeId);
    if (!detail) {
      throw new NotFoundException({
        message: "Exception node detail not found",
        commandId,
        nodeId
      });
    }
    return { detail };
  }

  @Get("/audit/events")
  listAuditEvents(): ListAuditEventsResponse {
    return { events: this.commandsService.listAuditEvents() };
  }

  @Get(":commandId/audit/events")
  listCommandAuditEvents(@Param("commandId") commandId: string): ListAuditEventsResponse {
    return { events: this.commandsService.listAuditEvents(commandId) };
  }

  @Get("/audit/timeline")
  getAuditTimeline(
    @Query("commandId") commandId?: string,
    @Query("nodeId") nodeId?: string,
    @Query("eventType") eventType?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ): EventTimelineResponse {
    const parsedPage = page ? Number.parseInt(page, 10) : undefined;
    const parsedPageSize = pageSize ? Number.parseInt(pageSize, 10) : undefined;
    const query: AuditQuery = {
      commandId: commandId?.trim() || undefined,
      nodeId: nodeId?.trim() || undefined,
      eventType: eventType?.trim() || undefined,
      from: from?.trim() || undefined,
      to: to?.trim() || undefined,
      page: Number.isFinite(parsedPage) ? parsedPage : undefined,
      pageSize: Number.isFinite(parsedPageSize) ? parsedPageSize : undefined
    };
    return this.commandsService.queryAuditEvents(query);
  }

  @Get("/operations/health")
  getOperationsHealth(
    @Query("severity") severity?: "CRITICAL" | "HIGH" | "MEDIUM"
  ): GetOperationsHealthResponse {
    return this.commandsService.getOperationsHealthPanel(severity);
  }

  @Patch("/nodes/:nodeId/config")
  updateNodeConfig(
    @Param("nodeId") nodeId: string,
    @Body() body: unknown,
    @Headers("x-operator-role") operatorRole?: string
  ): UpdateNodeConfigResponse {
    this.ensureOperatorRole(operatorRole, ["GUANNING", "SUNWU"]);
    const validation = validateUpdateNodeConfigRequest(body);
    if (!validation.ok) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: validation.errors
      });
    }
    const updated = this.commandsService.updateNodeConfig(nodeId, validation.value);
    if (!updated) {
      throw new NotFoundException({
        message: "Node not found",
        nodeId
      });
    }
    return updated;
  }

  @Get("/nodes/:nodeId/diagnostics")
  getNodeDiagnostics(
    @Param("nodeId") nodeId: string,
    @Headers("x-operator-role") operatorRole?: string
  ): GetNodeDiagnosticsResponse {
    this.ensureOperatorRole(operatorRole, ["GUANNING", "BIANQUE"]);
    const diagnostics = this.commandsService.getNodeDiagnostics(nodeId);
    if (!diagnostics) {
      throw new NotFoundException({
        message: "Node not found",
        nodeId
      });
    }
    return diagnostics;
  }

  @Post("/nodes/:nodeId/recovery")
  triggerNodeRecovery(
    @Param("nodeId") nodeId: string,
    @Body() body: TriggerNodeRecoveryRequest,
    @Headers("x-operator-role") operatorRole?: string
  ): TriggerNodeRecoveryResponse {
    this.ensureOperatorRole(operatorRole, ["BIANQUE", "GUANNING"]);
    const result = this.commandsService.triggerNodeRecovery(nodeId, body ?? {});
    if (!result) {
      throw new NotFoundException({
        message: "Node not found",
        nodeId
      });
    }
    return result;
  }

  @Sse("realtime/stream")
  realtimeStream(): Observable<MessageEvent> {
    return this.commandsService.getRealtimeStream().pipe(
      map((event) => ({
        data: event
      }))
    );
  }

  @Post("/monitor/timeouts/scan")
  triggerTimeoutScan(): TriggerTimeoutScanResponse {
    return { generated: this.commandsService.triggerTimeoutScan(new Date()) };
  }

  @Post("/nodes/:nodeId/commands/:commandId/understanding")
  submitUnderstandingReceipt(
    @Param("nodeId") nodeId: string,
    @Param("commandId") commandId: string,
    @Body() body: SubmitUnderstandingReceiptRequest,
    @Headers("x-node-id") requesterNodeId?: string
  ): SubmitUnderstandingReceiptResponse {
    this.ensureNodeAccess(nodeId, requesterNodeId, commandId);
    const status = body?.understandingStatus;
    if (status !== "UNDERSTOOD" && status !== "NEED_CLARIFICATION") {
      throw new BadRequestException({
        message: "Validation failed",
        errors: { understandingStatus: "understandingStatus is required" }
      });
    }

    const command = this.commandsService.submitUnderstandingReceipt({
      nodeId,
      commandId,
      understandingStatus: status,
      question: body.question?.trim() || undefined
    });
    if (!command) {
      throw new NotFoundException({
        message: "Node command not found",
        nodeId,
        commandId
      });
    }

    return { command };
  }

  @Post("/nodes/:nodeId/commands/:commandId/execution-feedback")
  submitExecutionFeedback(
    @Param("nodeId") nodeId: string,
    @Param("commandId") commandId: string,
    @Body() body: SubmitExecutionFeedbackRequest,
    @Headers("x-node-id") requesterNodeId?: string
  ): SubmitExecutionFeedbackResponse {
    this.ensureNodeAccess(nodeId, requesterNodeId, commandId);
    const status = body?.executionStatus;
    if (status !== "COMPLETED" && status !== "NOT_COMPLETED" && status !== "EXCEPTION") {
      throw new BadRequestException({
        message: "Validation failed",
        errors: { executionStatus: "executionStatus is required" }
      });
    }

    const command = this.commandsService.submitExecutionFeedback({
      nodeId,
      commandId,
      executionStatus: status,
      exceptionNote: body.exceptionNote?.trim() || undefined
    });
    if (!command) {
      throw new NotFoundException({
        message: "Node command not found",
        nodeId,
        commandId
      });
    }

    return { command };
  }

  @Post("/nodes/:nodeId/commands/:commandId/feedback-aggregation")
  submitFeedbackAggregation(
    @Param("nodeId") nodeId: string,
    @Param("commandId") commandId: string,
    @Headers("x-node-id") requesterNodeId?: string
  ): SubmitFeedbackAggregationResponse {
    this.ensureNodeAccess(nodeId, requesterNodeId, commandId);
    const summary = this.commandsService.aggregateDownstreamFeedback({
      fromNodeId: nodeId,
      commandId
    });
    return { summary };
  }

  @Post("/nodes/:nodeId/commands/:commandId/propagate")
  propagateCommand(
    @Param("nodeId") nodeId: string,
    @Param("commandId") commandId: string,
    @Body() body: PropagateCommandRequest,
    @Headers("x-node-id") requesterNodeId?: string
  ): PropagateCommandResponse {
    this.ensureNodeAccess(nodeId, requesterNodeId, commandId);
    if (!Array.isArray(body?.targetNodeIds) || body.targetNodeIds.length === 0) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: { targetNodeIds: "targetNodeIds must contain at least one node" }
      });
    }

    const fromNodeCommand = this.commandsService.getNodeCommand(nodeId, commandId);
    if (!fromNodeCommand) {
      throw new NotFoundException({
        message: "Node command not found",
        nodeId,
        commandId
      });
    }
    if (fromNodeCommand.nodeStatus !== "UNDERSTOOD" && fromNodeCommand.nodeStatus !== "ANOMALY_TIMEOUT") {
      throw new BadRequestException({
        message: "Validation failed",
        errors: { commandId: "command must be UNDERSTOOD (or ANOMALY_TIMEOUT for recovery) before propagation" }
      });
    }

    const targetNodeIds = Array.from(
      new Set(body.targetNodeIds.map((item) => item.trim()).filter((item) => item.length > 0))
    );
    if (targetNodeIds.length === 0) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: { targetNodeIds: "targetNodeIds must contain at least one valid node" }
      });
    }
    return this.commandsService.propagateCommand({
      fromNodeId: nodeId,
      commandId,
      targetNodeIds
    });
  }

  @Post("drafts/:draftId/issue")
  issueCommand(
    @Param("draftId") draftId: string,
    @Body() body: IssueCommandRequest,
    @Headers("idempotency-key") idempotencyKey?: string
  ): IssueCommandResponse {
    const issuerId = body?.issuerId?.trim();
    if (!issuerId) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: { issuerId: "issuerId is required" }
      });
    }

    const draft = this.commandsService.findDraft(draftId);
    if (!draft) {
      throw new NotFoundException({
        message: "Draft not found",
        draftId
      });
    }

    const command = this.commandsService.issueCommand({
      draftId,
      issuerId,
      idempotencyKey: idempotencyKey?.trim() || undefined
    });
    return { command };
  }

  @Post(":commandId/root-node")
  bindRootNode(
    @Param("commandId") commandId: string,
    @Body() body: BindRootNodeRequest
  ): BindRootNodeResponse {
    const rootNodeId = body?.rootNodeId?.trim();
    if (!rootNodeId) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: { rootNodeId: "rootNodeId is required" }
      });
    }

    const command = this.commandsService.findCommand(commandId);
    if (!command) {
      throw new NotFoundException({
        message: "Command not found",
        commandId
      });
    }

    const node = this.commandsService.findRootNode(rootNodeId);
    if (!node) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: { rootNodeId: "root node does not exist" }
      });
    }
    if (!node.available) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: { rootNodeId: "selected root node is unavailable" }
      });
    }

    return this.commandsService.bindRootNode({
      commandId,
      rootNodeId
    });
  }

  @Post(":commandId/evaluate-closure")
  evaluateClosure(@Param("commandId") commandId: string): EvaluateClosureResponse {
    const command = this.commandsService.findCommand(commandId);
    if (!command) {
      throw new NotFoundException({
        message: "Command not found",
        commandId
      });
    }
    return this.commandsService.evaluateClosure(commandId);
  }

  @Post(":commandId/next-round")
  createNextRound(
    @Param("commandId") commandId: string,
    @Body() body: CreateNextRoundCommandRequest
  ): CreateNextRoundCommandResponse {
    const previous = this.commandsService.findCommand(commandId);
    if (!previous) {
      throw new NotFoundException({
        message: "Command not found",
        commandId
      });
    }
    if (previous.status !== "FEEDBACK_RETURNING" && previous.status !== "CLOSED") {
      throw new BadRequestException({
        message: "Validation failed",
        errors: { commandId: "next-round can only be created from FEEDBACK_RETURNING or CLOSED" }
      });
    }
    const result = this.commandsService.createNextRoundCommand({
      previousCommandId: commandId,
      request: body
    });
    if (!result) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: { commandId: "previous command context is incomplete" }
      });
    }
    return result;
  }

  private ensureNodeAccess(nodeId: string, requesterNodeId?: string, commandId?: string): void {
    const nodeExists = this.commandsService.isKnownNode(nodeId);
    if (!nodeExists) {
      this.commandsService.recordNodeAccessDenied({
        nodeId,
        requesterNodeId,
        commandId,
        reason: "node_not_found"
      });
      throw new ForbiddenException({
        message: "Forbidden node access",
        nodeId
      });
    }
    if (!requesterNodeId || requesterNodeId !== nodeId) {
      this.commandsService.recordNodeAccessDenied({
        nodeId,
        requesterNodeId,
        commandId,
        reason: "node_mismatch"
      });
      throw new ForbiddenException({
        message: "Forbidden node access",
        nodeId
      });
    }
  }

  private ensureOperatorRole(role: string | undefined, allowed: string[]): void {
    const normalized = role?.trim().toUpperCase();
    if (!normalized || !allowed.includes(normalized)) {
      throw new ForbiddenException({
        message: "Forbidden operator role",
        requiredRoles: allowed
      });
    }
  }
}
