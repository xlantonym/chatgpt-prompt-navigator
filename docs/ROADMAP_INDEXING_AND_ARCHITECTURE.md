# Roadmap: Indexing and Architecture

This document records the post-0.5.0 cleanup roadmap before starting 0.5.1 indexing work.

## 1. Current Core Problem

The main instability comes from the fact that these four data layers are not fully equivalent:

1. DOM currently visible messages
2. Cached messages in registry
3. Persisted messages in storage
4. Complete messages in the actual ChatGPT conversation

The core goal of 0.5.1 is to progressively scan, merge, and persist messages for the current conversation, then mark whether the conversation has been fully indexed.

## 2. Known Runtime Issues

Known issues that are intentionally not fixed in this roadmap document:

1. Clicking the top message starts automatic scrolling but eventually fails.
2. Opening a new chat window inside a project can cause message-reading issues.
3. The first message still cannot record time.

These issues are left for 0.5.1 / 0.5.2 and later work.

## 3. 0.5.1: Current Conversation Indexing

Goals:

1. Manual Backfill Current Conversation
2. Progress bar / cancel
3. Scan + merge + save on each visible screen
4. Conversation archive manifest
5. Debug shows `backfillStatus`
6. Mark `fullIndexedAt` after completion

Suggested flow:

1. After entering a conversation, load the registry first.
2. Show the existing indexed state.
3. User manually triggers Backfill Current Conversation.
4. Run scrolling scan inside the page. Do not promise background async indexing.
5. Merge each scanned batch into the registry.
6. Save to storage per batch or with throttling.
7. Write `fullIndexedAt` after completion.

Notes:

1. Do not fallback to the first message.
2. Do not do a large rewrite in one step.
3. Do not fix all jump issues in 0.5.1.
4. 0.5.1 should focus on making current-conversation indexing stable.

## 4. 0.5.2: Jump Enhancement

Goals:

1. Lazy jump on demand when clicking cached/offscreen messages.
2. Use registry index to decide direction.
3. If not found, show an explicit failure message. Do not jump to the first message.
4. If the current conversation is fully indexed, prefer registry-assisted direction decisions.

Long-term, split jumping into three layers:

```js
findTargetInDOM()
ensureTargetLoaded()
scrollAndHighlight()
```

Responsibilities:

`findTargetInDOM`:

- Only checks whether the target message already exists in DOM.
- Does not scroll.
- Does not highlight.
- Does not modify registry.

`ensureTargetLoaded`:

- If the target is not in DOM, tries to make ChatGPT load it.
- Uses registry index / current index to decide direction.
- Controls lazy jump attempts and failure reasons.
- Does not fallback to the first message.

`scrollAndHighlight`:

- After the target exists in DOM, handles scrolling, correction, and highlighting.
- Reads the existing accent CSS variable for highlight.
- Does not touch ChatGPT native search highlight.

## 5. Mid-Term Architecture Split

Long-term, split logic into four categories:

1. Scanner
2. Registry
3. Renderer
4. Controller

Responsibilities:

`Scanner`:

- Extracts message facts from DOM only.
- Does not care about UI.
- Does not write storage directly.

`Registry`:

- Handles message merge, dedupe, sorting, and persistence.
- Owns schema version / migration.
- Owns conversation archive manifest.

`Renderer`:

- Renders state into UI only.
- Covers All / Time / Bookmarks / Tags / Settings / Help / Debug.

`Controller`:

- Handles events, jumping, shortcuts, and conversation switching.
- Does not contain complex DOM extraction logic directly.

## 6. Storage Schema Versioning

Later, separate storage schema version from script version.

Example:

```json
{
  "schemaVersion": 2,
  "scriptVersion": "0.5.1",
  "conversationId": "...",
  "messages": [],
  "fullIndexedAt": null
}
```

Migration goals:

1. `schema v1` to `v2`
2. `schema v2` to `v3`

This makes future message-registry field changes less dependent on legacy key repair.

## 7. Export / Import

Suggested future additions:

1. Export current conversation index JSON.
2. Export all plugin data JSON.
3. Import backup JSON.
4. Clear current conversation cache.
5. Clear all caches.

Use cases:

1. Prevent local data loss.
2. Make debugging easier.
3. Support cross-browser migration.
4. Compare registry / storage states.

## 8. Search Upgrade

Current search mainly covers:

1. Keyword
2. Time
3. Tags
4. Bookmarks

Potential upgrade levels:

1. Level 1: current keyword search.
2. Level 2: advanced filters by attachment / image / tag / bookmark / time.
3. Level 3: semantic search using local embeddings or external processing after export.

Lightweight enhancement priorities:

1. Multi-keyword AND / OR
2. Regex search
3. Search by attachment name
4. Search by tag combination
5. Search only within the current time folder

## 9. UI Complexity Control

Current UI already includes:

1. All
2. Time
3. Bookmarks
4. Tags
5. Settings
6. Help
7. Debug
8. Scroll Spy
9. Shortcuts
10. Theme
11. Drag / Resize

Recommended next steps:

1. Split Debug / Settings / Help rendering functions more independently.
2. Manage state-change entry points consistently.
3. Avoid direct state mutation scattered across the file.

Risks to prevent:

1. A setting changes but UI does not sync.
2. Old state remains after conversation switching.
3. Collapsed / hidden / Help / Settings state interactions conflict.

## 10. DOM Adapter

Long-term, extract:

```text
ChatGPTDomAdapter
├── getUserMessageNodes()
├── getAssistantMessageNodes()
├── getMessageId(node)
├── extractMainText(node)
├── extractQuote(node)
├── extractAttachment(node)
├── extractImage(node)
└── findScrollContainer()
```

Goal:

If ChatGPT page structure changes later, only the adapter should need updates, without touching business logic.

## 11. Performance Risks

Main risks:

1. Frequent `querySelectorAll`
2. Frequent registry serialization
3. Large-object `JSON.stringify`
4. Excessive MutationObserver triggers
5. Heavy `renderNav` redraws

Optimization directions:

1. Batched scanning
2. Incremental single-message updates
3. Use `requestIdleCallback` for non-urgent tasks
4. Sharded storage for large registries
5. Render only when hashes change
6. Virtualized navigation list rendering

## 12. Long-Term Engineering Direction

If the plugin continues to grow, evolve from a single-file userscript into:

```text
src/
├── main.js
├── dom-adapter.js
├── scanner.js
├── registry.js
├── storage.js
├── renderer/
│   ├── panel.js
│   ├── settings.js
│   ├── time-view.js
│   └── debug.js
├── controller/
│   ├── shortcuts.js
│   ├── scroll.js
│   └── route.js
└── styles.css
```

Then use a build tool to package the final `.user.js`.
