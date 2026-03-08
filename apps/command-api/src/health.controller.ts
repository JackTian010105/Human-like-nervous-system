import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@command-neural/shared-types";

@Controller()
export class HealthController {
  @Get("health")
  getHealth(): HealthResponse {
    return { status: "ok" };
  }
}
