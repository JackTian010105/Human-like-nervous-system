import { Module } from "@nestjs/common";
import { CommandsController } from "./commands.controller";
import { CommandsService } from "./commands.service";
import { HealthController } from "./health.controller";

@Module({
  imports: [],
  controllers: [HealthController, CommandsController],
  providers: [CommandsService]
})
export class AppModule {}
