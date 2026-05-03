import ActivityKit
import SwiftUI
import WidgetKit

private func formatElapsed(_ startDate: Date) -> String {
    let seconds = Int(Date.now.timeIntervalSince(startDate))
    let h = seconds / 3600
    let m = (seconds % 3600) / 60
    let s = seconds % 60
    if h > 0 {
        return String(format: "%d:%02d:%02d", h, m, s)
    } else {
        return String(format: "%d:%02d", m, s)
    }
}

struct ReadingWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ReadingSessionAttributes.self) { context in
            HStack(spacing: 12) {
                // Cover image
                AsyncImage(url: URL(string: context.attributes.coverUrl)) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.purple.opacity(0.15))
                        .overlay(
                            Image(systemName: "book.closed.fill")
                                .foregroundStyle(.purple.opacity(0.5))
                        )
                }
                .frame(width: 40, height: 54)
                .clipShape(RoundedRectangle(cornerRadius: 4))

                // Title and author
                VStack(alignment: .leading, spacing: 3) {
                    Text(context.attributes.bookTitle)
                        .font(.system(.subheadline, weight: .semibold))
                        .lineLimit(2)
                    Text(context.attributes.author)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                // Timer + pause/play button
                VStack(alignment: .trailing, spacing: 6) {
                    if context.state.isPaused {
                        Text(formatElapsed(context.state.startDate))
                            .font(.system(.subheadline, design: .monospaced, weight: .semibold))
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    } else {
                        Text(context.state.startDate, style: .timer)
                            .font(.system(.subheadline, design: .monospaced, weight: .semibold))
                            .foregroundStyle(.purple)
                            .monospacedDigit()
                    }

                    Link(destination: URL(string: "chapterchat://")!) {
                        Image(systemName: context.state.isPaused ? "play.circle.fill" : "pause.circle.fill")
                            .font(.title2)
                            .foregroundStyle(.purple)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .activityBackgroundTint(Color(.systemBackground))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    AsyncImage(url: URL(string: context.attributes.coverUrl)) { image in
                        image.resizable().aspectRatio(contentMode: .fill)
                    } placeholder: {
                        Color.purple.opacity(0.2)
                    }
                    .frame(width: 28, height: 38)
                    .clipShape(RoundedRectangle(cornerRadius: 3))
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.isPaused {
                        Text(formatElapsed(context.state.startDate))
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                            .padding(.trailing, 4)
                    } else {
                        Text(context.state.startDate, style: .timer)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.purple)
                            .monospacedDigit()
                            .padding(.trailing, 4)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(context.attributes.bookTitle)
                            .font(.caption)
                            .lineLimit(1)
                        Spacer()
                        Text(context.state.isPaused ? "Paused" : "p.\(context.state.currentPage)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                AsyncImage(url: URL(string: context.attributes.coverUrl)) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    Image(systemName: "book.fill").foregroundStyle(.purple)
                }
                .frame(width: 16, height: 20)
                .clipShape(RoundedRectangle(cornerRadius: 2))
            } compactTrailing: {
                if context.state.isPaused {
                    Image(systemName: "pause.fill").foregroundStyle(.secondary).font(.caption)
                } else {
                    Text(context.state.startDate, style: .timer)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(.purple)
                        .monospacedDigit()
                        .frame(width: 44)
                }
            } minimal: {
                Image(systemName: "book.fill").foregroundStyle(.purple)
            }
        }
    }
}
