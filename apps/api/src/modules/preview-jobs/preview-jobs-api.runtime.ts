import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnModuleDestroy
} from "@nestjs/common";
import { PreviewJobTimeoutSweeper } from "@/modules/preview-jobs/preview-job-timeout-sweeper";

/**
 * API-process-only lifecycle owner for the timeout sweeper. Lives in
 * PreviewJobsModule (imported only by the API's AppModule), so the sweeper
 * starts on API bootstrap and stops on shutdown — and never runs in the worker
 * process. Replaces the manual `main.ts` start() call so start/stop are tied to
 * the Nest lifecycle.
 */
@Injectable()
export class PreviewJobsApiRuntime implements OnApplicationBootstrap, OnModuleDestroy {
  constructor(
    @Inject(PreviewJobTimeoutSweeper) private readonly sweeper: PreviewJobTimeoutSweeper
  ) {}

  onApplicationBootstrap(): void {
    this.sweeper.start();
  }

  onModuleDestroy(): void {
    this.sweeper.stop();
  }
}
