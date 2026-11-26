/* The product and PCB revision filter of the header.

   The reader's choice is kept in localStorage under "mura.filter" and applied as data-mura-product
   and data-mura-pcb on <html>: by the inline script of overrides/main.html before the page renders,
   and here after a change. The rules in main.html then hide every element of class "mura-f" whose
   data-product or data-pcb list (space-separated) lacks the chosen value, and show the notice of a
   page that does not apply. The macros of main.py mark the known issues and the release table; this
   script fills the selectors, marks the navigation (sidebar and section tabs) from the page map of
   hooks.py, the content tabs "PCB x.y" and the sections marked with only(), and brings the chosen
   board's content tab to the front. Nothing else is touched; the search is not filtered. */
(function () {
  "use strict";
  var KEY = "mura.filter";
  var data = window.__mura || {};
  var products = data.products || [];
  var pages = data.pages || {};
  var html = document.documentElement;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function save(f) {
    try { localStorage.setItem(KEY, JSON.stringify({ product: f.product || "", pcb: f.pcb || "" })); } catch (e) {}
  }
  function apply(f) {
    if (f.product) html.setAttribute("data-mura-product", f.product); else html.removeAttribute("data-mura-product");
    if (f.pcb) html.setAttribute("data-mura-pcb", f.pcb); else html.removeAttribute("data-mura-pcb");
  }
  function boardsFor(product) {
    var out = [];
    products.forEach(function (p) {
      if (product && String(p.id) !== product) return;
      (p.boards || []).forEach(function (b) { if (out.indexOf(String(b)) < 0) out.push(String(b)); });
    });
    return out;
  }
  function mark(el, info) {
    if (!el) return;
    el.classList.add("mura-f");
    if (info.product && info.product.length) el.setAttribute("data-product", info.product.join(" "));
    if (info.pcb && info.pcb.length) el.setAttribute("data-pcb", info.pcb.join(" "));
  }

  /* The selectors: the products, then the boards of the chosen product (every board for "All"). */
  function fill(box, f) {
    var product = box.querySelector("select[name=product]"), pcb = box.querySelector("select[name=pcb]");
    product.value = f.product || "";
    if (product.value !== (f.product || "")) product.value = "";  // a product no longer offered
    f.product = product.value;
    var boards = boardsFor(f.product);
    while (pcb.options.length > 1) pcb.remove(1);
    boards.forEach(function (b) { pcb.add(new Option(b, b)); });
    f.pcb = boards.indexOf(f.pcb || "") < 0 ? "" : f.pcb;
    pcb.value = f.pcb;
    return f;
  }

  /* Navigation entries of pages that do not apply: sidebar items and section tabs. */
  function siteRoot() {
    try {
      var cfg = JSON.parse(document.getElementById("__config").textContent);
      return new URL(cfg.base, location.href).pathname.replace(/\/?$/, "/");
    } catch (e) { return "/"; }
  }
  function markNav() {
    var root = siteRoot();
    var links = document.querySelectorAll("a.md-nav__link[href], a.md-tabs__link[href]");
    Array.prototype.forEach.call(links, function (a) {
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#") return;
      var path;
      try { path = new URL(href, location.href).pathname; } catch (e) { return; }
      if (path.indexOf(root) !== 0) return;
      var info = pages[path.slice(root.length).replace(/index\.html$/, "")];
      if (info) mark(a.closest(".md-nav__item, .md-tabs__item"), info);
    });
  }

  /* Content tabs "PCB 1.4" / "PCB 1.3": label and block are marked; the chosen board's tab comes to the front. */
  function markTabs() {
    var labels = document.querySelectorAll(".tabbed-labels > label");
    Array.prototype.forEach.call(labels, function (label) {
      var m = /^\s*PCB\s+(\S+)\s*$/.exec(label.textContent || "");
      if (!m) return;
      var info = { pcb: [m[1]] };
      mark(label, info);
      var set = label.closest(".tabbed-set");
      var content = set && set.querySelector(":scope > .tabbed-content");
      var i = Array.prototype.indexOf.call(label.parentNode.children, label);
      if (content && content.children[i]) mark(content.children[i], info);
    });
  }
  function frontTab(pcb) {
    if (!pcb) return;
    var labels = document.querySelectorAll('.tabbed-labels > label[data-pcb="' + pcb + '"]');
    Array.prototype.forEach.call(labels, function (label) {
      var input = document.getElementById(label.htmlFor);
      if (input && !input.checked) label.click();
    });
  }

  /* A section that exists on one board only: only() in its heading, or on the line below it, marks
     the heading, everything up to the next heading of the same or a higher level, and the heading's
     entry in the table of contents. On a paragraph, list item or table row it marks that one. */
  function markOnly() {
    var badges = document.querySelectorAll(".md-typeset .badge[data-pcb]");
    Array.prototype.forEach.call(badges, function (badge) {
      var info = { pcb: [badge.getAttribute("data-pcb")] };
      var holder = badge.closest("h1, h2, h3, h4, h5, h6, li, tr, p");
      if (!holder) return;
      var prev = holder.previousElementSibling;
      var start = (holder.tagName === "P" && prev && /^H[2-6]$/.test(prev.tagName)) ? prev : holder;
      var level = /^H([2-6])$/.exec(start.tagName);
      if (!level) { mark(holder, info); return; }
      for (var el = start; el; el = el.nextElementSibling) {
        var h = /^H([1-6])$/.exec(el.tagName);
        if (el !== start && h && +h[1] <= +level[1]) break;
        mark(el, info);
      }
      if (start.id) {
        var toc = document.querySelectorAll('a.md-nav__link[href="#' + start.id + '"]');
        Array.prototype.forEach.call(toc, function (a) { mark(a.closest(".md-nav__item"), info); });
      }
    });
  }

  /* On phones the header has no room beside the page title: a copy of the selectors goes to the top
     of the navigation drawer, and the stylesheet shows one or the other by viewport width. */
  function placeInDrawer() {
    var box = document.querySelector(".md-header [data-md-component=mura-filter]");
    var nav = document.querySelector(".md-sidebar--primary .md-nav--primary");
    var title = nav && nav.querySelector(":scope > .md-nav__title");
    if (!box || !title || nav.querySelector("[data-md-component=mura-filter]")) return;
    var copy = box.cloneNode(true);
    copy.classList.add("mura-filter--drawer");
    copy.removeAttribute("data-mura-bound");
    title.insertAdjacentElement("afterend", copy);
  }

  function init() {
    var f = load();
    placeInDrawer();
    var boxes = document.querySelectorAll('[data-md-component="mura-filter"]');
    Array.prototype.forEach.call(boxes, function (box) {
      f = fill(box, f);
      if (box.getAttribute("data-mura-bound")) return;
      box.setAttribute("data-mura-bound", "1");
      box.addEventListener("change", function () {
        var g = fill(box, {
          product: box.querySelector("select[name=product]").value,
          pcb: box.querySelector("select[name=pcb]").value
        });
        Array.prototype.forEach.call(boxes, function (other) { if (other !== box) fill(other, g); });
        save(g);
        apply(g);
        frontTab(g.pcb);
      });
    });
    apply(f);
    markNav();
    markTabs();
    markOnly();
    frontTab(f.pcb);
  }

  if (window.document$ && typeof window.document$.subscribe === "function") window.document$.subscribe(init);
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
