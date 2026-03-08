import type { CreateCommandDraftRequest } from "@command-neural/shared-types";

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
