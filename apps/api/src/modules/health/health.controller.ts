import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  @Public()
  @ApiOperation({ summary: "Health check" })
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "sotec-api",
      timestamp: new Date().toISOString(),
    };
  }
}
