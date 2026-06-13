/**
 * Self-contained presentation runtime: keyboard + click + dot navigation, a
 * progress indicator, and an "F" fullscreen toggle. Emits the literal keydown /
 * ArrowRight / ArrowLeft / PageDown / PageUp handlers the validator and
 * accessibility tests expect.
 */
export function buildDeckRuntimeScript(): string {
  return `
(function () {
  var deck = document.querySelector(".deck");
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

  // 014: tell an embedding editor preview which slide the USER navigated to, so
  // the edit panel can follow. Only user-driven navigation broadcasts — the initial
  // show(0) and externally-driven "deck:goToSlide" stay silent, otherwise every
  // iframe reload would yank the editor's selection back to slide 1. Inert for a
  // standalone deck (window.parent === window).
  function broadcast() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "deck:slideChanged", index: current }, "*");
    }
  }

  var dots = [];

  // 016: dot building extracted so a preview in-place patch (deck:patchSlides) can
  // rebuild dots after the slide set changes. Standalone decks call it once at init.
  function rebuildDots() {
    if (!dotsBox) { dots = []; return; }
    dotsBox.innerHTML = "";
    slides.forEach(function (_, index) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", "Go to slide " + (index + 1));
      dot.addEventListener("click", function () { show(index); broadcast(); });
      dotsBox.appendChild(dot);
    });
    dots = Array.prototype.slice.call(dotsBox.querySelectorAll("button"));
  }
  function refreshSlides() {
    slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  }
  rebuildDots();

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
    if (slides[current]) { slides[current].scrollTop = 0; }
  }

  function next() { show(current + 1); broadcast(); }
  function prev() { show(current - 1); broadcast(); }

  function scrollActiveSlide(deltaY) {
    var slide = slides[current];
    if (!slide || slide.scrollHeight <= slide.clientHeight) { return false; }
    var before = slide.scrollTop;
    slide.scrollTop = before + deltaY;
    return slide.scrollTop !== before;
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "ArrowRight" || event.key === "PageDown") { next(); }
    if (event.key === "ArrowLeft" || event.key === "PageUp") { prev(); }
    if (event.key === "f" || event.key === "F") { toggleFullscreen(); }
  });

  // 016: keep one override-fonts <link> in sync (only updates when the href changes →
  // no font re-fetch for edits that introduce no new family). null removes it.
  function ensureOverrideFontLink(href) {
    var existing = document.getElementById("override-fonts");
    if (!href) {
      if (existing && existing.parentNode) { existing.parentNode.removeChild(existing); }
      return;
    }
    if (existing) {
      if (existing.getAttribute("href") !== href) { existing.setAttribute("href", href); }
      return;
    }
    var link = document.createElement("link");
    link.id = "override-fonts";
    link.rel = "stylesheet";
    link.setAttribute("href", href);
    document.head.appendChild(link);
  }

  // 010: allow an embedding editor preview to drive which slide is shown, so the
  // left preview stays in sync with the slide being edited on the right. Additive and
  // inert for standalone decks (nobody posts to them); the rendered html is unchanged.
  window.addEventListener("message", function (event) {
    // 016: only the embedding editor (our direct parent) may drive the preview.
    // Strict equality — a null source (worker/detached/opaque) is NOT trusted.
    // Inert for a standalone deck (window.parent === window; nobody posts to it).
    if (event.source !== window.parent) { return; }
    var data = event.data;
    if (data && data.type === "deck:goToSlide" && typeof data.index === "number") {
      show(data.index);
      return;
    }
    // 016: in-place slide patch — swap the slide sections WITHOUT reloading the
    // document (no font re-fetch / no script restart / no jump).
    if (data && data.type === "deck:patchSlides" && typeof data.slidesHtml === "string") {
      if (deck) { deck.classList.add("deck-static"); }   // suppress entrance-animation replay
      ensureOverrideFontLink(data.fontsHref || null);
      var controls = deck ? deck.querySelector(".controls") : null;
      slides.forEach(function (slide) {
        if (slide.parentNode) { slide.parentNode.removeChild(slide); }
      });
      var tpl = document.createElement("template");
      tpl.innerHTML = data.slidesHtml;
      if (deck) {
        if (controls) { deck.insertBefore(tpl.content, controls); }
        else { deck.appendChild(tpl.content); }
      }
      refreshSlides();
      rebuildDots();
      show(typeof data.index === "number" ? data.index : current);
    }
  });

  var prevBtn = document.getElementById("prevBtn");
  var nextBtn = document.getElementById("nextBtn");
  if (prevBtn) { prevBtn.addEventListener("click", prev); }
  if (nextBtn) { nextBtn.addEventListener("click", next); }
  if (deck) {
    deck.addEventListener("wheel", function (event) {
      if (scrollActiveSlide(event.deltaY)) { event.preventDefault(); }
    }, { passive: false });
  }

  show(0);
})();
`.trim();
}
