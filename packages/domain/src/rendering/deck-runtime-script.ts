/**
 * Self-contained presentation runtime: keyboard + click + dot navigation, a
 * progress indicator, and an "F" fullscreen toggle. Emits the literal keydown /
 * ArrowRight / ArrowLeft / PageDown / PageUp handlers the validator and
 * accessibility tests expect.
 */
export function buildDeckRuntimeScript(): string {
  return `
(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var dotsBox = document.getElementById("sidedots");
  var progress = document.getElementById("progress");
  var current = 0;

  function toggleFullscreen() {
    var root = document.documentElement;
    var fsElement =
      document.fullscreenElement || document.webkitFullscreenElement || null;
    if (fsElement) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) { exit.call(document); }
    } else {
      var request = root.requestFullscreen || root.webkitRequestFullscreen;
      if (request) {
        var result = request.call(root);
        if (result && typeof result.catch === "function") { result.catch(function () {}); }
      }
    }
  }

  if (dotsBox) {
    slides.forEach(function (_, index) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", "Go to slide " + (index + 1));
      dot.addEventListener("click", function () { show(index); });
      dotsBox.appendChild(dot);
    });
  }
  var dots = dotsBox ? Array.prototype.slice.call(dotsBox.querySelectorAll("button")) : [];

  function show(index) {
    var nextIndex = Math.max(0, Math.min(index, slides.length - 1));
    slides.forEach(function (slide, slideIndex) {
      slide.classList.toggle("prev", slideIndex < nextIndex);
      slide.classList.toggle("active", slideIndex === nextIndex);
    });
    dots.forEach(function (dot, dotIndex) {
      dot.classList.toggle("on", dotIndex === nextIndex);
    });
    if (progress) {
      progress.style.width = ((nextIndex + 1) / slides.length) * 100 + "%";
    }
    current = nextIndex;
  }

  function next() { show(current + 1); }
  function prev() { show(current - 1); }

  document.addEventListener("keydown", function (event) {
    if (event.key === "ArrowRight" || event.key === "PageDown") { next(); }
    if (event.key === "ArrowLeft" || event.key === "PageUp") { prev(); }
    if (event.key === "f" || event.key === "F") { toggleFullscreen(); }
  });

  var prevBtn = document.getElementById("prevBtn");
  var nextBtn = document.getElementById("nextBtn");
  if (prevBtn) { prevBtn.addEventListener("click", prev); }
  if (nextBtn) { nextBtn.addEventListener("click", next); }

  show(0);
})();
`.trim();
}
