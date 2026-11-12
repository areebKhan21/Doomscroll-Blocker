import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";
import test from "node:test";
import { JSDOM } from "jsdom";

const script = new Script(readFileSync(new URL("../instagram.js", import.meta.url), "utf8"));
const css = readFileSync(new URL("../instagram.css", import.meta.url), "utf8");
const HIDDEN = "data-reels-blocker-hidden";

function setup(t, { path = "/", html = "", playingIds = [] } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head><style>${css}</style></head><body>${html}</body></html>`, {
    url: `https://www.instagram.com${path}`,
  });
  const { window } = dom;
  const document = window.document;
  const redirects = [];
  const pauses = [];
  const playing = new Set(playingIds.map(id => document.getElementById(id)));
  Object.defineProperty(window.HTMLMediaElement.prototype, "paused", {
    get() { return !playing.has(this); },
  });
  window.HTMLMediaElement.prototype.pause = function () {
    pauses.push(this.id);
    playing.delete(this);
  };
  const timers = new Set();
  const observers = new Set();
  let tick = () => {};
  script.runInContext(createContext({
    window, document, URL, Element: window.Element,
    MutationObserver: class extends window.MutationObserver {
      constructor(callback) {
        super(callback);
        observers.add(this);
      }
    },
    location: {
      get href() { return window.location.href; },
      get pathname() { return window.location.pathname; },
      replace(value) { redirects.push(value); },
    },
    setTimeout(callback, delay) {
      const timer = setTimeout(() => { timers.delete(timer); callback(); }, delay);
      timers.add(timer);
      return timer;
    },
    setInterval(callback) { tick = callback; return 1; },
  }));
  t.after(() => {
    for (const observer of observers) observer.disconnect();
    for (const timer of timers) clearTimeout(timer);
    window.close();
  });
  return {
    document, window, redirects, pauses,
    tick: () => tick(),
    settle: () => new Promise(resolve => setTimeout(resolve, 140)),
    hidden: id => document.getElementById(id).hasAttribute(HIDDEN),
    click(id, type = "click", button = 0) {
      const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, button });
      document.getElementById(id).dispatchEvent(event);
      return event.defaultPrevented;
    },
  };
}

for (const path of [
  "/reels", "/reels/", "/reel", "/reel/ABC/?source=dm", "/reels/ABC/",
  "/someone/reels", "/someone/reels/", "/someone/reel/ABC/",
]) {
  test(`direct navigation redirects ${path}`, t => {
    const page = setup(t, { path });
    assert.deepEqual(page.redirects, ["https://www.instagram.com/"]);
    assert.ok(page.document.documentElement.hasAttribute("data-reels-blocker-redirecting"));
  });
}

for (const path of ["/", "/p/ABC/", "/direct/inbox/", "/stories/someone/123/", "/someone/", "/reelsfan/", "/direct/reels/"]) {
  test(`ordinary route remains accessible: ${path}`, t => {
    assert.deepEqual(setup(t, { path }).redirects, []);
  });
}

test("navigation links: relative, absolute, query, and profile routes; preserve external links", t => {
  const page = setup(t, { html: `
    <a id="root" href="/reels">Reels</a>
    <a id="query" href="/reels?source=nav">Reels</a>
    <a id="absolute" href="https://instagram.com/reel/ABC/">Clip</a>
    <a id="profile" href="/person/reels/">Profile tab</a>
    <a id="regular" href="/p/ABC/">Post</a>
    <a id="external" href="https://example.com/reels/">External</a>
    <a id="spoof" href="https://instagram.com.example.org/reel/ABC/">External</a>
    <a id="malformed" href="http://[">Broken URL</a>` });
  for (const id of ["root", "query", "absolute", "profile"]) assert.ok(page.hidden(id), id);
  for (const id of ["regular", "external", "spoof", "malformed"]) assert.ok(!page.hidden(id), id);
  assert.equal(page.window.getComputedStyle(page.document.getElementById("root")).display, "none");
});

test("hide media cards and badge-marked cards without hiding ordinary caption mentions", t => {
  const page = setup(t, { html: `
    <article id="reel"><a href="/reel/ABC/"><img></a><p>Reel caption</p></article>
    <article id="badge"><a href="/p/XYZ/"><svg aria-label="Reel"></svg><img></a></article>
    <article id="ordinary"><a href="/p/PHOTO/"><img></a><p>See <a id="mention" href="/reel/ABC/">this clip</a></p></article>
    <article id="video"><a href="/p/VIDEO/"><video></video></a></article>` });
  assert.ok(page.hidden("reel"));
  assert.ok(page.hidden("badge"));
  assert.ok(page.hidden("mention"));
  assert.ok(!page.hidden("ordinary"));
  assert.ok(!page.hidden("video"));
});

