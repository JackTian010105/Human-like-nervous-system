"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BindRootNodeResponse,
  CommandDraft,
  CommandRecord,
  CreateCommandDraftResponse,
  GetNodeCommandDetailResponse,
  IssueCommandResponse,
  ListCommandsResponse,
  ListNodeCommandsResponse,
  NodeCommandCard,
  RootNodeCandidate
} from "@command-neural/shared-types";

type FieldName = "content" | "targetNode" | "executionRequirement" | "feedbackRequirement";

type FormState = Record<FieldName, string>;

const initialFormState: FormState = {
  content: "",
  targetNode: "",
  executionRequirement: "",
  feedbackRequirement: ""
};

const commandStatusMeta: Record<string, { label: string; icon: string; color: string }> = {
  CREATED: { label: "已创建", icon: "●", color: "#6b7280" },
  DISPATCHED_PENDING_RECEIVE: { label: "已下发/待接收", icon: "⇣", color: "#1d4ed8" },
  FEEDBACK_RETURNING: { label: "反馈中", icon: "↩", color: "#b45309" },
  CLOSED: { label: "闭环完成", icon: "✓", color: "#166534" }
};

function getCommandStatusMeta(status: string): { label: string; icon: string; color: string } {
  return commandStatusMeta[status] ?? { label: status, icon: "?", color: "#374151" };
}

