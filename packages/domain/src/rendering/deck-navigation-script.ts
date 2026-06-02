export function buildDeckNavigationScript(): string {
  return `
let currentSlideIndex = 0;
const slides = Array.from(document.querySelectorAll("[data-slide-id]"));

function showSlide(index) {
  currentSlideIndex = Math.max(0, Math.min(index, slides.length - 1));
  slides.forEach((slide, slideIndex) => {
    slide.hidden = slideIndex !== currentSlideIndex;
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === "PageDown") {
    showSlide(currentSlideIndex + 1);
  }
  if (event.key === "ArrowLeft" || event.key === "PageUp") {
    showSlide(currentSlideIndex - 1);
  }
});

showSlide(0);
`.trim();
}
