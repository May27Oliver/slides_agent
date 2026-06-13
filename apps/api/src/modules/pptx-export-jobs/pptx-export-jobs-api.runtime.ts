import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnModuleDestroy
} from "@nestjs/common";
import { PptxExportJobTimeoutSweeper } from "@/modules/pptx-export-jobs/pptx-export-job-timeout-sweeper";

/** API-process-only lifecycle owner for the PPTX export sweeper (mirrors preview). */
@Injectable()
export class PptxExportJobsApiRuntime implements OnApplicationBootstrap, OnModuleDestroy {
  constructor(
    @Inject(PptxExportJobTimeoutSweeper) private readonly sweeper: PptxExportJobTimeoutSweeper
  ) {}

  onApplicationBootstrap(): void {
    this.sweeper.start();
  }

  onModuleDestroy(): void {
    this.sweeper.stop();
  }
}
