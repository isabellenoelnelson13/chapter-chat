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

    @objc(startActivity:author:coverUrl:startPage:resolver:rejecter:)
    func startActivity(_ bookTitle: String,
                       author: String,
                       coverUrl: String,
                       startPage: NSNumber,
                       resolver: @escaping RCTPromiseResolveBlock,
                       rejecter: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.2, *) else { resolver(nil); return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { resolver(nil); return }

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
            resolver(activity.id)
        } catch {
            rejecter("LIVE_ACTIVITY_START_FAILED", error.localizedDescription, error)
        }
    }

    @objc(updateActivity:currentPage:isPaused:resolver:rejecter:)
    func updateActivity(_ elapsedSeconds: NSNumber,
                        currentPage: NSNumber,
                        isPaused: Bool,
                        resolver: @escaping RCTPromiseResolveBlock,
                        rejecter: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.2, *) else { resolver(nil); return }
        guard let activity = currentActivityBox as? Activity<ReadingSessionAttributes> else {
            resolver(nil); return
        }
        let adjustedStart = Date(timeIntervalSinceNow: -elapsedSeconds.doubleValue)
        let newState = ReadingSessionAttributes.ContentState(
            startDate: adjustedStart,
            currentPage: currentPage.intValue,
            startPage: activity.contentState.startPage,
            isPaused: isPaused
        )
        Task {
            await activity.update(using: newState)
            resolver(nil)
        }
    }

    @objc(endActivity:rejecter:)
    func endActivity(_ resolver: @escaping RCTPromiseResolveBlock,
                     rejecter: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.2, *) else { resolver(nil); return }
        guard let activity = currentActivityBox as? Activity<ReadingSessionAttributes> else {
            resolver(nil); return
        }
        Task {
            await activity.end(dismissalPolicy: .immediate)
            currentActivityBox = nil
            resolver(nil)
        }
    }

    @objc static func requiresMainQueueSetup() -> Bool { return false }
}
