# Live Activity (Lock Screen) Design

## Goal

Show a Live Activity on the iOS lock screen while a reading session is active, displaying book title, author, auto-ticking elapsed reading time, and current page. The feature degrades silently on Android, Expo Go, and iOS < 16.2.

## Architecture

TypeScript (session screen) → `lib/liveActivity.ts` → `requireOptionalNativeModule('ReadingLiveActivity')` → `ReadingLiveActivityModule.swift` (ExpoModulesCore, in `modules/reading-live-activity/ios/`) → ActivityKit → `ReadingWidgetExtension` (lock screen SwiftUI view).

## Tech Stack

Expo SDK 54, expo-modules-core, ActivityKit (iOS 16.2+), SwiftUI WidgetKit, TypeScript.

---

## Module Registration

The local Expo module at `modules/reading-live-activity/` is already listed in `package.json` as `"reading-live-activity": "file:./modules/reading-live-activity"` but has no `.podspec`, so CocoaPods never picks it up and the module never appears in `ExpoModulesProvider.swift`.

**Fix:**
- Add `modules/reading-live-activity/reading-live-activity.podspec`
- Add `pod 'reading-live-activity', path: '../modules/reading-live-activity'` to `ios/Podfile`
- Remove the fragile post-install text-patching hook from `ios/Podfile`
- Delete `ios/ChapterChat/ReadingLiveActivityBridge.m` (ObjC RCT bridge — conflicts with Expo module)
- Run `pod install`

After this, `ExpoModulesProvider.swift` will list `ReadingLiveActivityModule` automatically via Expo autolinking.

---

## Widget (Lock Screen View)

File: `ios/ReadingWidget/ReadingWidgetLiveActivity.swift`

Replace the current implementation (which has both lock screen and Dynamic Island) with a lock screen-only version using `ActivityConfiguration(for:content:)` — no `dynamicIsland:` parameter.

**Layout:**
```
┌─────────────────────────────────────────────┐
│  📖  The Name of the Wind     12:34    p.47 │
│      Patrick Rothfuss         Paused        │
└─────────────────────────────────────────────┘
```

- Left: `book.fill` SF Symbol (purple)
- Center: `bookTitle` (semibold, 1 line) + `author` (caption, secondary, 1 line)
- Right top: elapsed timer — when `isPaused == false`, `Text(startDate, style: .timer)` auto-ticks; when `isPaused == true`, show static `Text` of formatted elapsed seconds
- Right bottom: `"p.\(currentPage)"` when running; `"Paused"` when paused

`startDate` is always stored as `Date.now - elapsedSeconds` so the `.timer` style displays the correct accumulated reading time. The native module recomputes this on every `updateActivity` call.

**`ContentState`** (unchanged from existing):
```swift
struct ContentState: Codable, Hashable {
    var startDate: Date      // Date.now - elapsed reading seconds
    var currentPage: Int
    var startPage: Int
    var isPaused: Bool
}
```

**`ActivityAttributes`** (unchanged):
```swift
struct ReadingSessionAttributes: ActivityAttributes {
    var bookTitle: String
    var author: String
}
```

Both `ios/ReadingWidget/ReadingSessionAttributes.swift` and `modules/reading-live-activity/ios/ReadingSessionAttributes.swift` must remain identical (widget extensions cannot import from the app target).

---

## TypeScript API

File: `lib/liveActivity.ts`

```typescript
startReadingActivity(bookTitle: string, author: string, startPage: number): Promise<void>
updateReadingActivity(elapsedSeconds: number, currentPage: number, isPaused: boolean): Promise<void>
endReadingActivity(): Promise<void>
```

All three functions:
- Return silently (no-op) on `Platform.OS !== 'ios'`
- Return silently if `NativeLiveActivity` module is null (Expo Go, iOS < 16.2)
- Catch and swallow all errors so the session screen never crashes due to Live Activity failures

---

## Session Screen Integration

File: `app/session/[bookId].tsx`

Four integration points — all fire-and-forget (no `await`, no error handling in the caller):

| Event | Call |
|---|---|
| User taps Start (inside `startTimer`) | `startReadingActivity(title, author, startPage)` |
| User taps Pause (inside `pauseTimer`) | `updateReadingActivity(accumulated, currentPage, true)` |
| User taps Resume (inside `resumeTimer`) | `updateReadingActivity(accumulated, currentPage, false)` |
| Session saved successfully | `endReadingActivity()` |
| Component unmounts (back without saving) | `endReadingActivity()` in cleanup `useEffect` |

`currentPage` passed to update calls is `parseInt(endPage, 10) || userBook.current_page` — the end page field the user is filling in during the session, falling back to their stored current page.

---

## Error Handling

- If `Activity.request()` throws (e.g. activities disabled in Settings), the module calls `promise.reject(...)` — caught and swallowed in `lib/liveActivity.ts`
- If the session screen unmounts before `endActivity` completes, ActivityKit will eventually expire the activity on its own (default 8-hour timeout)
- No UI feedback for Live Activity failures — the session screen is unaffected

---

## What Is Removed / Cleaned Up

- `ios/ChapterChat/ReadingLiveActivityBridge.m` — deleted (conflicting ObjC RCT bridge)
- `ios/ReadingLiveActivityModule.swift` (root-level) — removed from Xcode project references and deleted; the canonical source is `modules/reading-live-activity/ios/ReadingLiveActivityModule.swift`
- `ios/ReadingSessionAttributes.swift` (root-level) — same, canonical source is `modules/reading-live-activity/ios/ReadingSessionAttributes.swift`
- Podfile post-install text-patching hook — removed once podspec registration takes over

## What Is Not Changing

- `ios/ChapterChat/Info.plist` — `NSSupportsLiveActivities = true` already present ✓
- `ios/ReadingWidget/ReadingWidgetBundle.swift` — already correct ✓
- `ios/ReadingWidget/ReadingSessionAttributes.swift` — widget copy of the struct, stays as-is ✓
- `modules/reading-live-activity/ios/ReadingLiveActivityModule.swift` — already correct ✓
- `modules/reading-live-activity/ios/ReadingSessionAttributes.swift` — already correct ✓
