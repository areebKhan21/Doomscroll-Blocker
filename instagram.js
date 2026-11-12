(() => {
  "use strict";

  const HIDDEN = "data-reels-blocker-hidden";
  const REDIRECTING = "data-reels-blocker-redirecting";
  const HOSTS = new Set(["instagram.com", "www.instagram.com"]);
  const RESERVED_PATHS = new Set([
    "accounts", "about", "direct", "explore", "p", "stories", "tv",
  ]);
  const CONTROL = 'a, button, [role="link"], [role="tab"]';
  // Accessible labels are fallback hints; URL detection does not depend on language.
  const REEL_LABEL = /^(?:reel|reels)$/i;
  const MARKERS = 'svg[aria-label], [role="img"][aria-label]';
  let hiddenElements = new Set();
  let scanTimer = null;
  let lastUrl = location.href;
  let redirecting = false;

  function isReelsUrl(value) {
    if (!value) return false;
    try {
      const url = new URL(value, location.href);
      if (!HOSTS.has(url.hostname) || !/^https?:$/.test(url.protocol)) return false;
      if (/^\/reels?(?:\/|$)/i.test(url.pathname)) return true;

      // Profile Reels tabs and username-prefixed Reel permalinks.
      const profile = url.pathname.match(/^\/([\w.]+)\/reels?(?:\/|$)/i);
      return Boolean(profile && !RESERVED_PATHS.has(profile[1].toLowerCase()));
    } catch {
      return false;
    }
  }

  function hasReelLabel(element) {
    return REEL_LABEL.test((element.getAttribute("aria-label") || "").trim()) ||
      REEL_LABEL.test((element.getAttribute("title") || "").trim());
  }

  function hasReelMarker(element) {
    return Array.from(element.querySelectorAll(MARKERS)).some(hasReelLabel);
  }

  function isReelsControl(element) {
    return isReelsUrl(element.getAttribute("href")) ||
      hasReelLabel(element) || hasReelMarker(element);
  }

  function pauseVideos(element) {
    const videos = element.matches("video") ? [element] : element.querySelectorAll("video");
    for (const video of videos) {
      if (!video.paused) video.pause();
    }
  }

  function blockReelsPage() {
    if (!isReelsUrl(location.href)) return false;
    if (!redirecting) {
      redirecting = true;
      if (document.documentElement) {
        document.documentElement.setAttribute(REDIRECTING, "");
        pauseVideos(document.documentElement);
      }
      location.replace("https://www.instagram.com/");
    }
    return true;
  }

  function inMessages() {
    return /^\/direct(?:\/|$)/.test(location.pathname);
  }

  function targetFor(control) {
    const article = control.closest("article");
    // Only promote a link to its article when it is a media/permalink link.
    // A Reel URL merely mentioned in a caption must not hide a regular post.
    // In DMs hide the Reel attachment/link, never the surrounding conversation.
    const primaryLink = control.querySelector("img, picture, video, canvas, time") ||
      hasReelMarker(control);
    if (article && primaryLink && !inMessages()) return article;
    return control;
  }

  function scan() {
    scanTimer = null;
    if (blockReelsPage()) return;
    const nextHidden = new Set();

    for (const control of document.querySelectorAll(CONTROL)) {
      if (isReelsControl(control)) nextHidden.add(targetFor(control));
    }

    // A Reel badge can identify a feed item even if its link uses /p/.
    for (const marker of document.querySelectorAll(MARKERS)) {
      if (!hasReelLabel(marker)) continue;
      const article = marker.closest("article");
      if (article && !inMessages()) nextHidden.add(article);
      else {
        const control = marker.closest(CONTROL);
        if (control) nextHidden.add(control);
      }
    }

    // Instagram can reuse nodes for different posts. Restore nodes that no
    // longer represent Reels, and release detached nodes from our tracking set.
    for (const element of hiddenElements) {
      if (!nextHidden.has(element)) element.removeAttribute(HIDDEN);
    }
    for (const element of nextHidden) {
      if (!element.hasAttribute(HIDDEN)) element.setAttribute(HIDDEN, "");
      pauseVideos(element);
    }
    hiddenElements = nextHidden;
  }

  function scheduleScan() {
    // Coalesce rapid DOM updates without scanning continuously during playback.
    if (scanTimer === null) scanTimer = setTimeout(scan, 80);
  }

  function checkNavigation() {
    if (blockReelsPage()) return;
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      scheduleScan();
    }
  }

  function blockClick(event) {
    if (!(event.target instanceof Element)) return;
    if (event.type === "auxclick" && event.button !== 1) return;
    const control = event.target.closest(CONTROL);
    if (control && (isReelsControl(control) || control.closest(`[${HIDDEN}]`))) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  document.addEventListener("click", blockClick, true);
  document.addEventListener("auxclick", blockClick, true);
  document.addEventListener("play", (event) => {
    const video = event.target;
    if (video instanceof Element && video.matches("video") &&
        (isReelsUrl(location.href) || video.closest(`[${HIDDEN}]`))) {
      video.pause();
    }
  }, true);
  window.addEventListener("popstate", checkNavigation);
  window.addEventListener("pageshow", checkNavigation);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      checkNavigation();
      scheduleScan();
    }
  });

  function start() {
    scan();
    const observer = new MutationObserver(() => {
      checkNavigation();
      scheduleScan();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "aria-label", "title"],
    });
    // pushState/replaceState do not fire popstate, and the page's JS world is
    // isolated from this script. Only compare the URL here, not the whole DOM.
    setInterval(checkNavigation, 500);
  }

  if (!blockReelsPage()) {
    if (document.documentElement) start();
    else document.addEventListener("DOMContentLoaded", start, { once: true });
  }
})();
