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
