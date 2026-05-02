# Reading Live Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a Live Activity on the iOS lock screen and Dynamic Island while a reading session is active, displaying book title, author, auto-ticking elapsed reading time, and current page.

**Architecture:** A custom Expo native module (`ReadingLiveActivityModule.swift`) bridges JS ↔ ActivityKit. A separate Widget Extension target (`ReadingWidget`) holds the SwiftUI lock screen and Dynamic Island views. The `startDate` trick stores an adjusted date in ContentState so SwiftUI's `.timer` text style auto-ticks elapsed time correctly — including across pauses — without JS pushing updates every second.

**Tech Stack:** Expo SDK 54, expo-modules-core (already a transitive dep), ActivityKit (iOS 16.2+), SwiftUI WidgetKit, TypeScript

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `app.json` | Modify | Add `NSSupportsLiveActivities` to Info.plist |
| `ios/ChapterChat/ReadingSessionAttributes.swift` | Create | ActivityKit struct — app target copy |
| `ios/ChapterChat/ReadingLiveActivityModule.swift` | Create | Expo native module (start/update/end) |
| `ios/ReadingWidget/ReadingSessionAttributes.swift` | Create | Same struct — widget target copy (can't share) |
| `ios/ReadingWidget/ReadingWidgetLiveActivity.swift` | Create | SwiftUI lock screen + Dynamic Island views |
| `ios/ReadingWidget/ReadingWidgetBundle.swift` | Create | Widget extension entry point |
| `lib/liveActivity.ts` | Create | TypeScript wrapper with platform guards |
| `app/session/[bookId].tsx` | Modify | Start/update/end activity around session lifecycle |

---

### Task 1: Install expo-dev-client, enable Live Activities, prebuild

Live Activities require a dev build — they cannot run in Expo Go.

**Files:** `app.json`, `package.json`

- [ ] **Step 1: Install expo-dev-client**

```bash
npx expo install expo-dev-client
```

- [ ] **Step 2: Add NSSupportsLiveActivities to app.json**

Replace the `ios.infoPlist` block:
```json
"infoPlist": {
  "NSPhotoLibraryUsageDescription": "Choose a profile photo from your library.",
  "ITSAppUsesNonExemptEncryption": false,
  "NSSupportsLiveActivities": true
}
```

- [ ] **Step 3: Run prebuild to generate the native iOS directory**

```bash
npx expo prebuild --platform ios --clean
```

Expected: `ios/` directory is created containing `ChapterChat.xcworkspace` and the `ChapterChat` app target folder.

- [ ] **Step 4: Commit**

```bash
git add app.json package.json package-lock.json ios/
git commit -m "feat: add expo-dev-client, prebuild ios, enable NSSupportsLiveActivities"
```

---

### Task 2: Define ActivityAttributes struct — app target

**Files:**
- Create: `ios/ChapterChat/ReadingSessionAttributes.swift`

- [ ] **Step 1: Create `ios/ChapterChat/ReadingSessionAttributes.swift`**

```swift
import ActivityKit
import Foundation

struct ReadingSessionAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// Adjusted so that `Date.now - startDate == elapsed reading seconds`.
        /// Updated on pause/resume to freeze or re-anchor the displayed timer.
        var startDate: Date
        var currentPage: Int
        var startPage: Int
        var isPaused: Bool
    }

    var bookTitle: String
    var author: String
}
```

- [ ] **Step 2: Add file to the Xcode app target**

Open `ios/ChapterChat.xcworkspace` in Xcode.
In the Project Navigator, right-click the `ChapterChat` group → **Add Files to "ChapterChat"…**
Select `ReadingSessionAttributes.swift`. In the target dialog: ✅ `ChapterChat` only.

- [ ] **Step 3: Build to confirm it compiles (⌘B). Fix any errors before continuing.**

- [ ] **Step 4: Commit**

```bash
git add ios/ChapterChat/ReadingSessionAttributes.swift
git commit -m "feat: add ReadingSessionAttributes ActivityKit struct (app target)"
```

---

### Task 3: Create the Expo native module

**Files:**
- Create: `ios/ChapterChat/ReadingLiveActivityModule.swift`

- [ ] **Step 1: Create `ios/ChapterChat/ReadingLiveActivityModule.swift`**

```swift
import ExpoModulesCore
import ActivityKit
import Foundation

public class ReadingLiveActivityModule: Module {
    private var currentActivity: Activity<ReadingSessionAttributes>?

    public func definition() -> ModuleDefinition {
        Name("ReadingLiveActivity")

        // Returns the activity ID string on success, nil if unavailable.
        AsyncFunction("startActivity") { (bookTitle: String, author: String, startPage: Int, promise: Promise) in
            guard #available(iOS 16.2, *) else { promise.resolve(nil); return }
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { promise.resolve(nil); return }

            let attributes = ReadingSessionAttributes(bookTitle: bookTitle, author: author)
            let state = ReadingSessionAttributes.ContentState(
                startDate: Date(),
                currentPage: startPage,
                startPage: startPage,
                isPaused: false
            )
            do {
                let activity = try Activity<ReadingSessionAttributes>.request(
                    attributes: attributes,
                    contentState: state,
                    pushType: nil
                )
                self.currentActivity = activity
                promise.resolve(activity.id)
            } catch {
                promise.reject("LIVE_ACTIVITY_START_FAILED", error.localizedDescription)
            }
        }

        // elapsedSeconds: total elapsed reading time in seconds (pauses excluded).
        // The module computes an adjusted startDate so SwiftUI's .timer style shows this value.
        AsyncFunction("updateActivity") { (elapsedSeconds: Int, currentPage: Int, isPaused: Bool, promise: Promise) in
            guard #available(iOS 16.2, *) else { promise.resolve(); return }
            guard let activity = self.currentActivity else { promise.resolve(); return }

            let adjustedStart = Date(timeIntervalSinceNow: -Double(elapsedSeconds))
            let newState = ReadingSessionAttributes.ContentState(
                startDate: adjustedStart,
                currentPage: currentPage,
                startPage: activity.contentState.startPage,
                isPaused: isPaused
            )
            Task {
                await activity.update(using: newState)
                promise.resolve()
            }
        }

        AsyncFunction("endActivity") { (promise: Promise) in
            guard #available(iOS 16.2, *) else { promise.resolve(); return }
            guard let activity = self.currentActivity else { promise.resolve(); return }
            Task {
                await activity.end(dismissalPolicy: .immediate)
                self.currentActivity = nil
                promise.resolve()
            }
        }
    }
}
```

- [ ] **Step 2: Add file to the Xcode app target**

In Xcode: right-click `ChapterChat` group → **Add Files to "ChapterChat"…**
Select `ReadingLiveActivityModule.swift`. Target: ✅ `ChapterChat` only.

- [ ] **Step 3: Build (⌘B). Fix any errors before continuing.**

- [ ] **Step 4: Commit**

```bash
git add ios/ChapterChat/ReadingLiveActivityModule.swift
git commit -m "feat: add ReadingLiveActivity Expo native module"
```

---

### Task 4: Add Widget Extension target in Xcode

Widget Extensions run in their own process — they must be a separate Xcode target.

- [ ] **Step 1: Add Widget Extension target**

In Xcode → **File → New → Target…**
Choose **Widget Extension** → Next.
- Product Name: `ReadingWidget`
- Bundle Identifier: `com.isabellenelson.chapterchat.ReadingWidget`
- ✅ **Include Live Activity** — check this box
- Language: Swift
Click Finish. When prompted "Activate scheme?" → click **Activate**.

- [ ] **Step 2: Set minimum deployment target**

Select the `ReadingWidget` target → **General** tab → Minimum Deployments → **iOS 16.2**.

- [ ] **Step 3: Commit**

```bash
git add ios/ReadingWidget/
git commit -m "feat: add ReadingWidget Widget Extension target with Live Activity"
```

---

### Task 5: ActivityAttributes struct — widget target copy

Widget Extensions are separate binaries and cannot import from the app target. The struct must be duplicated.

**Files:**
- Create: `ios/ReadingWidget/ReadingSessionAttributes.swift`

- [ ] **Step 1: Create `ios/ReadingWidget/ReadingSessionAttributes.swift`**

```swift
import ActivityKit
import Foundation

// Must be identical to ios/ChapterChat/ReadingSessionAttributes.swift
struct ReadingSessionAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var startDate: Date
        var currentPage: Int
        var startPage: Int
        var isPaused: Bool
    }

    var bookTitle: String
    var author: String
}
```

- [ ] **Step 2: Confirm target membership in Xcode file inspector**

Select the file in Project Navigator → right panel → Target Membership: ✅ `ReadingWidget` only (NOT `ChapterChat`).

---

### Task 6: Build SwiftUI Live Activity views

Replace the Xcode-generated boilerplate with the actual lock screen and Dynamic Island views.

**Files:**
- Modify: `ios/ReadingWidget/ReadingWidgetLiveActivity.swift` (the file Xcode generated)
- Modify: `ios/ReadingWidget/ReadingWidgetBundle.swift`

- [ ] **Step 1: Replace ReadingWidgetLiveActivity.swift entirely**

```swift
import ActivityKit
import SwiftUI
import WidgetKit

// MARK: - Lock screen / StandBy view

struct ReadingLockScreenView: View {
    let context: ActivityViewContext<ReadingSessionAttributes>

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "book.fill")
                .font(.title2)
                .foregroundStyle(.purple)

            VStack(alignment: .leading, spacing: 2) {
                Text(context.attributes.bookTitle)
                    .font(.system(.subheadline, weight: .semibold))
                    .lineLimit(1)
                Text(context.attributes.author)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(context.state.startDate, style: .timer)
                    .font(.system(.title3, design: .monospaced, weight: .semibold))
                    .foregroundStyle(.purple)
                    .monospacedDigit()
                    // .timer auto-ticks when isPaused is false.
                    // When isPaused is true, startDate is frozen at the elapsed time
                    // so the displayed value is correct but stops ticking.
                Text("p.\(context.state.currentPage)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
    }
}

// MARK: - Widget configuration

struct ReadingWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ReadingSessionAttributes.self) { context in
            ReadingLockScreenView(context: context)
                .activityBackgroundTint(Color(.systemBackground))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "book.fill")
                        .foregroundStyle(.purple)
                        .font(.title3)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.startDate, style: .timer)
                        .font(.system(.callout, design: .monospaced, weight: .semibold))
                        .foregroundStyle(.purple)
                        .monospacedDigit()
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(context.attributes.bookTitle)
                            .font(.subheadline)
                            .lineLimit(1)
                        Spacer()
                        Text("p.\(context.state.currentPage)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                Image(systemName: "book.fill")
                    .foregroundStyle(.purple)
                    .font(.caption)
            } compactTrailing: {
                Text(context.state.startDate, style: .timer)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.purple)
                    .monospacedDigit()
                    .frame(width: 44)
            } minimal: {
                Image(systemName: "book.fill")
                    .foregroundStyle(.purple)
            }
        }
    }
}
```

- [ ] **Step 2: Replace ReadingWidgetBundle.swift**

```swift
import WidgetKit
import SwiftUI

@main
struct ReadingWidgetBundle: WidgetBundle {
    var body: some Widget {
        ReadingWidgetLiveActivity()
    }
}
```

- [ ] **Step 3: Build both targets (⌘B). Fix any SwiftUI errors before continuing.**

- [ ] **Step 4: Commit**

```bash
git add ios/ReadingWidget/
git commit -m "feat: add ReadingWidget SwiftUI live activity and Dynamic Island views"
```

---

### Task 7: TypeScript wrapper

**Files:**
- Create: `lib/liveActivity.ts`

- [ ] **Step 1: Create `lib/liveActivity.ts`**

```typescript
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

// Returns null gracefully if the native module isn't present (Expo Go, Android, older iOS).
const NativeLiveActivity = requireOptionalNativeModule('ReadingLiveActivity');

/** Start a Live Activity for the current reading session.
 *  Returns the activity ID, or null if Live Activities are unavailable. */
export async function startReadingActivity(params: {
  bookTitle: string;
  author: string;
  startPage: number;
}): Promise<string | null> {
  if (Platform.OS !== 'ios' || !NativeLiveActivity) return null;
  try {
    return await NativeLiveActivity.startActivity(
      params.bookTitle,
      params.author,
      params.startPage,
    );
  } catch {
    return null;
  }
}

/** Update the Live Activity.
 *  elapsedSeconds: total elapsed reading seconds, pauses excluded.
 *  The native module adjusts startDate so the lock screen timer shows this value. */
export async function updateReadingActivity(params: {
  elapsedSeconds: number;
  currentPage: number;
  isPaused: boolean;
}): Promise<void> {
  if (Platform.OS !== 'ios' || !NativeLiveActivity) return;
  try {
    await NativeLiveActivity.updateActivity(
      params.elapsedSeconds,
      params.currentPage,
      params.isPaused,
    );
  } catch {}
}

/** End and immediately dismiss the Live Activity. */
export async function endReadingActivity(): Promise<void> {
  if (Platform.OS !== 'ios' || !NativeLiveActivity) return;
  try {
    await NativeLiveActivity.endActivity();
  } catch {}
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/liveActivity.ts
git commit -m "feat: add liveActivity TypeScript wrapper"
```

---

### Task 8: Integrate with session screen

**Files:**
- Modify: `app/session/[bookId].tsx`

Integration points:
- `startTimer()` → start Live Activity
- `pauseTimer()` → update with `isPaused: true`
- `resumeTimer()` → update with `isPaused: false`
- `saveSession()` success path → end Live Activity
- Component unmount (back without saving) → end Live Activity

- [ ] **Step 1: Add import**

At the top of `app/session/[bookId].tsx`, after the existing imports:
```typescript
import { startReadingActivity, updateReadingActivity, endReadingActivity } from '@/lib/liveActivity';
```

- [ ] **Step 2: Replace `startTimer`**

```typescript
const startTimer = () => {
  accumulatedRef.current = 0;
  runStartRef.current = Date.now();
  startedAtRef.current = new Date();
  setPhase('running');
  if (intervalRef.current) clearInterval(intervalRef.current);
  intervalRef.current = setInterval(tick, 1000);
  if (userBook) {
    startReadingActivity({
      bookTitle: userBook.book.title,
      author: userBook.book.author,
      startPage: parseInt(startPage, 10) || userBook.current_page,
    });
  }
};
```

- [ ] **Step 3: Replace `pauseTimer`**

```typescript
const pauseTimer = () => {
  if (intervalRef.current) clearInterval(intervalRef.current);
  if (runStartRef.current !== null) {
    accumulatedRef.current += Math.floor((Date.now() - runStartRef.current) / 1000);
    runStartRef.current = null;
  }
  setSeconds(accumulatedRef.current);
  setPhase('paused');
  updateReadingActivity({
    elapsedSeconds: accumulatedRef.current,
    currentPage: parseInt(startPage, 10) || (userBook?.current_page ?? 0),
    isPaused: true,
  });
};
```

- [ ] **Step 4: Replace `resumeTimer`**

```typescript
const resumeTimer = () => {
  runStartRef.current = Date.now();
  setPhase('running');
  if (intervalRef.current) clearInterval(intervalRef.current);
  intervalRef.current = setInterval(tick, 1000);
  updateReadingActivity({
    elapsedSeconds: accumulatedRef.current,
    currentPage: parseInt(startPage, 10) || (userBook?.current_page ?? 0),
    isPaused: false,
  });
};
```

- [ ] **Step 5: Add cleanup effect to end the activity if user navigates away**

Add after the existing cleanup `useEffect`:
```typescript
useEffect(() => {
  return () => { endReadingActivity(); };
}, []);
```

- [ ] **Step 6: End activity after session saves successfully**

Inside `saveSession()`, immediately after the `successOpacity.value = withSequence(...)` call:
```typescript
endReadingActivity();
```

- [ ] **Step 7: Commit**

```bash
git add app/session/[bookId].tsx
git commit -m "feat: integrate Live Activity with reading session lifecycle"
```

---

### Task 9: Build dev client and test on physical device

Live Activities do not work in Simulator — a physical iPhone is required.

- [ ] **Step 1: Build and run on device**

```bash
npx expo run:ios --device
```

If using EAS:
```bash
eas build --platform ios --profile development
# Install the resulting .ipa via EAS or Xcode Devices window
```

- [ ] **Step 2: Test the full flow on device**

1. Open a book on the Reading shelf → tap **Start Reading Session**
2. Enter a start page → tap **Start Reading**
3. **Lock the screen** — the Live Activity appears: book title, author, ticking elapsed timer, current page
4. On an iPhone 14 Pro or later — check the **Dynamic Island**: compact view shows 📖 + timer
5. Tap **Pause** — lock screen timer freezes at the correct elapsed time
6. Tap **Resume** — timer resumes counting from where it paused
7. Tap **Finish** → enter end page → tap **Save Session** — Live Activity dismisses

- [ ] **Step 3: Verify it degrades gracefully on unsupported devices**

On an iPhone running iOS < 16.2 or in Expo Go: the session screen works normally, no crash, no Live Activity.
