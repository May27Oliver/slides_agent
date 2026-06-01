import { Controller, NotImplementedException, Post } from "@nestjs/common";

@Controller("slides")
export class SlidesController {
  @Post("preview")
  preview(): never {
    throw new NotImplementedException("Slide preview generation is not implemented yet.");
  }
}
