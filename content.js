const SHORTS_PATH = "/shorts/";

function blockDirectShortsPage() {
  if (location.pathname.startsWith(SHORTS_PATH)) {
    location.replace("https://www.youtube.com/");
  }
}

function hideShorts() {
  blockDirectShortsPage();

  const shortsLinks = document.querySelectorAll(
    'a[href^="/shorts/"], a[href*="youtube.com/shorts/"]'
  );

  for (const link of shortsLinks) {
    const container = link.closest(`
      ytd-guide-entry-renderer,
      ytd-mini-guide-entry-renderer,
      ytd-reel-item-renderer,
      ytd-reel-shelf-renderer,
      ytd-rich-item-renderer,
      ytd-rich-shelf-renderer,
      ytd-video-renderer,
      ytd-grid-video-renderer,
      yt-lockup-view-model,
      ytm-shorts-lockup-view-model
    `);

    (container || link).classList.add("shorts-blocker-hidden");
  }
}

/*
 * YouTube is a single-page application, so clicking around usually
 * changes the page without performing a normal browser reload.
 */
document.addEventListener("yt-navigate-finish", hideShorts);

document.addEventListener(
  "click",
  (event) => {
    const link = event.target.closest?.(
      'a[href^="/shorts/"], a[href*="youtube.com/shorts/"]'
    );

    if (link) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true
);

const observer = new MutationObserver(hideShorts);

function start() {
  blockDirectShortsPage();

  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    hideShorts();
  }
}

if (document.documentElement) {
  start();
} else {
  document.addEventListener("DOMContentLoaded", start, { once: true });
}