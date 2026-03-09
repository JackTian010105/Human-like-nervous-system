import type {
  CreateCommandDraftRequest,
  RegisterNodeRequest,
  UpdateNodeConfigRequest
} from "@command-neural/shared-types";

type ValidationErrors = Partial<Record<keyof CreateCommandDraftRequest, string>>;

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateCreateCommandDraftRequest(body: unknown): {
  ok: true;
  value: CreateCommandDraftRequest;
} | {
  ok: false;
  errors: ValidationErrors;
} {
  const candidate = body as Partial<CreateCommandDraftRequest>;
  const errors: ValidationErrors = {};

  if (!isNonEmptyText(candidate?.content)) {
    errors.content = "content is required";
  }
  if (!isNonEmptyText(candidate?.targetNode)) {
    errors.targetNode = "targetNode is required";
  }
  if (!isNonEmptyText(candidate?.executionRequirement)) {
    errors.executionRequirement = "executionRequirement is required";
  }
  if (!isNonEmptyText(candidate?.feedbackRequirement)) {
    errors.feedbackRequirement = "feedbackRequirement is required";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      content: candidate.content!.trim(),
      targetNode: candidate.targetNode!.trim(),
      executionRequirement: candidate.executionRequirement!.trim(),
      feedbackRequirement: candidate.feedbackRequirement!.trim()
    }
  };
}

type NodeConfigValidationErrors = {
  nodeName?: string;
  roleType?: string;
  parentNodeId?: string;
  chainPosition?: string;
  active?: string;
  request?: string;
};

const NODE_ROLE_TYPES = new Set(["CAPTAIN", "MEMBER", "EXTERNAL"]);

export function validateUpdateNodeConfigRequest(body: unknown): {
  ok: true;
  value: UpdateNodeConfigRequest;
} | {
  ok: false;
  errors: NodeConfigValidationErrors;
} {
  const candidate = (body ?? {}) as Record<string, unknown>;
  const errors: NodeConfigValidationErrors = {};
  const value: UpdateNodeConfigRequest = {};

  if (candidate.nodeName !== undefined) {
    if (!isNonEmptyText(candidate.nodeName)) {
      errors.nodeName = "nodeName must be a non-empty string";
    } else {
      value.nodeName = candidate.nodeName.trim();
    }
  }

  if (candidate.roleType !== undefined) {
    if (!isNonEmptyText(candidate.roleType)) {
      errors.roleType = "roleType must be one of CAPTAIN|MEMBER|EXTERNAL";
    } else {
      const normalizedRole = candidate.roleType.trim().toUpperCase();
      if (!NODE_ROLE_TYPES.has(normalizedRole)) {
        errors.roleType = "roleType must be one of CAPTAIN|MEMBER|EXTERNAL";
      } else {
        value.roleType = normalizedRole as UpdateNodeConfigRequest["roleType"];
      }
    }
  }

  if (candidate.parentNodeId !== undefined) {
    if (!isNonEmptyText(candidate.parentNodeId)) {
      errors.parentNodeId = "parentNodeId must be a non-empty string";
    } else {
      value.parentNodeId = candidate.parentNodeId.trim();
    }
  }

  if (candidate.chainPosition !== undefined) {
    if (!isNonEmptyText(candidate.chainPosition)) {
      errors.chainPosition = "chainPosition must be a non-empty string";
    } else {
      value.chainPosition = candidate.chainPosition.trim();
    }
  }

  if (candidate.active !== undefined) {
    if (typeof candidate.active !== "boolean") {
      errors.active = "active must be a boolean";
    } else {
      value.active = candidate.active;
    }
  }

  if (Object.keys(value).length === 0) {
    errors.request = "at least one config field is required";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value };
}

type RegisterNodeValidationErrors = {
  nodeId?: string;
  nodeName?: string;
  roleType?: string;
  parentNodeId?: string;
  chainPosition?: string;
  active?: string;
};

export function validateRegisterNodeRequest(body: unknown): {
  ok: true;
  value: RegisterNodeRequest;
} | {
  ok: false;
  errors: RegisterNodeValidationErrors;
} {
  const candidate = (body ?? {}) as Record<string, unknown>;
  const errors: RegisterNodeValidationErrors = {};

  if (!isNonEmptyText(candidate.nodeId)) {
    errors.nodeId = "nodeId is required";
  }
  if (!isNonEmptyText(candidate.nodeName)) {
    errors.nodeName = "nodeName is required";
  }
  if (!isNonEmptyText(candidate.roleType)) {
    errors.roleType = "roleType is required";
  }

  let normalizedRole: RegisterNodeRequest["roleType"] | undefined;
  if (isNonEmptyText(candidate.roleType)) {
    const role = candidate.roleType.trim().toUpperCase();
    if (!NODE_ROLE_TYPES.has(role)) {
      errors.roleType = "roleType must be one of CAPTAIN|MEMBER|EXTERNAL";
    } else {
      normalizedRole = role as RegisterNodeRequest["roleType"];
    }
  }

  if (candidate.active !== undefined && typeof candidate.active !== "boolean") {
    errors.active = "active must be a boolean";
  }
  if (candidate.parentNodeId !== undefined && !isNonEmptyText(candidate.parentNodeId)) {
    errors.parentNodeId = "parentNodeId must be a non-empty string";
  }
  if (candidate.chainPosition !== undefined && !isNonEmptyText(candidate.chainPosition)) {
    errors.chainPosition = "chainPosition must be a non-empty string";
  }
  if (normalizedRole === "MEMBER" && !isNonEmptyText(candidate.parentNodeId)) {
    errors.parentNodeId = "parentNodeId is required for MEMBER";
  }

  if (Object.keys(errors).length > 0 || !normalizedRole) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      nodeId: String(candidate.nodeId).trim(),
      nodeName: String(candidate.nodeName).trim(),
      roleType: normalizedRole,
      parentNodeId: isNonEmptyText(candidate.parentNodeId) ? candidate.parentNodeId.trim() : undefined,
      chainPosition: isNonEmptyText(candidate.chainPosition) ? candidate.chainPosition.trim() : undefined,
      active: typeof candidate.active === "boolean" ? candidate.active : undefined
    }
  };
}
