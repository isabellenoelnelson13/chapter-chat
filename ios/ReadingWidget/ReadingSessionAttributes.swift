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
    var coverUrl: String
}
