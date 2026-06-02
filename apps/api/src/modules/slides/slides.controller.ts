import { BadRequestException, Body, Controller, Inject, Post } from "@nestjs/common";
import type {
  GeneratePreviewRequestContract,
  GeneratePreviewResponseContract
} from "@slides-agent/contracts";
import { validateGeneratePreviewRequest } from "@slides-agent/contracts";
import { SlidesService } from "@/modules/slides/slides.service";

@Controller("slides")
export class SlidesController {
  constructor(@Inject(SlidesService) private readonly slidesService: SlidesService) {}

  @Post("preview")
  async preview(@Body() request: unknown): Promise<GeneratePreviewResponseContract> {
    const validation = validateGeneratePreviewRequest(request);
    if (!validation.ok) {
      throw new BadRequestException(validation.error);
    }

    return this.slidesService.generatePreview(validation.value);
  }
}
