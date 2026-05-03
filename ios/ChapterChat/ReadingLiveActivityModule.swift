import ActivityKit
import Foundation

// Must be identical to ios/ReadingWidget/ReadingSessionAttributes.swift
// Widget extensions cannot import from the app target.
struct ReadingSessionAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var startDate: Date
        var currentPage: Int
        var startPage: Int
        var isPaused: Bool
    }
    var bookTitle: String
    var author: String
    var coverUrl: String
}

@objc(ReadingLiveActivity)
class ReadingLiveActivity: NSObject {
    private var currentActivityBox: Any?

    @objc(startActivity:author:coverUrl:startPage:)
    func startActivity(_ bookTitle: String,
                       author: String,
                       coverUrl: String,
                       startPage: NSNumber) {
        guard #available(iOS 16.2, *) else { return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let attributes = ReadingSessionAttributes(bookTitle: bookTitle, author: author, coverUrl: coverUrl)
        let state = ReadingSessionAttributes.ContentState(
            startDate: Date(),
            currentPage: startPage.intValue,
            startPage: startPage.intValue,
            isPaused: false
        )
        do {
            let activity = try Activity<ReadingSessionAttributes>.request(
                attributes: attributes,
                contentState: state,
                pushType: nil
            )
            currentActivityBox = activity
        } catch {
            NSLog("[LiveActivity] startActivity failed: %@", error.localizedDescription)
        }
    }

    @objc(updateActivity:currentPage:isPaused:)
    func updateActivity(_ elapsedSeconds: NSNumber,
                        currentPage: NSNumber,
                        isPaused: Bool) {
        guard #available(iOS 16.2, *) else { return }
        guard let activity = currentActivityBox as? Activity<ReadingSessionAttributes> else { return }
        let adjustedStart = Date(timeIntervalSinceNow: -elapsedSeconds.doubleValue)
        let newState = ReadingSessionAttributes.ContentState(
            startDate: adjustedStart,
            currentPage: currentPage.intValue,
            startPage: activity.contentState.startPage,
            isPaused: isPaused
        )
        Task {
            await activity.update(using: newState)
        }
    }

    @objc(endActivity)
    func endActivity() {
        guard #available(iOS 16.2, *) else { return }
        guard let activity = currentActivityBox as? Activity<ReadingSessionAttributes> else { return }
        Task {
            await activity.end(dismissalPolicy: .immediate)
            self.currentActivityBox = nil
        }
    }

    @objc static func requiresMainQueueSetup() -> Bool { return false }
}
