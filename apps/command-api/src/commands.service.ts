import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  CommandDraft,
  CommandRecord,
  CreateCommandDraftRequest
} from "@command-neural/shared-types";

@Injectable()
export class CommandsService {
  private readonly drafts: CommandDraft[] = [];
  private readonly commands: CommandRecord[] = [];
  private readonly issuedByDraft = new Map<string, CommandRecord>();
  private readonly idempotencyMap = new Map<string, CommandRecord>();

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
    return draft;
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
    return created;
  }
}