export default function HomePage() {
  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
    []
  );
  const [form, setForm] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<CommandDraft | null>(null);
  const [issuerId, setIssuerId] = useState("sunwu");
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [command, setCommand] = useState<CommandRecord | null>(null);
  const [rootNodes, setRootNodes] = useState<RootNodeCandidate[]>([]);
  const [rootNodeId, setRootNodeId] = useState("");
  const [bindingRootNode, setBindingRootNode] = useState(false);
  const [rootNodeError, setRootNodeError] = useState("");
  const [bindResult, setBindResult] = useState<BindRootNodeResponse | null>(null);
  const [commands, setCommands] = useState<CommandRecord[]>([]);
  const [selectedCommand, setSelectedCommand] = useState<CommandRecord | null>(null);
  const [queryId, setQueryId] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [closureResult, setClosureResult] = useState<{
    commandId: string;
    status: string;
    isClosed: boolean;
    unmetConditions: string[];
    evaluatedAt: string;
  } | null>(null);
  const [nextRoundIssuerId, setNextRoundIssuerId] = useState("sunwu");
  const [nextRoundContent, setNextRoundContent] = useState("");
  const [nextRoundTargetNode, setNextRoundTargetNode] = useState("");
  const [nextRoundExecutionRequirement, setNextRoundExecutionRequirement] = useState("");
  const [nextRoundFeedbackRequirement, setNextRoundFeedbackRequirement] = useState("");
  const [creatingNextRound, setCreatingNextRound] = useState(false);
  const [nextRoundResult, setNextRoundResult] = useState<{
    command: CommandRecord;
    inheritedFields: string[];
    overridableFields: string[];
  } | null>(null);
  const [commandChainView, setCommandChainView] = useState<{
    commandId: string;
    nodes: { nodeId: string; sourceNodeId: string; nodeStatus: string; arrivedAt: string }[];
    progress: { totalNodes: number; completedNodes: number };
  } | null>(null);
  const [focusedChainNodeId, setFocusedChainNodeId] = useState<string | null>(null);
  const [focusedAnomalyIndex, setFocusedAnomalyIndex] = useState(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeEvents, setRealtimeEvents] = useState<
    { commandId: string; eventType: string; eventSequence: number; timestamp: string }[]
  >([]);
  const latestEventSequenceRef = useRef<Map<string, number>>(new Map());
  const [nodeWorkbenchNodeId, setNodeWorkbenchNodeId] = useState("captain-A");
  const [nodeCommands, setNodeCommands] = useState<NodeCommandCard[]>([]);
  const [selectedNodeCommand, setSelectedNodeCommand] = useState<NodeCommandCard | null>(null);
  const [nodeWorkbenchError, setNodeWorkbenchError] = useState("");
  const [understandingStatus, setUnderstandingStatus] = useState<"UNDERSTOOD" | "NEED_CLARIFICATION">(
    "UNDERSTOOD"
  );
  const [understandingQuestion, setUnderstandingQuestion] = useState("");
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [downstreamCandidates, setDownstreamCandidates] = useState<string[]>([]);
  const [selectedPropagationTargets, setSelectedPropagationTargets] = useState<string[]>([]);
  const [propagating, setPropagating] = useState(false);
  const [propagationResult, setPropagationResult] = useState<{
    propagated: { toNodeId: string }[];
    invalidTargets: string[];
  } | null>(null);
  const [timeoutAlerts, setTimeoutAlerts] = useState<
    {
      commandId: string;
      nodeId: string;
      timeoutType: string;
      detectedAt: string;
      elapsedSeconds: number;
      lastEventAt: string;
    }[]
  >([]);
  const [exceptionDetail, setExceptionDetail] = useState<{
    commandId: string;
    nodeId: string;
    currentStatus: string;
    lastEventAt: string;
    recentError: string;
  } | null>(null);
  const [timelineCommandId, setTimelineCommandId] = useState("");
  const [timelineNodeId, setTimelineNodeId] = useState("");
  const [timelineEventType, setTimelineEventType] = useState("");
  const [timelineFrom, setTimelineFrom] = useState("");
  const [timelineTo, setTimelineTo] = useState("");
  const [timelineEvents, setTimelineEvents] = useState<
    {
      eventId: string;
      commandId: string;
      nodeId: string;
      eventType: string;
      eventSequence: number;
      timestamp: string;
    }[]
  >([]);
  const timelineSectionRef = useRef<HTMLElement | null>(null);
  const [operationsSeverity, setOperationsSeverity] = useState<"ALL" | "CRITICAL" | "HIGH" | "MEDIUM">(
    "ALL"
  );
  const [operationsPanel, setOperationsPanel] = useState<{
    updatedAt: string;
    activeChains: number;
    anomalyNodeCount: number;
    realtimeAlertCount: number;
    alerts: {
      commandId: string;
      nodeId: string;
      timeoutType: string;
      severity: "CRITICAL" | "HIGH" | "MEDIUM";
      detectedAt: string;
      elapsedSeconds: number;
      lastEventAt: string;
    }[];
  } | null>(null);
  const [operatorRole, setOperatorRole] = useState<"GUANNING" | "BIANQUE" | "SUNWU">("GUANNING");
  const [manageNodeId, setManageNodeId] = useState("captain-A");
  const [manageNodeName, setManageNodeName] = useState("");
  const [manageRoleType, setManageRoleType] = useState<"CAPTAIN" | "MEMBER" | "EXTERNAL">("CAPTAIN");
  const [manageParentNodeId, setManageParentNodeId] = useState("");
  const [manageChainPosition, setManageChainPosition] = useState("");
  const [manageActive, setManageActive] = useState(true);
  const [manageMessage, setManageMessage] = useState("");
  const [nodeDiagnostics, setNodeDiagnostics] = useState<{
    node: {
      nodeId: string;
      nodeName: string;
      roleType: string;
      parentNodeId?: string;
      chainPosition?: string;
      active: boolean;
      connectionStatus: string;
      lastSeenAt: string;
      updatedAt: string;
    };
    recentEvents: { eventId: string; eventType: string; timestamp: string; commandId: string }[];
    recentErrors: string[];
    activeAlerts: { timeoutType: string; severity: string; detectedAt: string }[];
  } | null>(null);
  const [recoveryResult, setRecoveryResult] = useState<{
    nodeId: string;
    recoveryStatus: string;
    triggeredAt: string;
    eventType: string;
  } | null>(null);
  const [externalToken, setExternalToken] = useState("dev-external-token");
  const [externalSystemId, setExternalSystemId] = useState("mozi-system");
  const [externalIdempotencyKey, setExternalIdempotencyKey] = useState("ext-demo-001");
  const [externalCreateResult, setExternalCreateResult] = useState<{
    commandId: string;
    status: string;
    issuerId: string;
    idempotencyKey: string;
    replayed: boolean;
  } | null>(null);
  const [externalCreateError, setExternalCreateError] = useState("");
  const [externalEventsCommandId, setExternalEventsCommandId] = useState("");
  const [externalEventsOrder, setExternalEventsOrder] = useState<"asc" | "desc">("desc");
  const [externalEvents, setExternalEvents] = useState<
    { commandId: string; eventType: string; eventSequence: number; timestamp: string }[]
  >([]);
  const [callbackUrl, setCallbackUrl] = useState("https://example-callback.local/events");
  const [callbackSecret, setCallbackSecret] = useState("demo-signing-secret");
  const [callbackRegistration, setCallbackRegistration] = useState<{
    subscriptionId: string;
    externalSystemId: string;
    callbackUrl: string;
    registeredAt: string;
  } | null>(null);
  const [callbackDeliveries, setCallbackDeliveries] = useState<
    {
      deliveryId: string;
      commandId: string;
      eventType: string;
      eventSequence: number;
      signatureHeader: string;
      signatureValue: string;
      timestamp: string;
      attempts: number;
      maxAttempts: 3;
      status: "SUCCESS" | "FAILED";
      lastError?: string;
    }[]
  >([]);
  const [executionStatus, setExecutionStatus] = useState<
    "COMPLETED" | "NOT_COMPLETED" | "EXCEPTION"
  >("COMPLETED");
  const [executionExceptionNote, setExecutionExceptionNote] = useState("");
  const [submittingExecutionFeedback, setSubmittingExecutionFeedback] = useState(false);
  const [aggregatingFeedback, setAggregatingFeedback] = useState(false);
  const [feedbackSummary, setFeedbackSummary] = useState<{
    commandId: string;
    fromNodeId: string;
    completedCount: number;
    notCompletedCount: number;
    exceptionCount: number;
    pendingCount: number;
    pendingNodeIds: string[];
    aggregatedAt: string;
  } | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSubmitError("");
    setErrors({});

    try {
      const response = await fetch(`${apiBase}/commands/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const payload = (await response.json()) as {
          message?: string;
          errors?: Partial<Record<FieldName, string>>;
        };
        setErrors(payload.errors ?? {});
        setSubmitError(payload.message ?? "Failed to create draft");
        setDraft(null);
        return;
      }

      const payload = (await response.json()) as CreateCommandDraftResponse;
      setDraft(payload.draft);
      setCommand(null);
      setIssueError("");
      setForm(initialFormState);
    } catch {
      setSubmitError("Network error while creating draft");
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  const onIssue = async () => {
    if (!draft) {
      return;
    }
    setIssuing(true);
    setIssueError("");

    try {
      const response = await fetch(`${apiBase}/commands/drafts/${draft.draftId}/issue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `${draft.draftId}:${issuerId}`
        },
        body: JSON.stringify({ issuerId })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setIssueError(payload.message ?? "Failed to issue command");
        return;
      }

      const payload = (await response.json()) as IssueCommandResponse;
      setCommand(payload.command);
      setBindResult(null);
      setRootNodeError("");

      const nodesResponse = await fetch(`${apiBase}/commands/root-candidates`);
      if (nodesResponse.ok) {
        const data = (await nodesResponse.json()) as { nodes: RootNodeCandidate[] };
        setRootNodes(data.nodes);
        const firstAvailable = data.nodes.find((item) => item.available);
        setRootNodeId(firstAvailable?.nodeId ?? "");
      }
    } catch {
      setIssueError("Network error while issuing command");
    } finally {
      setIssuing(false);
    }
  };

  const onBindRootNode = async () => {
    if (!command) {
      return;
    }
    setBindingRootNode(true);
    setRootNodeError("");
    try {
      const response = await fetch(`${apiBase}/commands/${command.commandId}/root-node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootNodeId })
      });

      if (!response.ok) {
        const payload = (await response.json()) as {
          message?: string;
          errors?: { rootNodeId?: string };
        };
        setRootNodeError(payload.errors?.rootNodeId ?? payload.message ?? "Failed to bind root node");
        return;
      }

      const payload = (await response.json()) as BindRootNodeResponse;
      setBindResult(payload);
      setCommand(payload.command);
    } catch {
      setRootNodeError("Network error while binding root node");
    } finally {
      setBindingRootNode(false);
    }
  };

  const loadCommands = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/commands`);
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as ListCommandsResponse;
      setCommands(payload.commands);
    } catch {
      // ignore network error, keep previous snapshot
    }
  }, [apiBase]);

  const loadCommandDetail = useCallback(async (commandId: string) => {
    const response = await fetch(`${apiBase}/commands/${commandId}`);
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { command: CommandRecord };
    setSelectedCommand(payload.command);
  }, [apiBase]);

  const applyRealtimeEvent = useCallback(
    (event: { commandId: string; eventType: string; eventSequence: number; timestamp: string }) => {
      const current = latestEventSequenceRef.current.get(event.commandId) ?? 0;
      if (event.eventSequence <= current) {
        return;
      }
      latestEventSequenceRef.current.set(event.commandId, event.eventSequence);
      setRealtimeEvents((prev) => [event, ...prev].slice(0, 20));
      void loadCommands();
      if (selectedCommand?.commandId === event.commandId) {
        void loadCommandDetail(selectedCommand.commandId);
      }
    },
    [loadCommandDetail, loadCommands, selectedCommand?.commandId]
  );

  const hydrateRealtimeSnapshot = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/commands/audit/events`);
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        events: {
          commandId: string;
          eventType: string;
          eventSequence: number;
          timestamp: string;
        }[];
      };
      const nextSeqMap = new Map<string, number>();
      payload.events.forEach((event) => {
        const current = nextSeqMap.get(event.commandId) ?? 0;
        if (event.eventSequence > current) {
          nextSeqMap.set(event.commandId, event.eventSequence);
        }
      });
      latestEventSequenceRef.current = nextSeqMap;
      const recent = [...payload.events]
        .sort((a, b) => {
          const byTime = b.timestamp.localeCompare(a.timestamp);
          if (byTime !== 0) {
            return byTime;
          }
          if (a.commandId === b.commandId) {
            return b.eventSequence - a.eventSequence;
          }
          return b.commandId.localeCompare(a.commandId);
        })
        .slice(0, 20)
        .map((event) => ({
          commandId: event.commandId,
          eventType: event.eventType,
          eventSequence: event.eventSequence,
          timestamp: event.timestamp
        }));
      setRealtimeEvents(recent);
    } catch {
      // ignore replay errors and keep live stream only
    }
  }, [apiBase]);

  const evaluateClosure = async () => {
    if (!selectedCommand) {
      return;
    }
    const response = await fetch(`${apiBase}/commands/${selectedCommand.commandId}/evaluate-closure`, {
      method: "POST"
    });
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      commandId: string;
      status: string;
      isClosed: boolean;
      unmetConditions: string[];
      evaluatedAt: string;
    };
    setClosureResult(payload);
    await loadCommands();
    await loadCommandDetail(selectedCommand.commandId);
  };

  const createNextRound = async () => {
    if (!selectedCommand) {
      return;
    }
    setCreatingNextRound(true);
    try {
      const response = await fetch(`${apiBase}/commands/${selectedCommand.commandId}/next-round`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          issuerId: nextRoundIssuerId,
          content: nextRoundContent || undefined,
          targetNode: nextRoundTargetNode || undefined,
          executionRequirement: nextRoundExecutionRequirement || undefined,
          feedbackRequirement: nextRoundFeedbackRequirement || undefined
        })
      });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        command: CommandRecord;
        inheritedFields: string[];
        overridableFields: string[];
      };
      setNextRoundResult(payload);
      await loadCommands();
    } finally {
      setCreatingNextRound(false);
    }
  };

  const loadCommandChain = async () => {
    if (!selectedCommand) {
      return;
    }
    const response = await fetch(`${apiBase}/commands/${selectedCommand.commandId}/chain`);
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      commandId: string;
      nodes: { nodeId: string; sourceNodeId: string; nodeStatus: string; arrivedAt: string }[];
      progress: { totalNodes: number; completedNodes: number };
    };
    setCommandChainView(payload);
  };

  const filteredCommands = commands.filter((item) => {
    const byId = queryId ? item.commandId.includes(queryId.trim()) : true;
    const byStatus = statusFilter === "ALL" ? true : item.status === statusFilter;
    return byId && byStatus;
  });
  const statusFilterOptions = useMemo(() => {
    const preferred = ["CREATED", "DISPATCHED_PENDING_RECEIVE", "FEEDBACK_RETURNING", "CLOSED"];
    const existing = Array.from(new Set(commands.map((item) => item.status)));
    const merged = Array.from(new Set([...preferred, ...existing]));
    return ["ALL", ...merged];
  }, [commands]);
  const anomalyChainNodes = useMemo(
    () => commandChainView?.nodes.filter((node) => node.nodeStatus === "ANOMALY_TIMEOUT") ?? [],
    [commandChainView]
  );

  const loadNodeCommands = async () => {
    setNodeWorkbenchError("");
    const response = await fetch(`${apiBase}/commands/nodes/${nodeWorkbenchNodeId}/commands`, {
      headers: {
        "x-node-id": nodeWorkbenchNodeId
      }
    });
    if (!response.ok) {
      const payload = (await response.json()) as { message?: string };
      setNodeWorkbenchError(payload.message ?? "failed to load node commands");
      setNodeCommands([]);
      setSelectedNodeCommand(null);
      return;
    }
    const payload = (await response.json()) as ListNodeCommandsResponse;
    setNodeCommands(payload.commands);
  };

  const loadNodeCommandDetail = async (commandId: string) => {
    setNodeWorkbenchError("");
    const response = await fetch(
      `${apiBase}/commands/nodes/${nodeWorkbenchNodeId}/commands/${commandId}`,
      {
        headers: {
          "x-node-id": nodeWorkbenchNodeId
        }
      }
    );
    if (!response.ok) {
      const payload = (await response.json()) as { message?: string };
      setNodeWorkbenchError(payload.message ?? "failed to load node command detail");
      return;
    }
    const payload = (await response.json()) as GetNodeCommandDetailResponse;
    setSelectedNodeCommand(payload.command);
  };

  const submitUnderstandingReceipt = async () => {
    if (!selectedNodeCommand) {
      return;
    }
    setNodeWorkbenchError("");
    setSubmittingReceipt(true);
    try {
      const response = await fetch(
        `${apiBase}/commands/nodes/${nodeWorkbenchNodeId}/commands/${selectedNodeCommand.commandId}/understanding`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-node-id": nodeWorkbenchNodeId
          },
          body: JSON.stringify({
            understandingStatus,
            question: understandingQuestion
          })
        }
      );

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setNodeWorkbenchError(payload.message ?? "failed to submit understanding receipt");
        return;
      }
      const payload = (await response.json()) as GetNodeCommandDetailResponse;
      setSelectedNodeCommand(payload.command);
      await loadNodeCommands();
      const candidateResponse = await fetch(
        `${apiBase}/commands/nodes/${nodeWorkbenchNodeId}/downstream-candidates`,
        {
          headers: {
            "x-node-id": nodeWorkbenchNodeId
          }
        }
      );
      if (candidateResponse.ok) {
        const data = (await candidateResponse.json()) as { nodeIds: string[] };
        setDownstreamCandidates(data.nodeIds);
      }
    } catch {
      setNodeWorkbenchError("network error while submitting understanding receipt");
    } finally {
      setSubmittingReceipt(false);
    }
  };

  const togglePropagationTarget = (target: string) => {
    setSelectedPropagationTargets((prev) =>
      prev.includes(target) ? prev.filter((item) => item !== target) : [...prev, target]
    );
  };

  const submitPropagation = async () => {
    if (!selectedNodeCommand) {
      return;
    }
    setNodeWorkbenchError("");
    setPropagating(true);
    try {
      const response = await fetch(
        `${apiBase}/commands/nodes/${nodeWorkbenchNodeId}/commands/${selectedNodeCommand.commandId}/propagate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-node-id": nodeWorkbenchNodeId
          },
          body: JSON.stringify({
            targetNodeIds: selectedPropagationTargets
          })
        }
      );
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setNodeWorkbenchError(payload.message ?? "failed to propagate");
        return;
      }
      const payload = (await response.json()) as {
        propagated: { toNodeId: string }[];
        invalidTargets: string[];
      };
      setPropagationResult(payload);
    } catch {
      setNodeWorkbenchError("network error while propagating");
    } finally {
      setPropagating(false);
    }
  };

  const submitExecutionFeedback = async () => {
    if (!selectedNodeCommand) {
      return;
    }
    setNodeWorkbenchError("");
    setSubmittingExecutionFeedback(true);
    try {
      const response = await fetch(
        `${apiBase}/commands/nodes/${nodeWorkbenchNodeId}/commands/${selectedNodeCommand.commandId}/execution-feedback`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-node-id": nodeWorkbenchNodeId
          },
          body: JSON.stringify({
            executionStatus,
            exceptionNote: executionExceptionNote
          })
        }
      );
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setNodeWorkbenchError(payload.message ?? "failed to submit execution feedback");
        return;
      }
      const payload = (await response.json()) as GetNodeCommandDetailResponse;
      setSelectedNodeCommand(payload.command);
      await loadNodeCommands();
    } catch {
      setNodeWorkbenchError("network error while submitting execution feedback");
    } finally {
      setSubmittingExecutionFeedback(false);
    }
  };

  const aggregateFeedback = async () => {
    if (!selectedNodeCommand) {
      return;
    }
    setNodeWorkbenchError("");
    setAggregatingFeedback(true);
    try {
      const response = await fetch(
        `${apiBase}/commands/nodes/${nodeWorkbenchNodeId}/commands/${selectedNodeCommand.commandId}/feedback-aggregation`,
        {
          method: "POST",
          headers: {
            "x-node-id": nodeWorkbenchNodeId
          }
        }
      );
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setNodeWorkbenchError(payload.message ?? "failed to aggregate feedback");
        return;
      }
      const payload = (await response.json()) as {
        summary: {
          commandId: string;
          fromNodeId: string;
          completedCount: number;
          notCompletedCount: number;
          exceptionCount: number;
          pendingCount: number;
          pendingNodeIds: string[];
          aggregatedAt: string;
        };
      };
      setFeedbackSummary(payload.summary);
    } catch {
      setNodeWorkbenchError("network error while aggregating feedback");
    } finally {
      setAggregatingFeedback(false);
    }
  };

  const triggerTimeoutScan = async () => {
    await fetch(`${apiBase}/commands/monitor/timeouts/scan`, {
      method: "POST"
    });
    await loadTimeoutAlerts();
  };

  const loadTimeoutAlerts = async () => {
    const response = await fetch(`${apiBase}/commands/alerts/timeouts`);
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      alerts: {
        commandId: string;
        nodeId: string;
        timeoutType: string;
        detectedAt: string;
        elapsedSeconds: number;
        lastEventAt: string;
      }[];
    };
    setTimeoutAlerts(payload.alerts);
  };

  const loadExceptionDetail = useCallback(async (commandId: string, nodeId: string) => {
    const response = await fetch(`${apiBase}/commands/alerts/timeouts/${commandId}/${nodeId}`);
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      detail: {
        commandId: string;
        nodeId: string;
        currentStatus: string;
        lastEventAt: string;
        recentError: string;
      };
    };
    setExceptionDetail(payload.detail);
  }, [apiBase]);

  const focusAnomalyByIndex = useCallback(
    async (index: number, openDetail: boolean) => {
      if (!selectedCommand || anomalyChainNodes.length === 0) {
        return;
      }
      const normalizedIndex = (index + anomalyChainNodes.length) % anomalyChainNodes.length;
      const target = anomalyChainNodes[normalizedIndex];
      setFocusedAnomalyIndex(normalizedIndex);
      setFocusedChainNodeId(target.nodeId);
      if (openDetail) {
        await loadExceptionDetail(selectedCommand.commandId, target.nodeId);
      }
    },
    [anomalyChainNodes, loadExceptionDetail, selectedCommand]
  );

  const onChainKeyboardNavigate = async (event: KeyboardEvent<HTMLDivElement>) => {
    if (anomalyChainNodes.length === 0) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      await focusAnomalyByIndex(focusedAnomalyIndex + 1, false);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      await focusAnomalyByIndex(focusedAnomalyIndex - 1, false);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      await focusAnomalyByIndex(focusedAnomalyIndex, true);
    }
  };

  const queryTimeline = async (preset?: {
    commandId?: string;
    nodeId?: string;
    eventType?: string;
    from?: string;
    to?: string;
  }) => {
    const commandId = preset?.commandId ?? timelineCommandId;
    const nodeId = preset?.nodeId ?? timelineNodeId;
    const eventType = preset?.eventType ?? timelineEventType;
    const from = preset?.from ?? timelineFrom;
    const to = preset?.to ?? timelineTo;
    const params = new URLSearchParams();
    if (commandId) {
      params.set("commandId", commandId);
    }
    if (nodeId) {
      params.set("nodeId", nodeId);
    }
    if (eventType) {
      params.set("eventType", eventType);
    }
    if (from) {
      params.set("from", from);
    }
    if (to) {
      params.set("to", to);
    }

    const response = await fetch(`${apiBase}/commands/audit/timeline?${params.toString()}`);
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      events: {
        eventId: string;
        commandId: string;
        nodeId: string;
        eventType: string;
        eventSequence: number;
        timestamp: string;
      }[];
    };
    setTimelineEvents(payload.events);
  };

  const jumpExceptionToTimeline = async () => {
    if (!exceptionDetail) {
      return;
    }
    const eventType = exceptionDetail.recentError === "N/A" ? "" : "TimeoutDetected";
    setTimelineCommandId(exceptionDetail.commandId);
    setTimelineNodeId(exceptionDetail.nodeId);
    setTimelineEventType(eventType);
    setTimelineFrom("");
    setTimelineTo("");
    await queryTimeline({
      commandId: exceptionDetail.commandId,
      nodeId: exceptionDetail.nodeId,
      eventType,
      from: "",
      to: ""
    });
    timelineSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const loadOperationsHealthPanel = async () => {
    const params = new URLSearchParams();
    if (operationsSeverity !== "ALL") {
      params.set("severity", operationsSeverity);
    }
    const queryString = params.toString();
    const endpoint = queryString
      ? `${apiBase}/commands/operations/health?${queryString}`
      : `${apiBase}/commands/operations/health`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      panel: {
        updatedAt: string;
        activeChains: number;
        anomalyNodeCount: number;
        realtimeAlertCount: number;
        alerts: {
          commandId: string;
          nodeId: string;
          timeoutType: string;
          severity: "CRITICAL" | "HIGH" | "MEDIUM";
          detectedAt: string;
          elapsedSeconds: number;
          lastEventAt: string;
        }[];
      };
    };
    setOperationsPanel(payload.panel);
  };

  const jumpToAlertTarget = async (commandId: string, nodeId: string) => {
    setQueryId(commandId);
    await loadCommandDetail(commandId);
    await loadExceptionDetail(commandId, nodeId);
  };

  const updateNodeConfig = async () => {
    setManageMessage("");
    const response = await fetch(`${apiBase}/commands/nodes/${manageNodeId}/config`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-operator-role": operatorRole
      },
      body: JSON.stringify({
        nodeName: manageNodeName || undefined,
        roleType: manageRoleType,
        parentNodeId: manageParentNodeId || undefined,
        chainPosition: manageChainPosition || undefined,
        active: manageActive
      })
    });
    if (!response.ok) {
      const payload = (await response.json()) as { message?: string };
      setManageMessage(`配置更新失败: ${payload.message ?? "request failed"}`);
      return;
    }
    const payload = (await response.json()) as {
      node: {
        nodeId: string;
        nodeName: string;
        roleType: "CAPTAIN" | "MEMBER" | "EXTERNAL";
        parentNodeId?: string;
        chainPosition?: string;
        active: boolean;
      };
    };
    setManageMessage(`配置更新成功: ${payload.node.nodeId} / ${payload.node.nodeName}`);
  };

  const loadNodeDiagnostics = async () => {
    setManageMessage("");
    const response = await fetch(`${apiBase}/commands/nodes/${manageNodeId}/diagnostics`, {
      headers: {
        "x-operator-role": operatorRole
      }
    });
    if (!response.ok) {
      const payload = (await response.json()) as { message?: string };
      setManageMessage(`诊断查询失败: ${payload.message ?? "request failed"}`);
      return;
    }
    const payload = (await response.json()) as {
      diagnostics: {
        node: {
          nodeId: string;
          nodeName: string;
          roleType: string;
          parentNodeId?: string;
          chainPosition?: string;
          active: boolean;
          connectionStatus: string;
          lastSeenAt: string;
          updatedAt: string;
        };
        recentEvents: { eventId: string; eventType: string; timestamp: string; commandId: string }[];
        recentErrors: string[];
        activeAlerts: { timeoutType: string; severity: string; detectedAt: string }[];
      };
    };
    setNodeDiagnostics(payload.diagnostics);
    setManageNodeName(payload.diagnostics.node.nodeName);
    setManageRoleType(payload.diagnostics.node.roleType as "CAPTAIN" | "MEMBER" | "EXTERNAL");
    setManageParentNodeId(payload.diagnostics.node.parentNodeId ?? "");
    setManageChainPosition(payload.diagnostics.node.chainPosition ?? "");
    setManageActive(payload.diagnostics.node.active);
  };

  const triggerRecovery = async () => {
    setManageMessage("");
    const response = await fetch(`${apiBase}/commands/nodes/${manageNodeId}/recovery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-operator-role": operatorRole
      },
      body: JSON.stringify({
        reason: "manual recovery from console"
      })
    });
    if (!response.ok) {
      const payload = (await response.json()) as { message?: string };
      setManageMessage(`恢复触发失败: ${payload.message ?? "request failed"}`);
      return;
    }
    const payload = (await response.json()) as {
      nodeId: string;
      recoveryStatus: string;
      triggeredAt: string;
      eventType: string;
    };
    setRecoveryResult(payload);
    setManageMessage(`恢复已触发: ${payload.nodeId}`);
  };

  const createExternalCommand = async () => {
    setExternalCreateError("");
    setExternalCreateResult(null);
    const response = await fetch(`${apiBase}/api/external/commands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-external-token": externalToken,
        "Idempotency-Key": externalIdempotencyKey
      },
      body: JSON.stringify({
        externalSystemId,
        content: form.content || "外部指令：全队待命",
        targetNode: form.targetNode || "队长A",
        executionRequirement: form.executionRequirement || "立即执行",
        feedbackRequirement: form.feedbackRequirement || "30秒反馈"
      })
    });
    if (!response.ok) {
      const payload = (await response.json()) as { message?: string };
      setExternalCreateError(payload.message ?? "external create failed");
      return;
    }
    const payload = (await response.json()) as {
      command: CommandRecord;
      idempotencyKey: string;
      replayed: boolean;
    };
    setExternalCreateResult({
      commandId: payload.command.commandId,
      status: payload.command.status,
      issuerId: payload.command.issuerId,
      idempotencyKey: payload.idempotencyKey,
      replayed: payload.replayed
    });
    await loadCommands();
  };

  const loadExternalEvents = async () => {
    const params = new URLSearchParams();
    if (externalEventsCommandId.trim()) {
      params.set("commandId", externalEventsCommandId.trim());
    }
    params.set("order", externalEventsOrder);
    const endpoint = params.toString()
      ? `${apiBase}/api/external/events?${params.toString()}`
      : `${apiBase}/api/external/events`;
    const response = await fetch(endpoint, {
      headers: {
        "x-external-token": externalToken
      }
    });
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      events: { commandId: string; eventType: string; eventSequence: number; timestamp: string }[];
    };
    setExternalEvents(payload.events);
  };

  const registerExternalCallback = async () => {
    const response = await fetch(`${apiBase}/api/external/callbacks/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-external-token": externalToken
      },
      body: JSON.stringify({
        externalSystemId,
        callbackUrl,
        signingSecret: callbackSecret
      })
    });
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      subscriptionId: string;
      externalSystemId: string;
      callbackUrl: string;
      registeredAt: string;
    };
    setCallbackRegistration(payload);
  };

  const loadCallbackDeliveries = async () => {
    const params = new URLSearchParams();
    if (externalEventsCommandId.trim()) {
      params.set("commandId", externalEventsCommandId.trim());
    }
    const endpoint = params.toString()
      ? `${apiBase}/api/external/callbacks/deliveries?${params.toString()}`
      : `${apiBase}/api/external/callbacks/deliveries`;
    const response = await fetch(endpoint, {
      headers: {
        "x-external-token": externalToken
      }
    });
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      deliveries: {
        deliveryId: string;
        commandId: string;
        eventType: string;
        eventSequence: number;
        signatureHeader: string;
        signatureValue: string;
        timestamp: string;
        attempts: number;
        maxAttempts: 3;
        status: "SUCCESS" | "FAILED";
        lastError?: string;
      }[];
    };
    setCallbackDeliveries(payload.deliveries);
  };

  useEffect(() => {
    void loadCommands();
  }, [loadCommands]);

  useEffect(() => {
    void hydrateRealtimeSnapshot();
    const eventSource = new EventSource(`${apiBase}/commands/realtime/stream`);
    eventSource.onopen = () => {
      setRealtimeConnected(true);
      void loadCommands();
      if (selectedCommand?.commandId) {
        void loadCommandDetail(selectedCommand.commandId);
      }
    };
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          commandId: string;
          eventType: string;
          eventSequence: number;
          timestamp: string;
        };
        applyRealtimeEvent(data);
      } catch {
        // ignore malformed event
      }
    };
    eventSource.onerror = () => {
      setRealtimeConnected(false);
    };
    return () => {
      eventSource.close();
      setRealtimeConnected(false);
    };
  }, [
    apiBase,
    applyRealtimeEvent,
    hydrateRealtimeSnapshot,
    loadCommandDetail,
    loadCommands,
    selectedCommand?.commandId
  ]);

  useEffect(() => {
    if (realtimeConnected) {
      return;
    }
    const timer = setInterval(() => {
      void loadCommands();
      if (selectedCommand?.commandId) {
        void loadCommandDetail(selectedCommand.commandId);
      }
      void hydrateRealtimeSnapshot();
    }, 1000);
    return () => clearInterval(timer);
  }, [hydrateRealtimeSnapshot, loadCommandDetail, loadCommands, realtimeConnected, selectedCommand?.commandId]);

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24, maxWidth: 720 }}>
      <h1>Command Neural System Console</h1>
      <p>Create structured command draft (Story 1.2)</p>

      <form onSubmit={onSubmit} noValidate>
        <Field
          id="content"
          label="指令内容"
          value={form.content}
          onChange={(value) => setForm((prev) => ({ ...prev, content: value }))}
          error={errors.content}
        />
        <Field
          id="targetNode"
          label="目标节点"
          value={form.targetNode}
          onChange={(value) => setForm((prev) => ({ ...prev, targetNode: value }))}
          error={errors.targetNode}
        />
        <Field
          id="executionRequirement"
          label="执行要求"
          value={form.executionRequirement}
          onChange={(value) => setForm((prev) => ({ ...prev, executionRequirement: value }))}
          error={errors.executionRequirement}
        />
        <Field
          id="feedbackRequirement"
          label="反馈要求"
          value={form.feedbackRequirement}
          onChange={(value) => setForm((prev) => ({ ...prev, feedbackRequirement: value }))}
          error={errors.feedbackRequirement}
        />

        <button type="submit" disabled={saving}>
          {saving ? "提交中..." : "创建草稿"}
        </button>
      </form>

      {submitError ? (
        <p role="alert" style={{ color: "#b42318", marginTop: 16 }}>
          失败：{submitError}
        </p>
      ) : null}

      {draft ? (
        <section style={{ marginTop: 16 }}>
          <h2>草稿创建成功</h2>
          <p>Draft ID: {draft.draftId}</p>
          <p>Status: {draft.status}</p>
          <p>Created At: {draft.createdAt}</p>
          <div style={{ marginTop: 12 }}>
            <label htmlFor="issuerId" style={{ display: "block", marginBottom: 4 }}>
              发令者（issuerId）
            </label>
            <input
              id="issuerId"
              name="issuerId"
              value={issuerId}
              onChange={(event) => setIssuerId(event.target.value)}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={onIssue} disabled={issuing}>
              {issuing ? "发令中..." : "发令并生成 CommandID"}
            </button>
          </div>
          {issueError ? (
            <p role="alert" style={{ color: "#b42318", marginTop: 8 }}>
              发令失败：{issueError}
            </p>
          ) : null}
        </section>
      ) : null}

      {command ? (
        <section style={{ marginTop: 16 }}>
          <h2>发令成功</h2>
          <p>Command ID: {command.commandId}</p>
          <p>Issuer ID: {command.issuerId}</p>
          <p>Created At: {command.createdAt}</p>
          <p>Status: {command.status}</p>
          <div style={{ marginTop: 12 }}>
            <label htmlFor="rootNodeId" style={{ display: "block", marginBottom: 4 }}>
              首节点（队长）
            </label>
            <select
              id="rootNodeId"
              name="rootNodeId"
              value={rootNodeId}
              onChange={(event) => setRootNodeId(event.target.value)}
            >
              <option value="">请选择首节点</option>
              {rootNodes.map((node) => (
                <option key={node.nodeId} value={node.nodeId} disabled={!node.available}>
                  {node.nodeName} ({node.nodeId}) {node.available ? "" : "- 不可用"}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={onBindRootNode} disabled={bindingRootNode}>
              {bindingRootNode ? "绑定中..." : "确认首节点并建立链路起点"}
            </button>
          </div>
          {rootNodeError ? (
            <p role="alert" style={{ color: "#b42318", marginTop: 8 }}>
              绑定失败：{rootNodeError}
            </p>
          ) : null}
        </section>
      ) : null}

      {bindResult ? (
        <section style={{ marginTop: 16 }}>
          <h2>首节点绑定成功</h2>
          <p>Command Status: {bindResult.command.status}</p>
          <p>Root Node: {bindResult.command.rootNodeId}</p>
          <p>Dispatched At: {bindResult.command.dispatchedAt}</p>
          <p>
            Chain Start: {bindResult.chainStart.fromNodeId} -&gt; {bindResult.chainStart.toNodeId}
          </p>
          <p>
            Audit: {bindResult.auditEvent.eventType} ({bindResult.auditEvent.eventId})
          </p>
        </section>
      ) : null}

      <section style={{ marginTop: 24 }}>
        <h2>外部系统写入（Story 6.1）</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <label htmlFor="externalToken">x-external-token</label>
          <input
            id="externalToken"
            value={externalToken}
            onChange={(event) => setExternalToken(event.target.value)}
            style={{ width: 220 }}
          />
          <label htmlFor="externalSystemId">externalSystemId</label>
          <input
            id="externalSystemId"
            value={externalSystemId}
            onChange={(event) => setExternalSystemId(event.target.value)}
            style={{ width: 180 }}
          />
          <label htmlFor="externalIdempotencyKey">Idempotency-Key</label>
          <input
            id="externalIdempotencyKey"
            value={externalIdempotencyKey}
            onChange={(event) => setExternalIdempotencyKey(event.target.value)}
            style={{ width: 180 }}
          />
          <button type="button" onClick={createExternalCommand}>
            外部 API 创建指令
          </button>
        </div>
        {externalCreateError ? (
          <p role="alert" style={{ color: "#b42318" }}>
            外部写入失败：{externalCreateError}
          </p>
        ) : null}
        {externalCreateResult ? (
          <p>
            创建成功：{externalCreateResult.commandId} | {externalCreateResult.status} | issuer:{" "}
            {externalCreateResult.issuerId} | key: {externalCreateResult.idempotencyKey} | replayed:{" "}
            {String(externalCreateResult.replayed)}
          </p>
        ) : null}
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <input
            placeholder="按 commandId 过滤事件（可选）"
            value={externalEventsCommandId}
            onChange={(event) => setExternalEventsCommandId(event.target.value)}
            style={{ width: 240 }}
          />
          <select
            value={externalEventsOrder}
            onChange={(event) => setExternalEventsOrder(event.target.value as "asc" | "desc")}
          >
            <option value="desc">desc</option>
            <option value="asc">asc</option>
          </select>
          <button type="button" onClick={loadExternalEvents}>
            查询外部事件
          </button>
          <button type="button" onClick={loadCallbackDeliveries}>
            查询回调投递
          </button>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <input
            placeholder="callbackUrl"
            value={callbackUrl}
            onChange={(event) => setCallbackUrl(event.target.value)}
            style={{ width: 280 }}
          />
          <input
            placeholder="signingSecret"
            value={callbackSecret}
            onChange={(event) => setCallbackSecret(event.target.value)}
            style={{ width: 220 }}
          />
          <button type="button" onClick={registerExternalCallback}>
            注册回调订阅
          </button>
        </div>
        {callbackRegistration ? (
          <p>
            已注册订阅：{callbackRegistration.subscriptionId} | {callbackRegistration.callbackUrl}
          </p>
        ) : null}
        <ul>
          {externalEvents.map((event) => (
            <li key={`${event.commandId}-${event.eventSequence}-${event.timestamp}`}>
              {event.timestamp} | {event.commandId} | {event.eventType} | seq:{event.eventSequence}
            </li>
          ))}
        </ul>
        <ul>
          {callbackDeliveries.map((delivery) => (
            <li key={delivery.deliveryId}>
              {delivery.timestamp} | {delivery.commandId} | {delivery.eventType} | seq:
              {delivery.eventSequence} | retry: {delivery.attempts}/{delivery.maxAttempts} |{" "}
              {delivery.status}
              {delivery.lastError ? ` | ${delivery.lastError}` : ""} | {delivery.signatureHeader}:{" "}
              {delivery.signatureValue}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>已发指令状态面板</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <button type="button" onClick={loadCommands}>
            刷新指令列表
          </button>
          <label htmlFor="queryId">CommandID 检索</label>
          <input
            id="queryId"
            value={queryId}
            onChange={(event) => setQueryId(event.target.value)}
            placeholder="输入 CMD-..."
          />
          <label htmlFor="statusFilter">状态筛选</label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {statusFilterOptions.map((status) => (
              <option key={status} value={status}>
                {status === "ALL" ? "全部" : status}
              </option>
            ))}
          </select>
        </div>
        <ul>
          {filteredCommands.map((item) => (
            <li key={item.commandId} style={{ marginBottom: 8 }}>
              <strong>{item.commandId}</strong> - <StatusBadge status={item.status} /> - issuer:{" "}
              {item.issuerId}
              <button
                type="button"
                style={{ marginLeft: 8 }}
                onClick={() => loadCommandDetail(item.commandId)}
              >
                查看详情
              </button>
            </li>
          ))}
        </ul>
        {selectedCommand ? (
          <div style={{ marginTop: 12 }}>
            <h3>指令详情</h3>
            <p>CommandID: {selectedCommand.commandId}</p>
            <p>
              Status: <StatusBadge status={selectedCommand.status} />
            </p>
            <p>Issuer: {selectedCommand.issuerId}</p>
            <p>Root Node: {selectedCommand.rootNodeId ?? "-"}</p>
            <p>Created At: {selectedCommand.createdAt}</p>
            <p>Dispatched At: {selectedCommand.dispatchedAt ?? "-"}</p>
            <p>Closed At: {selectedCommand.closedAt ?? "-"}</p>
            <button type="button" onClick={loadCommandChain}>
              查看链路全景
            </button>
            <button type="button" onClick={evaluateClosure}>
              判定闭环
            </button>
            {closureResult ? (
              <div style={{ marginTop: 8 }}>
                <p>isClosed: {String(closureResult.isClosed)}</p>
                <p>status: {closureResult.status}</p>
                <p>unmet: {closureResult.unmetConditions.join(" | ") || "-"}</p>
                <p>evaluatedAt: {closureResult.evaluatedAt}</p>
              </div>
            ) : null}
            {commandChainView ? (
              <div style={{ marginTop: 8 }} tabIndex={0} onKeyDown={onChainKeyboardNavigate}>
                <p>
                  progress: {commandChainView.progress.completedNodes}/
                  {commandChainView.progress.totalNodes}
                </p>
                <p>键盘导航: ↑/↓ 切换异常节点，Enter 打开异常详情。</p>
                <h5>异常链路段快速定位</h5>
                {anomalyChainNodes.length > 0 ? (
                  <ul>
                    {anomalyChainNodes.map((node, index) => (
                        <li key={`alert-${node.nodeId}-${node.arrivedAt}`}>
                          <button
                            type="button"
                            onClick={async () => {
                              setFocusedAnomalyIndex(index);
                              setFocusedChainNodeId(node.nodeId);
                              if (selectedCommand) {
                                await loadExceptionDetail(selectedCommand.commandId, node.nodeId);
                              }
                            }}
                            aria-label={`定位异常节点 ${node.nodeId}`}
                          >
                            ⚠ 定位并查看 {node.sourceNodeId} -&gt; {node.nodeId}
                          </button>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p>无异常链路段</p>
                )}
                <ul>
                  {commandChainView.nodes.map((node) => (
                    <li
                      key={`${node.sourceNodeId}-${node.nodeId}-${node.arrivedAt}`}
                      style={
                        node.nodeStatus === "ANOMALY_TIMEOUT"
                          ? {
                              border: "1px solid #b42318",
                              background: "#fef3f2",
                              padding: 6
                            }
                          : undefined
                      }
                    >
                      <span
                        style={focusedChainNodeId === node.nodeId ? { outline: "2px solid #1d4ed8" } : undefined}
                      >
                        {node.sourceNodeId} -&gt; {node.nodeId} |{" "}
                        {node.nodeStatus === "ANOMALY_TIMEOUT" ? "⚠ 异常超时" : node.nodeStatus} |{" "}
                        {node.arrivedAt}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div style={{ marginTop: 12 }}>
              <h4>发起下一轮指令</h4>
              <div style={{ marginBottom: 6 }}>
                <label htmlFor="nextRoundIssuerId">issuerId</label>
                <input
                  id="nextRoundIssuerId"
                  value={nextRoundIssuerId}
                  onChange={(event) => setNextRoundIssuerId(event.target.value)}
                  style={{ marginLeft: 8 }}
                />
              </div>
              <div style={{ marginBottom: 6 }}>
                <label htmlFor="nextRoundContent">content override</label>
                <input
                  id="nextRoundContent"
                  value={nextRoundContent}
                  onChange={(event) => setNextRoundContent(event.target.value)}
                  style={{ marginLeft: 8, width: 320 }}
                />
              </div>
              <div style={{ marginBottom: 6 }}>
                <label htmlFor="nextRoundTargetNode">targetNode override</label>
                <input
                  id="nextRoundTargetNode"
                  value={nextRoundTargetNode}
                  onChange={(event) => setNextRoundTargetNode(event.target.value)}
                  style={{ marginLeft: 8, width: 260 }}
                />
              </div>
              <div style={{ marginBottom: 6 }}>
                <label htmlFor="nextRoundExecutionRequirement">executionRequirement override</label>
                <input
                  id="nextRoundExecutionRequirement"
                  value={nextRoundExecutionRequirement}
                  onChange={(event) => setNextRoundExecutionRequirement(event.target.value)}
                  style={{ marginLeft: 8, width: 260 }}
                />
              </div>
              <div style={{ marginBottom: 6 }}>
                <label htmlFor="nextRoundFeedbackRequirement">feedbackRequirement override</label>
                <input
                  id="nextRoundFeedbackRequirement"
                  value={nextRoundFeedbackRequirement}
                  onChange={(event) => setNextRoundFeedbackRequirement(event.target.value)}
                  style={{ marginLeft: 8, width: 260 }}
                />
              </div>
              <button type="button" onClick={createNextRound} disabled={creatingNextRound}>
                {creatingNextRound ? "创建中..." : "基于当前指令发起下一轮"}
              </button>
              {nextRoundResult ? (
                <div style={{ marginTop: 8 }}>
                  <p>new command: {nextRoundResult.command.commandId}</p>
                  <p>previous command: {nextRoundResult.command.previousCommandId}</p>
                  <p>inherited: {nextRoundResult.inheritedFields.join(", ")}</p>
                  <p>overridable: {nextRoundResult.overridableFields.join(", ")}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>节点工作台（Story 2.1）</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <label htmlFor="nodeWorkbenchNodeId">当前节点</label>
          <select
            id="nodeWorkbenchNodeId"
            value={nodeWorkbenchNodeId}
            onChange={(event) => setNodeWorkbenchNodeId(event.target.value)}
          >
            <option value="captain-A">队长A (captain-A)</option>
            <option value="captain-B">队长B (captain-B)</option>
            <option value="captain-C">队长C (captain-C)</option>
          </select>
          <button type="button" onClick={loadNodeCommands}>
            加载待处理指令
          </button>
        </div>
        {nodeWorkbenchError ? (
          <p role="alert" style={{ color: "#b42318" }}>
            节点访问失败：{nodeWorkbenchError}
          </p>
        ) : null}
        <ul>
          {nodeCommands.map((item) => (
            <li key={`${item.nodeId}:${item.commandId}`} style={{ marginBottom: 8 }}>
              <strong>{item.commandId}</strong> - {item.nodeStatus} - from {item.sourceNodeId}
              <button
                type="button"
                style={{ marginLeft: 8 }}
                onClick={() => loadNodeCommandDetail(item.commandId)}
              >
                查看结构化详情
              </button>
            </li>
          ))}
        </ul>
        {selectedNodeCommand ? (
          <div style={{ marginTop: 12 }}>
            <h3>节点指令详情</h3>
            <p>Node: {selectedNodeCommand.nodeId}</p>
            <p>Status: {selectedNodeCommand.nodeStatus}</p>
            <p>Arrived At: {selectedNodeCommand.arrivedAt}</p>
            <p>指令内容: {selectedNodeCommand.content}</p>
            <p>目标节点: {selectedNodeCommand.targetNode}</p>
            <p>执行要求: {selectedNodeCommand.executionRequirement}</p>
            <p>反馈要求: {selectedNodeCommand.feedbackRequirement}</p>
            <p>理解状态: {selectedNodeCommand.understandingStatus ?? "-"}</p>
            <p>澄清问题: {selectedNodeCommand.understandingQuestion ?? "-"}</p>
            <p>回执时间: {selectedNodeCommand.understoodAt ?? "-"}</p>
            <p>执行状态: {selectedNodeCommand.executionStatus ?? "-"}</p>
            <p>异常说明: {selectedNodeCommand.executionExceptionNote ?? "-"}</p>
            <p>执行反馈时间: {selectedNodeCommand.executionCompletedAt ?? "-"}</p>
            <div style={{ marginTop: 12 }}>
              <label htmlFor="understandingStatus">理解回执</label>
              <select
                id="understandingStatus"
                value={understandingStatus}
                onChange={(event) =>
                  setUnderstandingStatus(
                    event.target.value as "UNDERSTOOD" | "NEED_CLARIFICATION"
                  )
                }
                style={{ marginLeft: 8 }}
              >
                <option value="UNDERSTOOD">UNDERSTOOD</option>
                <option value="NEED_CLARIFICATION">NEED_CLARIFICATION</option>
              </select>
            </div>
            <div style={{ marginTop: 8 }}>
              <label htmlFor="understandingQuestion">疑问说明（可选）</label>
              <input
                id="understandingQuestion"
                value={understandingQuestion}
                onChange={(event) => setUnderstandingQuestion(event.target.value)}
                style={{ marginLeft: 8, width: 320 }}
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={submitUnderstandingReceipt} disabled={submittingReceipt}>
                {submittingReceipt ? "提交中..." : "提交理解回执"}
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <h4>下行传导</h4>
              {downstreamCandidates.length === 0 ? (
                <p>先提交理解回执后加载下游候选</p>
              ) : (
                <div>
                  {downstreamCandidates.map((nodeId) => (
                    <label key={nodeId} style={{ display: "block" }}>
                      <input
                        type="checkbox"
                        checked={selectedPropagationTargets.includes(nodeId)}
                        onChange={() => togglePropagationTarget(nodeId)}
                      />{" "}
                      {nodeId}
                    </label>
                  ))}
                  <button type="button" onClick={submitPropagation} disabled={propagating}>
                    {propagating ? "传导中..." : "提交下行传导"}
                  </button>
                </div>
              )}
              {propagationResult ? (
                <div style={{ marginTop: 8 }}>
                  <p>已传导节点: {propagationResult.propagated.map((p) => p.toNodeId).join(", ") || "-"}</p>
                  <p>无效目标: {propagationResult.invalidTargets.join(", ") || "-"}</p>
                </div>
              ) : null}
            </div>
            <div style={{ marginTop: 12 }}>
              <h4>末梢执行反馈</h4>
              <label htmlFor="executionStatus">执行结果</label>
              <select
                id="executionStatus"
                value={executionStatus}
                onChange={(event) =>
                  setExecutionStatus(
                    event.target.value as "COMPLETED" | "NOT_COMPLETED" | "EXCEPTION"
                  )
                }
                style={{ marginLeft: 8 }}
              >
                <option value="COMPLETED">COMPLETED</option>
                <option value="NOT_COMPLETED">NOT_COMPLETED</option>
                <option value="EXCEPTION">EXCEPTION</option>
              </select>
              <div style={{ marginTop: 8 }}>
                <label htmlFor="executionExceptionNote">异常说明（可选）</label>
                <input
                  id="executionExceptionNote"
                  value={executionExceptionNote}
                  onChange={(event) => setExecutionExceptionNote(event.target.value)}
                  style={{ marginLeft: 8, width: 320 }}
                />
              </div>
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={submitExecutionFeedback}
                  disabled={submittingExecutionFeedback}
                >
                  {submittingExecutionFeedback ? "提交中..." : "提交执行反馈"}
                </button>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <h4>队长反馈聚合回传</h4>
              <button type="button" onClick={aggregateFeedback} disabled={aggregatingFeedback}>
                {aggregatingFeedback ? "聚合中..." : "聚合下游反馈并回传"}
              </button>
              {feedbackSummary ? (
                <div style={{ marginTop: 8 }}>
                  <p>completed: {feedbackSummary.completedCount}</p>
                  <p>not completed: {feedbackSummary.notCompletedCount}</p>
                  <p>exception: {feedbackSummary.exceptionCount}</p>
                  <p>pending: {feedbackSummary.pendingCount}</p>
                  <p>pending nodes: {feedbackSummary.pendingNodeIds.join(", ") || "-"}</p>
                  <p>aggregated at: {feedbackSummary.aggregatedAt}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>节点配置与诊断恢复（Story 5.4）</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <label htmlFor="operatorRole">操作角色</label>
          <select
            id="operatorRole"
            value={operatorRole}
            onChange={(event) => setOperatorRole(event.target.value as "GUANNING" | "BIANQUE" | "SUNWU")}
          >
            <option value="GUANNING">GUANNING</option>
            <option value="BIANQUE">BIANQUE</option>
            <option value="SUNWU">SUNWU</option>
          </select>
          <label htmlFor="manageNodeId">节点ID</label>
          <input
            id="manageNodeId"
            value={manageNodeId}
            onChange={(event) => setManageNodeId(event.target.value)}
          />
          <button type="button" onClick={loadNodeDiagnostics}>
            加载诊断
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input
            placeholder="节点名称"
            value={manageNodeName}
            onChange={(event) => setManageNodeName(event.target.value)}
          />
          <select
            value={manageRoleType}
            onChange={(event) => setManageRoleType(event.target.value as "CAPTAIN" | "MEMBER" | "EXTERNAL")}
          >
            <option value="CAPTAIN">CAPTAIN</option>
            <option value="MEMBER">MEMBER</option>
            <option value="EXTERNAL">EXTERNAL</option>
          </select>
          <input
            placeholder="parentNodeId"
            value={manageParentNodeId}
            onChange={(event) => setManageParentNodeId(event.target.value)}
          />
          <input
            placeholder="chainPosition"
            value={manageChainPosition}
            onChange={(event) => setManageChainPosition(event.target.value)}
          />
        </div>
        <label>
          <input
            type="checkbox"
            checked={manageActive}
            onChange={(event) => setManageActive(event.target.checked)}
          />{" "}
          active
        </label>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button type="button" onClick={updateNodeConfig}>
            保存节点配置
          </button>
          <button type="button" onClick={triggerRecovery}>
            触发恢复动作
          </button>
        </div>
        {manageMessage ? <p>{manageMessage}</p> : null}
        {nodeDiagnostics ? (
          <div style={{ marginTop: 8 }}>
            <p>
              连接状态: {nodeDiagnostics.node.connectionStatus} | 更新时间: {nodeDiagnostics.node.updatedAt}
            </p>
            <p>最近错误: {nodeDiagnostics.recentErrors.join(" | ") || "无"}</p>
            <ul>
              {nodeDiagnostics.recentEvents.map((event) => (
                <li key={event.eventId}>
                  {event.timestamp} | {event.commandId} | {event.eventType}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {recoveryResult ? (
          <p>
            Recovery: {recoveryResult.nodeId} | {recoveryResult.recoveryStatus} |{" "}
            {recoveryResult.triggeredAt}
          </p>
        ) : null}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>运行健康面板（Story 5.3）</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <label htmlFor="operationsSeverity">严重级别</label>
          <select
            id="operationsSeverity"
            value={operationsSeverity}
            onChange={(event) =>
              setOperationsSeverity(event.target.value as "ALL" | "CRITICAL" | "HIGH" | "MEDIUM")
            }
          >
            <option value="ALL">ALL</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
          </select>
          <button type="button" onClick={loadOperationsHealthPanel}>
            刷新健康面板
          </button>
        </div>
        {operationsPanel ? (
          <div>
            <p>更新时间: {operationsPanel.updatedAt}</p>
            <p>链路活跃度（active chains）: {operationsPanel.activeChains}</p>
            <p>异常节点数: {operationsPanel.anomalyNodeCount}</p>
            <p>实时告警数: {operationsPanel.realtimeAlertCount}</p>
            <ul>
              {operationsPanel.alerts.map((alert) => (
                <li
                  key={`${alert.commandId}:${alert.nodeId}:${alert.detectedAt}`}
                  style={{
                    marginBottom: 8,
                    borderLeft:
                      alert.severity === "CRITICAL"
                        ? "4px solid #b42318"
                        : alert.severity === "HIGH"
                        ? "4px solid #f79009"
                        : "4px solid #2563eb",
                    paddingLeft: 8
                  }}
                >
                  <strong>{alert.severity}</strong> | {alert.timeoutType} | cmd: {alert.commandId} |
                  node: {alert.nodeId} | {alert.elapsedSeconds}s | {alert.detectedAt}
                  <button
                    type="button"
                    style={{ marginLeft: 8 }}
                    onClick={() => jumpToAlertTarget(alert.commandId, alert.nodeId)}
                  >
                    一键跳转
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p>点击“刷新健康面板”加载链路活跃度和异常总览。</p>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>异常面板（Timeout Watchdog）</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button type="button" onClick={triggerTimeoutScan}>
            触发超时扫描
          </button>
          <button type="button" onClick={loadTimeoutAlerts}>
            刷新异常列表
          </button>
        </div>
        <ul>
          {timeoutAlerts.map((alert) => (
            <li key={`${alert.commandId}:${alert.nodeId}:${alert.timeoutType}`} style={{ marginBottom: 8 }}>
              <strong>{alert.timeoutType}</strong> - cmd: {alert.commandId} - node: {alert.nodeId} -{" "}
              {alert.elapsedSeconds}s - detected: {alert.detectedAt}
              <button
                type="button"
                style={{ marginLeft: 8 }}
                onClick={() => loadExceptionDetail(alert.commandId, alert.nodeId)}
              >
                查看异常节点详情
              </button>
            </li>
          ))}
        </ul>
        {exceptionDetail ? (
          <div style={{ marginTop: 8 }}>
            <p>NodeID: {exceptionDetail.nodeId}</p>
            <p>Current Status: {exceptionDetail.currentStatus}</p>
            <p>Last Event At: {exceptionDetail.lastEventAt}</p>
            <p>Recent Error: {exceptionDetail.recentError}</p>
            <button type="button" onClick={jumpExceptionToTimeline}>
              跳转相关时间线
            </button>
          </div>
        ) : null}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>实时事件流（SSE）</h2>
        <p aria-live="polite">
          连接状态: {realtimeConnected ? "已连接" : "未连接/重连中（已启用每秒状态回补）"}
        </p>
        <p>事件应用策略: 同一 Command 按 EventSequence 去重并按序应用。</p>
        <ul>
          {realtimeEvents.map((event) => (
            <li key={`${event.commandId}-${event.eventSequence}-${event.timestamp}`}>
              {event.timestamp} | {event.commandId} | {event.eventType} | seq:{event.eventSequence}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }} ref={timelineSectionRef}>
        <h2>审计时间线检索（Story 5.2）</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input
            placeholder="commandId"
            value={timelineCommandId}
            onChange={(event) => setTimelineCommandId(event.target.value)}
          />
          <input
            placeholder="nodeId"
            value={timelineNodeId}
            onChange={(event) => setTimelineNodeId(event.target.value)}
          />
          <input
            placeholder="eventType"
            value={timelineEventType}
            onChange={(event) => setTimelineEventType(event.target.value)}
          />
          <input
            placeholder="from (ISO timestamp)"
            value={timelineFrom}
            onChange={(event) => setTimelineFrom(event.target.value)}
          />
          <input
            placeholder="to (ISO timestamp)"
            value={timelineTo}
            onChange={(event) => setTimelineTo(event.target.value)}
          />
        </div>
        <button type="button" onClick={() => void queryTimeline()}>
          查询时间线
        </button>
        <ul>
          {timelineEvents.map((event) => (
            <li key={event.eventId}>
              {event.timestamp} | {event.commandId} | {event.nodeId} | {event.eventType} | seq:
              {event.eventSequence}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Field(props: {
  id: FieldName;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const { id, label, value, onChange, error } = props;
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={id} style={{ display: "block", marginBottom: 4 }}>
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        style={{ width: "100%" }}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" style={{ color: "#b42318", marginTop: 4 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = getCommandStatusMeta(status);
  return (
    <span
      aria-label={`状态 ${meta.label}`}
      title={status}
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        border: `1px solid ${meta.color}`,
        color: meta.color,
        fontSize: 12,
        lineHeight: "18px"
      }}
    >
      {meta.icon} {meta.label}
    </span>
  );
}
