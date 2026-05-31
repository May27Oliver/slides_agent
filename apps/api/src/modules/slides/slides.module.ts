import { Module } from "@nestjs/common";
import { SlidesController } from "@/modules/slides/slides.controller";

@Module({
  controllers: [SlidesController]
})
export class SlidesModule {}
