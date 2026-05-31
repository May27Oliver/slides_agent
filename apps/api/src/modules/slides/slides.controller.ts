import { Controller, Post } from "@nestjs/common";

@Controller("slides")
export class SlidesController {
  @Post("preview")
  preview(): never {
    throw new Error("SlidesController.preview is not implemented yet.");
  }
}
