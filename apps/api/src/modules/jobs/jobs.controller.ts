import {
  Inject,
  Controller,
  Post,
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import { SetMetadata } from "@nestjs/common";
import { JobsService } from "./jobs.service";
import { equal } from "../../common/crypto";
import { secret } from "../../config/env";
@Controller("jobs")
export class JobsController {
  constructor(@Inject(JobsService) private jobs: JobsService) {}
  @SetMetadata("job", true) @Post("run") run(
    @Headers("authorization") auth: string,
  ) {
    if (!equal(auth || "", `Bearer ${secret("JOB_SECRET")}`))
      throw new UnauthorizedException();
    return this.jobs.runOne();
  }
}
