import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  NotFoundException,
  Param,
  Post
} from "@nestjs/common";
import type {
  CreateCommandDraftResponse,
  IssueCommandResponse,
  IssueCommandRequest
} from "@command-neural/shared-types";
import { CommandsService } from "./commands.service";
import { validateCreateCommandDraftRequest } from "./commands.validation";

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
}
