# YouTube Shorts Blocker

A minimal Chrome extension that removes YouTube Shorts while keeping
regular videos, search, subscriptions, playlists, and channels accessible.

## Features

- Hides Shorts shelves
- Hides Shorts recommendations
- Removes Shorts from the YouTube sidebar
- Prevents Shorts links from opening
- Redirects direct `/shorts/` pages to the YouTube homepage
- Requires no browsing-history or account permissions

## Installation

This extension is currently installed as an unpacked Chrome extension.

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the downloaded project folder.
6. Refresh any open YouTube tabs.

## Updating

After editing the extension:

1. Open `chrome://extensions`.
2. Click the reload button on the extension card.
3. Refresh YouTube.

## How it works

The extension injects a content script and stylesheet into YouTube.
The script detects links whose URLs begin with `/shorts/`, hides their
surrounding cards, and watches for content loaded dynamically by YouTube.

## Privacy

The extension runs only on YouTube pages. It does not collect, store,
or transmit user data.

## Limitations

YouTube may change its page structure. If that happens, the selectors
used to identify Shorts may need to be updated.

## License

MIT