// ==UserScript==
// @name         ChatGPT 我的发文导航器
// @namespace    https://chatgpt.com/
// @version      0.5.0
// @description  在 ChatGPT 页面右侧生成“我的发文”浮窗目录，支持搜索、刷新、折叠、定位、高亮、调试、书签、时间视图、标签、设置、拖拽移动和 Scroll Spy。
// @author       You
// @match        https://chatgpt.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const SCRIPT_VERSION = "0.5.0";
  const PANEL_ID = "gpt-prompt-navigator-panel";
  const USER_SELECTOR = '[data-message-author-role="user"]';
  const ASSISTANT_SELECTOR = '[data-message-author-role="assistant"]';
  const MUTATION_DEBOUNCE_MS = 800;
  const MUTATION_LOG_INTERVAL_MS = 3000;
  const DEBUG_PANEL_REFRESH_MS = 1000;
  const BACKFILL_ENABLE_WHEEL_FALLBACK = false;
  const KNOWN_GAP_NATIVE_PROBE_SCROLL_AMOUNTS = [480, 720, 960, 1200, 1600];
  const KNOWN_GAP_NATIVE_PROBE_MAX = 5;
  const KNOWN_GAP_NATIVE_PROBE_MAX_STEPS = 3;
  const KNOWN_GAP_NATIVE_PROBE_TOP_THRESHOLD = 200;
  const KNOWN_GAP_PROBE_TRUE_TOP_EPSILON = 5;
  const KNOWN_GAP_PROBE_STRATEGY = "continuous-upward-hydration-drive";
  const KNOWN_GAP_PROBE_MAX_TOTAL_MS = 240000;
  const KNOWN_GAP_PROBE_SOFT_STATUS_UPDATE_MS = 5000;
  const KNOWN_GAP_PROBE_MAX_TOTAL_STEPS = 400;
  const KNOWN_GAP_PROBE_MAX_HYDRATION_CYCLES = 80;
  const KNOWN_GAP_PROBE_STEP_WAIT_MS = 220;
  const KNOWN_GAP_PROBE_POST_SCROLL_WAIT_MS = 450;
  const KNOWN_GAP_PROBE_HYDRATION_WAIT_MS = 1100;
  const KNOWN_GAP_PROBE_STABLE_TOP_WAIT_MS = 2500;
  const KNOWN_GAP_PROBE_STABLE_TOP_EXTRA_CHECK_MS = 800;
  const KNOWN_GAP_PROBE_STABLE_TOP_CONFIRMATIONS_REQUIRED = 3;
  const KNOWN_GAP_PROBE_TOP_NUDGE_WAIT_MS = 1000;
  const KNOWN_GAP_PROBE_SCROLLHEIGHT_GROWTH_THRESHOLD = 20;
  const KNOWN_GAP_PROBE_BUSINESS_AUDIT_THROTTLE_MS = 800;
  const HIGHLIGHT_HOLD_MS = 1200;
  const HIGHLIGHT_FADE_MS = 600;
  const HIGHLIGHT_MS = HIGHLIGHT_HOLD_MS + HIGHLIGHT_FADE_MS;
  const COPY_RESET_MS = 1200;
  const SCROLL_SPY_PAUSE_MS = 2500;
  const STORAGE_PREFIX = "gpt-prompt-navigator";
  const TAB_ORDER = ["all", "time", "bookmarks", "tags"];
  const TIME_MODE_ORDER = ["month", "week", "day"];
  const FILE_NAME_REGEX = /[\w\u4e00-\u9fa5()[\]\-_. ]+\.(?:txt|pdf|docx?|xlsx?|pptx?|csv|json|md|zip|rar|7z)\b/gi;
  const IMAGE_FILE_REGEX = /\.(?:png|jpe?g|webp|gif|bmp|heic)$/i;

  const I18N = {
    zh: {
      myPrompts: "我的发文",
      settings: "设置",
      refresh: "刷新",
      collapse: "折叠",
      expand: "展开",
      all: "全部",
      time: "时间",
      bookmarks: "书签",
      tags: "标签",
      searchPlaceholder: "搜索我的发文...",
      noMatchingPrompts: "没有匹配的发文",
      noPromptsYet: "暂无发文",
      copy: "复制",
      copied: "已复制",
      attachment: "附件",
      attachmentLine: "附件{index}：{name}",
      imageOne: "图片：1 张",
      imageMany: "图片：{count} 张",
      quoteLine: "引用{index}：{text}",
      recordedPrefix: "记录 ",
      onlyMeta: "（仅包含附件/图片/引用）",
      bookmarkName: "书签名称",
      rename: "修改名称",
      removeBookmark: "取消书签",
      missingMessage: "消息未加载，请滚动/刷新当前会话后重试",
      month: "月视图",
      week: "周视图",
      day: "日视图",
      dateSearchPlaceholder: "输入日期搜索：YYYY/MM/DD",
      locate: "定位",
      clear: "清空",
      timeSearchPlaceholderMonth: "搜索年份 / 月份：2026、2026/05、202605、05、5月",
      timeSearchPlaceholderWeek: "搜索年份 / 月份 / 周：2026、2026/05、05、第4周",
      timeSearchPlaceholderDay: "搜索具体日期：20260524",
      timeSearchSummary: "时间匹配：{matched} 条｜无记录时间：{noTime} 条",
      timeFolderSearchSummary: "匹配 Folder：{folders} 个｜匹配消息：{messages} 条｜无记录时间：{noTime} 条",
      noTimeSearchHint: "无时间记录，未参与时间匹配",
      noRecordedTime: "无记录时间",
      weekNumber: "第 {count} 周",
      weekday1: "周一",
      weekday2: "周二",
      weekday3: "周三",
      weekday4: "周四",
      weekday5: "周五",
      weekday6: "周六",
      weekday7: "周日",
      earlyMorning: "凌晨 00:00-05:59",
      morning: "上午 06:00-11:59",
      noon: "中午 12:00-13:59",
      afternoon: "下午 14:00-17:59",
      evening: "晚上 18:00-23:59",
      noDateRecords: "没有找到该日期的记录",
      invalidDate: "日期格式不正确",
      allTags: "全部标签",
      enterTags: "请输入标签，用逗号分隔",
      noTagsYet: "还没有标签",
      noMatchingTags: "没有匹配的标签消息",
      defaultTab: "默认打开 Tab",
      visibleTabs: "显示哪些 Tab",
      defaultTimeView: "默认时间视图",
      visibleTimeModes: "显示哪些时间模式",
      pluginTheme: "插件主题",
      autoInverse: "自动反向，推荐",
      fixedLight: "固定浅色",
      fixedDark: "固定深色",
      followChatGPT: "跟随 ChatGPT",
      uiLanguage: "界面语言 / UI Language",
      chinese: "中文",
      english: "English",
      showQuotes: "显示引用",
      showImages: "显示图片",
      showAttachments: "显示附件",
      showRecordedTime: "显示记录时间",
      enableScrollSpy: "启用 Scroll Spy",
      enableEnhancedShortcuts: "启用增强快捷键",
      autoExpandCurrentFolder: "自动展开当前时间 Folder",
      previewDisplay: "Preview 显示",
      previewLines: "Preview 行数",
      previewLength: "Preview 字数",
      restoreDefaults: "恢复默认设置",
      resetPanelPosition: "重置浮窗位置",
      dataStorageLocation: "数据存储位置",
      copyStorageInfo: "复制存储信息",
      repairTimeIndex: "\u4fee\u590d\u5f53\u524d\u4f1a\u8bdd\u65f6\u95f4\u7d22\u5f15",
      timeIndexRepaired: "\u65f6\u95f4\u7d22\u5f15\u4fee\u590d\u5b8c\u6210\uff1a\u6062\u590d {count} \u6761\u8bb0\u5f55",
      timeIndexChecked: "\u65f6\u95f4\u7d22\u5f15\u5df2\u68c0\u67e5\uff1a\u6ca1\u6709\u53d1\u73b0\u53ef\u6062\u590d\u8bb0\u5f55",
      currentConversationId: "当前会话 ID：",
      storageIntro: "本插件数据只保存在本地浏览器 / Tampermonkey 中，不会上传服务器。",
      storageKeys: "使用的 storage keys：",
      themeStatus: "ChatGPT 当前主题：{chatgpt}｜插件当前主题：{plugin}",
      light: "浅色",
      dark: "深色",
      unknown: "未知",
      helpTitle: "帮助",
      helpShortcuts: "快捷键",
      helpPanelOps: "面板操作",
      helpStatus: "状态说明",
      helpTogglePanel: "Ctrl+Shift+P：显示 / 隐藏浮窗",
      helpSearch: "Ctrl+Shift+F：搜索",
      helpPrevNext: "Ctrl+Shift+↑ / ↓：上一条 / 下一条 user message",
      helpBookmark: "Ctrl+Shift+B：编辑当前消息书签",
      helpTags: "Ctrl+Shift+T：编辑当前消息标签",
      helpCopy: "Ctrl+Shift+C：复制当前消息",
      helpDrag: "拖拽标题栏：移动浮窗",
      helpResizeX: "右边缘：调整宽度",
      helpResizeY: "底边缘：调整高度",
      helpResizeBoth: "右下角：双向调整大小",
      helpCollapse: "折叠：mini header，仅保留顶部栏",
      helpHide: "隐藏：Ctrl+Shift+P，隐藏整个浮窗",
      helpSettings: "设置：进入设置专用视图",
      helpHelp: "Help：进入帮助专用视图",
      footer: "快捷键：Ctrl+Shift+P 呼出/隐藏，Ctrl+Shift+F 搜索",
      positionReset: "浮窗位置已重置",
      atLeastOneVisible: "至少保留一个可见项",
      debug: "Debug",
      debugCopy: "复制调试信息",
      debugPrintConsole: "打印到控制台"
    },
    en: {
      myPrompts: "My Prompts",
      settings: "Settings",
      refresh: "Refresh",
      collapse: "Collapse",
      expand: "Expand",
      all: "All",
      time: "Time",
      bookmarks: "Bookmarks",
      tags: "Tags",
      searchPlaceholder: "Search my prompts...",
      noMatchingPrompts: "No matching prompts",
      noPromptsYet: "No prompts yet",
      copy: "Copy",
      copied: "Copied",
      attachment: "Attachment",
      attachmentLine: "Attachment {index}: {name}",
      imageOne: "Image: 1",
      imageMany: "Images: {count}",
      quoteLine: "Quote {index}: {text}",
      recordedPrefix: "Recorded ",
      onlyMeta: "(Attachments/images/quotes only)",
      bookmarkName: "Bookmark name",
      rename: "Rename",
      removeBookmark: "Remove bookmark",
      missingMessage: "Message not loaded. Scroll or refresh this conversation and try again.",
      month: "Month",
      week: "Week",
      day: "Day",
      dateSearchPlaceholder: "Search date: YYYY/MM/DD",
      locate: "Go",
      clear: "Clear",
      timeSearchPlaceholderMonth: "Search year/month: 2026, 2026/05, 202605, 05",
      timeSearchPlaceholderWeek: "Search year/month/week: 2026, 2026/05, 05, Week 4",
      timeSearchPlaceholderDay: "Search exact date: 20260524",
      timeSearchSummary: "Matched with time: {matched} | No recorded time: {noTime}",
      timeFolderSearchSummary: "Matched folders: {folders} | Matched messages: {messages} | No recorded time: {noTime}",
      noTimeSearchHint: "No recorded time; not included in time matching",
      noRecordedTime: "No recorded time",
      weekNumber: "Week {count}",
      weekday1: "Mon",
      weekday2: "Tue",
      weekday3: "Wed",
      weekday4: "Thu",
      weekday5: "Fri",
      weekday6: "Sat",
      weekday7: "Sun",
      earlyMorning: "Late night 00:00-05:59",
      morning: "Morning 06:00-11:59",
      noon: "Noon 12:00-13:59",
      afternoon: "Afternoon 14:00-17:59",
      evening: "Evening 18:00-23:59",
      noDateRecords: "No records found for this date",
      invalidDate: "Invalid date format",
      allTags: "All tags",
      enterTags: "Enter tags, separated by commas",
      noTagsYet: "No tags yet",
      noMatchingTags: "No matching tagged messages",
      defaultTab: "Default tab",
      visibleTabs: "Visible tabs",
      defaultTimeView: "Default time view",
      visibleTimeModes: "Visible time modes",
      pluginTheme: "Plugin theme",
      autoInverse: "Auto inverse, recommended",
      fixedLight: "Light",
      fixedDark: "Dark",
      followChatGPT: "Follow ChatGPT",
      uiLanguage: "UI Language",
      chinese: "中文",
      english: "English",
      showQuotes: "Show quotes",
      showImages: "Show images",
      showAttachments: "Show attachments",
      showRecordedTime: "Show recorded time",
      enableScrollSpy: "Enable Scroll Spy",
      enableEnhancedShortcuts: "Enable enhanced shortcuts",
      autoExpandCurrentFolder: "Auto expand current folder",
      previewDisplay: "Preview display",
      previewLines: "Preview lines",
      previewLength: "Preview length",
      restoreDefaults: "Restore defaults",
      resetPanelPosition: "Reset panel position",
      dataStorageLocation: "Data storage location",
      copyStorageInfo: "Copy storage info",
      repairTimeIndex: "Repair Time Index",
      timeIndexRepaired: "Time index repaired: {count} records restored",
      timeIndexChecked: "Time index checked: no recoverable records found",
      currentConversationId: "Current conversation ID:",
      storageIntro: "This plugin stores data only in the local browser / Tampermonkey. Nothing is uploaded.",
      storageKeys: "Storage keys:",
      themeStatus: "ChatGPT theme: {chatgpt} | Plugin theme: {plugin}",
      light: "Light",
      dark: "Dark",
      unknown: "Unknown",
      helpTitle: "Help",
      helpShortcuts: "Shortcuts",
      helpPanelOps: "Panel",
      helpStatus: "States",
      helpTogglePanel: "Ctrl+Shift+P: Show / hide panel",
      helpSearch: "Ctrl+Shift+F: Search",
      helpPrevNext: "Ctrl+Shift+↑ / ↓: Previous / next user message",
      helpBookmark: "Ctrl+Shift+B: Edit bookmark for active message",
      helpTags: "Ctrl+Shift+T: Edit tags for active message",
      helpCopy: "Ctrl+Shift+C: Copy active message",
      helpDrag: "Drag title bar: Move panel",
      helpResizeX: "Right edge: Resize width",
      helpResizeY: "Bottom edge: Resize height",
      helpResizeBoth: "Bottom-right corner: Resize both",
      helpCollapse: "Collapse = mini header",
      helpHide: "Hide = Ctrl+Shift+P",
      helpSettings: "Settings = dedicated settings view",
      helpHelp: "Help = dedicated help view",
      footer: "Shortcuts: Ctrl+Shift+P show/hide, Ctrl+Shift+F search",
      positionReset: "Panel position reset",
      atLeastOneVisible: "Keep at least one item visible",
      debug: "Debug",
      debugCopy: "Copy Debug",
      debugPrintConsole: "Print to Console"
    }
  };

  const DEFAULT_PREFERENCES = {
    defaultTab: "all",
    visibleTabs: {
      all: true,
      time: true,
      bookmarks: true,
      tags: true
    },
    defaultTimeFolderMode: "month",
    visibleTimeModes: {
      month: true,
      week: true,
      day: true
    },
    showQuoteMeta: true,
    showImageMeta: true,
    showAttachmentMeta: true,
    showTimeLabel: true,
    enableScrollSpy: true,
    enableEnhancedShortcuts: true,
    maxPreviewLines: 3,
    maxPreviewLength: 120,
    autoExpandCurrentFolder: false,
    themeMode: "auto-inverse",
    uiLanguage: "zh"
  };

  const DEBUG_STATE = {
    scriptVersion: SCRIPT_VERSION,
    initializedAt: new Date().toISOString(),
    currentUrl: location.href,
    lastUrl: location.href,
    scanCount: 0,
    lastScanTime: null,
    lastRenderTime: null,
    userMessageCount: 0,
    assistantMessageCount: 0,
    renderedNavItemCount: 0,
    activeMessageId: null,
    isCollapsed: false,
    isPanelHidden: false,
    settingsMode: false,
    helpMode: false,
    beforeHelpWasCollapsed: false,
    lastHelpToggleAt: null,
    lastSettingsToggleAt: null,
    observerEnabled: false,
    observerConfig: {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "srcset", "alt", "aria-label", "class", "style"]
    },
    lastMutationTime: null,
    mutationTriggerCount: 0,
    lastMutationLogTime: null,
    ignoredMutationCount: 0,
    skippedRenderCount: 0,
    lastMessageHash: null,
    lastScanReason: null,
    delayedInitScanCount: 0,
    lastError: null,
    logs: [],
    userSelector: USER_SELECTOR,
    assistantSelector: ASSISTANT_SELECTOR,
    userSelectorCount: 0,
    assistantSelectorCount: 0,
    firstUserTextPreview: "",
    lastUserTextPreview: "",
    floatingPanelExists: false,
    navListExists: false,
    searchInputExists: false,
    debugPanelExists: false,
    observerEnabledAt: null,
    panelWidth: null,
    panelHeight: null,
    panelLeft: null,
    panelTop: null,
    panelRight: null,
    panelBottom: null,
    panelPositionMode: "default-right",
    lastResizeMode: null,
    resizeStartAt: null,
    resizeEndAt: null,
    miniResizeEnabled: true,
    lastMiniResizeAt: null,
    lastMiniResizeWidth: null,
    lastResizeHandleUsed: null,
    resizeHandlesEnabled: ["left", "right", "top", "bottom", "both"],
    lastDragMode: null,
    dragStartAt: null,
    dragEndAt: null,
    lastDragPointerDownAt: null,
    lastDragPointerDownTarget: null,
    lastDragBlockedReason: null,
    dragElementFromPoint: null,
    dragCurrentUrlHash: "",
    lastPositionResetAt: null,
    lastShortcut: null,
    lastEnhancedShortcut: null,
    shortcutTargetMessageId: null,
    searchResultActiveIndex: -1,
    lastCopiedMessageId: null,
    helpVisible: false,
    preferencesVisible: false,
    toastShown: false,
    attachmentMessageCount: 0,
    imageMessageCount: 0,
    topLevelQuoteDetectedCount: 0,
    quoteCardNodeCount: 0,
    quoteDetectSource: null,
    imageButtonDetectedCount: 0,
    imageAcceptedCount: 0,
    attachmentNodeCount: 0,
    attachmentRejectedFromBubbleCount: 0,
    attachmentRejectedPathLikeCount: 0,
    attachmentAcceptedCardCount: 0,
    lastRejectedAttachmentCandidate: null,
    mainTextBubbleSourceCount: 0,
    smartPreviewAppliedCount: 0,
    quotedContentMessageCount: 0,
    quoteDomDetectedCount: 0,
    imageCandidateCount: 0,
    messagesWithQuoteCount: 0,
    messagesWithRealTimeLabelCount: 0,
    messagesWithCapturedTimeLabelCount: 0,
    messagesWithRecordedDateTimeCount: 0,
    initialBaselineReady: false,
    lastUserSendActionAt: null,
    currentSessionCapturedMessageCount: 0,
    currentSessionNewMessageCapturedCount: 0,
    skippedHistoricalCaptureCount: 0,
    skippedNonTailHistoricalMessageCount: 0,
    lastCapturedMessageId: null,
    capturedTimeStorageKey: null,
    capturedTimeStoredCount: 0,
    bookmarkCount: 0,
    activeViewTab: "all",
    timeFolderMode: "month",
    monthFolderCount: 0,
    weekFolderCount: 0,
    dayFolderCount: 0,
    timeFolderCount: 0,
    noTimeMessageCount: 0,
    lastBookmarkAction: null,
    lastBookmarkMessageId: null,
    lastBookmarkName: null,
    lastBookmarkSearchKeyword: "",
    bookmarkSearchResultCount: 0,
    bookmarkSearchMatchedByNameCount: 0,
    lastTimeSearch: "",
    lastTimeSearchMatched: null,
    lastTimeSearchTargetKey: null,
    lastTimeFuzzySearchKeyword: "",
    lastTimeFuzzySearchNormalized: null,
    timeFuzzySearchResultCount: 0,
    timeFuzzySearchActive: false,
    timeFuzzySearchFirstMessageId: null,
    lastTimeFuzzySearchReason: null,
    timeSearchDraft: "",
    lastTimeSearchExecuteTrigger: null,
    lastTimeSearchExecutedAt: null,
    timeSearchMatchedMessageIdsCount: 0,
    timeSearchUsesTextSearch: false,
    timeSearchMode: "folder-filter",
    timeSearchAutoJumpEnabled: false,
    timeSearchRealtimeEnabled: true,
    timeSearchIncludeNoTimeMessages: true,
    timeSearchMatchedTimedCount: 0,
    timeSearchNoTimeCount: 0,
    lastTimeSearchInputAt: null,
    lastTimeSearchDebounceMs: 250,
    weekFolderLabelMode: "week-of-month-primary",
    timeSearchAutoExpandEnabled: false,
    timeSearchModifiedExpandedFolders: false,
    timeSearchFolderCacheHit: false,
    timeSearchFolderCacheRebuildCount: 0,
    timeSearchMatchedFolderCount: 0,
    timeSearchMatchedMessageCount: 0,
    timeSearchRenderMode: null,
    timeSearchLastRenderCostMs: null,
    lastTimeSearchTrigger: null,
    preferences: { ...DEFAULT_PREFERENCES },
    preferencesStorageKey: null,
    lastPreferenceAction: null,
    visibleTabs: { ...DEFAULT_PREFERENCES.visibleTabs },
    hiddenTabs: [],
    activeTabFallbackReason: null,
    visibleTimeModes: { ...DEFAULT_PREFERENCES.visibleTimeModes },
    hiddenTimeModes: [],
    timeModeFallbackReason: null,
    themeMode: "auto-inverse",
    detectedChatGPTTheme: null,
    appliedPluginTheme: null,
    lastThemeUpdateAt: null,
    cssVarThemeApplied: false,
    gpnBgResolved: null,
    gpnSurfaceResolved: null,
    gpnTextResolved: null,
    gpnBorderResolved: null,
    gpnAccentResolved: null,
    themeVarSourceElement: null,
    accentSource: null,
    accentResolvedFromChatGPT: false,
    accentSoftResolved: null,
    accentStrongResolved: null,
    accentResolvedFromRenderedUI: false,
    accentAppliedToControls: true,
    cssLinkValue: null,
    cssSelectionValue: null,
    accentSoftRaw: null,
    accentStrongRaw: null,
    accentStrongDerived: null,
    accentTextOnAccent: null,
    accentRejectedReason: null,
    accentFallbackPreventedBlack: false,
    accentColorValidationPassed: false,
    accentComposerButtonFound: false,
    accentComposerButtonSelector: null,
    accentComposerButtonBackground: null,
    accentComposerButtonRejectedReason: null,
    accentAutoResolveScheduledAt: null,
    accentAutoResolveReason: null,
    accentAutoResolveAttemptCount: 0,
    accentAutoResolveLastAttemptAt: null,
    accentAutoResolveSucceededAt: null,
    accentAutoResolveSucceededWithoutSettings: false,
    accentSourcePriority: "composer-submit-button-first",
    accentAppliedToTabs: true,
    accentAppliedToTimeModes: true,
    accentAppliedToTagChips: true,
    accentAppliedToExpandButtons: true,
    accentAppliedToSearchFocus: true,
    activeItemAccentUsesResolvedAccent: true,
    jumpHighlightAccentUsesResolvedAccent: true,
    uiLanguage: "zh",
    lastLanguageChangeAt: null,
    tagStorageKey: null,
    tagCount: 0,
    taggedMessageCount: 0,
    activeTagFilter: "",
    lastTagAction: null,
    lastTaggedMessageId: null,
    lastTags: [],
    scrollSpyEnabled: false,
    scrollSpyObservedCount: 0,
    scrollSpyActiveMessageId: null,
    scrollSpyLastUpdateAt: null,
    scrollSpyPausedUntil: null,
    storageInfoCopiedAt: null,
    storageKeysShown: [],
    lastClickedNavMessageId: null,
    lastClickedNavIndex: null,
    lastScrollTargetMessageId: null,
    lastScrollTargetFound: false,
    lastScrollTargetSource: null,
    lastScrollMismatchWarning: null,
    pendingScrollTargetMessageId: null,
    currentJumpToken: null,
    jumpCorrectionCancelled: false,
    jumpCorrectionCancelReason: null,
    lastUserInterruptDuringJumpAt: null,
    secondCorrectionSkippedReason: null,
    finalCorrectionSkippedReason: null,
    navListAutoScrollSuppressed: false,
    navListScrollTopBeforeRender: null,
    navListScrollTopAfterRender: null,
    navListScrollRestored: false,
    navListAutoScrollReason: null,
    activeItemMissingNoFallback: false,
    preventedFallbackToFirstItem: false,
    lastJumpCorrectionAt: null,
    lastJumpCorrectionNeeded: false,
    lastJumpCorrectionDistance: null,
    jumpCorrectionCount: 0,
    lastExpandedMessageId: null,
    lastExpandedAction: null,
    ignoreItemClickUntil: 0,
    lastIgnoredItemClickReason: null,
    lastItemClickTargetTag: null,
    lastItemClickIgnored: false,
    lastJumpZoneClickedMessageId: null,
    lastExpandWasLocalUpdate: false,
    lastItemContainerClickRemoved: true,
    timeFolderDefaultCollapsed: true,
    childFolderDefaultCollapsed: true,
    autoExpandSuppressedInSearch: true,
    settingsOpenedFromCollapsed: false,
    lastSettingsOpenSource: null,
    lastHighlightedMessageId: null,
    highlightFadeEnabled: true,
    lastHighlightClearedAt: null,
    mediaHydrationRescanScheduledCount: 0,
    mediaHydrationRescanRunCount: 0,
    mediaHydrationRenderSuppressedCount: 0,
    mediaHydrationMessageIds: [],
    lastMediaHydrationRescanAt: null,
    lastMediaHydrationChangedMessageId: null,
    observedMediaImageCount: 0,
    imageLoadTriggeredRescanCount: 0,
    lastImageLoadMessageId: null,
    mediaAttributeMutationCount: 0,
    lastMediaAttributeMutationAt: null,
    lastMediaAttributeName: null,
    lastRichContentSignature: null,
    richContentSignatureChangedCount: 0,
    lastRichContentChangedMessageId: null,
    imageAcceptedByAriaOnlyCount: 0,
    imagePendingSizeCount: 0,
    renderSkippedBecauseHashUnchanged: 0,
    panelMutationIgnoredCount: 0
    ,
    registryEnabled: true,
    registryMessageCount: 0,
    visibleDomUserMessageCount: 0,
    registryInsertedCount: 0,
    registryUpdatedCount: 0,
    registryRetainedOffscreenCount: 0,
    orderMergeInsertedBeforeCount: 0,
    orderMergeInsertedAfterCount: 0,
    orderMergeNoAnchorCount: 0,
    firstRegistryMessageId: null,
    firstVisibleDomMessageId: null,
    registryOrderStable: true,
    registryStorageKey: null,
    registryLoadedFromStorageCount: 0,
    registrySavedCount: 0,
    cachedMessageClickMissingDomCount: 0,
    preferencesScope: "global",
    globalPreferencesStorageKey: null,
    loadedGlobalPreferences: false,
    migratedPreferencesFromConversationKey: false,
    legacyConversationPreferencesKey: null,
    visibleTabsSource: "global",
    visibleTimeModesSource: "global",
    themeModeSource: "global",
    uiLanguageSource: "global",
    lastTimeSearchQueryType: null,
    lastTimeSearchParsedMonth: null,
    lastTimeSearchParsedDay: null,
    lastTimeSearchParsedYear: null,
    lastTimeSearchStructuredMatch: false,
    lastTimeSearchUsedBroadIncludes: false,
    lastTimeSearchRejectedBroadTermCount: 0,
    lastTimeSearchMatchedFolderKeys: [],
    lastTimeSearchMatchedReasons: [],
    timeSearchModeSpecificParser: true,
    lastTimeSearchViewMode: null,
    lastTimeSearchValid: false,
    lastTimeSearchInvalidReason: null,
    lastTimeSearchAllowedQueryTypes: [],
    lastTimeSearchDisallowedByMode: false,
    lastTimeSearchUsedMessageText: false,
    navListScrollRestoredAfterRegistryMerge: false,
    registryMergeRenderSuppressedAutoScroll: false,
    preventedScrollTopResetToZero: false,
    conversationSwitchCount: 0,
    lastConversationId: null,
    currentConversationId: null,
    previousConversationId: null,
    conversationSwitchInProgress: false,
    conversationScopedStateResetAt: null,
    staleScanSkippedCount: 0,
    registryClearedOnConversationChange: false,
    renderedEmptyDuringConversationSwitch: false,
    registryStorageKeyAfterSwitch: null,
    loadedRegistryCountAfterSwitch: 0,
    headerBackgroundTransparent: true,
    timeViewContainerTransparent: true,
    tagViewContainerTransparent: true,
    topBarExtraBackgroundRemoved: true
    ,
    expandButtonAccentApplied: true,
    expandButtonUsesResolvedAccent: true,
    rawConversationIdFromUrl: null,
    conversationContextPrefix: null,
    normalizedConversationKey: null,
    conversationIdFallbackUsed: false,
    getConversationIdSource: null,
    tabInstanceId: null,
    registryLastWriteTabInstanceId: null,
    registryLastReadTabInstanceId: null,
    registryRejectedWrongConversation: false,
    registryRejectedWrongConversationCount: 0,
    registryLoadedConversationId: null,
    registryExpectedConversationId: null,
    registryLoadedTabInstanceId: null,
    registrySavedConversationId: null,
    mergeSkippedStaleConversationCount: 0,
    staleMergeSkippedCount: 0,
    scanConversationId: null,
    stateConversationIdAtScan: null,
    lastSkippedScanReason: null,
    conversationHardResetComplete: false,
    renderedEmptyBeforeLoadingNewConversation: false,
    oldConversationMessageCountBeforeReset: 0,
    newConversationMessageCountAfterLoad: 0,
    conversationChangeDelayedScanScheduled: false,
    crossTabStorageIgnoredCount: 0,
    crossTabDifferentConversationIgnored: true,
    lazyJumpInProgress: false,
    pendingLazyJumpMessageId: null,
    lazyJumpDirection: null,
    lazyJumpAttemptCount: 0,
    lazyJumpFoundTarget: false,
    lazyJumpCancelled: false,
    lazyJumpCancelReason: null,
    lazyJumpFailedReason: null,
    lazyJumpScrollContainerFound: false,
    lazyJumpScrollContainerDescriptor: null,
    scrollToMissingTargetStartedLazyJump: false,
    scrollToMissingTargetDidNotFallback: true,
    capturedTimeCurrentStorageKey: null,
    capturedTimeLegacyKeysChecked: [],
    capturedTimeLegacyKeysFound: [],
    capturedTimeLegacyMatchedCount: 0,
    capturedTimeMigratedCount: 0,
    capturedTimeMigrationRanAt: null,
    capturedTimeInvalidLegacyValueCount: 0,
    capturedTimeMergedFromLegacyCount: 0,
    capturedTimeCurrentBeforeMergeCount: 0,
    capturedTimeCurrentAfterMergeCount: 0,
    capturedTimeBackfilledFromRegistryCount: 0,
    capturedTimeRegistryRecordsWithTimeCount: 0,
    capturedTimeRegistryBackfillRanAt: null,
    capturedTimeRegistryBackfillSaved: false,
    preservedExistingTimeOnMergeCount: 0,
    preventedNullTimeOverwriteCount: 0,
    capturedAtRestoredDuringMergeCount: 0,
    lastTimePreservedMessageId: null,
    manualTimeRepairClickedAt: null,
    manualTimeRepairRestoredCount: 0,
    manualTimeRepairLegacyRecoveredCount: 0,
    manualTimeRepairRegistryRecoveredCount: 0,
    manualTimeRepairCurrentCountAfter: 0,
    automaticTimeRepairRanAt: null,
    automaticTimeRepairRestoredCount: 0,
    automaticTimeRepairDidNotScroll: true,
    lightAllViewContainerTransparent: true,
    lightAllViewExtraBackgroundRemoved: true,
    lightAllViewItemBackgroundRemoved: true,
    lightAllViewUsesBorderOnlyCards: true,
    lightAllViewActiveUsesBorderOnly: true,
    jumpHighlightUsesAccent: true,
    jumpHighlightAccentColor: null,
    jumpHighlightAccentSoftColor: null,
    lastHighlightSource: null,
    lastHighlightDidNotTouchNativeChatGPTHighlight: true,
    jumpFailureCount: 0,
    lastJumpFailureReason: null,
    lastJumpSuccessAt: null,
    lastJumpFailureAt: null,
    scrollVerifiedAfterJump: false,
    scrollVerificationFailedReason: null,
    targetVisibleAfterScroll: false,
    lazyJumpMaxAttempts: 8,
    lazyJumpFinalAttemptCount: 0,
    lazyJumpStoppedBeforeFullBackfill: true,
    lazyJumpDidNotCallBackend: true,
    conversationIdentity: null,
    isRealConversation: false,
    isDraftConversation: false,
    draftConversationKey: null,
    realConversationKey: null,
    draftRegistryKey: null,
    draftCapturedTimesKey: null,
    draftViewStateKey: null,
    draftRegistryMessageCount: 0,
    draftCapturedTimeCount: 0,
    draftMigrationRanAt: null,
    draftMigrationFromKey: null,
    draftMigrationToKey: null,
    draftMigrationMessageCount: 0,
    draftMigrationCapturedTimeCount: 0,
    draftMigrationSkippedReason: null,
    draftMigrationSuccess: false,
    routeAutoCollapsed: false,
    routeAutoCollapseReason: null,
    beforeRouteAutoCollapseCollapsed: null,
    beforeRouteAutoCollapseHidden: null,
    autoCollapseMatchedSelector: null,
    autoCollapseCurrentHash: null,
    autoCollapseCurrentPath: null,
    autoCollapseManualOverride: false,
    autoCollapseRestoreAt: null
  };

  function createDefaultBackfillState() {
    return {
      status: "idle",
      runId: null,
      cancelRequested: false,
      startedAt: null,
      finishedAt: null,
      lastError: null,
      batchCount: 0,
      scannedVisibleCount: 0,
      registryCount: 0,
      direction: "up",
      scrollTargetDescriptor: null,
      scrollTopBefore: null,
      scrollTopAfter: null,
      scrollDelta: null,
      scrollHeight: null,
      clientHeight: null,
      windowScrollYBefore: null,
      windowScrollYAfter: null,
      lastStopReason: null,
      lastBatchStartedAt: null,
      lastBatchFinishedAt: null,
      lastScrollAttemptAt: null,
      lastScrollWorked: false,
      scrollMethod: null,
      anchorMessageIdBefore: null,
      anchorMessageIdAfter: null,
      anchorTopBefore: null,
      anchorTopAfter: null,
      anchorBottomBefore: null,
      anchorBottomAfter: null,
      anchorDelta: null,
      firstVisibleDomMessageIdBefore: null,
      firstVisibleDomMessageIdAfter: null,
      firstRegistryMessageIdAtBackfill: null,
      anchorScrollAttempted: false,
      anchorScrollWorked: false,
      anchorCandidateCount: 0,
      anchorCandidateTriedCount: 0,
      anchorCandidateIds: [],
      anchorTriedIds: [],
      anchorRawCandidateCount: 0,
      anchorRankedCandidateCount: 0,
      anchorRelaxedCandidateCount: 0,
      anchorRawCandidateIds: [],
      anchorRankedCandidateIds: [],
      anchorRelaxedCandidateIds: [],
      anchorRejectedCandidateCount: 0,
      anchorRejectedReasons: [],
      relaxedAnchorTriedCount: 0,
      relaxedAnchorTriedIds: [],
      relaxedAnchorWorkedId: null,
      anchorAttemptHistory: [],
      relaxedAnchorAttemptHistory: [],
      anchorWorkedId: null,
      anchorFailureReason: null,
      anchorStrategy: null,
      anchorRegistryIndexBefore: null,
      anchorRegistryIndexAfter: null,
      firstVisibleRegistryIndexBefore: null,
      firstVisibleRegistryIndexAfter: null,
      progressRoundCount: 0,
      noProgressRoundCount: 0,
      noProgressRoundLimit: 6,
      lastProgressReason: null,
      progressComparedToBest: false,
      bestProgressUpdatedAt: null,
      anchorMovedOnlyIgnoredAsProgress: false,
      lastBestProgressReason: null,
      bestFirstVisibleRegistryIndex: null,
      bestRegistryCount: 0,
      bestFirstVisibleDomMessageId: null,
      bestVisibleDomUserMessageCount: 0,
      viewportSignature: null,
      recentViewportSignatures: [],
      repeatedViewportSignatureCount: 0,
      uniqueRecentViewportSignatureCount: 0,
      oscillationDetected: false,
      oscillationSignature: null,
      oscillationPattern: null,
      oscillationStopTriggeredAt: null,
      roundsSinceBestProgress: 0,
      topProbeCount: 0,
      topProbeMax: 6,
      topProbeActive: false,
      anchorBlacklistedIds: [],
      anchorReverseMovementCount: 0,
      lastRejectedAnchorReason: null,
      blacklistedRelaxedCandidateExcludedCount: 0,
      blacklistedCandidateTriedCount: 0,
      relaxedSkippedBlacklistedIds: [],
      allCandidatesBlacklisted: false,
      relaxedLaterCandidateExcludedCount: 0,
      relaxedSkippedLaterCandidateIds: [],
      relaxedMonotonicGuardEnabled: true,
      relaxedRejectedByBestIndexCount: 0,
      relaxedRejectedByCurrentIndexCount: 0,
      visualAnchorMovedOnly: false,
      visualMoveRejectedAsProgress: false,
      anchorRejectedBecauseLaterThanBest: false,
      anchorRejectedBecauseReverseAfterScroll: false,
      anchorWorkedRequiresBestProgress: true,
      reverseMovementDetected: false,
      reverseMovementFromIndex: null,
      reverseMovementToIndex: null,
      reverseMovementAnchorId: null,
      reverseMovementStoppedImmediately: false,
      wheelFallbackAttempted: false,
      wheelFallbackAttemptCount: 0,
      wheelFallbackWorked: false,
      wheelFallbackLastDeltaY: null,
      wheelFallbackTargetDescriptor: null,
      wheelFallbackEnabled: BACKFILL_ENABLE_WHEEL_FALLBACK,
      wheelFallbackSkippedReason: BACKFILL_ENABLE_WHEEL_FALLBACK ? null : "disabled-for-stability",
      pageUpFallbackAttempted: false,
      pageUpFallbackWorked: false,
      fallbackProgressReason: null,
      wheelFallbackSignatureBefore: null,
      wheelFallbackSignatureAfter: null,
      topHydrationProbeAttempted: false,
      topHydrationProbeCount: 0,
      topHydrationProbeWorked: false,
      topHydrationProbeReason: null,
      topHydrationProbeRegistryCountBefore: null,
      topHydrationProbeRegistryCountAfter: null,
      topHydrationProbeFirstRegistryBefore: null,
      topHydrationProbeFirstRegistryAfter: null,
      topHydrationProbeFirstVisibleIndexBefore: null,
      topHydrationProbeFirstVisibleIndexAfter: null,
      visualScrollObservedButNoHydration: false,
      scrollMetricTrustedAsSuccess: false,
      userInterruptGuardEnabled: false,
      userInterruptDetected: false,
      userInterruptType: null,
      userInterruptAt: null,
      userInterruptCancelledBackfill: false,
      backfillTraceEvents: [],
      backfillHumanStatus: null,
      hydrationAuditBefore: null,
      hydrationAuditAfter: null,
      hydrationAuditDelayed: null,
      hydrationAuditDelayedRanAt: null,
      hydrationAuditDelayedRegistryDelta: null,
      hydrationAuditDelayedVisibleDomDelta: null,
      hydrationDetected: false,
      hydrationDetectionReason: null,
      hydrationRegistryDelta: 0,
      hydrationVisibleDomDelta: 0,
      hydrationFirstRegistryChanged: false,
      hydrationFirstVisibleIndexImproved: false,
      hydrationDiscoveredNewEarlierMessage: false,
      hydrationRevealedKnownCachedMessage: false,
      hydrationOnlyVisualMovement: false,
      rawAnchorFailureReason: null,
      knownTopGapAtStop: null,
      safeAnchorStalledKnownGap: false,
      knownGapProbeStatus: "idle",
      knownGapProbeRunId: null,
      knownGapProbeIsRunning: false,
      knownGapProbeCanCopyFinalDebug: true,
      knownGapProbeAttempted: false,
      knownGapProbeCount: 0,
      knownGapProbeMax: KNOWN_GAP_NATIVE_PROBE_MAX,
      knownGapProbeReason: null,
      knownGapProbeHumanStatus: null,
      knownGapProbeStrategy: KNOWN_GAP_PROBE_STRATEGY,
      knownGapProbeHydrationDetected: false,
      knownGapProbeVisualOnly: false,
      knownGapProbeSafetyStopped: false,
      knownGapProbeRegistryCountBefore: null,
      knownGapProbeRegistryCountAfter: null,
      knownGapProbeRegistryDelta: 0,
      knownGapProbeVisibleDomCountBefore: null,
      knownGapProbeVisibleDomCountAfter: null,
      knownGapProbeVisibleDomDelta: 0,
      knownGapProbeFirstVisibleIndexBefore: null,
      knownGapProbeFirstVisibleIndexAfter: null,
      knownGapProbeKnownGapBefore: null,
      knownGapProbeKnownGapAfter: null,
      knownGapProbeFirstRegistryBefore: null,
      knownGapProbeFirstRegistryAfter: null,
      knownGapProbeBefore: null,
      knownGapProbeAfter: null,
      knownGapProbeDelayed: null,
      knownGapProbeNativeScrollAttempted: false,
      knownGapProbeNativeScrollWorked: false,
      knownGapProbeJumpToTopAttempted: false,
      knownGapProbeJumpToTopWorked: false,
      knownGapProbeScrollMethod: null,
      knownGapProbeScrollTargetDescriptor: null,
      knownGapProbeScrollAmount: null,
      knownGapProbeInitialScrollTop: null,
      knownGapProbeFinalScrollTop: null,
      knownGapProbeInitialScrollHeight: null,
      knownGapProbeFinalScrollHeight: null,
      knownGapProbeTotalScrollHeightDelta: 0,
      knownGapProbeScrollTopBefore: null,
      knownGapProbeScrollTopAfter: null,
      knownGapProbeScrollTopAfterImmediate: null,
      knownGapProbeScrollTopAfterWait: null,
      knownGapProbeScrollHeightBefore: null,
      knownGapProbeScrollHeightAfterImmediate: null,
      knownGapProbeScrollHeightAfterWait: null,
      knownGapProbeScrollHeightDelta: 0,
      knownGapProbeClientHeight: null,
      knownGapProbeReachedTopThreshold: false,
      knownGapProbeTrueTopEpsilon: KNOWN_GAP_PROBE_TRUE_TOP_EPSILON,
      knownGapProbeReachedTrueTop: false,
      knownGapProbeStableAtTop: false,
      knownGapProbeStableAtTopWaitMs: KNOWN_GAP_PROBE_STABLE_TOP_WAIT_MS,
      knownGapProbeStableTopConfirmationCount: 0,
      knownGapProbeStableTopConfirmationsRequired: KNOWN_GAP_PROBE_STABLE_TOP_CONFIRMATIONS_REQUIRED,
      knownGapProbeStableTopConfirmationLabel: "0/" + KNOWN_GAP_PROBE_STABLE_TOP_CONFIRMATIONS_REQUIRED,
      knownGapProbeEstimatedPhase: "idle",
      knownGapProbeStableTopResetCount: 0,
      knownGapProbeStableTopResetReason: null,
      knownGapProbeDomHydrationDriveEnabled: true,
      knownGapProbeStoppedAfterStableTopConfirmations: false,
      knownGapProbeTopNudgeCount: 0,
      knownGapProbeProgressDetected: false,
      knownGapProbeProgressReason: null,
      knownGapProbeBestKnownGap: null,
      knownGapProbeBestFirstVisibleIndex: null,
      knownGapProbeProgressEventCount: 0,
      knownGapProbeProgressHistory: [],
      knownGapProbeReverseIndexObserved: false,
      knownGapProbeReverseIndexIgnoredInBackfillMode: false,
      knownGapProbeReverseIndexIgnoredReason: null,
      knownGapProbePostHydrationSettleNeeded: false,
      knownGapProbeLastHydrationAt: null,
      knownGapProbeLastAnchorCompensationAt: null,
      knownGapProbeMutationCountBeforeStableWait: null,
      knownGapProbeMutationCountAfterStableWait: null,
      knownGapProbeMessageHashBeforeStableWait: null,
      knownGapProbeMessageHashAfterStableWait: null,
      knownGapProbeScrollHeightIncreased: false,
      knownGapProbeAnchorCompensatedScrollTop: false,
      knownGapProbeTopHydrationCycleDetected: false,
      knownGapProbeHydrationCycleCount: 0,
      knownGapProbeAnchorCompensationCount: 0,
      knownGapProbeMaxTotalMs: KNOWN_GAP_PROBE_MAX_TOTAL_MS,
      knownGapProbeTotalDurationMs: 0,
      knownGapProbeMaxTotalSteps: KNOWN_GAP_PROBE_MAX_TOTAL_STEPS,
      knownGapProbeTotalStepCount: 0,
      knownGapProbeMaxHydrationCycles: KNOWN_GAP_PROBE_MAX_HYDRATION_CYCLES,
      knownGapProbeStoppedBecauseMaxBudget: false,
      knownGapProbeBudgetStopPhase: null,
      knownGapProbeStartUrl: null,
      knownGapProbeEndUrl: null,
      knownGapProbeStartConversationId: null,
      knownGapProbeEndConversationId: null,
      knownGapProbeStartConversationKey: null,
      knownGapProbeEndConversationKey: null,
      knownGapProbeStartUserMessageCount: null,
      knownGapProbeCancelledByConversationChange: false,
      knownGapProbeCancelReason: null,
      knownGapProbeStepCount: 0,
      knownGapProbeStepHistory: [],
      knownGapProbeCycleHistory: [],
      knownGapProbeWaitMsAfterTop: null,
      knownGapProbeWindowScrollYBefore: null,
      knownGapProbeWindowScrollYAfter: null,
      knownGapProbeTargetCandidates: [],
      knownGapProbeAttemptHistory: [],
      knownGapProbeEarlierDomAnchorAttempted: false,
      knownGapProbeEarlierDomAnchorWorked: false,
      knownGapProbeEarlierDomAnchorCandidateIds: [],
      knownGapProbeEarlierDomAnchorRejectedIds: [],
      completionConfidence: null
    };
  }

  const state = {
    panel: null,
    navList: null,
    searchInput: null,
    debugPanel: null,
    helpPanel: null,
    settingsPanel: null,
    tabs: null,
    observer: null,
    themeObserver: null,
    composerAccentObserver: null,
    accentAutoResolveTimers: [],
    accentAutoResolveDebounce: null,
    mutationTimer: null,
    urlTimer: null,
    debugRenderTimer: null,
    debugVisible: false,
    helpVisible: false,
    beforeHelpState: null,
    settingsVisible: false,
    collapsed: false,
    hidden: false,
    userMessages: [],
    messageHash: "",
    lastRenderedHash: "",
    lastRenderedUrl: "",
    lastRenderedSearch: "",
    lastUrl: location.href,
    activeMessageId: null,
    expandedMessageIds: new Set(),
    activeTab: "all",
    timeFolderMode: "month",
    expandedTimeFolders: {},
    lastTimeSearch: "",
    timeSearchKeyword: "",
    timeSearchDraft: "",
    timeSearchActive: false,
    timeSearchMatchedMessageIds: new Set(),
    timeSearchMatchedMessageOrder: [],
    timeSearchActiveIndex: -1,
    timeSearchDebounceTimer: null,
    timeFolderCache: {
      messageHash: "",
      mode: "",
      textSearch: "",
      folders: null,
      noTimeMessages: [],
      folderSearchIndex: []
    },
    activeTagFilter: "",
    bookmarks: {},
    tags: {},
    preferences: { ...DEFAULT_PREFERENCES },
    capturedAtById: {},
    seenMessageIds: new Set(),
    initialBaselineReady: false,
    lastUserSendActionAt: null,
    currentConversationId: getConversationId(),
    lastConversationIdentity: null,
    lastJumpDiagnostics: {},
    routeAutoCollapsed: false,
    beforeRouteAutoCollapseCollapsed: null,
    beforeRouteAutoCollapseHidden: null,
    routeAutoCollapseReason: null,
    isSwitchingConversation: false,
    conversationSwitchStartedAt: 0,
    tabInstanceId: null,
    lazyJumpInProgress: false,
    pendingLazyJumpMessageId: null,
    lazyJumpCancelCleanup: null,
    resize: null,
    dragState: null,
    scrollSpyObserver: null,
    scrollSpyScrollHandler: null,
    scrollSpyPausedUntil: 0,
    scrollSpyLastListScrollAt: 0,
    scrollSpyLastLogAt: 0,
    pendingScrollTargetMessageId: null,
    currentJumpToken: null,
    jumpInterrupted: false,
    jumpCorrectionTimers: [],
    jumpInterruptCleanup: null,
    programmaticScrollUntil: 0,
    ignoreItemClickUntil: 0,
    mediaHydrationRescanTimers: new Map(),
    mediaHydrationRetryCountById: new Map(),
    observedMediaImages: new WeakSet(),
    highlightTimers: new WeakMap(),
    mediaImageErrorWarned: new WeakSet(),
    richContentSignatureById: new Map(),
    messageRegistryByConversation: new Map(),
    messageRegistry: new Map(),
    messageOrder: [],
    backfill: createDefaultBackfillState(),
    backfillInterruptCleanup: null,
    knownGapProbeInterruptCleanup: null,
    lastMediaHydrationLogAt: 0,
    searchResultActiveIndex: -1
  };

  function appendBackfillTraceEvent(phase, action, details = {}) {
    if (!state.backfill) return;
    const trace = Array.isArray(state.backfill.backfillTraceEvents) ? state.backfill.backfillTraceEvents.slice(-79) : [];
    trace.push({
      time: new Date().toISOString(),
      phase: phase || null,
      action: action || null,
      anchorId: details.anchorId || null,
      beforeIndex: details.beforeIndex,
      afterIndex: details.afterIndex,
      bestIndex: state.backfill.bestFirstVisibleRegistryIndex,
      registryCount: state.messageRegistry ? state.messageRegistry.size : Number(state.backfill.registryCount || 0),
      knownGapBefore: details.knownGapBefore,
      knownGapAfter: details.knownGapAfter,
      registryCountBefore: details.registryCountBefore,
      registryCountAfter: details.registryCountAfter,
      targetDescriptor: details.targetDescriptor || null,
      scrollMethod: details.scrollMethod || null,
      scrollAmount: details.scrollAmount,
      result: details.result || null,
      reason: details.reason || null
    });
    state.backfill.backfillTraceEvents = trace;
  }

  function getBackfillHumanStatus(backfill = state.backfill) {
    if (!backfill) return "Backfill idle.";
    if (backfill.status === "running") {
      if (backfill.topProbeActive || backfill.topHydrationProbeAttempted) return "Backfill is probing the loaded top for older hydrated messages.";
      return "Backfill is scanning and trying safe upward hydration.";
    }
    if (backfill.status === "completed") {
      if (backfill.lastError === "completed-known-start-stable") return "Stopped at the earliest known loaded message; no more safe hydration was observed.";
      return "Backfill completed.";
    }
    if (backfill.status === "failed") {
      if (backfill.lastError === "unsafe-reverse-anchor-prevented") return "Stopped: unsafe reverse anchor movement was detected.";
      if (backfill.lastError === "safe-anchor-stalled-known-gap" || backfill.lastError === "known-top-gap-stalled") return "Stopped: there are still known messages above the viewport, but no safe anchor can move upward without reversing.";
      if (backfill.lastError === "stalled-no-progress") return "Stopped: no older messages were hydrated after safe attempts.";
      if (backfill.lastError === "oscillation-detected") return "Stopped: repeated viewport oscillation was detected.";
      return "Backfill stopped with an error.";
    }
    if (backfill.status === "cancelled" || backfill.status === "cancelling") return "Backfill was cancelled.";
    return "Backfill idle.";
  }

  function getKnownGapProbeStableTopConfirmationLabel(probe = state.backfill) {
    const required = Number(probe && probe.knownGapProbeStableTopConfirmationsRequired || KNOWN_GAP_PROBE_STABLE_TOP_CONFIRMATIONS_REQUIRED);
    const count = Math.max(0, Math.min(required, Number(probe && probe.knownGapProbeStableTopConfirmationCount || 0)));
    return count + "/" + required;
  }

  function getKnownGapProbeEstimatedPhase(probe = state.backfill) {
    if (!probe || !probe.knownGapProbeStatus || probe.knownGapProbeStatus === "idle") return "idle";
    if (probe.knownGapProbeStatus === "success") return "stable-true-top-confirmed";
    if (probe.knownGapProbeStatus === "failed") return probe.knownGapProbeStoppedBecauseMaxBudget ? "max-budget-stopped" : "failed";
    if (probe.knownGapProbeStatus === "cancelled") return probe.knownGapProbeCancelledByConversationChange ? "conversation-changed-cancelled" : "cancelled";
    const finalScrollTop = Number(probe.knownGapProbeFinalScrollTop);
    const atTrueTop = Number.isFinite(finalScrollTop) && finalScrollTop <= Number(probe.knownGapProbeTrueTopEpsilon || KNOWN_GAP_PROBE_TRUE_TOP_EPSILON);
    if (probe.knownGapProbeReachedTopThreshold || atTrueTop || Number(probe.knownGapProbeStableTopConfirmationCount || 0) > 0) return "stable-top-confirmation";
    if (probe.knownGapProbeAnchorCompensatedScrollTop) return "hydration-anchor-compensation";
    if (probe.knownGapProbeTopHydrationCycleDetected) return "history-hydration";
    return "driving-upward";
  }

  function getKnownGapProbeCanCopyFinalDebug(probe = state.backfill) {
    return !(probe && probe.knownGapProbeStatus === "running");
  }

  function getKnownGapProbeHumanStatus(probe = state.backfill) {
    if (!probe || !probe.knownGapProbeStatus || probe.knownGapProbeStatus === "idle") return "Experimental known-gap probe idle.";
    if (probe.knownGapProbeReason === "user-interrupted-known-gap-probe") return "Experimental probe was cancelled because manual scrolling/input was detected.";
    if (probe.knownGapProbeReason === "conversation-changed-during-known-gap-probe") return "Experimental probe was cancelled because the conversation changed.";
    if (probe.knownGapProbeStatus === "running") {
      const phase = getKnownGapProbeEstimatedPhase(probe);
      if (phase === "stable-top-confirmation") {
        return "Reached top. Confirming stable true top: " + getKnownGapProbeStableTopConfirmationLabel(probe) + ". Do not copy debug yet.";
      }
      if (probe.knownGapProbeAnchorCompensatedScrollTop) return "History hydration caused scroll anchoring; continuing upward until stable true top.";
      if (probe.knownGapProbeProgressDetected) return "Known gap improved; continuing until stable true top.";
      return "Experimental probe is driving the ChatGPT scroll-root upward until the true top is stable. Do not manually scroll until it finishes.";
    }
    if (probe.knownGapProbeStatus === "success" || probe.knownGapProbeStatus === "completed") return "Stable true top confirmed after multiple checks.";
    if (probe.knownGapProbeReason === "unsafe-reverse-known-gap-probe") return "Experimental probe stopped for safety: viewport moved away from the known top.";
    if (probe.knownGapProbeReason === "top-hydration-cycle-detected-but-no-known-gap-improvement") return "Top hydration cycles were detected, but the known top gap did not improve.";
    if (probe.knownGapProbeReason === "reached-true-top-but-no-known-gap-improvement") return "Reached stable top, but no known-gap improvement was detected.";
    if (probe.knownGapProbeReason === "max-budget-before-stable-true-top") return "Stopped after reaching the experimental probe budget before stable true top.";
    if (probe.knownGapProbeReason === "current-backfill-running" || probe.knownGapProbeReason === "known-gap-probe-already-running") return "Another backfill/probe operation is already running.";
    if (probe.knownGapProbeVisualOnly) return "Top hydration cycles were detected, but the known top gap did not improve.";
    return "Experimental probe stopped: native scroll did not hydrate older history.";
  }

  function setKnownGapProbePatch(patch = {}) {
    if (!state.backfill) state.backfill = createDefaultBackfillState();
    Object.assign(state.backfill, patch);
    state.backfill.knownGapProbeIsRunning = state.backfill.knownGapProbeStatus === "running";
    state.backfill.knownGapProbeCanCopyFinalDebug = getKnownGapProbeCanCopyFinalDebug(state.backfill);
    state.backfill.knownGapProbeStableTopConfirmationLabel = getKnownGapProbeStableTopConfirmationLabel(state.backfill);
    state.backfill.knownGapProbeEstimatedPhase = getKnownGapProbeEstimatedPhase(state.backfill);
    state.backfill.knownGapProbeHumanStatus = patch.knownGapProbeHumanStatus || getKnownGapProbeHumanStatus(state.backfill);
    scheduleDebugPanelRefresh(true);
    return state.backfill;
  }

  function cleanupBackfillUserInterruptGuard() {
    if (typeof state.backfillInterruptCleanup === "function") state.backfillInterruptCleanup();
    state.backfillInterruptCleanup = null;
    if (state.backfill) state.backfill.userInterruptGuardEnabled = false;
  }

  function setupBackfillUserInterruptGuard(runId) {
    cleanupBackfillUserInterruptGuard();
    const cancelForInterrupt = (event) => {
      if (!state.backfill || state.backfill.runId !== runId || state.backfill.status !== "running") return;
      if (Date.now() <= state.programmaticScrollUntil) return;
      if (event && event.type === "mousedown" && state.panel && state.panel.contains(event.target)) return;
      if (event && event.type === "keydown") {
        const keys = new Set(["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", " "]);
        if (!keys.has(event.key)) return;
      }
      setBackfillStatus("cancelling", {
        cancelRequested: true,
        lastError: "user-interrupt",
        userInterruptDetected: true,
        userInterruptType: event && event.type ? event.type : "unknown",
        userInterruptAt: new Date().toISOString(),
        userInterruptCancelledBackfill: true
      });
    };
    window.addEventListener("wheel", cancelForInterrupt, true);
    window.addEventListener("touchstart", cancelForInterrupt, true);
    window.addEventListener("keydown", cancelForInterrupt, true);
    window.addEventListener("mousedown", cancelForInterrupt, true);
    state.backfillInterruptCleanup = () => {
      window.removeEventListener("wheel", cancelForInterrupt, true);
      window.removeEventListener("touchstart", cancelForInterrupt, true);
      window.removeEventListener("keydown", cancelForInterrupt, true);
      window.removeEventListener("mousedown", cancelForInterrupt, true);
    };
    setBackfillStatus(state.backfill.status || "running", {
      userInterruptGuardEnabled: true
    });
  }

  function getBackfillMessagePreviewById(messageId) {
    if (!messageId || !state.messageRegistry) return null;
    const message = state.messageRegistry.get(messageId);
    if (!message) return null;
    return getSingleLinePreview(message.mainText || message.text || message.preview || "", 80);
  }

  function getBackfillHydrationAuditSnapshot(label) {
    const visibleNodes = getBackfillVisibleUserNodes();
    const allNodes = Array.from(document.querySelectorAll(USER_SELECTOR));
    const firstVisibleNode = visibleNodes[0] || allNodes[0] || null;
    const firstVisibleDomMessageId = firstVisibleNode ? firstVisibleNode.getAttribute("data-message-id") || null : null;
    const bestMessageId = state.backfill && state.backfill.bestFirstVisibleDomMessageId ? state.backfill.bestFirstVisibleDomMessageId : null;
    const registryIds = Array.isArray(state.messageOrder) ? state.messageOrder.slice() : [];
    const visibleDomIds = allNodes.map((node) => node.getAttribute("data-message-id")).filter(Boolean);
    const firstVisibleDomRegistryIndex = getRegistryOrderIndex(firstVisibleDomMessageId);
    const bestFirstVisibleRegistryIndex = state.backfill && typeof state.backfill.bestFirstVisibleRegistryIndex === "number" ?
      state.backfill.bestFirstVisibleRegistryIndex : null;
    const firstRegistryMessageId = registryIds[0] || null;
    return {
      label: label || null,
      capturedAt: new Date().toISOString(),
      registryCount: state.messageRegistry ? state.messageRegistry.size : 0,
      visibleDomUserMessageCount: allNodes.length,
      loadedFromStorageCount: Number(DEBUG_STATE.registryLoadedFromStorageCount || 0),
      savedRegistryCount: registryIds.length,
      firstRegistryMessageId,
      firstRegistryPreview: getBackfillMessagePreviewById(firstRegistryMessageId),
      firstVisibleDomMessageId,
      firstVisibleDomRegistryIndex,
      firstVisibleDomPreview: getBackfillMessagePreviewById(firstVisibleDomMessageId),
      bestFirstVisibleRegistryIndex,
      bestFirstVisibleDomMessageId: bestMessageId,
      bestFirstVisiblePreview: getBackfillMessagePreviewById(bestMessageId),
      knownTopGapFromFirstVisible: firstVisibleDomRegistryIndex >= 0 ? firstVisibleDomRegistryIndex : null,
      knownTopGapFromBest: bestFirstVisibleRegistryIndex,
      messageHash: state.messageHash || "",
      visibleDomMessageIdsHead: visibleDomIds.slice(0, 8),
      visibleDomMessageIdsTail: visibleDomIds.slice(-8),
      registryMessageIdsHead: registryIds.slice(0, 8),
      registryMessageIdsTail: registryIds.slice(-8)
    };
  }

  function compareBackfillHydrationAudits(before, after) {
    if (!before || !after) {
      return {
        hydrationDetected: false,
        hydrationDetectionReason: "missing-audit",
        hydrationRegistryDelta: 0,
        hydrationVisibleDomDelta: 0,
        hydrationFirstRegistryChanged: false,
        hydrationFirstVisibleIndexImproved: false,
        hydrationDiscoveredNewEarlierMessage: false,
        hydrationRevealedKnownCachedMessage: false,
        hydrationOnlyVisualMovement: false
      };
    }
    const registryDelta = Number(after.registryCount || 0) - Number(before.registryCount || 0);
    const visibleDomDelta = Number(after.visibleDomUserMessageCount || 0) - Number(before.visibleDomUserMessageCount || 0);
    const firstRegistryChanged = !!(before.firstRegistryMessageId && after.firstRegistryMessageId && before.firstRegistryMessageId !== after.firstRegistryMessageId);
    const beforeIndex = typeof before.firstVisibleDomRegistryIndex === "number" ? before.firstVisibleDomRegistryIndex : null;
    const afterIndex = typeof after.firstVisibleDomRegistryIndex === "number" ? after.firstVisibleDomRegistryIndex : null;
    const firstVisibleIndexImproved = beforeIndex != null && afterIndex != null && afterIndex >= 0 && afterIndex < beforeIndex;
    const messageHashChanged = before.messageHash !== after.messageHash;
    const reasons = [];
    if (registryDelta > 0) reasons.push("registry-count-increased");
    if (firstRegistryChanged) reasons.push("first-registry-changed");
    if (firstVisibleIndexImproved) reasons.push("first-visible-index-improved");
    const hydrationDetected = registryDelta > 0 || firstRegistryChanged || firstVisibleIndexImproved;
    const hydrationRevealedKnownCachedMessage = visibleDomDelta > 0 && registryDelta <= 0;
    if (hydrationRevealedKnownCachedMessage) reasons.push("visible-known-cache-expanded");
    const hydrationOnlyVisualMovement = messageHashChanged && registryDelta <= 0 && !firstVisibleIndexImproved;
    if (hydrationOnlyVisualMovement) reasons.push("message-hash-visual-only");
    return {
      hydrationDetected,
      hydrationDetectionReason: reasons.join(",") || "no-hydration-detected",
      hydrationRegistryDelta: registryDelta,
      hydrationVisibleDomDelta: visibleDomDelta,
      hydrationFirstRegistryChanged: firstRegistryChanged,
      hydrationFirstVisibleIndexImproved: firstVisibleIndexImproved,
      hydrationDiscoveredNewEarlierMessage: registryDelta > 0 || firstRegistryChanged,
      hydrationRevealedKnownCachedMessage,
      hydrationOnlyVisualMovement
    };
  }

  function buildBackfillHydrationPatch(before, after, prefix) {
    const result = compareBackfillHydrationAudits(before, after);
    const patch = {
      hydrationDetected: result.hydrationDetected,
      hydrationDetectionReason: result.hydrationDetectionReason,
      hydrationRegistryDelta: result.hydrationRegistryDelta,
      hydrationVisibleDomDelta: result.hydrationVisibleDomDelta,
      hydrationFirstRegistryChanged: result.hydrationFirstRegistryChanged,
      hydrationFirstVisibleIndexImproved: result.hydrationFirstVisibleIndexImproved,
      hydrationDiscoveredNewEarlierMessage: result.hydrationDiscoveredNewEarlierMessage,
      hydrationRevealedKnownCachedMessage: result.hydrationRevealedKnownCachedMessage,
      hydrationOnlyVisualMovement: result.hydrationOnlyVisualMovement
    };
    if (prefix === "delayed") {
      patch.hydrationAuditDelayedRegistryDelta = result.hydrationRegistryDelta;
      patch.hydrationAuditDelayedVisibleDomDelta = result.hydrationVisibleDomDelta;
    }
    return patch;
  }

  function isBackfillTerminalStatus(status) {
    return status === "completed" || status === "failed" || status === "cancelled";
  }

  function applyBackfillKnownGapStopIfNeeded(next, originalPatch = {}) {
    const rawReason = originalPatch.lastError || originalPatch.lastStopReason || next.lastError || next.lastStopReason;
    const knownTopGap = typeof next.bestFirstVisibleRegistryIndex === "number" ? next.bestFirstVisibleRegistryIndex :
      typeof next.firstVisibleRegistryIndexAfter === "number" ? next.firstVisibleRegistryIndexAfter :
        typeof next.firstVisibleRegistryIndexBefore === "number" ? next.firstVisibleRegistryIndexBefore : null;
    const safeAnchorStalled = rawReason === "no-relaxed-anchor-message" &&
      knownTopGap != null &&
      knownTopGap > 0 &&
      Number(next.anchorRelaxedCandidateCount || 0) === 0 &&
      Number(next.relaxedLaterCandidateExcludedCount || 0) > 0;
    if (!safeAnchorStalled) return next;
    return {
      ...next,
      lastError: "safe-anchor-stalled-known-gap",
      lastStopReason: "safe-anchor-stalled-known-gap",
      rawAnchorFailureReason: rawReason,
      knownTopGapAtStop: knownTopGap,
      safeAnchorStalledKnownGap: true,
      completionConfidence: "safe-stalled-known-gap",
      backfillHumanStatus: "Stopped: known earlier messages remain, but no safe upward anchor is available."
    };
  }

  function captureBackfillTerminalHydrationAudit() {
    if (!state.backfill || !state.backfill.runId) return;
    if (state.backfill.hydrationAuditAfter) return;
    const before = state.backfill.hydrationAuditBefore || null;
    const after = getBackfillHydrationAuditSnapshot("after");
    const patch = {
      hydrationAuditAfter: after,
      ...buildBackfillHydrationPatch(before, after, "after")
    };
    Object.assign(state.backfill, patch);
    appendBackfillTraceEvent("hydration-audit-after", "capture", {
      beforeIndex: before ? before.firstVisibleDomRegistryIndex : null,
      afterIndex: after.firstVisibleDomRegistryIndex,
      result: patch.hydrationDetected ? "hydration-detected" : "no-hydration",
      reason: patch.hydrationDetectionReason
    });
  }

  function scheduleBackfillDelayedHydrationAudit() {
    if (!state.backfill || !state.backfill.runId || state.backfill._delayedHydrationAuditScheduled) return;
    const runId = state.backfill.runId;
    state.backfill._delayedHydrationAuditScheduled = true;
    setTimeout(() => {
      if (!state.backfill || state.backfill.runId !== runId || state.backfill.hydrationAuditDelayed) return;
      const after = state.backfill.hydrationAuditAfter || getBackfillHydrationAuditSnapshot("after");
      scanMergeSaveBackfillBatch("manual-backfill-post-stop-audit");
      const delayed = getBackfillHydrationAuditSnapshot("delayed");
      const delayedPatch = {
        hydrationAuditDelayed: delayed,
        hydrationAuditDelayedRanAt: delayed.capturedAt,
        ...buildBackfillHydrationPatch(after, delayed, "delayed")
      };
      Object.assign(state.backfill, delayedPatch);
      appendBackfillTraceEvent("hydration-audit-delayed", "post-stop-scan", {
        beforeIndex: after ? after.firstVisibleDomRegistryIndex : null,
        afterIndex: delayed.firstVisibleDomRegistryIndex,
        result: delayedPatch.hydrationDetected ? "hydration-detected" : "no-hydration",
        reason: delayedPatch.hydrationDetectionReason
      });
      scheduleDebugPanelRefresh(true);
    }, 1500);
  }

  function resetBackfillState(reason) {
    cleanupBackfillUserInterruptGuard();
    state.backfill = createDefaultBackfillState();
    state.backfill.registryCount = state.messageRegistry ? state.messageRegistry.size : 0;
    debugLog("info", "backfill state reset", { reason: reason || "reset" });
    scheduleDebugPanelRefresh(true);
    return state.backfill;
  }

  function setBackfillStatus(status, patch = {}) {
    let next = {
      ...createDefaultBackfillState(),
      ...(state.backfill || {}),
      ...patch,
      status: status || (state.backfill && state.backfill.status) || "idle",
      registryCount: state.messageRegistry ? state.messageRegistry.size : 0
    };
    if (isBackfillTerminalStatus(next.status)) next = applyBackfillKnownGapStopIfNeeded(next, patch);
    next.scrollMetricTrustedAsSuccess = false;
    next.wheelFallbackEnabled = BACKFILL_ENABLE_WHEEL_FALLBACK;
    next.backfillHumanStatus = patch.backfillHumanStatus || getBackfillHumanStatus(next);
    state.backfill = next;
    if (isBackfillTerminalStatus(state.backfill.status) && state.backfill.safeAnchorStalledKnownGap && !state.backfill._knownGapTraceRecorded) {
      appendBackfillTraceEvent("known-gap-stop", "stop", {
        beforeIndex: state.backfill.firstVisibleRegistryIndexBefore,
        afterIndex: state.backfill.firstVisibleRegistryIndexAfter,
        result: "failed",
        reason: state.backfill.rawAnchorFailureReason || state.backfill.lastError
      });
      state.backfill._knownGapTraceRecorded = true;
    }
    if (isBackfillTerminalStatus(state.backfill.status) && state.backfill.runId) {
      captureBackfillTerminalHydrationAudit();
      scheduleBackfillDelayedHydrationAudit();
    }
    if (["idle", "completed", "failed", "cancelled"].includes(state.backfill.status)) cleanupBackfillUserInterruptGuard();
    scheduleDebugPanelRefresh(true);
    return state.backfill;
  }

  function getBackfillProgressSnapshot() {
    const backfill = state.backfill || createDefaultBackfillState();
    return {
      status: backfill.status || "idle",
      runId: backfill.runId || null,
      cancelRequested: !!backfill.cancelRequested,
      startedAt: backfill.startedAt || null,
      finishedAt: backfill.finishedAt || null,
      lastError: backfill.lastError || null,
      batchCount: Number(backfill.batchCount || 0),
      scannedVisibleCount: Number(backfill.scannedVisibleCount || 0),
      registryCount: state.messageRegistry ? state.messageRegistry.size : Number(backfill.registryCount || 0),
      direction: backfill.direction || "up",
      scrollTargetDescriptor: backfill.scrollTargetDescriptor || null,
      scrollTopBefore: backfill.scrollTopBefore,
      scrollTopAfter: backfill.scrollTopAfter,
      scrollDelta: backfill.scrollDelta,
      scrollHeight: backfill.scrollHeight,
      clientHeight: backfill.clientHeight,
      windowScrollYBefore: backfill.windowScrollYBefore,
      windowScrollYAfter: backfill.windowScrollYAfter,
      lastStopReason: backfill.lastStopReason || null,
      lastBatchStartedAt: backfill.lastBatchStartedAt || null,
      lastBatchFinishedAt: backfill.lastBatchFinishedAt || null,
      lastScrollAttemptAt: backfill.lastScrollAttemptAt || null,
      lastScrollWorked: !!backfill.lastScrollWorked,
      scrollMethod: backfill.scrollMethod || null,
      anchorMessageIdBefore: backfill.anchorMessageIdBefore || null,
      anchorMessageIdAfter: backfill.anchorMessageIdAfter || null,
      anchorTopBefore: backfill.anchorTopBefore,
      anchorTopAfter: backfill.anchorTopAfter,
      anchorBottomBefore: backfill.anchorBottomBefore,
      anchorBottomAfter: backfill.anchorBottomAfter,
      anchorDelta: backfill.anchorDelta,
      firstVisibleDomMessageIdBefore: backfill.firstVisibleDomMessageIdBefore || null,
      firstVisibleDomMessageIdAfter: backfill.firstVisibleDomMessageIdAfter || null,
      firstRegistryMessageIdAtBackfill: backfill.firstRegistryMessageIdAtBackfill || null,
      anchorScrollAttempted: !!backfill.anchorScrollAttempted,
      anchorScrollWorked: !!backfill.anchorScrollWorked,
      anchorCandidateCount: Number(backfill.anchorCandidateCount || 0),
      anchorCandidateTriedCount: Number(backfill.anchorCandidateTriedCount || 0),
      anchorCandidateIds: Array.isArray(backfill.anchorCandidateIds) ? backfill.anchorCandidateIds.slice() : [],
      anchorTriedIds: Array.isArray(backfill.anchorTriedIds) ? backfill.anchorTriedIds.slice() : [],
      anchorRawCandidateCount: Number(backfill.anchorRawCandidateCount || 0),
      anchorRankedCandidateCount: Number(backfill.anchorRankedCandidateCount || 0),
      anchorRelaxedCandidateCount: Number(backfill.anchorRelaxedCandidateCount || 0),
      anchorRawCandidateIds: Array.isArray(backfill.anchorRawCandidateIds) ? backfill.anchorRawCandidateIds.slice() : [],
      anchorRankedCandidateIds: Array.isArray(backfill.anchorRankedCandidateIds) ? backfill.anchorRankedCandidateIds.slice() : [],
      anchorRelaxedCandidateIds: Array.isArray(backfill.anchorRelaxedCandidateIds) ? backfill.anchorRelaxedCandidateIds.slice() : [],
      anchorRejectedCandidateCount: Number(backfill.anchorRejectedCandidateCount || 0),
      anchorRejectedReasons: Array.isArray(backfill.anchorRejectedReasons) ? backfill.anchorRejectedReasons.slice() : [],
      relaxedAnchorTriedCount: Number(backfill.relaxedAnchorTriedCount || 0),
      relaxedAnchorTriedIds: Array.isArray(backfill.relaxedAnchorTriedIds) ? backfill.relaxedAnchorTriedIds.slice() : [],
      relaxedAnchorWorkedId: backfill.relaxedAnchorWorkedId || null,
      anchorAttemptHistory: Array.isArray(backfill.anchorAttemptHistory) ? backfill.anchorAttemptHistory.slice() : [],
      relaxedAnchorAttemptHistory: Array.isArray(backfill.relaxedAnchorAttemptHistory) ? backfill.relaxedAnchorAttemptHistory.slice() : [],
      anchorWorkedId: backfill.anchorWorkedId || null,
      anchorFailureReason: backfill.anchorFailureReason || null,
      anchorStrategy: backfill.anchorStrategy || null,
      anchorRegistryIndexBefore: backfill.anchorRegistryIndexBefore,
      anchorRegistryIndexAfter: backfill.anchorRegistryIndexAfter,
      firstVisibleRegistryIndexBefore: backfill.firstVisibleRegistryIndexBefore,
      firstVisibleRegistryIndexAfter: backfill.firstVisibleRegistryIndexAfter,
      progressRoundCount: Number(backfill.progressRoundCount || 0),
      noProgressRoundCount: Number(backfill.noProgressRoundCount || 0),
      noProgressRoundLimit: Number(backfill.noProgressRoundLimit || 6),
      lastProgressReason: backfill.lastProgressReason || null,
      progressComparedToBest: !!backfill.progressComparedToBest,
      bestProgressUpdatedAt: backfill.bestProgressUpdatedAt || null,
      anchorMovedOnlyIgnoredAsProgress: !!backfill.anchorMovedOnlyIgnoredAsProgress,
      lastBestProgressReason: backfill.lastBestProgressReason || null,
      bestFirstVisibleRegistryIndex: backfill.bestFirstVisibleRegistryIndex,
      bestRegistryCount: Number(backfill.bestRegistryCount || 0),
      bestFirstVisibleDomMessageId: backfill.bestFirstVisibleDomMessageId || null,
      bestVisibleDomUserMessageCount: Number(backfill.bestVisibleDomUserMessageCount || 0),
      viewportSignature: backfill.viewportSignature || null,
      recentViewportSignatures: Array.isArray(backfill.recentViewportSignatures) ? backfill.recentViewportSignatures.slice() : [],
      repeatedViewportSignatureCount: Number(backfill.repeatedViewportSignatureCount || 0),
      uniqueRecentViewportSignatureCount: Number(backfill.uniqueRecentViewportSignatureCount || 0),
      oscillationDetected: !!backfill.oscillationDetected,
      oscillationSignature: backfill.oscillationSignature || null,
      oscillationPattern: backfill.oscillationPattern || null,
      oscillationStopTriggeredAt: backfill.oscillationStopTriggeredAt || null,
      roundsSinceBestProgress: Number(backfill.roundsSinceBestProgress || 0),
      topProbeCount: Number(backfill.topProbeCount || 0),
      topProbeMax: Number(backfill.topProbeMax || 6),
      topProbeActive: !!backfill.topProbeActive,
      anchorBlacklistedIds: Array.isArray(backfill.anchorBlacklistedIds) ? backfill.anchorBlacklistedIds.slice() : [],
      anchorReverseMovementCount: Number(backfill.anchorReverseMovementCount || 0),
      lastRejectedAnchorReason: backfill.lastRejectedAnchorReason || null,
      blacklistedRelaxedCandidateExcludedCount: Number(backfill.blacklistedRelaxedCandidateExcludedCount || 0),
      blacklistedCandidateTriedCount: Number(backfill.blacklistedCandidateTriedCount || 0),
      relaxedSkippedBlacklistedIds: Array.isArray(backfill.relaxedSkippedBlacklistedIds) ? backfill.relaxedSkippedBlacklistedIds.slice() : [],
      allCandidatesBlacklisted: !!backfill.allCandidatesBlacklisted,
      relaxedLaterCandidateExcludedCount: Number(backfill.relaxedLaterCandidateExcludedCount || 0),
      relaxedSkippedLaterCandidateIds: Array.isArray(backfill.relaxedSkippedLaterCandidateIds) ? backfill.relaxedSkippedLaterCandidateIds.slice() : [],
      relaxedMonotonicGuardEnabled: backfill.relaxedMonotonicGuardEnabled !== false,
      relaxedRejectedByBestIndexCount: Number(backfill.relaxedRejectedByBestIndexCount || 0),
      relaxedRejectedByCurrentIndexCount: Number(backfill.relaxedRejectedByCurrentIndexCount || 0),
      visualAnchorMovedOnly: !!backfill.visualAnchorMovedOnly,
      visualMoveRejectedAsProgress: !!backfill.visualMoveRejectedAsProgress,
      anchorRejectedBecauseLaterThanBest: !!backfill.anchorRejectedBecauseLaterThanBest,
      anchorRejectedBecauseReverseAfterScroll: !!backfill.anchorRejectedBecauseReverseAfterScroll,
      anchorWorkedRequiresBestProgress: backfill.anchorWorkedRequiresBestProgress !== false,
      reverseMovementDetected: !!backfill.reverseMovementDetected,
      reverseMovementFromIndex: backfill.reverseMovementFromIndex,
      reverseMovementToIndex: backfill.reverseMovementToIndex,
      reverseMovementAnchorId: backfill.reverseMovementAnchorId || null,
      reverseMovementStoppedImmediately: !!backfill.reverseMovementStoppedImmediately,
      wheelFallbackAttempted: !!backfill.wheelFallbackAttempted,
      wheelFallbackAttemptCount: Number(backfill.wheelFallbackAttemptCount || 0),
      wheelFallbackWorked: !!backfill.wheelFallbackWorked,
      wheelFallbackLastDeltaY: backfill.wheelFallbackLastDeltaY,
      wheelFallbackTargetDescriptor: backfill.wheelFallbackTargetDescriptor || null,
      wheelFallbackEnabled: BACKFILL_ENABLE_WHEEL_FALLBACK,
      wheelFallbackSkippedReason: backfill.wheelFallbackSkippedReason || (BACKFILL_ENABLE_WHEEL_FALLBACK ? null : "disabled-for-stability"),
      pageUpFallbackAttempted: !!backfill.pageUpFallbackAttempted,
      pageUpFallbackWorked: !!backfill.pageUpFallbackWorked,
      fallbackProgressReason: backfill.fallbackProgressReason || null,
      wheelFallbackSignatureBefore: backfill.wheelFallbackSignatureBefore || null,
      wheelFallbackSignatureAfter: backfill.wheelFallbackSignatureAfter || null,
      topHydrationProbeAttempted: !!backfill.topHydrationProbeAttempted,
      topHydrationProbeCount: Number(backfill.topHydrationProbeCount || 0),
      topHydrationProbeWorked: !!backfill.topHydrationProbeWorked,
      topHydrationProbeReason: backfill.topHydrationProbeReason || null,
      topHydrationProbeRegistryCountBefore: backfill.topHydrationProbeRegistryCountBefore,
      topHydrationProbeRegistryCountAfter: backfill.topHydrationProbeRegistryCountAfter,
      topHydrationProbeFirstRegistryBefore: backfill.topHydrationProbeFirstRegistryBefore || null,
      topHydrationProbeFirstRegistryAfter: backfill.topHydrationProbeFirstRegistryAfter || null,
      topHydrationProbeFirstVisibleIndexBefore: backfill.topHydrationProbeFirstVisibleIndexBefore,
      topHydrationProbeFirstVisibleIndexAfter: backfill.topHydrationProbeFirstVisibleIndexAfter,
      visualScrollObservedButNoHydration: !!backfill.visualScrollObservedButNoHydration,
      scrollMetricTrustedAsSuccess: false,
      userInterruptGuardEnabled: !!backfill.userInterruptGuardEnabled,
      userInterruptDetected: !!backfill.userInterruptDetected,
      userInterruptType: backfill.userInterruptType || null,
      userInterruptAt: backfill.userInterruptAt || null,
      userInterruptCancelledBackfill: !!backfill.userInterruptCancelledBackfill,
      backfillHumanStatus: getBackfillHumanStatus(backfill),
      backfillTraceSummary: {
        count: Array.isArray(backfill.backfillTraceEvents) ? backfill.backfillTraceEvents.length : 0,
        lastEvents: Array.isArray(backfill.backfillTraceEvents) ? backfill.backfillTraceEvents.slice(-20) : []
      },
      hydrationAuditBefore: backfill.hydrationAuditBefore || null,
      hydrationAuditAfter: backfill.hydrationAuditAfter || null,
      hydrationAuditDelayed: backfill.hydrationAuditDelayed || null,
      hydrationAuditDelayedRanAt: backfill.hydrationAuditDelayedRanAt || null,
      hydrationAuditDelayedRegistryDelta: backfill.hydrationAuditDelayedRegistryDelta,
      hydrationAuditDelayedVisibleDomDelta: backfill.hydrationAuditDelayedVisibleDomDelta,
      hydrationAuditSummary: {
        before: backfill.hydrationAuditBefore || null,
        after: backfill.hydrationAuditAfter || null,
        delayed: backfill.hydrationAuditDelayed || null,
        result: {
          hydrationDetected: !!backfill.hydrationDetected,
          hydrationDetectionReason: backfill.hydrationDetectionReason || null,
          hydrationRegistryDelta: Number(backfill.hydrationRegistryDelta || 0),
          hydrationVisibleDomDelta: Number(backfill.hydrationVisibleDomDelta || 0),
          hydrationFirstRegistryChanged: !!backfill.hydrationFirstRegistryChanged,
          hydrationFirstVisibleIndexImproved: !!backfill.hydrationFirstVisibleIndexImproved,
          hydrationDiscoveredNewEarlierMessage: !!backfill.hydrationDiscoveredNewEarlierMessage,
          hydrationRevealedKnownCachedMessage: !!backfill.hydrationRevealedKnownCachedMessage,
          hydrationOnlyVisualMovement: !!backfill.hydrationOnlyVisualMovement,
          knownTopGapAtStop: backfill.knownTopGapAtStop,
          safeAnchorStalledKnownGap: !!backfill.safeAnchorStalledKnownGap,
          rawAnchorFailureReason: backfill.rawAnchorFailureReason || null
        }
      },
      hydrationDetected: !!backfill.hydrationDetected,
      hydrationDetectionReason: backfill.hydrationDetectionReason || null,
      hydrationRegistryDelta: Number(backfill.hydrationRegistryDelta || 0),
      hydrationVisibleDomDelta: Number(backfill.hydrationVisibleDomDelta || 0),
      hydrationFirstRegistryChanged: !!backfill.hydrationFirstRegistryChanged,
      hydrationFirstVisibleIndexImproved: !!backfill.hydrationFirstVisibleIndexImproved,
      hydrationDiscoveredNewEarlierMessage: !!backfill.hydrationDiscoveredNewEarlierMessage,
      hydrationRevealedKnownCachedMessage: !!backfill.hydrationRevealedKnownCachedMessage,
      hydrationOnlyVisualMovement: !!backfill.hydrationOnlyVisualMovement,
      rawAnchorFailureReason: backfill.rawAnchorFailureReason || null,
      knownTopGapAtStop: backfill.knownTopGapAtStop,
      safeAnchorStalledKnownGap: !!backfill.safeAnchorStalledKnownGap,
      knownGapProbeStatus: backfill.knownGapProbeStatus || "idle",
      knownGapProbeRunId: backfill.knownGapProbeRunId || null,
      knownGapProbeIsRunning: backfill.knownGapProbeStatus === "running",
      knownGapProbeCanCopyFinalDebug: getKnownGapProbeCanCopyFinalDebug(backfill),
      knownGapProbeAttempted: !!backfill.knownGapProbeAttempted,
      knownGapProbeCount: Number(backfill.knownGapProbeCount || 0),
      knownGapProbeMax: Number(backfill.knownGapProbeMax || KNOWN_GAP_NATIVE_PROBE_MAX),
      knownGapProbeReason: backfill.knownGapProbeReason || null,
      knownGapProbeHumanStatus: getKnownGapProbeHumanStatus(backfill),
      knownGapProbeStrategy: backfill.knownGapProbeStrategy || KNOWN_GAP_PROBE_STRATEGY,
      knownGapProbeHydrationDetected: !!backfill.knownGapProbeHydrationDetected,
      knownGapProbeVisualOnly: !!backfill.knownGapProbeVisualOnly,
      knownGapProbeSafetyStopped: !!backfill.knownGapProbeSafetyStopped,
      knownGapProbeRegistryCountBefore: backfill.knownGapProbeRegistryCountBefore,
      knownGapProbeRegistryCountAfter: backfill.knownGapProbeRegistryCountAfter,
      knownGapProbeRegistryDelta: Number(backfill.knownGapProbeRegistryDelta || 0),
      knownGapProbeVisibleDomCountBefore: backfill.knownGapProbeVisibleDomCountBefore,
      knownGapProbeVisibleDomCountAfter: backfill.knownGapProbeVisibleDomCountAfter,
      knownGapProbeVisibleDomDelta: Number(backfill.knownGapProbeVisibleDomDelta || 0),
      knownGapProbeFirstVisibleIndexBefore: backfill.knownGapProbeFirstVisibleIndexBefore,
      knownGapProbeFirstVisibleIndexAfter: backfill.knownGapProbeFirstVisibleIndexAfter,
      knownGapProbeKnownGapBefore: backfill.knownGapProbeKnownGapBefore,
      knownGapProbeKnownGapAfter: backfill.knownGapProbeKnownGapAfter,
      knownGapProbeFirstRegistryBefore: backfill.knownGapProbeFirstRegistryBefore || null,
      knownGapProbeFirstRegistryAfter: backfill.knownGapProbeFirstRegistryAfter || null,
      knownGapProbeBefore: backfill.knownGapProbeBefore || null,
      knownGapProbeAfter: backfill.knownGapProbeAfter || null,
      knownGapProbeDelayed: backfill.knownGapProbeDelayed || null,
      knownGapProbeNativeScrollAttempted: !!backfill.knownGapProbeNativeScrollAttempted,
      knownGapProbeNativeScrollWorked: !!backfill.knownGapProbeNativeScrollWorked,
      knownGapProbeJumpToTopAttempted: !!backfill.knownGapProbeJumpToTopAttempted,
      knownGapProbeJumpToTopWorked: !!backfill.knownGapProbeJumpToTopWorked,
      knownGapProbeScrollMethod: backfill.knownGapProbeScrollMethod || null,
      knownGapProbeScrollTargetDescriptor: backfill.knownGapProbeScrollTargetDescriptor || null,
      knownGapProbeScrollAmount: backfill.knownGapProbeScrollAmount,
      knownGapProbeInitialScrollTop: backfill.knownGapProbeInitialScrollTop,
      knownGapProbeFinalScrollTop: backfill.knownGapProbeFinalScrollTop,
      knownGapProbeInitialScrollHeight: backfill.knownGapProbeInitialScrollHeight,
      knownGapProbeFinalScrollHeight: backfill.knownGapProbeFinalScrollHeight,
      knownGapProbeTotalScrollHeightDelta: Number(backfill.knownGapProbeTotalScrollHeightDelta || 0),
      knownGapProbeScrollTopBefore: backfill.knownGapProbeScrollTopBefore,
      knownGapProbeScrollTopAfter: backfill.knownGapProbeScrollTopAfter,
      knownGapProbeScrollTopAfterImmediate: backfill.knownGapProbeScrollTopAfterImmediate,
      knownGapProbeScrollTopAfterWait: backfill.knownGapProbeScrollTopAfterWait,
      knownGapProbeScrollHeightBefore: backfill.knownGapProbeScrollHeightBefore,
      knownGapProbeScrollHeightAfterImmediate: backfill.knownGapProbeScrollHeightAfterImmediate,
      knownGapProbeScrollHeightAfterWait: backfill.knownGapProbeScrollHeightAfterWait,
      knownGapProbeScrollHeightDelta: Number(backfill.knownGapProbeScrollHeightDelta || 0),
      knownGapProbeClientHeight: backfill.knownGapProbeClientHeight,
      knownGapProbeReachedTopThreshold: !!backfill.knownGapProbeReachedTopThreshold,
      knownGapProbeTrueTopEpsilon: Number(backfill.knownGapProbeTrueTopEpsilon || KNOWN_GAP_PROBE_TRUE_TOP_EPSILON),
      knownGapProbeReachedTrueTop: !!backfill.knownGapProbeReachedTrueTop,
      knownGapProbeStableAtTop: !!backfill.knownGapProbeStableAtTop,
      knownGapProbeStableAtTopWaitMs: backfill.knownGapProbeStableAtTopWaitMs,
      knownGapProbeStableTopConfirmationCount: Number(backfill.knownGapProbeStableTopConfirmationCount || 0),
      knownGapProbeStableTopConfirmationsRequired: Number(backfill.knownGapProbeStableTopConfirmationsRequired || KNOWN_GAP_PROBE_STABLE_TOP_CONFIRMATIONS_REQUIRED),
      knownGapProbeStableTopConfirmationLabel: getKnownGapProbeStableTopConfirmationLabel(backfill),
      knownGapProbeEstimatedPhase: getKnownGapProbeEstimatedPhase(backfill),
      knownGapProbeStableTopResetCount: Number(backfill.knownGapProbeStableTopResetCount || 0),
      knownGapProbeStableTopResetReason: backfill.knownGapProbeStableTopResetReason || null,
      knownGapProbeDomHydrationDriveEnabled: backfill.knownGapProbeDomHydrationDriveEnabled !== false,
      knownGapProbeStoppedAfterStableTopConfirmations: !!backfill.knownGapProbeStoppedAfterStableTopConfirmations,
      knownGapProbeTopNudgeCount: Number(backfill.knownGapProbeTopNudgeCount || 0),
      knownGapProbeProgressDetected: !!backfill.knownGapProbeProgressDetected,
      knownGapProbeProgressReason: backfill.knownGapProbeProgressReason || null,
      knownGapProbeBestKnownGap: backfill.knownGapProbeBestKnownGap,
      knownGapProbeBestFirstVisibleIndex: backfill.knownGapProbeBestFirstVisibleIndex,
      knownGapProbeProgressEventCount: Number(backfill.knownGapProbeProgressEventCount || 0),
      knownGapProbeProgressHistory: Array.isArray(backfill.knownGapProbeProgressHistory) ? backfill.knownGapProbeProgressHistory : [],
      knownGapProbeReverseIndexObserved: !!backfill.knownGapProbeReverseIndexObserved,
      knownGapProbeReverseIndexIgnoredInBackfillMode: !!backfill.knownGapProbeReverseIndexIgnoredInBackfillMode,
      knownGapProbeReverseIndexIgnoredReason: backfill.knownGapProbeReverseIndexIgnoredReason || null,
      knownGapProbePostHydrationSettleNeeded: !!backfill.knownGapProbePostHydrationSettleNeeded,
      knownGapProbeLastHydrationAt: backfill.knownGapProbeLastHydrationAt || null,
      knownGapProbeLastAnchorCompensationAt: backfill.knownGapProbeLastAnchorCompensationAt || null,
      knownGapProbeMutationCountBeforeStableWait: backfill.knownGapProbeMutationCountBeforeStableWait,
      knownGapProbeMutationCountAfterStableWait: backfill.knownGapProbeMutationCountAfterStableWait,
      knownGapProbeMessageHashBeforeStableWait: backfill.knownGapProbeMessageHashBeforeStableWait || null,
      knownGapProbeMessageHashAfterStableWait: backfill.knownGapProbeMessageHashAfterStableWait || null,
      knownGapProbeScrollHeightIncreased: !!backfill.knownGapProbeScrollHeightIncreased,
      knownGapProbeAnchorCompensatedScrollTop: !!backfill.knownGapProbeAnchorCompensatedScrollTop,
      knownGapProbeTopHydrationCycleDetected: !!backfill.knownGapProbeTopHydrationCycleDetected,
      knownGapProbeHydrationCycleCount: Number(backfill.knownGapProbeHydrationCycleCount || 0),
      knownGapProbeAnchorCompensationCount: Number(backfill.knownGapProbeAnchorCompensationCount || 0),
      knownGapProbeMaxTotalMs: Number(backfill.knownGapProbeMaxTotalMs || KNOWN_GAP_PROBE_MAX_TOTAL_MS),
      knownGapProbeTotalDurationMs: Number(backfill.knownGapProbeTotalDurationMs || 0),
      knownGapProbeMaxTotalSteps: Number(backfill.knownGapProbeMaxTotalSteps || KNOWN_GAP_PROBE_MAX_TOTAL_STEPS),
      knownGapProbeTotalStepCount: Number(backfill.knownGapProbeTotalStepCount || 0),
      knownGapProbeMaxHydrationCycles: Number(backfill.knownGapProbeMaxHydrationCycles || KNOWN_GAP_PROBE_MAX_HYDRATION_CYCLES),
      knownGapProbeStoppedBecauseMaxBudget: !!backfill.knownGapProbeStoppedBecauseMaxBudget,
      knownGapProbeBudgetStopPhase: backfill.knownGapProbeBudgetStopPhase || null,
      knownGapProbeStartUrl: backfill.knownGapProbeStartUrl || null,
      knownGapProbeEndUrl: backfill.knownGapProbeEndUrl || null,
      knownGapProbeStartConversationId: backfill.knownGapProbeStartConversationId || null,
      knownGapProbeEndConversationId: backfill.knownGapProbeEndConversationId || null,
      knownGapProbeStartConversationKey: backfill.knownGapProbeStartConversationKey || null,
      knownGapProbeEndConversationKey: backfill.knownGapProbeEndConversationKey || null,
      knownGapProbeStartUserMessageCount: backfill.knownGapProbeStartUserMessageCount,
      knownGapProbeCancelledByConversationChange: !!backfill.knownGapProbeCancelledByConversationChange,
      knownGapProbeCancelReason: backfill.knownGapProbeCancelReason || null,
      knownGapProbeStepCount: Number(backfill.knownGapProbeStepCount || 0),
      knownGapProbeStepHistory: Array.isArray(backfill.knownGapProbeStepHistory) ? backfill.knownGapProbeStepHistory : [],
      knownGapProbeCycleHistory: Array.isArray(backfill.knownGapProbeCycleHistory) ? backfill.knownGapProbeCycleHistory : [],
      knownGapProbeWaitMsAfterTop: backfill.knownGapProbeWaitMsAfterTop,
      knownGapProbeWindowScrollYBefore: backfill.knownGapProbeWindowScrollYBefore,
      knownGapProbeWindowScrollYAfter: backfill.knownGapProbeWindowScrollYAfter,
      knownGapProbeTargetCandidates: Array.isArray(backfill.knownGapProbeTargetCandidates) ? backfill.knownGapProbeTargetCandidates : [],
      knownGapProbeAttemptHistory: Array.isArray(backfill.knownGapProbeAttemptHistory) ? backfill.knownGapProbeAttemptHistory : [],
      knownGapProbeEarlierDomAnchorAttempted: !!backfill.knownGapProbeEarlierDomAnchorAttempted,
      knownGapProbeEarlierDomAnchorWorked: !!backfill.knownGapProbeEarlierDomAnchorWorked,
      knownGapProbeEarlierDomAnchorCandidateIds: Array.isArray(backfill.knownGapProbeEarlierDomAnchorCandidateIds) ? backfill.knownGapProbeEarlierDomAnchorCandidateIds : [],
      knownGapProbeEarlierDomAnchorRejectedIds: Array.isArray(backfill.knownGapProbeEarlierDomAnchorRejectedIds) ? backfill.knownGapProbeEarlierDomAnchorRejectedIds : [],
      completionConfidence: backfill.completionConfidence || null
    };
  }

  function waitForBackfillFrame(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isBackfillDocumentScrollNode(node) {
    return node === window || node === document || node === document.scrollingElement || node === document.documentElement || node === document.body;
  }

  function createBackfillScrollTarget(node, source) {
    if (!node) return null;
    return {
      node,
      source: source || "unknown",
      isDocument: isBackfillDocumentScrollNode(node)
    };
  }

  function getBackfillScrollMetrics(target) {
    const node = target && target.node;
    if (!node) {
      return { scrollTop: 0, scrollHeight: 0, clientHeight: 0, windowScrollY: window.scrollY || 0, canScroll: false, canScrollUp: false };
    }

    if (target.isDocument) {
      const doc = document.documentElement;
      const body = document.body;
      const scrollTop = window.scrollY || doc.scrollTop || body.scrollTop || 0;
      const scrollHeight = Math.max(doc.scrollHeight || 0, body.scrollHeight || 0);
      const clientHeight = window.innerHeight || doc.clientHeight || body.clientHeight || 0;
      return {
        scrollTop,
        scrollHeight,
        clientHeight,
        windowScrollY: window.scrollY || scrollTop,
        canScroll: scrollHeight > clientHeight + 20,
        canScrollUp: scrollTop > 0
      };
    }

    const scrollTop = Number(node.scrollTop || 0);
    const scrollHeight = Number(node.scrollHeight || 0);
    const clientHeight = Number(node.clientHeight || 0);
    return {
      scrollTop,
      scrollHeight,
      clientHeight,
      windowScrollY: window.scrollY || 0,
      canScroll: scrollHeight > clientHeight + 20,
      canScrollUp: scrollTop > 0
    };
  }

  function describeBackfillScrollTarget(target) {
    if (!target) return null;
    const metrics = getBackfillScrollMetrics(target);
    const node = target.node;
    const nodeLabel = target.isDocument ? "document" : describeElementForDebug(node);
    return [
      target.source,
      nodeLabel,
      "top=" + Math.round(metrics.scrollTop),
      "height=" + Math.round(metrics.scrollHeight),
      "client=" + Math.round(metrics.clientHeight),
      "canUp=" + (metrics.canScrollUp ? "yes" : "no")
    ].join(" | ");
  }

  function findBackfillScrollTarget() {
    const candidates = [];
    const seen = new Set();
    const add = (node, source) => {
      if (!node || isInsidePanel(node)) return;
      const key = node === window ? "window" : node === document ? "document" : node;
      if (seen.has(key)) return;
      seen.add(key);
      const target = createBackfillScrollTarget(node, source);
      if (!target) return;
      const metrics = getBackfillScrollMetrics(target);
      if (!metrics.canScroll) return;
      const messageCount = target.isDocument ? document.querySelectorAll("[data-message-author-role]").length :
        (node.querySelectorAll ? node.querySelectorAll("[data-message-author-role]").length : 0);
      candidates.push({ target, metrics, messageCount });
    };

    add(findChatScrollContainer(), "findChatScrollContainer");
    add(document.scrollingElement, "document.scrollingElement");
    add(document.documentElement, "document.documentElement");
    add(document.body, "document.body");

    Array.from(document.querySelectorAll("[data-message-author-role]")).slice(0, 40).forEach((messageNode) => {
      let current = messageNode.parentElement;
      let depth = 0;
      while (current && current !== document.body && depth < 12) {
        add(current, "message-ancestor");
        current = current.parentElement;
        depth += 1;
      }
    });

    candidates.sort((a, b) => {
      if (a.metrics.canScrollUp !== b.metrics.canScrollUp) return a.metrics.canScrollUp ? -1 : 1;
      if (a.messageCount !== b.messageCount) return b.messageCount - a.messageCount;
      return (b.metrics.scrollHeight - b.metrics.clientHeight) - (a.metrics.scrollHeight - a.metrics.clientHeight);
    });

    return candidates.length ? candidates[0].target : null;
  }

  function scrollBackfillTargetUp(target, amount) {
    if (!target) return;
    markProgrammaticScroll();
    if (target.isDocument) {
      window.scrollBy({ top: -amount, behavior: "auto" });
      return;
    }
    if (target.node && typeof target.node.scrollBy === "function") {
      target.node.scrollBy({ top: -amount, behavior: "auto" });
      return;
    }
    if (target.node) target.node.scrollTop = Math.max(0, Number(target.node.scrollTop || 0) - amount);
  }

  function cleanupKnownGapProbeUserInterruptGuard() {
    if (typeof state.knownGapProbeInterruptCleanup === "function") state.knownGapProbeInterruptCleanup();
    state.knownGapProbeInterruptCleanup = null;
  }

  function getKnownGapProbeConversationSnapshot() {
    const identity = getConversationIdentity();
    return {
      url: location.href,
      conversationId: identity.rawConversationId || identity.key || null,
      conversationKey: identity.key || null,
      isRealConversation: !!identity.isRealConversation,
      isDraftConversation: !!identity.isDraftConversation,
      userMessageCount: document.querySelectorAll('[data-message-author-role="user"]').length
    };
  }

  function getKnownGapProbeConversationChangeReason(startSnapshot, currentSnapshot) {
    if (!startSnapshot || !currentSnapshot) return null;
    if (startSnapshot.url && currentSnapshot.url && currentSnapshot.url !== startSnapshot.url) return "url-changed";
    if (startSnapshot.conversationKey && currentSnapshot.conversationKey && currentSnapshot.conversationKey !== startSnapshot.conversationKey) return "conversation-key-changed";
    if (startSnapshot.conversationId && currentSnapshot.conversationId && currentSnapshot.conversationId !== startSnapshot.conversationId) return "conversation-id-changed";
    if (startSnapshot.isRealConversation && !currentSnapshot.isRealConversation && Number(currentSnapshot.userMessageCount || 0) === 0) return "left-real-conversation";
    if (Number(startSnapshot.userMessageCount || 0) > 0 && Number(currentSnapshot.userMessageCount || 0) === 0 && currentSnapshot.url !== startSnapshot.url) return "user-messages-disappeared";
    return null;
  }

  function isKnownGapProbeCurrent(runId, conversationId) {
    const currentSnapshot = getKnownGapProbeConversationSnapshot();
    const startSnapshot = {
      url: state.backfill && state.backfill.knownGapProbeStartUrl,
      conversationId: state.backfill && state.backfill.knownGapProbeStartConversationId,
      conversationKey: state.backfill && (state.backfill.knownGapProbeStartConversationKey || conversationId),
      isRealConversation: state.backfill && !isDraftConversationKey(state.backfill.knownGapProbeStartConversationKey || conversationId),
      userMessageCount: state.backfill && state.backfill.knownGapProbeStartUserMessageCount
    };
    return !!(
      state.backfill &&
      state.backfill.knownGapProbeRunId === runId &&
      state.backfill.knownGapProbeStatus === "running" &&
      !getKnownGapProbeConversationChangeReason(startSnapshot, currentSnapshot)
    );
  }

  function cancelKnownGapProbeIfNotCurrent(runId, conversationId) {
    if (isKnownGapProbeCurrent(runId, conversationId)) return false;
    if (state.backfill && state.backfill.knownGapProbeRunId === runId && state.backfill.knownGapProbeStatus === "running") {
      const currentSnapshot = getKnownGapProbeConversationSnapshot();
      const startSnapshot = {
        url: state.backfill.knownGapProbeStartUrl,
        conversationId: state.backfill.knownGapProbeStartConversationId,
        conversationKey: state.backfill.knownGapProbeStartConversationKey || conversationId,
        isRealConversation: !isDraftConversationKey(state.backfill.knownGapProbeStartConversationKey || conversationId),
        userMessageCount: state.backfill.knownGapProbeStartUserMessageCount
      };
      const changeReason = getKnownGapProbeConversationChangeReason(startSnapshot, currentSnapshot);
      const reason = changeReason ? "conversation-changed-during-known-gap-probe" : "known-gap-probe-cancelled";
      setKnownGapProbePatch({
        knownGapProbeStatus: changeReason ? "cancelled" : "failed",
        knownGapProbeReason: reason,
        knownGapProbeEndUrl: currentSnapshot.url,
        knownGapProbeEndConversationId: currentSnapshot.conversationId,
        knownGapProbeEndConversationKey: currentSnapshot.conversationKey,
        knownGapProbeCancelledByConversationChange: !!changeReason,
        knownGapProbeCancelReason: changeReason || reason
      });
      appendBackfillTraceEvent(changeReason ? "known-gap-continuous-probe-conversation-changed-cancelled" : "known-gap-native-probe-failed", "cancel", {
        result: changeReason ? "cancelled" : "failed",
        reason
      });
    }
    cleanupKnownGapProbeUserInterruptGuard();
    return true;
  }

  function setupKnownGapProbeUserInterruptGuard(runId) {
    cleanupKnownGapProbeUserInterruptGuard();
    const cancelForInterrupt = (event) => {
      if (!state.backfill || state.backfill.knownGapProbeRunId !== runId || state.backfill.knownGapProbeStatus !== "running") return;
      if (Date.now() <= state.programmaticScrollUntil) return;
      if (event && event.target && state.panel && state.panel.contains(event.target)) return;
      if (event && event.type === "keydown") {
        const keys = new Set(["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", " "]);
        if (!keys.has(event.key)) return;
      }
      const currentSnapshot = getKnownGapProbeConversationSnapshot();
      setKnownGapProbePatch({
        knownGapProbeStatus: "cancelled",
        knownGapProbeReason: "user-interrupted-known-gap-probe",
        knownGapProbeSafetyStopped: false,
        knownGapProbeEndUrl: currentSnapshot.url,
        knownGapProbeEndConversationId: currentSnapshot.conversationId,
        knownGapProbeEndConversationKey: currentSnapshot.conversationKey,
        knownGapProbeCancelReason: "user-interrupted-known-gap-probe"
      });
      cleanupKnownGapProbeUserInterruptGuard();
      appendBackfillTraceEvent("known-gap-continuous-probe-user-interrupted", "cancel", {
        result: "cancelled",
        reason: "user-interrupted-known-gap-probe"
      });
    };
    window.addEventListener("wheel", cancelForInterrupt, true);
    window.addEventListener("touchstart", cancelForInterrupt, true);
    window.addEventListener("touchmove", cancelForInterrupt, true);
    window.addEventListener("keydown", cancelForInterrupt, true);
    window.addEventListener("pointerdown", cancelForInterrupt, true);
    state.knownGapProbeInterruptCleanup = () => {
      window.removeEventListener("wheel", cancelForInterrupt, true);
      window.removeEventListener("touchstart", cancelForInterrupt, true);
      window.removeEventListener("touchmove", cancelForInterrupt, true);
      window.removeEventListener("keydown", cancelForInterrupt, true);
      window.removeEventListener("pointerdown", cancelForInterrupt, true);
    };
  }

  function getKnownGapProbeTargetKey(node) {
    if (node === window) return "window";
    if (node === document.scrollingElement) return "document.scrollingElement";
    if (node === document.documentElement) return "document.documentElement";
    if (node === document.body) return "document.body";
    return node;
  }

  function getKnownGapProbeTargetDiagnostics(node, metrics) {
    const className = typeof node.className === "string" ? node.className : "";
    const computed = window.getComputedStyle ? window.getComputedStyle(node) : null;
    const rect = node && node !== window && node.getBoundingClientRect ? node.getBoundingClientRect() : null;
    const scrollTop = metrics ? Number(metrics.scrollTop || 0) : Number(node && node.scrollTop || 0);
    const scrollHeight = metrics ? Number(metrics.scrollHeight || 0) : Number(node && node.scrollHeight || 0);
    const clientHeight = metrics ? Number(metrics.clientHeight || 0) : Number(node && node.clientHeight || 0);
    const rectTop = rect ? rect.top : null;
    const rectHeight = rect ? rect.height : clientHeight;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const overflowY = computed ? computed.overflowY : null;
    const containsUserMessage = !!(node && node.querySelector && node.querySelector('[data-message-author-role="user"]'));
    const containsThread = !!(node && node.querySelector && node.querySelector("#thread"));
    const containsConversationMain = !!(node && node.querySelector && node.querySelector("main#main"));
    const insideCode = !!(node && node.closest && node.closest("pre,code"));
    const containsCode = !!(node && node.querySelector && node.querySelector("pre,code"));
    const role = node && node.getAttribute ? node.getAttribute("role") : null;
    const smallLocalOverflow = (rectHeight && rectHeight < 300) || clientHeight < 300;
    const noScrollbarMaxHeight = className.includes("no-scrollbar") && className.includes("max-h");
    const scrollRange = scrollHeight - clientHeight;
    const mainScrollRootShape = className.includes("group/scroll-root") &&
      className.includes("overflow-y-auto") &&
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      scrollHeight > clientHeight + 1000 &&
      viewportHeight && clientHeight >= viewportHeight * 0.6 &&
      rectTop != null && rectTop >= -5 && rectTop <= 80 &&
      rectHeight >= viewportHeight * 0.6 &&
      (containsUserMessage || containsThread);

    let score = 0;
    if (className.includes("group/scroll-root")) score += 80;
    if (className.includes("overflow-y-auto")) score += 45;
    if (className.includes("scrollbar-gutter")) score += 25;
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") score += 30;
    if (scrollTop > 0) score += 25;
    if (scrollRange > 1000) score += 30;
    else if (scrollRange > 400) score += 10;
    if (rectTop != null && rectTop >= -5 && rectTop <= 80) score += 20;
    if (viewportHeight && rectHeight >= viewportHeight * 0.6) score += 25;
    if (containsUserMessage) score += 30;
    if (containsThread) score += 25;
    if (containsConversationMain) score += 10;
    if (mainScrollRootShape) score += 250;

    const rejectedReasons = [];
    if (insideCode) rejectedReasons.push("inside-pre-or-code");
    if (noScrollbarMaxHeight) rejectedReasons.push("no-scrollbar-max-h-local-container");
    if (smallLocalOverflow) rejectedReasons.push("small-local-scroll-container");
    if (containsCode && !containsUserMessage && !containsThread && !containsConversationMain) rejectedReasons.push("code-only-scroll-container");
    if (role && ["dialog", "menu", "listbox", "tooltip", "tabpanel"].includes(role)) rejectedReasons.push("local-panel-role-" + role);
    if (!mainScrollRootShape && /popover|dropdown|modal|menu|tooltip|panel/.test(className)) rejectedReasons.push("local-panel-class");
    if (scrollRange < 300) rejectedReasons.push("tiny-scroll-range");
    if (!mainScrollRootShape && scrollRange < 1000) rejectedReasons.push("insufficient-scroll-range");
    if (!mainScrollRootShape && smallLocalOverflow) score -= 200;
    if (!mainScrollRootShape && noScrollbarMaxHeight) score -= 250;
    if (!mainScrollRootShape && containsCode && !containsUserMessage && !containsThread && !containsConversationMain) score -= 180;
    if (!mainScrollRootShape && role && ["dialog", "menu", "listbox", "tooltip", "tabpanel"].includes(role)) score -= 140;
    if (!mainScrollRootShape && scrollRange < 1000) score -= 80;

    return {
      score,
      rejected: rejectedReasons.length > 0 && !mainScrollRootShape,
      rejectedReason: rejectedReasons.join(",") || null,
      rectTop: rectTop != null ? Math.round(rectTop) : null,
      rectHeight: rectHeight != null ? Math.round(rectHeight) : null,
      overflowY,
      classNamePreview: className ? className.slice(0, 240) : null,
      scrollTop,
      scrollHeight,
      clientHeight,
      canScrollDown: scrollTop < scrollHeight - clientHeight - 2,
      containsUserMessage,
      containsThread,
      mainScrollRootShape
    };
  }

  function buildKnownGapProbeTargetInfo(target, methodTried, errorMessage) {
    const metrics = getBackfillScrollMetrics(target);
    const node = target && target.node;
    const diagnostics = node && node !== window ? getKnownGapProbeTargetDiagnostics(node, metrics) : {
      score: target && target.isDocument ? 20 : 10,
      rejected: Number(metrics.scrollHeight || 0) <= Number(metrics.clientHeight || 0) + 2,
      rejectedReason: Number(metrics.scrollHeight || 0) <= Number(metrics.clientHeight || 0) + 2 ? "document-or-window-not-scrollable" : null,
      rectTop: null,
      rectHeight: null,
      overflowY: null,
      classNamePreview: null,
      scrollTop: metrics.scrollTop,
      scrollHeight: metrics.scrollHeight,
      clientHeight: metrics.clientHeight,
      canScrollDown: Number(metrics.scrollTop || 0) < Number(metrics.scrollHeight || 0) - Number(metrics.clientHeight || 0) - 2
    };
    return {
      descriptor: describeBackfillScrollTarget(target),
      score: diagnostics.score,
      rejected: !!diagnostics.rejected,
      rejectedReason: diagnostics.rejectedReason,
      isDocument: !!(target && target.isDocument),
      isWindow: node === window,
      scrollTop: metrics.scrollTop,
      scrollTopBefore: metrics.scrollTop,
      scrollTopAfter: metrics.scrollTop,
      scrollHeight: metrics.scrollHeight,
      clientHeight: metrics.clientHeight,
      canScrollUp: !!metrics.canScrollUp,
      canScrollDown: diagnostics.canScrollDown != null ? !!diagnostics.canScrollDown :
        Number(metrics.scrollTop || 0) < Number(metrics.scrollHeight || 0) - Number(metrics.clientHeight || 0) - 2,
      rectTop: diagnostics.rectTop,
      rectHeight: diagnostics.rectHeight,
      overflowY: diagnostics.overflowY,
      classNamePreview: diagnostics.classNamePreview,
      className: diagnostics.classNamePreview,
      methodTried: methodTried || null,
      workedByScrollMetric: false,
      errorMessage: errorMessage || null
    };
  }

  function getKnownGapProbeScrollRootScore(node) {
    if (!node || node === window || !node.getBoundingClientRect) return 0;
    return getKnownGapProbeTargetDiagnostics(node, null).score;
  }

  function findKnownGapProbeScrollRootCandidates() {
    return Array.from(document.querySelectorAll("div")).map((node) => ({
      node,
      diagnostics: getKnownGapProbeTargetDiagnostics(node, null)
    })).filter((item) => item.diagnostics.score >= 80 || item.diagnostics.rejected).sort((a, b) => b.diagnostics.score - a.diagnostics.score).slice(0, 12);
  }

  function collectKnownGapProbeScrollTargets() {
    const candidates = [];
    const seen = new Set();
    const add = (node, source, priority) => {
      if (!node || isInsidePanel(node)) return;
      const key = getKnownGapProbeTargetKey(node);
      if (seen.has(key)) return;
      seen.add(key);
      const target = createBackfillScrollTarget(node, source);
      if (!target) return;
      const info = buildKnownGapProbeTargetInfo(target, null, null);
      candidates.push({ target, info, source: source || "unknown", priority: Number(priority || 0) });
    };

    findKnownGapProbeScrollRootCandidates().forEach((item, index) => {
      add(item.node, "chatgpt-scroll-root score=" + item.diagnostics.score, 1000 - index);
    });
    const primary = findBackfillScrollTarget();
    if (primary && primary.node) add(primary.node, "findBackfillScrollTarget", 700);
    add(document.querySelector("main#main"), "main#main", 500);
    add(document.querySelector("#thread"), "#thread", 490);

    const firstVisible = getFirstVisibleBackfillMessageAnchor();
    let current = firstVisible && firstVisible.node ? firstVisible.node.parentElement : null;
    let depth = 0;
    while (current && current !== document.body && depth < 16) {
      add(current, "first-visible-message-ancestor-" + depth, 650 - depth);
      current = current.parentElement;
      depth += 1;
    }
    add(document.scrollingElement, "document.scrollingElement", 200);
    add(document.documentElement, "document.documentElement", 190);
    add(document.body, "document.body", 180);
    add(window, "window", 170);

    candidates.sort((a, b) => {
      if (a.info.rejected !== b.info.rejected) return a.info.rejected ? 1 : -1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (a.info.score !== b.info.score) return Number(b.info.score || 0) - Number(a.info.score || 0);
      if (a.info.canScrollUp !== b.info.canScrollUp) return a.info.canScrollUp ? -1 : 1;
      const aRange = Number(a.info.scrollHeight || 0) - Number(a.info.clientHeight || 0);
      const bRange = Number(b.info.scrollHeight || 0) - Number(b.info.clientHeight || 0);
      return bRange - aRange;
    });

    return candidates.slice(0, 18);
  }

  function scrollKnownGapProbeTargetBy(target, amount) {
    const node = target && target.node;
    if (!node) return "unsupported";
    markProgrammaticScroll();
    if (node === window) {
      window.scrollBy({ top: -amount, behavior: "auto" });
      return "window.scrollBy";
    }
    if (target && target.isDocument && node && node !== document && typeof node.scrollTop === "number") {
      node.scrollTop = Math.max(0, Number(node.scrollTop || 0) - amount);
      return "scrollTop-set";
    }
    if (target && target.isDocument) {
      window.scrollBy({ top: -amount, behavior: "auto" });
      return "window.scrollBy";
    }
    if (node && typeof node.scrollBy === "function") {
      node.scrollBy({ top: -amount, behavior: "auto" });
      return "scrollBy";
    }
    if (node && typeof node.scrollTop === "number") {
      node.scrollTop = Math.max(0, Number(node.scrollTop || 0) - amount);
      return "scrollTop-set";
    }
    return "unsupported";
  }

  async function tryKnownGapNativeScrollCandidate(candidate, attempt, beforeAudit) {
    const target = candidate && candidate.target;
    const info = candidate && candidate.info ? { ...candidate.info } : buildKnownGapProbeTargetInfo(target, null, null);
    const before = getBackfillScrollMetrics(target);
    info.scrollTopBefore = before.scrollTop;
    info.scrollHeight = before.scrollHeight;
    info.clientHeight = before.clientHeight;
    info.canScrollUp = !!before.canScrollUp;
    let methodTried = null;
    let errorMessage = null;
    const stepHistory = [];
    let afterImmediate = before;
    const baseAmount = Math.min(1600, Math.max(800, Number(before.clientHeight || window.innerHeight || 800) * 1.2));
    for (let step = 1; step <= KNOWN_GAP_NATIVE_PROBE_MAX_STEPS; step += 1) {
      const stepBefore = getBackfillScrollMetrics(target);
      const amount = Math.round(baseAmount);
      try {
        methodTried = scrollKnownGapProbeTargetBy(target, amount);
      } catch (error) {
        errorMessage = error && error.message ? error.message : String(error);
      }
      await waitForBackfillFrame(120);
      const stepAfter = getBackfillScrollMetrics(target);
      afterImmediate = stepAfter;
      const moved = Math.abs(Number(stepAfter.scrollTop || 0) - Number(stepBefore.scrollTop || 0)) > 1 ||
        Math.abs(Number(stepAfter.windowScrollY || 0) - Number(stepBefore.windowScrollY || 0)) > 1;
      const stepEntry = {
        step,
        methodTried,
        amount,
        scrollTopBefore: stepBefore.scrollTop,
        scrollTopAfter: stepAfter.scrollTop,
        scrollHeightBefore: stepBefore.scrollHeight,
        scrollHeightAfter: stepAfter.scrollHeight,
        workedByScrollMetric: moved,
        errorMessage: errorMessage || null
      };
      stepHistory.push(stepEntry);
      appendBackfillTraceEvent("known-gap-native-probe-step", "native-scroll-step", {
        beforeIndex: beforeAudit ? beforeAudit.firstVisibleDomRegistryIndex : null,
        knownGapBefore: beforeAudit ? beforeAudit.knownTopGapFromFirstVisible : null,
        registryCountBefore: beforeAudit ? beforeAudit.registryCount : null,
        targetDescriptor: info.descriptor,
        scrollMethod: methodTried,
        scrollAmount: amount,
        result: moved ? "scroll-metric-moved" : "no-scroll-metric",
        reason: "step-" + step
      });
      if (Number(stepAfter.scrollTop || 0) <= KNOWN_GAP_NATIVE_PROBE_TOP_THRESHOLD) break;
      await waitForBackfillFrame(300);
    }

    const reachedTopThreshold = Number(afterImmediate.scrollTop || 0) <= KNOWN_GAP_NATIVE_PROBE_TOP_THRESHOLD;
    const waitMsAfterTop = reachedTopThreshold ? Math.min(3500, 2500 + Math.max(0, attempt - 1) * 250) : Math.min(1600, 1200 + attempt * 80);
    if (reachedTopThreshold) {
      appendBackfillTraceEvent("known-gap-native-probe-reached-top-threshold", "threshold", {
        beforeIndex: beforeAudit ? beforeAudit.firstVisibleDomRegistryIndex : null,
        knownGapBefore: beforeAudit ? beforeAudit.knownTopGapFromFirstVisible : null,
        registryCountBefore: beforeAudit ? beforeAudit.registryCount : null,
        targetDescriptor: info.descriptor,
        scrollMethod: methodTried,
        scrollAmount: stepHistory.reduce((sum, step) => sum + Number(step.amount || 0), 0),
        result: "reached-top-threshold",
        reason: "scrollTop<=200"
      });
      appendBackfillTraceEvent("known-gap-native-probe-wait-hydration", "wait", {
        beforeIndex: beforeAudit ? beforeAudit.firstVisibleDomRegistryIndex : null,
        knownGapBefore: beforeAudit ? beforeAudit.knownTopGapFromFirstVisible : null,
        registryCountBefore: beforeAudit ? beforeAudit.registryCount : null,
        targetDescriptor: info.descriptor,
        scrollMethod: methodTried,
        scrollAmount: null,
        result: "waiting",
        reason: "top-threshold-wait-ms-" + waitMsAfterTop
      });
    }
    await waitForBackfillFrame(waitMsAfterTop);
    const afterWait = getBackfillScrollMetrics(target);
    const scrollHeightDelta = Number(afterWait.scrollHeight || 0) - Number(before.scrollHeight || 0);
    const scrollHeightIncreased = scrollHeightDelta > 20;
    const anchorCompensatedScrollTop = reachedTopThreshold && scrollHeightIncreased &&
      Number(afterWait.scrollTop || 0) > Number(afterImmediate.scrollTop || 0) + 20;
    if (scrollHeightIncreased) {
      appendBackfillTraceEvent("known-gap-native-probe-scrollheight-increased", "observe", {
        beforeIndex: beforeAudit ? beforeAudit.firstVisibleDomRegistryIndex : null,
        knownGapBefore: beforeAudit ? beforeAudit.knownTopGapFromFirstVisible : null,
        registryCountBefore: beforeAudit ? beforeAudit.registryCount : null,
        targetDescriptor: info.descriptor,
        scrollMethod: methodTried,
        scrollAmount: null,
        result: "scrollheight-increased",
        reason: "delta-" + Math.round(scrollHeightDelta)
      });
    }
    if (anchorCompensatedScrollTop) {
      appendBackfillTraceEvent("known-gap-native-probe-anchor-compensated", "observe", {
        beforeIndex: beforeAudit ? beforeAudit.firstVisibleDomRegistryIndex : null,
        knownGapBefore: beforeAudit ? beforeAudit.knownTopGapFromFirstVisible : null,
        registryCountBefore: beforeAudit ? beforeAudit.registryCount : null,
        targetDescriptor: info.descriptor,
        scrollMethod: methodTried,
        scrollAmount: null,
        result: "anchor-compensated",
        reason: "scrollTop-rebounded-after-scrollHeight-growth"
      });
    }

    info.scrollTopAfter = afterWait.scrollTop;
    info.scrollTopAfterImmediate = afterImmediate.scrollTop;
    info.scrollTopAfterWait = afterWait.scrollTop;
    info.scrollHeightBefore = before.scrollHeight;
    info.scrollHeightAfterImmediate = afterImmediate.scrollHeight;
    info.scrollHeightAfterWait = afterWait.scrollHeight;
    info.scrollHeightDelta = scrollHeightDelta;
    info.reachedTopThreshold = reachedTopThreshold;
    info.scrollHeightIncreased = scrollHeightIncreased;
    info.anchorCompensatedScrollTop = anchorCompensatedScrollTop;
    info.topHydrationCycleDetected = reachedTopThreshold && scrollHeightIncreased;
    info.stepCount = stepHistory.length;
    info.waitMsAfterTop = waitMsAfterTop;
    info.methodTried = methodTried;
    info.workedByScrollMetric = stepHistory.some((step) => step.workedByScrollMetric);
    info.errorMessage = errorMessage;
    return {
      info,
      before,
      after: afterWait,
      afterImmediate,
      afterWait,
      methodTried,
      workedByScrollMetric: info.workedByScrollMetric,
      reachedTopThreshold,
      scrollHeightIncreased,
      scrollHeightDelta,
      anchorCompensatedScrollTop,
      topHydrationCycleDetected: reachedTopThreshold && scrollHeightIncreased,
      waitMsAfterTop,
      stepHistory,
      stepCount: stepHistory.length,
      amount: stepHistory.reduce((sum, step) => sum + Number(step.amount || 0), 0)
    };
  }

  async function runKnownGapNativeScrollPulse(attempt, beforeAudit) {
    const candidates = collectKnownGapProbeScrollTargets();
    const targetInfos = candidates.map((candidate) => candidate.info);
    appendBackfillTraceEvent("known-gap-native-probe-targets", "collect", {
      beforeIndex: beforeAudit ? beforeAudit.firstVisibleDomRegistryIndex : null,
      knownGapBefore: beforeAudit ? beforeAudit.knownTopGapFromFirstVisible : null,
      registryCountBefore: beforeAudit ? beforeAudit.registryCount : null,
      result: "collected",
      reason: "native-scroll-target-candidates"
    });

    let selected = null;
    for (const candidate of candidates) {
      if (candidate.info && candidate.info.rejected) continue;
      const result = await tryKnownGapNativeScrollCandidate(candidate, attempt, beforeAudit);
      const index = targetInfos.findIndex((item) => item.descriptor === result.info.descriptor);
      if (index >= 0) targetInfos[index] = result.info;
      if (!selected || result.workedByScrollMetric) selected = result;
      if (result.workedByScrollMetric) break;
    }

    const chosenInfo = selected && selected.info ? selected.info : targetInfos[0] || null;
    appendBackfillTraceEvent("known-gap-native-probe-scroll", "native-scroll", {
      beforeIndex: beforeAudit ? beforeAudit.firstVisibleDomRegistryIndex : null,
      knownGapBefore: beforeAudit ? beforeAudit.knownTopGapFromFirstVisible : null,
      registryCountBefore: beforeAudit ? beforeAudit.registryCount : null,
      targetDescriptor: chosenInfo ? chosenInfo.descriptor : null,
      scrollMethod: chosenInfo ? chosenInfo.methodTried : null,
      scrollAmount: selected ? selected.amount : null,
      result: chosenInfo && chosenInfo.workedByScrollMetric ? "scroll-metric-moved" : "no-scroll-metric",
      reason: "native-scroll-api"
    });

    return {
      amount: selected ? selected.amount : null,
      targetCandidates: targetInfos,
      selectedInfo: chosenInfo,
      selectedBefore: selected && selected.before ? selected.before : null,
      selectedAfter: selected && selected.after ? selected.after : null,
      selectedAfterImmediate: selected && selected.afterImmediate ? selected.afterImmediate : null,
      selectedAfterWait: selected && selected.afterWait ? selected.afterWait : null,
      nativeScrollAttempted: candidates.length > 0,
      nativeScrollWorked: !!(chosenInfo && chosenInfo.workedByScrollMetric),
      reachedTopThreshold: !!(selected && selected.reachedTopThreshold),
      scrollHeightIncreased: !!(selected && selected.scrollHeightIncreased),
      scrollHeightDelta: selected ? selected.scrollHeightDelta : 0,
      anchorCompensatedScrollTop: !!(selected && selected.anchorCompensatedScrollTop),
      topHydrationCycleDetected: !!(selected && selected.topHydrationCycleDetected),
      waitMsAfterTop: selected ? selected.waitMsAfterTop : null,
      stepHistory: selected && Array.isArray(selected.stepHistory) ? selected.stepHistory : [],
      stepCount: selected ? selected.stepCount : 0
    };
  }

  function isKnownGapProbeHydrationSuccess(before, after, comparison) {
    if (!before || !after || !comparison) return false;
    const beforeIndex = typeof before.firstVisibleDomRegistryIndex === "number" ? before.firstVisibleDomRegistryIndex : null;
    const afterIndex = typeof after.firstVisibleDomRegistryIndex === "number" ? after.firstVisibleDomRegistryIndex : null;
    const beforeGap = typeof before.knownTopGapFromFirstVisible === "number" ? before.knownTopGapFromFirstVisible : null;
    const afterGap = typeof after.knownTopGapFromFirstVisible === "number" ? after.knownTopGapFromFirstVisible : null;
    const visibleHead = Array.isArray(after.visibleDomMessageIdsHead) ? after.visibleDomMessageIdsHead : [];
    const visibleHeadHasEarlierKnownMessage = beforeIndex != null && visibleHead.some((id) => {
      const registryIndex = getRegistryOrderIndex(id);
      return registryIndex >= 0 && registryIndex < beforeIndex;
    });
    return Number(comparison.hydrationRegistryDelta || 0) > 0 ||
      !!comparison.hydrationFirstRegistryChanged ||
      (beforeGap != null && afterGap != null && afterGap < beforeGap) ||
      (beforeIndex != null && afterIndex != null && afterIndex >= 0 && afterIndex < beforeIndex) ||
      visibleHeadHasEarlierKnownMessage;
  }

  function getKnownGapProbeVisibleHeadEarliestIndex(audit) {
    const ids = audit && Array.isArray(audit.visibleDomMessageIdsHead) ? audit.visibleDomMessageIdsHead : [];
    const indexes = ids.map((id) => getRegistryOrderIndex(id)).filter((index) => index >= 0);
    return indexes.length ? Math.min(...indexes) : null;
  }

  function didKnownGapProbeVisibleHeadMoveLater(before, after) {
    const beforeIndex = getKnownGapProbeVisibleHeadEarliestIndex(before);
    const afterIndex = getKnownGapProbeVisibleHeadEarliestIndex(after);
    return beforeIndex != null && afterIndex != null && afterIndex > beforeIndex;
  }

  function getKnownGapProbeResultReason(before, after, comparison, pulse, hydrationSuccess) {
    const beforeGap = before && typeof before.knownTopGapFromFirstVisible === "number" ? before.knownTopGapFromFirstVisible : null;
    const afterGap = after && typeof after.knownTopGapFromFirstVisible === "number" ? after.knownTopGapFromFirstVisible : null;
    if (hydrationSuccess) {
      if (beforeGap != null && afterGap != null && afterGap < beforeGap) return "known-gap-reduced-after-top-hydration";
      return comparison && comparison.hydrationDetectionReason ? comparison.hydrationDetectionReason : "known-gap-probe-hydration-detected";
    }
    if (pulse && pulse.topHydrationCycleDetected) return "top-hydration-cycle-detected-but-no-known-gap-improvement";
    if (pulse && pulse.reachedTopThreshold && !pulse.scrollHeightIncreased) return "reached-top-but-no-scrollheight-growth";
    return comparison && comparison.hydrationDetectionReason ? comparison.hydrationDetectionReason : "native-scroll-no-hydration";
  }

  async function runKnownGapEarlierDomAnchorProbe(currentAudit) {
    const beforeIndex = currentAudit && typeof currentAudit.firstVisibleDomRegistryIndex === "number" ? currentAudit.firstVisibleDomRegistryIndex : -1;
    const candidateIds = [];
    const rejectedIds = [];
    if (beforeIndex <= 0 || !Array.isArray(state.messageOrder)) {
      return { attempted: false, worked: false, candidateIds, rejectedIds, selectedId: null };
    }
    for (let index = beforeIndex - 1; index >= 0; index -= 1) {
      const messageId = state.messageOrder[index];
      if (!messageId) continue;
      const node = document.querySelector(`[data-message-id="${cssEscape(messageId)}"]`);
      if (node && node.isConnected && typeof node.scrollIntoView === "function") {
        candidateIds.push(messageId);
        markProgrammaticScroll();
        node.scrollIntoView({ block: "start", behavior: "auto" });
        await waitForBackfillFrame(900);
        return { attempted: true, worked: true, candidateIds, rejectedIds, selectedId: messageId };
      }
      rejectedIds.push(messageId);
    }
    return { attempted: rejectedIds.length > 0, worked: false, candidateIds, rejectedIds, selectedId: null };
  }

  function buildKnownGapProbeAuditPatch(before, after, comparison, pulse, attemptHistory) {
    const selectedInfo = pulse && pulse.selectedInfo ? pulse.selectedInfo : {};
    const hydrationSuccess = isKnownGapProbeHydrationSuccess(before, after, comparison);
    return {
      knownGapProbeRegistryCountBefore: before ? before.registryCount : null,
      knownGapProbeRegistryCountAfter: after ? after.registryCount : null,
      knownGapProbeRegistryDelta: comparison ? Number(comparison.hydrationRegistryDelta || 0) : 0,
      knownGapProbeVisibleDomCountBefore: before ? before.visibleDomUserMessageCount : null,
      knownGapProbeVisibleDomCountAfter: after ? after.visibleDomUserMessageCount : null,
      knownGapProbeVisibleDomDelta: comparison ? Number(comparison.hydrationVisibleDomDelta || 0) : 0,
      knownGapProbeFirstVisibleIndexBefore: before ? before.firstVisibleDomRegistryIndex : null,
      knownGapProbeFirstVisibleIndexAfter: after ? after.firstVisibleDomRegistryIndex : null,
      knownGapProbeKnownGapBefore: before ? before.knownTopGapFromFirstVisible : null,
      knownGapProbeKnownGapAfter: after ? after.knownTopGapFromFirstVisible : null,
      knownGapProbeFirstRegistryBefore: before ? before.firstRegistryMessageId : null,
      knownGapProbeFirstRegistryAfter: after ? after.firstRegistryMessageId : null,
      knownGapProbeBefore: before || null,
      knownGapProbeAfter: after || null,
      knownGapProbeHydrationDetected: !!hydrationSuccess,
      knownGapProbeVisualOnly: !hydrationSuccess && !!((comparison && comparison.hydrationOnlyVisualMovement) || (pulse && pulse.nativeScrollWorked)),
      knownGapProbeNativeScrollAttempted: !!(pulse && pulse.nativeScrollAttempted),
      knownGapProbeNativeScrollWorked: !!(pulse && pulse.nativeScrollWorked),
      knownGapProbeScrollMethod: selectedInfo.methodTried || null,
      knownGapProbeScrollTargetDescriptor: selectedInfo.descriptor || null,
      knownGapProbeScrollAmount: pulse ? pulse.amount : null,
      knownGapProbeScrollTopBefore: selectedInfo.scrollTopBefore,
      knownGapProbeScrollTopAfter: selectedInfo.scrollTopAfter,
      knownGapProbeScrollTopAfterImmediate: pulse && pulse.selectedAfterImmediate ? pulse.selectedAfterImmediate.scrollTop : null,
      knownGapProbeScrollTopAfterWait: pulse && pulse.selectedAfterWait ? pulse.selectedAfterWait.scrollTop : selectedInfo.scrollTopAfter,
      knownGapProbeScrollHeightBefore: pulse && pulse.selectedBefore ? pulse.selectedBefore.scrollHeight : selectedInfo.scrollHeight,
      knownGapProbeScrollHeightAfterImmediate: pulse && pulse.selectedAfterImmediate ? pulse.selectedAfterImmediate.scrollHeight : null,
      knownGapProbeScrollHeightAfterWait: pulse && pulse.selectedAfterWait ? pulse.selectedAfterWait.scrollHeight : null,
      knownGapProbeScrollHeightDelta: pulse ? Number(pulse.scrollHeightDelta || 0) : 0,
      knownGapProbeClientHeight: pulse && pulse.selectedBefore ? pulse.selectedBefore.clientHeight : selectedInfo.clientHeight,
      knownGapProbeReachedTopThreshold: !!(pulse && pulse.reachedTopThreshold),
      knownGapProbeScrollHeightIncreased: !!(pulse && pulse.scrollHeightIncreased),
      knownGapProbeAnchorCompensatedScrollTop: !!(pulse && pulse.anchorCompensatedScrollTop),
      knownGapProbeTopHydrationCycleDetected: !!(pulse && pulse.topHydrationCycleDetected),
      knownGapProbeStepCount: pulse ? Number(pulse.stepCount || 0) : 0,
      knownGapProbeStepHistory: pulse && Array.isArray(pulse.stepHistory) ? pulse.stepHistory : [],
      knownGapProbeWaitMsAfterTop: pulse ? pulse.waitMsAfterTop : null,
      knownGapProbeWindowScrollYBefore: pulse && pulse.selectedBefore ? pulse.selectedBefore.windowScrollY : window.scrollY || 0,
      knownGapProbeWindowScrollYAfter: pulse && pulse.selectedAfter ? pulse.selectedAfter.windowScrollY : window.scrollY || 0,
      knownGapProbeTargetCandidates: pulse && Array.isArray(pulse.targetCandidates) ? pulse.targetCandidates : [],
      knownGapProbeAttemptHistory: attemptHistory || []
    };
  }

  function getFirstVisibleBackfillMessageAnchor() {
    const nodes = Array.from(document.querySelectorAll(USER_SELECTOR));
    if (!nodes.length) return null;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const node = nodes.find((item) => {
      if (!item || isInsidePanel(item) || !item.getBoundingClientRect) return false;
      const rect = item.getBoundingClientRect();
      return rect.height > 0 && rect.bottom > 0 && (!viewportHeight || rect.top < viewportHeight);
    }) || nodes[0];
    return {
      node,
      messageId: node.getAttribute("data-message-id") || null
    };
  }

  function getBackfillMessageAnchorMetrics(anchor) {
    if (!anchor || !anchor.node || !anchor.node.getBoundingClientRect) return null;
    const rect = anchor.node.getBoundingClientRect();
    return {
      messageId: anchor.messageId || anchor.node.getAttribute("data-message-id") || null,
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height
    };
  }

  async function scrollBackfillAnchorIntoView(anchor) {
    if (!anchor || !anchor.node || typeof anchor.node.scrollIntoView !== "function") return false;
    markProgrammaticScroll();
    anchor.node.scrollIntoView({ block: "end", behavior: "auto" });
    await waitForBackfillFrame(600);
    return true;
  }

  function didBackfillAnchorMove(before, after) {
    if (!before || !after) return false;
    if (before.messageId && after.messageId && before.messageId !== after.messageId) return true;
    return Math.abs(Number(after.top || 0) - Number(before.top || 0)) > 8 ||
      Math.abs(Number(after.bottom || 0) - Number(before.bottom || 0)) > 8;
  }

  function getRegistryOrderIndex(messageId) {
    if (!messageId || !state.messageOrder || !state.messageOrder.length) return -1;
    return state.messageOrder.indexOf(messageId);
  }

  function getBackfillVisibleUserNodes() {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    return Array.from(document.querySelectorAll(USER_SELECTOR)).filter((node) => {
      if (!node || isInsidePanel(node) || !node.getBoundingClientRect) return false;
      const rect = node.getBoundingClientRect();
      return rect.height > 0 && rect.bottom > 0 && (!viewportHeight || rect.top < viewportHeight);
    });
  }

  function getBackfillViewportMetrics(activeAnchorId) {
    const visibleNodes = getBackfillVisibleUserNodes();
    const allNodes = Array.from(document.querySelectorAll(USER_SELECTOR));
    const firstNode = visibleNodes[0] || allNodes[0] || null;
    const lastNode = visibleNodes.length ? visibleNodes[visibleNodes.length - 1] : allNodes.length ? allNodes[allNodes.length - 1] : null;
    const firstVisibleDomMessageId = firstNode ? firstNode.getAttribute("data-message-id") || null : null;
    const lastVisibleDomMessageId = lastNode ? lastNode.getAttribute("data-message-id") || null : null;
    const firstVisibleRegistryIndex = getRegistryOrderIndex(firstVisibleDomMessageId);
    const visibleDomUserMessageCount = allNodes.length;
    const viewportSignature = [
      firstVisibleDomMessageId || "none",
      lastVisibleDomMessageId || "none",
      firstVisibleRegistryIndex,
      visibleDomUserMessageCount,
      activeAnchorId || "none"
    ].join("|");
    return {
      firstVisibleDomMessageId,
      lastVisibleDomMessageId,
      firstVisibleRegistryIndex,
      visibleDomUserMessageCount,
      registryCount: state.messageRegistry ? state.messageRegistry.size : 0,
      firstRegistryMessageId: state.messageOrder && state.messageOrder[0] ? state.messageOrder[0] : null,
      messageHash: state.messageHash || "",
      viewportSignature
    };
  }

  function getBackfillViewportSignature(activeAnchorId) {
    return getBackfillViewportMetrics(activeAnchorId).viewportSignature;
  }

  function recordBackfillProgress(current, extra) {
    const anchorDelta = extra && typeof extra.anchorDelta === "number" ? extra.anchorDelta : null;
    const previousBestIndex = typeof state.backfill.bestFirstVisibleRegistryIndex === "number" ? state.backfill.bestFirstVisibleRegistryIndex : null;
    const previousBestRegistryCount = Number(state.backfill.bestRegistryCount || 0);
    const previousBestVisibleCount = Number(state.backfill.bestVisibleDomUserMessageCount || 0);
    const previousBestMessageId = state.backfill.bestFirstVisibleDomMessageId || null;
    const previousBestFirstRegistryMessageId = state.backfill._bestFirstRegistryMessageId || null;
    const previousBestMessageHash = state.backfill._bestMessageHash || "";
    const reasons = [];
    if (!state.backfill._lastProgressMetrics) {
      reasons.push("initial-snapshot");
    }
    if (Number(current.registryCount || 0) > previousBestRegistryCount) reasons.push("registry-count-increased");
    if (previousBestFirstRegistryMessageId && current.firstRegistryMessageId && current.firstRegistryMessageId !== previousBestFirstRegistryMessageId) {
      reasons.push("first-registry-message-changed");
    }
    if (current.firstVisibleRegistryIndex >= 0 &&
      (previousBestIndex == null || current.firstVisibleRegistryIndex < previousBestIndex)) {
      reasons.push("best-first-visible-index-decreased");
    }
    if (current.firstVisibleDomMessageId &&
      current.firstVisibleDomMessageId !== previousBestMessageId &&
      current.firstVisibleRegistryIndex >= 0 &&
      (previousBestIndex == null || current.firstVisibleRegistryIndex < previousBestIndex)) {
      reasons.push("best-first-visible-id-earlier");
    }
    if ((current.messageHash || "") !== previousBestMessageHash &&
      (Number(current.registryCount || 0) > previousBestRegistryCount ||
        Number(current.visibleDomUserMessageCount || 0) > previousBestVisibleCount ||
        (current.firstVisibleRegistryIndex >= 0 && (previousBestIndex == null || current.firstVisibleRegistryIndex < previousBestIndex)))) {
      reasons.push("message-hash-best-progress");
    }

    const progress = reasons.length > 0;
    const anchorMovedOnly = !progress && anchorDelta != null && Math.abs(anchorDelta) > 8;
    const recent = Array.isArray(state.backfill.recentViewportSignatures) ? state.backfill.recentViewportSignatures.slice() : [];
    recent.push(current.viewportSignature);
    const trimmedRecent = recent.slice(-12);
    const recentEight = trimmedRecent.slice(-8);
    const repeatedCount = trimmedRecent.filter((signature) => signature === current.viewportSignature).length;
    const uniqueRecentCount = new Set(trimmedRecent).size;
    const uniqueRecentEightCount = new Set(recentEight).size;
    const progressRoundCount = Number(state.backfill.progressRoundCount || 0) + 1;
    const noProgressRoundCount = progress ? 0 : Number(state.backfill.noProgressRoundCount || 0) + 1;
    const roundsSinceBestProgress = progress ? 0 : Number(state.backfill.roundsSinceBestProgress || 0) + 1;
    const registryBestUnchanged = Number(current.registryCount || 0) <= previousBestRegistryCount;
    const bestIndexUnchanged = previousBestIndex != null && current.firstVisibleRegistryIndex >= previousBestIndex;
    const oscillationDetected = (recentEight.length >= 8 && uniqueRecentEightCount <= 2 && roundsSinceBestProgress >= 3 && registryBestUnchanged && bestIndexUnchanged) ||
      (trimmedRecent.length >= 8 && uniqueRecentCount <= 3 && repeatedCount >= 4 && roundsSinceBestProgress >= 4 && registryBestUnchanged && bestIndexUnchanged);
    const bestFirstVisibleRegistryIndex = current.firstVisibleRegistryIndex >= 0 ?
      previousBestIndex == null ? current.firstVisibleRegistryIndex : Math.min(previousBestIndex, current.firstVisibleRegistryIndex) :
      previousBestIndex;
    const bestRegistryCount = Math.max(Number(state.backfill.bestRegistryCount || 0), Number(current.registryCount || 0));
    const bestVisibleDomUserMessageCount = Math.max(Number(state.backfill.bestVisibleDomUserMessageCount || 0), Number(current.visibleDomUserMessageCount || 0));
    const bestFirstVisibleDomMessageId = progress && current.firstVisibleRegistryIndex === bestFirstVisibleRegistryIndex ?
      current.firstVisibleDomMessageId : state.backfill.bestFirstVisibleDomMessageId || current.firstVisibleDomMessageId;
    const progressReason = progress ? reasons.join(",") : anchorMovedOnly ? "anchor-moved-only-no-best-progress" : "no-progress";
    const patch = {
      progressRoundCount,
      noProgressRoundCount,
      noProgressRoundLimit: Number(state.backfill.noProgressRoundLimit || 6),
      lastProgressReason: progressReason,
      progressComparedToBest: progress,
      bestProgressUpdatedAt: progress ? new Date().toISOString() : state.backfill.bestProgressUpdatedAt || null,
      anchorMovedOnlyIgnoredAsProgress: anchorMovedOnly,
      lastBestProgressReason: progress ? reasons.join(",") : state.backfill.lastBestProgressReason || null,
      bestFirstVisibleRegistryIndex,
      bestRegistryCount,
      bestFirstVisibleDomMessageId,
      bestVisibleDomUserMessageCount,
      viewportSignature: current.viewportSignature,
      recentViewportSignatures: trimmedRecent,
      repeatedViewportSignatureCount: repeatedCount,
      uniqueRecentViewportSignatureCount: uniqueRecentCount,
      oscillationDetected,
      oscillationSignature: oscillationDetected ? current.viewportSignature : state.backfill.oscillationSignature || null,
      oscillationPattern: oscillationDetected ? recentEight.join(" -> ") : state.backfill.oscillationPattern || null,
      oscillationStopTriggeredAt: oscillationDetected ? new Date().toISOString() : state.backfill.oscillationStopTriggeredAt || null,
      roundsSinceBestProgress,
      _lastProgressMetrics: current,
      _bestFirstRegistryMessageId: progress ? current.firstRegistryMessageId || previousBestFirstRegistryMessageId : previousBestFirstRegistryMessageId || current.firstRegistryMessageId,
      _bestMessageHash: progress ? current.messageHash || previousBestMessageHash : previousBestMessageHash || current.messageHash
    };
    setBackfillStatus(state.backfill.status || "running", patch);
    return { progress, reasons, noProgressRoundCount, oscillationDetected };
  }

  async function tryBackfillTopHydrationProbe(context) {
    const anchor = getFirstVisibleBackfillMessageAnchor();
    const before = context && context.beforeMetrics ? context.beforeMetrics : getBackfillViewportMetrics(anchor && anchor.messageId);
    if (anchor && anchor.node && typeof anchor.node.scrollIntoView === "function") {
      markProgrammaticScroll();
      anchor.node.scrollIntoView({ block: "start", behavior: "auto" });
    }
    try {
      markProgrammaticScroll();
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: -420, deltaMode: 0, bubbles: true, cancelable: true }));
    } catch (error) {
      debugLog("warn", "backfill top hydration wheel probe failed", { message: error && error.message ? error.message : String(error) });
    }
    await waitForBackfillFrame(1200);
    const scanMetrics = scanMergeSaveBackfillBatch("manual-backfill-top-probe");
    const after = getBackfillViewportMetrics(anchor && anchor.messageId);
    const progress = evaluateBackfillUsefulProgress(before, after, scanMetrics, {
      registryCountBefore: before.registryCount
    });
    const hydratedEarlier = progress.useful;
    const visualOnly = !hydratedEarlier && (
      after.firstVisibleDomMessageId !== before.firstVisibleDomMessageId ||
      after.visibleDomUserMessageCount !== before.visibleDomUserMessageCount ||
      after.messageHash !== before.messageHash
    );
    return {
      hydratedEarlier,
      unsafeReverse: progress.reverseMovement,
      reason: hydratedEarlier ? progress.reasons.join(",") : progress.reverseMovement ? "unsafe-reverse-hydration-probe" : "no-hydration-progress",
      visualOnly,
      scanMetrics,
      before,
      after,
      anchorId: anchor && anchor.messageId ? anchor.messageId : null
    };
  }

  function getBackfillMessageAnchorCandidates() {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    return Array.from(document.querySelectorAll(USER_SELECTOR)).map((node, index) => {
      if (!node || isInsidePanel(node) || !node.getBoundingClientRect) return null;
      const rect = node.getBoundingClientRect();
      const messageId = node.getAttribute("data-message-id") || "user-" + index;
      const isVisible = rect.height > 0 && rect.bottom > 0 && (!viewportHeight || rect.top < viewportHeight);
      return {
        node,
        messageId,
        index,
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        isVisible,
        isAboveViewport: rect.bottom <= 0,
        isPartiallyVisible: rect.height > 0 && rect.bottom > 0 && rect.top < viewportHeight,
        registryIndex: getRegistryOrderIndex(messageId)
      };
    }).filter(Boolean);
  }

  function rankBackfillAnchorCandidates(candidates, context) {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const currentIndex = context && typeof context.currentFirstVisibleRegistryIndex === "number" ? context.currentFirstVisibleRegistryIndex : -1;
    const blacklist = new Set((state.backfill && state.backfill.anchorBlacklistedIds) || []);
    return (candidates || []).filter((candidate) => {
      if (!candidate || blacklist.has(candidate.messageId)) return false;
      if (!isBackfillCandidateMonotonic(candidate, context)) return false;
      if (currentIndex === 0 && candidate.registryIndex === 0) return false;
      return true;
    }).sort((a, b) => {
      const aEarlier = currentIndex > 0 && a.registryIndex >= 0 && a.registryIndex < currentIndex;
      const bEarlier = currentIndex > 0 && b.registryIndex >= 0 && b.registryIndex < currentIndex;
      if (aEarlier !== bEarlier) return aEarlier ? -1 : 1;
      const aKnown = a.registryIndex >= 0;
      const bKnown = b.registryIndex >= 0;
      if (aKnown !== bKnown) return aKnown ? -1 : 1;
      if (aKnown && bKnown && a.registryIndex !== b.registryIndex) return a.registryIndex - b.registryIndex;
      const aNearViewport = a.top < viewportHeight;
      const bNearViewport = b.top < viewportHeight;
      if (aNearViewport !== bNearViewport) return aNearViewport ? -1 : 1;
      if (a.isPartiallyVisible !== b.isPartiallyVisible) return a.isPartiallyVisible ? -1 : 1;
      if (a.top !== b.top) return a.top - b.top;
      return a.index - b.index;
    });
  }

  function getBackfillAnchorCandidateIds(candidates) {
    return (candidates || []).map((candidate) => candidate && candidate.messageId).filter(Boolean);
  }

  function getBackfillAnchorRejectedReasons(candidates, ranked, context) {
    const rankedIds = new Set(getBackfillAnchorCandidateIds(ranked));
    const blacklist = new Set((state.backfill && state.backfill.anchorBlacklistedIds) || []);
    const currentIndex = context && typeof context.currentFirstVisibleRegistryIndex === "number" ? context.currentFirstVisibleRegistryIndex : -1;
    return (candidates || []).filter((candidate) => candidate && !rankedIds.has(candidate.messageId)).map((candidate) => {
      let reason = "filtered-by-ranking";
      if (blacklist.has(candidate.messageId)) reason = "blacklisted";
      else if (currentIndex > 0 && candidate.registryIndex >= 0 && candidate.registryIndex > currentIndex) reason = "later-registry-index";
      else if (currentIndex === 0 && candidate.registryIndex === 0) reason = "known-start-anchor";
      else {
        const monotonicReason = getBackfillCandidateMonotonicRejection(candidate, context);
        if (monotonicReason) reason = monotonicReason;
      }
      return candidate.messageId + ":" + reason;
    });
  }

  function getBackfillCandidateMonotonicRejection(candidate, context) {
    if (!candidate || typeof candidate.registryIndex !== "number" || candidate.registryIndex < 0) return "unknown-registry-index";
    const bestIndex = typeof state.backfill.bestFirstVisibleRegistryIndex === "number" ? state.backfill.bestFirstVisibleRegistryIndex : -1;
    const currentIndex = context && typeof context.currentFirstVisibleRegistryIndex === "number" ? context.currentFirstVisibleRegistryIndex : -1;
    if (bestIndex >= 0 && candidate.registryIndex > bestIndex) return "later-than-best-index";
    if (bestIndex < 0 && currentIndex >= 0 && candidate.registryIndex > currentIndex) return "later-than-current-index";
    if (currentIndex >= 0 && candidate.registryIndex > currentIndex) return "later-than-current-index";
    return null;
  }

  function isBackfillCandidateMonotonic(candidate, context) {
    return !getBackfillCandidateMonotonicRejection(candidate, context);
  }

  function rankBackfillRelaxedAnchorCandidates(candidates, context) {
    const blacklist = new Set((state.backfill && state.backfill.anchorBlacklistedIds) || []);
    const tried = new Set((context && context.triedIds) || []);
    const skippedBlacklisted = (candidates || []).filter((candidate) => candidate && blacklist.has(candidate.messageId));
    const skippedLater = [];
    let rejectedByBest = 0;
    let rejectedByCurrent = 0;
    const raw = (candidates || []).filter((candidate) => {
      if (!candidate || !candidate.node || !candidate.node.isConnected) return false;
      if (blacklist.has(candidate.messageId)) return false;
      const monotonicReason = getBackfillCandidateMonotonicRejection(candidate, context);
      if (monotonicReason) {
        skippedLater.push(candidate);
        if (monotonicReason === "later-than-best-index") rejectedByBest += 1;
        if (monotonicReason === "later-than-current-index") rejectedByCurrent += 1;
        return false;
      }
      return true;
    });
    setBackfillStatus(state.backfill.status || "running", {
      blacklistedRelaxedCandidateExcludedCount: skippedBlacklisted.length,
      relaxedSkippedBlacklistedIds: skippedBlacklisted.map((candidate) => candidate.messageId).filter(Boolean),
      allCandidatesBlacklisted: !!((candidates || []).length && !raw.length && skippedBlacklisted.length === (candidates || []).length),
      relaxedLaterCandidateExcludedCount: skippedLater.length,
      relaxedSkippedLaterCandidateIds: skippedLater.map((candidate) => candidate.messageId).filter(Boolean),
      relaxedMonotonicGuardEnabled: true,
      relaxedRejectedByBestIndexCount: rejectedByBest,
      relaxedRejectedByCurrentIndexCount: rejectedByCurrent,
      anchorRejectedBecauseLaterThanBest: rejectedByBest > 0
    });
    const notTried = raw.filter((candidate) => !tried.has(candidate.messageId));
    const pool = notTried.length ? notTried : raw;
    return pool.sort((a, b) => {
      if (a.isAboveViewport !== b.isAboveViewport) return a.isAboveViewport ? -1 : 1;
      if (a.isPartiallyVisible !== b.isPartiallyVisible) return a.isPartiallyVisible ? -1 : 1;
      if (a.top !== b.top) return a.top - b.top;
      return a.index - b.index;
    });
  }

  function evaluateBackfillUsefulProgress(beforeMetrics, afterMetrics, scanMetrics, context) {
    const beforeIndex = beforeMetrics && typeof beforeMetrics.firstVisibleRegistryIndex === "number" ? beforeMetrics.firstVisibleRegistryIndex : -1;
    const afterIndex = afterMetrics && typeof afterMetrics.firstVisibleRegistryIndex === "number" ? afterMetrics.firstVisibleRegistryIndex : -1;
    const bestIndex = typeof state.backfill.bestFirstVisibleRegistryIndex === "number" ? state.backfill.bestFirstVisibleRegistryIndex : -1;
    const beforeRegistryCount = context && typeof context.registryCountBefore === "number" ? context.registryCountBefore :
      beforeMetrics ? Number(beforeMetrics.registryCount || 0) : 0;
    const afterRegistryCount = afterMetrics ? Number(afterMetrics.registryCount || 0) : Number(scanMetrics && scanMetrics.registryCount || 0);
    const reasons = [];
    if (afterRegistryCount > beforeRegistryCount) reasons.push("registry-count-increased");
    if (beforeMetrics && afterMetrics && beforeMetrics.firstRegistryMessageId && afterMetrics.firstRegistryMessageId &&
      beforeMetrics.firstRegistryMessageId !== afterMetrics.firstRegistryMessageId) {
      reasons.push("first-registry-message-changed");
    }
    if (afterIndex >= 0 && bestIndex >= 0 && afterIndex < bestIndex) reasons.push("first-visible-index-below-best");
    if (afterIndex >= 0 && beforeIndex >= 0 && afterIndex < beforeIndex && (bestIndex < 0 || afterIndex <= bestIndex)) {
      reasons.push("first-visible-index-decreased-safe");
    }
    const reverseMovement = (beforeIndex >= 0 && afterIndex >= 0 && afterIndex > beforeIndex) ||
      (bestIndex >= 0 && afterIndex >= 0 && afterIndex > bestIndex);
    const messageHashChanged = !!(beforeMetrics && afterMetrics && beforeMetrics.messageHash !== afterMetrics.messageHash);
    if (messageHashChanged && reasons.length) reasons.push("message-hash-with-best-progress");
    return {
      useful: reasons.length > 0 && !reverseMovement,
      reasons,
      reverseMovement,
      beforeIndex,
      afterIndex,
      bestIndex
    };
  }

  async function tryBackfillSingleAnchorCandidate(candidate, context, mode) {
    const firstVisibleIdBefore = context && context.firstVisibleIdBefore;
    const firstVisibleRegistryIndexBefore = context && typeof context.firstVisibleRegistryIndexBefore === "number" ?
      context.firstVisibleRegistryIndexBefore : -1;
    const registryCountBefore = context && typeof context.registryCountBefore === "number" ? context.registryCountBefore :
      state.messageRegistry ? state.messageRegistry.size : 0;
    const hasVisibleCountBefore = context && typeof context.visibleDomUserMessageCountBefore === "number";
    const hasMessageHashBefore = context && typeof context.messageHashBefore === "string";
    const blacklist = new Set((state.backfill && state.backfill.anchorBlacklistedIds) || []);
    if (candidate && blacklist.has(candidate.messageId)) {
      setBackfillStatus(state.backfill.status || "running", {
        blacklistedCandidateTriedCount: Number(state.backfill.blacklistedCandidateTriedCount || 0) + 1,
        lastRejectedAnchorReason: "blacklisted-anchor-skipped"
      });
      return { worked: false, failureReason: "blacklisted-anchor-skipped" };
    }
    const candidateBefore = getBackfillMessageAnchorMetrics(candidate);
    const beforeViewport = getBackfillViewportMetrics(candidate && candidate.messageId);
    const attempted = await scrollBackfillAnchorIntoView(candidate);
    if (!isBackfillStillCurrent(context.runId, context.conversationId)) {
      return {
        cancelled: true,
        cancelReason: state.backfill && state.backfill.cancelRequested ? (state.backfill.lastError || "cancelled") :
          getConversationId() !== context.conversationId ? "conversation-changed" : "run-replaced"
      };
    }
    if (!attempted) return { worked: false, failureReason: "anchor-scroll-not-supported", candidateBefore };

    const candidateAfter = getBackfillMessageAnchorMetrics(candidate);
    const firstVisibleAfterAnchor = getFirstVisibleBackfillMessageAnchor();
    const firstVisibleAfter = getBackfillMessageAnchorMetrics(firstVisibleAfterAnchor);
    const scanMetrics = scanMergeSaveBackfillBatch(mode === "relaxed" ? "manual-backfill-relaxed-anchor" : "manual-backfill-anchor");
    const afterViewport = getBackfillViewportMetrics(candidate && candidate.messageId);
    const firstVisibleRegistryIndexAfter = getRegistryOrderIndex(firstVisibleAfter && firstVisibleAfter.messageId);
    const usefulProgress = evaluateBackfillUsefulProgress(beforeViewport, afterViewport, scanMetrics, context);
    const visualAnchorMovedOnly = didBackfillAnchorMove(candidateBefore, candidateAfter) ||
      !!(firstVisibleAfter && firstVisibleAfter.messageId && firstVisibleAfter.messageId !== firstVisibleIdBefore) ||
      (hasVisibleCountBefore && Number(scanMetrics.visibleCount || 0) !== Number(context.visibleDomUserMessageCountBefore || 0)) ||
      (hasMessageHashBefore && (afterViewport.messageHash || "") !== context.messageHashBefore);
    const anchorWorked = usefulProgress.useful;
    const reverseMovement = usefulProgress.reverseMovement;

    return {
      worked: anchorWorked,
      failureReason: anchorWorked ? null : reverseMovement ? "unsafe-reverse-anchor-prevented" : "anchor-scroll-no-useful-progress",
      reverseMovement,
      usefulProgressReason: usefulProgress.reasons.join(",") || null,
      visualAnchorMovedOnly: visualAnchorMovedOnly && !anchorWorked,
      visualMoveRejectedAsProgress: visualAnchorMovedOnly && !anchorWorked,
      scanMetrics,
      candidateBefore,
      candidateAfter,
      firstVisibleAfter,
      firstVisibleRegistryIndexAfter,
      anchorRegistryIndexBefore: getRegistryOrderIndex(candidateBefore && candidateBefore.messageId),
      anchorRegistryIndexAfter: getRegistryOrderIndex(candidateAfter && candidateAfter.messageId)
    };
  }

  async function tryBackfillAnchorCandidates(candidates, context) {
    const ranked = rankBackfillAnchorCandidates(candidates, context).slice(0, 8);
    const rawIds = getBackfillAnchorCandidateIds(candidates);
    const rankedIds = getBackfillAnchorCandidateIds(ranked);
    const rejectedReasons = getBackfillAnchorRejectedReasons(candidates, ranked, context);
    if ((candidates || []).length && !ranked.length) {
      setBackfillStatus("running", {
        lastRejectedAnchorReason: "all-candidates-blacklisted-or-not-earlier"
      });
    }
    const result = {
      worked: false,
      cancelled: false,
      cancelReason: null,
      failureReason: ranked.length ? "all-anchor-scroll-no-movement" : "no-anchor-message",
      candidateCount: (candidates || []).length,
      candidateIds: rawIds,
      rawCandidateCount: (candidates || []).length,
      rankedCandidateCount: ranked.length,
      rawCandidateIds: rawIds,
      rankedCandidateIds: rankedIds,
      rejectedCandidateCount: rejectedReasons.length,
      rejectedReasons,
      triedIds: [],
      triedCount: 0,
      workedId: null,
      scanCount: 0,
      scannedVisibleCount: 0,
      registryCount: state.messageRegistry ? state.messageRegistry.size : 0,
      anchorBefore: null,
      anchorAfter: null,
      firstVisibleAfter: null,
      firstVisibleRegistryIndexAfter: null,
      anchorRegistryIndexBefore: null,
      anchorRegistryIndexAfter: null,
      safetyStop: false
    };
    const firstVisibleIdBefore = context && context.firstVisibleIdBefore;
    const firstVisibleRegistryIndexBefore = context && typeof context.firstVisibleRegistryIndexBefore === "number" ?
      context.firstVisibleRegistryIndexBefore : -1;
    const registryCountBefore = context && typeof context.registryCountBefore === "number" ? context.registryCountBefore : result.registryCount;

    if (!ranked.length) return result;

    for (const candidate of ranked) {
      if (!isBackfillStillCurrent(context.runId, context.conversationId)) {
        result.cancelled = true;
        result.cancelReason = state.backfill && state.backfill.cancelRequested ? (state.backfill.lastError || "cancelled") :
          getConversationId() !== context.conversationId ? "conversation-changed" : "run-replaced";
        return result;
      }

      const candidateBefore = getBackfillMessageAnchorMetrics(candidate);
      result.triedIds.push(candidate.messageId);
      result.triedCount = result.triedIds.length;
      result.anchorBefore = candidateBefore;
      result.anchorRegistryIndexBefore = getRegistryOrderIndex(candidateBefore && candidateBefore.messageId);
      appendBackfillTraceEvent("ranked-anchor-try", "try", {
        anchorId: candidate.messageId,
        beforeIndex: firstVisibleRegistryIndexBefore
      });

      setBackfillStatus("running", {
        anchorCandidateCount: result.candidateCount,
        anchorCandidateTriedCount: result.triedCount,
        anchorCandidateIds: result.candidateIds,
        anchorRawCandidateCount: result.rawCandidateCount,
        anchorRankedCandidateCount: result.rankedCandidateCount,
        anchorRawCandidateIds: result.rawCandidateIds,
        anchorRankedCandidateIds: result.rankedCandidateIds,
        anchorRejectedCandidateCount: result.rejectedCandidateCount,
        anchorRejectedReasons: result.rejectedReasons,
        anchorTriedIds: result.triedIds.slice(),
        anchorMessageIdBefore: candidateBefore ? candidateBefore.messageId : null,
        anchorTopBefore: candidateBefore ? candidateBefore.top : null,
        anchorBottomBefore: candidateBefore ? candidateBefore.bottom : null,
        anchorScrollAttempted: true,
        anchorScrollWorked: false,
        anchorFailureReason: null,
        anchorStrategy: "registry-nearest-multi",
        anchorRegistryIndexBefore: result.anchorRegistryIndexBefore,
        firstVisibleRegistryIndexBefore
      });

      const attempt = await tryBackfillSingleAnchorCandidate(candidate, context, "ranked");
      if (attempt.cancelled) {
        result.cancelled = true;
        result.cancelReason = attempt.cancelReason;
        return result;
      }
      if (!attempt.scanMetrics) {
        result.failureReason = attempt.failureReason || "anchor-scroll-not-supported";
        continue;
      }
      const candidateAfter = attempt.candidateAfter;
      const firstVisibleAfter = attempt.firstVisibleAfter;
      const scanMetrics = attempt.scanMetrics;
      const firstVisibleRegistryIndexAfter = attempt.firstVisibleRegistryIndexAfter;
      const anchorWorked = !!attempt.worked;
      const reverseMovement = !!attempt.reverseMovement;
      const anchorBlacklistedIds = Array.isArray(state.backfill.anchorBlacklistedIds) ? state.backfill.anchorBlacklistedIds.slice() : [];
      if (!anchorWorked && candidate.messageId && !anchorBlacklistedIds.includes(candidate.messageId)) anchorBlacklistedIds.push(candidate.messageId);
      const anchorReverseMovementCount = Number(state.backfill.anchorReverseMovementCount || 0) + (reverseMovement ? 1 : 0);
      const anchorAttemptHistory = Array.isArray(state.backfill.anchorAttemptHistory) ? state.backfill.anchorAttemptHistory.slice(-12) : [];
      anchorAttemptHistory.push(candidate.messageId + ":" + (anchorWorked ? "worked" : reverseMovement ? "reverse" : "no-progress"));

      result.scanCount += 1;
      result.scannedVisibleCount += Number(scanMetrics.visibleCount || 0);
      result.registryCount = scanMetrics.registryCount;
      result.anchorAfter = candidateAfter;
      result.firstVisibleAfter = firstVisibleAfter;
      result.firstVisibleRegistryIndexAfter = firstVisibleRegistryIndexAfter;
      result.anchorRegistryIndexAfter = attempt.anchorRegistryIndexAfter;
      result.failureReason = anchorWorked ? null : attempt.failureReason || "anchor-scroll-no-useful-progress";

      setBackfillStatus("running", {
        anchorCandidateCount: result.candidateCount,
        anchorCandidateTriedCount: result.triedCount,
        anchorCandidateIds: result.candidateIds,
        anchorTriedIds: result.triedIds.slice(),
        anchorWorkedId: anchorWorked ? candidate.messageId : null,
        anchorFailureReason: anchorWorked ? null : result.failureReason,
        anchorStrategy: "registry-nearest-multi",
        anchorMessageIdAfter: candidateAfter ? candidateAfter.messageId : null,
        anchorTopAfter: candidateAfter ? candidateAfter.top : null,
        anchorBottomAfter: candidateAfter ? candidateAfter.bottom : null,
        anchorDelta: candidateBefore && candidateAfter ? candidateAfter.top - candidateBefore.top : null,
        firstVisibleDomMessageIdAfter: firstVisibleAfter ? firstVisibleAfter.messageId : null,
        anchorScrollAttempted: true,
        anchorScrollWorked: anchorWorked,
        visualAnchorMovedOnly: !!attempt.visualAnchorMovedOnly,
        visualMoveRejectedAsProgress: !!attempt.visualMoveRejectedAsProgress,
        anchorRejectedBecauseReverseAfterScroll: reverseMovement,
        anchorWorkedRequiresBestProgress: true,
        anchorRegistryIndexBefore: result.anchorRegistryIndexBefore,
        anchorRegistryIndexAfter: result.anchorRegistryIndexAfter,
        firstVisibleRegistryIndexBefore,
        firstVisibleRegistryIndexAfter,
        anchorBlacklistedIds,
        anchorReverseMovementCount,
        anchorAttemptHistory,
        lastRejectedAnchorReason: reverseMovement ? "reverse-registry-index" : anchorWorked ? null : "no-progress-anchor",
        reverseMovementDetected: reverseMovement,
        reverseMovementFromIndex: reverseMovement ? firstVisibleRegistryIndexBefore : state.backfill.reverseMovementFromIndex,
        reverseMovementToIndex: reverseMovement ? firstVisibleRegistryIndexAfter : state.backfill.reverseMovementToIndex,
        reverseMovementAnchorId: reverseMovement ? candidate.messageId : state.backfill.reverseMovementAnchorId,
        reverseMovementStoppedImmediately: reverseMovement
      });

      if (reverseMovement) {
        appendBackfillTraceEvent("reverse-movement-detected", "safety-stop", {
          anchorId: candidate.messageId,
          beforeIndex: firstVisibleRegistryIndexBefore,
          afterIndex: firstVisibleRegistryIndexAfter,
          result: "failed",
          reason: "unsafe-reverse-anchor-prevented"
        });
        result.safetyStop = true;
        result.failureReason = "unsafe-reverse-anchor-prevented";
        return result;
      }
      if (attempt.visualMoveRejectedAsProgress) {
        appendBackfillTraceEvent("visual-move-rejected", "reject", {
          anchorId: candidate.messageId,
          beforeIndex: firstVisibleRegistryIndexBefore,
          afterIndex: firstVisibleRegistryIndexAfter,
          result: "ignored",
          reason: "visual-move-no-best-progress"
        });
      }
      if (anchorWorked) {
        result.worked = true;
        result.workedId = candidate.messageId;
        appendBackfillTraceEvent("best-progress", "ranked-anchor", {
          anchorId: candidate.messageId,
          beforeIndex: firstVisibleRegistryIndexBefore,
          afterIndex: firstVisibleRegistryIndexAfter,
          result: "worked",
          reason: attempt.usefulProgressReason || "useful-progress"
        });
        return result;
      }
    }

    result.failureReason = "all-anchor-scroll-no-movement";
    return result;
  }

  async function tryBackfillRelaxedAnchorCandidates(candidates, context) {
    const relaxed = rankBackfillRelaxedAnchorCandidates(candidates, {
      ...context,
      triedIds: (context && context.triedIds) || []
    }).slice(0, 5);
    const result = {
      worked: false,
      cancelled: false,
      cancelReason: null,
      failureReason: relaxed.length ? "all-relaxed-anchor-scroll-no-movement" : "no-relaxed-anchor-message",
      relaxedCandidateCount: relaxed.length,
      relaxedCandidateIds: getBackfillAnchorCandidateIds(relaxed),
      triedIds: [],
      triedCount: 0,
      workedId: null,
      scanCount: 0,
      scannedVisibleCount: 0,
      registryCount: state.messageRegistry ? state.messageRegistry.size : 0,
      anchorBefore: null,
      anchorAfter: null,
      firstVisibleAfter: null,
      firstVisibleRegistryIndexAfter: null,
      anchorRegistryIndexBefore: null,
      anchorRegistryIndexAfter: null,
      safetyStop: false
    };

    if (!relaxed.length) return result;

    for (const candidate of relaxed) {
      if (!isBackfillStillCurrent(context.runId, context.conversationId)) {
        result.cancelled = true;
        result.cancelReason = state.backfill && state.backfill.cancelRequested ? (state.backfill.lastError || "cancelled") :
          getConversationId() !== context.conversationId ? "conversation-changed" : "run-replaced";
        return result;
      }

      result.triedIds.push(candidate.messageId);
      result.triedCount = result.triedIds.length;
      appendBackfillTraceEvent("relaxed-anchor-try", "try", {
        anchorId: candidate.messageId,
        beforeIndex: context.firstVisibleRegistryIndexBefore
      });
      const attempt = await tryBackfillSingleAnchorCandidate(candidate, context, "relaxed");
      if (attempt.cancelled) {
        result.cancelled = true;
        result.cancelReason = attempt.cancelReason;
        return result;
      }
      if (!attempt.scanMetrics) {
        result.failureReason = attempt.failureReason || "anchor-scroll-not-supported";
        continue;
      }

      const anchorWorked = !!attempt.worked;
      const reverseMovement = !!attempt.reverseMovement;
      const anchorBlacklistedIds = Array.isArray(state.backfill.anchorBlacklistedIds) ? state.backfill.anchorBlacklistedIds.slice() : [];
      if (!anchorWorked && candidate.messageId && !anchorBlacklistedIds.includes(candidate.messageId)) anchorBlacklistedIds.push(candidate.messageId);
      const anchorReverseMovementCount = Number(state.backfill.anchorReverseMovementCount || 0) + (reverseMovement ? 1 : 0);
      const relaxedAnchorAttemptHistory = Array.isArray(state.backfill.relaxedAnchorAttemptHistory) ? state.backfill.relaxedAnchorAttemptHistory.slice(-12) : [];
      relaxedAnchorAttemptHistory.push(candidate.messageId + ":" + (anchorWorked ? "worked" : reverseMovement ? "reverse" : "no-progress"));

      result.scanCount += 1;
      result.scannedVisibleCount += Number(attempt.scanMetrics.visibleCount || 0);
      result.registryCount = attempt.scanMetrics.registryCount;
      result.anchorBefore = attempt.candidateBefore;
      result.anchorAfter = attempt.candidateAfter;
      result.firstVisibleAfter = attempt.firstVisibleAfter;
      result.firstVisibleRegistryIndexAfter = attempt.firstVisibleRegistryIndexAfter;
      result.anchorRegistryIndexBefore = attempt.anchorRegistryIndexBefore;
      result.anchorRegistryIndexAfter = attempt.anchorRegistryIndexAfter;
      result.failureReason = anchorWorked ? null : attempt.failureReason || "anchor-scroll-no-useful-progress";

      setBackfillStatus("running", {
        anchorRelaxedCandidateCount: result.relaxedCandidateCount,
        anchorRelaxedCandidateIds: result.relaxedCandidateIds,
        relaxedAnchorTriedCount: result.triedCount,
        relaxedAnchorTriedIds: result.triedIds.slice(),
        relaxedAnchorWorkedId: anchorWorked ? candidate.messageId : null,
        anchorStrategy: "relaxed-dom-order",
        anchorMessageIdBefore: attempt.candidateBefore ? attempt.candidateBefore.messageId : null,
        anchorMessageIdAfter: attempt.candidateAfter ? attempt.candidateAfter.messageId : null,
        anchorTopBefore: attempt.candidateBefore ? attempt.candidateBefore.top : null,
        anchorTopAfter: attempt.candidateAfter ? attempt.candidateAfter.top : null,
        anchorBottomBefore: attempt.candidateBefore ? attempt.candidateBefore.bottom : null,
        anchorBottomAfter: attempt.candidateAfter ? attempt.candidateAfter.bottom : null,
        anchorDelta: attempt.candidateBefore && attempt.candidateAfter ? attempt.candidateAfter.top - attempt.candidateBefore.top : null,
        firstVisibleDomMessageIdAfter: attempt.firstVisibleAfter ? attempt.firstVisibleAfter.messageId : null,
        anchorScrollAttempted: true,
        anchorScrollWorked: anchorWorked,
        visualAnchorMovedOnly: !!attempt.visualAnchorMovedOnly,
        visualMoveRejectedAsProgress: !!attempt.visualMoveRejectedAsProgress,
        anchorRejectedBecauseReverseAfterScroll: reverseMovement,
        anchorWorkedRequiresBestProgress: true,
        anchorBlacklistedIds,
        anchorReverseMovementCount,
        relaxedAnchorAttemptHistory,
        lastRejectedAnchorReason: reverseMovement ? "reverse-registry-index" : anchorWorked ? null : "relaxed-no-progress-anchor",
        reverseMovementDetected: reverseMovement,
        reverseMovementFromIndex: reverseMovement ? context.firstVisibleRegistryIndexBefore : state.backfill.reverseMovementFromIndex,
        reverseMovementToIndex: reverseMovement ? attempt.firstVisibleRegistryIndexAfter : state.backfill.reverseMovementToIndex,
        reverseMovementAnchorId: reverseMovement ? candidate.messageId : state.backfill.reverseMovementAnchorId,
        reverseMovementStoppedImmediately: reverseMovement
      });

      if (reverseMovement) {
        appendBackfillTraceEvent("reverse-movement-detected", "safety-stop", {
          anchorId: candidate.messageId,
          beforeIndex: context.firstVisibleRegistryIndexBefore,
          afterIndex: attempt.firstVisibleRegistryIndexAfter,
          result: "failed",
          reason: "unsafe-reverse-anchor-prevented"
        });
        result.safetyStop = true;
        result.failureReason = "unsafe-reverse-anchor-prevented";
        return result;
      }
      if (attempt.visualMoveRejectedAsProgress) {
        appendBackfillTraceEvent("visual-move-rejected", "reject", {
          anchorId: candidate.messageId,
          beforeIndex: context.firstVisibleRegistryIndexBefore,
          afterIndex: attempt.firstVisibleRegistryIndexAfter,
          result: "ignored",
          reason: "visual-move-no-best-progress"
        });
      }
      if (anchorWorked) {
        result.worked = true;
        result.workedId = candidate.messageId;
        appendBackfillTraceEvent("best-progress", "relaxed-anchor", {
          anchorId: candidate.messageId,
          beforeIndex: context.firstVisibleRegistryIndexBefore,
          afterIndex: attempt.firstVisibleRegistryIndexAfter,
          result: "worked",
          reason: attempt.usefulProgressReason || "useful-progress"
        });
        return result;
      }
    }

    result.failureReason = "all-relaxed-anchor-scroll-no-movement";
    return result;
  }

  async function tryBackfillWheelPageFallback(context) {
    const result = {
      worked: false,
      cancelled: false,
      cancelReason: null,
      scanCount: 0,
      scannedVisibleCount: 0,
      registryCount: state.messageRegistry ? state.messageRegistry.size : 0,
      attemptCount: 0,
      lastDeltaY: -900,
      targetDescriptor: null,
      pageUpAttempted: false,
      pageUpWorked: false,
      progressReason: null,
      signatureBefore: null,
      signatureAfter: null
    };
    if (!BACKFILL_ENABLE_WHEEL_FALLBACK) {
      result.progressReason = "disabled-for-stability";
      setBackfillStatus(state.backfill.status || "running", {
        wheelFallbackEnabled: false,
        wheelFallbackAttempted: false,
        wheelFallbackSkippedReason: "disabled-for-stability"
      });
      return result;
    }
    const target = context.scrollTarget || findBackfillScrollTarget() || createBackfillScrollTarget(document.scrollingElement || document.documentElement || document.body, "document-fallback");
    const targetNode = target && target.isDocument ? window : target && target.node ? target.node : window;
    result.targetDescriptor = target ? describeBackfillScrollTarget(target) || "window" : "window";
    const beforeMetrics = getBackfillViewportMetrics("wheel");
    result.signatureBefore = beforeMetrics.viewportSignature;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (!isBackfillStillCurrent(context.runId, context.conversationId)) {
        result.cancelled = true;
        result.cancelReason = state.backfill && state.backfill.cancelRequested ? (state.backfill.lastError || "cancelled") :
          getConversationId() !== context.conversationId ? "conversation-changed" : "run-replaced";
        return result;
      }

      const deltaY = -900 - attempt * 250;
      result.lastDeltaY = deltaY;
      result.attemptCount += 1;
      markProgrammaticScroll();
      try {
        const wheelEvent = new WheelEvent("wheel", { deltaY, deltaMode: 0, bubbles: true, cancelable: true });
        if (targetNode && targetNode.dispatchEvent) targetNode.dispatchEvent(wheelEvent);
        window.dispatchEvent(new WheelEvent("wheel", { deltaY, deltaMode: 0, bubbles: true, cancelable: true }));
      } catch (error) {
        debugLog("warn", "backfill wheel fallback dispatch failed", { message: error && error.message ? error.message : String(error) });
      }

      await waitForBackfillFrame(900);
      const scanMetrics = scanMergeSaveBackfillBatch("manual-backfill-wheel");
      result.scanCount += 1;
      result.scannedVisibleCount += Number(scanMetrics.visibleCount || 0);
      result.registryCount = scanMetrics.registryCount;
      const afterMetrics = getBackfillViewportMetrics("wheel");
      result.signatureAfter = afterMetrics.viewportSignature;
      const progressed = Number(afterMetrics.registryCount || 0) > Number(beforeMetrics.registryCount || 0) ||
        afterMetrics.firstVisibleDomMessageId !== beforeMetrics.firstVisibleDomMessageId ||
        afterMetrics.firstVisibleRegistryIndex < beforeMetrics.firstVisibleRegistryIndex ||
        afterMetrics.visibleDomUserMessageCount !== beforeMetrics.visibleDomUserMessageCount ||
        afterMetrics.messageHash !== beforeMetrics.messageHash;
      if (progressed) {
        result.worked = true;
        result.progressReason = "wheel-progress";
        return result;
      }
    }

    result.pageUpAttempted = true;
    try {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "PageUp", code: "PageUp", bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageUp", code: "PageUp", bubbles: true, cancelable: true }));
    } catch (error) {
      debugLog("warn", "backfill pageUp fallback dispatch failed", { message: error && error.message ? error.message : String(error) });
    }
    await waitForBackfillFrame(900);
    const pageScanMetrics = scanMergeSaveBackfillBatch("manual-backfill-pageup");
    result.scanCount += 1;
    result.scannedVisibleCount += Number(pageScanMetrics.visibleCount || 0);
    result.registryCount = pageScanMetrics.registryCount;
    const pageAfterMetrics = getBackfillViewportMetrics("pageup");
    result.signatureAfter = pageAfterMetrics.viewportSignature;
    result.pageUpWorked = Number(pageAfterMetrics.registryCount || 0) > Number(beforeMetrics.registryCount || 0) ||
      pageAfterMetrics.firstVisibleDomMessageId !== beforeMetrics.firstVisibleDomMessageId ||
      pageAfterMetrics.firstVisibleRegistryIndex < beforeMetrics.firstVisibleRegistryIndex ||
      pageAfterMetrics.visibleDomUserMessageCount !== beforeMetrics.visibleDomUserMessageCount ||
      pageAfterMetrics.messageHash !== beforeMetrics.messageHash;
    result.worked = result.pageUpWorked;
    result.progressReason = result.pageUpWorked ? "pageup-progress" : "all-anchor-and-wheel-no-movement";
    return result;
  }

  function isBackfillAtKnownFirstMessage() {
    const firstVisible = document.querySelector(USER_SELECTOR);
    const firstVisibleId = firstVisible && firstVisible.getAttribute("data-message-id");
    return !!(firstVisibleId && state.messageOrder && state.messageOrder[0] && firstVisibleId === state.messageOrder[0]);
  }

  function isBackfillStillCurrent(runId, conversationId) {
    return !!(
      state.backfill &&
      state.backfill.runId === runId &&
      state.backfill.cancelRequested !== true &&
      getConversationId() === conversationId
    );
  }

  function getBackfillStopReason(previousScrollTop, currentScrollTop, attemptsWithoutMovement, hasScrolled) {
    if (currentScrollTop <= 0) return hasScrolled || isBackfillAtKnownFirstMessage() ? "reached-dom-top" : "scroll-target-at-zero";
    if (attemptsWithoutMovement >= 3) return "no-scroll-movement";
    if (state.backfill && Number(state.backfill.batchCount || 0) >= 250) return "max-batch-guard";
    return null;
  }

  function scanMergeSaveBackfillBatch(reason) {
    const shouldRender = scanMessages(reason || "manual-backfill", true);
    return {
      shouldRender,
      visibleCount: document.querySelectorAll(USER_SELECTOR).length,
      registryCount: state.messageRegistry ? state.messageRegistry.size : 0
    };
  }

  function startKnownGapTopHydrationProbe() {
    const backfillStatus = state.backfill && state.backfill.status;
    if (backfillStatus === "running" || backfillStatus === "cancelling") {
      setKnownGapProbePatch({
        knownGapProbeStatus: "failed",
        knownGapProbeAttempted: true,
        knownGapProbeReason: "current-backfill-running"
      });
      return state.backfill;
    }
    if (state.backfill && state.backfill.knownGapProbeStatus === "running") {
      setKnownGapProbePatch({
        knownGapProbeReason: "known-gap-probe-already-running"
      });
      return state.backfill;
    }

    const startSnapshot = getKnownGapProbeConversationSnapshot();
    const conversationId = startSnapshot.conversationKey || getConversationId() || state.currentConversationId;
    const runId = "known-gap-native-probe-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    const before = getBackfillHydrationAuditSnapshot("known-gap-probe-before");
    const attemptHistory = [];
    setKnownGapProbePatch({
      knownGapProbeStatus: "running",
      knownGapProbeRunId: runId,
      knownGapProbeIsRunning: true,
      knownGapProbeCanCopyFinalDebug: false,
      knownGapProbeAttempted: true,
      knownGapProbeCount: 0,
      knownGapProbeMax: KNOWN_GAP_NATIVE_PROBE_MAX,
      knownGapProbeReason: null,
      knownGapProbeStrategy: KNOWN_GAP_PROBE_STRATEGY,
      knownGapProbeHydrationDetected: false,
      knownGapProbeVisualOnly: false,
      knownGapProbeSafetyStopped: false,
      knownGapProbeStoppedBecauseMaxBudget: false,
      knownGapProbeBefore: before,
      knownGapProbeAfter: null,
      knownGapProbeDelayed: null,
      knownGapProbeInitialScrollTop: null,
      knownGapProbeFinalScrollTop: null,
      knownGapProbeInitialScrollHeight: null,
      knownGapProbeFinalScrollHeight: null,
      knownGapProbeTotalScrollHeightDelta: 0,
      knownGapProbeScrollTopAfterImmediate: null,
      knownGapProbeScrollTopAfterWait: null,
      knownGapProbeScrollHeightBefore: null,
      knownGapProbeScrollHeightAfterImmediate: null,
      knownGapProbeScrollHeightAfterWait: null,
      knownGapProbeScrollHeightDelta: 0,
      knownGapProbeClientHeight: null,
      knownGapProbeReachedTopThreshold: false,
      knownGapProbeTrueTopEpsilon: KNOWN_GAP_PROBE_TRUE_TOP_EPSILON,
      knownGapProbeReachedTrueTop: false,
      knownGapProbeStableAtTop: false,
      knownGapProbeStableAtTopWaitMs: KNOWN_GAP_PROBE_STABLE_TOP_WAIT_MS,
      knownGapProbeStableTopConfirmationCount: 0,
      knownGapProbeStableTopConfirmationsRequired: KNOWN_GAP_PROBE_STABLE_TOP_CONFIRMATIONS_REQUIRED,
      knownGapProbeStableTopConfirmationLabel: "0/" + KNOWN_GAP_PROBE_STABLE_TOP_CONFIRMATIONS_REQUIRED,
      knownGapProbeEstimatedPhase: "driving-upward",
      knownGapProbeStableTopResetCount: 0,
      knownGapProbeStableTopResetReason: null,
      knownGapProbeDomHydrationDriveEnabled: true,
      knownGapProbeStoppedAfterStableTopConfirmations: false,
      knownGapProbeTopNudgeCount: 0,
      knownGapProbeProgressDetected: false,
      knownGapProbeProgressReason: null,
      knownGapProbeBestKnownGap: null,
      knownGapProbeBestFirstVisibleIndex: null,
      knownGapProbeProgressEventCount: 0,
      knownGapProbeProgressHistory: [],
      knownGapProbeReverseIndexObserved: false,
      knownGapProbeReverseIndexIgnoredInBackfillMode: false,
      knownGapProbeReverseIndexIgnoredReason: null,
      knownGapProbePostHydrationSettleNeeded: false,
      knownGapProbeLastHydrationAt: null,
      knownGapProbeLastAnchorCompensationAt: null,
      knownGapProbeMutationCountBeforeStableWait: null,
      knownGapProbeMutationCountAfterStableWait: null,
      knownGapProbeMessageHashBeforeStableWait: null,
      knownGapProbeMessageHashAfterStableWait: null,
      knownGapProbeScrollHeightIncreased: false,
      knownGapProbeAnchorCompensatedScrollTop: false,
      knownGapProbeTopHydrationCycleDetected: false,
      knownGapProbeHydrationCycleCount: 0,
      knownGapProbeAnchorCompensationCount: 0,
      knownGapProbeMaxTotalMs: KNOWN_GAP_PROBE_MAX_TOTAL_MS,
      knownGapProbeTotalDurationMs: 0,
      knownGapProbeMaxTotalSteps: KNOWN_GAP_PROBE_MAX_TOTAL_STEPS,
      knownGapProbeTotalStepCount: 0,
      knownGapProbeMaxHydrationCycles: KNOWN_GAP_PROBE_MAX_HYDRATION_CYCLES,
      knownGapProbeBudgetStopPhase: null,
      knownGapProbeStartUrl: startSnapshot.url,
      knownGapProbeEndUrl: null,
      knownGapProbeStartConversationId: startSnapshot.conversationId,
      knownGapProbeEndConversationId: null,
      knownGapProbeStartConversationKey: startSnapshot.conversationKey,
      knownGapProbeEndConversationKey: null,
      knownGapProbeStartUserMessageCount: startSnapshot.userMessageCount,
      knownGapProbeCancelledByConversationChange: false,
      knownGapProbeCancelReason: null,
      knownGapProbeJumpToTopAttempted: false,
      knownGapProbeJumpToTopWorked: false,
      knownGapProbeStepCount: 0,
      knownGapProbeStepHistory: [],
      knownGapProbeCycleHistory: [],
      knownGapProbeWaitMsAfterTop: null,
      knownGapProbeTargetCandidates: [],
      knownGapProbeAttemptHistory: attemptHistory,
      knownGapProbeEarlierDomAnchorAttempted: false,
      knownGapProbeEarlierDomAnchorWorked: false,
      knownGapProbeEarlierDomAnchorCandidateIds: [],
      knownGapProbeEarlierDomAnchorRejectedIds: []
    });
    appendBackfillTraceEvent("known-gap-continuous-probe-start", "start", {
      beforeIndex: before.firstVisibleDomRegistryIndex,
      knownGapBefore: before.knownTopGapFromFirstVisible,
      registryCountBefore: before.registryCount,
      result: "running",
      reason: KNOWN_GAP_PROBE_STRATEGY
    });
    setupKnownGapProbeUserInterruptGuard(runId);
    runKnownGapTopHydrationProbeLoop(runId, conversationId, before, attemptHistory).catch((error) => {
      if (state.backfill && state.backfill.knownGapProbeRunId === runId) {
        setKnownGapProbePatch({
          knownGapProbeStatus: "failed",
          knownGapProbeReason: error && error.message ? error.message : "known-gap-native-probe-error"
        });
        cleanupKnownGapProbeUserInterruptGuard();
      }
    });
    return state.backfill;
  }

  async function runKnownGapTopHydrationProbeLoop(runId, conversationId, initialAudit, attemptHistory) {
    const startedAtMs = Date.now();
    const beforeAudit = initialAudit || getBackfillHydrationAuditSnapshot("known-gap-probe-before");
    const candidates = collectKnownGapProbeScrollTargets();
    const targetInfos = candidates.map((candidate) => candidate.info);
    const selectedCandidate = candidates.find((candidate) => {
      if (!candidate || !candidate.target || !candidate.info || candidate.info.rejected) return false;
      const info = candidate.info;
      if ((info.isDocument || info.isWindow) && !info.canScrollUp && !info.canScrollDown) return false;
      return info.scrollHeight > info.clientHeight + 1000 || info.canScrollUp || info.canScrollDown;
    });

    appendBackfillTraceEvent("known-gap-continuous-probe-target-selected", "select", {
      beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
      knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
      registryCountBefore: beforeAudit.registryCount,
      targetDescriptor: selectedCandidate && selectedCandidate.info ? selectedCandidate.info.descriptor : null,
      result: selectedCandidate ? "selected" : "failed",
      reason: selectedCandidate ? "scroll-root-selected" : "no-scroll-root-target"
    });

    if (!selectedCandidate) {
      setKnownGapProbePatch({
        knownGapProbeStatus: "failed",
        knownGapProbeReason: "scroll-root-target-not-found",
        knownGapProbeTargetCandidates: targetInfos,
        knownGapProbeStrategy: KNOWN_GAP_PROBE_STRATEGY,
        knownGapProbeBefore: beforeAudit,
        knownGapProbeHydrationDetected: false
      });
      cleanupKnownGapProbeUserInterruptGuard();
      return;
    }

    const target = selectedCandidate.target;
    const targetDescriptor = selectedCandidate.info.descriptor;
    const initialMetrics = getBackfillScrollMetrics(target);
    let lastAudit = beforeAudit;
    let afterAudit = beforeAudit;
    let lastAuditAt = 0;
    let totalSteps = 0;
    let hydrationCycles = 0;
    let anchorCompensations = 0;
    let reachedTopThreshold = Number(initialMetrics.scrollTop || 0) <= KNOWN_GAP_NATIVE_PROBE_TOP_THRESHOLD;
    let reachedTrueTop = false;
    let stableAtTop = false;
    let stableTopConfirmationCount = 0;
    let stableTopResetCount = 0;
    let stableTopResetReason = null;
    let stoppedBecauseMaxBudget = false;
    let budgetStopPhase = null;
    let stoppedAfterStableTopConfirmations = false;
    let nativeScrollWorked = false;
    let jumpToTopAttempted = false;
    let jumpToTopWorked = false;
    let topNudgeCount = 0;
    let topHydrationCycleDetected = false;
    let scrollHeightIncreased = false;
    let anchorCompensatedScrollTop = false;
    let progressDetected = false;
    let progressReason = null;
    let bestKnownGap = typeof beforeAudit.knownTopGapFromFirstVisible === "number" ? beforeAudit.knownTopGapFromFirstVisible : null;
    let bestFirstVisibleIndex = typeof beforeAudit.firstVisibleDomRegistryIndex === "number" ? beforeAudit.firstVisibleDomRegistryIndex : null;
    let progressEventCount = 0;
    let reverseIndexObserved = false;
    let reverseIndexIgnoredInBackfillMode = false;
    let reverseIndexIgnoredReason = null;
    let postHydrationSettleNeeded = false;
    let lastHydrationAt = null;
    let lastAnchorCompensationAt = null;
    let lastSoftStatusAt = startedAtMs;
    const stepHistory = [];
    const cycleHistory = [];
    const progressHistory = [];

    setKnownGapProbePatch({
      knownGapProbeStrategy: KNOWN_GAP_PROBE_STRATEGY,
      knownGapProbeScrollTargetDescriptor: targetDescriptor,
      knownGapProbeTargetCandidates: targetInfos,
      knownGapProbeInitialScrollTop: initialMetrics.scrollTop,
      knownGapProbeFinalScrollTop: initialMetrics.scrollTop,
      knownGapProbeInitialScrollHeight: initialMetrics.scrollHeight,
      knownGapProbeFinalScrollHeight: initialMetrics.scrollHeight,
      knownGapProbeTotalScrollHeightDelta: 0,
      knownGapProbeClientHeight: initialMetrics.clientHeight,
      knownGapProbeMaxTotalMs: KNOWN_GAP_PROBE_MAX_TOTAL_MS,
      knownGapProbeMaxTotalSteps: KNOWN_GAP_PROBE_MAX_TOTAL_STEPS,
      knownGapProbeMaxHydrationCycles: KNOWN_GAP_PROBE_MAX_HYDRATION_CYCLES,
      knownGapProbeStableAtTopWaitMs: KNOWN_GAP_PROBE_STABLE_TOP_WAIT_MS,
      knownGapProbeBefore: beforeAudit,
      knownGapProbeKnownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
      knownGapProbeFirstVisibleIndexBefore: beforeAudit.firstVisibleDomRegistryIndex,
      knownGapProbeFirstRegistryBefore: beforeAudit.firstRegistryMessageId,
      knownGapProbeRegistryCountBefore: beforeAudit.registryCount,
      knownGapProbeVisibleDomCountBefore: beforeAudit.visibleDomUserMessageCount,
      knownGapProbeBestKnownGap: bestKnownGap,
      knownGapProbeBestFirstVisibleIndex: bestFirstVisibleIndex
    });

    appendBackfillTraceEvent("known-gap-continuous-probe-start", "start", {
      beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
      knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
      registryCountBefore: beforeAudit.registryCount,
      targetDescriptor,
      result: "running",
      reason: KNOWN_GAP_PROBE_STRATEGY
    });
    appendBackfillTraceEvent("known-gap-continuous-probe-long-budget-start", "start", {
      beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
      knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
      registryCountBefore: beforeAudit.registryCount,
      targetDescriptor,
      result: "running",
      reason: "maxTotalMs-" + KNOWN_GAP_PROBE_MAX_TOTAL_MS,
      scrollAmount: KNOWN_GAP_PROBE_MAX_TOTAL_STEPS
    });

    const updateRuntimePatch = (patch = {}) => {
      const currentMetrics = getBackfillScrollMetrics(target);
      const currentConversationSnapshot = getKnownGapProbeConversationSnapshot();
      setKnownGapProbePatch({
        knownGapProbeCount: totalSteps,
        knownGapProbeTotalStepCount: totalSteps,
        knownGapProbeStepCount: totalSteps,
        knownGapProbeHydrationCycleCount: hydrationCycles,
        knownGapProbeAnchorCompensationCount: anchorCompensations,
        knownGapProbeReachedTopThreshold: reachedTopThreshold,
        knownGapProbeReachedTrueTop: reachedTrueTop,
        knownGapProbeStableAtTop: stableAtTop,
        knownGapProbeStableTopConfirmationCount: stableTopConfirmationCount,
        knownGapProbeStableTopConfirmationsRequired: KNOWN_GAP_PROBE_STABLE_TOP_CONFIRMATIONS_REQUIRED,
        knownGapProbeStableTopResetCount: stableTopResetCount,
        knownGapProbeStableTopResetReason: stableTopResetReason,
        knownGapProbeDomHydrationDriveEnabled: true,
        knownGapProbeStoppedAfterStableTopConfirmations: stoppedAfterStableTopConfirmations,
        knownGapProbeTopNudgeCount: topNudgeCount,
        knownGapProbeProgressDetected: progressDetected,
        knownGapProbeProgressReason: progressReason,
        knownGapProbeBestKnownGap: bestKnownGap,
        knownGapProbeBestFirstVisibleIndex: bestFirstVisibleIndex,
        knownGapProbeProgressEventCount: progressEventCount,
        knownGapProbeProgressHistory: progressHistory.slice(-80),
        knownGapProbeReverseIndexObserved: reverseIndexObserved,
        knownGapProbeReverseIndexIgnoredInBackfillMode: reverseIndexIgnoredInBackfillMode,
        knownGapProbeReverseIndexIgnoredReason: reverseIndexIgnoredReason,
        knownGapProbePostHydrationSettleNeeded: postHydrationSettleNeeded,
        knownGapProbeLastHydrationAt: lastHydrationAt,
        knownGapProbeLastAnchorCompensationAt: lastAnchorCompensationAt,
        knownGapProbeStoppedBecauseMaxBudget: stoppedBecauseMaxBudget,
        knownGapProbeBudgetStopPhase: budgetStopPhase,
        knownGapProbeEndUrl: currentConversationSnapshot.url,
        knownGapProbeEndConversationId: currentConversationSnapshot.conversationId,
        knownGapProbeEndConversationKey: currentConversationSnapshot.conversationKey,
        knownGapProbeNativeScrollAttempted: totalSteps > 0 || jumpToTopAttempted,
        knownGapProbeNativeScrollWorked: nativeScrollWorked,
        knownGapProbeJumpToTopAttempted: jumpToTopAttempted,
        knownGapProbeJumpToTopWorked: jumpToTopWorked,
        knownGapProbeTopHydrationCycleDetected: topHydrationCycleDetected,
        knownGapProbeScrollHeightIncreased: scrollHeightIncreased,
        knownGapProbeAnchorCompensatedScrollTop: anchorCompensatedScrollTop,
        knownGapProbeFinalScrollTop: currentMetrics.scrollTop,
        knownGapProbeFinalScrollHeight: currentMetrics.scrollHeight,
        knownGapProbeTotalScrollHeightDelta: Number(currentMetrics.scrollHeight || 0) - Number(initialMetrics.scrollHeight || 0),
        knownGapProbeTotalDurationMs: Date.now() - startedAtMs,
        knownGapProbeStepHistory: stepHistory.slice(-120),
        knownGapProbeCycleHistory: cycleHistory.slice(-40),
        knownGapProbeTargetCandidates: targetInfos,
        knownGapProbeAttemptHistory: attemptHistory,
        ...patch
      });
    };

    const recordProbeProgress = (audit, comparison, previousAudit, label) => {
      if (!audit || !comparison) return false;
      const reasons = [];
      const currentGap = typeof audit.knownTopGapFromFirstVisible === "number" ? audit.knownTopGapFromFirstVisible : null;
      const currentIndex = typeof audit.firstVisibleDomRegistryIndex === "number" ? audit.firstVisibleDomRegistryIndex : null;
      const previousRegistryCount = previousAudit && typeof previousAudit.registryCount === "number" ? previousAudit.registryCount : beforeAudit.registryCount;
      const previousFirstRegistry = previousAudit ? previousAudit.firstRegistryMessageId : beforeAudit.firstRegistryMessageId;
      if (currentGap != null && (bestKnownGap == null || currentGap < bestKnownGap)) {
        bestKnownGap = currentGap;
        reasons.push("known-gap-reduced");
      }
      if (currentIndex != null && currentIndex >= 0 && (bestFirstVisibleIndex == null || currentIndex < bestFirstVisibleIndex)) {
        bestFirstVisibleIndex = currentIndex;
        reasons.push("first-visible-index-improved");
      }
      const visibleHeadEarliestIndex = getKnownGapProbeVisibleHeadEarliestIndex(audit);
      if (visibleHeadEarliestIndex != null && (bestFirstVisibleIndex == null || visibleHeadEarliestIndex < bestFirstVisibleIndex)) {
        bestFirstVisibleIndex = visibleHeadEarliestIndex;
        reasons.push("visible-head-earlier-message");
      }
      if (Number(audit.registryCount || 0) > Number(previousRegistryCount || 0)) reasons.push("registry-count-increased");
      if (previousFirstRegistry && audit.firstRegistryMessageId && previousFirstRegistry !== audit.firstRegistryMessageId) reasons.push("first-registry-changed");
      if (!reasons.length) return false;
      progressDetected = true;
      progressReason = reasons.includes("known-gap-reduced") ? "known-gap-reduced" : reasons[0];
      progressEventCount += 1;
      const entry = {
        eventIndex: progressEventCount,
        label: label || "known-gap-continuous-progress",
        reasons,
        knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
        knownGapAfter: audit.knownTopGapFromFirstVisible,
        bestKnownGap,
        firstVisibleIndexBefore: beforeAudit.firstVisibleDomRegistryIndex,
        firstVisibleIndexAfter: audit.firstVisibleDomRegistryIndex,
        bestFirstVisibleIndex,
        registryCountBefore: beforeAudit.registryCount,
        registryCountAfter: audit.registryCount,
        firstRegistryBefore: beforeAudit.firstRegistryMessageId,
        firstRegistryAfter: audit.firstRegistryMessageId,
        timestamp: new Date().toISOString()
      };
      progressHistory.push(entry);
      appendBackfillTraceEvent("known-gap-continuous-probe-progress", "progress", {
        beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
        afterIndex: audit.firstVisibleDomRegistryIndex,
        knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
        knownGapAfter: audit.knownTopGapFromFirstVisible,
        registryCountBefore: beforeAudit.registryCount,
        registryCountAfter: audit.registryCount,
        targetDescriptor,
        result: "progress",
        reason: progressReason
      });
      appendBackfillTraceEvent("known-gap-continuous-probe-progress-continue", "progress", {
        beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
        afterIndex: audit.firstVisibleDomRegistryIndex,
        knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
        knownGapAfter: audit.knownTopGapFromFirstVisible,
        registryCountBefore: beforeAudit.registryCount,
        registryCountAfter: audit.registryCount,
        targetDescriptor,
        result: "continue",
        reason: "stable-true-top-required"
      });
      return true;
    };

    const recordReverseIndexIgnored = (audit, source) => {
      if (!audit) return;
      reverseIndexObserved = true;
      reverseIndexIgnoredInBackfillMode = true;
      reverseIndexIgnoredReason = "backfill-mode-stable-true-top-only";
      postHydrationSettleNeeded = true;
      appendBackfillTraceEvent("known-gap-continuous-probe-reverse-index-ignored", "audit", {
        beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
        afterIndex: audit.firstVisibleDomRegistryIndex,
        knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
        knownGapAfter: audit.knownTopGapFromFirstVisible,
        registryCountBefore: beforeAudit.registryCount,
        registryCountAfter: audit.registryCount,
        targetDescriptor,
        result: "ignored",
        reason: reverseIndexIgnoredReason,
        source: source || "business-audit"
      });
      appendBackfillTraceEvent("known-gap-continuous-probe-post-hydration-settle-needed", "audit", {
        beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
        afterIndex: audit.firstVisibleDomRegistryIndex,
        knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
        knownGapAfter: audit.knownTopGapFromFirstVisible,
        registryCountBefore: beforeAudit.registryCount,
        registryCountAfter: audit.registryCount,
        targetDescriptor,
        result: "continue",
        reason: "post-hydration-settle-needed"
      });
    };

    const runBusinessAudit = (label, stepEntry, cycleEntry) => {
      scanMergeSaveBackfillBatch(label || "manual-known-gap-continuous-probe-audit");
      const audit = getBackfillHydrationAuditSnapshot(label || "known-gap-continuous-probe-audit");
      const comparison = compareBackfillHydrationAudits(beforeAudit, audit);
      const previousAudit = lastAudit || beforeAudit;
      const progress = recordProbeProgress(audit, comparison, previousAudit, label);
      const reverseMovement = (typeof beforeAudit.firstVisibleDomRegistryIndex === "number" &&
        typeof audit.firstVisibleDomRegistryIndex === "number" &&
        audit.firstVisibleDomRegistryIndex > beforeAudit.firstVisibleDomRegistryIndex) ||
        didKnownGapProbeVisibleHeadMoveLater(beforeAudit, audit);
      if (reverseMovement) recordReverseIndexIgnored(audit, label);
      afterAudit = audit;
      lastAudit = audit;
      lastAuditAt = Date.now();
      if (stepEntry) {
        stepEntry.businessAuditTriggered = true;
        stepEntry.knownGapBeforeAudit = beforeAudit.knownTopGapFromFirstVisible;
        stepEntry.knownGapAfterAudit = audit.knownTopGapFromFirstVisible;
        stepEntry.firstVisibleIndexBeforeAudit = beforeAudit.firstVisibleDomRegistryIndex;
        stepEntry.firstVisibleIndexAfterAudit = audit.firstVisibleDomRegistryIndex;
      }
      if (cycleEntry) {
        cycleEntry.businessImproved = progress;
        cycleEntry.knownGapBefore = beforeAudit.knownTopGapFromFirstVisible;
        cycleEntry.knownGapAfter = audit.knownTopGapFromFirstVisible;
        cycleEntry.firstVisibleIndexBefore = beforeAudit.firstVisibleDomRegistryIndex;
        cycleEntry.firstVisibleIndexAfter = audit.firstVisibleDomRegistryIndex;
      }
      appendBackfillTraceEvent("known-gap-continuous-probe-business-audit", "audit", {
        beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
        afterIndex: audit.firstVisibleDomRegistryIndex,
        knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
        knownGapAfter: audit.knownTopGapFromFirstVisible,
        registryCountBefore: beforeAudit.registryCount,
        registryCountAfter: audit.registryCount,
        targetDescriptor,
        result: progress ? "progress" : reverseMovement ? "reverse-index-ignored" : "no-business-improvement",
        reason: comparison.hydrationDetectionReason
      });
      updateRuntimePatch({
        knownGapProbeAfter: audit,
        knownGapProbeKnownGapAfter: audit.knownTopGapFromFirstVisible,
        knownGapProbeFirstVisibleIndexAfter: audit.firstVisibleDomRegistryIndex,
        knownGapProbeRegistryCountAfter: audit.registryCount,
        knownGapProbeVisibleDomCountAfter: audit.visibleDomUserMessageCount,
        knownGapProbeRegistryDelta: Number(audit.registryCount || 0) - Number(beforeAudit.registryCount || 0),
        knownGapProbeFirstRegistryAfter: audit.firstRegistryMessageId
      });
      return { audit, comparison, progress, reverseMovement };
    };

    const updateSoftStatusIfDue = () => {
      const now = Date.now();
      if (now - lastSoftStatusAt < KNOWN_GAP_PROBE_SOFT_STATUS_UPDATE_MS) return;
      lastSoftStatusAt = now;
      updateRuntimePatch();
      appendBackfillTraceEvent("known-gap-continuous-probe-status-update", "status", {
        beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
        afterIndex: afterAudit ? afterAudit.firstVisibleDomRegistryIndex : null,
        knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
        knownGapAfter: afterAudit ? afterAudit.knownTopGapFromFirstVisible : null,
        registryCountBefore: beforeAudit.registryCount,
        registryCountAfter: afterAudit ? afterAudit.registryCount : null,
        targetDescriptor,
        result: getKnownGapProbeEstimatedPhase(state.backfill),
        reason: getKnownGapProbeStableTopConfirmationLabel(state.backfill)
      });
      if (state.backfill && state.backfill.knownGapProbeStatus === "running" && !state.backfill.knownGapProbeCanCopyFinalDebug) {
        appendBackfillTraceEvent("known-gap-continuous-probe-copy-debug-not-ready", "status", {
          beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
          afterIndex: afterAudit ? afterAudit.firstVisibleDomRegistryIndex : null,
          knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
          knownGapAfter: afterAudit ? afterAudit.knownTopGapFromFirstVisible : null,
          registryCountBefore: beforeAudit.registryCount,
          registryCountAfter: afterAudit ? afterAudit.registryCount : null,
          targetDescriptor,
          result: "not-ready",
          reason: state.backfill.knownGapProbeEstimatedPhase || "running"
        });
      }
    };

    while (true) {
      if (cancelKnownGapProbeIfNotCurrent(runId, conversationId)) return;
      updateSoftStatusIfDue();
      const elapsed = Date.now() - startedAtMs;
      if (elapsed > KNOWN_GAP_PROBE_MAX_TOTAL_MS ||
        totalSteps >= KNOWN_GAP_PROBE_MAX_TOTAL_STEPS ||
        hydrationCycles >= KNOWN_GAP_PROBE_MAX_HYDRATION_CYCLES) {
        stoppedBecauseMaxBudget = true;
        const budgetMetrics = getBackfillScrollMetrics(target);
        if (Number(budgetMetrics.scrollTop || 0) > KNOWN_GAP_NATIVE_PROBE_TOP_THRESHOLD) {
          budgetStopPhase = "still-driving-upward";
        } else if (Number(budgetMetrics.scrollTop || 0) <= KNOWN_GAP_PROBE_TRUE_TOP_EPSILON &&
          stableTopConfirmationCount < KNOWN_GAP_PROBE_STABLE_TOP_CONFIRMATIONS_REQUIRED) {
          budgetStopPhase = "stable-top-confirmation-incomplete";
        } else {
          budgetStopPhase = "near-top-not-stable";
        }
        break;
      }

      const beforeStep = getBackfillScrollMetrics(target);
      const nearTopBefore = Number(beforeStep.scrollTop || 0) <= KNOWN_GAP_NATIVE_PROBE_TOP_THRESHOLD;

      if (!nearTopBefore) {
        const amount = Math.round(Math.min(
          Math.max(1800, Number(beforeStep.clientHeight || window.innerHeight || 800) * 3),
          Math.max(800, Number(beforeStep.scrollTop || 0))
        ));
        let method = "unsupported";
        let errorMessage = null;
        try {
          method = scrollKnownGapProbeTargetBy(target, amount);
        } catch (error) {
          errorMessage = error && error.message ? error.message : String(error);
        }
        await waitForBackfillFrame(KNOWN_GAP_PROBE_STEP_WAIT_MS);
        if (cancelKnownGapProbeIfNotCurrent(runId, conversationId)) return;
        const immediate = getBackfillScrollMetrics(target);
        await waitForBackfillFrame(KNOWN_GAP_PROBE_POST_SCROLL_WAIT_MS);
        if (cancelKnownGapProbeIfNotCurrent(runId, conversationId)) return;
        const afterWait = getBackfillScrollMetrics(target);
        totalSteps += 1;
        const moved = Math.abs(Number(immediate.scrollTop || 0) - Number(beforeStep.scrollTop || 0)) > 1 ||
          Math.abs(Number(immediate.windowScrollY || 0) - Number(beforeStep.windowScrollY || 0)) > 1;
        nativeScrollWorked = nativeScrollWorked || moved;
        const scrollHeightDelta = Number(afterWait.scrollHeight || 0) - Number(beforeStep.scrollHeight || 0);
        const hydrationByScrollHeight = scrollHeightDelta > KNOWN_GAP_PROBE_SCROLLHEIGHT_GROWTH_THRESHOLD;
        const anchorCompensated = hydrationByScrollHeight && Number(afterWait.scrollTop || 0) > Number(beforeStep.scrollTop || 0);
        scrollHeightIncreased = scrollHeightIncreased || hydrationByScrollHeight;
        topHydrationCycleDetected = topHydrationCycleDetected || hydrationByScrollHeight;
        anchorCompensatedScrollTop = anchorCompensatedScrollTop || anchorCompensated;
        if (hydrationByScrollHeight) lastHydrationAt = new Date().toISOString();
        if (anchorCompensated) {
          anchorCompensations += 1;
          lastAnchorCompensationAt = new Date().toISOString();
        }
        reachedTopThreshold = reachedTopThreshold || Number(immediate.scrollTop || 0) <= KNOWN_GAP_NATIVE_PROBE_TOP_THRESHOLD ||
          Number(afterWait.scrollTop || 0) <= KNOWN_GAP_NATIVE_PROBE_TOP_THRESHOLD;

        const stepEntry = {
          stepIndex: totalSteps,
          cycleIndex: hydrationCycles,
          method,
          amount,
          scrollTopBefore: beforeStep.scrollTop,
          scrollTopAfterImmediate: immediate.scrollTop,
          scrollTopAfterWait: afterWait.scrollTop,
          scrollHeightBefore: beforeStep.scrollHeight,
          scrollHeightAfterImmediate: immediate.scrollHeight,
          scrollHeightAfterWait: afterWait.scrollHeight,
          scrollHeightDelta,
          nearTopBefore,
          nearTopAfter: Number(afterWait.scrollTop || 0) <= KNOWN_GAP_NATIVE_PROBE_TOP_THRESHOLD,
          hydrationDetectedByScrollHeight: hydrationByScrollHeight,
          anchorCompensated,
          businessAuditTriggered: false,
          knownGapBeforeAudit: null,
          knownGapAfterAudit: null,
          firstVisibleIndexBeforeAudit: null,
          firstVisibleIndexAfterAudit: null,
          timestamp: new Date().toISOString(),
          errorMessage
        };
        stepHistory.push(stepEntry);
        Object.assign(selectedCandidate.info, {
          methodTried: method,
          workedByScrollMetric: moved,
          scrollTop: afterWait.scrollTop,
          scrollTopBefore: beforeStep.scrollTop,
          scrollTopAfter: afterWait.scrollTop,
          scrollTopAfterImmediate: immediate.scrollTop,
          scrollTopAfterWait: afterWait.scrollTop,
          scrollHeight: afterWait.scrollHeight,
          scrollHeightBefore: beforeStep.scrollHeight,
          scrollHeightAfterImmediate: immediate.scrollHeight,
          scrollHeightAfterWait: afterWait.scrollHeight,
          errorMessage
        });
        appendBackfillTraceEvent("known-gap-continuous-probe-step", "scroll-step", {
          beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
          knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
          registryCountBefore: beforeAudit.registryCount,
          targetDescriptor,
          scrollMethod: method,
          scrollAmount: amount,
          result: moved ? "moved" : "no-movement",
          reason: hydrationByScrollHeight ? "scrollheight-increased" : "continuous-upward-step"
        });
        if (hydrationByScrollHeight) {
          hydrationCycles += 1;
          const cycleStart = Date.now();
          const cycleEntry = {
            cycleIndex: hydrationCycles,
            reason: "scrollheight-increased",
            scrollTopStart: beforeStep.scrollTop,
            scrollTopEnd: afterWait.scrollTop,
            scrollHeightStart: beforeStep.scrollHeight,
            scrollHeightEnd: afterWait.scrollHeight,
            scrollHeightDelta,
            stepCount: totalSteps,
            hydrationCycleDetected: true,
            anchorCompensationDetected: anchorCompensated,
            reachedTopThreshold,
            stableAtTop: false,
            businessImproved: false,
            knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
            knownGapAfter: null,
            firstVisibleIndexBefore: beforeAudit.firstVisibleDomRegistryIndex,
            firstVisibleIndexAfter: null,
            durationMs: 0
          };
          cycleHistory.push(cycleEntry);
          appendBackfillTraceEvent("known-gap-continuous-probe-scrollheight-increased", "cycle", {
            beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
            knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
            registryCountBefore: beforeAudit.registryCount,
            targetDescriptor,
            scrollMethod: method,
            scrollAmount: amount,
            result: "scrollheight-increased",
            reason: "delta-" + Math.round(scrollHeightDelta)
          });
          if (anchorCompensated) {
            appendBackfillTraceEvent("known-gap-continuous-probe-anchor-compensated", "cycle", {
              beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
              knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
              registryCountBefore: beforeAudit.registryCount,
              targetDescriptor,
              scrollMethod: method,
              result: "anchor-compensated",
              reason: "scrollTop-increased-after-height-growth"
            });
          }
          await waitForBackfillFrame(KNOWN_GAP_PROBE_HYDRATION_WAIT_MS);
          if (cancelKnownGapProbeIfNotCurrent(runId, conversationId)) return;
          runBusinessAudit("manual-known-gap-continuous-hydration-cycle", stepEntry, cycleEntry);
          cycleEntry.durationMs = Date.now() - cycleStart;
          updateRuntimePatch({
            knownGapProbeHydrationDetected: progressDetected,
            knownGapProbeVisualOnly: topHydrationCycleDetected && !progressDetected
          });
          continue;
        }

        if (Date.now() - lastAuditAt >= KNOWN_GAP_PROBE_BUSINESS_AUDIT_THROTTLE_MS) {
          runBusinessAudit("manual-known-gap-continuous-throttled-audit", stepEntry, null);
        }
        updateRuntimePatch({
          knownGapProbeScrollTopBefore: beforeStep.scrollTop,
          knownGapProbeScrollTopAfterImmediate: immediate.scrollTop,
          knownGapProbeScrollTopAfterWait: afterWait.scrollTop,
          knownGapProbeScrollTopAfter: afterWait.scrollTop,
          knownGapProbeScrollHeightBefore: beforeStep.scrollHeight,
          knownGapProbeScrollHeightAfterImmediate: immediate.scrollHeight,
          knownGapProbeScrollHeightAfterWait: afterWait.scrollHeight,
          knownGapProbeScrollHeightDelta: scrollHeightDelta,
          knownGapProbeScrollMethod: method,
          knownGapProbeScrollAmount: amount,
          knownGapProbeWaitMsAfterTop: null
        });
        continue;
      }

      reachedTopThreshold = true;
      appendBackfillTraceEvent("known-gap-continuous-probe-reached-top-threshold", "top-threshold", {
        beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
        knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
        registryCountBefore: beforeAudit.registryCount,
        targetDescriptor,
        result: "reached-top-threshold",
        reason: "scrollTop<=200"
      });
      topNudgeCount += 1;
      jumpToTopAttempted = true;
      markProgrammaticScroll();
      try {
        if (target.node && typeof target.node.scrollTop === "number") {
          target.node.scrollTop = 0;
        } else if (target.node && typeof target.node.scrollBy === "function") {
          target.node.scrollBy({ top: -800, behavior: "auto" });
        }
      } catch (_) {}
      await waitForBackfillFrame(120);
      if (cancelKnownGapProbeIfNotCurrent(runId, conversationId)) return;
      const stableStart = getBackfillScrollMetrics(target);
      jumpToTopWorked = jumpToTopWorked || Number(stableStart.scrollTop || 0) <= KNOWN_GAP_PROBE_TRUE_TOP_EPSILON;
      const stableAuditBefore = getBackfillHydrationAuditSnapshot("known-gap-stable-top-before");
      const mutationCountBeforeStableWait = Number(DEBUG_STATE.mutationTriggerCount || 0);
      const messageHashBeforeStableWait = state.messageHash || "";
      appendBackfillTraceEvent("known-gap-continuous-probe-stable-at-top-wait", "wait", {
        beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
        knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
        registryCountBefore: beforeAudit.registryCount,
        targetDescriptor,
        result: "waiting",
        reason: "stable-top-wait"
      });
      await waitForBackfillFrame(KNOWN_GAP_PROBE_STABLE_TOP_WAIT_MS);
      if (cancelKnownGapProbeIfNotCurrent(runId, conversationId)) return;
      const stableAfter = getBackfillScrollMetrics(target);
      await waitForBackfillFrame(KNOWN_GAP_PROBE_TOP_NUDGE_WAIT_MS);
      if (cancelKnownGapProbeIfNotCurrent(runId, conversationId)) return;
      const stableAfterExtra = getBackfillScrollMetrics(target);
      const stableAuditResult = runBusinessAudit("manual-known-gap-continuous-stable-top-check", null, null);
      const mutationCountAfterStableWait = Number(DEBUG_STATE.mutationTriggerCount || 0);
      const messageHashAfterStableWait = state.messageHash || "";
      jumpToTopWorked = jumpToTopWorked || Number(stableAfterExtra.scrollTop || 0) <= KNOWN_GAP_PROBE_TRUE_TOP_EPSILON;
      const stableScrollHeightDelta = Number(stableAfterExtra.scrollHeight || 0) - Number(stableStart.scrollHeight || 0);
      const stableHeightIncreased = stableScrollHeightDelta > KNOWN_GAP_PROBE_SCROLLHEIGHT_GROWTH_THRESHOLD;
      const stableAnchorCompensated = stableHeightIncreased && Number(stableAfterExtra.scrollTop || 0) > Number(stableStart.scrollTop || 0) + 20;
      const stableVisibleDomChanged = Number(stableAuditResult.audit.visibleDomUserMessageCount || 0) !== Number(stableAuditBefore.visibleDomUserMessageCount || 0);
      const stableRegistryChanged = Number(stableAuditResult.audit.registryCount || 0) !== Number(stableAuditBefore.registryCount || 0);
      const stableMessageHashChanged = messageHashAfterStableWait !== messageHashBeforeStableWait;
      const stableMutationIncreased = mutationCountAfterStableWait > mutationCountBeforeStableWait;
      const stableTrueTop = Number(stableAfterExtra.scrollTop || 0) <= KNOWN_GAP_PROBE_TRUE_TOP_EPSILON;
      Object.assign(selectedCandidate.info, {
        methodTried: jumpToTopAttempted ? "scrollTop-set" : selectedCandidate.info.methodTried,
        workedByScrollMetric: selectedCandidate.info.workedByScrollMetric || jumpToTopWorked,
        scrollTop: stableAfterExtra.scrollTop,
        scrollTopBefore: stableStart.scrollTop,
        scrollTopAfter: stableAfterExtra.scrollTop,
        scrollTopAfterImmediate: stableAfter.scrollTop,
        scrollTopAfterWait: stableAfterExtra.scrollTop,
        scrollHeight: stableAfterExtra.scrollHeight,
        scrollHeightBefore: stableStart.scrollHeight,
        scrollHeightAfterImmediate: stableAfter.scrollHeight,
        scrollHeightAfterWait: stableAfterExtra.scrollHeight
      });
      scrollHeightIncreased = scrollHeightIncreased || stableHeightIncreased;
      topHydrationCycleDetected = topHydrationCycleDetected || stableHeightIncreased;
      anchorCompensatedScrollTop = anchorCompensatedScrollTop || stableAnchorCompensated;
      if (stableHeightIncreased) lastHydrationAt = new Date().toISOString();
      if (stableAnchorCompensated) {
        anchorCompensations += 1;
        lastAnchorCompensationAt = new Date().toISOString();
      }
      updateRuntimePatch({
        knownGapProbeMutationCountBeforeStableWait: mutationCountBeforeStableWait,
        knownGapProbeMutationCountAfterStableWait: mutationCountAfterStableWait,
        knownGapProbeMessageHashBeforeStableWait: messageHashBeforeStableWait,
        knownGapProbeMessageHashAfterStableWait: messageHashAfterStableWait,
        knownGapProbeScrollTopBefore: stableStart.scrollTop,
        knownGapProbeScrollTopAfterImmediate: stableAfter.scrollTop,
        knownGapProbeScrollTopAfterWait: stableAfterExtra.scrollTop,
        knownGapProbeScrollTopAfter: stableAfterExtra.scrollTop,
        knownGapProbeScrollHeightBefore: stableStart.scrollHeight,
        knownGapProbeScrollHeightAfterImmediate: stableAfter.scrollHeight,
        knownGapProbeScrollHeightAfterWait: stableAfterExtra.scrollHeight,
        knownGapProbeScrollHeightDelta: stableScrollHeightDelta,
        knownGapProbeWaitMsAfterTop: KNOWN_GAP_PROBE_STABLE_TOP_WAIT_MS
      });

      const stableResetReasons = [];
      if (stableHeightIncreased) stableResetReasons.push("scrollheight-increased");
      if (!stableTrueTop) stableResetReasons.push("scrolltop-rebounded");
      if (stableVisibleDomChanged) stableResetReasons.push("visible-dom-count-changed");
      if (stableRegistryChanged) stableResetReasons.push("registry-count-changed");
      if (stableMessageHashChanged) stableResetReasons.push("message-hash-changed");
      if (stableMutationIncreased) stableResetReasons.push("mutation-count-increased");
      appendBackfillTraceEvent("known-gap-continuous-probe-stable-check", "stable-check", {
        beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
        afterIndex: stableAuditResult.audit.firstVisibleDomRegistryIndex,
        knownGapBefore: stableAuditBefore.knownTopGapFromFirstVisible,
        knownGapAfter: stableAuditResult.audit.knownTopGapFromFirstVisible,
        registryCountBefore: stableAuditBefore.registryCount,
        registryCountAfter: stableAuditResult.audit.registryCount,
        targetDescriptor,
        result: stableResetReasons.length ? "unstable" : "stable",
        reason: stableResetReasons.join(",") || "stable-check-passed"
      });

      if (stableResetReasons.length) {
        stableTopConfirmationCount = 0;
        stableTopResetCount += 1;
        stableTopResetReason = stableResetReasons.join(",");
        if (stableHeightIncreased || stableVisibleDomChanged || stableRegistryChanged || stableMessageHashChanged || stableMutationIncreased) {
          topHydrationCycleDetected = true;
          lastHydrationAt = new Date().toISOString();
        }
        if (beforeAudit.knownTopGapFromFirstVisible === 0 && (stableHeightIncreased || stableVisibleDomChanged || stableRegistryChanged || stableMessageHashChanged)) {
          setKnownGapProbePatch({
            knownGapProbeReason: "dom-hydration-observed-without-known-gap",
            knownGapProbeVisualOnly: !progressDetected,
            knownGapProbeHydrationDetected: progressDetected
          });
        }
        hydrationCycles += 1;
        const cycleStart = Date.now();
        const cycleEntry = {
          cycleIndex: hydrationCycles,
          reason: stableTopResetReason,
          scrollTopStart: stableStart.scrollTop,
          scrollTopEnd: stableAfterExtra.scrollTop,
          scrollHeightStart: stableStart.scrollHeight,
          scrollHeightEnd: stableAfterExtra.scrollHeight,
          scrollHeightDelta: stableScrollHeightDelta,
          stepCount: totalSteps,
          hydrationCycleDetected: stableHeightIncreased || stableVisibleDomChanged || stableRegistryChanged || stableMessageHashChanged || stableMutationIncreased,
          anchorCompensationDetected: stableAnchorCompensated,
          reachedTopThreshold: true,
          stableAtTop: false,
          businessImproved: false,
          knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
          knownGapAfter: stableAuditResult.audit.knownTopGapFromFirstVisible,
          firstVisibleIndexBefore: beforeAudit.firstVisibleDomRegistryIndex,
          firstVisibleIndexAfter: stableAuditResult.audit.firstVisibleDomRegistryIndex,
          durationMs: 0
        };
        cycleHistory.push(cycleEntry);
        appendBackfillTraceEvent(stableHeightIncreased ? "known-gap-continuous-probe-scrollheight-increased" : "known-gap-continuous-probe-business-audit", "stable-top-reset", {
          beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
          afterIndex: stableAuditResult.audit.firstVisibleDomRegistryIndex,
          knownGapBefore: stableAuditBefore.knownTopGapFromFirstVisible,
          knownGapAfter: stableAuditResult.audit.knownTopGapFromFirstVisible,
          registryCountBefore: beforeAudit.registryCount,
          registryCountAfter: stableAuditResult.audit.registryCount,
          targetDescriptor,
          result: "stable-top-reset",
          reason: stableTopResetReason
        });
        appendBackfillTraceEvent("known-gap-continuous-probe-stable-check-reset", "stable-check", {
          beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
          afterIndex: stableAuditResult.audit.firstVisibleDomRegistryIndex,
          knownGapBefore: stableAuditBefore.knownTopGapFromFirstVisible,
          knownGapAfter: stableAuditResult.audit.knownTopGapFromFirstVisible,
          registryCountBefore: stableAuditBefore.registryCount,
          registryCountAfter: stableAuditResult.audit.registryCount,
          targetDescriptor,
          result: "reset",
          reason: stableTopResetReason
        });
        if (stableAnchorCompensated) {
          appendBackfillTraceEvent("known-gap-continuous-probe-anchor-compensated", "stable-top-cycle", {
            beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
            knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
            registryCountBefore: beforeAudit.registryCount,
            targetDescriptor,
            result: "anchor-compensated",
            reason: "stable-top-scrollTop-rebounded"
          });
        }
        cycleEntry.durationMs = Date.now() - cycleStart;
        updateRuntimePatch({
          knownGapProbeReason: beforeAudit.knownTopGapFromFirstVisible === 0 ? "dom-hydration-observed-without-known-gap" : state.backfill.knownGapProbeReason,
          knownGapProbeHydrationDetected: progressDetected,
          knownGapProbeVisualOnly: !progressDetected
        });
        continue;
      }

      if (stableTrueTop) {
        stableTopConfirmationCount += 1;
        stableTopResetReason = null;
        updateRuntimePatch({
          knownGapProbeScrollTopBefore: stableStart.scrollTop,
          knownGapProbeScrollTopAfterImmediate: stableAfter.scrollTop,
          knownGapProbeScrollTopAfterWait: stableAfterExtra.scrollTop,
          knownGapProbeScrollTopAfter: stableAfterExtra.scrollTop,
          knownGapProbeScrollHeightBefore: stableStart.scrollHeight,
          knownGapProbeScrollHeightAfterImmediate: stableAfter.scrollHeight,
          knownGapProbeScrollHeightAfterWait: stableAfterExtra.scrollHeight,
          knownGapProbeScrollHeightDelta: stableScrollHeightDelta,
          knownGapProbeWaitMsAfterTop: KNOWN_GAP_PROBE_STABLE_TOP_WAIT_MS
        });
        appendBackfillTraceEvent("known-gap-continuous-probe-stable-check-confirmed", "stable-check", {
          beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
          afterIndex: stableAuditResult.audit.firstVisibleDomRegistryIndex,
          knownGapBefore: stableAuditBefore.knownTopGapFromFirstVisible,
          knownGapAfter: stableAuditResult.audit.knownTopGapFromFirstVisible,
          registryCountBefore: stableAuditBefore.registryCount,
          registryCountAfter: stableAuditResult.audit.registryCount,
          targetDescriptor,
          result: "confirmed-" + stableTopConfirmationCount,
          reason: "stable-true-top-check-passed"
        });
        appendBackfillTraceEvent("known-gap-continuous-probe-stable-confirmation-progress", "stable-check", {
          beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
          afterIndex: stableAuditResult.audit.firstVisibleDomRegistryIndex,
          knownGapBefore: stableAuditBefore.knownTopGapFromFirstVisible,
          knownGapAfter: stableAuditResult.audit.knownTopGapFromFirstVisible,
          registryCountBefore: stableAuditBefore.registryCount,
          registryCountAfter: stableAuditResult.audit.registryCount,
          targetDescriptor,
          result: stableTopConfirmationCount + "/" + KNOWN_GAP_PROBE_STABLE_TOP_CONFIRMATIONS_REQUIRED,
          reason: "stable-true-top-confirmation-progress"
        });
        if (stableTopConfirmationCount < KNOWN_GAP_PROBE_STABLE_TOP_CONFIRMATIONS_REQUIRED) {
          appendBackfillTraceEvent("known-gap-continuous-probe-copy-debug-not-ready", "stable-check", {
            beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
            afterIndex: stableAuditResult.audit.firstVisibleDomRegistryIndex,
            knownGapBefore: stableAuditBefore.knownTopGapFromFirstVisible,
            knownGapAfter: stableAuditResult.audit.knownTopGapFromFirstVisible,
            registryCountBefore: stableAuditBefore.registryCount,
            registryCountAfter: stableAuditResult.audit.registryCount,
            targetDescriptor,
            result: "not-ready",
            reason: stableTopConfirmationCount + "/" + KNOWN_GAP_PROBE_STABLE_TOP_CONFIRMATIONS_REQUIRED
          });
        }
        if (stableTopConfirmationCount >= KNOWN_GAP_PROBE_STABLE_TOP_CONFIRMATIONS_REQUIRED) {
          reachedTrueTop = true;
          stableAtTop = true;
          stoppedAfterStableTopConfirmations = true;
          updateRuntimePatch({
            knownGapProbeStatus: "success",
            knownGapProbeReason: "stable-true-top-confirmed",
            knownGapProbeHydrationDetected: progressDetected,
            knownGapProbeVisualOnly: !!topHydrationCycleDetected && !progressDetected,
            knownGapProbeReachedTrueTop: true,
            knownGapProbeStableAtTop: true,
            knownGapProbeStoppedAfterStableTopConfirmations: true,
            knownGapProbeStoppedBecauseMaxBudget: false,
            knownGapProbeBudgetStopPhase: null
          });
          appendBackfillTraceEvent("known-gap-continuous-probe-stable-true-top-success", "stable-top-confirmed", {
            beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
            afterIndex: stableAuditResult.audit.firstVisibleDomRegistryIndex,
            knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
            knownGapAfter: stableAuditResult.audit.knownTopGapFromFirstVisible,
            registryCountBefore: beforeAudit.registryCount,
            registryCountAfter: stableAuditResult.audit.registryCount,
            targetDescriptor,
            result: "success",
            reason: "stable-true-top-confirmed"
          });
          cleanupKnownGapProbeUserInterruptGuard();
          return;
        }
        continue;
      }
      stableTopConfirmationCount = 0;
      stableTopResetCount += 1;
      stableTopResetReason = "scrolltop-rebounded";
      updateRuntimePatch();
    }

    updateRuntimePatch({
      knownGapProbeStatus: "failed",
      knownGapProbeReason: stoppedBecauseMaxBudget ? "max-budget-before-stable-true-top" :
        topHydrationCycleDetected ? "top-hydration-cycle-detected-but-no-known-gap-improvement" : "native-scroll-no-hydration",
      knownGapProbeHydrationDetected: progressDetected,
      knownGapProbeVisualOnly: !!topHydrationCycleDetected && !progressDetected,
      knownGapProbeStoppedBecauseMaxBudget: stoppedBecauseMaxBudget
    });
    appendBackfillTraceEvent(stoppedBecauseMaxBudget ? "known-gap-continuous-probe-max-budget-before-stable-true-top" : "known-gap-continuous-probe-failed", "finish", {
      beforeIndex: beforeAudit.firstVisibleDomRegistryIndex,
      afterIndex: afterAudit ? afterAudit.firstVisibleDomRegistryIndex : null,
      knownGapBefore: beforeAudit.knownTopGapFromFirstVisible,
      knownGapAfter: afterAudit ? afterAudit.knownTopGapFromFirstVisible : null,
      registryCountBefore: beforeAudit.registryCount,
      registryCountAfter: afterAudit ? afterAudit.registryCount : null,
      targetDescriptor,
      result: "failed",
      reason: stoppedBecauseMaxBudget ? "max-budget-before-stable-true-top" :
        topHydrationCycleDetected ? "top-hydration-cycle-detected-but-no-known-gap-improvement" : "native-scroll-no-hydration"
    });
    cleanupKnownGapProbeUserInterruptGuard();
  }

  function cancelCurrentConversationBackfill(reason) {
    const status = state.backfill && state.backfill.status;
    if (status !== "running") {
      scheduleDebugPanelRefresh(true);
      return state.backfill;
    }
    return setBackfillStatus("cancelling", {
      cancelRequested: true,
      lastError: reason || "cancelled"
    });
  }

  function startCurrentConversationBackfill() {
    const status = state.backfill && state.backfill.status;
    if (status === "running" || status === "cancelling") return state.backfill;
    if (state.backfill && state.backfill.knownGapProbeStatus === "running") {
      setKnownGapProbePatch({
        knownGapProbeReason: "known-gap-probe-already-running"
      });
      return state.backfill;
    }

    const conversationId = getConversationId() || state.currentConversationId;
    const runId = "backfill-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

    resetBackfillState("start-current-conversation-backfill");
    const hydrationAuditBefore = getBackfillHydrationAuditSnapshot("before");
    setBackfillStatus("running", {
      runId,
      cancelRequested: false,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      lastError: null,
      batchCount: 0,
      scannedVisibleCount: 0,
      registryCount: state.messageRegistry ? state.messageRegistry.size : 0,
      direction: "up",
      hydrationAuditBefore
    });
    appendBackfillTraceEvent("hydration-audit-before", "capture", {
      beforeIndex: hydrationAuditBefore.firstVisibleDomRegistryIndex,
      result: "captured",
      reason: "run-start"
    });
    appendBackfillTraceEvent("run-start", "start", {
      result: "running",
      reason: "manual-debug"
    });
    setupBackfillUserInterruptGuard(runId);

    runCurrentConversationBackfillLoop(runId, conversationId).catch((error) => {
      if (state.backfill && state.backfill.runId === runId) {
        setBackfillStatus("failed", {
          finishedAt: new Date().toISOString(),
          lastError: error && error.message ? error.message : "backfill-error"
        });
      }
    });

    return state.backfill;
  }

  async function runCurrentConversationBackfillLoop(runId, conversationId) {
    const maxBatchCount = 250;
    const maxDurationMs = 90000;
    const noProgressRoundLimit = 6;
    const topProbeMax = 6;
    const minimumMovementPx = 8;
    const waitMs = 500;
    const startedAtMs = Date.now();

    try {
      await waitForBackfillFrame(200);
      if (!isBackfillStillCurrent(runId, conversationId)) {
        if (state.backfill && state.backfill.runId === runId) {
          setBackfillStatus("cancelled", {
            cancelRequested: true,
            finishedAt: new Date().toISOString(),
            lastError: state.backfill.lastError || "cancelled",
            lastStopReason: state.backfill.lastError || "cancelled"
          });
        }
        return;
      }

      const scrollTarget = findBackfillScrollTarget();

      let attemptsWithoutMovement = 0;
      setBackfillStatus("running", {
        scrollTargetDescriptor: scrollTarget ? describeBackfillScrollTarget(scrollTarget) : null,
        ...(scrollTarget ? getBackfillScrollMetrics(scrollTarget) : {}),
        noProgressRoundLimit,
        topProbeMax,
        completionConfidence: null
      });

      while (true) {
        if (!isBackfillStillCurrent(runId, conversationId)) {
          const reason = state.backfill && state.backfill.cancelRequested ? (state.backfill.lastError || "cancelled") :
            getConversationId() !== conversationId ? "conversation-changed" : "run-replaced";
          if (state.backfill && state.backfill.runId === runId) {
            setBackfillStatus("cancelled", {
              cancelRequested: true,
              finishedAt: new Date().toISOString(),
              lastError: reason,
              lastStopReason: reason
            });
          }
          return;
        }

        if (Date.now() - startedAtMs >= maxDurationMs) {
          setBackfillStatus("failed", {
            finishedAt: new Date().toISOString(),
            lastError: "max-duration-reached",
            lastStopReason: "max-duration-reached",
            completionConfidence: "emergency-guard"
          });
          return;
        }

        const batchStartedAt = new Date().toISOString();
        const metrics = scanMergeSaveBackfillBatch("manual-backfill");
        const batchFinishedAt = new Date().toISOString();
        const batchCount = Number(state.backfill.batchCount || 0) + 1;
        const scannedVisibleCount = Number(state.backfill.scannedVisibleCount || 0) + Number(metrics.visibleCount || 0);
        const firstRegistryMessageId = state.messageOrder && state.messageOrder[0] ? state.messageOrder[0] : null;
        const anchorBefore = getFirstVisibleBackfillMessageAnchor();
        const anchorBeforeMetrics = getBackfillMessageAnchorMetrics(anchorBefore);
        const currentViewport = getBackfillViewportMetrics(anchorBeforeMetrics && anchorBeforeMetrics.messageId);
        const progressState = recordBackfillProgress(currentViewport, {});
        appendBackfillTraceEvent("batch-scan", "scan", {
          anchorId: anchorBeforeMetrics ? anchorBeforeMetrics.messageId : null,
          beforeIndex: currentViewport.firstVisibleRegistryIndex,
          afterIndex: currentViewport.firstVisibleRegistryIndex,
          result: progressState.progress ? "progress" : "no-progress",
          reason: progressState.reasons && progressState.reasons.length ? progressState.reasons.join(",") : "scan"
        });
        setBackfillStatus("running", {
          batchCount,
          scannedVisibleCount,
          registryCount: metrics.registryCount,
          lastBatchStartedAt: batchStartedAt,
          lastBatchFinishedAt: batchFinishedAt,
          firstVisibleDomMessageIdBefore: anchorBeforeMetrics ? anchorBeforeMetrics.messageId : null,
          firstRegistryMessageIdAtBackfill: firstRegistryMessageId,
          firstVisibleRegistryIndexBefore: currentViewport.firstVisibleRegistryIndex,
          firstVisibleRegistryIndexAfter: currentViewport.firstVisibleRegistryIndex,
          topProbeActive: false
        });

        if (progressState.oscillationDetected) {
          setBackfillStatus("failed", {
            finishedAt: new Date().toISOString(),
            lastError: "oscillation-detected",
            lastStopReason: "oscillation-detected",
            completionConfidence: "oscillation"
          });
          return;
        }

        if (batchCount >= maxBatchCount) {
          setBackfillStatus("failed", {
            finishedAt: new Date().toISOString(),
            lastError: "max-batch-guard",
            lastStopReason: "max-batch-guard",
            completionConfidence: "emergency-guard"
          });
          return;
        }

        if (currentViewport.firstVisibleRegistryIndex === 0) {
          const nextTopProbeCount = Number(state.backfill.topProbeCount || 0) + 1;
          if (nextTopProbeCount > topProbeMax) {
            setBackfillStatus("completed", {
              finishedAt: new Date().toISOString(),
              lastError: "completed-known-start-stable",
              lastStopReason: "completed-known-start-stable",
              scrollMethod: "top-probe",
              topProbeActive: false,
              topProbeCount: topProbeMax,
              completionConfidence: "known-start-stable"
            });
            return;
          }

          setBackfillStatus("running", {
            scrollMethod: "top-probe",
            topProbeActive: true,
            topProbeCount: nextTopProbeCount,
            topHydrationProbeAttempted: true,
            topHydrationProbeCount: nextTopProbeCount,
            lastStopReason: "reached-registry-start",
            completionConfidence: "known-start-probing"
          });

          appendBackfillTraceEvent("top-probe", "try", {
            beforeIndex: currentViewport.firstVisibleRegistryIndex,
            reason: "known-registry-start"
          });
          const topProbe = await tryBackfillTopHydrationProbe({ beforeMetrics: currentViewport });
          if (!isBackfillStillCurrent(runId, conversationId)) {
            const reason = state.backfill && state.backfill.cancelRequested ? (state.backfill.lastError || "cancelled") :
              getConversationId() !== conversationId ? "conversation-changed" : "run-replaced";
            if (state.backfill && state.backfill.runId === runId) {
              setBackfillStatus("cancelled", {
                cancelRequested: true,
                finishedAt: new Date().toISOString(),
                lastError: reason,
                lastStopReason: reason
              });
            }
            return;
          }

          const topProbeProgress = recordBackfillProgress(topProbe.after, {});
          const topProbeBatchCount = Number(state.backfill.batchCount || 0) + 1;
          const topProbeScannedVisibleCount = Number(state.backfill.scannedVisibleCount || 0) + Number(topProbe.scanMetrics.visibleCount || 0);
          setBackfillStatus("running", {
            batchCount: topProbeBatchCount,
            scannedVisibleCount: topProbeScannedVisibleCount,
            registryCount: topProbe.scanMetrics.registryCount,
            topProbeActive: false,
            topProbeCount: nextTopProbeCount,
            topHydrationProbeAttempted: true,
            topHydrationProbeCount: nextTopProbeCount,
            topHydrationProbeWorked: topProbe.hydratedEarlier || topProbeProgress.progress,
            topHydrationProbeReason: topProbe.reason,
            topHydrationProbeRegistryCountBefore: topProbe.before.registryCount,
            topHydrationProbeRegistryCountAfter: topProbe.after.registryCount,
            topHydrationProbeFirstRegistryBefore: topProbe.before.firstRegistryMessageId,
            topHydrationProbeFirstRegistryAfter: topProbe.after.firstRegistryMessageId,
            topHydrationProbeFirstVisibleIndexBefore: topProbe.before.firstVisibleRegistryIndex,
            topHydrationProbeFirstVisibleIndexAfter: topProbe.after.firstVisibleRegistryIndex,
            visualScrollObservedButNoHydration: !!topProbe.visualOnly,
            scrollMetricTrustedAsSuccess: false,
            firstVisibleDomMessageIdAfter: topProbe.after.firstVisibleDomMessageId,
            firstVisibleRegistryIndexAfter: topProbe.after.firstVisibleRegistryIndex,
            lastScrollWorked: topProbe.hydratedEarlier || topProbeProgress.progress,
            lastStopReason: topProbe.hydratedEarlier || topProbeProgress.progress ? "top-probe-progress" : "reached-registry-start",
            completionConfidence: "known-start-probing"
          });

          if (topProbe.unsafeReverse) {
            setBackfillStatus("failed", {
              finishedAt: new Date().toISOString(),
              lastError: "unsafe-reverse-hydration-probe",
              lastStopReason: "unsafe-reverse-hydration-probe",
              topProbeActive: false,
              reverseMovementDetected: true,
              reverseMovementFromIndex: topProbe.before.firstVisibleRegistryIndex,
              reverseMovementToIndex: topProbe.after.firstVisibleRegistryIndex,
              reverseMovementAnchorId: topProbe.anchorId,
              reverseMovementStoppedImmediately: true,
              completionConfidence: "safety-stop"
            });
            appendBackfillTraceEvent("safety-stop", "top-probe", {
              anchorId: topProbe.anchorId,
              beforeIndex: topProbe.before.firstVisibleRegistryIndex,
              afterIndex: topProbe.after.firstVisibleRegistryIndex,
              result: "failed",
              reason: "unsafe-reverse-hydration-probe"
            });
            return;
          }

          if (topProbeProgress.oscillationDetected) {
            setBackfillStatus("failed", {
              finishedAt: new Date().toISOString(),
              lastError: "oscillation-detected",
              lastStopReason: "oscillation-detected",
              topProbeActive: false,
              completionConfidence: "oscillation"
            });
            return;
          }

          if (topProbe.hydratedEarlier || topProbeProgress.progress) continue;
          if (nextTopProbeCount >= topProbeMax) {
            setBackfillStatus("completed", {
              finishedAt: new Date().toISOString(),
              lastError: "completed-known-start-stable",
              lastStopReason: "completed-known-start-stable",
              topProbeActive: false,
              completionConfidence: "known-start-stable"
            });
            return;
          }
          if (topProbeProgress.noProgressRoundCount >= noProgressRoundLimit) {
            setBackfillStatus("completed", {
              finishedAt: new Date().toISOString(),
              lastError: "completed-known-start-stable",
              lastStopReason: "completed-known-start-stable",
              topProbeActive: false,
              completionConfidence: "known-start-stable"
            });
            return;
          }
          continue;
        }

        let traditionalWorked = false;
        let before = null;
        let after = null;
        let scrollAttemptAt = new Date().toISOString();

        if (scrollTarget) {
          before = getBackfillScrollMetrics(scrollTarget);
          const delta = Math.max(240, (before.clientHeight || window.innerHeight || 800) * 0.85);
          scrollBackfillTargetUp(scrollTarget, delta);

          await waitForBackfillFrame(waitMs);

          after = getBackfillScrollMetrics(scrollTarget);
          const moved = Math.abs(after.scrollTop - before.scrollTop);
          traditionalWorked = moved >= minimumMovementPx;
          attemptsWithoutMovement = traditionalWorked ? 0 : attemptsWithoutMovement + 1;
          setBackfillStatus("running", {
            scrollMethod: traditionalWorked ? "traditional" : "traditional-no-movement",
            scrollTargetDescriptor: describeBackfillScrollTarget(scrollTarget),
            scrollTopBefore: before.scrollTop,
            scrollTopAfter: after.scrollTop,
            scrollDelta: after.scrollTop - before.scrollTop,
            scrollHeight: after.scrollHeight,
            clientHeight: after.clientHeight,
            windowScrollYBefore: before.windowScrollY,
            windowScrollYAfter: after.windowScrollY,
            lastScrollAttemptAt: scrollAttemptAt,
            lastScrollWorked: traditionalWorked,
            lastStopReason: traditionalWorked ? null : "traditional-no-movement"
          });
        } else {
          attemptsWithoutMovement += 1;
          setBackfillStatus("running", {
            scrollMethod: "anchor",
            lastScrollAttemptAt: scrollAttemptAt,
            lastScrollWorked: false,
            lastStopReason: "no-scroll-container"
          });
        }

        if (traditionalWorked) {
          const traditionalViewport = getBackfillViewportMetrics(anchorBeforeMetrics && anchorBeforeMetrics.messageId);
          const traditionalProgress = recordBackfillProgress(traditionalViewport, {
            anchorDelta: after && before ? after.scrollTop - before.scrollTop : null
          });
          if (traditionalProgress.oscillationDetected) {
            setBackfillStatus("failed", {
              finishedAt: new Date().toISOString(),
              lastError: "oscillation-detected",
              lastStopReason: "oscillation-detected",
              completionConfidence: "oscillation"
            });
            return;
          }
          if (traditionalProgress.noProgressRoundCount >= noProgressRoundLimit) {
            setBackfillStatus("failed", {
              finishedAt: new Date().toISOString(),
              lastError: "stalled-no-progress",
              lastStopReason: "stalled-no-progress",
              completionConfidence: "stalled"
            });
            return;
          }
          continue;
        }

        scrollAttemptAt = new Date().toISOString();
        const anchorCandidates = getBackfillMessageAnchorCandidates();
        const firstVisibleRegistryIndexBefore = getRegistryOrderIndex(anchorBeforeMetrics && anchorBeforeMetrics.messageId);
        const anchorResult = await tryBackfillAnchorCandidates(anchorCandidates, {
          runId,
          conversationId,
          firstVisibleIdBefore: anchorBeforeMetrics ? anchorBeforeMetrics.messageId : null,
          firstVisibleRegistryIndexBefore,
          currentFirstVisibleRegistryIndex: firstVisibleRegistryIndexBefore,
          registryCountBefore: metrics.registryCount,
          visibleDomUserMessageCountBefore: currentViewport.visibleDomUserMessageCount,
          messageHashBefore: currentViewport.messageHash
        });

        if (anchorResult.cancelled) {
          if (state.backfill && state.backfill.runId === runId) {
            setBackfillStatus("cancelled", {
              cancelRequested: true,
              finishedAt: new Date().toISOString(),
              lastError: anchorResult.cancelReason || "cancelled",
              lastStopReason: anchorResult.cancelReason || "cancelled"
            });
          }
          return;
        }

        let activeAnchorResult = anchorResult;
        let relaxedResult = null;
        let wheelResult = null;
        if (!activeAnchorResult.worked && !activeAnchorResult.safetyStop) {
          relaxedResult = await tryBackfillRelaxedAnchorCandidates(anchorCandidates, {
            runId,
            conversationId,
            firstVisibleIdBefore: anchorBeforeMetrics ? anchorBeforeMetrics.messageId : null,
            firstVisibleRegistryIndexBefore,
            currentFirstVisibleRegistryIndex: firstVisibleRegistryIndexBefore,
            registryCountBefore: metrics.registryCount,
            visibleDomUserMessageCountBefore: currentViewport.visibleDomUserMessageCount,
            messageHashBefore: currentViewport.messageHash,
            triedIds: anchorResult.triedIds || []
          });
          if (relaxedResult.cancelled) {
            if (state.backfill && state.backfill.runId === runId) {
              setBackfillStatus("cancelled", {
                cancelRequested: true,
                finishedAt: new Date().toISOString(),
                lastError: relaxedResult.cancelReason || "cancelled",
                lastStopReason: relaxedResult.cancelReason || "cancelled"
              });
            }
            return;
          }
          if (relaxedResult.worked) activeAnchorResult = relaxedResult;
          if (relaxedResult.safetyStop) activeAnchorResult = relaxedResult;
        }

        if (!activeAnchorResult.worked && !activeAnchorResult.safetyStop && BACKFILL_ENABLE_WHEEL_FALLBACK) {
          wheelResult = await tryBackfillWheelPageFallback({
            runId,
            conversationId,
            scrollTarget,
            firstVisibleIdBefore: anchorBeforeMetrics ? anchorBeforeMetrics.messageId : null,
            firstVisibleRegistryIndexBefore,
            registryCountBefore: metrics.registryCount
          });
          if (wheelResult.cancelled) {
            if (state.backfill && state.backfill.runId === runId) {
              setBackfillStatus("cancelled", {
                cancelRequested: true,
                finishedAt: new Date().toISOString(),
                lastError: wheelResult.cancelReason || "cancelled",
                lastStopReason: wheelResult.cancelReason || "cancelled"
              });
            }
            return;
          }
        } else if (!activeAnchorResult.worked && !activeAnchorResult.safetyStop) {
          setBackfillStatus("running", {
            wheelFallbackEnabled: false,
            wheelFallbackAttempted: false,
            wheelFallbackSkippedReason: "disabled-for-stability"
          });
        }

        const fallbackWorked = !!(activeAnchorResult.worked || (wheelResult && wheelResult.worked));
        const totalScanCount = Number(anchorResult.scanCount || 0) +
          Number(relaxedResult && relaxedResult.scanCount || 0) +
          Number(wheelResult && wheelResult.scanCount || 0);
        const totalScannedVisibleCount = Number(anchorResult.scannedVisibleCount || 0) +
          Number(relaxedResult && relaxedResult.scannedVisibleCount || 0) +
          Number(wheelResult && wheelResult.scannedVisibleCount || 0);
        const latestRegistryCount = wheelResult ? wheelResult.registryCount :
          relaxedResult ? relaxedResult.registryCount : anchorResult.registryCount;
        const finalAnchorReason = activeAnchorResult.safetyStop ? "unsafe-reverse-anchor-prevented" : fallbackWorked ? null :
          wheelResult ? "all-anchor-and-wheel-no-movement" : (relaxedResult && relaxedResult.failureReason) || anchorResult.failureReason || "all-anchor-scroll-no-movement";
        attemptsWithoutMovement = fallbackWorked ? 0 : attemptsWithoutMovement + 1;
        const fallbackProgress = recordBackfillProgress(getBackfillViewportMetrics(activeAnchorResult.workedId || "fallback"), {
          anchorDelta: activeAnchorResult.anchorBefore && activeAnchorResult.anchorAfter ?
            activeAnchorResult.anchorAfter.top - activeAnchorResult.anchorBefore.top : null
        });
        const anchorBatchCount = Number(state.backfill.batchCount || 0) + totalScanCount;
        const anchorScannedVisibleCount = Number(state.backfill.scannedVisibleCount || 0) + totalScannedVisibleCount;

        setBackfillStatus(fallbackWorked ? "running" : "failed", {
          batchCount: anchorBatchCount,
          scannedVisibleCount: anchorScannedVisibleCount,
          registryCount: latestRegistryCount,
          finishedAt: fallbackWorked ? null : new Date().toISOString(),
          lastError: finalAnchorReason,
          lastStopReason: finalAnchorReason,
          scrollMethod: scrollTarget ? "mixed" : "anchor",
          scrollTargetDescriptor: scrollTarget ? describeBackfillScrollTarget(scrollTarget) : null,
          scrollTopBefore: before ? before.scrollTop : null,
          scrollTopAfter: after ? after.scrollTop : null,
          scrollDelta: before && after ? after.scrollTop - before.scrollTop : null,
          scrollHeight: after ? after.scrollHeight : before ? before.scrollHeight : null,
          clientHeight: after ? after.clientHeight : before ? before.clientHeight : null,
          windowScrollYBefore: before ? before.windowScrollY : window.scrollY || 0,
          windowScrollYAfter: after ? after.windowScrollY : window.scrollY || 0,
          lastScrollAttemptAt: scrollAttemptAt,
          lastScrollWorked: fallbackWorked,
          anchorMessageIdBefore: activeAnchorResult.anchorBefore ? activeAnchorResult.anchorBefore.messageId : null,
          anchorMessageIdAfter: activeAnchorResult.anchorAfter ? activeAnchorResult.anchorAfter.messageId : null,
          anchorTopBefore: activeAnchorResult.anchorBefore ? activeAnchorResult.anchorBefore.top : null,
          anchorTopAfter: activeAnchorResult.anchorAfter ? activeAnchorResult.anchorAfter.top : null,
          anchorBottomBefore: activeAnchorResult.anchorBefore ? activeAnchorResult.anchorBefore.bottom : null,
          anchorBottomAfter: activeAnchorResult.anchorAfter ? activeAnchorResult.anchorAfter.bottom : null,
          anchorDelta: activeAnchorResult.anchorBefore && activeAnchorResult.anchorAfter ? activeAnchorResult.anchorAfter.top - activeAnchorResult.anchorBefore.top : null,
          firstVisibleDomMessageIdBefore: anchorBeforeMetrics ? anchorBeforeMetrics.messageId : null,
          firstVisibleDomMessageIdAfter: activeAnchorResult.firstVisibleAfter ? activeAnchorResult.firstVisibleAfter.messageId : null,
          firstRegistryMessageIdAtBackfill: firstRegistryMessageId,
          anchorScrollAttempted: true,
          anchorScrollWorked: !!activeAnchorResult.worked,
          anchorCandidateCount: anchorResult.candidateCount,
          anchorCandidateTriedCount: anchorResult.triedCount,
          anchorCandidateIds: anchorResult.candidateIds,
          anchorRawCandidateCount: anchorResult.rawCandidateCount,
          anchorRankedCandidateCount: anchorResult.rankedCandidateCount,
          anchorRelaxedCandidateCount: relaxedResult ? relaxedResult.relaxedCandidateCount : 0,
          anchorRawCandidateIds: anchorResult.rawCandidateIds,
          anchorRankedCandidateIds: anchorResult.rankedCandidateIds,
          anchorRelaxedCandidateIds: relaxedResult ? relaxedResult.relaxedCandidateIds : [],
          anchorRejectedCandidateCount: anchorResult.rejectedCandidateCount,
          anchorRejectedReasons: anchorResult.rejectedReasons,
          anchorTriedIds: anchorResult.triedIds,
          relaxedAnchorTriedCount: relaxedResult ? relaxedResult.triedCount : 0,
          relaxedAnchorTriedIds: relaxedResult ? relaxedResult.triedIds : [],
          relaxedAnchorWorkedId: relaxedResult ? relaxedResult.workedId : null,
          anchorWorkedId: activeAnchorResult.workedId,
          anchorFailureReason: finalAnchorReason,
          anchorStrategy: activeAnchorResult === anchorResult ? "registry-nearest-multi" : wheelResult && wheelResult.worked ? "wheel-page-fallback" : "relaxed-dom-order",
          anchorRegistryIndexBefore: activeAnchorResult.anchorRegistryIndexBefore,
          anchorRegistryIndexAfter: activeAnchorResult.anchorRegistryIndexAfter,
          firstVisibleRegistryIndexBefore,
          firstVisibleRegistryIndexAfter: activeAnchorResult.firstVisibleRegistryIndexAfter,
          wheelFallbackAttempted: !!wheelResult,
          wheelFallbackAttemptCount: wheelResult ? wheelResult.attemptCount : 0,
          wheelFallbackWorked: !!(wheelResult && wheelResult.worked),
          wheelFallbackLastDeltaY: wheelResult ? wheelResult.lastDeltaY : null,
          wheelFallbackTargetDescriptor: wheelResult ? wheelResult.targetDescriptor : null,
          pageUpFallbackAttempted: !!(wheelResult && wheelResult.pageUpAttempted),
          pageUpFallbackWorked: !!(wheelResult && wheelResult.pageUpWorked),
          fallbackProgressReason: wheelResult ? wheelResult.progressReason : fallbackWorked ? "anchor-progress" : finalAnchorReason,
          wheelFallbackSignatureBefore: wheelResult ? wheelResult.signatureBefore : null,
          wheelFallbackSignatureAfter: wheelResult ? wheelResult.signatureAfter : null,
          reverseMovementDetected: !!activeAnchorResult.safetyStop || !!state.backfill.reverseMovementDetected,
          reverseMovementStoppedImmediately: !!activeAnchorResult.safetyStop || !!state.backfill.reverseMovementStoppedImmediately,
          completionConfidence: activeAnchorResult.safetyStop ? "safety-stop" : fallbackWorked ? null : wheelResult ? "anchor-wheel-stalled" : "anchor-stalled"
        });

        if (fallbackProgress.oscillationDetected) {
          setBackfillStatus("failed", {
            finishedAt: new Date().toISOString(),
            lastError: "oscillation-detected",
            lastStopReason: "oscillation-detected",
            completionConfidence: "oscillation"
          });
          return;
        }
        if (activeAnchorResult.safetyStop) {
          appendBackfillTraceEvent("safety-stop", "run-failed", {
            beforeIndex: firstVisibleRegistryIndexBefore,
            afterIndex: activeAnchorResult.firstVisibleRegistryIndexAfter,
            result: "failed",
            reason: "unsafe-reverse-anchor-prevented"
          });
          return;
        }
        if (!fallbackWorked) return;
        if (fallbackProgress.noProgressRoundCount >= noProgressRoundLimit) {
          setBackfillStatus("failed", {
            finishedAt: new Date().toISOString(),
            lastError: "stalled-no-progress",
            lastStopReason: "stalled-no-progress",
            completionConfidence: "stalled"
          });
          return;
        }
      }
    } catch (error) {
      if (state.backfill && state.backfill.runId === runId) {
        setBackfillStatus("failed", {
          finishedAt: new Date().toISOString(),
          lastError: error && error.message ? error.message : "backfill-error",
          lastStopReason: error && error.message ? error.message : "backfill-error"
        });
      }
    }
  }

  function t(key, params) {
    const lang = state.preferences && state.preferences.uiLanguage === "en" ? "en" : "zh";
    let value = I18N[lang] && I18N[lang][key];
    if (value == null) value = I18N.zh[key];
    if (value == null) value = key;
    if (params) {
      Object.keys(params).forEach((name) => {
        value = String(value).replace(new RegExp("\\{" + name + "\\}", "g"), params[name]);
      });
    }
    return value;
  }

  function tabLabel(key) {
    return t(key);
  }

  function timeModeLabel(key) {
    if (key === "month") return t("month");
    if (key === "week") return t("week");
    return t("day");
  }

  function getTimeSearchPlaceholder() {
    if (state.timeFolderMode === "week") return t("timeSearchPlaceholderWeek");
    if (state.timeFolderMode === "day") return t("timeSearchPlaceholderDay");
    return t("timeSearchPlaceholderMonth");
  }

  function debugLog(level, message, extra) {
    const entry = {
      time: new Date().toISOString(),
      level,
      message,
      extra: extra || null
    };

    DEBUG_STATE.logs.push(entry);
    if (DEBUG_STATE.logs.length > 100) DEBUG_STATE.logs.shift();

    const prefix = "[GPT Prompt Navigator]";
    if (level === "error") console.error(prefix, message, extra || "");
    else if (level === "warn") console.warn(prefix, message, extra || "");
    else if (level === "info") console.info(prefix, message, extra || "");
    else console.log(prefix, message, extra || "");

    scheduleDebugPanelRefresh();
  }

  function safeRun(label, fn) {
    try {
      return fn();
    } catch (error) {
      DEBUG_STATE.lastError = {
        label,
        message: error && error.message ? error.message : String(error),
        stack: error && error.stack ? String(error.stack).slice(0, 1200) : null,
        time: new Date().toISOString()
      };
      debugLog("error", label, DEBUG_STATE.lastError);
      return null;
    }
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value));
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function serializeRect(rect) {
    if (!rect) return null;
    return {
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  function describeScrollContainer(node) {
    if (!node) return "";
    if (node === document.scrollingElement) return "document.scrollingElement";
    if (node === document.documentElement) return "document.documentElement";
    if (node === document.body) return "document.body";
    return describeThemeSourceElement(node) || (node.tagName ? node.tagName.toLowerCase() : "unknown");
  }

  function updateJumpDiagnostics(patch) {
    state.lastJumpDiagnostics = { ...(state.lastJumpDiagnostics || {}), ...(patch || {}) };
    scheduleDebugPanelRefresh();
    return state.lastJumpDiagnostics;
  }

  function buildJumpDiagnosticsStart(messageId, options) {
    const registryMessage = state.messageRegistry && state.messageRegistry.get(messageId);
    const stateMessage = state.userMessages.find((item) => item.messageId === messageId || item.id === messageId);
    const visibleIndexes = getVisibleMessageOrderIndexes();
    const registryIndex = state.messageOrder.indexOf(messageId);
    const target = document.querySelector(`[data-message-id="${cssEscape(messageId)}"]`);
    return updateJumpDiagnostics({
      clickedMessageId: messageId,
      clickedMessageIndex: stateMessage ? stateMessage.index : registryIndex + 1,
      clickedAt: new Date().toISOString(),
      currentConversationId: state.currentConversationId,
      getConversationIdAtClick: getConversationId(),
      existsInRegistry: !!registryMessage,
      existsInStateUserMessages: !!stateMessage,
      existsInCurrentDOM: !!(target && target.isConnected),
      stateElementExists: !!(stateMessage && stateMessage.element),
      stateElementIsConnected: !!(stateMessage && stateMessage.element && stateMessage.element.isConnected),
      domElementFoundByMessageId: !!(target && target.isConnected),
      domElementSelectorUsed: target ? '[data-message-id="' + messageId + '"]' : null,
      registryIndex,
      visibleFirstRegistryIndex: visibleIndexes.length ? Math.min(...visibleIndexes) : -1,
      visibleLastRegistryIndex: visibleIndexes.length ? Math.max(...visibleIndexes) : -1,
      visibleDomUserMessageCount: document.querySelectorAll(USER_SELECTOR).length,
      registryMessageCount: state.messageRegistry ? state.messageRegistry.size : 0,
      targetIsCached: !!(registryMessage && registryMessage.cached),
      targetIsOffscreen: !!(registryMessage && registryMessage.offscreen),
      targetHasCapturedTime: !!(registryMessage && (registryMessage.capturedAtRaw || registryMessage.timeMeta && registryMessage.timeMeta.capturedAtRaw)),
      targetCapturedTimeRaw: registryMessage ? (registryMessage.capturedAtRaw || registryMessage.timeMeta && registryMessage.timeMeta.capturedAtRaw || null) : null,
      scrollAttempted: false,
      scrollMethod: null,
      scrollStartedAt: null,
      scrollVerifiedAt: null,
      targetRectBefore: null,
      targetRectAfter: null,
      targetVisibleAfterScroll: false,
      jumpCorrectionScheduled: false,
      jumpCorrectionCancelled: false,
      lazyJumpStarted: !!(options && options.fromLazyJump),
      lazyJumpDirection: null,
      lazyJumpAttemptCount: 0,
      lazyJumpFoundTarget: false,
      failureReason: null,
      success: false
    });
  }

  function recordJumpFailure(reason) {
    DEBUG_STATE.jumpFailureCount += 1;
    DEBUG_STATE.lastJumpFailureReason = reason;
    DEBUG_STATE.lastJumpFailureAt = new Date().toISOString();
    updateJumpDiagnostics({ failureReason: reason, success: false });
  }

  function recordJumpSuccess() {
    DEBUG_STATE.lastJumpSuccessAt = new Date().toISOString();
    DEBUG_STATE.lastJumpFailureReason = null;
    updateJumpDiagnostics({ success: true, failureReason: null });
  }

  function findMessageElementById(messageId) {
    if (!messageId) {
      DEBUG_STATE.lastScrollTargetMessageId = null;
      DEBUG_STATE.lastScrollTargetFound = false;
      DEBUG_STATE.lastScrollTargetSource = "not-found";
      return null;
    }

    const escaped = window.CSS && typeof window.CSS.escape === "function" ? window.CSS.escape(String(messageId)) : cssEscape(messageId);
    const target = document.querySelector(`[data-message-id="${escaped}"]`);
    if (target && target.isConnected && !isInsidePanel(target)) {
      DEBUG_STATE.lastScrollTargetMessageId = messageId;
      DEBUG_STATE.lastScrollTargetFound = true;
      DEBUG_STATE.lastScrollTargetSource = "querySelector";
      updateJumpDiagnostics({
        existsInCurrentDOM: true,
        domElementFoundByMessageId: true,
        domElementSelectorUsed: `[data-message-id="${messageId}"]`
      });
      return target;
    }

    const message = state.userMessages.find((item) => item.messageId === messageId || item.id === messageId);
    if (message && message.element && message.element.isConnected && !isInsidePanel(message.element) && message.element.getAttribute("data-message-id") === messageId) {
      DEBUG_STATE.lastScrollTargetMessageId = messageId;
      DEBUG_STATE.lastScrollTargetFound = true;
      DEBUG_STATE.lastScrollTargetSource = "state.userMessages-connected";
      return message.element;
    }

    DEBUG_STATE.lastScrollTargetMessageId = messageId;
    DEBUG_STATE.lastScrollTargetFound = false;
    DEBUG_STATE.lastScrollTargetSource = "not-found";
    DEBUG_STATE.lastJumpFailureReason = "target-not-in-dom";
    updateJumpDiagnostics({
      existsInCurrentDOM: false,
      domElementFoundByMessageId: false,
      stateElementExists: !!(message && message.element),
      stateElementIsConnected: !!(message && message.element && message.element.isConnected)
    });
    return null;
  }

  function isElementNearViewportCenter(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const viewportCenter = window.innerHeight / 2;
    const elementCenter = rect.top + rect.height / 2;
    return Math.abs(elementCenter - viewportCenter) < Math.min(180, window.innerHeight * 0.25);
  }

  function getElementDistanceFromViewportCenter(element) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return Math.round(Math.abs((rect.top + rect.height / 2) - window.innerHeight / 2));
  }

  function shouldIgnoreItemClick(event) {
    const target = event && event.target;
    DEBUG_STATE.lastItemClickTargetTag = target && target.tagName ? target.tagName : null;
    if (!target || typeof target.closest !== "function") return false;

    return !!target.closest([
      "button",
      "input",
      "select",
      "textarea",
      "a",
      "[role='button']",
      "[data-no-jump='true']",
      ".gpn-actions",
      ".gpn-expand-btn",
      ".gpn-copy-btn",
      ".gpn-star-btn",
      ".gpn-tag-btn",
      ".gpn-folder-header",
      ".gpn-folder-child-header",
      ".gpn-time-mode-btn",
      ".gpn-tab",
      ".gpn-chip",
      ".gpn-tag-chip",
      ".gpn-settings-panel",
      ".gpn-help-panel",
      ".gpn-debug-panel"
    ].join(","));
  }

  function toggleMessageExpandedById(messageId) {
    if (!messageId) return;

    const willExpand = !state.expandedMessageIds.has(messageId);

    if (willExpand) {
      state.expandedMessageIds.add(messageId);
    } else {
      state.expandedMessageIds.delete(messageId);
    }

    DEBUG_STATE.lastExpandedMessageId = messageId;
    DEBUG_STATE.lastExpandedAction = willExpand ? "expand" : "collapse";

    debugLog("info", "message expand toggled", {
      messageId,
      expanded: willExpand
    });

    renderNav("message-expand-toggle", true);
  }

  function toggleMessageExpandedLocal(message, item, textNode, expandButton) {
    const messageId = message && message.messageId;
    if (!messageId) return;

    const willExpand = !state.expandedMessageIds.has(messageId);

    if (willExpand) {
      state.expandedMessageIds.add(messageId);
    } else {
      state.expandedMessageIds.delete(messageId);
    }

    textNode.textContent = willExpand ? message.displayFullText : message.displayPreviewMultiline;
    textNode.classList.toggle("gpn-text-expanded", willExpand);
    expandButton.textContent = willExpand ? t("collapse") : t("expand");

    DEBUG_STATE.lastExpandedMessageId = messageId;
    DEBUG_STATE.lastExpandedAction = willExpand ? "expand" : "collapse";
    DEBUG_STATE.lastExpandWasLocalUpdate = true;

    debugLog("info", "message expand toggled local", {
      messageId,
      expanded: willExpand
    });
  }

  function setupJumpZoneNavigation(jumpZone, item, getMessageId) {
    jumpZone.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const targetMessageId = getMessageId();
      if (!targetMessageId) {
        showInlineNotice(t("missingMessage"));
        return;
      }

      DEBUG_STATE.lastJumpZoneClickedMessageId = targetMessageId;
      DEBUG_STATE.lastClickedNavMessageId = targetMessageId;
      DEBUG_STATE.lastClickedNavIndex = item.dataset.navIndex || null;

      debugLog("info", "jump zone clicked", { messageId: targetMessageId });
      scrollToMessageById(targetMessageId);
    });

    jumpZone.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();

      const targetMessageId = getMessageId();
      if (!targetMessageId) {
        showInlineNotice(t("missingMessage"));
        return;
      }

      DEBUG_STATE.lastJumpZoneClickedMessageId = targetMessageId;
      DEBUG_STATE.lastClickedNavMessageId = targetMessageId;
      DEBUG_STATE.lastClickedNavIndex = item.dataset.navIndex || null;

      debugLog("info", "jump zone clicked", { messageId: targetMessageId, source: "keyboard" });
      scrollToMessageById(targetMessageId);
    });
  }

  function getConversationIdentity() {
    const path = location.pathname || "/";
    const chatMatch = path.match(/\/c\/([^/?#]+)/);
    const contextMatch = path.match(/\/g\/([^/?#]+)(?:\/(?:project\/)?([^/?#]+))?/);
    const sanitize = (value) => String(value || "")
      .replace(/^\/+|\/+$/g, "")
      .replace(/[^\w:-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 180);

    let rawConversationId = null;
    let contextPrefix = "chat";
    let normalizedKey = "";
    let source = "";
    let fallbackUsed = false;
    let isRealConversation = false;
    let isDraftConversation = false;

    if (contextMatch && contextMatch[1]) {
      contextPrefix = "g:" + sanitize(contextMatch[1]);
      if (contextMatch[2] && contextMatch[2] !== "c") contextPrefix += ":ctx:" + sanitize(contextMatch[2]);
    }

    if (chatMatch && chatMatch[1]) {
      rawConversationId = sanitize(chatMatch[1]);
      normalizedKey = (contextPrefix === "chat" ? "chat:" : contextPrefix + ":chat:") + rawConversationId;
      source = "url-chat-id";
      isRealConversation = true;
    } else {
      const hash = (location.hash || "").replace(/^#/, "");
      const stableHash = /^(settings|pricing|profile)(\/|$)/i.test(hash) ? "" : hash;
      const overlayRoute = /^(settings|pricing|profile)(\/|$)/i.test(hash) || /pricing|settings|profile|account/i.test(path);
      const looksLikeChatHome = /^\/?($|g\/[^/]+\/?$|g\/[^/]+\/project\/[^/]+\/?$)/.test(path.replace(/^\/+/, ""));
      if (!overlayRoute && looksLikeChatHome) {
        const draftTabId = sanitize(getTabInstanceId());
        normalizedKey = "draft:" + draftTabId;
        source = "draft-tab-session";
        isDraftConversation = true;
        fallbackUsed = false;
      } else {
        const rawFallback = [path, stableHash].filter(Boolean).join("#");
        normalizedKey = "fallback:" + sanitize(rawFallback || "root");
        fallbackUsed = true;
        source = "fallback-path-hash";
      }
    }

    const identity = {
      key: normalizedKey,
      rawConversationId,
      contextPrefix,
      isRealConversation,
      isDraftConversation,
      source
    };
    DEBUG_STATE.rawConversationIdFromUrl = rawConversationId;
    DEBUG_STATE.conversationContextPrefix = contextPrefix;
    DEBUG_STATE.normalizedConversationKey = normalizedKey;
    DEBUG_STATE.conversationIdFallbackUsed = fallbackUsed;
    DEBUG_STATE.getConversationIdSource = source;
    DEBUG_STATE.conversationIdentity = identity;
    DEBUG_STATE.isRealConversation = isRealConversation;
    DEBUG_STATE.isDraftConversation = isDraftConversation;
    DEBUG_STATE.draftConversationKey = isDraftConversation ? normalizedKey : null;
    DEBUG_STATE.realConversationKey = isRealConversation ? normalizedKey : null;
    return identity;
  }

  function getConversationId() {
    const identity = getConversationIdentity();
    return identity.key;
  }

  function isDraftConversationKey(key) {
    return /^draft:/.test(String(key || ""));
  }

  function getDraftRegistryStorageKey() {
    return STORAGE_PREFIX + "-draft-registry:" + getTabInstanceId();
  }

  function getDraftCapturedTimesStorageKey() {
    return STORAGE_PREFIX + "-draft-captured-times:" + getTabInstanceId();
  }

  function getDraftViewStateStorageKey() {
    return STORAGE_PREFIX + "-draft-view-state:" + getTabInstanceId();
  }

  function updateDraftStorageDebug() {
    DEBUG_STATE.draftRegistryKey = getDraftRegistryStorageKey();
    DEBUG_STATE.draftCapturedTimesKey = getDraftCapturedTimesStorageKey();
    DEBUG_STATE.draftViewStateKey = getDraftViewStateStorageKey();
    const draftRegistry = storageGet(DEBUG_STATE.draftRegistryKey, null);
    const draftTimes = storageGet(DEBUG_STATE.draftCapturedTimesKey, null);
    DEBUG_STATE.draftRegistryMessageCount = draftRegistry && Array.isArray(draftRegistry.messages) ? draftRegistry.messages.length : 0;
    DEBUG_STATE.draftCapturedTimeCount = draftTimes && typeof draftTimes === "object" ? Object.keys(draftTimes.capturedTimes || draftTimes || {}).length : 0;
  }

  function getTabInstanceId() {
    const key = STORAGE_PREFIX + "-tab-instance-id";
    try {
      const existing = sessionStorage.getItem(key);
      if (existing) return existing;
      const id = window.crypto && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "tab:" + Date.now() + ":" + Math.random().toString(36).slice(2);
      sessionStorage.setItem(key, id);
      return id;
    } catch (error) {
      return "tab:" + Date.now() + ":" + Math.random().toString(36).slice(2);
    }
  }

  function storageGet(key, fallback) {
    try {
      if (typeof GM_getValue === "function") return GM_getValue(key, fallback);
    } catch (error) {
      debugLog("warn", "GM_getValue failed, fallback localStorage", { key, message: error.message });
    }

    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (error) {
      debugLog("warn", "localStorage get failed", { key, message: error.message });
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      if (typeof GM_setValue === "function") {
        GM_setValue(key, value);
        return;
      }
    } catch (error) {
      debugLog("warn", "GM_setValue failed, fallback localStorage", { key, message: error.message });
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      debugLog("warn", "localStorage set failed", { key, message: error.message });
    }
  }

  function getPanelSizeKey() {
    return STORAGE_PREFIX + "-panel-size";
  }

  function getCapturedTimeStorageKey() {
    if (isDraftConversationKey(state.currentConversationId)) return getDraftCapturedTimesStorageKey();
    return STORAGE_PREFIX + "-captured-times:" + state.currentConversationId;
  }

  function getBookmarksStorageKey() {
    return STORAGE_PREFIX + "-bookmarks:" + state.currentConversationId;
  }

  function getViewStateStorageKey() {
    if (isDraftConversationKey(state.currentConversationId)) return getDraftViewStateStorageKey();
    return STORAGE_PREFIX + "-view-state:" + state.currentConversationId;
  }

  function getTagsStorageKey() {
    return STORAGE_PREFIX + "-tags:" + state.currentConversationId;
  }

  function getGlobalPreferencesStorageKey() {
    return STORAGE_PREFIX + "-preferences";
  }

  function getLegacyConversationPreferencesStorageKey() {
    return STORAGE_PREFIX + "-preferences:" + state.currentConversationId;
  }

  function getPreferencesStorageKey() {
    return getGlobalPreferencesStorageKey();
  }

  function getStorageKeysSummary() {
    return [
      STORAGE_PREFIX + "-bookmarks:" + state.currentConversationId,
      STORAGE_PREFIX + "-captured-times:" + state.currentConversationId,
      STORAGE_PREFIX + "-view-state:" + state.currentConversationId,
      STORAGE_PREFIX + "-tags:" + state.currentConversationId,
      getMessageRegistryStorageKey(),
      getGlobalPreferencesStorageKey(),
      getLegacyConversationPreferencesStorageKey(),
      STORAGE_PREFIX + "-panel-size"
    ];
  }

  function normalizeBooleanMap(value, defaults, order) {
    const out = {};
    order.forEach((key) => {
      out[key] = value && typeof value[key] === "boolean" ? value[key] : defaults[key];
    });

    if (!order.some((key) => out[key])) out[order[0]] = true;
    return out;
  }

  function firstVisibleKey(map, order) {
    return order.find((key) => map && map[key]) || order[0];
  }

  function hiddenKeys(map, order) {
    return order.filter((key) => !map[key]);
  }

  function normalizePreferences(value) {
    const merged = { ...DEFAULT_PREFERENCES, ...(value || {}) };
    merged.visibleTabs = normalizeBooleanMap(merged.visibleTabs, DEFAULT_PREFERENCES.visibleTabs, TAB_ORDER);
    merged.visibleTimeModes = normalizeBooleanMap(merged.visibleTimeModes, DEFAULT_PREFERENCES.visibleTimeModes, TIME_MODE_ORDER);

    if (!TAB_ORDER.includes(merged.defaultTab) || !merged.visibleTabs[merged.defaultTab]) {
      merged.defaultTab = firstVisibleKey(merged.visibleTabs, TAB_ORDER);
    }

    if (!TIME_MODE_ORDER.includes(merged.defaultTimeFolderMode) || !merged.visibleTimeModes[merged.defaultTimeFolderMode]) {
      merged.defaultTimeFolderMode = firstVisibleKey(merged.visibleTimeModes, TIME_MODE_ORDER);
    }

    if (!["auto-inverse", "light", "dark", "auto-same"].includes(merged.themeMode)) merged.themeMode = "auto-inverse";
    if (!["zh", "en"].includes(merged.uiLanguage)) merged.uiLanguage = "zh";

    merged.maxPreviewLines = Math.max(1, Math.min(8, Number(merged.maxPreviewLines) || DEFAULT_PREFERENCES.maxPreviewLines));
    merged.maxPreviewLength = Math.max(40, Math.min(500, Number(merged.maxPreviewLength) || DEFAULT_PREFERENCES.maxPreviewLength));
    return merged;
  }

  function applyVisibilityFallbacks(reason) {
    let changed = false;

    if (!state.preferences.visibleTabs[state.activeTab]) {
      state.activeTab = firstVisibleKey(state.preferences.visibleTabs, TAB_ORDER);
      DEBUG_STATE.activeTabFallbackReason = reason || "active-tab-hidden";
      changed = true;
    }

    if (!state.preferences.visibleTabs[state.preferences.defaultTab]) {
      state.preferences.defaultTab = firstVisibleKey(state.preferences.visibleTabs, TAB_ORDER);
      DEBUG_STATE.activeTabFallbackReason = reason || "default-tab-hidden";
      changed = true;
    }

    if (!state.preferences.visibleTimeModes[state.timeFolderMode]) {
      state.timeFolderMode = firstVisibleKey(state.preferences.visibleTimeModes, TIME_MODE_ORDER);
      DEBUG_STATE.timeModeFallbackReason = reason || "time-mode-hidden";
      changed = true;
    }

    if (!state.preferences.visibleTimeModes[state.preferences.defaultTimeFolderMode]) {
      state.preferences.defaultTimeFolderMode = firstVisibleKey(state.preferences.visibleTimeModes, TIME_MODE_ORDER);
      DEBUG_STATE.timeModeFallbackReason = reason || "default-time-mode-hidden";
      changed = true;
    }

    if (changed) {
      savePreferencesForCurrentConversation();
      saveViewStateForCurrentConversation();
    }

    DEBUG_STATE.visibleTabs = { ...state.preferences.visibleTabs };
    DEBUG_STATE.hiddenTabs = hiddenKeys(state.preferences.visibleTabs, TAB_ORDER);
    DEBUG_STATE.visibleTimeModes = { ...state.preferences.visibleTimeModes };
    DEBUG_STATE.hiddenTimeModes = hiddenKeys(state.preferences.visibleTimeModes, TIME_MODE_ORDER);
  }

  function loadPreferencesForCurrentConversation() {
    const globalKey = getGlobalPreferencesStorageKey();
    const legacyKey = getLegacyConversationPreferencesStorageKey();
    const missing = { __gpnMissing: true };
    let saved = storageGet(globalKey, missing);
    let source = "global";

    DEBUG_STATE.preferencesScope = "global";
    DEBUG_STATE.globalPreferencesStorageKey = globalKey;
    DEBUG_STATE.legacyConversationPreferencesKey = legacyKey;
    DEBUG_STATE.loadedGlobalPreferences = !(saved && saved.__gpnMissing);
    DEBUG_STATE.migratedPreferencesFromConversationKey = false;

    if (saved && saved.__gpnMissing) {
      const legacySaved = storageGet(legacyKey, missing);
      if (legacySaved && !legacySaved.__gpnMissing) {
        saved = legacySaved;
        source = "legacy-conversation-migrated";
        DEBUG_STATE.migratedPreferencesFromConversationKey = true;
        storageSet(globalKey, normalizePreferences(legacySaved));
      } else {
        saved = DEFAULT_PREFERENCES;
        source = "default";
      }
    }

    state.preferences = normalizePreferences(saved);
    DEBUG_STATE.preferences = { ...state.preferences };
    DEBUG_STATE.preferencesStorageKey = getPreferencesStorageKey();
    DEBUG_STATE.loadedGlobalPreferences = source === "global";
    DEBUG_STATE.visibleTabsSource = source;
    DEBUG_STATE.visibleTimeModesSource = source;
    DEBUG_STATE.themeModeSource = source;
    DEBUG_STATE.uiLanguageSource = source;
    DEBUG_STATE.themeMode = state.preferences.themeMode;
    DEBUG_STATE.uiLanguage = state.preferences.uiLanguage;
    applyVisibilityFallbacks("load-preferences");
  }

  function savePreferencesForCurrentConversation() {
    state.preferences = normalizePreferences(state.preferences);
    storageSet(getPreferencesStorageKey(), state.preferences);
    DEBUG_STATE.preferences = { ...state.preferences };
    DEBUG_STATE.preferencesStorageKey = getPreferencesStorageKey();
    DEBUG_STATE.preferencesScope = "global";
    DEBUG_STATE.globalPreferencesStorageKey = getGlobalPreferencesStorageKey();
    DEBUG_STATE.legacyConversationPreferencesKey = getLegacyConversationPreferencesStorageKey();
    DEBUG_STATE.visibleTabsSource = "global";
    DEBUG_STATE.visibleTimeModesSource = "global";
    DEBUG_STATE.themeModeSource = "global";
    DEBUG_STATE.uiLanguageSource = "global";
    DEBUG_STATE.themeMode = state.preferences.themeMode;
    DEBUG_STATE.uiLanguage = state.preferences.uiLanguage;
    applyVisibilityFallbacks("save-preferences");
  }

  function getMessageRegistryStorageKey() {
    if (isDraftConversationKey(state.currentConversationId)) return getDraftRegistryStorageKey();
    return STORAGE_PREFIX + "-message-registry:" + state.currentConversationId;
  }

  function getMessageRegistryStorageKeyForConversation(key) {
    return STORAGE_PREFIX + "-message-registry:" + key;
  }

  function getCapturedTimeStorageKeyForConversation(key) {
    return STORAGE_PREFIX + "-captured-times:" + key;
  }

  function migrateDraftSessionToConversation(draftKey, realConversationKey) {
    if (!draftKey || !realConversationKey || !isDraftConversationKey(draftKey)) {
      DEBUG_STATE.draftMigrationSkippedReason = "invalid-draft-or-real-key";
      DEBUG_STATE.draftMigrationSuccess = false;
      return { messageCount: 0, capturedTimeCount: 0 };
    }

    const draftRegistryKey = getDraftRegistryStorageKey();
    const draftTimesKey = getDraftCapturedTimesStorageKey();
    const draftRegistry = storageGet(draftRegistryKey, null);
    const draftTimesPayload = storageGet(draftTimesKey, null);
    if (draftRegistry && draftRegistry.draftKey && draftRegistry.draftKey !== draftKey) {
      DEBUG_STATE.draftMigrationSkippedReason = "draft-key-mismatch";
      DEBUG_STATE.draftMigrationSuccess = false;
      return { messageCount: 0, capturedTimeCount: 0 };
    }

    const realRegistryKey = getMessageRegistryStorageKeyForConversation(realConversationKey);
    const realTimesKey = getCapturedTimeStorageKeyForConversation(realConversationKey);
    const realRegistry = storageGet(realRegistryKey, null) || {};
    const realTimesPayload = storageGet(realTimesKey, {}) || {};
    const draftMessages = draftRegistry && Array.isArray(draftRegistry.messages) ? draftRegistry.messages : [];
    const realMessages = Array.isArray(realRegistry.messages) ? realRegistry.messages : [];
    const realById = new Map(realMessages.map((message) => [message.messageId, message]));
    let migratedMessages = 0;

    draftMessages.forEach((record) => {
      if (!record || !record.messageId) return;
      if (!realById.has(record.messageId)) {
        realById.set(record.messageId, {
          ...record,
          conversationId: realConversationKey,
          tabInstanceId: state.tabInstanceId || getTabInstanceId()
        });
        migratedMessages += 1;
      }
    });

    const draftTimes = draftTimesPayload && draftTimesPayload.capturedTimes ? draftTimesPayload.capturedTimes : (draftRegistry && draftRegistry.capturedTimes ? draftRegistry.capturedTimes : {});
    const realTimes = realTimesPayload && realTimesPayload.capturedTimes ? realTimesPayload.capturedTimes : realTimesPayload;
    const mergedTimes = { ...(realTimes || {}) };
    let migratedTimes = 0;
    Object.entries(draftTimes || {}).forEach(([messageId, value]) => {
      if (mergedTimes[messageId]) return;
      const normalized = normalizeCapturedTimeValue(value);
      if (!normalized) return;
      mergedTimes[messageId] = normalized;
      migratedTimes += 1;
    });

    const mergedMessages = Array.from(realById.values()).map((message, index) => ({
      ...message,
      index: Number(message.index) || index + 1,
      conversationId: realConversationKey
    }));

    storageSet(realRegistryKey, {
      ...(realRegistry || {}),
      version: SCRIPT_VERSION,
      conversationId: realConversationKey,
      tabInstanceId: state.tabInstanceId || getTabInstanceId(),
      savedAtRaw: new Date().toISOString(),
      order: mergedMessages.map((message) => message.messageId),
      messages: mergedMessages
    });
    storageSet(realTimesKey, mergedTimes);
    if (draftRegistry) {
      storageSet(draftRegistryKey, {
        ...draftRegistry,
        migratedTo: realConversationKey,
        migratedAt: new Date().toISOString()
      });
    }

    DEBUG_STATE.draftMigrationRanAt = new Date().toISOString();
    DEBUG_STATE.draftMigrationFromKey = draftKey;
    DEBUG_STATE.draftMigrationToKey = realConversationKey;
    DEBUG_STATE.draftMigrationMessageCount = migratedMessages;
    DEBUG_STATE.draftMigrationCapturedTimeCount = migratedTimes;
    DEBUG_STATE.draftMigrationSkippedReason = null;
    DEBUG_STATE.draftMigrationSuccess = true;
    showToast(state.preferences && state.preferences.uiLanguage === "en"
      ? "Draft chat records migrated: " + migratedMessages + " messages"
      : "已迁移新建聊天临时记录：" + migratedMessages + " 条消息");
    return { messageCount: migratedMessages, capturedTimeCount: migratedTimes };
  }

  function createEmptyTimeFolderCache() {
    return {
      messageHash: "",
      mode: "",
      textSearch: "",
      folders: null,
      noTimeMessages: [],
      folderSearchIndex: []
    };
  }

  function resetConversationScopedState() {
    clearJumpCorrectionTimers();
    removeJumpInterruptListeners();
    clearAllMediaHydrationRescans();
    state.userMessages = [];
    state.messageHash = "";
    state.lastRenderedHash = "";
    state.messageRegistry = new Map();
    state.messageOrder = [];
    state.expandedMessageIds = new Set();
    state.richContentSignatureById = new Map();
    state.seenMessageIds = new Set();
    state.initialBaselineReady = false;
    state.capturedAtById = {};
    state.bookmarks = {};
    state.tags = {};
    state.activeMessageId = null;
    state.pendingScrollTargetMessageId = null;
    state.currentJumpToken = null;
    state.jumpInterrupted = false;
    state.timeFolderCache = createEmptyTimeFolderCache();
    state.timeSearchKeyword = "";
    state.timeSearchDraft = "";
    state.timeSearchMatchedMessageIds = new Set();
    state.timeSearchMatchedMessageOrder = [];
    state.timeSearchActiveIndex = -1;
    state.timeSearchActive = false;
    state.activeTagFilter = "";
    DEBUG_STATE.registryClearedOnConversationChange = true;
    DEBUG_STATE.conversationScopedStateResetAt = new Date().toISOString();
    DEBUG_STATE.pendingScrollTargetMessageId = null;
    DEBUG_STATE.currentJumpToken = null;
    DEBUG_STATE.activeMessageId = null;
  }

  function handleConversationChange(newConversationId, oldConversationId, reason) {
    if (!newConversationId || newConversationId === oldConversationId) return;
    const newIdentity = getConversationIdentity();
    if (isDraftConversationKey(oldConversationId) && newIdentity.isRealConversation) {
      migrateDraftSessionToConversation(oldConversationId, newConversationId);
    }
    const oldMessageCount = state.userMessages.length;
    state.isSwitchingConversation = true;
    state.conversationSwitchStartedAt = Date.now();
    DEBUG_STATE.conversationSwitchInProgress = true;
    DEBUG_STATE.conversationSwitchCount += 1;
    DEBUG_STATE.previousConversationId = oldConversationId || null;
    DEBUG_STATE.lastConversationId = oldConversationId || null;
    DEBUG_STATE.currentConversationId = newConversationId;
    DEBUG_STATE.oldConversationMessageCountBeforeReset = oldMessageCount;

    resetConversationScopedState();
    state.currentConversationId = newConversationId;
    DEBUG_STATE.conversationHardResetComplete = true;
    DEBUG_STATE.renderedEmptyBeforeLoadingNewConversation = true;
    updateStaticTexts();
    renderNav("conversation-change-empty-before-load", true);

    loadCapturedTimesForCurrentConversation();
    loadBookmarksForCurrentConversation();
    loadTagsForCurrentConversation();
    loadViewStateForCurrentConversation();
    loadMessageRegistryForCurrentConversation();

    DEBUG_STATE.registryStorageKeyAfterSwitch = getMessageRegistryStorageKey();
    DEBUG_STATE.loadedRegistryCountAfterSwitch = state.messageRegistry.size;
    DEBUG_STATE.renderedEmptyDuringConversationSwitch = state.userMessages.length === 0;
    DEBUG_STATE.newConversationMessageCountAfterLoad = state.userMessages.length;
    DEBUG_STATE.currentConversationId = state.currentConversationId;
    state.lastConversationIdentity = newIdentity;

    updateStaticTexts();
    renderSettingsPanel();
    renderHelpPanel();
    applyThemeMode();
    scheduleAccentAutoResolve("conversation-change");
    applyRouteAutoCollapse("conversation-change");
    renderNav("conversation-change-after-load", true);

    const scheduleConversationScan = (delay, scanReason) => {
      setTimeout(() => {
        if (getConversationId() !== state.currentConversationId) {
          DEBUG_STATE.staleScanSkippedCount += 1;
          debugLog("warn", "conversation scan skipped: stale id", {
            reason: scanReason,
            currentConversationId: state.currentConversationId,
            actualConversationId: getConversationId()
          });
          return;
        }
        state.isSwitchingConversation = false;
        DEBUG_STATE.conversationSwitchInProgress = false;
        scheduleAccentAutoResolve(scanReason);
        scanAndMaybeRender(scanReason, true);
      }, delay);
    };

    scheduleConversationScan(300, "conversation-change-delayed-scan");
    scheduleConversationScan(1000, "conversation-change-stable-scan");
    DEBUG_STATE.conversationChangeDelayedScanScheduled = true;

    debugLog("info", "conversation changed", { oldConversationId, newConversationId, reason });
  }

  function truncateRegistryText(value, maxLength) {
    const text = String(value || "");
    return text.length > maxLength ? text.slice(0, maxLength) : text;
  }

  function serializeMessageForRegistry(message) {
    return {
      index: Number(message.index) || 0,
      messageId: message.messageId,
      id: message.id || message.messageId,
      conversationId: state.currentConversationId,
      tabInstanceId: state.tabInstanceId,
      mainText: truncateRegistryText(message.mainText, 12000),
      rawText: truncateRegistryText(message.rawText, 12000),
      displayText: truncateRegistryText(message.displayText, 12000),
      preview: truncateRegistryText(message.preview, 240),
      displayPreviewMultiline: truncateRegistryText(message.displayPreviewMultiline, 1200),
      displayFullText: truncateRegistryText(message.displayFullText, 12000),
      displayPreviewTruncated: !!message.displayPreviewTruncated,
      quotedTexts: (message.quotedTexts || []).slice(0, 8).map((text) => truncateRegistryText(text, 1000)),
      quotedPreview: truncateRegistryText(message.quotedPreview, 1200),
      hasQuote: !!message.hasQuote,
      quoteDomDetected: !!message.quoteDomDetected,
      quoteDetectSource: message.quoteDetectSource || null,
      quoteCardNodeCount: Number(message.quoteCardNodeCount) || 0,
      hasImage: !!message.hasImage,
      imageCount: Number(message.imageCount) || 0,
      imageDetectionConfidence: message.imageDetectionConfidence || null,
      imageCandidateCount: Number(message.imageCandidateCount) || 0,
      imageAcceptedCount: Number(message.imageAcceptedCount) || 0,
      imagePendingSizeCount: Number(message.imagePendingSizeCount) || 0,
      imageAcceptedByAriaOnlyCount: Number(message.imageAcceptedByAriaOnlyCount) || 0,
      hasAttachment: !!message.hasAttachment,
      attachmentNames: (message.attachmentNames || []).slice(0, 12).map((name) => truncateRegistryText(name, 260)),
      attachmentCount: Number(message.attachmentCount) || 0,
      smartPreviewApplied: !!message.smartPreviewApplied,
      mainTextSource: message.mainTextSource || null,
      isBookmarked: !!message.isBookmarked,
      bookmarkName: truncateRegistryText(message.bookmarkName, 240),
      tags: (message.tags || []).slice(0, 20).map((tag) => truncateRegistryText(tag, 80)),
      hasTags: !!message.hasTags,
      timeMeta: message.timeMeta ? { ...message.timeMeta } : null,
      messageTimeRaw: message.messageTimeRaw || null,
      messageTimeLabel: message.messageTimeLabel || "",
      capturedAtRaw: message.capturedAtRaw || null,
      capturedAtLabel: message.capturedAtLabel || "",
      capturedAtSource: message.capturedAtSource || null,
      richContentSignature: message.richContentSignature || "",
      cached: !!message.cached,
      offscreen: !!message.offscreen,
      savedAtRaw: new Date().toISOString(),
      cachedAtRaw: new Date().toISOString()
    };
  }

  function hydrateRegistryMessage(record) {
    if (!record || !record.messageId) return null;
    const message = {
      ...record,
      id: record.id || record.messageId,
      element: null,
      cached: true,
      offscreen: true,
      quotedTexts: Array.isArray(record.quotedTexts) ? record.quotedTexts : [],
      attachmentNames: Array.isArray(record.attachmentNames) ? record.attachmentNames : [],
      tags: Array.isArray(record.tags) ? record.tags : []
    };
    message.hasTags = message.tags.length > 0;
    return message;
  }

  function loadMessageRegistryForCurrentConversation() {
    const key = getMessageRegistryStorageKey();
    const saved = storageGet(key, null);
    const registry = new Map();
    const order = [];
    const keyConfirmsConversation = key.endsWith(":" + state.currentConversationId);
    DEBUG_STATE.registryRejectedWrongConversation = false;
    DEBUG_STATE.registryRejectedWrongConversationCount = 0;
    DEBUG_STATE.registryLoadedConversationId = saved && saved.conversationId || null;
    DEBUG_STATE.registryExpectedConversationId = state.currentConversationId;
    DEBUG_STATE.registryLoadedTabInstanceId = saved && saved.tabInstanceId || null;
    DEBUG_STATE.registryLastReadTabInstanceId = state.tabInstanceId;

    if (saved && Array.isArray(saved.messages)) {
      if (saved.conversationId && saved.conversationId !== state.currentConversationId) {
        DEBUG_STATE.registryRejectedWrongConversation = true;
        DEBUG_STATE.registryRejectedWrongConversationCount = saved.messages.length;
      } else if (!saved.conversationId && !keyConfirmsConversation) {
        DEBUG_STATE.registryRejectedWrongConversation = true;
        DEBUG_STATE.registryRejectedWrongConversationCount = saved.messages.length;
      } else {
        saved.messages.forEach((record) => {
          if (record.conversationId && record.conversationId !== state.currentConversationId) {
            DEBUG_STATE.registryRejectedWrongConversation = true;
            DEBUG_STATE.registryRejectedWrongConversationCount += 1;
            return;
          }
          if (!record.conversationId && !keyConfirmsConversation) {
            DEBUG_STATE.registryRejectedWrongConversation = true;
            DEBUG_STATE.registryRejectedWrongConversationCount += 1;
            return;
          }
        const message = hydrateRegistryMessage(record);
        if (!message || registry.has(message.messageId)) return;
        registry.set(message.messageId, message);
        order.push(message.messageId);
        });
      }
    }

    state.messageRegistry = registry;
    state.messageOrder = Array.isArray(saved && saved.order) && saved.order.length ? saved.order.filter((id) => registry.has(id)) : order;
    order.forEach((id) => {
      if (!state.messageOrder.includes(id)) state.messageOrder.push(id);
    });
    state.messageRegistryByConversation.set(state.currentConversationId, {
      registry: state.messageRegistry,
      order: state.messageOrder
    });
    state.userMessages = state.messageOrder
      .map((messageId, index) => {
        const message = state.messageRegistry.get(messageId);
        if (message) message.index = index + 1;
        return message;
      })
      .filter(Boolean);

    DEBUG_STATE.registryStorageKey = key;
    DEBUG_STATE.registryLoadedFromStorageCount = registry.size;
    DEBUG_STATE.registryMessageCount = registry.size;
    DEBUG_STATE.firstRegistryMessageId = state.messageOrder[0] || null;
    DEBUG_STATE.userMessageCount = state.userMessages.length;

    const backfilled = backfillCapturedTimesFromRegistry({ save: true, render: false });
    if (backfilled > 0) {
      rebuildRegistryTimesFromCapturedStore();
      saveMessageRegistryForCurrentConversation();
      DEBUG_STATE.automaticTimeRepairRestoredCount += backfilled;
      DEBUG_STATE.automaticTimeRepairDidNotScroll = true;
    }
  }

  function saveMessageRegistryForCurrentConversation() {
    const key = getMessageRegistryStorageKey();
    const messages = state.messageOrder
      .map((messageId) => state.messageRegistry.get(messageId))
      .filter(Boolean)
      .map((message, index) => serializeMessageForRegistry({ ...message, index: index + 1 }));
    const payload = {
      version: SCRIPT_VERSION,
      conversationId: state.currentConversationId,
      tabInstanceId: state.tabInstanceId,
      savedAtRaw: new Date().toISOString(),
      order: messages.map((message) => message.messageId),
      messages
    };
    if (isDraftConversationKey(state.currentConversationId)) {
      payload.createdAt = payload.savedAtRaw;
      payload.lastUpdatedAt = payload.savedAtRaw;
      payload.draftKey = state.currentConversationId;
      payload.provisionalConversationUrl = location.href;
      payload.capturedTimes = state.capturedAtById;
    }
    storageSet(key, payload);
    DEBUG_STATE.registryStorageKey = key;
    DEBUG_STATE.registrySavedCount = messages.length;
    DEBUG_STATE.registrySavedConversationId = state.currentConversationId;
    DEBUG_STATE.registryLastWriteTabInstanceId = state.tabInstanceId;
    updateDraftStorageDebug();
  }

  function mergeVisibleMessageOrder(visibleIds) {
    const before = state.messageOrder.join("|");
    let insertedBefore = 0;
    let insertedAfter = 0;
    let noAnchor = 0;

    visibleIds.forEach((id, visibleIndex) => {
      if (!id || state.messageOrder.includes(id)) return;

      const nextAnchor = visibleIds.slice(visibleIndex + 1).find((nextId) => state.messageOrder.includes(nextId));
      if (nextAnchor) {
        state.messageOrder.splice(state.messageOrder.indexOf(nextAnchor), 0, id);
        insertedBefore += 1;
        return;
      }

      const prevAnchor = visibleIds.slice(0, visibleIndex).reverse().find((prevId) => state.messageOrder.includes(prevId));
      if (prevAnchor) {
        state.messageOrder.splice(state.messageOrder.indexOf(prevAnchor) + 1, 0, id);
        insertedAfter += 1;
        return;
      }

      state.messageOrder.push(id);
      noAnchor += 1;
    });

    state.messageOrder = uniqueStrings(state.messageOrder).filter((id) => state.messageRegistry.has(id) || visibleIds.includes(id));
    DEBUG_STATE.orderMergeInsertedBeforeCount = insertedBefore;
    DEBUG_STATE.orderMergeInsertedAfterCount = insertedAfter;
    DEBUG_STATE.orderMergeNoAnchorCount = noAnchor;
    DEBUG_STATE.registryOrderStable = before === state.messageOrder.join("|") || (insertedBefore + insertedAfter + noAnchor) > 0;
  }

  function mergeVisibleMessagesIntoRegistry(messages) {
    const mergeConversationId = getConversationId();
    if (mergeConversationId !== state.currentConversationId) {
      DEBUG_STATE.mergeSkippedStaleConversationCount += 1;
      DEBUG_STATE.staleMergeSkippedCount += 1;
      DEBUG_STATE.lastSkippedScanReason = "merge-stale-conversation";
      debugLog("warn", "merge skipped: stale conversation", {
        mergeConversationId,
        currentConversationId: state.currentConversationId
      });
      return state.userMessages || [];
    }

    const visibleIds = messages.map((message) => message.messageId).filter(Boolean);
    const visibleSet = new Set(visibleIds);
    let inserted = 0;
    let updated = 0;

    messages.forEach((message) => {
      const existing = state.messageRegistry.get(message.messageId);
      const mergedBase = {
        ...(existing || {}),
        ...message,
        element: message.element,
        conversationId: state.currentConversationId,
        tabInstanceId: state.tabInstanceId,
        cached: false,
        offscreen: false,
        index: message.index
      };
      const merged = mergeMessageTimeFields(existing, mergedBase);
      state.messageRegistry.set(message.messageId, merged);
      if (existing) updated += 1;
      else inserted += 1;
    });

    mergeVisibleMessageOrder(visibleIds);

    let retainedOffscreen = 0;
    state.messageOrder.forEach((messageId, index) => {
      const message = state.messageRegistry.get(messageId);
      if (!message) return;
      if (!visibleSet.has(messageId)) {
        message.element = null;
        message.cached = true;
        message.offscreen = true;
        retainedOffscreen += 1;
      }
      message.index = index + 1;
      message.isBookmarked = !!state.bookmarks[messageId];
      message.bookmarkName = state.bookmarks[messageId] ? state.bookmarks[messageId].name : "";
      const tagEntry = state.tags[messageId];
      message.tags = tagEntry && Array.isArray(tagEntry.tags) ? tagEntry.tags : [];
      message.hasTags = message.tags.length > 0;
    });

    const ordered = state.messageOrder
      .map((messageId) => state.messageRegistry.get(messageId))
      .filter(Boolean);

    DEBUG_STATE.registryEnabled = true;
    DEBUG_STATE.visibleDomUserMessageCount = messages.length;
    DEBUG_STATE.registryInsertedCount = inserted;
    DEBUG_STATE.registryUpdatedCount = updated;
    DEBUG_STATE.registryRetainedOffscreenCount = retainedOffscreen;
    DEBUG_STATE.registryMessageCount = ordered.length;
    DEBUG_STATE.firstRegistryMessageId = ordered[0] ? ordered[0].messageId : null;
    DEBUG_STATE.firstVisibleDomMessageId = messages[0] ? messages[0].messageId : null;
    DEBUG_STATE.registryStorageKey = getMessageRegistryStorageKey();
    state.messageRegistryByConversation.set(state.currentConversationId, {
      registry: state.messageRegistry,
      order: state.messageOrder
    });

    saveMessageRegistryForCurrentConversation();
    return ordered;
  }

  function loadCapturedTimesForCurrentConversation() {
    const repair = repairCapturedTimesForCurrentConversation({ source: "auto-load", render: false, includeRegistry: false });
    DEBUG_STATE.automaticTimeRepairRanAt = new Date().toISOString();
    DEBUG_STATE.automaticTimeRepairRestoredCount = repair.restoredCount;
    DEBUG_STATE.automaticTimeRepairDidNotScroll = true;
  }

  function saveCapturedTimesForCurrentConversation() {
    const key = getCapturedTimeStorageKey();
    if (isDraftConversationKey(state.currentConversationId)) {
      storageSet(key, {
        tabInstanceId: state.tabInstanceId || getTabInstanceId(),
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        draftKey: state.currentConversationId,
        provisionalConversationUrl: location.href,
        capturedTimes: state.capturedAtById
      });
    } else {
      storageSet(key, state.capturedAtById);
    }
    DEBUG_STATE.capturedTimeStorageKey = key;
    DEBUG_STATE.capturedTimeCurrentStorageKey = key;
    DEBUG_STATE.capturedTimeStoredCount = Object.keys(state.capturedAtById).length;
    updateDraftStorageDebug();
  }

  function getLegacyCapturedTimeStorageKeys() {
    const keys = [getCapturedTimeStorageKey()];
    const rawId = DEBUG_STATE.rawConversationIdFromUrl || "";
    const normalized = state.currentConversationId || DEBUG_STATE.normalizedConversationKey || "";
    const add = (suffix) => {
      if (!suffix) return;
      keys.push(STORAGE_PREFIX + "-captured-times:" + suffix);
    };

    add(rawId);
    add(rawId ? "chat:" + rawId : "");
    add(normalized);
    if (normalized && normalized.startsWith("chat:")) add(normalized.replace(/^chat:/, ""));
    if (normalized && normalized.startsWith("fallback:")) add(normalized);

    return uniqueStrings(keys);
  }

  function normalizeCapturedTimeValue(value) {
    let raw = null;
    if (typeof value === "string") raw = value;
    else if (value && typeof value === "object") {
      raw = value.capturedAtRaw || value.recordedAt || value.time || value.raw || value.iso || value.value || null;
    }
    if (!raw) return null;
    const time = new Date(raw).getTime();
    if (!Number.isFinite(time)) return null;
    return {
      raw: new Date(time).toISOString(),
      capturedAtRaw: new Date(time).toISOString(),
      capturedAtSource: value && typeof value === "object" && value.capturedAtSource ? value.capturedAtSource : "time-storage-repair"
    };
  }

  function normalizeCapturedTimeStore(store, sourceKey) {
    const out = {};
    let invalid = 0;
    Object.entries(store || {}).forEach(([messageId, value]) => {
      const normalized = normalizeCapturedTimeValue(value);
      if (!normalized) {
        invalid += 1;
        return;
      }
      out[messageId] = {
        ...normalized,
        migratedFromKey: sourceKey || null
      };
    });
    return { out, invalid };
  }

  function getCapturedTimeCandidateFromRecord(record) {
    if (!record) return null;
    const meta = record.timeMeta || {};
    return normalizeCapturedTimeValue(
      record.capturedAtRaw ||
      record.recordedAtRaw ||
      meta.capturedAtRaw ||
      meta.recordedAt ||
      meta.raw ||
      null
    );
  }

  function rebuildRegistryTimesFromCapturedStore() {
    if (!state.messageRegistry) return 0;
    let updated = 0;
    state.messageRegistry.forEach((message, messageId) => {
      const captured = normalizeCapturedTimeValue(state.capturedAtById[messageId]);
      if (!captured) return;
      const realTime = message.messageTimeRaw ? { raw: message.messageTimeRaw } : { raw: null };
      const timeMeta = buildTimeMeta(realTime, {
        raw: captured.raw || captured.capturedAtRaw,
        source: captured.capturedAtSource || "time-storage-repair"
      });
      message.capturedAtRaw = captured.raw || captured.capturedAtRaw;
      message.capturedAtLabel = formatDateTimeLabel(message.capturedAtRaw);
      message.capturedAtSource = captured.capturedAtSource || "time-storage-repair";
      message.timeMeta = timeMeta;
      updated += 1;
    });
    return updated;
  }

  function backfillCapturedTimesFromRegistry(options) {
    const opts = options || {};
    let recordsWithTime = 0;
    let backfilled = 0;
    if (!state.messageRegistry) return 0;

    state.messageRegistry.forEach((record, messageId) => {
      const candidate = getCapturedTimeCandidateFromRecord(record);
      if (!candidate) return;
      recordsWithTime += 1;
      if (state.capturedAtById[messageId]) return;
      state.capturedAtById[messageId] = {
        ...candidate,
        capturedAtSource: candidate.capturedAtSource || "registry-backfill"
      };
      backfilled += 1;
    });

    if (backfilled > 0) {
      rebuildRegistryTimesFromCapturedStore();
      if (opts.save !== false) saveCapturedTimesForCurrentConversation();
    }

    DEBUG_STATE.capturedTimeBackfilledFromRegistryCount = backfilled;
    DEBUG_STATE.capturedTimeRegistryRecordsWithTimeCount = recordsWithTime;
    DEBUG_STATE.capturedTimeRegistryBackfillRanAt = new Date().toISOString();
    DEBUG_STATE.capturedTimeRegistryBackfillSaved = backfilled > 0 && opts.save !== false;
    DEBUG_STATE.capturedTimeStoredCount = Object.keys(state.capturedAtById).length;
    return backfilled;
  }

  function mergeMessageTimeFields(existing, incoming) {
    const oldCandidate = getCapturedTimeCandidateFromRecord(existing);
    const newCandidate = getCapturedTimeCandidateFromRecord(incoming);
    const messageId = incoming && incoming.messageId || existing && existing.messageId;

    if (newCandidate) {
      if (messageId && !state.capturedAtById[messageId]) {
        state.capturedAtById[messageId] = {
          ...newCandidate,
          capturedAtSource: newCandidate.capturedAtSource || "visible-merge"
        };
        saveCapturedTimesForCurrentConversation();
      }
      return incoming;
    }

    if (oldCandidate && existing) {
      const realTime = incoming.messageTimeRaw ? { raw: incoming.messageTimeRaw } : { raw: null };
      const preservedTimeMeta = existing.timeMeta || buildTimeMeta(realTime, {
        raw: oldCandidate.raw || oldCandidate.capturedAtRaw,
        source: oldCandidate.capturedAtSource || "preserved-registry-time"
      });
      const merged = {
        ...incoming,
        capturedAtRaw: existing.capturedAtRaw || oldCandidate.raw,
        capturedAtLabel: existing.capturedAtLabel || formatDateTimeLabel(oldCandidate.raw),
        capturedAtSource: existing.capturedAtSource || oldCandidate.capturedAtSource || "preserved-registry-time",
        timeMeta: preservedTimeMeta
      };
      DEBUG_STATE.preservedExistingTimeOnMergeCount += 1;
      DEBUG_STATE.preventedNullTimeOverwriteCount += 1;
      DEBUG_STATE.lastTimePreservedMessageId = messageId || null;
      if (messageId && !state.capturedAtById[messageId]) {
        state.capturedAtById[messageId] = {
          ...oldCandidate,
          capturedAtSource: oldCandidate.capturedAtSource || "merge-restore"
        };
        DEBUG_STATE.capturedAtRestoredDuringMergeCount += 1;
        saveCapturedTimesForCurrentConversation();
      }
      return merged;
    }

    return incoming;
  }

  function repairCapturedTimesForCurrentConversation(options) {
    const opts = options || {};
    const currentKey = getCapturedTimeStorageKey();
    const keys = getLegacyCapturedTimeStorageKeys();
    const currentRaw = storageGet(currentKey, {}) || {};
    const currentStore = currentRaw && currentRaw.capturedTimes && typeof currentRaw.capturedTimes === "object" ? currentRaw.capturedTimes : currentRaw;
    const normalizedCurrent = normalizeCapturedTimeStore(currentStore, currentKey);
    const merged = { ...normalizedCurrent.out };
    const currentBeforeCount = Object.keys(merged).length;
    let legacyFound = [];
    let mergedFromLegacy = 0;
    let legacyMatchedCount = 0;
    let invalidLegacy = 0;

    keys.forEach((key) => {
      const raw = storageGet(key, null);
      if (!raw || typeof raw !== "object") return;
      const rawStore = raw && raw.capturedTimes && typeof raw.capturedTimes === "object" ? raw.capturedTimes : raw;
      const normalized = normalizeCapturedTimeStore(rawStore, key);
      const entries = Object.entries(normalized.out);
      if (key !== currentKey && entries.length) legacyFound.push(key);
      if (key !== currentKey) legacyMatchedCount += entries.length;
      invalidLegacy += key === currentKey ? 0 : normalized.invalid;
      entries.forEach(([messageId, value]) => {
        if (merged[messageId]) return;
        merged[messageId] = value;
        if (key !== currentKey) mergedFromLegacy += 1;
      });
    });

    state.capturedAtById = merged;
    const afterLegacyCount = Object.keys(merged).length;
    if (mergedFromLegacy > 0 || normalizedCurrent.invalid > 0) saveCapturedTimesForCurrentConversation();

    DEBUG_STATE.capturedTimeStorageKey = currentKey;
    DEBUG_STATE.capturedTimeCurrentStorageKey = currentKey;
    DEBUG_STATE.capturedTimeLegacyKeysChecked = keys;
    DEBUG_STATE.capturedTimeLegacyKeysFound = legacyFound;
    DEBUG_STATE.capturedTimeLegacyMatchedCount = legacyMatchedCount;
    DEBUG_STATE.capturedTimeMigratedCount = mergedFromLegacy;
    DEBUG_STATE.capturedTimeMergedFromLegacyCount = mergedFromLegacy;
    DEBUG_STATE.capturedTimeInvalidLegacyValueCount = invalidLegacy;
    DEBUG_STATE.capturedTimeCurrentBeforeMergeCount = currentBeforeCount;
    DEBUG_STATE.capturedTimeCurrentAfterMergeCount = afterLegacyCount;
    DEBUG_STATE.capturedTimeMigrationRanAt = new Date().toISOString();
    DEBUG_STATE.capturedTimeStoredCount = afterLegacyCount;

    let registryRecovered = 0;
    if (opts.includeRegistry !== false) {
      registryRecovered = backfillCapturedTimesFromRegistry({ save: true, render: false });
    }

    const restoredCount = mergedFromLegacy + registryRecovered;
    if (opts.source === "manual") {
      DEBUG_STATE.manualTimeRepairClickedAt = new Date().toISOString();
      DEBUG_STATE.manualTimeRepairLegacyRecoveredCount = mergedFromLegacy;
      DEBUG_STATE.manualTimeRepairRegistryRecoveredCount = registryRecovered;
      DEBUG_STATE.manualTimeRepairRestoredCount = restoredCount;
      DEBUG_STATE.manualTimeRepairCurrentCountAfter = Object.keys(state.capturedAtById).length;
    }

    if (opts.render) {
      rebuildRegistryTimesFromCapturedStore();
      if (registryRecovered > 0 || mergedFromLegacy > 0) saveMessageRegistryForCurrentConversation();
      renderNav(opts.source === "manual" ? "manual-time-storage-repair" : "captured-time-storage-repair", true);
      const text = restoredCount > 0
        ? t("timeIndexRepaired", { count: restoredCount })
        : t("timeIndexChecked");
      showToast(text);
    }

    return { restoredCount, legacyRecovered: mergedFromLegacy, registryRecovered };
  }

  function loadBookmarksForCurrentConversation() {
    state.bookmarks = storageGet(getBookmarksStorageKey(), {}) || {};
    DEBUG_STATE.bookmarkCount = Object.keys(state.bookmarks).length;
  }

  function saveBookmarksForCurrentConversation() {
    storageSet(getBookmarksStorageKey(), state.bookmarks);
    DEBUG_STATE.bookmarkCount = Object.keys(state.bookmarks).length;
  }

  function loadTagsForCurrentConversation() {
    state.tags = storageGet(getTagsStorageKey(), {}) || {};
    updateTagsDebug();
  }

  function saveTagsForCurrentConversation() {
    storageSet(getTagsStorageKey(), state.tags);
    updateTagsDebug();
  }

  function loadViewStateForCurrentConversation() {
    const saved = storageGet(getViewStateStorageKey(), {}) || {};
    state.activeTab = saved.activeTab || state.preferences.defaultTab || "all";
    state.timeFolderMode = saved.timeFolderMode || state.preferences.defaultTimeFolderMode || "month";
    state.expandedTimeFolders = saved.expandedTimeFolders || {};
    state.lastTimeSearch = saved.lastTimeSearch || "";
    state.timeSearchKeyword = "";
    state.timeSearchDraft = state.lastTimeSearch;
    state.activeTagFilter = saved.activeTagFilter || "";

    if (!TAB_ORDER.includes(state.activeTab)) state.activeTab = firstVisibleKey(state.preferences.visibleTabs, TAB_ORDER);
    if (!TIME_MODE_ORDER.includes(state.timeFolderMode)) state.timeFolderMode = firstVisibleKey(state.preferences.visibleTimeModes, TIME_MODE_ORDER);

    applyVisibilityFallbacks("load-view-state");

    DEBUG_STATE.activeViewTab = state.activeTab;
    DEBUG_STATE.timeFolderMode = state.timeFolderMode;
    DEBUG_STATE.lastTimeSearch = state.lastTimeSearch;
    DEBUG_STATE.activeTagFilter = state.activeTagFilter;
  }

  function saveViewStateForCurrentConversation() {
    storageSet(getViewStateStorageKey(), {
      activeTab: state.activeTab,
      timeFolderMode: state.timeFolderMode,
      expandedTimeFolders: state.expandedTimeFolders,
      lastTimeSearch: state.lastTimeSearch,
      activeTagFilter: state.activeTagFilter
    });
    DEBUG_STATE.activeViewTab = state.activeTab;
    DEBUG_STATE.timeFolderMode = state.timeFolderMode;
    DEBUG_STATE.lastTimeSearch = state.lastTimeSearch;
    DEBUG_STATE.activeTagFilter = state.activeTagFilter;
  }

  function copyText(text) {
    if (typeof GM_setClipboard === "function") {
      GM_setClipboard(text);
      return Promise.resolve();
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    return Promise.resolve();
  }

  function normalizeText(text) {
    return String(text || "").replace(/\r/g, "").trim();
  }

  function getSingleLinePreview(text, maxLength) {
    const normalized = normalizeText(text).replace(/\s+/g, " ");
    if (normalized.length <= maxLength) return normalized;
    return normalized.slice(0, Math.max(0, maxLength - 3)).trim() + "...";
  }

  function getMultilinePreview(text, maxLength, maxLines) {
    const limit = maxLength || state.preferences.maxPreviewLength || 120;
    const linesLimit = maxLines || state.preferences.maxPreviewLines || 3;
    const lines = String(text || "")
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    let out = [];
    let total = 0;
    let truncated = false;

    for (const line of lines) {
      if (out.length >= linesLimit) {
        truncated = true;
        break;
      }

      const remaining = limit - total;
      if (remaining <= 0) {
        truncated = true;
        break;
      }

      if (line.length > remaining) {
        out.push(line.slice(0, Math.max(0, remaining - 3)).trim());
        truncated = true;
        break;
      }

      out.push(line);
      total += line.length;
    }

    let result = out.join("\n").trim();
    if (!result && normalizeText(text)) result = getSingleLinePreview(text, limit);
    if (truncated && !result.endsWith("...")) result = result.replace(/\.*$/, "") + "...";
    return result;
  }

  function cleanFallbackUserText(text) {
    const lines = String(text || "")
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => {
        if (/^(文档|PDF|文件|附件|图片|image)$/i.test(line)) return false;
        if (FILE_NAME_REGEX.test(line) && line.length < 120) {
          FILE_NAME_REGEX.lastIndex = 0;
          return false;
        }
        FILE_NAME_REGEX.lastIndex = 0;
        if (/^打开图片[:：]/.test(line)) return false;
        return true;
      });

    return lines.join("\n").trim();
  }

  function isInsidePanel(node) {
    if (!node || node.nodeType !== 1) return false;
    return !!node.closest && !!node.closest("#" + PANEL_ID);
  }

  function getNodeText(node) {
    return normalizeText((node && (node.innerText || node.textContent)) || "");
  }

  function containsLargeImage(node) {
    const media = node.querySelectorAll ? Array.from(node.querySelectorAll("img,picture,canvas")) : [];
    return media.some((item) => {
      const rect = item.getBoundingClientRect ? item.getBoundingClientRect() : { width: 0, height: 0 };
      const nw = item.naturalWidth || 0;
      const nh = item.naturalHeight || 0;
      return Math.max(rect.width || 0, nw) >= 80 && Math.max(rect.height || 0, nh) >= 80;
    });
  }

  function getMediaAriaText(node) {
    if (!node || node.nodeType !== 1) return "";
    return String(node.getAttribute("aria-label") || node.getAttribute("title") || "").trim();
  }

  function isStrongImageAria(value) {
    return /打开图片|图片|image/i.test(String(value || ""));
  }

  function isProbablyNonContentImage(img, button) {
    const alt = String((img && img.getAttribute("alt")) || "");
    const aria = getMediaAriaText(button || img);
    const className = String((img && img.className) || "") + " " + String((button && button.className) || "");
    if (/avatar|头像|emoji|表情/i.test(alt + " " + aria + " " + className)) return true;
    FILE_NAME_REGEX.lastIndex = 0;
    IMAGE_FILE_REGEX.lastIndex = 0;
    const looksLikeFileIcon = FILE_NAME_REGEX.test(alt) && !IMAGE_FILE_REGEX.test(alt);
    FILE_NAME_REGEX.lastIndex = 0;
    IMAGE_FILE_REGEX.lastIndex = 0;
    return looksLikeFileIcon;
  }

  function getMediaSizeInfo(node) {
    const rect = node && node.getBoundingClientRect ? node.getBoundingClientRect() : { width: 0, height: 0 };
    const naturalWidth = node && node.naturalWidth ? node.naturalWidth : 0;
    const naturalHeight = node && node.naturalHeight ? node.naturalHeight : 0;
    const width = Math.max(rect.width || 0, naturalWidth || 0);
    const height = Math.max(rect.height || 0, naturalHeight || 0);
    return {
      width,
      height,
      pending: width === 0 || height === 0,
      largeEnough: width >= 80 && height >= 80
    };
  }

  function isMediaRelatedNode(node) {
    if (!node || node.nodeType !== 1 || isInsidePanel(node)) return false;
    const element = node;
    const tag = element.tagName ? element.tagName.toLowerCase() : "";
    if (tag === "img" || tag === "picture" || tag === "canvas") return true;
    if (tag === "button" && isStrongImageAria(getMediaAriaText(element))) return true;
    if (element.closest && element.closest("button[aria-label]") && isStrongImageAria(getMediaAriaText(element.closest("button[aria-label]")))) return true;
    const className = String(element.className || "");
    return /image|picture|media|attachment|file|图片|附件/i.test(className);
  }

  function extractMainTextFromBubble(element) {
    const body = element.querySelector(".user-message-bubble-color .whitespace-pre-wrap");
    if (body) {
      const text = getNodeText(body);
      if (text) {
        DEBUG_STATE.mainTextBubbleSourceCount += 1;
        return { text, source: "bubble" };
      }
    }

    const fallback = cleanFallbackUserText(element.innerText || element.textContent || "");
    return { text: fallback, source: "fallback" };
  }

  function detectTopLevelQuoteCard(element) {
    const quotedTexts = [];
    let quoteCardNodeCount = 0;

    Array.from(element.children || []).forEach((child) => {
      const tag = child.tagName ? child.tagName.toLowerCase() : "";
      if (tag !== "button") return;
      if (child.querySelector(".user-message-bubble-color")) return;
      if (child.querySelector(".whitespace-pre-wrap")) return;
      if (containsLargeImage(child)) return;

      const text = getNodeText(child);
      if (!text || text.length < 2 || text.length > 800) return;

      FILE_NAME_REGEX.lastIndex = 0;
      if (FILE_NAME_REGEX.test(text)) {
        FILE_NAME_REGEX.lastIndex = 0;
        return;
      }
      FILE_NAME_REGEX.lastIndex = 0;

      const className = String(child.className || "");
      const isQuote =
        className.includes("text-token-text-tertiary") ||
        className.includes("mx-2") ||
        !!child.querySelector("p.line-clamp-3");

      if (!isQuote) return;

      quotedTexts.push(text);
      quoteCardNodeCount += 1;
    });

    if (quoteCardNodeCount > 0) {
      DEBUG_STATE.topLevelQuoteDetectedCount += 1;
      DEBUG_STATE.quoteCardNodeCount += quoteCardNodeCount;
      DEBUG_STATE.quoteDetectSource = "top-level-button";
    }

    return {
      quotedTexts: uniqueStrings(quotedTexts),
      quotedPreview: uniqueStrings(quotedTexts).slice(0, 2).map((text) => getSingleLinePreview(text, 80)).join("\n"),
      hasQuote: quotedTexts.length > 0,
      quoteDetectSource: quotedTexts.length > 0 ? "top-level-button" : null,
      quoteCardNodeCount
    };
  }

  function detectUploadedImagesFromProbeStructure(element) {
    const acceptedButtons = new Set();
    let imageButtonDetectedCount = 0;
    let imageAcceptedByAriaOnlyCount = 0;
    let imagePendingSizeCount = 0;
    let hasSizeAccepted = false;

    function accept(target, confidence) {
      if (!target || acceptedButtons.has(target)) return;
      acceptedButtons.add(target);
      if (confidence === "probe-button-size") hasSizeAccepted = true;
      if (confidence === "probe-button-aria-pending-size") {
        imageAcceptedByAriaOnlyCount += 1;
        imagePendingSizeCount += 1;
      }
    }

    Array.from(element.querySelectorAll("img")).forEach((img) => {
      const button = img.closest("button");
      if (isInsidePanel(img)) return;

      const aria = getMediaAriaText(button || img);
      const alt = img.getAttribute("alt") || "";
      const isImageButton = isStrongImageAria(aria);
      IMAGE_FILE_REGEX.lastIndex = 0;
      const isImageAlt = IMAGE_FILE_REGEX.test(alt);
      IMAGE_FILE_REGEX.lastIndex = 0;
      if (!isImageButton && !isImageAlt) return;
      if (isProbablyNonContentImage(img, button)) return;

      const size = getMediaSizeInfo(img);
      if (size.largeEnough) {
        imageButtonDetectedCount += 1;
        accept(button || img, "probe-button-size");
        return;
      }

      if (isImageButton) {
        imageButtonDetectedCount += 1;
        accept(button || img, "probe-button-aria-pending-size");
      }
    });

    Array.from(element.querySelectorAll("button[aria-label]")).forEach((button) => {
      if (isInsidePanel(button)) return;
      if (!isStrongImageAria(getMediaAriaText(button))) return;
      if (acceptedButtons.has(button)) return;
      const img = button.querySelector("img");
      if (img && isProbablyNonContentImage(img, button)) return;
      const size = img ? getMediaSizeInfo(img) : { largeEnough: false, pending: true };
      imageButtonDetectedCount += 1;
      accept(button, size.largeEnough ? "probe-button-size" : "probe-button-aria-pending-size");
    });

    const imageCount = acceptedButtons.size;
    DEBUG_STATE.imageButtonDetectedCount += imageButtonDetectedCount;
    DEBUG_STATE.imageAcceptedCount += imageCount;
    DEBUG_STATE.imageAcceptedByAriaOnlyCount += imageAcceptedByAriaOnlyCount;
    DEBUG_STATE.imagePendingSizeCount += imagePendingSizeCount;

    return {
      hasImage: imageCount > 0,
      imageCount,
      imageDetectionConfidence: imageCount > 0 ? (hasSizeAccepted ? "probe-button-size" : "probe-button-aria-pending-size") : null,
      imageCandidateCount: imageButtonDetectedCount,
      imageAcceptedCount: imageCount,
      imagePendingSizeCount,
      imageAcceptedByAriaOnlyCount
    };
  }

  function uniqueStrings(list) {
    const seen = new Set();
    const out = [];
    list.forEach((item) => {
      const value = normalizeText(item);
      if (!value) return;
      const key = value.replace(/\s+/g, " ");
      if (seen.has(key)) return;
      seen.add(key);
      out.push(value);
    });
    return out;
  }

  function extractFileNamesFromText(text) {
    FILE_NAME_REGEX.lastIndex = 0;
    const names = [];
    let match;
    while ((match = FILE_NAME_REGEX.exec(text || ""))) {
      const name = match[0].trim();
      if (name) names.push(name);
    }
    FILE_NAME_REGEX.lastIndex = 0;
    return uniqueStrings(names);
  }

  function describeElementForDebug(element) {
    if (!element || !element.tagName) return String(element);
    const id = element.id ? "#" + element.id : "";
    const className = String(element.className || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .map((name) => "." + name)
      .join("");
    const action = element.getAttribute && element.getAttribute("data-action") ? '[data-action="' + element.getAttribute("data-action") + '"]' : "";
    return element.tagName.toLowerCase() + id + className + action;
  }

  function isInsideUserTextBubble(node) {
    return !!(node && node.closest && node.closest(".user-message-bubble-color,.whitespace-pre-wrap"));
  }

  function isPathLikeAttachmentText(text) {
    const value = String(text || "");
    if (!value) return false;
    if (/[A-Za-z]:\\/.test(value)) return true;
    if (/\/(?:Users|mnt|home|Desktop)\//i.test(value)) return true;
    if (/\\OneDrive\\/i.test(value) || /OneDrive\\/i.test(value)) return true;
    if (/Codex_Workspace/i.test(value)) return true;
    return false;
  }

  function looksLikeLongPathParagraph(text) {
    const value = String(text || "");
    const windowsPathCount = (value.match(/[A-Za-z]:\\/g) || []).length;
    const unixPathCount = (value.match(/\/(?:Users|mnt|home|Desktop)\//gi) || []).length;
    return value.length > 220 && (windowsPathCount + unixPathCount > 1 || extractFileNamesFromText(value).length > 2);
  }

  function findMinimalAttachmentCardFromProbe(node) {
    let current = node;
    let best = null;

    while (current && current.nodeType === 1 && current.getAttribute("data-message-author-role") !== "user") {
      if (current.querySelector && current.querySelector(".user-message-bubble-color,.whitespace-pre-wrap")) break;
      if (containsLargeImage(current)) break;

      const text = getNodeText(current);
      if (isPathLikeAttachmentText(text) || looksLikeLongPathParagraph(text)) break;
      const rect = current.getBoundingClientRect ? current.getBoundingClientRect() : { height: 0 };
      const hasFile = extractFileNamesFromText(text).length > 0;
      const hasLabel = /(文档|PDF|文件|附件|document|file)/i.test(text);
      const compactText = text.length <= 220;
      const compactHeight = !rect.height || rect.height <= 160;

      if (hasFile && compactText && compactHeight) {
        best = current;
        if (hasLabel || text.length <= 120) break;
      }

      current = current.parentElement;
    }

    return best || node;
  }

  function detectAttachmentsFromProbeStructure(element) {
    const names = [];
    const attachmentNodes = [];

    Array.from(element.querySelectorAll("div,span,a,button,p")).forEach((node) => {
      if (isInsideUserTextBubble(node)) {
        const bubbleText = getNodeText(node);
        if (extractFileNamesFromText(bubbleText).length) {
          DEBUG_STATE.attachmentRejectedFromBubbleCount += 1;
          DEBUG_STATE.lastRejectedAttachmentCandidate = {
            reason: "inside-user-text-bubble",
            textPreview: getSingleLinePreview(bubbleText, 160),
            node: describeElementForDebug(node)
          };
        }
        return;
      }
      if (containsLargeImage(node)) return;

      const text = getNodeText(node);
      if (!text) return;
      if (isPathLikeAttachmentText(text) || looksLikeLongPathParagraph(text)) {
        DEBUG_STATE.attachmentRejectedPathLikeCount += 1;
        DEBUG_STATE.lastRejectedAttachmentCandidate = {
          reason: "path-like-text",
          textPreview: getSingleLinePreview(text, 180),
          node: describeElementForDebug(node)
        };
        return;
      }

      const fileNames = extractFileNamesFromText(text).filter((name) => {
        if (!IMAGE_FILE_REGEX.test(name)) return true;
        const imgWithAlt = Array.from(element.querySelectorAll("img")).some((img) => {
          const alt = img.getAttribute("alt") || "";
          return alt === name || alt.includes(name);
        });
        return !imgWithAlt;
      });

      if (!fileNames.length) return;

      const hasAttachmentLabel = /(文档|PDF|文件|附件|document|file)/i.test(text);
      const isTinyFileNameNode = text.length <= 160;
      const card = findMinimalAttachmentCardFromProbe(node);
      const isIndependentCard = card && card !== element && !isInsideUserTextBubble(card) && !containsLargeImage(card);
      if (!isIndependentCard || (!hasAttachmentLabel && !isTinyFileNameNode)) return;

      fileNames.forEach((name) => names.push(name));

      if (!attachmentNodes.includes(card)) {
        attachmentNodes.push(card);
      }
    });

    const attachmentNames = uniqueStrings(names);
    DEBUG_STATE.attachmentNodeCount += attachmentNodes.length;
    DEBUG_STATE.attachmentAcceptedCardCount += attachmentNodes.length;

    return {
      hasAttachment: attachmentNames.length > 0,
      attachmentCount: attachmentNames.length,
      attachmentNames,
      attachmentNodes
    };
  }

  function extractUserMessageParts(element, meta) {
    const messageId = element.getAttribute("data-message-id") || "";
    const index = meta && meta.index ? meta.index : 0;
    const main = extractMainTextFromBubble(element);
    let mainText = normalizeText(main.text);

    if (!mainText && normalizeText(element.innerText || element.textContent)) {
      mainText = cleanFallbackUserText(element.innerText || element.textContent || "");
      debugLog("warn", "mainText fallback used", { messageId, index });
    }

    const quoteInfo = detectTopLevelQuoteCard(element);
    const imageInfo = detectUploadedImagesFromProbeStructure(element);
    const attachmentInfo = detectAttachmentsFromProbeStructure(element);

    const displayText = mainText;
    const rawText = [mainText, quoteInfo.quotedTexts.join("\n")].filter(Boolean).join("\n\n").trim();

    return {
      mainText,
      rawText,
      displayText,
      quotedTexts: quoteInfo.quotedTexts,
      quotedPreview: quoteInfo.quotedPreview,
      hasQuote: quoteInfo.hasQuote,
      quoteDomDetected: quoteInfo.hasQuote,
      quoteDetectSource: quoteInfo.quoteDetectSource,
      quoteCardNodeCount: quoteInfo.quoteCardNodeCount,
      hasImage: imageInfo.hasImage,
      imageCount: imageInfo.imageCount,
      imageDetectionConfidence: imageInfo.imageDetectionConfidence,
      imageCandidateCount: imageInfo.imageCandidateCount,
      imageAcceptedCount: imageInfo.imageAcceptedCount,
      imagePendingSizeCount: imageInfo.imagePendingSizeCount,
      imageAcceptedByAriaOnlyCount: imageInfo.imageAcceptedByAriaOnlyCount,
      hasAttachment: attachmentInfo.hasAttachment,
      attachmentNames: attachmentInfo.attachmentNames,
      attachmentCount: attachmentInfo.attachmentCount,
      smartPreviewApplied: false,
      mainTextSource: main.source
    };
  }

  function buildRichContentSignature(message) {
    const quotedTexts = Array.isArray(message.quotedTexts) ? message.quotedTexts : [];
    const attachmentNames = Array.isArray(message.attachmentNames) ? message.attachmentNames : [];
    return [
      message.messageId || "",
      String(message.mainText || "").length,
      quotedTexts.length,
      String(message.quotedPreview || "").length,
      message.hasQuote ? 1 : 0,
      Number(message.imageCount || 0),
      message.hasImage ? 1 : 0,
      attachmentNames.join("|"),
      message.hasAttachment ? 1 : 0,
      message.mainTextSource || ""
    ].join("::");
  }

  function shouldScheduleMediaHydrationRescan(element, parts) {
    if (!element || isInsidePanel(element)) return false;
    if (parts && Number(parts.imagePendingSizeCount || 0) > 0) return true;
    if (element.querySelector("img,picture,canvas")) return true;
    if (Array.from(element.querySelectorAll("button[aria-label]")).some((button) => isStrongImageAria(getMediaAriaText(button)))) return true;
    return Array.from(element.querySelectorAll("div,span,button")).some((node) => isMediaRelatedNode(node));
  }

  function hasPendingMediaHydrationSignal(element, message) {
    if (!element || isInsidePanel(element)) return false;
    if (message && Number(message.imagePendingSizeCount || 0) > 0) return true;
    const pendingImage = Array.from(element.querySelectorAll("img")).some((img) => {
      if (isProbablyNonContentImage(img, img.closest("button"))) return false;
      return getMediaSizeInfo(img).pending;
    });
    if (pendingImage) return true;
    const strongImageButton = Array.from(element.querySelectorAll("button[aria-label]")).some((button) => isStrongImageAria(getMediaAriaText(button)));
    if (strongImageButton && (!message || !message.hasImage)) return true;
    return !!element.querySelector("picture,canvas") && (!message || !message.hasImage);
  }

  function observeMediaImages(element) {
    if (!element || !element.querySelectorAll) return;
    Array.from(element.querySelectorAll("img")).forEach((img) => {
      if (isInsidePanel(img) || state.observedMediaImages.has(img)) return;
      state.observedMediaImages.add(img);
      DEBUG_STATE.observedMediaImageCount += 1;

      img.addEventListener("load", () => {
        const root = img.closest(USER_SELECTOR);
        const messageId = root ? root.getAttribute("data-message-id") : null;
        if (!messageId) return;
        DEBUG_STATE.imageLoadTriggeredRescanCount += 1;
        DEBUG_STATE.lastImageLoadMessageId = messageId;
        scheduleMediaHydrationRescan(messageId, "img-load");
      }, true);

      img.addEventListener("error", () => {
        if (state.mediaImageErrorWarned.has(img)) return;
        state.mediaImageErrorWarned.add(img);
        const root = img.closest(USER_SELECTOR);
        debugLog("warn", "media image load error", {
          messageId: root ? root.getAttribute("data-message-id") : null
        });
      }, true);
    });
  }

  function clearMediaHydrationRescan(messageId) {
    const timers = state.mediaHydrationRescanTimers.get(messageId) || [];
    timers.forEach((timer) => clearTimeout(timer));
    state.mediaHydrationRescanTimers.delete(messageId);
  }

  function clearAllMediaHydrationRescans() {
    Array.from(state.mediaHydrationRescanTimers.keys()).forEach((messageId) => clearMediaHydrationRescan(messageId));
    state.mediaHydrationRetryCountById = new Map();
    state.richContentSignatureById = new Map();
  }

  function scheduleMediaHydrationRescan(messageId, source) {
    if (!messageId) return;
    if ((state.mediaHydrationRetryCountById.get(messageId) || 0) >= 4) return;
    if (state.mediaHydrationRescanTimers.has(messageId)) return;
    if (state.mediaHydrationRescanTimers.size >= 8) {
      DEBUG_STATE.mediaHydrationRenderSuppressedCount += 1;
      debugLog("warn", "media hydration schedule suppressed: too many pending timers", { messageId, source: source || "scan" });
      return;
    }

    const delays = [300, 1000, 2500, 5000];
    const timers = delays.map((delay) => setTimeout(() => {
      runMediaHydrationRescan(messageId, source || "scan", delay);
    }, delay));

    state.mediaHydrationRescanTimers.set(messageId, timers);
    DEBUG_STATE.mediaHydrationRescanScheduledCount += delays.length;
    DEBUG_STATE.mediaHydrationMessageIds = uniqueStrings(DEBUG_STATE.mediaHydrationMessageIds.concat([messageId])).slice(-20);

    const now = Date.now();
    if (!state.lastMediaHydrationLogAt || now - state.lastMediaHydrationLogAt > 2000) {
      state.lastMediaHydrationLogAt = now;
      debugLog("info", "media hydration rescan scheduled", { messageId, source: source || "scan" });
    }
  }

  function runMediaHydrationRescan(messageId, source, delay) {
    const retries = state.mediaHydrationRetryCountById.get(messageId) || 0;
    if (retries >= 4) {
      clearMediaHydrationRescan(messageId);
      return;
    }

    state.mediaHydrationRetryCountById.set(messageId, retries + 1);
    DEBUG_STATE.mediaHydrationRescanRunCount += 1;
    DEBUG_STATE.lastMediaHydrationRescanAt = new Date().toISOString();

    const previousSignature = state.richContentSignatureById.get(messageId) || "";
    scanMessages("media-hydration-rescan", false);
    const nextSignature = state.richContentSignatureById.get(messageId) || "";
    const changed = previousSignature !== nextSignature;

    if (changed) {
      DEBUG_STATE.lastMediaHydrationChangedMessageId = messageId;
      DEBUG_STATE.lastRichContentChangedMessageId = messageId;
      renderNav("media-hydration-changed", true);
      scheduleDebugPanelRefresh(true);
      setupScrollSpy();
    } else {
      DEBUG_STATE.mediaHydrationRenderSuppressedCount += 1;
    }

    const message = state.userMessages.find((item) => item.messageId === messageId || item.id === messageId);
    if (message && message.hasImage && !hasPendingMediaHydrationSignal(message.element, message)) {
      state.mediaHydrationRetryCountById.set(messageId, 4);
      clearMediaHydrationRescan(messageId);
    }

    if (retries + 1 >= 4) clearMediaHydrationRescan(messageId);

    const now = Date.now();
    if (!state.lastMediaHydrationLogAt || now - state.lastMediaHydrationLogAt > 2000 || changed) {
      state.lastMediaHydrationLogAt = now;
      debugLog("info", "media hydration rescan run", {
        messageId,
        source,
        delay,
        changed
      });
    }
  }

  function extractMessageTime(element) {
    const candidates = Array.from(element.querySelectorAll("time[datetime],[datetime]"));
    for (const node of candidates) {
      const raw = node.getAttribute("datetime");
      const date = raw ? new Date(raw) : null;
      if (date && !Number.isNaN(date.getTime())) {
        return { raw: date.toISOString(), source: "real-dom-time" };
      }
    }

    const attrNodes = Array.from(element.querySelectorAll("[title],[aria-label]"));
    for (const node of attrNodes) {
      const value = (node.getAttribute("title") || node.getAttribute("aria-label") || "").trim();
      if (!value) continue;
      const maybe = Date.parse(value);
      if (!Number.isNaN(maybe) && /(\d{4}|\d{1,2}[:：]\d{2}|上午|下午|周|月|日)/.test(value)) {
        return { raw: new Date(maybe).toISOString(), source: "real-dom-time" };
      }
    }

    return { raw: null, source: null };
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatDateTimeLabel(raw) {
    if (!raw) return "";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "";
    return date.getFullYear() + "/" + pad2(date.getMonth() + 1) + "/" + pad2(date.getDate()) + " " + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
  }

  function formatDateKey(date) {
    return date.getFullYear() + "/" + pad2(date.getMonth() + 1) + "/" + pad2(date.getDate());
  }

  function formatMonthKey(date) {
    return date.getFullYear() + "/" + pad2(date.getMonth() + 1);
  }

  function getMonday(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return d;
  }

  function getWeekMeta(date) {
    const monday = getMonday(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekKey = formatDateKey(monday) + "-" + formatDateKey(sunday);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstMonday = getMonday(monthStart);
    const weekIndex = Math.floor((monday.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return {
      weekKey,
      weekLabel: formatDateKey(monday) + " - " + formatDateKey(sunday),
      weekOfMonthKey: "week-" + weekIndex,
      weekOfMonthLabel: t("weekNumber", { count: weekIndex })
    };
  }

  function getTimeBucket(date) {
    const hour = date.getHours();
    if (hour < 6) return { key: "early_morning", label: t("earlyMorning") };
    if (hour < 12) return { key: "morning", label: t("morning") };
    if (hour < 14) return { key: "noon", label: t("noon") };
    if (hour < 18) return { key: "afternoon", label: t("afternoon") };
    return { key: "evening", label: t("evening") };
  }

  function buildTimeMeta(realTime, capturedInfo) {
    const raw = realTime.raw || (capturedInfo && capturedInfo.raw) || null;
    const source = realTime.raw ? "real-dom-time" : capturedInfo && capturedInfo.raw ? "captured-record-time" : null;
    if (!raw) {
      return {
        raw: null,
        label: null,
        displayLabel: "",
        dateKey: null,
        monthKey: null,
        weekKey: null,
        weekLabel: null,
        weekOfMonthLabel: null,
        weekOfMonthKey: null,
        weekdayIndex: null,
        weekdayLabel: null,
        timeBucketKey: null,
        timeBucketLabel: null,
        source: null
      };
    }

    const date = new Date(raw);
    const week = getWeekMeta(date);
    const bucket = getTimeBucket(date);
    const weekdayIndex = date.getDay() === 0 ? 7 : date.getDay();
    const weekdayLabels = ["", t("weekday1"), t("weekday2"), t("weekday3"), t("weekday4"), t("weekday5"), t("weekday6"), t("weekday7")];
    const label = formatDateTimeLabel(raw);

    return {
      raw,
      label,
      displayLabel: source === "captured-record-time" ? t("recordedPrefix") + label : label,
      dateKey: formatDateKey(date),
      monthKey: formatMonthKey(date),
      weekKey: week.weekKey,
      weekLabel: week.weekLabel,
      weekOfMonthLabel: week.weekOfMonthLabel,
      weekOfMonthKey: week.weekOfMonthKey,
      weekdayIndex,
      weekdayLabel: weekdayLabels[weekdayIndex],
      timeBucketKey: bucket.key,
      timeBucketLabel: bucket.label,
      source
    };
  }

  function parseTags(input) {
    return uniqueStrings(String(input || "")
      .split(/[,\uFF0C]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => tag.replace(/^#/, "")));
  }

  function updateTagsDebug() {
    const summary = getTagsSummaryFromStore();
    DEBUG_STATE.tagStorageKey = getTagsStorageKey();
    DEBUG_STATE.tagCount = summary.length;
    DEBUG_STATE.taggedMessageCount = Object.values(state.tags).filter((entry) => entry && entry.tags && entry.tags.length).length;
    DEBUG_STATE.activeTagFilter = state.activeTagFilter;
  }

  function getTagsSummaryFromStore() {
    const countMap = new Map();
    Object.values(state.tags).forEach((entry) => {
      (entry.tags || []).forEach((tag) => {
        countMap.set(tag, (countMap.get(tag) || 0) + 1);
      });
    });
    return Array.from(countMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  function editTags(message) {
    const current = message.tags || [];
    const input = prompt(t("enterTags"), current.join(", "));
    if (input == null) return;

    const tags = parseTags(input);
    if (tags.length) {
      state.tags[message.messageId] = {
        messageId: message.messageId,
        tags,
        updatedAtRaw: new Date().toISOString(),
        messagePreview: getSingleLinePreview(message.displayText || message.rawText || message.preview, 80)
      };
      DEBUG_STATE.lastTagAction = "set";
    } else {
      delete state.tags[message.messageId];
      DEBUG_STATE.lastTagAction = "clear";
    }

    DEBUG_STATE.lastTaggedMessageId = message.messageId;
    DEBUG_STATE.lastTags = tags;
    saveTagsForCurrentConversation();
    debugLog("info", "tags updated", {
      messageId: message.messageId,
      tags,
      preview: message.preview
    });
    scanAndMaybeRender("tag-update", true);
  }

  function setActiveTagFilter(tag) {
    state.activeTab = "tags";
    state.activeTagFilter = tag || "";
    applyVisibilityFallbacks("set-active-tag-filter");
    saveViewStateForCurrentConversation();
    debugLog("info", "tag filter changed", { activeTagFilter: state.activeTagFilter });
    renderNav("tag-filter", true);
  }

  function markSendAction(source) {
    state.lastUserSendActionAt = Date.now();
    DEBUG_STATE.lastUserSendActionAt = new Date(state.lastUserSendActionAt).toISOString();
    debugLog("info", "send action observed", { source });
  }

  function setupSendActionListeners() {
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const isEditable = target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable || target.closest && target.closest('[contenteditable="true"]'));
      if (!isEditable) return;
      if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
        markSendAction("enter");
      }
    }, true);

    document.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest("button") : null;
      if (!button) return;
      const label = (button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent || "").trim();
      if (/发送|send/i.test(label) || button.querySelector('svg, [data-icon*="send" i]')) {
        markSendAction("button");
      }
    }, true);
  }

  function scanMessages(reason, force) {
    const scanConversationId = getConversationId();
    const allowedSwitchScan = reason === "conversation-change-delayed-scan" || reason === "conversation-change-stable-scan";
    DEBUG_STATE.scanConversationId = scanConversationId;
    DEBUG_STATE.stateConversationIdAtScan = state.currentConversationId;
    if (scanConversationId !== state.currentConversationId) {
      DEBUG_STATE.staleScanSkippedCount += 1;
      DEBUG_STATE.lastSkippedScanReason = "stale-conversation-id:" + (reason || "scan");
      debugLog("warn", "scan skipped: stale conversation id", {
        reason,
        scanConversationId,
        currentConversationId: state.currentConversationId
      });
      return false;
    }
    if (state.isSwitchingConversation && !allowedSwitchScan) {
      DEBUG_STATE.staleScanSkippedCount += 1;
      DEBUG_STATE.lastSkippedScanReason = "conversation-switch-in-progress:" + (reason || "scan");
      debugLog("warn", "scan skipped: conversation switch in progress", { reason, currentConversationId: state.currentConversationId });
      return false;
    }
    if (state.conversationSwitchStartedAt && Date.now() - state.conversationSwitchStartedAt < 500 && !allowedSwitchScan) {
      DEBUG_STATE.staleScanSkippedCount += 1;
      DEBUG_STATE.lastSkippedScanReason = "route-transition-guard:" + (reason || "scan");
      debugLog("warn", "scan skipped: route transition guard", { reason, currentConversationId: state.currentConversationId });
      return false;
    }

    DEBUG_STATE.scanCount += 1;
    DEBUG_STATE.lastScanTime = new Date().toISOString();
    DEBUG_STATE.lastScanReason = reason;

    const userNodes = Array.from(document.querySelectorAll(USER_SELECTOR));
    const assistantNodes = Array.from(document.querySelectorAll(ASSISTANT_SELECTOR));
    const messages = [];
    const ids = [];
    const textLengths = [];
    const richContentSignatures = [];
    const previousRichContentSignatures = state.richContentSignatureById;
    const nextRichContentSignatures = new Map();

    let attachmentMessageCount = 0;
    let imageMessageCount = 0;
    let imageCandidateTotal = 0;
    let imageAcceptedTotal = 0;
    let imagePendingSizeTotal = 0;
    let quoteCount = 0;
    let realTimeCount = 0;
    let capturedTimeCount = 0;
    let recordedTimeCount = 0;
    let noTimeCount = 0;

    userNodes.forEach((element, index) => {
      const messageId = element.getAttribute("data-message-id") || "user-" + index;
      observeMediaImages(element);
      const parts = extractUserMessageParts(element, { index: index + 1 });
      const textForHash = parts.rawText || parts.mainText || parts.displayText || "";
      ids.push(messageId);
      textLengths.push(String(textForHash).length);

      const isKnown = state.seenMessageIds.has(messageId);
      if (!isKnown) {
        if (!state.initialBaselineReady) {
          state.seenMessageIds.add(messageId);
        } else if (index >= userNodes.length - 2) {
          const raw = new Date().toISOString();
          state.capturedAtById[messageId] = {
            raw,
            capturedAtRaw: raw,
            capturedAtSource: "current-session-new-message"
          };
          state.seenMessageIds.add(messageId);
          DEBUG_STATE.currentSessionCapturedMessageCount += 1;
          DEBUG_STATE.currentSessionNewMessageCapturedCount += 1;
          DEBUG_STATE.lastCapturedMessageId = messageId;
          saveCapturedTimesForCurrentConversation();
        } else {
          state.seenMessageIds.add(messageId);
          DEBUG_STATE.skippedHistoricalCaptureCount += 1;
          DEBUG_STATE.skippedNonTailHistoricalMessageCount += 1;
        }
      }

      const realTime = extractMessageTime(element);
      const capturedStored = state.capturedAtById[messageId];
      const capturedInfo = capturedStored ? {
        raw: capturedStored.raw || capturedStored.capturedAtRaw,
        source: capturedStored.capturedAtSource || "current-session-new-message"
      } : null;
      const timeMeta = buildTimeMeta(realTime, capturedInfo);

      if (realTime.raw) realTimeCount += 1;
      if (capturedInfo && capturedInfo.raw) capturedTimeCount += 1;
      if (timeMeta.source === "captured-record-time") recordedTimeCount += 1;
      if (!timeMeta.raw) noTimeCount += 1;
      if (parts.hasAttachment) attachmentMessageCount += 1;
      if (parts.hasImage) imageMessageCount += 1;
      imageCandidateTotal += Number(parts.imageCandidateCount || 0);
      imageAcceptedTotal += Number(parts.imageAcceptedCount || 0);
      imagePendingSizeTotal += Number(parts.imagePendingSizeCount || 0);
      if (parts.hasQuote) quoteCount += 1;

      const displaySource = parts.displayText || parts.mainText || parts.rawText;
      const preview = getSingleLinePreview(displaySource, 60);
      const multiline = getMultilinePreview(displaySource, state.preferences.maxPreviewLength, state.preferences.maxPreviewLines);
      const fullMultiline = getMultilinePreview(displaySource, 10000, 1000);
      const bookmark = state.bookmarks[messageId];
      const tagEntry = state.tags[messageId];
      const tags = tagEntry && Array.isArray(tagEntry.tags) ? tagEntry.tags : [];

      const message = {
        index: index + 1,
        element,
        messageId,
        id: messageId,
        mainText: parts.mainText,
        rawText: parts.rawText,
        displayText: parts.displayText,
        preview,
        displayPreviewMultiline: multiline || t("onlyMeta"),
        displayFullText: fullMultiline || t("onlyMeta"),
        displayPreviewTruncated: fullMultiline.length > multiline.length || (parts.displayText || "").length > state.preferences.maxPreviewLength,
        quotedTexts: parts.quotedTexts,
        quotedPreview: parts.quotedPreview,
        hasQuote: parts.hasQuote,
        quoteDomDetected: parts.hasQuote,
        quoteDetectSource: parts.quoteDetectSource,
        quoteCardNodeCount: parts.quoteCardNodeCount,
        hasImage: parts.hasImage,
        imageCount: parts.imageCount,
        imageDetectionConfidence: parts.imageDetectionConfidence,
        imageCandidateCount: parts.imageCandidateCount,
        imageAcceptedCount: parts.imageAcceptedCount,
        imagePendingSizeCount: parts.imagePendingSizeCount,
        imageAcceptedByAriaOnlyCount: parts.imageAcceptedByAriaOnlyCount,
        hasAttachment: parts.hasAttachment,
        attachmentNames: parts.attachmentNames,
        attachmentCount: parts.attachmentCount,
        smartPreviewApplied: false,
        mainTextSource: parts.mainTextSource,
        isBookmarked: !!bookmark,
        bookmarkName: bookmark ? bookmark.name : "",
        tags,
        hasTags: tags.length > 0,
        timeMeta,
        messageTimeRaw: realTime.raw,
        messageTimeLabel: realTime.raw ? timeMeta.label : "",
        capturedAtRaw: capturedInfo ? capturedInfo.raw : null,
        capturedAtLabel: capturedInfo ? formatDateTimeLabel(capturedInfo.raw) : "",
        capturedAtSource: capturedInfo ? capturedInfo.source : null
      };
      message.richContentSignature = buildRichContentSignature(message);
      richContentSignatures.push(message.richContentSignature);
      nextRichContentSignatures.set(messageId, message.richContentSignature);

      if (previousRichContentSignatures.get(messageId) && previousRichContentSignatures.get(messageId) !== message.richContentSignature) {
        DEBUG_STATE.richContentSignatureChangedCount += 1;
        DEBUG_STATE.lastRichContentChangedMessageId = messageId;
      }

      if (shouldScheduleMediaHydrationRescan(element, parts)) {
        scheduleMediaHydrationRescan(messageId, reason || "scan");
      }

      messages.push(message);
    });

    if (!state.initialBaselineReady && (userNodes.length > 0 || reason === "delayed-init-5")) {
      userNodes.forEach((element, index) => {
        const id = element.getAttribute("data-message-id") || "user-" + index;
        state.seenMessageIds.add(id);
      });
      state.initialBaselineReady = true;
      DEBUG_STATE.initialBaselineReady = true;
      debugLog("info", "initial baseline ready", { userMessageCount: userNodes.length, reason });
    }

    const richContentSignature = richContentSignatures.join("||");
    const registryMessages = mergeVisibleMessagesIntoRegistry(messages);
    const registrySignature = registryMessages.map((message) => [
      message.messageId,
      String(message.rawText || message.displayText || message.mainText || "").length,
      message.richContentSignature || "",
      message.offscreen ? "cached" : "visible",
      message.timeMeta && message.timeMeta.raw ? message.timeMeta.raw : ""
    ].join(":")).join("||");
    const messageHash = state.messageOrder.join("|") + "::" + registrySignature + "::" + Object.keys(state.bookmarks).length + "::" + Object.keys(state.capturedAtById).length + "::" + JSON.stringify(state.tags) + "::" + JSON.stringify(state.preferences);
    const sameHash = state.messageHash === messageHash;
    state.userMessages = registryMessages;
    state.messageHash = messageHash;
    state.richContentSignatureById = nextRichContentSignatures;

    DEBUG_STATE.currentUrl = location.href;
    DEBUG_STATE.lastUrl = state.lastUrl;
    DEBUG_STATE.userMessageCount = state.userMessages.length;
    DEBUG_STATE.assistantMessageCount = assistantNodes.length;
    DEBUG_STATE.userSelectorCount = userNodes.length;
    DEBUG_STATE.assistantSelectorCount = assistantNodes.length;
    DEBUG_STATE.visibleDomUserMessageCount = userNodes.length;
    DEBUG_STATE.firstUserTextPreview = state.userMessages[0] ? state.userMessages[0].preview : "";
    DEBUG_STATE.lastUserTextPreview = state.userMessages[state.userMessages.length - 1] ? state.userMessages[state.userMessages.length - 1].preview : "";
    DEBUG_STATE.lastMessageHash = messageHash;
    DEBUG_STATE.lastRichContentSignature = richContentSignature.slice(0, 1200);
    DEBUG_STATE.attachmentMessageCount = attachmentMessageCount;
    DEBUG_STATE.imageMessageCount = imageMessageCount;
    DEBUG_STATE.messagesWithQuoteCount = quoteCount;
    DEBUG_STATE.quoteDomDetectedCount = 0;
    DEBUG_STATE.smartPreviewAppliedCount = 0;
    DEBUG_STATE.quotedContentMessageCount = 0;
    DEBUG_STATE.imageCandidateCount = imageCandidateTotal;
    DEBUG_STATE.imageAcceptedCount = imageAcceptedTotal;
    DEBUG_STATE.imagePendingSizeCount = imagePendingSizeTotal;
    DEBUG_STATE.messagesWithRealTimeLabelCount = realTimeCount;
    DEBUG_STATE.messagesWithCapturedTimeLabelCount = capturedTimeCount;
    DEBUG_STATE.messagesWithRecordedDateTimeCount = recordedTimeCount;
    DEBUG_STATE.noTimeMessageCount = noTimeCount;
    DEBUG_STATE.bookmarkCount = Object.keys(state.bookmarks).length;
    updateTagsDebug();

    debugLog("info", "scan complete", {
      reason,
      userMessageCount: userNodes.length,
      assistantMessageCount: assistantNodes.length,
      messageHash
    });

    if (sameHash && state.lastRenderedUrl === location.href) {
      DEBUG_STATE.skippedRenderCount += 1;
      DEBUG_STATE.renderSkippedBecauseHashUnchanged += 1;
      debugLog("info", "render skipped: no changes", { reason });
      updateDebugSnapshot();
      setupScrollSpy();
      return false;
    }

    return true;
  }

  function scanAndMaybeRender(reason, force) {
    safeRun("scanAndMaybeRender failed", () => {
      const shouldRender = scanMessages(reason, !!force);
      if (shouldRender) renderNav(reason, true);
      setupScrollSpy();
    });
  }

  function updateDebugSnapshot() {
    DEBUG_STATE.floatingPanelExists = !!document.getElementById(PANEL_ID);
    DEBUG_STATE.navListExists = !!state.navList;
    DEBUG_STATE.searchInputExists = !!state.searchInput;
    DEBUG_STATE.debugPanelExists = !!state.debugPanel;
    DEBUG_STATE.isCollapsed = state.collapsed;
    DEBUG_STATE.isPanelHidden = state.hidden;
    DEBUG_STATE.settingsMode = state.settingsVisible;
    DEBUG_STATE.helpMode = state.helpVisible;
    DEBUG_STATE.beforeHelpWasCollapsed = !!(state.beforeHelpState && state.beforeHelpState.wasCollapsed);
    DEBUG_STATE.activeMessageId = state.activeMessageId;
    DEBUG_STATE.activeViewTab = state.activeTab;
    DEBUG_STATE.timeFolderMode = state.timeFolderMode;
    DEBUG_STATE.activeTagFilter = state.activeTagFilter;
    DEBUG_STATE.currentConversationId = state.currentConversationId;
    DEBUG_STATE.preferences = { ...state.preferences };
    DEBUG_STATE.preferencesStorageKey = getPreferencesStorageKey();
    DEBUG_STATE.visibleTabs = { ...state.preferences.visibleTabs };
    DEBUG_STATE.hiddenTabs = hiddenKeys(state.preferences.visibleTabs, TAB_ORDER);
    DEBUG_STATE.visibleTimeModes = { ...state.preferences.visibleTimeModes };
    DEBUG_STATE.hiddenTimeModes = hiddenKeys(state.preferences.visibleTimeModes, TIME_MODE_ORDER);
    DEBUG_STATE.tagStorageKey = getTagsStorageKey();
    DEBUG_STATE.storageKeysShown = getStorageKeysSummary();

    if (state.panel) {
      const rect = state.panel.getBoundingClientRect();
      DEBUG_STATE.panelWidth = Math.round(rect.width);
      DEBUG_STATE.panelHeight = Math.round(rect.height);
      DEBUG_STATE.panelLeft = Math.round(rect.left);
      DEBUG_STATE.panelTop = Math.round(rect.top);
      DEBUG_STATE.panelRight = Math.round(rect.right);
      DEBUG_STATE.panelBottom = Math.round(rect.bottom);
      updateCountLabel();
    }
  }

  function updateStaticTexts() {
    if (!state.panel) return;
    const title = state.panel.querySelector(".gpn-title");
    if (title) title.textContent = t("myPrompts");

    const helpBtn = state.panel.querySelector('[data-action="help"]');
    if (helpBtn) helpBtn.title = t("helpTitle");

    const settingsBtn = state.panel.querySelector('[data-action="settings"]');
    if (settingsBtn) settingsBtn.title = t("settings");

    const debugBtn = state.panel.querySelector('[data-action="debug"]');
    if (debugBtn) debugBtn.textContent = t("debug");

    const refreshBtn = state.panel.querySelector('[data-action="refresh"]');
    if (refreshBtn) refreshBtn.textContent = t("refresh");

    const collapseBtn = state.panel.querySelector('[data-action="collapse"]');
    if (collapseBtn) collapseBtn.textContent = state.collapsed ? t("expand") : t("collapse");

    const tabs = state.panel.querySelectorAll(".gpn-tab");
    tabs.forEach((button) => {
      button.textContent = tabLabel(button.dataset.tab);
    });

    if (state.searchInput) state.searchInput.placeholder = t("searchPlaceholder");

    const footer = state.panel.querySelector(".gpn-footer");
    if (footer) footer.textContent = t("footer");
  }

  function updateCountLabel() {
    if (!state.panel) return;
    const count = state.panel.querySelector(".gpn-count");
    if (!count) return;
    count.textContent = DEBUG_STATE.userMessageCount ? DEBUG_STATE.userMessageCount + (state.preferences.uiLanguage === "en" ? "" : " 条") : "0";
  }

  function shouldAutoScrollNavList(reason) {
    return [
      "shortcut-next",
      "shortcut-prev",
      "search-keyboard-next",
      "search-keyboard-prev",
      "explicit-scroll-active"
    ].includes(reason || "");
  }

  function scrollActiveItemIntoView(reason) {
    if (!state.navList || !state.activeMessageId) return;
    const item = state.navList.querySelector('.gpn-item[data-message-id="' + cssEscape(state.activeMessageId) + '"]');
    DEBUG_STATE.navListAutoScrollReason = reason || null;
    if (!item) {
      DEBUG_STATE.activeItemMissingNoFallback = true;
      DEBUG_STATE.preventedFallbackToFirstItem = true;
      debugLog("warn", "active item missing; no nav fallback", { reason, activeMessageId: state.activeMessageId });
      return;
    }
    DEBUG_STATE.activeItemMissingNoFallback = false;
    item.scrollIntoView({ behavior: "smooth", block: "nearest" });
    state.scrollSpyLastListScrollAt = Date.now();
  }

  function requestNavListAutoScroll(reason) {
    if (!shouldAutoScrollNavList(reason)) {
      DEBUG_STATE.navListAutoScrollSuppressed = true;
      DEBUG_STATE.navListAutoScrollReason = reason || null;
      return;
    }
    DEBUG_STATE.navListAutoScrollSuppressed = false;
    scrollActiveItemIntoView(reason);
  }

  function renderNav(reason, force) {
    if (!state.navList) return;

    applyVisibilityFallbacks("render-nav");
    updateStaticTexts();

    const search = (state.searchInput && state.searchInput.value || "").trim().toLowerCase();
    const previousNavScrollTop = state.navList.scrollTop;
    DEBUG_STATE.navListScrollTopBeforeRender = previousNavScrollTop;
    DEBUG_STATE.navListScrollRestored = false;
    DEBUG_STATE.navListAutoScrollReason = reason || null;
    state.navList.innerHTML = "";

    renderTabs();
    if (state.activeTab === "all") renderAllView(search);
    else if (state.activeTab === "time") renderTimeView(search);
    else if (state.activeTab === "bookmarks") renderBookmarkView(search);
    else renderTagView(search);

    state.lastRenderedHash = state.messageHash;
    state.lastRenderedUrl = location.href;
    state.lastRenderedSearch = search;
    DEBUG_STATE.lastRenderTime = new Date().toISOString();
    DEBUG_STATE.renderedNavItemCount = state.navList.querySelectorAll(".gpn-item").length;
    debugLog("info", "render complete", {
      reason: reason || "renderNav",
      force: !!force,
      activeTab: state.activeTab,
      renderedNavItemCount: DEBUG_STATE.renderedNavItemCount
    });
    updateActiveItemClasses();
    if (shouldAutoScrollNavList(reason)) {
      requestNavListAutoScroll(reason);
    } else {
      state.navList.scrollTop = previousNavScrollTop;
      DEBUG_STATE.navListScrollRestored = true;
      DEBUG_STATE.navListAutoScrollSuppressed = true;
      DEBUG_STATE.registryMergeRenderSuppressedAutoScroll = /mutation|media|registry|scan|render/i.test(String(reason || ""));
      DEBUG_STATE.navListScrollRestoredAfterRegistryMerge = DEBUG_STATE.registryMergeRenderSuppressedAutoScroll;
      DEBUG_STATE.preventedScrollTopResetToZero = previousNavScrollTop > 0 && state.navList.scrollTop === previousNavScrollTop;
    }
    DEBUG_STATE.navListScrollTopAfterRender = state.navList.scrollTop;
    updateDebugSnapshot();
    scheduleDebugPanelRefresh(true);
  }

  function renderTabs() {
    if (!state.tabs) return;
    Array.from(state.tabs.querySelectorAll(".gpn-tab")).forEach((button) => {
      const tab = button.dataset.tab;
      button.hidden = !state.preferences.visibleTabs[tab];
      button.textContent = tabLabel(tab);
      button.classList.toggle("gpn-active", tab === state.activeTab);
    });
  }

  function messageMatchesSearch(message, search) {
    if (!search) return true;
    const haystack = [
      message.rawText,
      message.displayText,
      message.mainText,
      message.preview,
      message.bookmarkName,
      (message.tags || []).join(" "),
      message.quotedPreview,
      (message.attachmentNames || []).join(" "),
      message.timeMeta && message.timeMeta.displayLabel
    ].join("\n").toLowerCase();
    return haystack.includes(search);
  }

  function createViewContainer(className) {
    const view = document.createElement("div");
    view.className = "gpn-view-container gpn-scroll-area " + className;
    return view;
  }

  function renderAllView(search) {
    const view = createViewContainer("gpn-all-view");
    state.userMessages.filter((message) => messageMatchesSearch(message, search)).forEach((message) => {
      view.appendChild(createMessageItem(message, { showTimeLabel: true, showTags: true }));
    });

    if (!view.childNodes.length) {
      view.appendChild(createEmptyNode(search ? t("noMatchingPrompts") : t("noPromptsYet")));
    }

    state.navList.appendChild(view);
  }

  function renderBookmarkView(search) {
    const view = createViewContainer("gpn-bookmark-view");
    const messageById = new Map(state.userMessages.map((message) => [message.messageId, message]));
    const bookmarkEntries = Object.values(state.bookmarks).sort((a, b) => String(b.updatedAtRaw || b.createdAtRaw).localeCompare(String(a.updatedAtRaw || a.createdAtRaw)));

    let resultCount = 0;
    let matchedByNameCount = 0;

    bookmarkEntries.forEach((bookmark) => {
      const message = messageById.get(bookmark.messageId);
      const bookmarkName = String(bookmark.name || "").toLowerCase();
      const nameMatch = !!search && bookmarkName.includes(search);

      if (message) {
        const contentMatch = messageMatchesSearch(message, search);
        if (search && !nameMatch && !contentMatch) return;
        if (nameMatch) matchedByNameCount += 1;
        resultCount += 1;
        view.appendChild(createMessageItem(message, { showBookmarkName: true, showTimeLabel: true, showTags: true }));
      } else {
        const text = [bookmark.name, bookmark.messagePreview].join("\n").toLowerCase();
        if (search && !text.includes(search)) return;
        if (nameMatch) matchedByNameCount += 1;
        resultCount += 1;
        view.appendChild(createMissingBookmarkItem(bookmark));
      }
    });

    DEBUG_STATE.lastBookmarkSearchKeyword = search;
    DEBUG_STATE.bookmarkSearchResultCount = resultCount;
    DEBUG_STATE.bookmarkSearchMatchedByNameCount = matchedByNameCount;

    if (!view.childNodes.length) {
      view.appendChild(createEmptyNode(search ? t("noMatchingPrompts") : t("bookmarks")));
    }

    state.navList.appendChild(view);
  }

  function renderTagView(search) {
    const view = createViewContainer("gpn-tag-view");
    const summary = getTagsSummaryFromStore();
    const messageById = new Map(state.userMessages.map((message) => [message.messageId, message]));

    const filterBar = document.createElement("div");
    filterBar.className = "gpn-tag-filter-bar";

    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.className = "gpn-tag-filter";
    allButton.classList.toggle("gpn-active", !state.activeTagFilter);
    allButton.textContent = t("allTags");
    allButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setActiveTagFilter("");
    });
    filterBar.appendChild(allButton);

    summary.forEach((item) => {
      if (search && !item.tag.toLowerCase().includes(search) && !hasTaggedMessageMatchingSearch(item.tag, search, messageById)) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gpn-tag-filter";
      button.classList.toggle("gpn-active", state.activeTagFilter === item.tag);
      button.textContent = item.tag + "（" + item.count + "）";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setActiveTagFilter(item.tag);
      });
      filterBar.appendChild(button);
    });

    view.appendChild(filterBar);

    if (!summary.length) {
      view.appendChild(createEmptyNode(t("noTagsYet")));
      state.navList.appendChild(view);
      return;
    }

    const list = document.createElement("div");
    list.className = "gpn-tag-message-list gpn-scroll-area";

    const selectedTags = state.activeTagFilter ? summary.filter((item) => item.tag === state.activeTagFilter) : summary;

    selectedTags.forEach((item) => {
      const group = document.createElement("div");
      group.className = "gpn-tag-group";

      const header = document.createElement("div");
      header.className = "gpn-tag-group-title";
      header.textContent = "#" + item.tag + "（" + item.count + "）";
      group.appendChild(header);

      Object.values(state.tags).forEach((entry) => {
        if (!entry || !entry.tags || !entry.tags.includes(item.tag)) return;

        const message = messageById.get(entry.messageId);
        if (message) {
          if (search && !messageMatchesSearch(message, search) && !item.tag.toLowerCase().includes(search)) return;
          group.appendChild(createMessageItem(message, { showTimeLabel: true, showTags: true, compact: true }));
        } else {
          const text = [item.tag, entry.messagePreview].join("\n").toLowerCase();
          if (search && !text.includes(search)) return;
          group.appendChild(createMissingTagItem(entry, item.tag));
        }
      });

      if (group.childNodes.length > 1) list.appendChild(group);
    });

    if (!list.childNodes.length) {
      list.appendChild(createEmptyNode(t("noMatchingTags")));
    }

    view.appendChild(list);
    state.navList.appendChild(view);
  }

  function hasTaggedMessageMatchingSearch(tag, search, messageById) {
    return Object.values(state.tags).some((entry) => {
      if (!entry.tags || !entry.tags.includes(tag)) return false;
      const message = messageById.get(entry.messageId);
      if (message) return messageMatchesSearch(message, search);
      return String(entry.messagePreview || "").toLowerCase().includes(search);
    });
  }

  function renderTimeView(search) {
    const view = createViewContainer("gpn-time-view");
    const controls = createTimeControls();
    view.appendChild(controls);

    const summary = document.createElement("div");
    summary.className = "gpn-time-search-summary";
    summary.hidden = true;
    view.appendChild(summary);

    const folderList = document.createElement("div");
    folderList.className = "gpn-time-folder-list gpn-scroll-area";
    view.appendChild(folderList);
    state.navList.appendChild(view);
    renderTimeFolderListOnly("time-view-render", search);
  }

  function getTimeTextSearchValue(search) {
    return normalizeText(search != null ? search : (state.searchInput && state.searchInput.value) || "").toLowerCase();
  }

  function buildTimeFolderCache(textSearch) {
    const normalizedTextSearch = getTimeTextSearchValue(textSearch);
    const cache = state.timeFolderCache;
    const cacheHit =
      cache &&
      cache.messageHash === state.messageHash &&
      cache.mode === state.timeFolderMode &&
      cache.textSearch === normalizedTextSearch &&
      cache.folders;

    DEBUG_STATE.timeSearchFolderCacheHit = !!cacheHit;
    if (cacheHit) return cache;

    let timedMessages = state.userMessages.filter((message) => message.timeMeta && message.timeMeta.raw);
    let noTimeMessages = state.userMessages.filter((message) => !message.timeMeta || !message.timeMeta.raw);
    if (normalizedTextSearch) {
      timedMessages = timedMessages.filter((message) => messageMatchesSearch(message, normalizedTextSearch));
      noTimeMessages = noTimeMessages.filter((message) => messageMatchesSearch(message, normalizedTextSearch));
    }
    const data =
      state.timeFolderMode === "week" ? buildWeekFolders(timedMessages) :
      state.timeFolderMode === "day" ? buildDayFolders(timedMessages) :
      buildMonthFolders(timedMessages);
    data.noTimeMessages = noTimeMessages;

    const nextCache = {
      messageHash: state.messageHash,
      mode: state.timeFolderMode,
      textSearch: normalizedTextSearch,
      folders: data.folders,
      noTimeMessages,
      folderSearchIndex: buildTimeFolderSearchIndex(data.folders)
    };
    state.timeFolderCache = nextCache;
    DEBUG_STATE.timeSearchFolderCacheRebuildCount += 1;
    return nextCache;
  }

  function renderTimeFolderListOnly(reason, textSearch) {
    const startedAt = performance.now ? performance.now() : Date.now();
    const folderList = state.navList && state.navList.querySelector(".gpn-time-folder-list");
    if (!folderList) {
      DEBUG_STATE.timeSearchRenderMode = "full-render-fallback";
      renderNav(reason || "time-folder-list-fallback", true);
      return;
    }

    const summary = state.navList.querySelector(".gpn-time-search-summary");
    const cache = buildTimeFolderCache(textSearch);
    const filtered = filterTimeFoldersByKeyword(cache.folders, cache.folderSearchIndex, state.timeSearchKeyword);

    folderList.innerHTML = "";
    if (state.timeSearchKeyword && !filtered.folders.length && !cache.noTimeMessages.length) {
      folderList.appendChild(createEmptyNode(t("noDateRecords")));
    } else {
      filtered.folders.forEach((folder) => {
        folderList.appendChild(createFolderNode(folder, !!state.timeSearchKeyword));
      });
    }

    if (cache.noTimeMessages.length || !state.timeSearchKeyword) {
      const noTimeFolder = {
        key: "no-time",
        label: t("noRecordedTime"),
        count: cache.noTimeMessages.length,
        hint: state.timeSearchKeyword ? t("noTimeSearchHint") : "",
        children: [{ key: "no-time::items", label: t("noRecordedTime"), count: cache.noTimeMessages.length, messages: cache.noTimeMessages }]
      };
      folderList.appendChild(createFolderNode(noTimeFolder, true));
    }

    if (summary) {
      summary.hidden = !state.timeSearchKeyword;
      summary.textContent = state.timeSearchKeyword ? t("timeFolderSearchSummary", {
        folders: filtered.matchedFolderCount,
        messages: filtered.matchedMessageCount,
        noTime: cache.noTimeMessages.length
      }) : "";
    }

    DEBUG_STATE.timeFolderMode = state.timeFolderMode;
    DEBUG_STATE.timeFolderCount = filtered.folders.length;
    if (state.timeFolderMode === "month") DEBUG_STATE.monthFolderCount = filtered.folders.length;
    if (state.timeFolderMode === "week") DEBUG_STATE.weekFolderCount = filtered.folders.length;
    if (state.timeFolderMode === "day") DEBUG_STATE.dayFolderCount = filtered.folders.length;
    DEBUG_STATE.noTimeMessageCount = cache.noTimeMessages.length;
    DEBUG_STATE.timeSearchNoTimeCount = cache.noTimeMessages.length;
    DEBUG_STATE.timeSearchMatchedFolderCount = filtered.matchedFolderCount;
    DEBUG_STATE.timeSearchMatchedMessageCount = filtered.matchedMessageCount;
    DEBUG_STATE.timeSearchMatchedTimedCount = filtered.matchedMessageCount;
    DEBUG_STATE.timeSearchRenderMode = "folder-list-only";
    DEBUG_STATE.timeSearchLastRenderCostMs = Math.round(((performance.now ? performance.now() : Date.now()) - startedAt) * 10) / 10;
    return {
      ...filtered,
      noTimeCount: cache.noTimeMessages.length
    };
  }

  function buildTimeFolderSearchIndex(folders) {
    return (folders || []).map((folder) => {
      const childEntries = (folder.children || []).map((child) => ({
        key: child.key,
        searchText: buildTimeFolderSearchText(child, folder),
        messageIds: collectFolderMessageIds(child),
        folderRef: child
      }));
      const ownSearchText = buildTimeFolderSearchText(folder, null, false);
      return {
        folderKey: folder.key,
        parentKey: null,
        label: folder.label,
        ownSearchText,
        searchText: ownSearchText + " " + childEntries.map((child) => child.searchText).join(" "),
        mode: state.timeFolderMode,
        count: folder.count,
        folderRef: folder,
        matchedMessageIds: collectFolderMessageIds(folder),
        childKeys: childEntries.map((child) => child.key),
        children: childEntries
      };
    });
  }

  function buildTimeFolderSearchText(folder, parentFolder, includeMessages) {
    const messages = includeMessages === false ? [] : collectFolderMessages(folder);
    const parts = [
      folder && folder.label,
      folder && folder.shortLabel,
      folder && folder.rangeLabel,
      parentFolder && parentFolder.label
    ];
    messages.forEach((message) => {
      const meta = message.timeMeta || {};
      const dateKey = meta.dateKey || "";
      const monthKey = meta.monthKey || "";
      const dateParts = dateKey.split("/");
      const year = dateParts[0] || "";
      const month = dateParts[1] || "";
      const day = dateParts[2] || "";
      const compactDate = year && month && day ? year + month + day : "";
      const compactMonth = year && month ? year + month : "";
      const monthDay = month && day ? month + day : "";
      const looseMonthDay = month && day ? String(Number(month)) + String(Number(day)) : "";
      const weekNumber = String(meta.weekOfMonthLabel || "").replace(/\D/g, "");
      parts.push(
        meta.displayLabel,
        meta.label,
        meta.dateKey,
        meta.monthKey,
        meta.weekLabel,
        meta.weekOfMonthLabel,
        meta.weekdayLabel,
        meta.timeBucketLabel,
        compactDate,
        compactMonth,
        monthDay,
        looseMonthDay,
        month && day ? Number(month) + "/" + Number(day) : "",
        month && day ? month + "/" + day : "",
        day ? Number(day) + "日" : "",
        month ? Number(month) + "月" : "",
        year && month ? year + "年" + Number(month) + "月" : "",
        weekNumber ? "第" + weekNumber + "周" : "",
        weekNumber ? "第 " + weekNumber + " 周" : "",
        weekNumber ? "week " + weekNumber : "",
        /周六|Sat/i.test(meta.weekdayLabel || "") ? "周六 sat saturday" : "",
        /周日|Sun/i.test(meta.weekdayLabel || "") ? "周日 sun sunday" : "",
        /周一|Mon/i.test(meta.weekdayLabel || "") ? "周一 mon monday" : "",
        /周二|Tue/i.test(meta.weekdayLabel || "") ? "周二 tue tuesday" : "",
        /周三|Wed/i.test(meta.weekdayLabel || "") ? "周三 wed wednesday" : "",
        /周四|Thu/i.test(meta.weekdayLabel || "") ? "周四 thu thursday" : "",
        /周五|Fri/i.test(meta.weekdayLabel || "") ? "周五 fri friday" : "",
        meta.timeBucketKey === "morning" ? "morning 上午" : "",
        meta.timeBucketKey === "afternoon" ? "afternoon 下午" : "",
        meta.timeBucketKey === "evening" ? "evening 晚上" : "",
        meta.timeBucketKey === "noon" ? "noon 中午" : "",
        meta.timeBucketKey === "early_morning" ? "early morning late night 凌晨" : ""
      );
    });
    return normalizeTimeFolderSearchText(parts.filter(Boolean).join(" "));
  }

  function normalizeTimeFolderSearchText(text) {
    return normalizeText(text)
      .toLowerCase()
      .replace(/[年月.-]/g, "/")
      .replace(/日/g, "")
      .replace(/\s+/g, " ")
      .replace(/\/+/g, "/")
      .trim();
  }

  function collectFolderMessages(folder) {
    const out = [];
    if (!folder) return out;
    if (Array.isArray(folder.messages)) out.push(...folder.messages);
    (folder.children || []).forEach((child) => {
      if (Array.isArray(child.messages)) out.push(...child.messages);
    });
    return out;
  }

  function collectFolderMessageIds(folder) {
    return collectFolderMessages(folder).map((message) => message.messageId);
  }

  function cloneFolderWithChildren(folder, children) {
    const cloned = { ...folder };
    if (children) {
      cloned.children = children;
      cloned.count = children.reduce((sum, child) => sum + (child.count || 0), 0);
    }
    return cloned;
  }

  function createTimeControls() {
    const wrap = document.createElement("div");
    wrap.className = "gpn-time-controls";

    const modeWrap = document.createElement("div");
    modeWrap.className = "gpn-time-mode";

    TIME_MODE_ORDER.forEach((mode) => {
      if (!state.preferences.visibleTimeModes[mode]) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gpn-mini-btn";
      button.textContent = timeModeLabel(mode);
      button.classList.toggle("gpn-active", state.timeFolderMode === mode);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        state.timeFolderMode = mode;
        saveViewStateForCurrentConversation();
        debugLog("info", "time folder mode changed", { mode });
        renderNav("time-mode-change", true);
      });
      modeWrap.appendChild(button);
    });

    const searchWrap = document.createElement("div");
    searchWrap.className = "gpn-date-search-wrap";

    const input = document.createElement("input");
    input.className = "gpn-date-search";
    input.placeholder = getTimeSearchPlaceholder();
    input.value = state.timeSearchDraft || "";
    input.addEventListener("input", () => {
      clearTimeout(state.timeSearchDebounceTimer);
      state.timeSearchDraft = input.value;
      DEBUG_STATE.timeSearchDraft = state.timeSearchDraft;
      DEBUG_STATE.lastTimeSearchInputAt = new Date().toISOString();
      DEBUG_STATE.lastTimeSearchDebounceMs = 250;
      state.timeSearchDebounceTimer = setTimeout(() => {
        applyTimeFolderSearch(input.value, "input-debounce");
      }, 250);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        clearTimeout(state.timeSearchDebounceTimer);
        applyTimeFolderSearch(input.value, "enter");
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        clearTimeout(state.timeSearchDebounceTimer);
        state.timeSearchDraft = "";
        input.value = "";
        applyTimeFolderSearch("", "clear");
      }
    });

    const button = document.createElement("button");
    button.type = "button";
    button.className = "gpn-mini-btn";
    button.textContent = t("clear");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearTimeout(state.timeSearchDebounceTimer);
      state.timeSearchDraft = "";
      input.value = "";
      applyTimeFolderSearch("", "clear");
    });

    searchWrap.appendChild(input);
    searchWrap.appendChild(button);
    wrap.appendChild(modeWrap);
    wrap.appendChild(searchWrap);

    return wrap;
  }

  function createFolderNode(folder, defaultCollapsed) {
    const outer = document.createElement("div");
    outer.className = "gpn-folder";
    outer.dataset.folderKey = folder.key;

    const expanded = state.expandedTimeFolders[folder.key] === true;
    DEBUG_STATE.timeFolderDefaultCollapsed = true;
    DEBUG_STATE.autoExpandSuppressedInSearch = true;

    const header = document.createElement("button");
    header.type = "button";
    header.className = "gpn-folder-header";
    header.textContent = (expanded ? "▾ " : "▸ ") + folder.label + "（" + folder.count + "）";
    header.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.expandedTimeFolders[folder.key] = !expanded;
      saveViewStateForCurrentConversation();
      renderNav("folder-toggle", true);
    });

    const body = document.createElement("div");
    body.className = "gpn-folder-body";
    body.hidden = !expanded;

    if (folder.hint) {
      const hint = document.createElement("div");
      hint.className = "gpn-folder-hint";
      hint.textContent = folder.hint;
      body.appendChild(hint);
    }

    if (folder.children && folder.children.length) {
      folder.children.forEach((child) => {
        const childExpanded = state.expandedTimeFolders[child.key] === true;
        DEBUG_STATE.childFolderDefaultCollapsed = true;
        const childHeader = document.createElement("button");
        childHeader.type = "button";
        childHeader.className = "gpn-folder-child-header";
        childHeader.textContent = (childExpanded ? "▾ " : "▸ ") + child.label + "（" + child.count + "）";
        childHeader.dataset.folderKey = child.key;
        childHeader.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          state.expandedTimeFolders[child.key] = !childExpanded;
          saveViewStateForCurrentConversation();
          renderNav("folder-child-toggle", true);
        });
        body.appendChild(childHeader);

        const childBody = document.createElement("div");
        childBody.className = "gpn-folder-child-body";
        childBody.hidden = !childExpanded;
        (child.messages || []).forEach((message) => {
          childBody.appendChild(createMessageItem(message, { showTimeLabel: true, showTags: true, compact: true }));
        });
        body.appendChild(childBody);
      });
    } else {
      (folder.messages || []).forEach((message) => {
        body.appendChild(createMessageItem(message, { showTimeLabel: true, showTags: true, compact: true }));
      });
    }

    outer.appendChild(header);
    outer.appendChild(body);
    return outer;
  }

  function createMessageItem(message, options) {
    const item = document.createElement("div");
    item.className = "gpn-item";
    if (options && options.compact) item.classList.add("gpn-compact");
    if (message.messageId === state.activeMessageId) item.classList.add("gpn-active");
    item.dataset.messageId = message.messageId;
    item.dataset.navIndex = String(message.index || "");

    const index = document.createElement("div");
    index.className = "gpn-index";
    index.textContent = String(message.index);

    const icons = document.createElement("div");
    icons.className = "gpn-icons";
    if (message.hasQuote && state.preferences.showQuoteMeta) icons.appendChild(createIconBadge("↩", "quote"));
    if (message.hasImage && state.preferences.showImageMeta) icons.appendChild(createIconBadge("图", "image"));
    if (message.hasAttachment && state.preferences.showAttachmentMeta) icons.appendChild(createIconBadge("附", "attachment"));
    if (message.hasTags) icons.appendChild(createIconBadge("#", "tags"));
    if (!icons.childNodes.length) icons.appendChild(createIconBadge("", ""));

    const content = document.createElement("div");
    content.className = "gpn-content";

    const jumpZone = document.createElement("div");
    jumpZone.className = "gpn-jump-zone";
    jumpZone.dataset.messageId = message.messageId;
    jumpZone.tabIndex = 0;
    jumpZone.setAttribute("role", "button");

    const timeRow = document.createElement("div");
    timeRow.className = "gpn-time-row";
    if ((options && options.showTimeLabel) && state.preferences.showTimeLabel && message.timeMeta && message.timeMeta.displayLabel) {
      timeRow.textContent = message.timeMeta.displayLabel;
    } else {
      timeRow.hidden = true;
    }
    jumpZone.appendChild(timeRow);

    if ((options && options.showBookmarkName) && message.bookmarkName) {
      const bookmarkName = document.createElement("div");
      bookmarkName.className = "gpn-bookmark-name";
      bookmarkName.textContent = message.bookmarkName;
      jumpZone.appendChild(bookmarkName);
    }

    const text = document.createElement("div");
    text.className = "gpn-text";
    const expanded = state.expandedMessageIds.has(message.messageId);
    text.textContent = expanded ? message.displayFullText : message.displayPreviewMultiline;
    text.classList.toggle("gpn-text-expanded", expanded);
    jumpZone.appendChild(text);

    appendMeta(jumpZone, message);
    setupJumpZoneNavigation(jumpZone, item, () => jumpZone.dataset.messageId || message.messageId);
    content.appendChild(jumpZone);

    if (message.displayPreviewTruncated) {
      const expandButton = document.createElement("button");
      expandButton.type = "button";
      expandButton.className = "gpn-expand-btn";
      expandButton.dataset.action = "expand";
      expandButton.setAttribute("data-no-jump", "true");
      expandButton.textContent = expanded ? t("collapse") : t("expand");
      expandButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        state.ignoreItemClickUntil = Date.now() + 300;
        DEBUG_STATE.ignoreItemClickUntil = state.ignoreItemClickUntil;

        debugLog("info", "expand button clicked", {
          messageId: message.messageId,
          expandedAfterToggle: !state.expandedMessageIds.has(message.messageId)
        });

        toggleMessageExpandedLocal(message, item, text, expandButton);
        debugLog("info", "expand button local toggle", {
          messageId: message.messageId,
          expanded: state.expandedMessageIds.has(message.messageId)
        });
      }, true);
      ["pointerdown", "mousedown", "mouseup"].forEach((type) => {
        expandButton.addEventListener(type, (event) => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }, true);
      });
      content.appendChild(expandButton);
    }

    if (options && options.showTags !== false) appendTags(content, message);

    const actions = document.createElement("div");
    actions.className = "gpn-actions";

    const star = document.createElement("button");
    star.type = "button";
    star.className = "gpn-icon-btn gpn-star-btn";
    star.title = message.isBookmarked ? t("removeBookmark") : t("bookmarks");
    star.textContent = message.isBookmarked ? "★" : "☆";
    star.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleBookmark(message);
    });

    const tagButton = document.createElement("button");
    tagButton.type = "button";
    tagButton.className = "gpn-tag-btn";
    tagButton.title = t("tags");
    tagButton.textContent = t("tags");
    tagButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      editTags(message);
    });

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "gpn-copy-btn";
    copy.textContent = t("copy");
    copy.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      copyMessage(message, copy);
    });

    actions.appendChild(star);
    actions.appendChild(tagButton);
    actions.appendChild(copy);

    item.appendChild(index);
    item.appendChild(icons);
    item.appendChild(content);
    item.appendChild(actions);

    return item;
  }

  function createIconBadge(text, title) {
    const span = document.createElement("span");
    span.className = "gpn-icon-badge";
    span.textContent = text;
    if (title) span.title = title;
    return span;
  }

  function appendMeta(content, message) {
    if (state.preferences.showQuoteMeta && message.hasQuote) {
      const quote = document.createElement("div");
      quote.className = "gpn-meta gpn-quote-preview";
      if (message.quotedTexts && message.quotedTexts.length) {
        quote.textContent = message.quotedTexts.slice(0, 2).map((text, index) => t("quoteLine", { index: index + 1, text: getSingleLinePreview(text, 80) })).join("\n");
      }
      content.appendChild(quote);
    }

    if (state.preferences.showImageMeta && message.hasImage) {
      const image = document.createElement("div");
      image.className = "gpn-meta gpn-image-info";
      image.textContent = message.imageCount > 1 ? t("imageMany", { count: message.imageCount }) : t("imageOne");
      content.appendChild(image);
    }

    if (state.preferences.showAttachmentMeta && message.hasAttachment) {
      const attachments = document.createElement("div");
      attachments.className = "gpn-meta gpn-attachments-list";
      const names = message.attachmentNames && message.attachmentNames.length ? message.attachmentNames : [];
      attachments.textContent = names.map((name, index) => t("attachmentLine", { index: index + 1, name })).join("\n");
      content.appendChild(attachments);
    }
  }

  function appendTags(content, message) {
    if (!message.tags || !message.tags.length) return;
    const wrap = document.createElement("div");
    wrap.className = "gpn-tag-chips";
    message.tags.forEach((tag) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "gpn-tag-chip";
      chip.textContent = "#" + tag;
      chip.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setActiveTagFilter(tag);
      });
      wrap.appendChild(chip);
    });
    content.appendChild(wrap);
  }

  function createMissingBookmarkItem(bookmark) {
    const item = document.createElement("div");
    item.className = "gpn-item gpn-missing-bookmark";
    item.dataset.messageId = bookmark.messageId || "";

    const index = document.createElement("div");
    index.className = "gpn-index";
    index.textContent = "★";

    const icons = document.createElement("div");
    icons.className = "gpn-icons";
    icons.appendChild(createIconBadge("!", t("missingMessage")));

    const content = document.createElement("div");
    content.className = "gpn-content";

    const jumpZone = document.createElement("div");
    jumpZone.className = "gpn-jump-zone";
    jumpZone.dataset.messageId = bookmark.messageId || "";
    jumpZone.tabIndex = 0;
    jumpZone.setAttribute("role", "button");

    const name = document.createElement("div");
    name.className = "gpn-bookmark-name";
    name.textContent = bookmark.name || t("bookmarkName");

    const text = document.createElement("div");
    text.className = "gpn-text";
    text.textContent = (bookmark.messagePreview || "") + "\n" + t("missingMessage");

    jumpZone.appendChild(name);
    jumpZone.appendChild(text);
    setupJumpZoneNavigation(jumpZone, item, () => jumpZone.dataset.messageId || bookmark.messageId);
    content.appendChild(jumpZone);

    const actions = document.createElement("div");
    actions.className = "gpn-actions";

    const star = document.createElement("button");
    star.type = "button";
    star.className = "gpn-icon-btn gpn-star-btn";
    star.textContent = "★";
    star.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const fakeMessage = {
        messageId: bookmark.messageId,
        preview: bookmark.messagePreview || "",
        displayText: bookmark.messagePreview || "",
        rawText: bookmark.messagePreview || "",
        isBookmarked: true,
        bookmarkName: bookmark.name
      };
      toggleBookmark(fakeMessage);
    });

    actions.appendChild(star);

    item.appendChild(index);
    item.appendChild(icons);
    item.appendChild(content);
    item.appendChild(actions);

    return item;
  }

  function createMissingTagItem(entry, tag) {
    const item = document.createElement("div");
    item.className = "gpn-item gpn-missing-tag";
    item.dataset.messageId = entry.messageId || "";

    const index = document.createElement("div");
    index.className = "gpn-index";
    index.textContent = "#";

    const icons = document.createElement("div");
    icons.className = "gpn-icons";
    icons.appendChild(createIconBadge("!", t("missingMessage")));

    const content = document.createElement("div");
    content.className = "gpn-content";

    const jumpZone = document.createElement("div");
    jumpZone.className = "gpn-jump-zone";
    jumpZone.dataset.messageId = entry.messageId || "";
    jumpZone.tabIndex = 0;
    jumpZone.setAttribute("role", "button");

    const chips = document.createElement("div");
    chips.className = "gpn-tag-chips";
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "gpn-tag-chip";
    chip.textContent = "#" + tag;
    chip.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setActiveTagFilter(tag);
    });
    chips.appendChild(chip);

    const text = document.createElement("div");
    text.className = "gpn-text";
    text.textContent = (entry.messagePreview || "") + "\n" + t("missingMessage");

    content.appendChild(chips);
    jumpZone.appendChild(text);
    setupJumpZoneNavigation(jumpZone, item, () => jumpZone.dataset.messageId || entry.messageId);
    content.appendChild(jumpZone);

    const actions = document.createElement("div");
    actions.className = "gpn-actions";

    const tagButton = document.createElement("button");
    tagButton.type = "button";
    tagButton.className = "gpn-tag-btn";
    tagButton.textContent = t("tags");
    tagButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const input = prompt(t("enterTags"), (entry.tags || []).join(", "));
      if (input == null) return;
      const tags = parseTags(input);
      if (tags.length) {
        state.tags[entry.messageId] = {
          ...entry,
          tags,
          updatedAtRaw: new Date().toISOString()
        };
      } else {
        delete state.tags[entry.messageId];
      }
      saveTagsForCurrentConversation();
      scanAndMaybeRender("tag-update-missing", true);
    });

    actions.appendChild(tagButton);

    item.appendChild(index);
    item.appendChild(icons);
    item.appendChild(content);
    item.appendChild(actions);

    return item;
  }

  function createEmptyNode(text) {
    const empty = document.createElement("div");
    empty.className = "gpn-empty";
    empty.textContent = text;
    return empty;
  }

  function createJumpToken(messageId) {
    return "jump:" + Date.now() + ":" + Math.random().toString(36).slice(2) + ":" + messageId;
  }

  function clearJumpCorrectionTimers() {
    (state.jumpCorrectionTimers || []).forEach((timer) => clearTimeout(timer));
    state.jumpCorrectionTimers = [];
  }

  function removeJumpInterruptListeners() {
    if (typeof state.jumpInterruptCleanup === "function") state.jumpInterruptCleanup();
    state.jumpInterruptCleanup = null;
  }

  function markProgrammaticScroll() {
    state.programmaticScrollUntil = Date.now() + 260;
  }

  function isJumpTokenActive(token) {
    return !!token && state.currentJumpToken === token && !state.jumpInterrupted;
  }

  function isElementInReasonableViewportRange(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.bottom > 80 && rect.top < window.innerHeight - 80;
  }

  function isElementClearlyOffCenter(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return true;
    const distance = getElementDistanceFromViewportCenter(element);
    return distance != null && distance > Math.min(300, window.innerHeight * 0.4);
  }

  function finishPendingJumpCorrection(token, reason) {
    if (token && state.currentJumpToken !== token) return;
    clearJumpCorrectionTimers();
    removeJumpInterruptListeners();
    state.pendingScrollTargetMessageId = null;
    state.currentJumpToken = null;
    state.jumpInterrupted = false;
    DEBUG_STATE.pendingScrollTargetMessageId = null;
    DEBUG_STATE.currentJumpToken = null;
    if (reason) debugLog("info", "jump correction finished", { reason });
  }

  function cancelPendingJumpCorrection(reason) {
    if (!state.currentJumpToken && !state.pendingScrollTargetMessageId) return;
    clearJumpCorrectionTimers();
    removeJumpInterruptListeners();
    state.jumpInterrupted = true;
    state.pendingScrollTargetMessageId = null;
    state.currentJumpToken = null;
    DEBUG_STATE.pendingScrollTargetMessageId = null;
    DEBUG_STATE.currentJumpToken = null;
    DEBUG_STATE.jumpCorrectionCancelled = true;
    DEBUG_STATE.jumpCorrectionCancelReason = reason || "unknown";
    DEBUG_STATE.lastUserInterruptDuringJumpAt = new Date().toISOString();
    debugLog("info", "jump correction cancelled", { reason: reason || "unknown" });
    scheduleDebugPanelRefresh(true);
  }

  function setupJumpInterruptListeners(token) {
    removeJumpInterruptListeners();
    const cancelForUserInput = (event) => {
      if (!isJumpTokenActive(token)) return;
      cancelPendingJumpCorrection(event && event.type ? "user-" + event.type : "user-input");
    };
    const cancelForScroll = () => {
      if (!isJumpTokenActive(token)) return;
      if (Date.now() <= state.programmaticScrollUntil) return;
      cancelPendingJumpCorrection("user-scroll");
    };
    window.addEventListener("wheel", cancelForUserInput, true);
    window.addEventListener("touchmove", cancelForUserInput, true);
    window.addEventListener("pointerdown", cancelForUserInput, true);
    window.addEventListener("keydown", cancelForUserInput, true);
    window.addEventListener("scroll", cancelForScroll, true);
    state.jumpInterruptCleanup = () => {
      window.removeEventListener("wheel", cancelForUserInput, true);
      window.removeEventListener("touchmove", cancelForUserInput, true);
      window.removeEventListener("pointerdown", cancelForUserInput, true);
      window.removeEventListener("keydown", cancelForUserInput, true);
      window.removeEventListener("scroll", cancelForScroll, true);
    };
  }

  function isRegistryMessageForCurrentConversation(messageId) {
    const message = state.messageRegistry && state.messageRegistry.get(messageId);
    if (!message) return false;
    return !message.conversationId || message.conversationId === state.currentConversationId;
  }

  function findChatScrollContainer() {
    const candidates = [];
    const add = (node) => {
      if (!node || node.nodeType !== 1 || candidates.includes(node) || isInsidePanel(node)) return;
      candidates.push(node);
    };

    add(document.scrollingElement || document.documentElement);
    const firstMessage = document.querySelector(USER_SELECTOR);
    let current = firstMessage;
    while (current && current !== document.body) {
      add(current);
      current = current.parentElement;
    }

    add(document.querySelector("main"));
    Array.from(document.querySelectorAll('[data-testid*="conversation"], [class*="overflow-y-auto"], [class*="overflow-auto"]')).slice(0, 20).forEach(add);

    const found = candidates.find((node) => {
      try {
        if (node === document.documentElement || node === document.body || node === document.scrollingElement) return true;
        return node.scrollHeight > node.clientHeight + 40;
      } catch (error) {
        return false;
      }
    }) || document.scrollingElement || document.documentElement;

    DEBUG_STATE.lazyJumpScrollContainerFound = !!found;
    DEBUG_STATE.lazyJumpScrollContainerDescriptor = describeScrollContainer(found);
    return found;
  }

  function getVisibleMessageOrderIndexes() {
    const indexes = [];
    Array.from(document.querySelectorAll(USER_SELECTOR)).forEach((element) => {
      const id = element.getAttribute("data-message-id");
      const index = state.messageOrder.indexOf(id);
      if (index >= 0) indexes.push(index);
    });
    return indexes;
  }

  function cancelLazyJump(reason) {
    if (!state.lazyJumpInProgress) return;
    state.lazyJumpInProgress = false;
    state.pendingLazyJumpMessageId = null;
    if (typeof state.lazyJumpCancelCleanup === "function") state.lazyJumpCancelCleanup();
    state.lazyJumpCancelCleanup = null;
    DEBUG_STATE.lazyJumpInProgress = false;
    DEBUG_STATE.pendingLazyJumpMessageId = null;
    DEBUG_STATE.lazyJumpCancelled = true;
    DEBUG_STATE.lazyJumpCancelReason = reason || "cancelled";
    DEBUG_STATE.lazyJumpFailedReason = "lazy-jump-cancelled-by-user";
    updateJumpDiagnostics({
      lazyJumpCancelled: true,
      lazyJumpCancelReason: DEBUG_STATE.lazyJumpCancelReason,
      failureReason: "lazy-jump-cancelled-by-user",
      success: false
    });
    debugLog("info", "lazy jump cancelled", { reason });
    showInlineNotice(state.preferences.uiLanguage === "en" ? "Lazy jump cancelled." : "已取消加载目标消息。");
  }

  function setupLazyJumpCancelListeners() {
    if (typeof state.lazyJumpCancelCleanup === "function") state.lazyJumpCancelCleanup();
    const cancel = (event) => cancelLazyJump(event && event.type ? "user-" + event.type : "user-input");
    window.addEventListener("wheel", cancel, true);
    window.addEventListener("pointerdown", cancel, true);
    window.addEventListener("keydown", cancel, true);
    window.addEventListener("touchmove", cancel, true);
    state.lazyJumpCancelCleanup = () => {
      window.removeEventListener("wheel", cancel, true);
      window.removeEventListener("pointerdown", cancel, true);
      window.removeEventListener("keydown", cancel, true);
      window.removeEventListener("touchmove", cancel, true);
    };
  }

  async function lazyLoadAndJumpToMessage(messageId) {
    const registryMessage = state.messageRegistry && state.messageRegistry.get(messageId);
    if (!registryMessage || (registryMessage.conversationId && registryMessage.conversationId !== state.currentConversationId) || getConversationId() !== state.currentConversationId) {
      DEBUG_STATE.lazyJumpFailedReason = "conversation-mismatch-or-missing-registry";
      recordJumpFailure("lazy-jump-conversation-mismatch-or-missing-registry");
      showInlineNotice(t("missingMessage"));
      return;
    }

    cancelLazyJump("new-lazy-jump");
    state.lazyJumpInProgress = true;
    state.pendingLazyJumpMessageId = messageId;
    DEBUG_STATE.lazyJumpInProgress = true;
    DEBUG_STATE.pendingLazyJumpMessageId = messageId;
    DEBUG_STATE.lazyJumpAttemptCount = 0;
    DEBUG_STATE.lazyJumpFinalAttemptCount = 0;
    DEBUG_STATE.lazyJumpFoundTarget = false;
    DEBUG_STATE.lazyJumpCancelled = false;
    DEBUG_STATE.lazyJumpCancelReason = null;
    DEBUG_STATE.lazyJumpFailedReason = null;
    DEBUG_STATE.lazyJumpMaxAttempts = 8;
    DEBUG_STATE.lazyJumpStoppedBeforeFullBackfill = true;
    DEBUG_STATE.lazyJumpDidNotCallBackend = true;

    const targetIndex = state.messageOrder.indexOf(messageId);
    const visibleIndexes = getVisibleMessageOrderIndexes();
    const minVisibleIndex = visibleIndexes.length ? Math.min(...visibleIndexes) : -1;
    const maxVisibleIndex = visibleIndexes.length ? Math.max(...visibleIndexes) : -1;
    let direction = "unknown";
    if (targetIndex >= 0 && minVisibleIndex >= 0 && targetIndex < minVisibleIndex) direction = "up";
    else if (targetIndex >= 0 && maxVisibleIndex >= 0 && targetIndex > maxVisibleIndex) direction = "down";
    DEBUG_STATE.lazyJumpDirection = direction;
    updateJumpDiagnostics({ lazyJumpStarted: true, lazyJumpDirection: direction });

    if (direction === "unknown") {
      DEBUG_STATE.lazyJumpFailedReason = "lazy-jump-direction-unknown";
      recordJumpFailure("lazy-jump-direction-unknown");
      showInlineNotice(state.preferences.uiLanguage === "en"
        ? "This message is not loaded yet. Scroll in ChatGPT and try again."
        : "该消息尚未加载到页面。可以先向上/向下滚动，或后续使用“索引当前聊天”功能补录。");
      state.lazyJumpInProgress = false;
      DEBUG_STATE.lazyJumpInProgress = false;
      return;
    }

    const scrollContainer = findChatScrollContainer();
    DEBUG_STATE.lazyJumpScrollContainerFound = !!scrollContainer;
    DEBUG_STATE.lazyJumpScrollContainerDescriptor = describeScrollContainer(scrollContainer);
    updateJumpDiagnostics({
      scrollContainerFound: !!scrollContainer,
      scrollContainerDescriptor: describeScrollContainer(scrollContainer)
    });
    setupLazyJumpCancelListeners();
    showInlineNotice(state.preferences.uiLanguage === "en" ? "Loading target message..." : "正在加载目标消息...");

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const maxAttempts = 8;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (!state.lazyJumpInProgress || state.pendingLazyJumpMessageId !== messageId) return;
      DEBUG_STATE.lazyJumpAttemptCount = attempt;
      DEBUG_STATE.lazyJumpFinalAttemptCount = attempt;
      updateJumpDiagnostics({ lazyJumpAttemptCount: attempt });

      const found = findMessageElementById(messageId);
      if (found) {
        state.lazyJumpInProgress = false;
        state.pendingLazyJumpMessageId = null;
        if (typeof state.lazyJumpCancelCleanup === "function") state.lazyJumpCancelCleanup();
        state.lazyJumpCancelCleanup = null;
        DEBUG_STATE.lazyJumpInProgress = false;
        DEBUG_STATE.pendingLazyJumpMessageId = null;
        DEBUG_STATE.lazyJumpFoundTarget = true;
        updateJumpDiagnostics({ lazyJumpFoundTarget: true });
        scrollToMessageById(messageId, { fromLazyJump: true });
        return;
      }

      try {
        markProgrammaticScroll();
        const delta = Math.max(320, (scrollContainer.clientHeight || window.innerHeight || 800) * 0.8);
        if (scrollContainer === document.scrollingElement || scrollContainer === document.documentElement || scrollContainer === document.body) {
          window.scrollBy({ top: direction === "up" ? -delta : delta, behavior: "auto" });
        } else {
          scrollContainer.scrollTop += direction === "up" ? -delta : delta;
        }
      } catch (error) {
        DEBUG_STATE.lazyJumpFailedReason = "scroll-container-error";
      }

      await sleep(300);
      if (getConversationId() !== state.currentConversationId) {
        cancelLazyJump("conversation-changed");
        recordJumpFailure("lazy-jump-conversation-changed");
        return;
      }
      scanMessages("lazy-jump-load-scan", false);
    }

    state.lazyJumpInProgress = false;
    state.pendingLazyJumpMessageId = null;
    if (typeof state.lazyJumpCancelCleanup === "function") state.lazyJumpCancelCleanup();
    state.lazyJumpCancelCleanup = null;
    DEBUG_STATE.lazyJumpInProgress = false;
    DEBUG_STATE.pendingLazyJumpMessageId = null;
    DEBUG_STATE.lazyJumpFailedReason = "lazy-jump-target-not-loaded";
    recordJumpFailure("lazy-jump-target-not-loaded");
    showInlineNotice(state.preferences.uiLanguage === "en"
      ? "This message is not loaded yet. Scroll in ChatGPT or use the future Index Current Conversation feature."
      : "该消息尚未加载到页面。可以先向上/向下滚动，或后续使用“索引当前聊天”功能补录。");
  }

  function scrollToMessageById(messageId, options) {
    options = options || {};
    if (!messageId) {
      cancelPendingJumpCorrection("missing-message-id");
      recordJumpFailure("missing-message-id");
      showInlineNotice(t("missingMessage"));
      return;
    }

    buildJumpDiagnosticsStart(messageId, options);
    cancelPendingJumpCorrection("new-jump");
    const jumpToken = createJumpToken(messageId);
    state.currentJumpToken = jumpToken;
    state.jumpInterrupted = false;
    state.scrollSpyPausedUntil = Date.now() + SCROLL_SPY_PAUSE_MS;
    state.pendingScrollTargetMessageId = messageId;

    DEBUG_STATE.currentJumpToken = jumpToken;
    DEBUG_STATE.scrollSpyPausedUntil = new Date(state.scrollSpyPausedUntil).toISOString();
    DEBUG_STATE.pendingScrollTargetMessageId = messageId;
    DEBUG_STATE.jumpCorrectionCancelled = false;
    DEBUG_STATE.jumpCorrectionCancelReason = null;
    DEBUG_STATE.scrollToMissingTargetDidNotFallback = true;
    DEBUG_STATE.navListAutoScrollSuppressed = true;
    DEBUG_STATE.activeMessageId = messageId;

    const message = state.userMessages.find((item) => item.messageId === messageId || item.id === messageId);
    const target = findMessageElementById(messageId);
    const source = DEBUG_STATE.lastScrollTargetSource;

    if (!target) {
      if (state.messageRegistry && state.messageRegistry.has(messageId)) DEBUG_STATE.cachedMessageClickMissingDomCount += 1;
      if (!options.fromLazyJump && isRegistryMessageForCurrentConversation(messageId)) {
        DEBUG_STATE.scrollToMissingTargetStartedLazyJump = true;
        updateJumpDiagnostics({ lazyJumpStarted: true });
        finishPendingJumpCorrection(jumpToken, "target-missing-start-lazy-jump");
        lazyLoadAndJumpToMessage(messageId);
        scheduleDebugPanelRefresh(true);
        return;
      }
      DEBUG_STATE.scrollToMissingTargetStartedLazyJump = false;
      const reason = state.messageRegistry && state.messageRegistry.has(messageId) ? "target-not-in-dom" : "missing-registry-and-dom";
      recordJumpFailure(reason);
      showInlineNotice(state.preferences.uiLanguage === "en" ? "Message not found. Refresh or re-index this chat." : "未找到该消息，请刷新或重新索引当前聊天。");
      finishPendingJumpCorrection(jumpToken, "target-missing");
      scheduleDebugPanelRefresh(true);
      return;
    }

    const actualId = target.getAttribute("data-message-id");
    if (actualId && actualId !== messageId) {
      DEBUG_STATE.lastScrollMismatchWarning = { clickedMessageId: messageId, actualMessageId: actualId, time: new Date().toISOString() };
    } else {
      DEBUG_STATE.lastScrollMismatchWarning = null;
    }

    state.activeMessageId = messageId;
    DEBUG_STATE.activeMessageId = messageId;
    updateJumpDiagnostics({
      scrollAttempted: true,
      scrollMethod: "scrollIntoView-center",
      scrollStartedAt: new Date().toISOString(),
      targetRectBefore: serializeRect(target.getBoundingClientRect())
    });
    markProgrammaticScroll();
    target.scrollIntoView({ behavior: "auto", block: "center" });
    highlightMessage(target);
    updateActiveItemClasses();
    setupJumpInterruptListeners(jumpToken);

    const verifyTimer = setTimeout(() => {
      const latestTarget = findMessageElementById(messageId);
      const visible = !!(latestTarget && latestTarget.isConnected && isElementInReasonableViewportRange(latestTarget));
      DEBUG_STATE.scrollVerifiedAfterJump = true;
      DEBUG_STATE.targetVisibleAfterScroll = visible;
      DEBUG_STATE.scrollVerificationFailedReason = visible ? null : (latestTarget ? "target-not-visible-after-scroll" : "target-disconnected-after-scroll");
      updateJumpDiagnostics({
        scrollVerifiedAt: new Date().toISOString(),
        targetRectAfter: latestTarget ? serializeRect(latestTarget.getBoundingClientRect()) : null,
        targetVisibleAfterScroll: visible
      });

      if (visible) {
        recordJumpSuccess();
        finishPendingJumpCorrection(jumpToken, "verified-visible");
        return;
      }

      if (!isJumpTokenActive(jumpToken)) {
        updateJumpDiagnostics({ jumpCorrectionCancelled: true });
        return;
      }

      const correctionTimer = setTimeout(() => {
        if (!isJumpTokenActive(jumpToken) || state.pendingScrollTargetMessageId !== messageId) return;
        const correctionTarget = findMessageElementById(messageId);
        if (!correctionTarget || !correctionTarget.isConnected) {
          recordJumpFailure("target-missing-during-correction");
          finishPendingJumpCorrection(jumpToken, "target-missing-correction");
          return;
        }
        if (isElementInReasonableViewportRange(correctionTarget)) {
          recordJumpSuccess();
          finishPendingJumpCorrection(jumpToken, "correction-not-needed");
          return;
        }
        markProgrammaticScroll();
        correctionTarget.scrollIntoView({ behavior: "auto", block: "center" });
        highlightMessage(correctionTarget);
        DEBUG_STATE.jumpCorrectionCount += 1;
        DEBUG_STATE.lastJumpCorrectionAt = new Date().toISOString();
        updateJumpDiagnostics({ jumpCorrectionScheduled: true, targetRectAfter: serializeRect(correctionTarget.getBoundingClientRect()) });
        recordJumpSuccess();
        finishPendingJumpCorrection(jumpToken, "correction-complete");
      }, 350);
      state.jumpCorrectionTimers = [correctionTimer];
      updateJumpDiagnostics({ jumpCorrectionScheduled: true });
    }, 150);

    state.jumpCorrectionTimers = [verifyTimer];
    debugLog("info", "jump start", { messageId, source, preview: message ? message.preview : null });
    scheduleDebugPanelRefresh(true);
  }

  function highlightMessage(element) {
    if (!element) return;
    const existing = state.highlightTimers && state.highlightTimers.get(element);
    if (existing) {
      clearTimeout(existing.fadeTimer);
      clearTimeout(existing.clearTimer);
      element.style.outline = existing.previousOutline;
      element.style.boxShadow = existing.previousBoxShadow;
      element.style.transition = existing.previousTransition;
    }

    const previousOutline = element.style.outline;
    const previousBoxShadow = element.style.boxShadow;
    const previousTransition = element.style.transition;
    const messageId = element.getAttribute && element.getAttribute("data-message-id");
    const panelStyle = state.panel ? getComputedStyle(state.panel) : null;
    const accentColor = (panelStyle && panelStyle.getPropertyValue("--gpn-accent-strong").trim()) || DEBUG_STATE.accentStrongResolved || "#10a37f";
    const accentSoftColor = (panelStyle && panelStyle.getPropertyValue("--gpn-accent-strong-soft").trim()) || DEBUG_STATE.accentSoftResolved || "rgba(16, 163, 127, 0.2)";

    element.style.transition = "outline-color 600ms ease, box-shadow 600ms ease";
    element.style.outline = "2px solid " + accentColor;
    element.style.boxShadow = "0 0 0 4px " + accentSoftColor;

    const fadeTimer = setTimeout(() => {
      element.style.outlineColor = "transparent";
      element.style.boxShadow = "0 0 0 4px transparent";
    }, HIGHLIGHT_HOLD_MS);

    const clearTimer = setTimeout(() => {
      element.style.outline = previousOutline;
      element.style.boxShadow = previousBoxShadow;
      element.style.transition = previousTransition;
      if (state.highlightTimers) state.highlightTimers.delete(element);
      DEBUG_STATE.lastHighlightClearedAt = new Date().toISOString();
      scheduleDebugPanelRefresh();
    }, HIGHLIGHT_MS);

    if (state.highlightTimers) {
      state.highlightTimers.set(element, {
        fadeTimer,
        clearTimer,
        previousOutline,
        previousBoxShadow,
        previousTransition
      });
    }
    DEBUG_STATE.lastHighlightedMessageId = messageId || null;
    DEBUG_STATE.highlightFadeEnabled = true;
    DEBUG_STATE.jumpHighlightUsesAccent = true;
    DEBUG_STATE.jumpHighlightAccentColor = accentColor;
    DEBUG_STATE.jumpHighlightAccentSoftColor = accentSoftColor;
    DEBUG_STATE.lastHighlightSource = "plugin-highlight";
    DEBUG_STATE.lastHighlightDidNotTouchNativeChatGPTHighlight = true;
  }

  function copyMessage(message, button) {
    copyText(message.rawText || message.mainText || message.displayText || "").then(() => {
      if (button) {
        button.textContent = t("copied");
        setTimeout(() => {
          button.textContent = t("copy");
        }, COPY_RESET_MS);
      }

      DEBUG_STATE.lastCopiedMessageId = message.messageId;
      debugLog("info", "复制单条发文", {
        messageId: message.messageId,
        index: message.index,
        preview: message.preview
      });
      scheduleDebugPanelRefresh(true);
    }).catch((error) => {
      debugLog("error", "copy message failed", { message: error.message });
    });
  }

  function toggleBookmark(message) {
    const existing = state.bookmarks[message.messageId];

    if (!existing) {
      const defaultName = getSingleLinePreview(message.displayText || message.preview || message.rawText, 30);
      const name = prompt(t("bookmarkName"), defaultName);
      if (name == null) return;

      const trimmed = name.trim() || defaultName || t("bookmarkName");
      const now = new Date().toISOString();
      state.bookmarks[message.messageId] = {
        messageId: message.messageId,
        name: trimmed,
        createdAtRaw: now,
        updatedAtRaw: now,
        messagePreview: getSingleLinePreview(message.displayText || message.rawText || message.preview, 80)
      };
      DEBUG_STATE.lastBookmarkAction = "add";
      DEBUG_STATE.lastBookmarkMessageId = message.messageId;
      DEBUG_STATE.lastBookmarkName = trimmed;
      saveBookmarksForCurrentConversation();
      debugLog("info", "bookmark added", { messageId: message.messageId, bookmarkName: trimmed, preview: message.preview });
      scanAndMaybeRender("bookmark-add", true);
      return;
    }

    const shouldRemove = confirm(t("removeBookmark") + "?\nOK = " + t("removeBookmark") + ", Cancel = " + t("rename"));
    if (shouldRemove) {
      removeBookmark(message.messageId);
      return;
    }

    renameBookmark(message.messageId);
  }

  function renameBookmark(messageId) {
    const existing = state.bookmarks[messageId];
    if (!existing) return;

    const name = prompt(t("rename"), existing.name || "");
    if (name == null) return;

    const trimmed = name.trim() || existing.name || t("bookmarkName");
    existing.name = trimmed;
    existing.updatedAtRaw = new Date().toISOString();
    state.bookmarks[messageId] = existing;

    DEBUG_STATE.lastBookmarkAction = "rename";
    DEBUG_STATE.lastBookmarkMessageId = messageId;
    DEBUG_STATE.lastBookmarkName = trimmed;
    saveBookmarksForCurrentConversation();
    debugLog("info", "bookmark renamed", { messageId, bookmarkName: trimmed, preview: existing.messagePreview });
    scanAndMaybeRender("bookmark-rename", true);
  }

  function removeBookmark(messageId) {
    const existing = state.bookmarks[messageId];
    delete state.bookmarks[messageId];

    DEBUG_STATE.lastBookmarkAction = "remove";
    DEBUG_STATE.lastBookmarkMessageId = messageId;
    DEBUG_STATE.lastBookmarkName = existing ? existing.name : null;
    saveBookmarksForCurrentConversation();
    debugLog("info", "bookmark removed", { messageId, bookmarkName: existing && existing.name, preview: existing && existing.messagePreview });
    scanAndMaybeRender("bookmark-remove", true);
  }

  function sortMessagesByTimeAsc(messages) {
    return messages.slice().sort((a, b) => {
      const ar = a.timeMeta && a.timeMeta.raw ? new Date(a.timeMeta.raw).getTime() : 0;
      const br = b.timeMeta && b.timeMeta.raw ? new Date(b.timeMeta.raw).getTime() : 0;
      return ar - br;
    });
  }

  function buildMonthFolders(messages) {
    const timed = messages.filter((message) => message.timeMeta && message.timeMeta.raw);
    const noTimeMessages = messages.filter((message) => !message.timeMeta || !message.timeMeta.raw);
    const byMonth = new Map();

    timed.forEach((message) => {
      const monthKey = message.timeMeta.monthKey;
      const weekKey = message.timeMeta.weekOfMonthKey;
      if (!byMonth.has(monthKey)) byMonth.set(monthKey, new Map());
      const weeks = byMonth.get(monthKey);
      if (!weeks.has(weekKey)) weeks.set(weekKey, { label: message.timeMeta.weekOfMonthLabel, messages: [] });
      weeks.get(weekKey).messages.push(message);
    });

    const folders = Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([monthKey, weeks]) => {
      const children = Array.from(weeks.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([weekKey, info]) => ({
        key: "month:" + monthKey + "::" + weekKey,
        label: info.label,
        count: info.messages.length,
        messages: sortMessagesByTimeAsc(info.messages)
      }));
      return {
        key: "month:" + monthKey,
        label: monthKey,
        count: children.reduce((sum, child) => sum + child.count, 0),
        children
      };
    });

    return { folderMode: "month", folders, noTimeMessages };
  }

  function buildWeekFolders(messages) {
    const timed = messages.filter((message) => message.timeMeta && message.timeMeta.raw);
    const noTimeMessages = messages.filter((message) => !message.timeMeta || !message.timeMeta.raw);
    const byWeek = new Map();

    timed.forEach((message) => {
      const weekKey = message.timeMeta.weekKey;
      if (!byWeek.has(weekKey)) {
        byWeek.set(weekKey, {
          label: message.timeMeta.weekLabel,
          monthKey: message.timeMeta.monthKey,
          weekOfMonthLabel: message.timeMeta.weekOfMonthLabel,
          days: new Map()
        });
      }
      const week = byWeek.get(weekKey);
      const dayKey = message.timeMeta.dateKey;
      if (!week.days.has(dayKey)) {
        week.days.set(dayKey, {
          label: message.timeMeta.weekdayLabel + " " + dayKey,
          weekdayIndex: message.timeMeta.weekdayIndex,
          messages: []
        });
      }
      week.days.get(dayKey).messages.push(message);
    });

    const folders = Array.from(byWeek.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([weekKey, info]) => {
      const children = Array.from(info.days.entries()).sort((a, b) => a[1].weekdayIndex - b[1].weekdayIndex).map(([dayKey, day]) => ({
        key: "week:" + weekKey + "::" + dayKey,
        label: day.label,
        count: day.messages.length,
        messages: sortMessagesByTimeAsc(day.messages)
      }));
      return {
        key: "week:" + weekKey,
        label: formatWeekFolderLabel(weekKey, info),
        shortLabel: info.weekOfMonthLabel,
        rangeLabel: formatShortWeekRange(weekKey),
        count: children.reduce((sum, child) => sum + child.count, 0),
        children
      };
    });

    return { folderMode: "week", folders, noTimeMessages };
  }

  function formatShortWeekRange(weekKey) {
    const parts = String(weekKey || "").split("-");
    if (parts.length < 2) return weekKey || "";
    const start = parts[0].split("/");
    const end = parts[1].split("/");
    if (start.length < 3 || end.length < 3) return weekKey;
    return start[1] + "/" + start[2] + " - " + end[1] + "/" + end[2];
  }

  function formatWeekFolderLabel(weekKey, info) {
    const parts = String(weekKey || "").split("-");
    const start = parts[0] || "";
    const end = parts[1] || "";
    const startParts = start.split("/");
    const endParts = end.split("/");
    const startMonth = startParts.length >= 2 ? startParts[0] + "/" + startParts[1] : (info && info.monthKey) || "";
    const endMonth = endParts.length >= 2 ? endParts[0] + "/" + endParts[1] : startMonth;
    let monthLabel = startMonth;
    if (startMonth && endMonth && startMonth !== endMonth) {
      monthLabel = startMonth + "-" + endMonth.slice(5);
    }
    return [monthLabel, info && info.weekOfMonthLabel, "（" + formatShortWeekRange(weekKey) + "）"].filter(Boolean).join(" ");
  }

  function buildDayFolders(messages) {
    const timed = messages.filter((message) => message.timeMeta && message.timeMeta.raw);
    const noTimeMessages = messages.filter((message) => !message.timeMeta || !message.timeMeta.raw);
    const byDay = new Map();

    timed.forEach((message) => {
      const dayKey = message.timeMeta.dateKey;
      if (!byDay.has(dayKey)) byDay.set(dayKey, new Map());
      const buckets = byDay.get(dayKey);
      const bucketKey = message.timeMeta.timeBucketKey;
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, { label: message.timeMeta.timeBucketLabel, messages: [] });
      buckets.get(bucketKey).messages.push(message);
    });

    const order = ["early_morning", "morning", "noon", "afternoon", "evening"];
    const folders = Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([dayKey, buckets]) => {
      const children = Array.from(buckets.entries()).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([bucketKey, bucket]) => ({
        key: "day:" + dayKey + "::" + bucketKey,
        label: bucket.label,
        count: bucket.messages.length,
        messages: sortMessagesByTimeAsc(bucket.messages)
      }));
      return {
        key: "day:" + dayKey,
        label: dayKey,
        count: children.reduce((sum, child) => sum + child.count, 0),
        children
      };
    });

    return { folderMode: "day", folders, noTimeMessages };
  }

  function normalizeDateSearchKeyword(input) {
    try {
      const rawInput = String(input || "").trim();
      if (!rawInput) return null;

      const lowered = rawInput.toLowerCase();
      const normalized = rawInput
        .toLowerCase()
        .replace(/[年\-\.]/g, "/")
        .replace(/[月]/g, "/")
        .replace(/[日号]/g, "")
        .replace(/[蟷ｴ譛・-]/g, "/")
        .replace(/譌･/g, "")
        .replace(/\/+/g, "/")
        .replace(/^\/|\/$/g, "")
        .trim();
      const digitsOnly = rawInput.replace(/\D/g, "");
      const bucketMap = [
        { re: /凌晨|深夜|early|late\s*night|night|蜃梧勣/, key: "early_morning" },
        { re: /早上|上午|morning|荳雁壕/, key: "morning" },
        { re: /中午|noon|荳ｭ蜊/, key: "noon" },
        { re: /下午|afternoon|荳句壕/, key: "afternoon" },
        { re: /晚上|傍晚|evening|譎壻ｸ/, key: "evening" }
      ];
      const weekdayMap = [
        { re: /周一|星期一|礼拜一|monday|\bmon\b/, index: 1 },
        { re: /周二|星期二|礼拜二|tuesday|\btue\b/, index: 2 },
        { re: /周三|星期三|礼拜三|wednesday|\bwed\b/, index: 3 },
        { re: /周四|星期四|礼拜四|thursday|\bthu\b/, index: 4 },
        { re: /周五|星期五|礼拜五|friday|\bfri\b/, index: 5 },
        { re: /周六|星期六|礼拜六|saturday|\bsat\b/, index: 6 },
        { re: /周日|周天|星期日|星期天|礼拜日|礼拜天|sunday|\bsun\b/, index: 7 }
      ];
      const foundBucket = bucketMap.find((item) => item.re.test(lowered));
      const foundWeekday = weekdayMap.find((item) => item.re.test(lowered));

      let year = null;
      let month = null;
      let day = null;
      const rawHasMonthChar = /月|譛/.test(rawInput);
      const rawHasDayChar = /日|号|譌/.test(rawInput);
      const weekMatch = lowered.match(/(?:第\s*)?(\d{1,2})\s*(?:周|週|week)|week\s*(\d{1,2})|隨ｬ\s*(\d{1,2})\s*蜻ｨ/i);
      const weekNumber = weekMatch ? Number(weekMatch[1] || weekMatch[2] || weekMatch[3]) : null;
      const parts = normalized.split("/").filter(Boolean);

      if (parts.length >= 3 && /^\d{4}$/.test(parts[0])) {
        year = Number(parts[0]);
        month = Number(parts[1]);
        day = Number(parts[2]);
      } else if (parts.length >= 2) {
        if (/^\d{4}$/.test(parts[0])) {
          year = Number(parts[0]);
          month = Number(parts[1]);
        } else {
          month = Number(parts[0]);
          day = Number(parts[1]);
        }
      } else if (parts.length === 1 && /^\d{4}$/.test(parts[0]) && /^(19|20)/.test(parts[0])) {
        year = Number(parts[0]);
      } else if (digitsOnly) {
        if (digitsOnly.length === 8) {
          year = Number(digitsOnly.slice(0, 4));
          month = Number(digitsOnly.slice(4, 6));
          day = Number(digitsOnly.slice(6, 8));
        } else if (digitsOnly.length === 6 && /^(19|20)/.test(digitsOnly)) {
          year = Number(digitsOnly.slice(0, 4));
          month = Number(digitsOnly.slice(4, 6));
        } else if (digitsOnly.length === 4 && /^(19|20)/.test(digitsOnly)) {
          year = Number(digitsOnly);
        } else if (digitsOnly.length === 4) {
          month = Number(digitsOnly.slice(0, 2));
          day = Number(digitsOnly.slice(2, 4));
        } else if (digitsOnly.length === 3) {
          month = Number(digitsOnly.slice(0, 1));
          day = Number(digitsOnly.slice(1, 3));
        } else if (digitsOnly.length <= 2) {
          const value = Number(digitsOnly);
          if (weekNumber != null) {
            // Keep week-only searches from being treated as month searches.
          } else if (rawHasDayChar) day = value;
          else if (rawHasMonthChar) month = value;
          else if (value > 12) day = value;
          else month = value;
        }
      }

      if (month != null && (month < 1 || month > 12)) month = null;
      if (day != null && (day < 1 || day > 31)) day = null;
      if (year != null && (year < 1900 || year > 9999)) year = null;

      let queryType = "text";
      if (year != null && month != null && day != null) queryType = "full-date";
      else if (year != null && month != null) queryType = "year-month";
      else if (month != null && day != null) queryType = "month-day";
      else if (month != null) queryType = "month-only";
      else if (day != null) queryType = "day-only";
      else if (year != null) queryType = "year-only";
      else if (weekNumber != null) queryType = "week-number";
      else if (foundWeekday) queryType = "weekday";
      else if (foundBucket) queryType = "time-bucket";

      return {
        rawInput,
        normalized,
        digitsOnly,
        queryType,
        year,
        month,
        day,
        hasYear: year != null,
        hasMonth: month != null,
        hasDay: day != null,
        weekNumber,
        hasWeekNumber: weekNumber != null,
        weekdayIndex: foundWeekday ? foundWeekday.index : null,
        hasWeekday: !!foundWeekday,
        timeBucketKeyword: foundBucket ? foundBucket.key : null,
        tokens: normalized.split(/[^\w\u4e00-\u9fa5]+/).filter(Boolean)
      };
    } catch (error) {
      debugLog("warn", "normalize date search failed", { input, message: error.message });
      return null;
    }
  }

  function isStructuredTimeQuery(queryMeta) {
    return !!queryMeta && queryMeta.queryType !== "text";
  }

  function fuzzyMatchTimeMeta(message, queryMeta) {
    if (!message || !queryMeta || !message.timeMeta || !message.timeMeta.raw) return { matched: false, score: 0, reason: "no-time" };

    const meta = message.timeMeta;
    const parts = String(meta.dateKey || "").split("/");
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    const mm = pad2(month);
    const dd = pad2(day);
    const compactDate = String(year) + mm + dd;
    const compactMonth = String(year) + mm;
    const compactMonthDay = mm + dd;
    const looseMonthDay = String(month) + String(day);

    if (queryMeta.hasWeekNumber) {
      const matched = String(meta.weekOfMonthLabel || "").includes(String(queryMeta.weekNumber));
      return { matched, score: matched ? 65 : 0, reason: matched ? "week-number" : "week-number-miss" };
    }

    if (queryMeta.hasWeekday) {
      const matched = Number(meta.weekdayIndex) === Number(queryMeta.weekdayIndex);
      return { matched, score: matched ? 58 : 0, reason: matched ? "weekday" : "weekday-miss" };
    }

    if (queryMeta.timeBucketKeyword) {
      const matched = meta.timeBucketKey === queryMeta.timeBucketKeyword;
      return { matched, score: matched ? 50 : 0, reason: matched ? "time-bucket" : "time-bucket-miss" };
    }

    if (queryMeta.hasYear && queryMeta.hasMonth && queryMeta.hasDay) {
      const matched = year === queryMeta.year && month === queryMeta.month && day === queryMeta.day;
      return { matched, score: matched ? 100 : 0, reason: matched ? "full-date" : "full-date-miss" };
    }

    if (queryMeta.hasYear && queryMeta.hasMonth && !queryMeta.hasDay) {
      const matched = year === queryMeta.year && month === queryMeta.month;
      return { matched, score: matched ? 70 : 0, reason: matched ? "year-month" : "year-month-miss" };
    }

    if (!queryMeta.hasYear && queryMeta.hasMonth && queryMeta.hasDay) {
      const matched = month === queryMeta.month && day === queryMeta.day;
      return { matched, score: matched ? 80 : 0, reason: matched ? "month-day" : "month-day-miss" };
    }

    if (queryMeta.hasMonth && !queryMeta.hasDay) {
      const matched = month === queryMeta.month;
      return { matched, score: matched ? 60 : 0, reason: matched ? "month-only" : "month-only-miss" };
    }

    if (!queryMeta.hasMonth && queryMeta.hasDay) {
      const matched = day === queryMeta.day;
      return { matched, score: matched ? 40 : 0, reason: matched ? "day-only" : "day-only-miss" };
    }

    if (queryMeta.hasYear && !queryMeta.hasMonth && !queryMeta.hasDay) {
      const matched = year === queryMeta.year;
      return { matched, score: matched ? 55 : 0, reason: matched ? "year-only" : "year-only-miss" };
    }

    if (isStructuredTimeQuery(queryMeta)) return { matched: false, score: 0, reason: queryMeta.queryType + "-miss" };

    if (queryMeta.digitsOnly) {
      const digits = queryMeta.digitsOnly;
      const matched = compactDate.includes(digits) || compactMonth.includes(digits) || compactMonthDay.includes(digits) || looseMonthDay.includes(digits);
      if (matched) return { matched: true, score: 35, reason: "digits-includes" };
    }

    const haystack = [
      meta.displayLabel,
      meta.label,
      meta.dateKey,
      meta.monthKey,
      meta.weekLabel,
      meta.weekOfMonthLabel,
      meta.weekdayLabel,
      meta.timeBucketLabel,
      compactDate,
      compactMonth,
      compactMonthDay,
      looseMonthDay,
      month + "/" + day,
      mm + "/" + dd,
      String(day)
    ].filter(Boolean).join(" ").toLowerCase();

    const textMatched = (queryMeta.tokens || []).some((token) => haystack.includes(token.toLowerCase())) || haystack.includes(String(queryMeta.normalized || "").toLowerCase());
    return { matched: textMatched, score: textMatched ? 30 : 0, reason: textMatched ? "text-includes" : "not-matched" };
  }

  function parseTimeSearchByMode(input, mode) {
    const raw = String(input || "").trim();
    const allowed = mode === "day" ? ["full-date"] : mode === "week" ? ["year", "year-month", "month", "week-number"] : ["year", "year-month", "month"];
    if (!raw) return { valid: true, queryType: "empty", year: null, month: null, day: null, weekNumber: null, reason: "empty", allowedQueryTypes: allowed };

    const normalized = raw.toLowerCase().replace(/[年.\-]/g, "/").replace(/月/g, "/").replace(/[日号]/g, "").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
    const digitsOnly = raw.replace(/\D/g, "");
    const parsed = { valid: false, queryType: "invalid", year: null, month: null, day: null, weekNumber: null, reason: "invalid", allowedQueryTypes: allowed };
    const validMonth = (month) => month >= 1 && month <= 12;
    const validDay = (day) => day >= 1 && day <= 31;
    const reject = (reason) => ({ ...parsed, reason });

    const weekMatch = raw.match(/^(?:第\s*)?(\d{1,2})\s*(?:周|週)$/i) || raw.match(/^week\s*(\d{1,2})$/i);
    const hasDisallowedWords = /下午|晚上|上午|中午|凌晨|周[一二三四五六日天]|星期|礼拜|morning|afternoon|evening|night|sat|sun|mon|tue|wed|thu|fri/i.test(raw);

    if (mode === "day") {
      let match = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
      if (!match) match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        if (year >= 1900 && validMonth(month) && validDay(day)) return { ...parsed, valid: true, queryType: "full-date", year, month, day, reason: "ok" };
      }
      return reject("day-view-requires-yyyymmdd");
    }

    if (hasDisallowedWords) return reject("disallowed-by-mode");
    if (weekMatch) {
      if (mode !== "week") return reject("week-query-not-allowed-in-month-view");
      const weekNumber = Number(weekMatch[1]);
      return weekNumber >= 1 && weekNumber <= 6 ? { ...parsed, valid: true, queryType: "week-number", weekNumber, reason: "ok" } : reject("invalid-week-number");
    }

    if (/^\d{4}$/.test(raw) && /^(19|20)/.test(raw)) {
      return { ...parsed, valid: true, queryType: "year", year: Number(raw), reason: "ok" };
    }

    let ym = normalized.match(/^(\d{4})\/(\d{1,2})$/);
    if (!ym && /^\d{6}$/.test(digitsOnly) && /^(19|20)/.test(digitsOnly)) {
      ym = [digitsOnly, digitsOnly.slice(0, 4), digitsOnly.slice(4, 6)];
    }
    if (ym) {
      const year = Number(ym[1]);
      const month = Number(ym[2]);
      return year >= 1900 && validMonth(month) ? { ...parsed, valid: true, queryType: "year-month", year, month, reason: "ok" } : reject("invalid-year-month");
    }

    const monthMatch = raw.match(/^(\d{1,2})\s*月$/) || raw.match(/^(\d{1,2})$/);
    if (monthMatch) {
      const month = Number(monthMatch[1]);
      return validMonth(month) ? { ...parsed, valid: true, queryType: "month", month, reason: "ok" } : reject("invalid-month");
    }

    if (/^\d{8}$/.test(digitsOnly) || /^\d{3,4}$/.test(digitsOnly)) return reject("day-level-query-disallowed-by-mode");
    return reject("unsupported-format");
  }

  function matchTimeFolderByQuery(folder, query, mode) {
    const messages = collectFolderMessages(folder);
    const matchesMessage = (message) => {
      const meta = message && message.timeMeta;
      if (!meta || !meta.raw || !meta.dateKey) return false;
      const parts = meta.dateKey.split("/");
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);

      if (query.queryType === "year") return year === query.year;
      if (query.queryType === "year-month") return year === query.year && month === query.month;
      if (query.queryType === "month") return month === query.month;
      if (query.queryType === "week-number") return String(meta.weekOfMonthLabel || "").replace(/\D/g, "") === String(query.weekNumber);
      if (query.queryType === "full-date") return year === query.year && month === query.month && day === query.day;
      return false;
    };

    if (mode === "month") {
      if (query.queryType === "year") return messages.some(matchesMessage) ? { matched: true, folder, count: folder.count || messages.length, reason: "year" } : { matched: false };
      if (query.queryType === "year-month" || query.queryType === "month") return messages.some(matchesMessage) ? { matched: true, folder, count: folder.count || messages.length, reason: query.queryType } : { matched: false };
    }

    if (mode === "week") {
      if (["year", "year-month", "month", "week-number"].includes(query.queryType)) {
        return messages.some(matchesMessage) ? { matched: true, folder, count: folder.count || messages.length, reason: query.queryType } : { matched: false };
      }
    }

    if (mode === "day" && query.queryType === "full-date") {
      return messages.some(matchesMessage) ? { matched: true, folder, count: folder.count || messages.length, reason: "full-date" } : { matched: false };
    }

    return { matched: false };
  }

  function filterTimeFoldersByKeyword(folders, folderSearchIndex, keyword) {
    const query = parseTimeSearchByMode(keyword, state.timeFolderMode);
    DEBUG_STATE.timeSearchModeSpecificParser = true;
    DEBUG_STATE.lastTimeSearchViewMode = state.timeFolderMode;
    DEBUG_STATE.lastTimeSearchQueryType = query.queryType;
    DEBUG_STATE.lastTimeSearchParsedMonth = query.month;
    DEBUG_STATE.lastTimeSearchParsedDay = query.day;
    DEBUG_STATE.lastTimeSearchParsedYear = query.year;
    DEBUG_STATE.lastTimeSearchValid = query.valid;
    DEBUG_STATE.lastTimeSearchInvalidReason = query.valid ? null : query.reason;
    DEBUG_STATE.lastTimeSearchAllowedQueryTypes = query.allowedQueryTypes || [];
    DEBUG_STATE.lastTimeSearchDisallowedByMode = !query.valid && /disallowed|requires|not-allowed/.test(query.reason || "");
    DEBUG_STATE.lastTimeSearchUsedMessageText = false;
    DEBUG_STATE.lastTimeSearchUsedBroadIncludes = false;
    DEBUG_STATE.lastTimeSearchStructuredMatch = query.valid && query.queryType !== "empty";
    DEBUG_STATE.lastTimeSearchRejectedBroadTermCount = (folderSearchIndex || []).length;
    DEBUG_STATE.lastTimeSearchMatchedFolderKeys = [];
    DEBUG_STATE.lastTimeSearchMatchedReasons = [];

    if (!keyword || query.queryType === "empty") {
      return {
        folders: folders || [],
        matchedFolderCount: (folders || []).length,
        matchedMessageCount: (folders || []).reduce((sum, folder) => sum + (folder.count || 0), 0)
      };
    }

    if (!query.valid) {
      return { folders: [], matchedFolderCount: 0, matchedMessageCount: 0 };
    }

    const matchedFolders = [];
    let matchedMessageCount = 0;
    (folders || []).forEach((folder) => {
      const result = matchTimeFolderByQuery(folder, query, state.timeFolderMode);
      if (!result.matched) return;
      matchedFolders.push(result.folder);
      matchedMessageCount += result.count || result.folder.count || 0;
      DEBUG_STATE.lastTimeSearchMatchedReasons.push({ key: folder.key, reason: result.reason });
    });

    DEBUG_STATE.lastTimeSearchMatchedFolderKeys = matchedFolders.map((folder) => folder.key);
    return {
      folders: matchedFolders,
      matchedFolderCount: matchedFolders.length,
      matchedMessageCount
    };
  }

  function expandTimeFoldersForMessages(messages) {
    messages.forEach((message) => {
      if (!message.timeMeta || !message.timeMeta.raw) return;
      if (state.timeFolderMode === "month") {
        const key = "month:" + message.timeMeta.monthKey;
        state.expandedTimeFolders[key] = true;
        state.expandedTimeFolders[key + "::" + message.timeMeta.weekOfMonthKey] = true;
      } else if (state.timeFolderMode === "week") {
        const key = "week:" + message.timeMeta.weekKey;
        state.expandedTimeFolders[key] = true;
        state.expandedTimeFolders[key + "::" + message.timeMeta.dateKey] = true;
      } else {
        const key = "day:" + message.timeMeta.dateKey;
        state.expandedTimeFolders[key] = true;
        state.expandedTimeFolders[key + "::" + message.timeMeta.timeBucketKey] = true;
      }
    });
  }

  function applyTimeFolderSearch(rawInput, trigger) {
    const keyword = normalizeText(rawInput);
    const queryMeta = parseTimeSearchByMode(keyword, state.timeFolderMode);
    state.lastTimeSearch = keyword;
    state.timeSearchKeyword = keyword;
    state.timeSearchDraft = keyword;
    DEBUG_STATE.timeSearchDraft = keyword;
    DEBUG_STATE.lastTimeSearchExecuteTrigger = trigger || "input-debounce";
    DEBUG_STATE.lastTimeSearchTrigger = trigger || "input-debounce";
    DEBUG_STATE.lastTimeSearchExecutedAt = new Date().toISOString();
    DEBUG_STATE.timeSearchUsesTextSearch = false;
    DEBUG_STATE.timeSearchMode = "folder-filter";
    DEBUG_STATE.timeSearchAutoJumpEnabled = false;
    DEBUG_STATE.timeSearchAutoExpandEnabled = false;
    DEBUG_STATE.timeSearchModifiedExpandedFolders = false;
    DEBUG_STATE.timeSearchRealtimeEnabled = true;
    DEBUG_STATE.timeSearchIncludeNoTimeMessages = true;
    DEBUG_STATE.lastTimeFuzzySearchKeyword = keyword;
    DEBUG_STATE.lastTimeFuzzySearchNormalized = queryMeta ? { ...queryMeta } : null;

    if (!keyword || !queryMeta) {
      state.timeSearchKeyword = "";
      state.timeSearchMatchedMessageIds = new Set();
      state.timeSearchMatchedMessageOrder = [];
      state.timeSearchActiveIndex = -1;
      state.timeSearchActive = false;
      DEBUG_STATE.lastTimeSearch = state.lastTimeSearch;
      DEBUG_STATE.lastTimeFuzzySearchKeyword = "";
      DEBUG_STATE.lastTimeFuzzySearchNormalized = null;
      DEBUG_STATE.timeFuzzySearchResultCount = 0;
      DEBUG_STATE.timeFuzzySearchActive = false;
      DEBUG_STATE.timeFuzzySearchFirstMessageId = null;
      DEBUG_STATE.lastTimeFuzzySearchReason = "empty";
      DEBUG_STATE.timeSearchMatchedMessageIdsCount = 0;
      DEBUG_STATE.timeSearchMatchedFolderCount = 0;
      DEBUG_STATE.timeSearchMatchedMessageCount = 0;
      DEBUG_STATE.lastTimeSearchQueryType = "empty";
      DEBUG_STATE.lastTimeSearchParsedMonth = null;
      DEBUG_STATE.lastTimeSearchParsedDay = null;
      DEBUG_STATE.lastTimeSearchParsedYear = null;
      DEBUG_STATE.lastTimeSearchStructuredMatch = false;
      DEBUG_STATE.lastTimeSearchUsedBroadIncludes = false;
      DEBUG_STATE.lastTimeSearchRejectedBroadTermCount = 0;
      DEBUG_STATE.lastTimeSearchMatchedFolderKeys = [];
      DEBUG_STATE.lastTimeSearchMatchedReasons = [];
      DEBUG_STATE.timeSearchModeSpecificParser = true;
      DEBUG_STATE.lastTimeSearchViewMode = state.timeFolderMode;
      DEBUG_STATE.lastTimeSearchValid = true;
      DEBUG_STATE.lastTimeSearchInvalidReason = null;
      DEBUG_STATE.lastTimeSearchAllowedQueryTypes = state.timeFolderMode === "day" ? ["full-date"] : state.timeFolderMode === "week" ? ["year", "year-month", "month", "week-number"] : ["year", "year-month", "month"];
      DEBUG_STATE.lastTimeSearchDisallowedByMode = false;
      DEBUG_STATE.lastTimeSearchUsedMessageText = false;
      debugLog("info", "time folder search clear", { trigger: trigger || "clear" });
      renderTimeFolderListOnly("time-folder-search-clear");
      return [];
    }

    const filtered = renderTimeFolderListOnly("time-folder-search-" + (trigger || "input-debounce"));
    const order = collectUniqueMessageIdsFromFolders(filtered && filtered.folders);
    state.timeSearchMatchedMessageIds = new Set(order);
    state.timeSearchMatchedMessageOrder = order;
    state.timeSearchActive = true;

    DEBUG_STATE.lastTimeSearch = state.lastTimeSearch;
    DEBUG_STATE.lastTimeFuzzySearchKeyword = state.lastTimeSearch;
    DEBUG_STATE.lastTimeFuzzySearchNormalized = { ...queryMeta };
    DEBUG_STATE.timeFuzzySearchResultCount = DEBUG_STATE.timeSearchMatchedMessageCount;
    DEBUG_STATE.timeFuzzySearchActive = true;
    DEBUG_STATE.timeFuzzySearchFirstMessageId = order[0] || null;
    DEBUG_STATE.lastTimeFuzzySearchReason = "folder-filter";
    DEBUG_STATE.lastTimeSearchMatched = order.length > 0;
    DEBUG_STATE.lastTimeSearchTargetKey = null;
    DEBUG_STATE.timeSearchMatchedMessageIdsCount = order.length;

    debugLog("info", "time folder search apply", {
      keyword: state.lastTimeSearch,
      trigger: trigger || "input-debounce",
      matchedFolders: DEBUG_STATE.timeSearchMatchedFolderCount,
      matchedMessages: DEBUG_STATE.timeSearchMatchedMessageCount
    });

    return filtered ? filtered.folders : [];
  }

  function executeTimeFuzzySearch(rawInput, trigger) {
    return applyTimeFolderSearch(rawInput, trigger || "legacy");
  }

  function collectUniqueMessageIdsFromFolders(folders) {
    const ids = [];
    const seen = new Set();
    (folders || []).forEach((folder) => {
      collectFolderMessageIds(folder).forEach((messageId) => {
        if (!messageId || seen.has(messageId)) return;
        seen.add(messageId);
        ids.push(messageId);
      });
    });
    return ids;
  }

  function handleTimeSearch(input, direction) {
    applyTimeFolderSearch(input, direction ? "legacy-" + direction : "legacy");
  }

  function showInlineNotice(text) {
    if (!state.navList) return;
    const notice = document.createElement("div");
    notice.className = "gpn-inline-notice";
    notice.textContent = text;
    state.navList.prepend(notice);
    setTimeout(() => notice.remove(), 1800);
  }

  function createPanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
      state.panel = existing;
      return;
    }

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "gpn-panel";

    panel.innerHTML = [
      '<div class="gpn-header">',
      '  <div class="gpn-title-wrap"><div class="gpn-title"></div><div class="gpn-count"></div></div>',
      '  <div class="gpn-header-actions">',
      '    <button type="button" class="gpn-header-btn" data-action="help">?</button>',
      '    <button type="button" class="gpn-header-btn" data-action="settings">⚙</button>',
      '    <button type="button" class="gpn-header-btn" data-action="debug">Debug</button>',
      '    <button type="button" class="gpn-header-btn" data-action="refresh"></button>',
      '    <button type="button" class="gpn-header-btn" data-action="collapse"></button>',
      '  </div>',
      '  <div class="gpn-mini-resize-handle-x" title="resize mini width">⋮</div>',
      '</div>',
      '<div class="gpn-body">',
      '  <div class="gpn-tabs">',
      '    <button type="button" class="gpn-tab" data-tab="all"></button>',
      '    <button type="button" class="gpn-tab" data-tab="time"></button>',
      '    <button type="button" class="gpn-tab" data-tab="bookmarks"></button>',
      '    <button type="button" class="gpn-tab" data-tab="tags"></button>',
      '  </div>',
      '  <input class="gpn-search" type="search" />',
      '  <div class="gpn-list"></div>',
      '  <div class="gpn-debug gpn-debug-panel" hidden></div>',
      '  <div class="gpn-settings-panel" hidden></div>',
      '  <div class="gpn-help-panel" hidden></div>',
      '</div>',
      '<div class="gpn-footer"></div>',
      '<div class="gpn-resize-handle-left" title="resize left"></div>',
      '<div class="gpn-resize-handle-right gpn-resize-handle-x" title="resize width"></div>',
      '<div class="gpn-resize-handle-top" title="resize top"></div>',
      '<div class="gpn-resize-handle-bottom gpn-resize-handle-y" title="resize height"></div>',
      '<div class="gpn-resize-handle-both" title="resize">↘</div>'
    ].join("");

    document.body.appendChild(panel);

    state.panel = panel;
    state.navList = panel.querySelector(".gpn-list");
    state.searchInput = panel.querySelector(".gpn-search");
    state.debugPanel = panel.querySelector(".gpn-debug");
    state.helpPanel = panel.querySelector(".gpn-help-panel");
    state.settingsPanel = panel.querySelector(".gpn-settings-panel");
    state.tabs = panel.querySelector(".gpn-tabs");

    panel.querySelector('[data-action="help"]').addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleHelpMode();
    });
    panel.querySelector('[data-action="settings"]').addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleSettingsMode("header");
    });
    panel.querySelector('[data-action="debug"]').addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleDebug();
    });
    panel.querySelector('[data-action="refresh"]').addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      debugLog("info", "手动刷新");
      scanAndMaybeRender("manual-refresh", true);
    });
    panel.querySelector('[data-action="collapse"]').addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleCollapse();
    });

    state.searchInput.addEventListener("input", () => {
      state.searchResultActiveIndex = -1;
      DEBUG_STATE.searchResultActiveIndex = -1;
      debugLog("info", "搜索过滤", { keyword: state.searchInput.value });
      renderNav("search-input", true);
    });

    state.searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        navigateSearchResult(event.shiftKey ? -1 : 1);
      }
    });

    state.tabs.addEventListener("click", (event) => {
      const button = event.target.closest(".gpn-tab");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      state.activeTab = button.dataset.tab;
      applyVisibilityFallbacks("tab-click");
      saveViewStateForCurrentConversation();
      debugLog("info", "tab changed", { activeTab: state.activeTab });
      renderNav("tab-click", true);
    });

    setupPanelDrag();
    setupResizeHandle(panel.querySelector(".gpn-resize-handle-left"), "left");
    setupResizeHandle(panel.querySelector(".gpn-resize-handle-right"), "right");
    setupResizeHandle(panel.querySelector(".gpn-resize-handle-top"), "top");
    setupResizeHandle(panel.querySelector(".gpn-resize-handle-bottom"), "bottom");
    setupResizeHandle(panel.querySelector(".gpn-resize-handle-both"), "both");
    setupResizeHandle(panel.querySelector(".gpn-mini-resize-handle-x"), "right");
    applySavedPanelSize();
    updatePanelSizeDebug();
    updateStaticTexts();
    renderSettingsPanel();
    renderHelpPanel();
    applyThemeMode();
    scheduleAccentAutoResolve("create-panel");
    applyRouteAutoCollapse("create-panel");

    DEBUG_STATE.floatingPanelExists = true;
    DEBUG_STATE.navListExists = true;
    DEBUG_STATE.searchInputExists = true;
    DEBUG_STATE.debugPanelExists = true;
    debugLog("info", "浮窗创建完成");

    showToastOnce();
  }

  function toggleHelpMode() {
    if (!state.helpVisible) {
      state.beforeHelpState = {
        wasCollapsed: state.collapsed,
        wasSettingsMode: state.settingsVisible,
        activeTab: state.activeTab
      };

      if (state.collapsed) {
        state.collapsed = false;
        state.panel.classList.remove("gpt-prompt-navigator-collapsed");
      }

      state.helpVisible = true;
      state.settingsVisible = false;
      state.panel.classList.add("gpn-help-mode");
      state.panel.classList.remove("gpn-settings-mode");
      state.helpPanel.hidden = false;
      state.settingsPanel.hidden = true;
      renderHelpPanel();
    } else {
      exitHelpMode(true);
    }

    DEBUG_STATE.helpMode = state.helpVisible;
    DEBUG_STATE.beforeHelpWasCollapsed = !!(state.beforeHelpState && state.beforeHelpState.wasCollapsed);
    DEBUG_STATE.lastHelpToggleAt = new Date().toISOString();
    debugLog("info", "help mode toggled", { helpMode: state.helpVisible });
    updateStaticTexts();
    updateDebugSnapshot();
  }

  function exitHelpMode(restorePrevious) {
    if (!state.helpVisible) return;

    const before = state.beforeHelpState;
    state.helpVisible = false;
    state.panel.classList.remove("gpn-help-mode");
    state.helpPanel.hidden = true;

    if (restorePrevious && before) {
      state.activeTab = before.activeTab || state.activeTab;
      if (before.wasSettingsMode) {
        state.settingsVisible = true;
        state.panel.classList.add("gpn-settings-mode");
        state.settingsPanel.hidden = false;
      }
      if (before.wasCollapsed) {
        state.collapsed = true;
        state.panel.classList.add("gpt-prompt-navigator-collapsed");
      }
    }

    state.beforeHelpState = null;
    DEBUG_STATE.helpMode = false;
    DEBUG_STATE.lastHelpToggleAt = new Date().toISOString();
  }

  function toggleSettingsMode(source) {
    if (state.helpVisible) exitHelpMode(false);

    const openedFromCollapsed = state.collapsed && !state.settingsVisible;
    if (state.collapsed) {
      state.collapsed = false;
      state.panel.classList.remove("gpt-prompt-navigator-collapsed");
      const collapseButton = state.panel.querySelector('[data-action="collapse"]');
      if (collapseButton) collapseButton.textContent = t("collapse");
    }

    state.settingsVisible = !state.settingsVisible;
    state.panel.classList.toggle("gpn-settings-mode", state.settingsVisible);
    state.settingsPanel.hidden = !state.settingsVisible;
    DEBUG_STATE.settingsMode = state.settingsVisible;
    DEBUG_STATE.preferencesVisible = state.settingsVisible;
    DEBUG_STATE.lastSettingsToggleAt = new Date().toISOString();
    DEBUG_STATE.settingsOpenedFromCollapsed = openedFromCollapsed && state.settingsVisible;
    DEBUG_STATE.lastSettingsOpenSource = openedFromCollapsed ? "collapsed-minibar" : (source || "header");

    if (state.settingsVisible) {
      renderSettingsPanel();
      debugLog("info", "settings mode enabled");
    } else {
      debugLog("info", "settings mode disabled");
    }

    updateDebugSnapshot();
    updateStaticTexts();
    scheduleDebugPanelRefresh(true);
  }

  function toggleDebug() {
    if (state.collapsed) return;
    if (state.helpVisible) exitHelpMode(false);
    state.debugVisible = !state.debugVisible;
    state.debugPanel.hidden = !state.debugVisible;
    debugLog("info", "Debug toggled", { visible: state.debugVisible });
    if (state.debugVisible) renderDebugPanel();
  }

  function toggleCollapse() {
    if (state.routeAutoCollapsed) DEBUG_STATE.autoCollapseManualOverride = true;
    if (state.helpVisible) exitHelpMode(false);

    state.collapsed = !state.collapsed;
    state.panel.classList.toggle("gpt-prompt-navigator-collapsed", state.collapsed);
    const button = state.panel.querySelector('[data-action="collapse"]');
    if (button) button.textContent = state.collapsed ? t("expand") : t("collapse");

    if (state.collapsed) {
      state.helpVisible = false;
      state.debugVisible = false;
      if (state.debugPanel) state.debugPanel.hidden = true;
    }

    DEBUG_STATE.isCollapsed = state.collapsed;
    debugLog("info", state.collapsed ? "浮窗已折叠为 mini header" : "浮窗已展开", { isCollapsed: state.collapsed });
    updatePanelSizeDebug();
    scheduleDebugPanelRefresh(true);
  }

  function setCollapsedState(collapsed) {
    if (!state.panel || state.collapsed === collapsed) return;
    state.collapsed = collapsed;
    state.panel.classList.toggle("gpt-prompt-navigator-collapsed", state.collapsed);
    const button = state.panel.querySelector('[data-action="collapse"]');
    if (button) button.textContent = state.collapsed ? t("expand") : t("collapse");
    if (state.collapsed) {
      state.helpVisible = false;
      state.debugVisible = false;
      if (state.debugPanel) state.debugPanel.hidden = true;
    }
    DEBUG_STATE.isCollapsed = state.collapsed;
    updatePanelSizeDebug();
  }

  function detectNonChatOverlayOrRoute() {
    const hash = location.hash || "";
    const path = location.pathname || "/";
    const result = {
      shouldAutoCollapse: false,
      reason: null,
      matchedSelector: null,
      currentHash: hash,
      currentPath: path
    };
    if (/^#settings(\/|$)/i.test(hash)) return { ...result, shouldAutoCollapse: true, reason: "settings", matchedSelector: "hash:#settings" };
    if (/pricing/i.test(hash) || /pricing/i.test(path)) return { ...result, shouldAutoCollapse: true, reason: "pricing", matchedSelector: "pricing-route" };
    if (/profile|account/i.test(hash) || /\/(profile|account)(\/|$)/i.test(path)) return { ...result, shouldAutoCollapse: true, reason: "profile", matchedSelector: "profile-route" };

    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [data-radix-portal]')).filter((node) => node && node.nodeType === 1 && !isInsidePanel(node));
    for (const dialog of dialogs) {
      const rect = dialog.getBoundingClientRect ? dialog.getBoundingClientRect() : { width: 0, height: 0 };
      const large = rect.width > Math.min(420, window.innerWidth * 0.5) || rect.height > Math.min(320, window.innerHeight * 0.45);
      if (!large) continue;
      const text = normalizeText(dialog.textContent || "").toLowerCase();
      if (dialog.querySelector && dialog.querySelector("img") && rect.width > 280 && rect.height > 220) {
        return { ...result, shouldAutoCollapse: true, reason: "image-preview", matchedSelector: describeThemeSourceElement(dialog) || '[role="dialog"] img' };
      }
      if (/pricing|upgrade|subscription|plan|订阅|套餐|升级/.test(text)) return { ...result, shouldAutoCollapse: true, reason: "pricing", matchedSelector: describeThemeSourceElement(dialog) || '[role="dialog"]' };
      if (/profile|account|custom instructions|personalization|个人资料|账户|自定义指令/.test(text)) return { ...result, shouldAutoCollapse: true, reason: "profile", matchedSelector: describeThemeSourceElement(dialog) || '[role="dialog"]' };
      return { ...result, shouldAutoCollapse: true, reason: "other-modal", matchedSelector: describeThemeSourceElement(dialog) || '[role="dialog"]' };
    }
    return result;
  }

  function applyRouteAutoCollapse(reason) {
    if (!state.panel) return;
    const detected = detectNonChatOverlayOrRoute();
    DEBUG_STATE.autoCollapseMatchedSelector = detected.matchedSelector;
    DEBUG_STATE.autoCollapseCurrentHash = detected.currentHash;
    DEBUG_STATE.autoCollapseCurrentPath = detected.currentPath;

    if (detected.shouldAutoCollapse) {
      if (!state.routeAutoCollapsed) {
        state.beforeRouteAutoCollapseCollapsed = state.collapsed;
        state.beforeRouteAutoCollapseHidden = state.hidden;
        state.routeAutoCollapsed = true;
        state.routeAutoCollapseReason = detected.reason;
        DEBUG_STATE.beforeRouteAutoCollapseCollapsed = state.beforeRouteAutoCollapseCollapsed;
        DEBUG_STATE.beforeRouteAutoCollapseHidden = state.beforeRouteAutoCollapseHidden;
        setCollapsedState(true);
      }
      DEBUG_STATE.routeAutoCollapsed = true;
      DEBUG_STATE.routeAutoCollapseReason = detected.reason;
      return;
    }

    if (state.routeAutoCollapsed) {
      const restoreCollapsed = !!state.beforeRouteAutoCollapseCollapsed;
      setCollapsedState(restoreCollapsed);
      state.routeAutoCollapsed = false;
      state.routeAutoCollapseReason = null;
      DEBUG_STATE.routeAutoCollapsed = false;
      DEBUG_STATE.routeAutoCollapseReason = null;
      DEBUG_STATE.autoCollapseRestoreAt = new Date().toISOString();
    }
  }

  function renderHelpPanel() {
    if (!state.helpPanel) return;
    state.helpPanel.innerHTML = "";

    const title = document.createElement("div");
    title.className = "gpn-pref-title";
    title.textContent = t("helpTitle");
    state.helpPanel.appendChild(title);

    state.helpPanel.appendChild(createHelpSection(t("helpShortcuts"), [
      t("helpTogglePanel"),
      t("helpSearch"),
      t("helpPrevNext"),
      t("helpBookmark"),
      t("helpTags"),
      t("helpCopy")
    ]));

    state.helpPanel.appendChild(createHelpSection(t("helpPanelOps"), [
      t("helpDrag"),
      t("helpResizeX"),
      t("helpResizeY"),
      t("helpResizeBoth")
    ]));

    state.helpPanel.appendChild(createHelpSection(t("helpStatus"), [
      t("helpCollapse"),
      t("helpHide"),
      t("helpSettings"),
      t("helpHelp")
    ]));
  }

  function createHelpSection(title, lines) {
    const wrap = document.createElement("div");
    wrap.className = "gpn-help-section";

    const h = document.createElement("div");
    h.className = "gpn-pref-group-title";
    h.textContent = title;
    wrap.appendChild(h);

    lines.forEach((line) => {
      const div = document.createElement("div");
      div.className = "gpn-help-line";
      div.textContent = line;
      wrap.appendChild(div);
    });

    return wrap;
  }

  function renderSettingsPanel() {
    if (!state.settingsPanel) return;

    const p = state.preferences;
    state.settingsPanel.innerHTML = "";

    const title = document.createElement("div");
    title.className = "gpn-pref-title";
    title.textContent = t("settings");
    state.settingsPanel.appendChild(title);

    state.settingsPanel.appendChild(createSelectPreference("defaultTab", t("defaultTab"), TAB_ORDER.filter((key) => p.visibleTabs[key]).map((key) => [key, tabLabel(key)]), p.defaultTab));

    state.settingsPanel.appendChild(createPreferenceGroupTitle(t("visibleTabs")));
    TAB_ORDER.forEach((key) => {
      state.settingsPanel.appendChild(createVisibilityCheckbox("visibleTabs", key, tabLabel(key), !!p.visibleTabs[key], TAB_ORDER));
    });

    state.settingsPanel.appendChild(createSelectPreference("defaultTimeFolderMode", t("defaultTimeView"), TIME_MODE_ORDER.filter((key) => p.visibleTimeModes[key]).map((key) => [key, timeModeLabel(key)]), p.defaultTimeFolderMode));

    state.settingsPanel.appendChild(createPreferenceGroupTitle(t("visibleTimeModes")));
    TIME_MODE_ORDER.forEach((key) => {
      state.settingsPanel.appendChild(createVisibilityCheckbox("visibleTimeModes", key, timeModeLabel(key), !!p.visibleTimeModes[key], TIME_MODE_ORDER));
    });

    state.settingsPanel.appendChild(createSelectPreference("themeMode", t("pluginTheme"), [
      ["auto-inverse", t("autoInverse")],
      ["light", t("fixedLight")],
      ["dark", t("fixedDark")],
      ["auto-same", t("followChatGPT")]
    ], p.themeMode));

    const themeStatus = document.createElement("div");
    themeStatus.className = "gpn-theme-status";
    themeStatus.textContent = t("themeStatus", { chatgpt: themeLabel(DEBUG_STATE.detectedChatGPTTheme), plugin: themeLabel(DEBUG_STATE.appliedPluginTheme) });
    state.settingsPanel.appendChild(themeStatus);

    state.settingsPanel.appendChild(createSelectPreference("uiLanguage", t("uiLanguage"), [
      ["zh", t("chinese")],
      ["en", t("english")]
    ], p.uiLanguage));

    state.settingsPanel.appendChild(createPreferenceGroupTitle(t("settings")));
    [
      ["showQuoteMeta", t("showQuotes")],
      ["showImageMeta", t("showImages")],
      ["showAttachmentMeta", t("showAttachments")],
      ["showTimeLabel", t("showRecordedTime")],
      ["enableScrollSpy", t("enableScrollSpy")],
      ["enableEnhancedShortcuts", t("enableEnhancedShortcuts")],
      ["autoExpandCurrentFolder", t("autoExpandCurrentFolder")]
    ].forEach(([key, label]) => {
      state.settingsPanel.appendChild(createCheckboxPreference(key, label, !!p[key]));
    });

    state.settingsPanel.appendChild(createPreferenceGroupTitle(t("previewDisplay")));
    state.settingsPanel.appendChild(createNumberPreference("maxPreviewLines", t("previewLines"), p.maxPreviewLines, 1, 8));
    state.settingsPanel.appendChild(createNumberPreference("maxPreviewLength", t("previewLength"), p.maxPreviewLength, 40, 500));

    const actions = document.createElement("div");
    actions.className = "gpn-pref-actions";

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "gpn-mini-btn";
    reset.textContent = t("restoreDefaults");
    reset.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.preferences = normalizePreferences({ ...DEFAULT_PREFERENCES });
      savePreferencesForCurrentConversation();
      state.activeTab = state.preferences.defaultTab;
      state.timeFolderMode = state.preferences.defaultTimeFolderMode;
      DEBUG_STATE.lastPreferenceAction = "reset";
      debugLog("info", "preferences reset");
      updateStaticTexts();
      renderSettingsPanel();
      renderHelpPanel();
      applyThemeMode();
      scanAndMaybeRender("preferences-reset", true);
    });

    const resetPosition = document.createElement("button");
    resetPosition.type = "button";
    resetPosition.className = "gpn-mini-btn";
    resetPosition.textContent = t("resetPanelPosition");
    resetPosition.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      resetPanelPosition();
    });

    const copyStorage = document.createElement("button");
    copyStorage.type = "button";
    copyStorage.className = "gpn-mini-btn";
    copyStorage.textContent = t("copyStorageInfo");
    copyStorage.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      copyStorageInfo();
    });

    const repairTime = document.createElement("button");
    repairTime.type = "button";
    repairTime.className = "gpn-mini-btn";
    repairTime.textContent = t("repairTimeIndex");
    repairTime.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      repairCapturedTimesForCurrentConversation({ source: "manual", render: true, includeRegistry: true });
      scheduleDebugPanelRefresh(true);
    });

    actions.appendChild(reset);
    actions.appendChild(resetPosition);
    actions.appendChild(copyStorage);
    actions.appendChild(repairTime);
    state.settingsPanel.appendChild(actions);

    const storageTitle = document.createElement("div");
    storageTitle.className = "gpn-pref-group-title";
    storageTitle.textContent = t("dataStorageLocation");
    state.settingsPanel.appendChild(storageTitle);

    const storage = document.createElement("div");
    storage.className = "gpn-storage-info";
    storage.textContent = createStorageInfoText();
    state.settingsPanel.appendChild(storage);
  }

  function themeLabel(value) {
    if (value === "dark") return t("dark");
    if (value === "light") return t("light");
    return t("unknown");
  }

  function createPreferenceGroupTitle(text) {
    const node = document.createElement("div");
    node.className = "gpn-pref-group-title";
    node.textContent = text;
    return node;
  }

  function createSelectPreference(key, label, options, value) {
    const row = document.createElement("label");
    row.className = "gpn-pref-row";

    const span = document.createElement("span");
    span.textContent = label;

    const select = document.createElement("select");
    select.className = "gpn-pref-select";
    options.forEach(([optionValue, optionLabel]) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionLabel;
      option.selected = optionValue === value;
      select.appendChild(option);
    });
    select.addEventListener("change", () => updatePreference(key, select.value));

    row.appendChild(span);
    row.appendChild(select);
    return row;
  }

  function createCheckboxPreference(key, label, value) {
    const row = document.createElement("label");
    row.className = "gpn-pref-row gpn-pref-check";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = value;
    input.addEventListener("change", () => updatePreference(key, input.checked));

    const span = document.createElement("span");
    span.textContent = label;

    row.appendChild(input);
    row.appendChild(span);
    return row;
  }

  function createVisibilityCheckbox(groupKey, key, label, value, order) {
    const row = document.createElement("label");
    row.className = "gpn-pref-row gpn-pref-check";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = value;
    input.addEventListener("change", () => {
      const current = { ...state.preferences[groupKey] };
      current[key] = input.checked;

      if (!order.some((item) => current[item])) {
        input.checked = true;
        showInlineNotice(t("atLeastOneVisible"));
        debugLog("warn", "visibility preference rejected: all hidden", { groupKey, key });
        return;
      }

      state.preferences[groupKey] = current;
      updatePreference(groupKey, current);
    });

    const span = document.createElement("span");
    span.textContent = label;

    row.appendChild(input);
    row.appendChild(span);
    return row;
  }

  function createNumberPreference(key, label, value, min, max) {
    const row = document.createElement("label");
    row.className = "gpn-pref-row";

    const span = document.createElement("span");
    span.textContent = label;

    const input = document.createElement("input");
    input.className = "gpn-pref-number";
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    input.addEventListener("change", () => updatePreference(key, Number(input.value)));

    row.appendChild(span);
    row.appendChild(input);
    return row;
  }

  function updatePreference(key, value) {
    const oldLanguage = state.preferences.uiLanguage;
    state.preferences[key] = value;
    state.preferences = normalizePreferences(state.preferences);

    if (key === "defaultTab" && state.preferences.visibleTabs[value]) state.activeTab = value;
    if (key === "defaultTimeFolderMode" && state.preferences.visibleTimeModes[value]) state.timeFolderMode = value;

    applyVisibilityFallbacks("preference-update:" + key);
    savePreferencesForCurrentConversation();

    if (key === "uiLanguage" && oldLanguage !== state.preferences.uiLanguage) {
      DEBUG_STATE.lastLanguageChangeAt = new Date().toISOString();
    }

    DEBUG_STATE.lastPreferenceAction = key;
    debugLog("info", "preference updated", { key, value: state.preferences[key] });

    updateStaticTexts();
    renderSettingsPanel();
    renderHelpPanel();
    renderTabs();
    saveViewStateForCurrentConversation();
    applyThemeMode();
    scanAndMaybeRender(key === "uiLanguage" ? "language-change" : "preference-update", true);
    setupScrollSpy();
  }

  function createStorageInfoText() {
    return [
      t("storageIntro"),
      t("currentConversationId"),
      state.currentConversationId,
      "",
      t("storageKeys"),
      ...getStorageKeysSummary().map((key) => "- " + key)
    ].join("\n");
  }

  function copyStorageInfo() {
    const text = createStorageInfoText();
    copyText(text).then(() => {
      DEBUG_STATE.storageInfoCopiedAt = new Date().toISOString();
      DEBUG_STATE.storageKeysShown = getStorageKeysSummary();
      debugLog("info", "storage info copied", {
        conversationId: state.currentConversationId,
        storageKeys: DEBUG_STATE.storageKeysShown
      });
      scheduleDebugPanelRefresh(true);
    });
  }

  function detectChatGPTTheme() {
    const html = document.documentElement;
    const body = document.body;
    const classText = ((html && html.className) + " " + (body && body.className || "")).toLowerCase();

    if (/\bdark\b/.test(classText)) return "dark";
    if (/\blight\b/.test(classText)) return "light";

    try {
      const bg = getComputedStyle(body || html).backgroundColor;
      const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (match) {
        const r = Number(match[1]);
        const g = Number(match[2]);
        const b = Number(match[3]);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        if (brightness < 128) return "dark";
        return "light";
      }
    } catch (error) {
      debugLog("warn", "theme detection by background failed", { message: error.message });
    }

    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    return "light";
  }

  function isUsableCssValue(value) {
    const normalized = String(value || "").trim();
    if (!normalized) return false;
    if (/^(undefined|null|inherit|initial|unset|transparent)$/i.test(normalized)) return false;
    if (/^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/i.test(normalized)) return false;
    return true;
  }

  function describeThemeSourceElement(element) {
    if (!element || !element.tagName) return "";
    const testId = element.getAttribute && element.getAttribute("data-testid");
    const id = element.id ? "#" + element.id : "";
    const className = String(element.className || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((name) => "." + name)
      .join("");
    return element.tagName.toLowerCase() + id + (testId ? '[data-testid="' + testId + '"]' : "") + className;
  }

  function getThemeCandidateElements() {
    const nodes = [];
    const add = (node) => {
      if (node && node.nodeType === 1 && !nodes.includes(node)) nodes.push(node);
    };

    add(document.documentElement);
    add(document.body);
    add(document.querySelector("main"));
    add(document.querySelector('[data-testid="conversation-turn-0"]'));
    add(document.querySelector('[data-testid*="conversation"]'));
    add(document.querySelector('[data-testid*="thread"]'));
    add(document.querySelector('[data-testid]'));
    add(document.querySelector('[class*="conversation"]'));
    add(document.querySelector('[class*="thread"]'));
    add(document.querySelector(USER_SELECTOR));

    let current = document.querySelector("main") || document.querySelector(USER_SELECTOR);
    while (current && current.nodeType === 1) {
      add(current);
      current = current.parentElement;
    }

    return nodes;
  }

  function readCssVarFromCandidates(names, candidates) {
    for (const node of candidates) {
      let style;
      try {
        style = getComputedStyle(node);
      } catch (error) {
        debugLog("warn", "read css variable failed", { node: describeThemeSourceElement(node), message: error.message });
        continue;
      }

      for (const name of names) {
        const value = style.getPropertyValue(name).trim();
        if (isUsableCssValue(value)) {
          return { value, source: name, sourceElement: describeThemeSourceElement(node) };
        }
      }
    }
    return { value: "", source: "", sourceElement: "" };
  }

  function parseCssRgb(value) {
    const text = String(value || "").trim();
    let match = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (match) {
      let hex = match[1];
      if (hex.length === 3) hex = hex.split("").map((ch) => ch + ch).join("");
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1
      };
    }

    match = text.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
    if (!match) return null;
    return {
      r: Math.max(0, Math.min(255, Number(match[1]))),
      g: Math.max(0, Math.min(255, Number(match[2]))),
      b: Math.max(0, Math.min(255, Number(match[3]))),
      a: match[4] == null ? 1 : Math.max(0, Math.min(1, Number(match[4])))
    };
  }

  function parseCssColor(colorString) {
    return parseCssRgb(colorString);
  }

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }

    return { h, s, l };
  }

  function hslToRgb(h, s, l) {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let r;
    let g;
    let b;
    if (s === 0) {
      r = l;
      g = l;
      b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a: 1 };
  }

  function cssColorFromRgb(rgb) {
    if (!rgb) return "";
    return "rgb(" + Math.round(rgb.r) + ", " + Math.round(rgb.g) + ", " + Math.round(rgb.b) + ")";
  }

  function isBlackWhiteGray(rgb) {
    if (!rgb || rgb.a < 0.2) return true;
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return max - min < 18 || brightness < 26 || brightness > 246;
  }

  function isNeutralColor(rgb) {
    if (!rgb || rgb.a < 0.2) return true;
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return hsl.s < 0.12 || isBlackWhiteGray(rgb);
  }

  function isVisibleColor(rgb) {
    if (!rgb || rgb.a < 0.2) return false;
    return !isBlackWhiteGray(rgb) && !isNeutralColor(rgb);
  }

  function getContrastColor(rgb) {
    if (!rgb) return "#fff";
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 150 ? "#1f1f1f" : "#fff";
  }

  function deriveStrongAccentFromSoftAccent(softRgb) {
    if (!softRgb) return null;
    const hsl = rgbToHsl(softRgb.r, softRgb.g, softRgb.b);
    const strong = {
      h: hsl.h,
      s: Math.max(0.46, Math.min(0.92, hsl.s + 0.22)),
      l: Math.max(0.34, Math.min(0.54, hsl.l - 0.18))
    };
    return hslToRgb(strong.h, strong.s, strong.l);
  }

  function deriveSoftAccentFromStrongAccent(strongRgb) {
    if (!strongRgb) return null;
    const hsl = rgbToHsl(strongRgb.r, strongRgb.g, strongRgb.b);
    return hslToRgb(hsl.h, Math.max(0.22, hsl.s * 0.72), Math.min(0.88, Math.max(0.62, hsl.l + 0.26)));
  }

  function normalizeAccentColorSet(input) {
    const fallbackRgb = parseCssColor("#10a37f");
    const softRgb = parseCssColor(input && input.softAccent);
    const strongRgb = parseCssColor(input && input.strongAccent);
    const derivedRgb = softRgb && isVisibleColor(softRgb) ? deriveStrongAccentFromSoftAccent(softRgb) : null;
    let finalStrong = strongRgb && isVisibleColor(strongRgb) ? strongRgb : derivedRgb;
    let rejectedReason = "";
    let preventedBlack = false;

    if (strongRgb && !isVisibleColor(strongRgb)) {
      rejectedReason = "strong-accent-neutral-or-black";
      preventedBlack = isBlackWhiteGray(strongRgb);
    }

    if (!finalStrong || !isVisibleColor(finalStrong)) {
      finalStrong = fallbackRgb;
      if (!rejectedReason) rejectedReason = "fallback-accent";
    }

    const finalSoft = softRgb && isVisibleColor(softRgb) ? softRgb : finalStrong;
    const strongCss = cssColorFromRgb(finalStrong);

    return {
      softAccent: cssColorFromRgb(finalSoft),
      softAlpha: rgbaFromCssColor(cssColorFromRgb(finalSoft), 0.16),
      strongAccent: strongCss,
      strongSoft: rgbaFromCssColor(strongCss, 0.26),
      textOnAccent: getContrastColor(finalStrong),
      derivedStrong: derivedRgb ? cssColorFromRgb(derivedRgb) : null,
      rejectedReason,
      preventedBlack,
      validationPassed: isVisibleColor(finalStrong)
    };
  }

  function rgbaFromCssColor(value, alpha) {
    const color = parseCssColor(value);
    if (!color) return "color-mix(in srgb, " + value + " " + Math.round(alpha * 100) + "%, transparent)";
    return "rgba(" + Math.round(color.r) + ", " + Math.round(color.g) + ", " + Math.round(color.b) + ", " + alpha + ")";
  }

  function isLikelyNeutralColor(value) {
    return isNeutralColor(parseCssColor(value));
  }

  function getComposerAccentCandidateButtons() {
    const selectors = [
      "#composer-submit-button",
      "button#composer-submit-button",
      "button.composer-submit-button-color",
      'button[data-testid*="send" i]',
      'button[aria-label*="发送" i]',
      'button[aria-label*="Send" i]',
      'form button[type="submit"]'
    ];
    const candidates = [];
    const add = (button, selector) => {
      if (!button || button.nodeType !== 1 || isInsidePanel(button) || candidates.some((item) => item.element === button)) return;
      candidates.push({ element: button, selector });
    };

    selectors.forEach((selector) => {
      try {
        Array.from(document.querySelectorAll(selector)).slice(0, 16).forEach((button) => add(button, selector));
      } catch (error) {
        debugLog("warn", "composer accent selector failed", { selector, message: error.message });
      }
    });

    const composerRoots = Array.from(document.querySelectorAll('form, [data-testid*="composer" i], [class*="composer" i]')).slice(-8);
    composerRoots.forEach((root) => {
      if (!root || isInsidePanel(root)) return;
      const buttons = Array.from(root.querySelectorAll("button")).filter((button) => !isInsidePanel(button));
      buttons.slice(-4).forEach((button) => add(button, "composer-last-button"));
    });

    return candidates;
  }

  function getComposerAccentButtonRejectReason(button, background) {
    if (!button) return "not-found";
    if (isInsidePanel(button)) return "inside-panel";
    const rect = button.getBoundingClientRect ? button.getBoundingClientRect() : null;
    if (!rect || rect.width < 24 || rect.height < 24 || rect.width > 80 || rect.height > 80) return "size-out-of-range";
    const style = getComputedStyle(button);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || "1") < 0.08) return "not-visible";
    const color = parseCssColor(background || style.backgroundColor);
    if (!background || !isUsableCssValue(background || style.backgroundColor)) return "empty-background";
    if (!color || !isVisibleColor(color)) return "neutral-or-disabled-background";
    return "";
  }

  function resolveChatGPTAccentFromComposerButton() {
    const candidates = getComposerAccentCandidateButtons();
    DEBUG_STATE.accentComposerButtonFound = false;
    DEBUG_STATE.accentComposerButtonSelector = null;
    DEBUG_STATE.accentComposerButtonBackground = null;
    DEBUG_STATE.accentComposerButtonRejectedReason = candidates.length ? "no-valid-candidate" : "not-found";

    for (const candidate of candidates) {
      const button = candidate.element;
      let background = "";
      try {
        background = getComputedStyle(button).backgroundColor;
      } catch (error) {
        DEBUG_STATE.accentComposerButtonRejectedReason = "computed-style-failed";
        continue;
      }
      const rejected = getComposerAccentButtonRejectReason(button, background);
      if (rejected) {
        DEBUG_STATE.accentComposerButtonRejectedReason = rejected;
        continue;
      }
      const strongRgb = parseCssColor(background);
      const softRgb = deriveSoftAccentFromStrongAccent(strongRgb) || strongRgb;
      const strongAccent = cssColorFromRgb(strongRgb);
      const softAccent = cssColorFromRgb(softRgb);
      DEBUG_STATE.accentComposerButtonFound = true;
      DEBUG_STATE.accentComposerButtonSelector = candidate.selector;
      DEBUG_STATE.accentComposerButtonBackground = background;
      DEBUG_STATE.accentComposerButtonRejectedReason = null;
      return {
        value: strongAccent,
        softAccent,
        strongAccent,
        source: "composer-submit-button",
        sourceElement: describeThemeSourceElement(button),
        selector: candidate.selector,
        resolvedFromRenderedUI: true
      };
    }

    return { value: "", softAccent: "", strongAccent: "", source: "", sourceElement: "", resolvedFromRenderedUI: false };
  }

  function readRenderedAccentFromChatGPT() {
    return resolveChatGPTAccentFromComposerButton();
  }

  function resolveChatGPTAccent(candidates) {
    const composer = resolveChatGPTAccentFromComposerButton();
    if (isUsableCssValue(composer.value)) return composer;

    const selection = readCssVarFromCandidates(["--selection"], candidates);
    if (isUsableCssValue(selection.value) && !isLikelyNeutralColor(selection.value)) {
      return { ...selection, softAccent: selection.value, strongAccent: selection.value, resolvedFromRenderedUI: false };
    }

    const link = readCssVarFromCandidates(["--link"], candidates);
    if (isUsableCssValue(link.value) && !isLikelyNeutralColor(link.value)) {
      return { ...link, softAccent: link.value, strongAccent: link.value, resolvedFromRenderedUI: false };
    }

    const cssAccent = readCssVarFromCandidates(["--accent", "--interactive-bg-primary", "--interactive-bg-secondary-hover"], candidates);
    if (isUsableCssValue(cssAccent.value) && !isLikelyNeutralColor(cssAccent.value)) {
      return { ...cssAccent, softAccent: cssAccent.value, strongAccent: cssAccent.value, resolvedFromRenderedUI: false };
    }

    return { value: "", softAccent: "", strongAccent: "", source: "", sourceElement: "", resolvedFromRenderedUI: false };
  }

  function resolveChatGPTThemeVars() {
    const candidates = getThemeCandidateElements();
    const surface = readCssVarFromCandidates(["--main-surface-primary"], candidates);
    const surfaceSecondary = readCssVarFromCandidates(["--main-surface-secondary"], candidates);
    const surfaceTertiary = readCssVarFromCandidates(["--main-surface-tertiary", "--main-surface-secondary"], candidates);
    const text = readCssVarFromCandidates(["--text-primary"], candidates);
    const textSecondary = readCssVarFromCandidates(["--text-secondary"], candidates);
    const textTertiary = readCssVarFromCandidates(["--text-tertiary", "--text-secondary"], candidates);
    const border = readCssVarFromCandidates(["--border-light"], candidates);
    const borderMedium = readCssVarFromCandidates(["--border-medium", "--border-light"], candidates);
    const hover = readCssVarFromCandidates(["--interactive-bg-secondary-hover"], candidates);
    const link = readCssVarFromCandidates(["--link"], candidates);
    const selection = readCssVarFromCandidates(["--selection"], candidates);
    const accent = resolveChatGPTAccent(candidates);

    const hasSurface = isUsableCssValue(surface.value) || isUsableCssValue(surfaceSecondary.value);
    const hasText = isUsableCssValue(text.value) || isUsableCssValue(textSecondary.value);
    const hasBorder = isUsableCssValue(border.value) || isUsableCssValue(borderMedium.value);
    const applied = [hasSurface, hasText, hasBorder].filter(Boolean).length >= 2;
    const sourceElement = [surface, surfaceSecondary, text, border, accent].find((item) => item.sourceElement);

    return {
      applied,
      vars: { surface, surfaceSecondary, surfaceTertiary, text, textSecondary, textTertiary, border, borderMedium, hover, accent, link, selection },
      sourceElement: sourceElement ? sourceElement.sourceElement : ""
    };
  }

  function resolvePanelThemeVars(applied, useChatGPTVars) {
    const dark = applied === "dark";
    const fallback = dark ? {
      bg: "rgba(33, 33, 33, 0.98)",
      bgSecondary: "rgba(47, 47, 47, 0.96)",
      bgTertiary: "rgba(55, 55, 55, 0.88)",
      text: "#f5f5f5",
      textSecondary: "#c5c5c5",
      textTertiary: "#9b9b9b",
      border: "rgba(255, 255, 255, 0.12)",
      borderMedium: "rgba(255, 255, 255, 0.18)",
      accent: "#0f8f73",
      accentSoft: "rgba(15, 143, 115, 0.18)",
      hover: "rgba(255, 255, 255, 0.07)",
      scrollbarThumb: "rgba(255, 255, 255, 0.18)",
      scrollbarThumbHover: "rgba(255, 255, 255, 0.28)"
    } : {
      bg: "rgba(255, 255, 255, 0.98)",
      bgSecondary: "rgba(247, 247, 248, 0.96)",
      bgTertiary: "rgba(236, 236, 241, 0.72)",
      text: "#202123",
      textSecondary: "#5f6368",
      textTertiary: "#8e8ea0",
      border: "rgba(0, 0, 0, 0.10)",
      borderMedium: "rgba(0, 0, 0, 0.16)",
      accent: "#0d8f6f",
      accentSoft: "rgba(13, 143, 111, 0.14)",
      hover: "rgba(0, 0, 0, 0.04)",
      scrollbarThumb: "rgba(0, 0, 0, 0.18)",
      scrollbarThumbHover: "rgba(0, 0, 0, 0.30)"
    };

    const themeVars = resolveChatGPTThemeVars();
    const fallbackOnly = (value) => ({ value, source: "fallback", sourceElement: "" });
    const useVar = (resolved, fallbackValue) => useChatGPTVars && isUsableCssValue(resolved.value) ? resolved : fallbackOnly(fallbackValue);
    const useAccent = isUsableCssValue(themeVars.vars.accent.value) ? themeVars.vars.accent : fallbackOnly("#10a37f");
    const bg = useVar(themeVars.vars.surface, fallback.bg);
    const bgSecondary = useVar(themeVars.vars.surfaceSecondary, fallback.bgSecondary);
    const bgTertiary = useVar(themeVars.vars.surfaceTertiary, fallback.bgTertiary);
    const text = useVar(themeVars.vars.text, fallback.text);
    const textSecondary = useVar(themeVars.vars.textSecondary, fallback.textSecondary);
    const textTertiary = useVar(themeVars.vars.textTertiary, fallback.textTertiary);
    const border = useVar(themeVars.vars.border, fallback.border);
    const borderMedium = useVar(themeVars.vars.borderMedium, fallback.borderMedium);
    const hover = useVar(themeVars.vars.hover, fallback.hover);
    const accent = useAccent;
    const accentSet = normalizeAccentColorSet({
      softAccent: accent.softAccent || accent.value,
      strongAccent: accent.strongAccent || accent.value
    });

    return {
      values: {
        "--gpn-bg": bg.value,
        "--gpn-bg-secondary": bgSecondary.value,
        "--gpn-bg-tertiary": bgTertiary.value,
        "--gpn-text": text.value,
        "--gpn-text-secondary": textSecondary.value,
        "--gpn-text-tertiary": textTertiary.value,
        "--gpn-border": border.value,
        "--gpn-border-medium": borderMedium.value,
        "--gpn-accent": accentSet.strongAccent,
        "--gpn-accent-soft": accentSet.softAlpha,
        "--gpn-accent-strong": accentSet.strongAccent,
        "--gpn-accent-strong-soft": accentSet.strongSoft,
        "--gpn-accent-text": accentSet.textOnAccent,
        "--gpn-hover": hover.value,
        "--gpn-selected-bg": dark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
        "--gpn-selected-border": dark ? "rgba(255, 255, 255, 0.18)" : "rgba(0, 0, 0, 0.14)",
        "--gpn-scrollbar-thumb": fallback.scrollbarThumb,
        "--gpn-scrollbar-thumb-hover": fallback.scrollbarThumbHover
      },
      sources: [bg, bgSecondary, bgTertiary, text, textSecondary, textTertiary, border, borderMedium, hover, accent],
      themeVars,
      accent,
      accentSet
    };
  }

  function applyPanelThemeVars(applied, detected) {
    if (!state.panel) return;
    const resolved = resolvePanelThemeVars(applied, applied === detected);
    Object.entries(resolved.values).forEach(([key, value]) => {
      state.panel.style.setProperty(key, value);
    });
    DEBUG_STATE.cssVarThemeApplied = resolved.themeVars.applied;
    DEBUG_STATE.gpnBgResolved = resolved.values["--gpn-bg"];
    DEBUG_STATE.gpnSurfaceResolved = resolved.values["--gpn-bg-secondary"];
    DEBUG_STATE.gpnTextResolved = resolved.values["--gpn-text"];
    DEBUG_STATE.gpnBorderResolved = resolved.values["--gpn-border"];
    DEBUG_STATE.gpnAccentResolved = resolved.values["--gpn-accent"];
    DEBUG_STATE.themeVarSourceElement = resolved.themeVars.sourceElement;
    DEBUG_STATE.accentSource = resolved.accent.source || "fallback";
    DEBUG_STATE.accentResolvedFromChatGPT = resolved.accent.source !== "fallback";
    DEBUG_STATE.accentResolvedFromRenderedUI = !!resolved.accent.resolvedFromRenderedUI;
    DEBUG_STATE.accentSoftResolved = resolved.values["--gpn-accent-soft"];
    DEBUG_STATE.accentStrongResolved = resolved.values["--gpn-accent-strong"];
    DEBUG_STATE.accentSoftRaw = resolved.accent.softAccent || null;
    DEBUG_STATE.accentStrongRaw = resolved.accent.strongAccent || resolved.accent.value || null;
    DEBUG_STATE.accentStrongDerived = resolved.accentSet.derivedStrong;
    DEBUG_STATE.accentTextOnAccent = resolved.accentSet.textOnAccent;
    DEBUG_STATE.accentRejectedReason = resolved.accentSet.rejectedReason || null;
    DEBUG_STATE.accentFallbackPreventedBlack = !!resolved.accentSet.preventedBlack;
    DEBUG_STATE.accentColorValidationPassed = !!resolved.accentSet.validationPassed;
    DEBUG_STATE.cssLinkValue = resolved.themeVars.vars.link.value || null;
    DEBUG_STATE.cssSelectionValue = resolved.themeVars.vars.selection.value || null;
    DEBUG_STATE.accentAppliedToControls = true;
  }

  function applyResolvedAccentColor(accent, reason) {
    if (!state.panel || !accent || !isUsableCssValue(accent.value || accent.strongAccent)) return false;
    const accentSet = normalizeAccentColorSet({
      softAccent: accent.softAccent || accent.value,
      strongAccent: accent.strongAccent || accent.value
    });
    if (!accentSet.validationPassed) return false;

    const values = {
      "--gpn-accent": accentSet.strongAccent,
      "--gpn-accent-soft": accentSet.softAlpha,
      "--gpn-accent-strong": accentSet.strongAccent,
      "--gpn-accent-strong-soft": accentSet.strongSoft,
      "--gpn-accent-text": accentSet.textOnAccent
    };

    Object.entries(values).forEach(([key, value]) => {
      state.panel.style.setProperty(key, value);
    });

    DEBUG_STATE.gpnAccentResolved = values["--gpn-accent"];
    DEBUG_STATE.accentSource = accent.source || "composer-submit-button";
    DEBUG_STATE.accentResolvedFromChatGPT = DEBUG_STATE.accentSource !== "fallback";
    DEBUG_STATE.accentResolvedFromRenderedUI = !!accent.resolvedFromRenderedUI;
    DEBUG_STATE.accentSoftResolved = values["--gpn-accent-soft"];
    DEBUG_STATE.accentStrongResolved = values["--gpn-accent-strong"];
    DEBUG_STATE.accentSoftRaw = accent.softAccent || null;
    DEBUG_STATE.accentStrongRaw = accent.strongAccent || accent.value || null;
    DEBUG_STATE.accentStrongDerived = accentSet.derivedStrong;
    DEBUG_STATE.accentTextOnAccent = accentSet.textOnAccent;
    DEBUG_STATE.accentRejectedReason = accentSet.rejectedReason || null;
    DEBUG_STATE.accentFallbackPreventedBlack = !!accentSet.preventedBlack;
    DEBUG_STATE.accentColorValidationPassed = !!accentSet.validationPassed;
    DEBUG_STATE.accentAppliedToControls = true;
    DEBUG_STATE.accentAppliedToTabs = true;
    DEBUG_STATE.accentAppliedToTimeModes = true;
    DEBUG_STATE.accentAppliedToTagChips = true;
    DEBUG_STATE.accentAppliedToExpandButtons = true;
    DEBUG_STATE.accentAppliedToSearchFocus = true;
    debugLog("info", "accent resolved", { reason, source: DEBUG_STATE.accentSource, accent: values["--gpn-accent"] });
    return true;
  }

  function scheduleAccentAutoResolve(reason) {
    state.accentAutoResolveTimers.forEach((timer) => clearTimeout(timer));
    state.accentAutoResolveTimers = [];
    DEBUG_STATE.accentAutoResolveScheduledAt = new Date().toISOString();
    DEBUG_STATE.accentAutoResolveReason = reason || "unknown";
    DEBUG_STATE.accentAutoResolveAttemptCount = 0;
    DEBUG_STATE.accentSourcePriority = "composer-submit-button-first";

    const delays = [0, 300, 800, 1500, 3000, 6000];
    const run = () => {
      DEBUG_STATE.accentAutoResolveAttemptCount += 1;
      DEBUG_STATE.accentAutoResolveLastAttemptAt = new Date().toISOString();
      const composerAccent = resolveChatGPTAccentFromComposerButton();
      if (isUsableCssValue(composerAccent.value) && applyResolvedAccentColor(composerAccent, reason || "accent-auto-resolve")) {
        DEBUG_STATE.accentAutoResolveSucceededAt = new Date().toISOString();
        DEBUG_STATE.accentAutoResolveSucceededWithoutSettings = reason !== "settings-open" && reason !== "settings";
        state.accentAutoResolveTimers.forEach((timer) => clearTimeout(timer));
        state.accentAutoResolveTimers = [];
      }
    };

    delays.forEach((delay) => {
      const timer = setTimeout(run, delay);
      state.accentAutoResolveTimers.push(timer);
    });
  }

  function nodeMayContainComposerAccentTarget(node) {
    if (!node || node.nodeType !== 1 || isInsidePanel(node)) return false;
    const element = node;
    if (element.id === "composer-submit-button") return true;
    if (element.matches && element.matches('button#composer-submit-button, button.composer-submit-button-color, button[data-testid*="send" i], form button[type="submit"]')) return true;
    if (element.querySelector && element.querySelector('#composer-submit-button, button.composer-submit-button-color, button[data-testid*="send" i], form button[type="submit"]')) return true;
    const text = [
      element.getAttribute && element.getAttribute("aria-label"),
      element.getAttribute && element.getAttribute("data-testid"),
      element.className
    ].join(" ").toLowerCase();
    return /composer|send|submit|发送/.test(text);
  }

  function observeComposerAccentButton() {
    if (state.composerAccentObserver) state.composerAccentObserver.disconnect();
    if (!document.body) return;
    state.composerAccentObserver = new MutationObserver((mutations) => {
      const relevant = mutations.some((mutation) => {
        if (isInsidePanel(mutation.target)) return false;
        if (nodeMayContainComposerAccentTarget(mutation.target)) return true;
        return Array.from(mutation.addedNodes || []).some(nodeMayContainComposerAccentTarget);
      });
      if (!relevant) return;
      clearTimeout(state.accentAutoResolveDebounce);
      state.accentAutoResolveDebounce = setTimeout(() => scheduleAccentAutoResolve("composer-mutation"), 200);
    });
    state.composerAccentObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "disabled", "aria-label"]
    });
  }

  function applyThemeMode() {
    if (!state.panel) return;

    const detected = detectChatGPTTheme();
    const mode = state.preferences.themeMode || "auto-inverse";
    let applied = "dark";

    if (mode === "light") applied = "light";
    else if (mode === "dark") applied = "dark";
    else if (mode === "auto-same") applied = detected;
    else applied = detected === "dark" ? "light" : "dark";

    state.panel.classList.toggle("gpn-theme-light", applied === "light");
    state.panel.classList.toggle("gpn-theme-dark", applied === "dark");
    applyPanelThemeVars(applied, detected);

    DEBUG_STATE.themeMode = mode;
    DEBUG_STATE.detectedChatGPTTheme = detected;
    DEBUG_STATE.appliedPluginTheme = applied;
    DEBUG_STATE.lastThemeUpdateAt = new Date().toISOString();
    scheduleAccentAutoResolve("apply-theme-mode");
  }

  function setupThemeWatcher() {
    if (state.themeObserver) state.themeObserver.disconnect();

    state.themeObserver = new MutationObserver(() => {
      applyThemeMode();
      if (state.settingsVisible) renderSettingsPanel();
    });

    state.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    if (document.body) state.themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });

    if (window.matchMedia) {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => {
        applyThemeMode();
        if (state.settingsVisible) renderSettingsPanel();
      };
      if (media.addEventListener) media.addEventListener("change", handler);
      else if (media.addListener) media.addListener(handler);
    }
  }

  function togglePanelHidden() {
    state.hidden = !state.hidden;
    state.panel.style.display = state.hidden ? "none" : "";
    DEBUG_STATE.isPanelHidden = state.hidden;
    DEBUG_STATE.lastShortcut = "Ctrl+Shift+P";
    debugLog("info", "快捷键显示/隐藏浮窗", { isPanelHidden: state.hidden });
  }

  function focusSearchByShortcut() {
    if (state.hidden) togglePanelHidden();
    if (state.collapsed) toggleCollapse();
    if (state.helpVisible) exitHelpMode(true);
    if (state.settingsVisible) toggleSettingsMode();
    state.searchInput.focus();
    state.searchInput.select();
    DEBUG_STATE.lastShortcut = "Ctrl+Shift+F";
    debugLog("info", "快捷键聚焦搜索");
  }

  function isExternalEditableTarget(target) {
    if (!target) return false;
    if (target === state.searchInput) return false;
    if (state.panel && state.panel.contains(target)) return false;
    return target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable || target.closest && target.closest('[contenteditable="true"]');
  }

  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const externalTyping = isExternalEditableTarget(target);

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        togglePanelHidden();
        return;
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        focusSearchByShortcut();
        return;
      }

      if (event.key === "Escape") {
        if (externalTyping) return;

        if (state.helpVisible) {
          exitHelpMode(true);
          return;
        }

        if (state.debugVisible) {
          state.debugVisible = false;
          state.debugPanel.hidden = true;
          DEBUG_STATE.lastShortcut = "Esc";
          debugLog("info", "Esc close debug");
          return;
        }

        if (document.activeElement === state.searchInput) {
          state.searchInput.value = "";
          state.searchInput.blur();
          DEBUG_STATE.lastShortcut = "Esc";
          debugLog("info", "Esc clear search");
          renderNav("esc-clear-search", true);
        }
        return;
      }

      if (!state.preferences.enableEnhancedShortcuts) return;
      if (externalTyping) return;
      if (!(event.ctrlKey && event.shiftKey)) return;

      const key = event.key;
      if (key === "ArrowDown") {
        event.preventDefault();
        triggerEnhancedShortcut("Ctrl+Shift+ArrowDown", "next-message", () => jumpRelativeMessage(1));
      } else if (key === "ArrowUp") {
        event.preventDefault();
        triggerEnhancedShortcut("Ctrl+Shift+ArrowUp", "previous-message", () => jumpRelativeMessage(-1));
      } else if (key.toLowerCase() === "b") {
        event.preventDefault();
        triggerEnhancedShortcut("Ctrl+Shift+B", "bookmark-active", () => {
          const message = getActiveMessage();
          if (message) toggleBookmark(message);
          return message;
        });
      } else if (key.toLowerCase() === "t") {
        event.preventDefault();
        triggerEnhancedShortcut("Ctrl+Shift+T", "tag-active", () => {
          const message = getActiveMessage();
          if (message) editTags(message);
          return message;
        });
      } else if (key.toLowerCase() === "c") {
        event.preventDefault();
        triggerEnhancedShortcut("Ctrl+Shift+C", "copy-active", () => {
          const message = getActiveMessage();
          if (message) copyMessage(message, null);
          return message;
        });
      }
    }, true);
  }

  function triggerEnhancedShortcut(shortcut, action, fn) {
    const message = fn();
    DEBUG_STATE.lastEnhancedShortcut = shortcut;
    DEBUG_STATE.shortcutTargetMessageId = message ? message.messageId : null;
    debugLog("info", "enhanced shortcut", {
      shortcut,
      action,
      targetMessageId: message ? message.messageId : null
    });
  }

  function getActiveMessage() {
    if (state.activeMessageId) {
      const found = state.userMessages.find((message) => message.messageId === state.activeMessageId || message.id === state.activeMessageId);
      if (found) return found;
    }
    return state.userMessages[0] || null;
  }

  function jumpRelativeMessage(direction) {
    if (!state.userMessages.length) return null;
    const active = getActiveMessage();
    let index = active ? state.userMessages.findIndex((message) => message.messageId === active.messageId) : -1;
    if (index < 0) index = direction > 0 ? -1 : state.userMessages.length;
    const nextIndex = Math.max(0, Math.min(state.userMessages.length - 1, index + direction));
    const next = state.userMessages[nextIndex];
    if (next) {
      scrollToMessageById(next.messageId);
      requestNavListAutoScroll(direction > 0 ? "shortcut-next" : "shortcut-prev");
    }
    return next;
  }

  function navigateSearchResult(direction) {
    const items = Array.from(state.navList.querySelectorAll(".gpn-item[data-message-id]"));
    if (!items.length) return null;

    let index = items.findIndex((item) => item.dataset.messageId === state.activeMessageId);
    if (index < 0) index = state.searchResultActiveIndex;
    if (index < 0) index = direction > 0 ? -1 : items.length;

    const nextIndex = (index + direction + items.length) % items.length;
    state.searchResultActiveIndex = nextIndex;
    DEBUG_STATE.searchResultActiveIndex = nextIndex;

    const messageId = items[nextIndex].dataset.messageId;
    const message = state.userMessages.find((item) => item.messageId === messageId || item.id === messageId);
    scrollToMessageById(messageId);
    requestNavListAutoScroll(direction > 0 ? "search-keyboard-next" : "search-keyboard-prev");

    debugLog("info", "search result navigation", {
      direction,
      searchResultActiveIndex: nextIndex,
      targetMessageId: messageId
    });

    return message || null;
  }

  function setupPanelDrag() {
    const header = state.panel && state.panel.querySelector(".gpn-header");
    if (!header) return;

    const getDragBlockedReason = (event) => {
      if (state.resize) return "resize-active";
      if (event.button != null && event.button !== 0) return "non-primary-button";
      const target = event.target;
      if (target && target.closest && target.closest("button,input,select,textarea,[data-no-drag],.gpn-resize-handle-left,.gpn-resize-handle-right,.gpn-resize-handle-top,.gpn-resize-handle-bottom,.gpn-resize-handle-x,.gpn-resize-handle-y,.gpn-resize-handle-both,.gpn-mini-resize-handle-x,.gpn-mini-resize-handle-left,.gpn-button")) return "interactive-target";
      return "";
    };

    const recordDragPointDebug = (event, blockedReason) => {
      const target = event.target;
      const rect = header.getBoundingClientRect();
      const centerX = Math.round(rect.left + rect.width / 2);
      const centerY = Math.round(rect.top + rect.height / 2);
      const elements = document.elementsFromPoint ? document.elementsFromPoint(centerX, centerY) : [];
      DEBUG_STATE.lastDragPointerDownAt = new Date().toISOString();
      DEBUG_STATE.lastDragPointerDownTarget = describeElementForDebug(target);
      DEBUG_STATE.lastDragBlockedReason = blockedReason || null;
      DEBUG_STATE.dragElementFromPoint = elements.slice(0, 8).map(describeElementForDebug);
      DEBUG_STATE.dragCurrentUrlHash = location.hash || "";
    };

    const startDrag = (event) => {
      if (state.dragState) return;
      const blockedReason = getDragBlockedReason(event);
      recordDragPointDebug(event, blockedReason);
      if (blockedReason) return;
      if (state.resize) return;

      const rect = state.panel.getBoundingClientRect();
      state.dragState = {
        pointerId: event.pointerId != null ? event.pointerId : null,
        pointerType: event.pointerType || "mouse",
        header,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: rect.left,
        startTop: rect.top,
        width: rect.width,
        height: rect.height
      };

      DEBUG_STATE.dragStartAt = new Date().toISOString();
      DEBUG_STATE.lastDragMode = "move";
      debugLog("info", "panel drag start", {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      });

      event.preventDefault();
      event.stopPropagation();
      if (event.pointerId != null && header.setPointerCapture) {
        try {
          header.setPointerCapture(event.pointerId);
        } catch (error) {
          debugLog("warn", "setPointerCapture failed", { message: error.message });
        }
      }
      document.addEventListener("pointermove", onPanelDragMove, true);
      document.addEventListener("pointerup", onPanelDragEnd, true);
      document.addEventListener("pointercancel", onPanelDragEnd, true);
      document.addEventListener("mousemove", onPanelDragMove, true);
      document.addEventListener("mouseup", onPanelDragEnd, true);
    };

    header.addEventListener("pointerdown", startDrag, true);
    header.addEventListener("mousedown", startDrag, true);
  }

  function clampPanelPosition(left, top, width, height) {
    const minVisible = 40;
    const maxLeft = Math.max(0, window.innerWidth - Math.min(width, window.innerWidth));
    const maxTop = Math.max(0, window.innerHeight - Math.min(height, window.innerHeight));
    return {
      left: clamp(left, 0, Math.max(maxLeft, window.innerWidth - minVisible)),
      top: clamp(top, 0, Math.max(maxTop, window.innerHeight - minVisible))
    };
  }

  function onPanelDragMove(event) {
    if (!state.dragState || !state.panel) return;
    if (state.dragState.pointerId != null && event.pointerId != null && event.pointerId !== state.dragState.pointerId) return;

    const nextLeft = state.dragState.startLeft + (event.clientX - state.dragState.startX);
    const nextTop = state.dragState.startTop + (event.clientY - state.dragState.startY);
    const clamped = clampPanelPosition(nextLeft, nextTop, state.dragState.width, state.dragState.height);

    state.panel.style.left = Math.round(clamped.left) + "px";
    state.panel.style.top = Math.round(clamped.top) + "px";
    state.panel.style.right = "auto";
    state.panel.style.bottom = "auto";
    event.preventDefault();
    updatePanelSizeDebug();
  }

  function onPanelDragEnd(event) {
    if (state.dragState && state.dragState.pointerId != null && event && event.pointerId != null && event.pointerId !== state.dragState.pointerId) return;
    document.removeEventListener("mousemove", onPanelDragMove, true);
    document.removeEventListener("mouseup", onPanelDragEnd, true);
    document.removeEventListener("pointermove", onPanelDragMove, true);
    document.removeEventListener("pointerup", onPanelDragEnd, true);
    document.removeEventListener("pointercancel", onPanelDragEnd, true);

    if (!state.dragState || !state.panel) return;
    if (state.dragState.pointerId != null && state.dragState.header && state.dragState.header.releasePointerCapture) {
      try {
        state.dragState.header.releasePointerCapture(state.dragState.pointerId);
      } catch (error) {
        debugLog("warn", "releasePointerCapture failed", { message: error.message });
      }
    }

    const rect = state.panel.getBoundingClientRect();
    savePanelSizeAndPosition({
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      right: Math.round(window.innerWidth - rect.right),
      bottom: Math.round(window.innerHeight - rect.bottom),
      positionMode: "custom"
    });

    DEBUG_STATE.dragEndAt = new Date().toISOString();
    DEBUG_STATE.panelPositionMode = "custom";
    debugLog("info", "panel drag end", {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    });

    state.dragState = null;
    updatePanelSizeDebug();
  }

  function savePanelSizeAndPosition(next) {
    const prev = storageGet(getPanelSizeKey(), {}) || {};
    storageSet(getPanelSizeKey(), { ...prev, ...next });
  }

  function resetPanelPosition() {
    const rect = state.panel.getBoundingClientRect();
    savePanelSizeAndPosition({
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      left: null,
      top: null,
      right: 16,
      bottom: null,
      positionMode: "default-right"
    });

    state.panel.style.left = "auto";
    state.panel.style.top = "88px";
    state.panel.style.right = "16px";
    state.panel.style.bottom = "auto";

    DEBUG_STATE.lastPositionResetAt = new Date().toISOString();
    DEBUG_STATE.panelPositionMode = "default-right";
    updatePanelSizeDebug();
    debugLog("info", "panel position reset");
    showInlineNotice(t("positionReset"));
  }

  function setupResizeHandle(handle, mode) {
    if (!handle) return;

    const startResize = (event) => {
      if (state.resize) return;
      if (event.button != null && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const rect = state.panel.getBoundingClientRect();
      state.resize = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
        startLeft: rect.left,
        startTop: rect.top,
        startRight: window.innerWidth - rect.right,
        startBottom: window.innerHeight - rect.bottom
      };

      DEBUG_STATE.lastResizeMode = mode;
      DEBUG_STATE.lastResizeHandleUsed = mode;
      DEBUG_STATE.resizeStartAt = new Date().toISOString();
      debugLog("info", "resize 开始", { mode, width: Math.round(rect.width), height: Math.round(rect.height) });

      document.addEventListener("mousemove", onPanelResizeMove, true);
      document.addEventListener("mouseup", onPanelResizeEnd, true);
      document.addEventListener("pointermove", onPanelResizeMove, true);
      document.addEventListener("pointerup", onPanelResizeEnd, true);
    };

    handle.addEventListener("pointerdown", startResize, true);
    handle.addEventListener("mousedown", startResize, true);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function onPanelResizeMove(event) {
    if (!state.resize || !state.panel) return;

    const minWidth = 260;
    const maxWidth = Math.max(minWidth, window.innerWidth - 8);
    const header = state.panel.querySelector(".gpn-header");
    const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 42;
    const minHeight = state.collapsed ? headerHeight : 180;
    const maxHeight = Math.floor(window.innerHeight * 0.95);
    const dx = event.clientX - state.resize.startX;
    const dy = event.clientY - state.resize.startY;

    state.panel.style.right = "auto";
    state.panel.style.bottom = "auto";

    if (state.resize.mode === "right" || state.resize.mode === "both") {
      const width = clamp(state.resize.startWidth + dx, minWidth, Math.min(maxWidth, window.innerWidth - state.resize.startLeft));
      state.panel.style.width = Math.round(width) + "px";
      state.panel.style.left = Math.round(state.resize.startLeft) + "px";
    }

    if (state.resize.mode === "left") {
      const maxLeft = state.resize.startLeft + state.resize.startWidth - minWidth;
      const nextLeft = clamp(state.resize.startLeft + dx, 0, maxLeft);
      const width = clamp(state.resize.startWidth + (state.resize.startLeft - nextLeft), minWidth, Math.min(maxWidth, state.resize.startLeft + state.resize.startWidth));
      state.panel.style.left = Math.round(nextLeft) + "px";
      state.panel.style.width = Math.round(width) + "px";
    }

    if (state.resize.mode === "bottom" || state.resize.mode === "both") {
      const height = clamp(state.resize.startHeight + dy, minHeight, Math.min(maxHeight, window.innerHeight - state.resize.startTop));
      state.panel.style.height = Math.round(height) + "px";
      state.panel.style.maxHeight = "95vh";
      state.panel.style.top = Math.round(state.resize.startTop) + "px";
    }

    if (state.resize.mode === "top") {
      const maxTop = state.resize.startTop + state.resize.startHeight - minHeight;
      const nextTop = clamp(state.resize.startTop + dy, 0, maxTop);
      const height = clamp(state.resize.startHeight + (state.resize.startTop - nextTop), minHeight, Math.min(maxHeight, state.resize.startTop + state.resize.startHeight));
      state.panel.style.top = Math.round(nextTop) + "px";
      state.panel.style.height = Math.round(height) + "px";
      state.panel.style.maxHeight = "95vh";
    }

    updatePanelSizeDebug();
  }

  function onPanelResizeEnd() {
    document.removeEventListener("mousemove", onPanelResizeMove, true);
    document.removeEventListener("mouseup", onPanelResizeEnd, true);
    document.removeEventListener("pointermove", onPanelResizeMove, true);
    document.removeEventListener("pointerup", onPanelResizeEnd, true);

    if (!state.resize || !state.panel) return;

    const rect = state.panel.getBoundingClientRect();
    const previousSaved = storageGet(getPanelSizeKey(), null) || {};
    const savedHeight = state.collapsed && (state.resize.mode === "left" || state.resize.mode === "right") && previousSaved.height ? Number(previousSaved.height) : Math.round(rect.height);
    savePanelSizeAndPosition({
      width: Math.round(rect.width),
      height: savedHeight,
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      right: Math.round(window.innerWidth - rect.right),
      bottom: Math.round(window.innerHeight - rect.bottom),
      positionMode: state.panel.style.left && state.panel.style.left !== "auto" ? "custom" : "default-right"
    });

    DEBUG_STATE.resizeEndAt = new Date().toISOString();
    if (state.collapsed && (state.resize.mode === "left" || state.resize.mode === "right")) {
      DEBUG_STATE.lastMiniResizeAt = DEBUG_STATE.resizeEndAt;
      DEBUG_STATE.lastMiniResizeWidth = Math.round(rect.width);
    }
    debugLog("info", "resize 结束", {
      mode: state.resize.mode,
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    });

    state.resize = null;
    updatePanelSizeDebug();
  }

  function applySavedPanelSize() {
    const saved = storageGet(getPanelSizeKey(), null);
    if (!saved || !state.panel) {
      updatePanelSizeDebug();
      return;
    }

    if (saved.width) state.panel.style.width = clamp(Number(saved.width), 260, Math.max(260, window.innerWidth - 8)) + "px";
    if (saved.height) {
      state.panel.style.height = clamp(Number(saved.height), 180, Math.floor(window.innerHeight * 0.95)) + "px";
      state.panel.style.maxHeight = "95vh";
    }

    if (saved.positionMode === "custom" && saved.left != null && saved.top != null) {
      const width = Number(saved.width) || state.panel.getBoundingClientRect().width || 300;
      const height = Number(saved.height) || state.panel.getBoundingClientRect().height || 240;
      const pos = clampPanelPosition(Number(saved.left), Number(saved.top), width, height);
      state.panel.style.left = Math.round(pos.left) + "px";
      state.panel.style.top = Math.round(pos.top) + "px";
      state.panel.style.right = "auto";
      state.panel.style.bottom = "auto";
      DEBUG_STATE.panelPositionMode = "custom";
    } else {
      state.panel.style.left = "auto";
      state.panel.style.top = "88px";
      state.panel.style.right = "16px";
      state.panel.style.bottom = "auto";
      DEBUG_STATE.panelPositionMode = "default-right";
    }

    updatePanelSizeDebug();
  }

  function updatePanelSizeDebug() {
    if (!state.panel) return;
    const rect = state.panel.getBoundingClientRect();
    DEBUG_STATE.panelWidth = Math.round(rect.width);
    DEBUG_STATE.panelHeight = Math.round(rect.height);
    DEBUG_STATE.panelLeft = Math.round(rect.left);
    DEBUG_STATE.panelTop = Math.round(rect.top);
    DEBUG_STATE.panelRight = Math.round(rect.right);
    DEBUG_STATE.panelBottom = Math.round(rect.bottom);
  }

  function showToastOnce() {
    setTimeout(() => {
      if (!state.panel || DEBUG_STATE.toastShown) return;
      const toast = document.createElement("div");
      toast.className = "gpn-toast";
      toast.textContent = "GPT Navigator: Ctrl+Shift+P";
      document.body.appendChild(toast);
      DEBUG_STATE.toastShown = true;
      setTimeout(() => toast.remove(), 2000);
    }, 300);
  }

  function showToast(text) {
    if (!text) return;
    const toast = document.createElement("div");
    toast.className = "gpn-toast";
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  function scheduleDelayedInitScans() {
    let count = 0;

    function next() {
      if (DEBUG_STATE.userMessageCount > 0 && state.initialBaselineReady) return;
      if (count >= 5) return;

      count += 1;
      DEBUG_STATE.delayedInitScanCount += 1;
      const reason = "delayed-init-" + count;

      debugLog("info", "delayed init scan", {
        count,
        userMessageCount: DEBUG_STATE.userMessageCount
      });

      scanAndMaybeRender(reason, false);
      scheduleAccentAutoResolve(reason);

      if (DEBUG_STATE.userMessageCount > 0 && state.initialBaselineReady) return;
      setTimeout(next, 1500);
    }

    setTimeout(next, 1500);
  }

  function setupMutationObserver() {
    if (state.observer) state.observer.disconnect();

    state.observer = new MutationObserver((mutations) => {
      let mediaMutation = false;
      let mediaMutationMessageId = null;

      const relevant = mutations.some((mutation) => {
        if (isInsidePanel(mutation.target)) {
          DEBUG_STATE.panelMutationIgnoredCount += 1;
          return false;
        }

        const added = Array.from(mutation.addedNodes || []);
        const removed = Array.from(mutation.removedNodes || []);

        if (added.some(isInsidePanel) || removed.some(isInsidePanel)) {
          DEBUG_STATE.ignoredMutationCount += 1;
          DEBUG_STATE.panelMutationIgnoredCount += 1;
          return false;
        }

        if (mutation.type === "attributes" && isMediaRelatedNode(mutation.target)) {
          mediaMutation = true;
          DEBUG_STATE.mediaAttributeMutationCount += 1;
          DEBUG_STATE.lastMediaAttributeMutationAt = new Date().toISOString();
          DEBUG_STATE.lastMediaAttributeName = mutation.attributeName || null;
          const root = mutation.target.closest ? mutation.target.closest(USER_SELECTOR) : null;
          mediaMutationMessageId = root ? root.getAttribute("data-message-id") : null;
        }

        if (!mediaMutation) {
          added.concat(removed).forEach((node) => {
            if (mediaMutation || !node || node.nodeType !== 1) return;
            if (isMediaRelatedNode(node) || node.querySelector && node.querySelector("img,picture,canvas,button[aria-label]")) {
              mediaMutation = true;
              const root = node.closest ? node.closest(USER_SELECTOR) : null;
              mediaMutationMessageId = root ? root.getAttribute("data-message-id") : null;
            }
          });
        }

        return true;
      });

      if (!relevant) {
        debugLog("info", "mutation ignored: from floating panel");
        return;
      }

      DEBUG_STATE.mutationTriggerCount += mutations.length;
      DEBUG_STATE.lastMutationTime = new Date().toISOString();

      const now = Date.now();
      if (!DEBUG_STATE.lastMutationLogTime || now - DEBUG_STATE.lastMutationLogTime > MUTATION_LOG_INTERVAL_MS) {
        DEBUG_STATE.lastMutationLogTime = now;
        debugLog("info", "MutationObserver 触发", {
          mutationCount: mutations.length,
          totalMutationTriggerCount: DEBUG_STATE.mutationTriggerCount
        });
      }

      clearTimeout(state.mutationTimer);
      state.mutationTimer = setTimeout(() => {
        applyRouteAutoCollapse("mutation");
        scanAndMaybeRender(mediaMutation ? "media-attribute-mutation" : "mutation", false);
      }, MUTATION_DEBOUNCE_MS);

      if (mediaMutationMessageId) {
        scheduleMediaHydrationRescan(mediaMutationMessageId, "media-attribute-mutation");
      }
    });

    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "srcset", "alt", "aria-label", "class", "style"]
    });

    DEBUG_STATE.observerEnabled = true;
    DEBUG_STATE.observerEnabledAt = new Date().toISOString();
    DEBUG_STATE.observerConfig = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "srcset", "alt", "aria-label", "class", "style"]
    };
  }

  function setupUrlWatcher() {
    clearInterval(state.urlTimer);
    const checkUrlChange = (reason) => {
      if (location.href === state.lastUrl) return;

      const oldUrl = state.lastUrl;
      const oldConversationId = state.currentConversationId;
      const newConversationId = getConversationId();
      state.lastUrl = location.href;
      DEBUG_STATE.lastUrl = oldUrl;
      DEBUG_STATE.currentUrl = location.href;

      loadPreferencesForCurrentConversation();
      if (newConversationId !== oldConversationId) {
        handleConversationChange(newConversationId, oldConversationId, reason || "url-change");
      } else {
        updateStaticTexts();
        renderSettingsPanel();
        renderHelpPanel();
        applyThemeMode();
        scheduleAccentAutoResolve(reason || "url-change");
        applyRouteAutoCollapse(reason || "url-change");
        debugLog("info", "URL changed", { oldUrl, newUrl: location.href, conversationId: state.currentConversationId, reason });
        scanAndMaybeRender("url-change", true);
        scheduleDelayedInitScans();
      }
    };

    state.urlTimer = setInterval(() => checkUrlChange("url-timer"), 800);
    ["pushState", "replaceState"].forEach((name) => {
      const original = history[name];
      if (!original || original.__gpnWrapped) return;
      const wrapped = function () {
        const result = original.apply(this, arguments);
        setTimeout(() => checkUrlChange(name), 0);
        return result;
      };
      wrapped.__gpnWrapped = true;
      history[name] = wrapped;
    });
    window.addEventListener("popstate", () => setTimeout(() => checkUrlChange("popstate"), 0), true);
    return;
  }

  function setupCrossTabStorageGuard() {
    window.addEventListener("storage", (event) => {
      const key = event && event.key ? String(event.key) : "";
      if (!key || !key.startsWith(STORAGE_PREFIX + "-")) return;
      if (key.includes(":") && !key.endsWith(":" + state.currentConversationId) && !key.startsWith(getGlobalPreferencesStorageKey())) {
        DEBUG_STATE.crossTabStorageIgnoredCount += 1;
        DEBUG_STATE.crossTabDifferentConversationIgnored = true;
      }
    }, true);
  }

  function setupScrollSpy() {
    stopScrollSpy(false);

    if (!state.preferences.enableScrollSpy) {
      DEBUG_STATE.scrollSpyEnabled = false;
      DEBUG_STATE.scrollSpyObservedCount = 0;
      debugLog("info", "Scroll Spy 禁用");
      return;
    }

    const messages = state.userMessages.filter((message) => message.element);
    if (!messages.length) return;

    if ("IntersectionObserver" in window) {
      state.scrollSpyObserver = new IntersectionObserver((entries) => {
        if (Date.now() < state.scrollSpyPausedUntil) return;
        if (state.pendingScrollTargetMessageId) {
          DEBUG_STATE.navListAutoScrollSuppressed = true;
          return;
        }

        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => {
            const rect = entry.boundingClientRect;
            const center = rect.top + rect.height / 2;
            const distance = Math.abs(center - window.innerHeight / 2);
            return { entry, distance };
          })
          .sort((a, b) => a.distance - b.distance);

        if (!visible.length) return;
        const id = visible[0].entry.target.getAttribute("data-message-id");
        if (id) setScrollSpyActive(id);
      }, {
        root: null,
        rootMargin: "-35% 0px -35% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1]
      });

      messages.forEach((message) => state.scrollSpyObserver.observe(message.element));
      DEBUG_STATE.scrollSpyEnabled = true;
      DEBUG_STATE.scrollSpyObservedCount = messages.length;
      debugLog("info", "Scroll Spy 启用", { mode: "IntersectionObserver", observedCount: messages.length });
      return;
    }

    let ticking = false;
    state.scrollSpyScrollHandler = () => {
      if (Date.now() < state.scrollSpyPausedUntil) return;
      if (state.pendingScrollTargetMessageId) {
        DEBUG_STATE.navListAutoScrollSuppressed = true;
        return;
      }
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        updateScrollSpyByViewportCenter();
      });
    };
    window.addEventListener("scroll", state.scrollSpyScrollHandler, true);
    DEBUG_STATE.scrollSpyEnabled = true;
    DEBUG_STATE.scrollSpyObservedCount = messages.length;
    debugLog("info", "Scroll Spy 启用", { mode: "scroll-listener", observedCount: messages.length });
  }

  function stopScrollSpy(log) {
    if (state.scrollSpyObserver) {
      state.scrollSpyObserver.disconnect();
      state.scrollSpyObserver = null;
    }
    if (state.scrollSpyScrollHandler) {
      window.removeEventListener("scroll", state.scrollSpyScrollHandler, true);
      state.scrollSpyScrollHandler = null;
    }
    if (log) debugLog("info", "Scroll Spy 禁用");
  }

  function updateScrollSpyByViewportCenter() {
    if (Date.now() < state.scrollSpyPausedUntil) return;
    if (state.pendingScrollTargetMessageId) {
      DEBUG_STATE.navListAutoScrollSuppressed = true;
      return;
    }

    let best = null;
    state.userMessages.forEach((message) => {
      if (!message.element) return;
      const rect = message.element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const center = rect.top + rect.height / 2;
      const distance = Math.abs(center - window.innerHeight / 2);
      if (!best || distance < best.distance) best = { message, distance };
    });

    if (best) setScrollSpyActive(best.message.messageId);
  }

  function setScrollSpyActive(messageId) {
    if (Date.now() < state.scrollSpyPausedUntil) return;
    if (state.pendingScrollTargetMessageId) {
      DEBUG_STATE.navListAutoScrollSuppressed = true;
      return;
    }
    if (!messageId || state.activeMessageId === messageId) return;

    state.activeMessageId = messageId;
    DEBUG_STATE.activeMessageId = messageId;
    DEBUG_STATE.scrollSpyActiveMessageId = messageId;
    DEBUG_STATE.scrollSpyLastUpdateAt = new Date().toISOString();

    updateActiveItemClasses();

    DEBUG_STATE.navListAutoScrollSuppressed = true;
    DEBUG_STATE.navListAutoScrollReason = "scroll-spy";

    const now = Date.now();
    if (now - state.scrollSpyLastLogAt > 2000) {
      state.scrollSpyLastLogAt = now;
      debugLog("info", "Scroll Spy active message changed", { messageId });
    }
  }

  function isElementMostlyVisibleInContainer(element, container) {
    const er = element.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    return er.top >= cr.top && er.bottom <= cr.bottom;
  }

  function updateActiveItemClasses() {
    if (!state.navList) return;
    let foundActive = false;
    Array.from(state.navList.querySelectorAll(".gpn-item[data-message-id]")).forEach((item) => {
      const active = item.dataset.messageId === state.activeMessageId;
      if (active) foundActive = true;
      item.classList.toggle("gpn-active", active);
    });
    DEBUG_STATE.activeItemMissingNoFallback = !!state.activeMessageId && !foundActive;
    if (DEBUG_STATE.activeItemMissingNoFallback) DEBUG_STATE.preventedFallbackToFirstItem = true;
  }

  function createDebugReport() {
    const userNodes = Array.from(document.querySelectorAll(USER_SELECTOR));
    const assistantNodes = Array.from(document.querySelectorAll(ASSISTANT_SELECTOR));
    const bookmarksSummary = Object.values(state.bookmarks).slice(0, 10).map((bookmark) => ({
      messageId: bookmark.messageId,
      name: bookmark.name,
      preview: bookmark.messagePreview,
      createdAtRaw: bookmark.createdAtRaw
    }));

    const timeFolders =
      state.timeFolderMode === "week" ? buildWeekFolders(state.userMessages) :
      state.timeFolderMode === "day" ? buildDayFolders(state.userMessages) :
      buildMonthFolders(state.userMessages);

    const timeFolderSummary = timeFolders.folders.slice(0, 20).map((folder) => ({
      mode: timeFolders.folderMode,
      folderKey: folder.key,
      label: folder.label,
      count: folder.count,
      childCount: folder.children ? folder.children.length : 0,
      expanded: state.expandedTimeFolders[folder.key] === true
    }));

    return {
      DEBUG_STATE: { ...DEBUG_STATE, logs: DEBUG_STATE.logs.slice(-20) },
      currentUrl: location.href,
      selectorStats: {
        userSelector: USER_SELECTOR,
        assistantSelector: ASSISTANT_SELECTOR,
        userSelectorCount: userNodes.length,
        assistantSelectorCount: assistantNodes.length
      },
      preferencesSummary: { ...state.preferences },
      storageKeysSummary: getStorageKeysSummary(),
      tagsSummary: getTagsSummaryFromStore().slice(0, 20),
      scrollSpySummary: {
        enabled: DEBUG_STATE.scrollSpyEnabled,
        observedCount: DEBUG_STATE.scrollSpyObservedCount,
        activeMessageId: DEBUG_STATE.scrollSpyActiveMessageId,
        pausedUntil: DEBUG_STATE.scrollSpyPausedUntil,
        lastUpdateAt: DEBUG_STATE.scrollSpyLastUpdateAt
      },
      jumpHotfixSummary: {
        pendingScrollTargetMessageId: DEBUG_STATE.pendingScrollTargetMessageId,
        lastJumpCorrectionAt: DEBUG_STATE.lastJumpCorrectionAt,
        lastJumpCorrectionNeeded: DEBUG_STATE.lastJumpCorrectionNeeded,
        lastJumpCorrectionDistance: DEBUG_STATE.lastJumpCorrectionDistance,
        jumpCorrectionCount: DEBUG_STATE.jumpCorrectionCount,
        lastExpandedMessageId: DEBUG_STATE.lastExpandedMessageId,
        lastExpandedAction: DEBUG_STATE.lastExpandedAction,
        lastExpandWasLocalUpdate: DEBUG_STATE.lastExpandWasLocalUpdate,
        lastJumpZoneClickedMessageId: DEBUG_STATE.lastJumpZoneClickedMessageId,
        lastItemContainerClickRemoved: DEBUG_STATE.lastItemContainerClickRemoved,
        ignoreItemClickUntil: DEBUG_STATE.ignoreItemClickUntil,
        lastItemClickIgnored: DEBUG_STATE.lastItemClickIgnored,
        lastIgnoredItemClickReason: DEBUG_STATE.lastIgnoredItemClickReason
      },
      mediaHydrationSummary: {
        mediaHydrationRescanScheduledCount: DEBUG_STATE.mediaHydrationRescanScheduledCount,
        mediaHydrationRescanRunCount: DEBUG_STATE.mediaHydrationRescanRunCount,
        mediaAttributeMutationCount: DEBUG_STATE.mediaAttributeMutationCount,
        observedMediaImageCount: DEBUG_STATE.observedMediaImageCount,
        imageLoadTriggeredRescanCount: DEBUG_STATE.imageLoadTriggeredRescanCount,
        imageAcceptedByAriaOnlyCount: DEBUG_STATE.imageAcceptedByAriaOnlyCount,
        imagePendingSizeCount: DEBUG_STATE.imagePendingSizeCount,
        richContentSignatureChangedCount: DEBUG_STATE.richContentSignatureChangedCount,
        lastMediaHydrationChangedMessageId: DEBUG_STATE.lastMediaHydrationChangedMessageId,
        lastRichContentChangedMessageId: DEBUG_STATE.lastRichContentChangedMessageId
      },
      timeFuzzySearchSummary: {
        draft: DEBUG_STATE.timeSearchDraft,
        keyword: DEBUG_STATE.lastTimeFuzzySearchKeyword,
        normalized: DEBUG_STATE.lastTimeFuzzySearchNormalized,
        resultCount: DEBUG_STATE.timeFuzzySearchResultCount,
        firstMessageId: DEBUG_STATE.timeFuzzySearchFirstMessageId,
        active: DEBUG_STATE.timeFuzzySearchActive,
        executeTrigger: DEBUG_STATE.lastTimeSearchExecuteTrigger,
        usesTextSearch: false
      },
      timeFolderSearchSummary: {
        mode: "folder-filter",
        keyword: DEBUG_STATE.lastTimeFuzzySearchKeyword,
        folderCacheHit: DEBUG_STATE.timeSearchFolderCacheHit,
        matchedFolderCount: DEBUG_STATE.timeSearchMatchedFolderCount,
        matchedMessageCount: DEBUG_STATE.timeSearchMatchedMessageCount,
        noTimeCount: DEBUG_STATE.timeSearchNoTimeCount,
        autoJump: false,
        autoExpand: false,
        usesTextSearch: false,
        renderMode: DEBUG_STATE.timeSearchRenderMode,
        renderCostMs: DEBUG_STATE.timeSearchLastRenderCostMs
      },
      timeSearchBehaviorSummary: {
        mode: "folder-filter",
        realtime: true,
        autoJump: false,
        autoExpand: false,
        includeNoTimeMessages: true,
        keyword: DEBUG_STATE.lastTimeFuzzySearchKeyword,
        matchedTimedCount: DEBUG_STATE.timeSearchMatchedMessageCount,
        matchedFolderCount: DEBUG_STATE.timeSearchMatchedFolderCount,
        noTimeCount: DEBUG_STATE.timeSearchNoTimeCount,
        activeTimeFolderMode: state.timeFolderMode
      },
      themeSummary: {
        themeMode: DEBUG_STATE.themeMode,
        detectedChatGPTTheme: DEBUG_STATE.detectedChatGPTTheme,
        appliedPluginTheme: DEBUG_STATE.appliedPluginTheme,
        lastThemeUpdateAt: DEBUG_STATE.lastThemeUpdateAt,
        cssVarThemeApplied: DEBUG_STATE.cssVarThemeApplied,
        gpnBgResolved: DEBUG_STATE.gpnBgResolved,
        gpnSurfaceResolved: DEBUG_STATE.gpnSurfaceResolved,
        gpnTextResolved: DEBUG_STATE.gpnTextResolved,
        gpnBorderResolved: DEBUG_STATE.gpnBorderResolved,
        gpnAccentResolved: DEBUG_STATE.gpnAccentResolved,
        themeVarSourceElement: DEBUG_STATE.themeVarSourceElement,
        accentSource: DEBUG_STATE.accentSource,
        accentResolvedFromChatGPT: DEBUG_STATE.accentResolvedFromChatGPT
      },
      accentSummary: {
        accentSource: DEBUG_STATE.accentSource,
        accentResolvedFromChatGPT: DEBUG_STATE.accentResolvedFromChatGPT,
        accentResolvedFromRenderedUI: DEBUG_STATE.accentResolvedFromRenderedUI,
        gpnAccentResolved: DEBUG_STATE.gpnAccentResolved,
        accentSoftResolved: DEBUG_STATE.accentSoftResolved,
        accentStrongResolved: DEBUG_STATE.accentStrongResolved,
        accentSoftRaw: DEBUG_STATE.accentSoftRaw,
        accentStrongRaw: DEBUG_STATE.accentStrongRaw,
        accentStrongDerived: DEBUG_STATE.accentStrongDerived,
        accentTextOnAccent: DEBUG_STATE.accentTextOnAccent,
        accentRejectedReason: DEBUG_STATE.accentRejectedReason,
        accentFallbackPreventedBlack: DEBUG_STATE.accentFallbackPreventedBlack,
        accentColorValidationPassed: DEBUG_STATE.accentColorValidationPassed,
        accentComposerButtonFound: DEBUG_STATE.accentComposerButtonFound,
        accentComposerButtonSelector: DEBUG_STATE.accentComposerButtonSelector,
        accentComposerButtonBackground: DEBUG_STATE.accentComposerButtonBackground,
        accentComposerButtonRejectedReason: DEBUG_STATE.accentComposerButtonRejectedReason,
        accentAutoResolveScheduledAt: DEBUG_STATE.accentAutoResolveScheduledAt,
        accentAutoResolveReason: DEBUG_STATE.accentAutoResolveReason,
        accentAutoResolveAttemptCount: DEBUG_STATE.accentAutoResolveAttemptCount,
        accentAutoResolveLastAttemptAt: DEBUG_STATE.accentAutoResolveLastAttemptAt,
        accentAutoResolveSucceededAt: DEBUG_STATE.accentAutoResolveSucceededAt,
        accentAutoResolveSucceededWithoutSettings: DEBUG_STATE.accentAutoResolveSucceededWithoutSettings,
        accentSourcePriority: DEBUG_STATE.accentSourcePriority,
        accentAppliedToTabs: DEBUG_STATE.accentAppliedToTabs,
        accentAppliedToTimeModes: DEBUG_STATE.accentAppliedToTimeModes,
        accentAppliedToTagChips: DEBUG_STATE.accentAppliedToTagChips,
        accentAppliedToExpandButtons: DEBUG_STATE.accentAppliedToExpandButtons,
        accentAppliedToSearchFocus: DEBUG_STATE.accentAppliedToSearchFocus,
        cssLinkValue: DEBUG_STATE.cssLinkValue,
        cssSelectionValue: DEBUG_STATE.cssSelectionValue,
        accentAppliedToControls: DEBUG_STATE.accentAppliedToControls
      },
      registrySummary: {
        enabled: DEBUG_STATE.registryEnabled,
        storageKey: DEBUG_STATE.registryStorageKey,
        messageCount: DEBUG_STATE.registryMessageCount,
        visibleDomUserMessageCount: DEBUG_STATE.visibleDomUserMessageCount,
        inserted: DEBUG_STATE.registryInsertedCount,
        updated: DEBUG_STATE.registryUpdatedCount,
        retainedOffscreen: DEBUG_STATE.registryRetainedOffscreenCount,
        loadedFromStorage: DEBUG_STATE.registryLoadedFromStorageCount,
        savedCount: DEBUG_STATE.registrySavedCount,
        firstRegistryMessageId: DEBUG_STATE.firstRegistryMessageId,
        firstVisibleDomMessageId: DEBUG_STATE.firstVisibleDomMessageId,
        orderStable: DEBUG_STATE.registryOrderStable,
        cachedMessageClickMissingDomCount: DEBUG_STATE.cachedMessageClickMissingDomCount
      },
      backfillSummary: getBackfillProgressSnapshot(),
      hydrationAuditSummary: getBackfillProgressSnapshot().hydrationAuditSummary,
      conversationSwitchSummary: {
        switchCount: DEBUG_STATE.conversationSwitchCount,
        lastConversationId: DEBUG_STATE.lastConversationId,
        previousConversationId: DEBUG_STATE.previousConversationId,
        currentConversationId: DEBUG_STATE.currentConversationId,
        inProgress: DEBUG_STATE.conversationSwitchInProgress,
        stateResetAt: DEBUG_STATE.conversationScopedStateResetAt,
        staleScanSkippedCount: DEBUG_STATE.staleScanSkippedCount,
        registryClearedOnConversationChange: DEBUG_STATE.registryClearedOnConversationChange,
        renderedEmptyDuringConversationSwitch: DEBUG_STATE.renderedEmptyDuringConversationSwitch,
        registryStorageKeyAfterSwitch: DEBUG_STATE.registryStorageKeyAfterSwitch,
        loadedRegistryCountAfterSwitch: DEBUG_STATE.loadedRegistryCountAfterSwitch
      },
      conversationIsolationSummary: {
        tabInstanceId: DEBUG_STATE.tabInstanceId,
        rawConversationIdFromUrl: DEBUG_STATE.rawConversationIdFromUrl,
        conversationContextPrefix: DEBUG_STATE.conversationContextPrefix,
        normalizedConversationKey: DEBUG_STATE.normalizedConversationKey,
        conversationIdFallbackUsed: DEBUG_STATE.conversationIdFallbackUsed,
        getConversationIdSource: DEBUG_STATE.getConversationIdSource,
        currentConversationId: DEBUG_STATE.currentConversationId,
        previousConversationId: DEBUG_STATE.previousConversationId,
        conversationSwitchCount: DEBUG_STATE.conversationSwitchCount,
        conversationHardResetComplete: DEBUG_STATE.conversationHardResetComplete,
        registryRejectedWrongConversation: DEBUG_STATE.registryRejectedWrongConversation,
        registryRejectedWrongConversationCount: DEBUG_STATE.registryRejectedWrongConversationCount,
        registryLoadedConversationId: DEBUG_STATE.registryLoadedConversationId,
        registryExpectedConversationId: DEBUG_STATE.registryExpectedConversationId,
        crossTabStorageIgnoredCount: DEBUG_STATE.crossTabStorageIgnoredCount,
        staleScanSkippedCount: DEBUG_STATE.staleScanSkippedCount,
        staleMergeSkippedCount: DEBUG_STATE.staleMergeSkippedCount
      },
      lazyJumpSummary: {
        lazyJumpInProgress: DEBUG_STATE.lazyJumpInProgress,
        pendingLazyJumpMessageId: DEBUG_STATE.pendingLazyJumpMessageId,
        lazyJumpDirection: DEBUG_STATE.lazyJumpDirection,
        lazyJumpAttemptCount: DEBUG_STATE.lazyJumpAttemptCount,
        lazyJumpMaxAttempts: DEBUG_STATE.lazyJumpMaxAttempts,
        lazyJumpFinalAttemptCount: DEBUG_STATE.lazyJumpFinalAttemptCount,
        lazyJumpFoundTarget: DEBUG_STATE.lazyJumpFoundTarget,
        lazyJumpCancelled: DEBUG_STATE.lazyJumpCancelled,
        lazyJumpCancelReason: DEBUG_STATE.lazyJumpCancelReason,
        lazyJumpFailedReason: DEBUG_STATE.lazyJumpFailedReason,
        lazyJumpScrollContainerFound: DEBUG_STATE.lazyJumpScrollContainerFound,
        lazyJumpScrollContainerDescriptor: DEBUG_STATE.lazyJumpScrollContainerDescriptor,
        lazyJumpStoppedBeforeFullBackfill: DEBUG_STATE.lazyJumpStoppedBeforeFullBackfill,
        lazyJumpDidNotCallBackend: DEBUG_STATE.lazyJumpDidNotCallBackend,
        scrollToMissingTargetStartedLazyJump: DEBUG_STATE.scrollToMissingTargetStartedLazyJump,
        scrollToMissingTargetDidNotFallback: DEBUG_STATE.scrollToMissingTargetDidNotFallback
      },
      jumpDiagnosticsSummary: state.lastJumpDiagnostics,
      jumpReliabilitySummary: {
        jumpFailureCount: DEBUG_STATE.jumpFailureCount,
        lastJumpFailureReason: DEBUG_STATE.lastJumpFailureReason,
        lastJumpSuccessAt: DEBUG_STATE.lastJumpSuccessAt,
        lastJumpFailureAt: DEBUG_STATE.lastJumpFailureAt,
        scrollVerifiedAfterJump: DEBUG_STATE.scrollVerifiedAfterJump,
        scrollVerificationFailedReason: DEBUG_STATE.scrollVerificationFailedReason,
        targetVisibleAfterScroll: DEBUG_STATE.targetVisibleAfterScroll,
        scrollToMissingTargetDidNotFallback: DEBUG_STATE.scrollToMissingTargetDidNotFallback
      },
      draftSessionSummary: {
        conversationIdentity: DEBUG_STATE.conversationIdentity,
        isRealConversation: DEBUG_STATE.isRealConversation,
        isDraftConversation: DEBUG_STATE.isDraftConversation,
        draftConversationKey: DEBUG_STATE.draftConversationKey,
        realConversationKey: DEBUG_STATE.realConversationKey,
        draftRegistryKey: DEBUG_STATE.draftRegistryKey,
        draftCapturedTimesKey: DEBUG_STATE.draftCapturedTimesKey,
        draftRegistryMessageCount: DEBUG_STATE.draftRegistryMessageCount,
        draftCapturedTimeCount: DEBUG_STATE.draftCapturedTimeCount,
        draftMigrationRanAt: DEBUG_STATE.draftMigrationRanAt,
        draftMigrationFromKey: DEBUG_STATE.draftMigrationFromKey,
        draftMigrationToKey: DEBUG_STATE.draftMigrationToKey,
        draftMigrationMessageCount: DEBUG_STATE.draftMigrationMessageCount,
        draftMigrationCapturedTimeCount: DEBUG_STATE.draftMigrationCapturedTimeCount,
        draftMigrationSkippedReason: DEBUG_STATE.draftMigrationSkippedReason,
        draftMigrationSuccess: DEBUG_STATE.draftMigrationSuccess
      },
      routeAutoCollapseSummary: {
        routeAutoCollapsed: DEBUG_STATE.routeAutoCollapsed,
        routeAutoCollapseReason: DEBUG_STATE.routeAutoCollapseReason,
        beforeRouteAutoCollapseCollapsed: DEBUG_STATE.beforeRouteAutoCollapseCollapsed,
        beforeRouteAutoCollapseHidden: DEBUG_STATE.beforeRouteAutoCollapseHidden,
        autoCollapseMatchedSelector: DEBUG_STATE.autoCollapseMatchedSelector,
        autoCollapseCurrentHash: DEBUG_STATE.autoCollapseCurrentHash,
        autoCollapseCurrentPath: DEBUG_STATE.autoCollapseCurrentPath,
        autoCollapseManualOverride: DEBUG_STATE.autoCollapseManualOverride,
        autoCollapseRestoreAt: DEBUG_STATE.autoCollapseRestoreAt
      },
      highlightAccentSummary: {
        jumpHighlightUsesAccent: DEBUG_STATE.jumpHighlightUsesAccent,
        jumpHighlightAccentColor: DEBUG_STATE.jumpHighlightAccentColor,
        jumpHighlightAccentSoftColor: DEBUG_STATE.jumpHighlightAccentSoftColor,
        lastHighlightSource: DEBUG_STATE.lastHighlightSource,
        lastHighlightDidNotTouchNativeChatGPTHighlight: DEBUG_STATE.lastHighlightDidNotTouchNativeChatGPTHighlight
      },
      expandButtonAccentSummary: {
        expandButtonAccentApplied: DEBUG_STATE.expandButtonAccentApplied,
        expandButtonUsesResolvedAccent: DEBUG_STATE.expandButtonUsesResolvedAccent,
        accentStrongResolved: DEBUG_STATE.accentStrongResolved,
        accentSoftResolved: DEBUG_STATE.accentSoftResolved
      },
      timeStorageRepairSummary: {
        capturedTimeCurrentStorageKey: DEBUG_STATE.capturedTimeCurrentStorageKey,
        capturedTimeLegacyKeysChecked: DEBUG_STATE.capturedTimeLegacyKeysChecked,
        capturedTimeLegacyKeysFound: DEBUG_STATE.capturedTimeLegacyKeysFound,
        capturedTimeLegacyMatchedCount: DEBUG_STATE.capturedTimeLegacyMatchedCount,
        capturedTimeCurrentBeforeMergeCount: DEBUG_STATE.capturedTimeCurrentBeforeMergeCount,
        capturedTimeMergedFromLegacyCount: DEBUG_STATE.capturedTimeMergedFromLegacyCount,
        capturedTimeCurrentAfterMergeCount: DEBUG_STATE.capturedTimeCurrentAfterMergeCount,
        capturedTimeMigratedCount: DEBUG_STATE.capturedTimeMigratedCount,
        capturedTimeInvalidLegacyValueCount: DEBUG_STATE.capturedTimeInvalidLegacyValueCount,
        capturedTimeBackfilledFromRegistryCount: DEBUG_STATE.capturedTimeBackfilledFromRegistryCount,
        capturedTimeRegistryRecordsWithTimeCount: DEBUG_STATE.capturedTimeRegistryRecordsWithTimeCount,
        preservedExistingTimeOnMergeCount: DEBUG_STATE.preservedExistingTimeOnMergeCount,
        preventedNullTimeOverwriteCount: DEBUG_STATE.preventedNullTimeOverwriteCount,
        capturedAtRestoredDuringMergeCount: DEBUG_STATE.capturedAtRestoredDuringMergeCount,
        manualTimeRepairClickedAt: DEBUG_STATE.manualTimeRepairClickedAt,
        manualTimeRepairRestoredCount: DEBUG_STATE.manualTimeRepairRestoredCount,
        manualTimeRepairLegacyRecoveredCount: DEBUG_STATE.manualTimeRepairLegacyRecoveredCount,
        manualTimeRepairRegistryRecoveredCount: DEBUG_STATE.manualTimeRepairRegistryRecoveredCount,
        manualTimeRepairCurrentCountAfter: DEBUG_STATE.manualTimeRepairCurrentCountAfter,
        automaticTimeRepairRanAt: DEBUG_STATE.automaticTimeRepairRanAt,
        automaticTimeRepairRestoredCount: DEBUG_STATE.automaticTimeRepairRestoredCount,
        automaticTimeRepairDidNotScroll: DEBUG_STATE.automaticTimeRepairDidNotScroll,
        capturedTimeStoredCount: DEBUG_STATE.capturedTimeStoredCount,
        noTimeMessageCount: DEBUG_STATE.noTimeMessageCount,
        messagesWithCapturedTimeLabelCount: DEBUG_STATE.messagesWithCapturedTimeLabelCount,
        messagesWithRecordedDateTimeCount: DEBUG_STATE.messagesWithRecordedDateTimeCount
      },
      preferencesScopeSummary: {
        scope: DEBUG_STATE.preferencesScope,
        globalPreferencesStorageKey: DEBUG_STATE.globalPreferencesStorageKey,
        loadedGlobalPreferences: DEBUG_STATE.loadedGlobalPreferences,
        migratedPreferencesFromConversationKey: DEBUG_STATE.migratedPreferencesFromConversationKey,
        legacyConversationPreferencesKey: DEBUG_STATE.legacyConversationPreferencesKey,
        visibleTabsSource: DEBUG_STATE.visibleTabsSource,
        visibleTimeModesSource: DEBUG_STATE.visibleTimeModesSource,
        themeModeSource: DEBUG_STATE.themeModeSource,
        uiLanguageSource: DEBUG_STATE.uiLanguageSource
      },
      timeSearchStructuredSummary: {
        queryType: DEBUG_STATE.lastTimeSearchQueryType,
        parsedYear: DEBUG_STATE.lastTimeSearchParsedYear,
        parsedMonth: DEBUG_STATE.lastTimeSearchParsedMonth,
        parsedDay: DEBUG_STATE.lastTimeSearchParsedDay,
        viewMode: DEBUG_STATE.lastTimeSearchViewMode,
        valid: DEBUG_STATE.lastTimeSearchValid,
        invalidReason: DEBUG_STATE.lastTimeSearchInvalidReason,
        allowedQueryTypes: DEBUG_STATE.lastTimeSearchAllowedQueryTypes,
        disallowedByMode: DEBUG_STATE.lastTimeSearchDisallowedByMode,
        usedMessageText: DEBUG_STATE.lastTimeSearchUsedMessageText,
        modeSpecificParser: DEBUG_STATE.timeSearchModeSpecificParser,
        structuredMatch: DEBUG_STATE.lastTimeSearchStructuredMatch,
        usedBroadIncludes: DEBUG_STATE.lastTimeSearchUsedBroadIncludes,
        rejectedBroadTermCount: DEBUG_STATE.lastTimeSearchRejectedBroadTermCount,
        matchedFolderKeys: DEBUG_STATE.lastTimeSearchMatchedFolderKeys,
        matchedReasons: DEBUG_STATE.lastTimeSearchMatchedReasons
      },
      uiBackgroundSummary: {
        selectedItemBackground: "var(--gpn-selected-bg)",
        selectedItemBorder: "var(--gpn-selected-border)",
        listBackground: "transparent",
        settingsBackground: "var(--gpn-bg)",
        helpBackground: "var(--gpn-bg)",
        activeItemAccent: "left-line-only",
        activeItemAccentUsesResolvedAccent: DEBUG_STATE.activeItemAccentUsesResolvedAccent,
        jumpHighlightAccentUsesResolvedAccent: DEBUG_STATE.jumpHighlightAccentUsesResolvedAccent,
        headerBackgroundTransparent: DEBUG_STATE.headerBackgroundTransparent,
        timeViewContainerTransparent: DEBUG_STATE.timeViewContainerTransparent,
        tagViewContainerTransparent: DEBUG_STATE.tagViewContainerTransparent,
        topBarExtraBackgroundRemoved: DEBUG_STATE.topBarExtraBackgroundRemoved,
        lightAllViewContainerTransparent: DEBUG_STATE.lightAllViewContainerTransparent,
        lightAllViewItemBackgroundRemoved: DEBUG_STATE.lightAllViewItemBackgroundRemoved,
        lightAllViewUsesBorderOnlyCards: DEBUG_STATE.lightAllViewUsesBorderOnlyCards,
        lightAllViewActiveUsesBorderOnly: DEBUG_STATE.lightAllViewActiveUsesBorderOnly
      },
      panelPositionSummary: {
        left: DEBUG_STATE.panelLeft,
        top: DEBUG_STATE.panelTop,
        right: DEBUG_STATE.panelRight,
        bottom: DEBUG_STATE.panelBottom,
        positionMode: DEBUG_STATE.panelPositionMode,
        lastDragMode: DEBUG_STATE.lastDragMode,
        dragStartAt: DEBUG_STATE.dragStartAt,
        dragEndAt: DEBUG_STATE.dragEndAt,
        lastPositionResetAt: DEBUG_STATE.lastPositionResetAt,
        miniResizeEnabled: DEBUG_STATE.miniResizeEnabled,
        lastMiniResizeAt: DEBUG_STATE.lastMiniResizeAt,
        lastMiniResizeWidth: DEBUG_STATE.lastMiniResizeWidth,
        lastResizeHandleUsed: DEBUG_STATE.lastResizeHandleUsed
      },
      resizeSummary: {
        lastResizeHandleUsed: DEBUG_STATE.lastResizeHandleUsed,
        resizeHandlesEnabled: DEBUG_STATE.resizeHandlesEnabled,
        miniResizeEnabled: DEBUG_STATE.miniResizeEnabled,
        panelWidth: DEBUG_STATE.panelWidth,
        panelHeight: DEBUG_STATE.panelHeight,
        panelLeft: DEBUG_STATE.panelLeft,
        panelTop: DEBUG_STATE.panelTop
      },
      shortcutsSummary: {
        lastShortcut: DEBUG_STATE.lastShortcut,
        lastEnhancedShortcut: DEBUG_STATE.lastEnhancedShortcut,
        shortcutTargetMessageId: DEBUG_STATE.shortcutTargetMessageId,
        searchResultActiveIndex: DEBUG_STATE.searchResultActiveIndex
      },
      bookmarksSummary,
      timeFolderSummary,
      last8UserMessagePartsSummary: state.userMessages.slice(-8).map((message) => ({
        index: message.index,
        messageId: message.messageId,
        mainTextPreview: getSingleLinePreview(message.mainText, 80),
        mainTextSource: message.mainTextSource,
        hasQuote: message.hasQuote,
        quoteDetectSource: message.quoteDetectSource,
        quotedPreview: message.quotedPreview,
        hasImage: message.hasImage,
        imageCount: message.imageCount,
        imageDetectionConfidence: message.imageDetectionConfidence,
        imageAcceptedCount: message.imageAcceptedCount,
        imagePendingSizeCount: message.imagePendingSizeCount,
        hasAttachment: message.hasAttachment,
        attachmentNames: message.attachmentNames,
        richContentSignature: message.richContentSignature
      })),
      recentLogs: DEBUG_STATE.logs.slice(-20)
    };
  }

  function renderDebugPanel() {
    if (!state.debugPanel || !state.debugVisible) return;

    updateDebugSnapshot();
    const report = createDebugReport();

    state.debugPanel.innerHTML = "";

    const actions = document.createElement("div");
    actions.className = "gpn-debug-actions";

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "gpn-mini-btn";
    copy.textContent = t("debugCopy");
    copy.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      copyDebugInfo();
    });

    const print = document.createElement("button");
    print.type = "button";
    print.className = "gpn-mini-btn";
    print.textContent = t("debugPrintConsole");
    print.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      printDebugInfo();
    });

    const backfillStatus = state.backfill && state.backfill.status;
    const backfillRunning = backfillStatus === "running" || backfillStatus === "cancelling";
    const knownGapProbeRunning = state.backfill && state.backfill.knownGapProbeStatus === "running";
    const backfill = document.createElement("button");
    backfill.type = "button";
    backfill.className = "gpn-mini-btn";
    backfill.textContent = "Backfill Current Conversation";
    backfill.disabled = backfillRunning || knownGapProbeRunning;
    backfill.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      startCurrentConversationBackfill();
    });

    const cancelBackfill = document.createElement("button");
    cancelBackfill.type = "button";
    cancelBackfill.className = "gpn-mini-btn";
    cancelBackfill.textContent = "Cancel Backfill";
    cancelBackfill.disabled = backfillStatus !== "running";
    cancelBackfill.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      cancelCurrentConversationBackfill("user-cancel");
    });

    const knownGapProbe = document.createElement("button");
    knownGapProbe.type = "button";
    knownGapProbe.className = "gpn-mini-btn";
    knownGapProbe.textContent = "Probe Known Gap Top (Experimental)";
    knownGapProbe.disabled = backfillRunning || knownGapProbeRunning;
    knownGapProbe.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      startKnownGapTopHydrationProbe();
    });

    actions.appendChild(copy);
    actions.appendChild(print);
    actions.appendChild(backfill);
    actions.appendChild(cancelBackfill);
    actions.appendChild(knownGapProbe);

    const pre = document.createElement("pre");
    pre.className = "gpn-debug-pre";
    pre.textContent = JSON.stringify(report, null, 2);

    state.debugPanel.appendChild(actions);
    state.debugPanel.appendChild(pre);
  }

  function scheduleDebugPanelRefresh(force) {
    if (!state.debugVisible) return;
    if (force) {
      renderDebugPanel();
      return;
    }

    if (state.debugRenderTimer) return;
    state.debugRenderTimer = setTimeout(() => {
      state.debugRenderTimer = null;
      renderDebugPanel();
    }, DEBUG_PANEL_REFRESH_MS);
  }

  function copyDebugInfo() {
    const report = createDebugReport();
    copyText(JSON.stringify(report, null, 2)).then(() => {
      debugLog("info", "复制调试信息");
    }).catch((error) => {
      debugLog("error", "copy debug failed", { message: error.message });
    });
  }

  function printDebugInfo() {
    const report = createDebugReport();
    console.log("[GPT Prompt Navigator] Debug Report", report);
    debugLog("info", "打印调试信息到 Console");
  }

  function registerMenuCommands() {
    if (typeof GM_registerMenuCommand !== "function") return;

    GM_registerMenuCommand("GPT Navigator: Copy Debug Info", copyDebugInfo);
    GM_registerMenuCommand("GPT Navigator: Print Debug Info", printDebugInfo);
  }

  function injectStyles() {
    if (document.getElementById("gpn-style")) return;

    const style = document.createElement("style");
    style.id = "gpn-style";
    style.textContent = `
#gpt-prompt-navigator-panel {
  --gpn-bg: rgba(255, 255, 255, 0.98);
  --gpn-bg-secondary: rgba(247, 247, 248, 0.96);
  --gpn-bg-tertiary: rgba(236, 236, 241, 0.72);
  --gpn-text: #202123;
  --gpn-text-secondary: #5f6368;
  --gpn-text-tertiary: #8e8ea0;
  --gpn-border: rgba(0, 0, 0, 0.10);
  --gpn-border-medium: rgba(0, 0, 0, 0.16);
  --gpn-accent: #10a37f;
  --gpn-accent-soft: rgba(16, 163, 127, 0.14);
  --gpn-accent-strong: #10a37f;
  --gpn-accent-strong-soft: rgba(16, 163, 127, 0.22);
  --gpn-accent-text: #fff;
  --gpn-hover: rgba(0, 0, 0, 0.04);
  --gpn-selected-bg: rgba(0, 0, 0, 0.06);
  --gpn-selected-border: rgba(0, 0, 0, 0.14);
  --gpn-scrollbar-thumb: rgba(0, 0, 0, 0.18);
  --gpn-scrollbar-thumb-hover: rgba(0, 0, 0, 0.30);
  position: fixed;
  top: 88px;
  right: 16px;
  width: 300px;
  max-width: min(760px, 75vw);
  min-width: 260px;
  height: auto;
  min-height: 240px;
  max-height: 70vh;
  z-index: 2147483647;
  pointer-events: auto;
  resize: both;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

#gpt-prompt-navigator-panel * {
  box-sizing: border-box;
}

#gpt-prompt-navigator-panel.gpt-prompt-navigator-collapsed {
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  overflow: visible;
}

.gpt-prompt-navigator-collapsed .gpn-body,
.gpt-prompt-navigator-collapsed .gpn-footer,
.gpt-prompt-navigator-collapsed .gpn-debug-panel,
.gpt-prompt-navigator-collapsed .gpn-settings-panel,
.gpt-prompt-navigator-collapsed .gpn-help-panel,
.gpt-prompt-navigator-collapsed .gpn-resize-handle-top,
.gpt-prompt-navigator-collapsed .gpn-resize-handle-bottom,
.gpt-prompt-navigator-collapsed .gpn-resize-handle-both {
  display: none !important;
}

#gpt-prompt-navigator-panel.gpt-prompt-navigator-collapsed .gpn-resize-handle-left,
#gpt-prompt-navigator-panel.gpt-prompt-navigator-collapsed .gpn-resize-handle-right,
#gpt-prompt-navigator-panel.gpt-prompt-navigator-collapsed .gpn-mini-resize-handle-x {
  display: block;
  height: 100%;
}

.gpn-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 10px;
  border-bottom: 1px solid;
  flex: 0 0 auto;
  cursor: move;
  pointer-events: auto;
}

.gpn-header button,
.gpn-header input,
.gpn-header select {
  cursor: pointer;
  pointer-events: auto;
  position: relative;
  z-index: 25;
}

.gpn-title-wrap {
  min-width: 0;
}

.gpn-title {
  font-weight: 700;
  font-size: 14px;
  white-space: nowrap;
}

.gpn-count {
  font-size: 11px;
  line-height: 1.2;
}

.gpn-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.gpn-header-btn,
.gpn-mini-btn,
.gpn-copy-btn,
.gpn-icon-btn,
.gpn-tag-btn,
.gpn-expand-btn,
.gpn-tab,
.gpn-folder-header,
.gpn-folder-child-header,
.gpn-tag-filter,
.gpn-tag-chip {
  border: 1px solid;
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
}

.gpn-header-btn {
  padding: 3px 6px;
  font-size: 12px;
}

.gpn-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  padding: 8px;
  flex: 1 1 auto;
}

.gpn-settings-mode .gpn-tabs,
.gpn-settings-mode .gpn-search,
.gpn-settings-mode .gpn-list,
.gpn-settings-mode .gpn-debug-panel,
.gpn-settings-mode .gpn-help-panel,
.gpn-help-mode .gpn-tabs,
.gpn-help-mode .gpn-search,
.gpn-help-mode .gpn-list,
.gpn-help-mode .gpn-debug-panel,
.gpn-help-mode .gpn-settings-panel {
  display: none !important;
}

.gpn-settings-mode .gpn-settings-panel,
.gpn-help-mode .gpn-help-panel {
  display: block !important;
}

.gpn-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 4px;
  flex: 0 0 auto;
}

.gpn-tab {
  padding: 5px 4px;
  font-size: 12px;
}

.gpn-search,
.gpn-date-search,
.gpn-pref-select,
.gpn-pref-number {
  width: 100%;
  border: 1px solid;
  border-radius: 6px;
  padding: 7px 8px;
  outline: none;
  font: inherit;
}

.gpn-search {
  flex: 0 0 auto;
}

.gpn-search:focus,
.gpn-date-search:focus,
.gpn-pref-select:focus,
.gpn-pref-number:focus {
  border-color: var(--gpn-accent-strong);
  box-shadow: 0 0 0 2px var(--gpn-accent-soft);
}

.gpn-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
}

.gpn-view-container,
.gpn-all-view,
.gpn-bookmark-view,
.gpn-time-view,
.gpn-tag-view,
.gpn-time-folder-list,
.gpn-tag-message-list,
.gpn-scroll-area,
.gpn-settings-panel,
.gpn-help-panel {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
}

.gpn-view-container,
.gpn-time-view,
.gpn-tag-view {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gpn-settings-panel,
.gpn-help-panel {
  display: none;
  padding: 10px;
  border-bottom: 1px solid;
  font-size: 12px;
}

.gpn-item {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  gap: 7px;
  align-items: start;
  padding: 8px;
  border: 1px solid;
  border-radius: 8px;
  cursor: default;
}

.gpn-index {
  min-width: 22px;
  font-size: 12px;
  text-align: right;
  line-height: 1.45;
}

.gpn-icons {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 18px;
  align-items: center;
}

.gpn-icon-badge {
  min-height: 16px;
  font-size: 12px;
  line-height: 1.2;
}

.gpn-content {
  min-width: 0;
}

.gpn-jump-zone {
  cursor: pointer;
  border-radius: 8px;
}

.gpn-jump-zone:focus-visible {
  outline: 1px solid var(--gpn-accent-strong);
  outline-offset: 2px;
}

.gpn-time-row {
  margin-bottom: 2px;
  font-size: 12px;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gpn-bookmark-name {
  margin-bottom: 2px;
  font-weight: 700;
  font-size: 12px;
  line-height: 1.35;
  word-break: break-word;
}

.gpn-text {
  white-space: pre-wrap;
  word-break: break-word;
  overflow: hidden;
  max-height: 4.4em;
  line-height: 1.45;
}

.gpn-text.gpn-text-expanded {
  max-height: none;
  overflow: visible;
}

.gpn-meta {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.35;
  white-space: pre-wrap;
  word-break: break-word;
}

.gpn-tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 5px;
}

.gpn-tag-chip {
  padding: 1px 5px;
  font-size: 12px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gpn-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}

.gpn-copy-btn,
.gpn-tag-btn {
  padding: 2px 5px;
  font-size: 12px;
  white-space: nowrap;
}

.gpn-icon-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}

.gpn-expand-btn {
  margin-top: 4px;
  padding: 1px 5px;
  font-size: 12px;
  cursor: pointer;
}

.gpn-empty,
.gpn-inline-notice {
  padding: 12px 8px;
  text-align: center;
}

.gpn-pref-title {
  font-weight: 700;
  margin-bottom: 6px;
  font-size: 14px;
}

.gpn-pref-group-title {
  margin: 10px 0 6px;
  font-weight: 700;
  font-size: 12px;
}

.gpn-help-section {
  margin-bottom: 12px;
}

.gpn-help-line {
  margin: 4px 0;
}

.gpn-theme-status {
  margin: 4px 0 8px;
  font-size: 12px;
}

.gpn-pref-row {
  display: grid;
  grid-template-columns: 1fr minmax(96px, 132px);
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.gpn-pref-check {
  display: flex;
  gap: 7px;
}

.gpn-pref-number,
.gpn-pref-select {
  padding: 4px 6px;
}

.gpn-pref-actions {
  display: flex;
  gap: 6px;
  margin: 8px 0;
  flex-wrap: wrap;
}

.gpn-storage-info {
  margin-top: 8px;
  padding: 7px;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}

.gpn-debug {
  flex: 0 0 auto;
  max-height: 42vh;
  overflow: auto;
  border-top: 1px solid;
  padding-top: 8px;
}

.gpn-debug-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.gpn-debug-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 11px;
}

.gpn-footer {
  flex: 0 0 auto;
  padding: 7px 10px;
  border-top: 1px solid;
  font-size: 11px;
}

.gpn-time-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 7px;
  border: 1px solid;
  border-radius: 8px;
  flex: 0 0 auto;
}

.gpn-time-mode,
.gpn-date-search-wrap {
  display: flex;
  gap: 4px;
}

.gpn-mini-btn {
  padding: 4px 7px;
  font-size: 12px;
  white-space: nowrap;
}

.gpn-folder,
.gpn-tag-group {
  border: 1px solid;
  border-radius: 8px;
  overflow: hidden;
}

.gpn-folder-header,
.gpn-folder-child-header,
.gpn-tag-group-title {
  width: 100%;
  padding: 7px 8px;
  text-align: left;
  border: 0;
  border-radius: 0;
}

.gpn-tag-group-title {
  font-weight: 700;
}

.gpn-folder-child-header {
  padding-left: 14px;
}

.gpn-folder-hint,
.gpn-time-search-summary {
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.35;
}

.gpn-folder-body,
.gpn-folder-child-body,
.gpn-tag-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
}

.gpn-tag-filter-bar {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  padding: 6px;
  border-radius: 8px;
  border: 1px solid;
  flex: 0 0 auto;
}

.gpn-tag-filter {
  padding: 3px 7px;
  font-size: 12px;
}

.gpn-resize-handle-left,
.gpn-resize-handle-right {
  position: absolute;
  top: 0;
  width: 8px;
  height: 100%;
  cursor: ew-resize;
  z-index: 20;
}

.gpn-resize-handle-left {
  left: 0;
}

.gpn-resize-handle-right {
  right: 0;
}

.gpn-resize-handle-top,
.gpn-resize-handle-bottom {
  position: absolute;
  left: 0;
  width: 100%;
  height: 8px;
  cursor: ns-resize;
  z-index: 19;
}

.gpn-resize-handle-top {
  top: 0;
}

.gpn-resize-handle-bottom {
  bottom: 0;
}

.gpn-resize-handle-both {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 32px;
  height: 32px;
  cursor: nwse-resize;
  z-index: 21;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 2px 5px;
  font-size: 18px;
  line-height: 1;
  user-select: none;
}

.gpn-resize-handle-both:hover,
.gpn-resize-handle-left:hover,
.gpn-resize-handle-right:hover,
.gpn-resize-handle-top:hover,
.gpn-resize-handle-bottom:hover,
.gpn-resize-handle-x:hover,
.gpn-resize-handle-y:hover {
  background: var(--gpn-accent-soft);
}

.gpn-mini-resize-handle-x {
  position: absolute;
  top: 0;
  right: 0;
  width: 10px;
  height: 100%;
  display: none;
  align-items: center;
  justify-content: center;
  cursor: ew-resize;
  opacity: 0.35;
  user-select: none;
  z-index: 4;
}

.gpn-mini-resize-handle-x:hover {
  background: var(--gpn-accent-soft);
  opacity: 0.75;
}

.gpn-toast {
  position: fixed;
  right: 18px;
  bottom: 24px;
  z-index: 2147483001;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.92);
  color: #fff;
  font: 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  pointer-events: none;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
}

#gpt-prompt-navigator-panel.gpn-theme-light {
  color: #1f2937;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(17, 24, 39, 0.14);
  box-shadow: 0 14px 38px rgba(0, 0, 0, 0.18);
}

.gpn-theme-light .gpn-header,
.gpn-theme-light .gpn-footer,
.gpn-theme-light .gpn-debug,
.gpn-theme-light .gpn-settings-panel,
.gpn-theme-light .gpn-help-panel {
  border-color: rgba(17, 24, 39, 0.1);
}

.gpn-theme-light .gpn-header-btn,
.gpn-theme-light .gpn-mini-btn,
.gpn-theme-light .gpn-copy-btn,
.gpn-theme-light .gpn-icon-btn,
.gpn-theme-light .gpn-tag-btn,
.gpn-theme-light .gpn-expand-btn,
.gpn-theme-light .gpn-tab,
.gpn-theme-light .gpn-folder-header,
.gpn-theme-light .gpn-folder-child-header,
.gpn-theme-light .gpn-tag-filter,
.gpn-theme-light .gpn-tag-chip {
  background: rgba(249, 250, 251, 0.92);
  color: #1f2937;
  border-color: rgba(17, 24, 39, 0.14);
}

.gpn-theme-light .gpn-tab.gpn-active,
.gpn-theme-light .gpn-mini-btn.gpn-active,
.gpn-theme-light .gpn-tag-filter.gpn-active {
  background: var(--gpn-accent-strong);
  color: var(--gpn-accent-text);
  border-color: var(--gpn-accent-strong);
}

.gpn-theme-light .gpn-search,
.gpn-theme-light .gpn-date-search,
.gpn-theme-light .gpn-pref-select,
.gpn-theme-light .gpn-pref-number {
  background: rgba(255, 255, 255, 0.95);
  color: #1f2937;
  border-color: rgba(17, 24, 39, 0.16);
}

.gpn-theme-light .gpn-item,
.gpn-theme-light .gpn-time-controls,
.gpn-theme-light .gpn-folder,
.gpn-theme-light .gpn-tag-group,
.gpn-theme-light .gpn-tag-filter-bar {
  background: rgba(249, 250, 251, 0.84);
  border-color: rgba(17, 24, 39, 0.1);
}

.gpn-theme-light .gpn-item:hover {
  background: var(--gpn-hover);
  border-color: var(--gpn-accent-strong-soft);
}

.gpn-theme-light .gpn-item.gpn-active {
  border-color: var(--gpn-accent-strong);
  box-shadow: 0 0 0 2px var(--gpn-accent-strong-soft);
}

.gpn-theme-light .gpn-index,
.gpn-theme-light .gpn-meta,
.gpn-theme-light .gpn-footer,
.gpn-theme-light .gpn-count,
.gpn-theme-light .gpn-empty,
.gpn-theme-light .gpn-inline-notice,
.gpn-theme-light .gpn-folder-hint,
.gpn-theme-light .gpn-time-search-summary,
.gpn-theme-light .gpn-time-row,
.gpn-theme-light .gpn-theme-status {
  color: #6b7280;
}

.gpn-theme-light .gpn-bookmark-name,
.gpn-theme-light .gpn-pref-title {
  color: #111827;
}

.gpn-theme-light .gpn-icon-btn {
  color: #b45309;
}

.gpn-theme-light .gpn-expand-btn,
.gpn-theme-light .gpn-tag-chip,
.gpn-theme-light .gpn-tag-group-title {
  color: #047857;
}

.gpn-theme-light .gpn-debug-pre {
  color: #374151;
}

.gpn-theme-light .gpn-folder-header,
.gpn-theme-light .gpn-tag-group-title {
  background: rgba(243, 244, 246, 0.9);
}

.gpn-theme-light .gpn-folder-child-header {
  background: rgba(249, 250, 251, 0.86);
  color: #4b5563;
}

.gpn-theme-light .gpn-settings-panel,
.gpn-theme-light .gpn-help-panel {
  color: #4b5563;
  background: var(--gpn-bg);
}

.gpn-theme-light .gpn-storage-info {
  background: rgba(255,255,255,0.62);
  color: #4b5563;
}

#gpt-prompt-navigator-panel.gpn-theme-dark {
  color: #f4f4f5;
  background: rgba(32, 33, 35, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 14px 38px rgba(0, 0, 0, 0.42);
}

.gpn-theme-dark .gpn-header,
.gpn-theme-dark .gpn-footer,
.gpn-theme-dark .gpn-debug,
.gpn-theme-dark .gpn-settings-panel,
.gpn-theme-dark .gpn-help-panel {
  border-color: rgba(255, 255, 255, 0.12);
}

.gpn-theme-dark .gpn-header-btn,
.gpn-theme-dark .gpn-mini-btn,
.gpn-theme-dark .gpn-copy-btn,
.gpn-theme-dark .gpn-icon-btn,
.gpn-theme-dark .gpn-tag-btn,
.gpn-theme-dark .gpn-expand-btn,
.gpn-theme-dark .gpn-tab,
.gpn-theme-dark .gpn-folder-header,
.gpn-theme-dark .gpn-folder-child-header,
.gpn-theme-dark .gpn-tag-filter,
.gpn-theme-dark .gpn-tag-chip {
  background: rgba(64, 65, 79, 0.82);
  color: #f4f4f5;
  border-color: rgba(255, 255, 255, 0.14);
}

.gpn-theme-dark .gpn-tab.gpn-active,
.gpn-theme-dark .gpn-mini-btn.gpn-active,
.gpn-theme-dark .gpn-tag-filter.gpn-active {
  background: var(--gpn-accent-strong);
  color: var(--gpn-accent-text);
  border-color: var(--gpn-accent-strong);
}

.gpn-theme-dark .gpn-search,
.gpn-theme-dark .gpn-date-search,
.gpn-theme-dark .gpn-pref-select,
.gpn-theme-dark .gpn-pref-number {
  color: #f4f4f5;
  background: rgba(52, 53, 65, 0.96);
  border-color: rgba(255, 255, 255, 0.14);
}

.gpn-theme-dark .gpn-item,
.gpn-theme-dark .gpn-time-controls,
.gpn-theme-dark .gpn-folder,
.gpn-theme-dark .gpn-tag-group,
.gpn-theme-dark .gpn-tag-filter-bar {
  background: rgba(52, 53, 65, 0.76);
  border-color: rgba(255, 255, 255, 0.12);
}

.gpn-theme-dark .gpn-item:hover {
  background: var(--gpn-hover);
}

.gpn-theme-dark .gpn-item.gpn-active {
  border-color: var(--gpn-accent-strong);
  box-shadow: 0 0 0 2px var(--gpn-accent-strong-soft);
}

.gpn-theme-dark .gpn-index,
.gpn-theme-dark .gpn-meta,
.gpn-theme-dark .gpn-footer,
.gpn-theme-dark .gpn-count,
.gpn-theme-dark .gpn-empty,
.gpn-theme-dark .gpn-inline-notice,
.gpn-theme-dark .gpn-folder-hint,
.gpn-theme-dark .gpn-time-search-summary,
.gpn-theme-dark .gpn-time-row,
.gpn-theme-dark .gpn-theme-status {
  color: #c4c4cc;
}

.gpn-theme-dark .gpn-bookmark-name,
.gpn-theme-dark .gpn-pref-title {
  color: #ffffff;
}

.gpn-theme-dark .gpn-icon-btn {
  color: #fbbf24;
}

.gpn-theme-dark .gpn-expand-btn,
.gpn-theme-dark .gpn-tag-chip,
.gpn-theme-dark .gpn-tag-group-title {
  color: #6ee7b7;
}

.gpn-theme-dark .gpn-debug-pre {
  color: #e5e7eb;
}

.gpn-theme-dark .gpn-folder-header,
.gpn-theme-dark .gpn-tag-group-title {
  background: rgba(64, 65, 79, 0.9);
}

.gpn-theme-dark .gpn-folder-child-header {
  background: rgba(52, 53, 65, 0.9);
  color: #d4d4d8;
}

.gpn-theme-dark .gpn-settings-panel,
.gpn-theme-dark .gpn-help-panel {
  color: #d4d4d8;
  background: var(--gpn-bg);
}

.gpn-theme-dark .gpn-storage-info {
  background: rgba(52, 53, 65, 0.72);
  color: #d4d4d8;
}

#gpt-prompt-navigator-panel.gpn-panel {
  color: var(--gpn-text);
  background: var(--gpn-bg);
  border: 1px solid var(--gpn-border);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.22);
}

.gpn-header,
.gpn-footer,
.gpn-debug,
.gpn-settings-panel,
.gpn-help-panel {
  border-color: var(--gpn-border);
}

.gpn-header,
.gpn-footer {
  background: var(--gpn-bg);
}

.gpn-header-btn,
.gpn-mini-btn,
.gpn-copy-btn,
.gpn-icon-btn,
.gpn-tag-btn,
.gpn-expand-btn,
.gpn-tab,
.gpn-folder-header,
.gpn-folder-child-header,
.gpn-tag-filter,
.gpn-tag-chip {
  color: var(--gpn-text);
  background: var(--gpn-bg-secondary);
  border-color: var(--gpn-border);
}

.gpn-header-btn:hover,
.gpn-mini-btn:hover,
.gpn-copy-btn:hover,
.gpn-icon-btn:hover,
.gpn-tag-btn:hover,
.gpn-expand-btn:hover,
.gpn-tab:hover,
.gpn-folder-header:hover,
.gpn-folder-child-header:hover,
.gpn-tag-filter:hover {
  background: var(--gpn-hover);
  border-color: var(--gpn-border-medium);
}

.gpn-tab.gpn-active,
.gpn-mini-btn.gpn-active,
.gpn-tag-filter.gpn-active {
  color: var(--gpn-accent-text);
  background: var(--gpn-accent-strong);
  border-color: var(--gpn-accent-strong);
}

.gpn-search,
.gpn-date-search,
.gpn-pref-select,
.gpn-pref-number {
  color: var(--gpn-text);
  background: var(--gpn-bg);
  border-color: var(--gpn-border);
}

.gpn-search:focus,
.gpn-date-search:focus,
.gpn-pref-select:focus,
.gpn-pref-number:focus {
  border-color: var(--gpn-accent);
  box-shadow: 0 0 0 2px var(--gpn-accent-soft);
}

.gpn-item,
.gpn-time-controls,
.gpn-folder,
.gpn-tag-group,
.gpn-tag-filter-bar {
  color: var(--gpn-text);
  background: var(--gpn-bg-secondary);
  border-color: var(--gpn-border);
}

.gpn-item:hover {
  background: var(--gpn-hover);
  border-color: var(--gpn-border-medium);
}

.gpn-item.gpn-active {
  border-color: var(--gpn-accent);
  box-shadow: 0 0 0 2px var(--gpn-accent-soft);
}

.gpn-index,
.gpn-meta,
.gpn-footer,
.gpn-count,
.gpn-empty,
.gpn-inline-notice,
.gpn-folder-hint,
.gpn-time-search-summary,
.gpn-time-row,
.gpn-theme-status,
.gpn-help-line {
  color: var(--gpn-text-secondary);
}

.gpn-bookmark-name,
.gpn-pref-title,
.gpn-pref-group-title,
.gpn-title {
  color: var(--gpn-text);
}

.gpn-icon-btn {
  color: var(--gpn-text-tertiary);
}

.gpn-expand-btn,
.gpn-tag-chip,
.gpn-tag-group-title {
  color: var(--gpn-accent);
}

.gpn-folder-header,
.gpn-tag-group-title,
.gpn-storage-info {
  background: var(--gpn-bg-tertiary);
}

.gpn-folder-child-header {
  color: var(--gpn-text-secondary);
  background: var(--gpn-bg-secondary);
}

.gpn-settings-panel,
.gpn-help-panel {
  color: var(--gpn-text-secondary);
  background: var(--gpn-bg-secondary);
}

.gpn-debug {
  background: var(--gpn-bg-secondary);
}

.gpn-debug-pre {
  color: var(--gpn-text-secondary);
}

.gpn-storage-info {
  color: var(--gpn-text-secondary);
  border: 1px solid var(--gpn-border);
}

.gpn-list,
.gpn-scroll-area,
.gpn-debug,
.gpn-settings-panel,
.gpn-help-panel,
.gpn-time-folder-list,
.gpn-view-container {
  scrollbar-width: thin;
  scrollbar-color: var(--gpn-scrollbar-thumb) transparent;
}

.gpn-list::-webkit-scrollbar,
.gpn-scroll-area::-webkit-scrollbar,
.gpn-debug::-webkit-scrollbar,
.gpn-settings-panel::-webkit-scrollbar,
.gpn-help-panel::-webkit-scrollbar,
.gpn-time-folder-list::-webkit-scrollbar,
.gpn-view-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.gpn-list::-webkit-scrollbar-track,
.gpn-scroll-area::-webkit-scrollbar-track,
.gpn-debug::-webkit-scrollbar-track,
.gpn-settings-panel::-webkit-scrollbar-track,
.gpn-help-panel::-webkit-scrollbar-track,
.gpn-time-folder-list::-webkit-scrollbar-track,
.gpn-view-container::-webkit-scrollbar-track {
  background: transparent;
}

.gpn-list::-webkit-scrollbar-thumb,
.gpn-scroll-area::-webkit-scrollbar-thumb,
.gpn-debug::-webkit-scrollbar-thumb,
.gpn-settings-panel::-webkit-scrollbar-thumb,
.gpn-help-panel::-webkit-scrollbar-thumb,
.gpn-time-folder-list::-webkit-scrollbar-thumb,
.gpn-view-container::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--gpn-scrollbar-thumb);
}

.gpn-list::-webkit-scrollbar-thumb:hover,
.gpn-scroll-area::-webkit-scrollbar-thumb:hover,
.gpn-debug::-webkit-scrollbar-thumb:hover,
.gpn-settings-panel::-webkit-scrollbar-thumb:hover,
.gpn-help-panel::-webkit-scrollbar-thumb:hover,
.gpn-time-folder-list::-webkit-scrollbar-thumb:hover,
.gpn-view-container::-webkit-scrollbar-thumb:hover {
  background: var(--gpn-scrollbar-thumb-hover);
}

#gpt-prompt-navigator-panel.gpt-prompt-navigator-collapsed .gpn-header {
  padding-right: 18px;
}

#gpt-prompt-navigator-panel.gpt-prompt-navigator-collapsed .gpn-header-actions {
  gap: 5px;
  padding-right: 4px;
}

#gpt-prompt-navigator-panel.gpt-prompt-navigator-collapsed .gpn-header-btn {
  min-width: 26px;
  min-height: 24px;
}

#gpt-prompt-navigator-panel.gpt-prompt-navigator-collapsed .gpn-mini-resize-handle-x {
  width: 8px;
}

#gpt-prompt-navigator-panel .gpn-list,
#gpt-prompt-navigator-panel .gpn-view-container,
#gpt-prompt-navigator-panel .gpn-all-view,
#gpt-prompt-navigator-panel .gpn-bookmark-view,
#gpt-prompt-navigator-panel .gpn-time-view,
#gpt-prompt-navigator-panel .gpn-tag-view,
#gpt-prompt-navigator-panel .gpn-time-folder-list,
#gpt-prompt-navigator-panel .gpn-content {
  background: transparent;
}

#gpt-prompt-navigator-panel.gpn-theme-dark .gpn-item {
  background: rgba(255, 255, 255, 0.03);
}

#gpt-prompt-navigator-panel.gpn-theme-light .gpn-item {
  background: rgba(0, 0, 0, 0.015);
  border-color: var(--gpn-border);
}

#gpt-prompt-navigator-panel.gpn-theme-light .gpn-body,
#gpt-prompt-navigator-panel.gpn-theme-light .gpn-content,
#gpt-prompt-navigator-panel.gpn-theme-light .gpn-view-container,
#gpt-prompt-navigator-panel.gpn-theme-light .gpn-list,
#gpt-prompt-navigator-panel.gpn-theme-light .gpn-nav-list,
#gpt-prompt-navigator-panel.gpn-theme-light .gpn-all-view,
#gpt-prompt-navigator-panel.gpn-theme-light .gpn-message-list,
#gpt-prompt-navigator-panel.gpn-theme-light .gpn-list-container,
#gpt-prompt-navigator-panel.gpn-theme-light .gpn-folder-children {
  background: transparent;
}

#gpt-prompt-navigator-panel.gpn-theme-light .gpn-item:hover {
  background: transparent;
}

#gpt-prompt-navigator-panel.gpn-theme-dark .gpn-item:hover {
  background: var(--gpn-hover);
}

#gpt-prompt-navigator-panel .gpn-item.gpn-active {
  background: var(--gpn-selected-bg);
  border-color: var(--gpn-selected-border);
  box-shadow: inset 3px 0 0 var(--gpn-accent-strong);
}

#gpt-prompt-navigator-panel .gpn-settings-panel,
#gpt-prompt-navigator-panel .gpn-help-panel,
#gpt-prompt-navigator-panel .gpn-settings-view,
#gpt-prompt-navigator-panel .gpn-help-view,
#gpt-prompt-navigator-panel .gpn-dedicated-view {
  background: var(--gpn-bg);
}

#gpt-prompt-navigator-panel .gpn-tag-chip {
  border-color: color-mix(in srgb, var(--gpn-accent-strong) 35%, var(--gpn-border));
}

#gpt-prompt-navigator-panel input[type="checkbox"] {
  accent-color: var(--gpn-accent-strong);
}

/* 0.4.7 focused UI overrides */
#gpt-prompt-navigator-panel .gpn-header,
#gpt-prompt-navigator-panel .gpn-body,
#gpt-prompt-navigator-panel .gpn-tabs,
#gpt-prompt-navigator-panel .gpn-list,
#gpt-prompt-navigator-panel .gpn-view-container,
#gpt-prompt-navigator-panel .gpn-all-view,
#gpt-prompt-navigator-panel .gpn-bookmark-view,
#gpt-prompt-navigator-panel .gpn-time-view,
#gpt-prompt-navigator-panel .gpn-time-folder-list,
#gpt-prompt-navigator-panel .gpn-tag-view,
#gpt-prompt-navigator-panel .gpn-debug-panel {
  background: transparent;
}

#gpt-prompt-navigator-panel .gpn-time-controls,
#gpt-prompt-navigator-panel .gpn-tag-filter-bar {
  background: transparent;
  border-color: var(--gpn-border);
}

#gpt-prompt-navigator-panel .gpn-folder,
#gpt-prompt-navigator-panel .gpn-tag-group {
  background: transparent;
  border-color: var(--gpn-border);
}

#gpt-prompt-navigator-panel .gpn-folder-header,
#gpt-prompt-navigator-panel .gpn-folder-child-header,
#gpt-prompt-navigator-panel .gpn-tag-group-title {
  background: transparent;
}

#gpt-prompt-navigator-panel .gpn-tag-group-title {
  color: var(--gpn-accent-strong);
  border-left: 3px solid var(--gpn-accent-strong);
}

#gpt-prompt-navigator-panel .gpn-tab.gpn-active,
#gpt-prompt-navigator-panel .gpn-mini-btn.gpn-active,
#gpt-prompt-navigator-panel .gpn-tag-filter.gpn-active {
  background: var(--gpn-accent-strong);
  color: var(--gpn-accent-text);
  border-color: var(--gpn-accent-strong);
  box-shadow: 0 0 0 2px var(--gpn-accent-strong-soft);
}

#gpt-prompt-navigator-panel .gpn-tab:hover,
#gpt-prompt-navigator-panel .gpn-mini-btn:hover,
#gpt-prompt-navigator-panel .gpn-copy-btn:hover,
#gpt-prompt-navigator-panel .gpn-tag-btn:hover,
#gpt-prompt-navigator-panel .gpn-icon-btn:hover,
#gpt-prompt-navigator-panel .gpn-tag-filter:hover,
#gpt-prompt-navigator-panel .gpn-tab:focus-visible,
#gpt-prompt-navigator-panel .gpn-mini-btn:focus-visible,
#gpt-prompt-navigator-panel .gpn-tag-filter:focus-visible {
  border-color: var(--gpn-accent-strong);
  box-shadow: 0 0 0 2px var(--gpn-accent-strong-soft);
}

#gpt-prompt-navigator-panel .gpn-tag-chip {
  color: var(--gpn-accent-strong);
  background: var(--gpn-accent-soft);
  border-color: var(--gpn-accent-strong);
}

#gpt-prompt-navigator-panel .gpn-search:focus,
#gpt-prompt-navigator-panel .gpn-date-search:focus,
#gpt-prompt-navigator-panel .gpn-pref-select:focus,
#gpt-prompt-navigator-panel .gpn-pref-number:focus {
  border-color: var(--gpn-accent-strong);
  box-shadow: 0 0 0 2px var(--gpn-accent-strong-soft);
}

#gpt-prompt-navigator-panel.gpn-theme-dark .gpn-item {
  background: rgba(255, 255, 255, 0.03);
}

#gpt-prompt-navigator-panel.gpn-theme-light .gpn-item {
  background: transparent;
}

#gpt-prompt-navigator-panel .gpn-item.gpn-active {
  background: var(--gpn-selected-bg);
  border-color: var(--gpn-selected-border);
  box-shadow: inset 3px 0 0 var(--gpn-accent-strong);
}

#gpt-prompt-navigator-panel .gpn-settings-panel,
#gpt-prompt-navigator-panel .gpn-help-panel {
  background: var(--gpn-bg);
}

#gpt-prompt-navigator-panel .gpn-item .gpn-expand-btn,
#gpt-prompt-navigator-panel .gpn-expand-btn[data-action="expand"],
#gpt-prompt-navigator-panel button[data-action="expand"] {
  color: var(--gpn-accent-strong);
  background: transparent;
  border-color: var(--gpn-accent-strong-soft);
}

#gpt-prompt-navigator-panel .gpn-item .gpn-expand-btn:hover,
#gpt-prompt-navigator-panel .gpn-expand-btn[data-action="expand"]:hover,
#gpt-prompt-navigator-panel button[data-action="expand"]:hover {
  color: var(--gpn-accent-strong);
  background: var(--gpn-accent-soft);
  border-color: var(--gpn-accent-strong);
}

#gpt-prompt-navigator-panel .gpn-item .gpn-expand-btn:focus-visible,
#gpt-prompt-navigator-panel .gpn-expand-btn[data-action="expand"]:focus-visible,
#gpt-prompt-navigator-panel button[data-action="expand"]:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--gpn-accent-strong-soft);
}

#gpt-prompt-navigator-panel .gpn-item .gpn-expand-btn:active,
#gpt-prompt-navigator-panel .gpn-expand-btn[data-action="expand"]:active,
#gpt-prompt-navigator-panel button[data-action="expand"]:active {
  background: var(--gpn-accent-strong-soft);
}

#gpt-prompt-navigator-panel.gpn-theme-light .gpn-body,
#gpt-prompt-navigator-panel.gpn-theme-light .gpn-content,
#gpt-prompt-navigator-panel.gpn-theme-light .gpn-list,
#gpt-prompt-navigator-panel.gpn-theme-light .gpn-nav-list,
#gpt-prompt-navigator-panel.gpn-theme-light .gpn-view-container,
#gpt-prompt-navigator-panel.gpn-theme-light .gpn-all-view,
#gpt-prompt-navigator-panel.gpn-theme-light .gpn-message-list,
#gpt-prompt-navigator-panel.gpn-theme-light .gpn-list-container {
  background: transparent;
}

#gpt-prompt-navigator-panel.gpn-theme-light .gpn-all-view .gpn-item {
  background: transparent;
  border: 1px solid var(--gpn-border);
  box-shadow: none;
}

#gpt-prompt-navigator-panel.gpn-theme-light .gpn-all-view .gpn-item:hover {
  background: transparent;
  border-color: var(--gpn-accent-strong-soft);
  box-shadow: 0 0 0 1px var(--gpn-accent-strong-soft);
}

#gpt-prompt-navigator-panel.gpn-theme-light .gpn-all-view .gpn-item.gpn-active {
  background: transparent;
  border-color: var(--gpn-accent-strong);
  border-left: 2px solid var(--gpn-accent-strong);
  box-shadow: none;
}

#gpt-prompt-navigator-panel.gpn-theme-light .gpn-all-view .gpn-jump-zone,
#gpt-prompt-navigator-panel.gpn-theme-light .gpn-content .gpn-jump-zone {
  background: transparent;
}
`;
    document.head.appendChild(style);
  }

  function init() {
    safeRun("init failed", () => {
      injectStyles();
      state.tabInstanceId = getTabInstanceId();
      DEBUG_STATE.tabInstanceId = state.tabInstanceId;
      state.currentConversationId = getConversationId();
      state.lastConversationIdentity = DEBUG_STATE.conversationIdentity;
      DEBUG_STATE.currentConversationId = state.currentConversationId;
      updateDraftStorageDebug();
      loadPreferencesForCurrentConversation();
      loadCapturedTimesForCurrentConversation();
      loadBookmarksForCurrentConversation();
      loadTagsForCurrentConversation();
      loadViewStateForCurrentConversation();
      loadMessageRegistryForCurrentConversation();
      createPanel();
      setupThemeWatcher();
      observeComposerAccentButton();
      setupMutationObserver();
      setupUrlWatcher();
      setupCrossTabStorageGuard();
      setupKeyboardShortcuts();
      setupSendActionListeners();
      registerMenuCommands();

      scanAndMaybeRender("init", true);
      scheduleAccentAutoResolve("init");
      scheduleDelayedInitScans();

      debugLog("info", "脚本初始化完成", {
        scriptVersion: SCRIPT_VERSION,
        conversationId: state.currentConversationId
      });
    });
  }

  init();
})();