test("timestamp permalinks identify feed Reels even when the video is outside the link", t => {
  const page = setup(t, { html: '<article id="card"><video></video><a href="/reel/ABC/"><time>2h</time></a></article>' });
  assert.ok(page.hidden("card"));
});

test("messages keep the conversation and ordinary text while hiding a Reel attachment", t => {
  const page = setup(t, { path: "/direct/t/123/", html: `
    <article id="conversation"><p id="message">Look at this</p>
      <a id="attachment" href="/reel/ABC/"><img><svg aria-label="Reel"></svg></a>
      <a id="photo" href="#photo">Regular post</a></article>` });
  assert.ok(page.hidden("attachment"));
  assert.ok(!page.hidden("conversation"));
  assert.ok(!page.hidden("message"));
  assert.ok(!page.click("photo"));
});

test("capture left, keyboard-style and middle clicks before page navigation handlers", t => {
  const page = setup(t, { html: '<a id="link" href="/reel/ABC/"><span id="child">Open</span></a><a id="normal" href="#normal">Post</a>' });
  let reachedPage = false;
  page.document.getElementById("link").addEventListener("click", () => { reachedPage = true; });
  assert.ok(page.click("child"));
  assert.ok(page.click("link", "auxclick", 1));
  assert.ok(!page.click("link", "auxclick", 2));
  assert.equal(reachedPage, false);
  assert.ok(!page.click("normal"));
});

test("accessible Reels buttons without hrefs are hidden and blocked", t => {
  const page = setup(t, { html: '<button id="reels"><svg aria-label="Reels"></svg></button><button id="home" aria-label="Home">Home</button>' });
  assert.ok(page.hidden("reels"));
  assert.ok(page.click("reels"));
  assert.ok(!page.hidden("home"));
});

test("new content and changed hrefs are processed; recycled regular cards are restored", async t => {
  const page = setup(t);
  page.document.body.innerHTML = '<article id="card"><a id="link" href="/p/PHOTO/"><img></a></article>';
  await page.settle();
  assert.ok(!page.hidden("card"));
  page.document.getElementById("link").setAttribute("href", "/reel/ABC/");
  await page.settle();
  assert.ok(page.hidden("card"));
  page.document.getElementById("link").setAttribute("href", "/p/PHOTO/");
  await page.settle();
  assert.ok(!page.hidden("card"));
  let reachedRegularPost = false;
  page.document.getElementById("link").addEventListener("click", event => {
    reachedRegularPost = !event.defaultPrevented;
    event.preventDefault(); // jsdom does not implement full page navigation.
  });
  page.click("link");
  assert.ok(reachedRegularPost);
});

test("changed accessible badges hide and restore a reused card", async t => {
  const page = setup(t, { html: '<article id="card"><a href="/p/ABC/"><svg id="badge" aria-label="Photo"></svg></a></article>' });
  page.document.getElementById("badge").setAttribute("aria-label", "Reel");
  await page.settle();
  assert.ok(page.hidden("card"));
  page.document.getElementById("badge").setAttribute("aria-label", "Photo");
  await page.settle();
  assert.ok(!page.hidden("card"));
});

test("hidden playing videos pause and cannot restart; ordinary video playback is preserved", t => {
  const page = setup(t, { html: '<article><a href="/reel/ABC/"><video id="reel"></video></a></article><video id="normal"></video>', playingIds: ["reel", "normal"] });
  assert.deepEqual(page.pauses, ["reel"]);
  page.document.getElementById("reel").dispatchEvent(new page.window.Event("play"));
  page.document.getElementById("normal").dispatchEvent(new page.window.Event("play"));
  assert.deepEqual(page.pauses, ["reel", "reel"]);
});

test("pushState without DOM changes is detected by the URL check, and redirects only once", t => {
  const page = setup(t);
  page.window.history.pushState({}, "", "/reels/");
  page.tick();
  page.tick();
  assert.deepEqual(page.redirects, ["https://www.instagram.com/"]);
});

test("back/forward and restored pages check the new route immediately", t => {
  const page = setup(t);
  page.window.history.replaceState({}, "", "/reel/ABC/");
  page.window.dispatchEvent(new page.window.PopStateEvent("popstate"));
  page.window.dispatchEvent(new page.window.Event("pageshow"));
  assert.deepEqual(page.redirects, ["https://www.instagram.com/"]);
});
