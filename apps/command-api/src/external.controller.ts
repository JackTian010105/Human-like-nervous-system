import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  MessageEvent,
  Post,
  Query,
  Sse,
  UnauthorizedException
} from "@nestjs/common";
import { filter, map, Observable } from "rxjs";
import type {
  ExternalEventOrder,
  ExternalCreateCommandRequest,
  ExternalCreateCommandResponse,
  ListCallbackDeliveriesResponse,
  ListExternalEventsResponse,
  RegisterExternalCallbackRequest,
  RegisterExternalCallbackResponse
} from "@command-neural/shared-types";
import { CommandsService } from "./commands.service";
import { validateCreateCommandDraftRequest } from "./commands.validation";

@Controller("api/external")
export class ExternalController {
  constructor(private readonly commandsService: CommandsService) {}

  @Post("commands")
  createExternalCommand(
    @Body() body: ExternalCreateCommandRequest,
    @Headers("x-external-token") externalToken?: string,
    @Headers("idempotency-key") idempotencyKey?: string
  ): ExternalCreateCommandResponse {
    const expected = process.env.EXTERNAL_API_TOKEN ?? "dev-external-token";
    if (!externalToken || externalToken.trim() !== expected) {
      this.commandsService.recordExternalAuthRejected({
        path: "/api/external/commands",
        externalSystemId: body?.externalSystemId,
        reason: "invalid_credential"
      });
      throw new UnauthorizedException({
        message: "Invalid external credential"
      });
    }

    const externalSystemId = body?.externalSystemId?.trim();
    if (!externalSystemId) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: { externalSystemId: "externalSystemId is required" }
      });
    }

    const normalizedIdempotencyKey = idempotencyKey?.trim();
    if (!normalizedIdempotencyKey) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: { idempotencyKey: "Idempotency-Key header is required" }
      });
    }

    const validation = validateCreateCommandDraftRequest({
      content: body.content,
      targetNode: body.targetNode,
      executionRequirement: body.executionRequirement,
      feedbackRequirement: body.feedbackRequirement
    });
    if (!validation.ok) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: validation.errors
      });
    }

    const result = this.commandsService.createExternalCommandWithIdempotency({
      input: {
        externalSystemId,
        ...validation.value,
        issuerId: body.issuerId
      },
      idempotencyKey: normalizedIdempotencyKey
    });
    return {
      command: result.command,
      idempotencyKey: normalizedIdempotencyKey,
      replayed: result.replayed
    };
  }

  @Get("events")
  listExternalEvents(
    @Headers("x-external-token") externalToken?: string,
    @Query("commandId") commandId?: string,
    @Query("order") order?: ExternalEventOrder
  ): ListExternalEventsResponse {
    this.ensureExternalAuth(externalToken);
    const normalizedOrder: ExternalEventOrder =
      order === "asc" || order === "desc" ? order : "desc";
    return {
      events: this.commandsService.listExternalEvents(commandId?.trim() || undefined, normalizedOrder)
    };
  }

  @Sse("events/stream")
  streamExternalEvents(
    @Query("token") token?: string,
    @Query("commandId") commandId?: string
  ): Observable<MessageEvent> {
    this.ensureExternalAuth(token);
    const normalizedCommandId = commandId?.trim() || undefined;
    return this.commandsService.getRealtimeStream().pipe(
      filter((event) => (normalizedCommandId ? event.commandId === normalizedCommandId : true)),
      map((event) => ({ data: event }))
    );
  }

  @Post("callbacks/register")
  registerExternalCallback(
    @Headers("x-external-token") externalToken?: string,
    @Body() body?: RegisterExternalCallbackRequest
  ): RegisterExternalCallbackResponse {
    this.ensureExternalAuth(externalToken);
    const externalSystemId = body?.externalSystemId?.trim();
    const callbackUrl = body?.callbackUrl?.trim();
    const signingSecret = body?.signingSecret?.trim();
    if (!externalSystemId || !callbackUrl || !signingSecret) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: {
          externalSystemId: "externalSystemId is required",
          callbackUrl: "callbackUrl is required",
          signingSecret: "signingSecret is required"
        }
      });
    }
    return this.commandsService.registerExternalCallback({
      externalSystemId,
      callbackUrl,
      signingSecret
    });
  }

  @Get("callbacks/deliveries")
  listCallbackDeliveries(
    @Headers("x-external-token") externalToken?: string,
    @Query("commandId") commandId?: string
  ): ListCallbackDeliveriesResponse {
    this.ensureExternalAuth(externalToken);
    return this.commandsService.listCallbackDeliveries(commandId?.trim() || undefined);
  }

  private ensureExternalAuth(token?: string): void {
    const expected = process.env.EXTERNAL_API_TOKEN ?? "dev-external-token";
    if (!token || token.trim() !== expected) {
      throw new UnauthorizedException({
        message: "Invalid external credential"
      });
    }
  }
}
