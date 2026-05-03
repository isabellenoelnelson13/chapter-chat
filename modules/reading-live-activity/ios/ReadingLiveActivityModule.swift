import ExpoModulesCore
import ActivityKit
import Foundation

public class ReadingLiveActivityModule: Module {
    // Stored as Any? so the class itself has no iOS 16.2 availability requirement.
    // Cast back to Activity<ReadingSessionAttributes> inside each #available guard.
    private var currentActivityBox: Any?

    public func definition() -> ModuleDefinition {
        Name("ReadingLiveActivity")

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
                self.currentActivityBox = activity
                promise.resolve(activity.id)
            } catch {
                promise.reject("LIVE_ACTIVITY_START_FAILED", error.localizedDescription)
            }
        }

        AsyncFunction("updateActivity") { (elapsedSeconds: Int, currentPage: Int, isPaused: Bool, promise: Promise) in
            guard #available(iOS 16.2, *) else { promise.resolve(); return }
            guard let activity = self.currentActivityBox as? Activity<ReadingSessionAttributes> else {
                promise.resolve(); return
            }

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
            guard let activity = self.currentActivityBox as? Activity<ReadingSessionAttributes> else {
                promise.resolve(); return
            }
            Task {
                await activity.end(dismissalPolicy: .immediate)
                self.currentActivityBox = nil
                promise.resolve()
            }
        }
    }
}
