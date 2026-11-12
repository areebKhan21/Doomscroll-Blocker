# Doomscroll Blocker

A local Chrome extension that hides YouTube Shorts and Instagram Reels.
Regular YouTube videos and ordinary Instagram posts, profiles, Stories, and messages remain accessible. 

## Features

- Hides Shorts shelves
- Hides Shorts recommendations
- Removes Shorts from the YouTube sidebar
- Prevents Shorts links from opening
- Redirects direct `/shorts/` pages to the YouTube homepage
- Hides Instagram Reels navigation links, profile Reels tabs, and identifiable Reel cards
- Blocks Reel links, including middle-clicks and links shared in messages
- Redirects direct Instagram Reels pages to the Instagram homepage
- Pauses playback in hidden Instagram Reel cards
- Watches for newly loaded content and restores cards reused for ordinary posts
- Requires no browsing-history or account permissions

## Installation

This extension is currently installed as an unpacked Chrome extension.

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the downloaded project folder.
6. Refresh any open YouTube and Instagram tabs.

## Updating

After editing the extension:

1. Open `chrome://extensions`.
2. Click the reload button on the extension card.
3. Refresh YouTube and Instagram. Already-open tabs do not automatically receive the new script.

For an update from the YouTube-only version, check the extension's site access
and allow it to run on Instagram if Chrome prompts. Use it at instagram.com in
desktop Chrome; it does not affect the Instagram mobile app or Facebook Reels.

## How it works

The manifest registers separate content scripts and stylesheets for each site.
`content.js` and `styles.css` handle YouTube. `instagram.js` and `instagram.css`
handle Instagram without relying on YouTube-specific elements or events.

Instagram detection parses link URLs and recognizes `/reel`, `/reels`,
username-prefixed Reel permalinks, and profile Reels tabs, with or without a
trailing slash. English accessible Reel labels provide additional hints for
cards and controls; URL detection is independent of the interface language.
Confirmed media/permalink links or Reel badges can hide the containing article.
A text link in a caption is hidden without hiding the ordinary post. In messages,
only the identified Reel link or attachment is hidden, not the conversation.

A MutationObserver watches new content and changes to link destinations and
labels. Scans are batched to avoid running for every mutation. A separate URL
check runs every 500 ms to catch navigation without a page reload; browser
Back/Forward and page restoration are checked as well. Hidden videos are paused,
and playback events are checked to stop them restarting.

## Privacy

The extension runs only on YouTube and Instagram pages. It does not collect, store, or transmit user data.

## Limitations

- Website markup can change, so detection rules may need updates.
- This is a page-level filter, not a network blocker. During in-page navigation,
  redirection can take up to roughly 500 ms in an active tab; background timers
  can be delayed by the browser. It does not guarantee that media is never downloaded.
- Instagram videos with no recognizable Reel URL or label may remain visible.
  Ordinary videos are not blocked simply because they are short or vertical.
- A YouTube Short reached via a normal `/watch` URL can still play in the regular
  player. Instagram Reel links are blocked rather than converted to another player.
- Automated tests use representative HTML fixtures. They do not verify every
  variant of Instagram's live, signed-in interface.

## Development and testing

The extension runs directly from these files. Node.js is only needed for tests.
With Node.js 20 or later:

```sh
npm ci --ignore-scripts
npm test
```

Tests cover URL boundaries, direct navigation, delayed content, changed links,
left/middle clicks, hidden playback, preserved posts/messages, and reused cards.
The test-only DOM dependency does not run inside the extension.

After reloading the extension in Chrome, also check these live scenarios:

1. Instagram Home: the Reels navigation entry and recognizable Reel cards disappear.
2. Open `/reels/` and a copied Reel permalink directly: both return to Home.
3. Visit a profile: its Reels tab is hidden, while ordinary posts still open.
4. Scroll Home and Explore: newly loaded identifiable Reels are hidden.
5. Open a message containing a Reel: the conversation remains readable; the Reel is blocked.
6. Check Stories, ordinary photo/video posts, Back/Forward, and regular YouTube videos.

## License

MIT
