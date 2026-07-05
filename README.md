# ChatGPT Prompt Navigator

A single-file Tampermonkey userscript that adds a floating navigator for user prompts on ChatGPT pages.

Current MVP version: `0.4.2`

## Features

- User message navigation
- Search
- Time view with month / week / day folders
- Bookmarks
- Tags
- Debug panel
- Settings panel
- Help panel
- Collapse / expand panel state
- Floating panel drag and four-side resize
- Media hydration rescan for late-loading images / attachments
- Chinese and English UI strings
- Light / dark plugin themes

## Repository Layout

```text
chatgpt-prompt-navigator/
  src/
    chatgpt-prompt-navigator.user.js
  dist/
    chatgpt-prompt-navigator.user.js
  assets/
    screenshots/
  docs/
    FINAL_AUDIT.md
    DEVELOPMENT_REVIEW.md
  README.md
  README.zh-CN.md
  CHANGELOG.md
  LICENSE
  .gitignore
```

## Install

1. Install Tampermonkey in your browser.
2. Open `dist/chatgpt-prompt-navigator.user.js`.
3. Copy the whole file into a new Tampermonkey script.
4. Save it and open `https://chatgpt.com/`.

There is no webpack, Vite, npm build, or bundling step in this MVP. The `src/` and `dist/` files are intentionally identical for now.

## Development

- Edit only `src/chatgpt-prompt-navigator.user.js`.
- Copy to `dist/chatgpt-prompt-navigator.user.js` for release.
- Keep this as a single-file userscript unless a future release explicitly introduces a build process.
- Do not call ChatGPT backend APIs, intercept `fetch` / XHR, or read cookies / tokens.

## Audit

See `docs/FINAL_AUDIT.md` for the current read-only audit and known issue map.

