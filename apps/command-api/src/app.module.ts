import { Module } from "@nestjs/common";
import { CommandsController } from "./commands.controller";
import { CommandsService } from "./commands.service";
import { DatabaseService } from "./database.service";
import { ExternalController } from "./external.controller";
import { HealthController } from "./health.controller";

@Module({
  imports: [],
  controllers: [HealthController, CommandsController, ExternalController],
  providers: [DatabaseService, CommandsService]
})
export class AppModule {}
