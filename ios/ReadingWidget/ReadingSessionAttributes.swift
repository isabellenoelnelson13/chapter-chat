import ActivityKit
import Foundation

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
