/* Manual site behaviour: theme, section filter, scroll spy, back to top.
   No dependencies, no network calls, no cookies. The only stored value is the
   optional dark-mode preference in localStorage. */
(function () {
  "use strict";

  /* ---------- theme ---------- */
  var root = document.documentElement;
  var toggle = document.getElementById("theme-toggle");
  var stored = null;
  try { stored = localStorage.getItem("theme"); } catch (e) { /* storage blocked */ }
  var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(stored || (prefersDark ? "dark" : "light"));

  function setTheme(mode) {
    root.setAttribute("data-theme", mode);
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(mode === "dark"));
      toggle.textContent = mode === "dark" ? "☀" : "◐";
    }
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      setTheme(next);
      try { localStorage.setItem("theme", next); } catch (e) { /* ignore */ }
    });
  }

  /* ---------- search: filter the sections and the table of contents ---------- */
  var input = document.getElementById("search");
  var status = document.getElementById("search-status");
  var sections = Array.prototype.slice.call(document.querySelectorAll("main section"));
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc a"));
  var haystack = sections.map(function (section) {
    return (section.textContent || "").toLowerCase();
  });

  function filter() {
    var q = (input.value || "").trim().toLowerCase();
    var hits = 0;
    sections.forEach(function (section, i) {
      var show = !q || haystack[i].indexOf(q) !== -1;
      section.hidden = !show;
      if (show) hits += 1;
    });
    tocLinks.forEach(function (link) {
      var target = document.querySelector(link.getAttribute("href"));
      var section = target && target.closest("section");
      var show = !q || (section && !section.hidden);
      link.parentElement.hidden = !show;
    });
    if (status) {
      status.textContent = !q ? "" : hits + " / " + sections.length + " " +
        (document.documentElement.lang === "en" ? "sections match" : "節符合");
    }
  }
  if (input) {
    input.addEventListener("input", filter);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        var first = sections.filter(function (s) { return !s.hidden; })[0];
        if (first) first.scrollIntoView({ block: "start" });
      }
      if (event.key === "Escape") { input.value = ""; filter(); }
    });
  }

  /* ---------- scroll spy ---------- */
  var linksById = {};
  tocLinks.forEach(function (link) { linksById[link.getAttribute("href").slice(1)] = link; });
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Object.keys(linksById).forEach(function (id) {
          linksById[id].removeAttribute("aria-current");
        });
        var link = linksById[entry.target.id];
        if (link) link.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-25% 0px -65% 0px", threshold: 0 });
    sections.forEach(function (section) { observer.observe(section); });
  }

  /* ---------- back to top ---------- */
  var toTop = document.getElementById("totop");
  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
    var onScroll = function () {
      toTop.setAttribute("data-show", String(window.scrollY > 600));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
})();
