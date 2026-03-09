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
  ExternalIntegrationMetricsResponse,
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
    const path = "/api/external/commands";
    const expected = process.env.EXTERNAL_API_TOKEN ?? "dev-external-token";
    if (!externalToken || externalToken.trim() !== expected) {
      this.commandsService.recordExternalAuthRejected({
        path,
        externalSystemId: body?.externalSystemId,
        reason: "invalid_credential"
      });
      this.commandsService.recordExternalApiRequest({ path, status: "UNAUTHORIZED" });
      throw new UnauthorizedException({
        message: "Invalid external credential"
      });
    }

    const externalSystemId = body?.externalSystemId?.trim();
    if (!externalSystemId) {
      this.commandsService.recordExternalApiRequest({ path, status: "BAD_REQUEST" });
      throw new BadRequestException({
        message: "Validation failed",
        errors: { externalSystemId: "externalSystemId is required" }
      });
    }

    const normalizedIdempotencyKey = idempotencyKey?.trim();
    if (!normalizedIdempotencyKey) {
      this.commandsService.recordExternalApiRequest({ path, status: "BAD_REQUEST" });
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
      this.commandsService.recordExternalApiRequest({ path, status: "BAD_REQUEST" });
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
    this.commandsService.recordExternalApiRequest({ path, status: "SUCCESS" });
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
    const path = "/api/external/events";
    this.ensureExternalAuth(externalToken, path);
    const normalizedOrder: ExternalEventOrder =
      order === "asc" || order === "desc" ? order : "desc";
    const response = {
      events: this.commandsService.listExternalEvents(commandId?.trim() || undefined, normalizedOrder)
    };
    this.commandsService.recordExternalApiRequest({ path, status: "SUCCESS" });
    return response;
  }

  @Sse("events/stream")
  streamExternalEvents(
    @Query("token") token?: string,
    @Query("commandId") commandId?: string
  ): Observable<MessageEvent> {
    this.ensureExternalAuth(token, "/api/external/events/stream");
    const normalizedCommandId = commandId?.trim() || undefined;
    this.commandsService.recordExternalApiRequest({
      path: "/api/external/events/stream",
      status: "SUCCESS"
    });
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
    const path = "/api/external/callbacks/register";
    this.ensureExternalAuth(externalToken, path);
    const externalSystemId = body?.externalSystemId?.trim();
    const callbackUrl = body?.callbackUrl?.trim();
    const signingSecret = body?.signingSecret?.trim();
    if (!externalSystemId || !callbackUrl || !signingSecret) {
      this.commandsService.recordExternalApiRequest({ path, status: "BAD_REQUEST" });
      throw new BadRequestException({
        message: "Validation failed",
        errors: {
          externalSystemId: "externalSystemId is required",
          callbackUrl: "callbackUrl is required",
          signingSecret: "signingSecret is required"
        }
      });
    }
    const response = this.commandsService.registerExternalCallback({
      externalSystemId,
      callbackUrl,
      signingSecret
    });
    this.commandsService.recordExternalApiRequest({ path, status: "SUCCESS" });
    return response;
  }

  @Get("callbacks/deliveries")
  listCallbackDeliveries(
    @Headers("x-external-token") externalToken?: string,
    @Query("commandId") commandId?: string
  ): ListCallbackDeliveriesResponse {
    const path = "/api/external/callbacks/deliveries";
    this.ensureExternalAuth(externalToken, path);
    const response = this.commandsService.listCallbackDeliveries(commandId?.trim() || undefined);
    this.commandsService.recordExternalApiRequest({ path, status: "SUCCESS" });
    return response;
  }

  @Get("metrics")
  getExternalMetrics(
    @Headers("x-external-token") externalToken?: string,
    @Query("windowMinutes") windowMinutes?: string
  ): ExternalIntegrationMetricsResponse {
    const path = "/api/external/metrics";
    this.ensureExternalAuth(externalToken, path);
    const parsed = windowMinutes ? Number.parseInt(windowMinutes, 10) : 60;
    const response = this.commandsService.getExternalIntegrationMetrics(
      Number.isFinite(parsed) && parsed > 0 ? parsed : 60
    );
    this.commandsService.recordExternalApiRequest({ path, status: "SUCCESS" });
    return response;
  }

  private ensureExternalAuth(token?: string, path = "/api/external"): void {
    const expected = process.env.EXTERNAL_API_TOKEN ?? "dev-external-token";
    if (!token || token.trim() !== expected) {
      this.commandsService.recordExternalApiRequest({ path, status: "UNAUTHORIZED" });
      throw new UnauthorizedException({
        message: "Invalid external credential"
      });
    }
  }
}
