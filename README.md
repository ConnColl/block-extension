# Block

A calm focus tool for Chrome. Each morning you plan your tasks, give each one a time block, and list the few websites it actually needs. During that time block, only those sites open. Everything else waits until you're done.

- **Plan your day** with the Morning Plan.
- **Sessions start on their own** at each task's start time, with a one-minute heads-up.
- **Everything else is blocked**, with a calm page showing your task, the time left and the sites you *can* open.
- **Open tabs are set aside** when a session starts and come back when it ends.
- **A tab limit** keeps you to five tabs in use.
- **Ending early is possible, but slow on purpose:** hold a button, use one of three weekly passes, or type a short confession and sit through a 10-minute ad break.
- **Done early?** Say so, and start the next task or take the time back.

Block is inspired by Brick. It isn't affiliated with Brick.

## Install in 4 steps

1. **Download** `block-v1.0.zip` from the [latest release](https://github.com/ConnColl/block-extension/releases/latest).
2. **Unzip it.** On a Mac, double-click the file. On Windows, right-click it and choose **Extract All**. You'll get a folder with a file called `manifest.json` inside.
3. **Open `chrome://extensions`** in Chrome: type it into the address bar and press Enter. Then turn on **Developer mode**, the switch in the top-right corner.
4. **Click Load unpacked** and select the unzipped folder (the one containing `manifest.json`).

Block now appears in your extensions. Click the puzzle-piece icon in Chrome's toolbar and pin **Block** so it's easy to reach, then click it and choose **Open plan**.

**Good to know**
- **Keep the folder.** Chrome loads Block from it, so moving or deleting the folder removes Block.
- **The install warning.** Chrome says Block can "read and change all your data on all websites". It needs this to send blocked sites to its own page instead of Chrome's error page. Your plan and history stay in your browser.
- **Updating to a new version:** download the new zip, unzip it over the old folder, then click the ↻ reload icon on Block's card in `chrome://extensions`.

## Build from source (for developers)

You'll need [Node.js](https://nodejs.org) 22 or newer.

```sh
git clone https://github.com/ConnColl/block-extension.git
cd block-extension
npm install
npm run build
```

Then load `.output/chrome-mv3` with **Load unpacked**, as in step 4 above. After changing code, run `npm run build` again and click ↻ on Block's card.

| Command | What it does |
|---|---|
| `npm run dev` | Development build with live reload |
| `npm run build` | Production build in `.output/chrome-mv3` |
| `npm run zip` | Production build, zipped, in `.output/` |
| `npm test` | Unit tests (Vitest) |
| `npm run compile` | Type check |

Built with [WXT](https://wxt.dev) (Manifest V3), React, TypeScript, Tailwind CSS and Motion.

## Privacy

- **Stays in your browser:** your tasks, sessions and history are stored in Chrome's local extension storage. Block has no account and no server.
- **The one exception is the ad break.** It loads a video through an embed page on `work.courtneyconnerly.com`, which plays it from YouTube (`youtube-nocookie.com`), so both of those receive a request when the ad break plays.

## Known limitations

- **Browser only.** Block can't block other apps or other browsers.
- **Incognito windows** aren't covered unless you turn on **Allow in Incognito** for Block in `chrome://extensions`.
- **Unsaved work** in a tab that gets set aside at the start of a session is lost. The one-minute heads-up before scheduled sessions is there so you can save first.
- **Sign-ins that pass through another site**, such as Google's `accounts.google.com`, need that site on the task's list.

## License

© Courtney Connerly. All rights reserved.
