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
                    if context.state.isPaused {
                        Text(formatElapsed(context.state.startDate))
                            .font(.system(.title3, design: .monospaced, weight: .semibold))
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    } else {
                        Text(context.state.startDate, style: .timer)
                            .font(.system(.title3, design: .monospaced, weight: .semibold))
                            .foregroundStyle(.purple)
                            .monospacedDigit()
                    }
                    if context.state.isPaused {
                        Text("Paused")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("p.\(context.state.currentPage)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding()
            .activityBackgroundTint(Color(.systemBackground))
        }
    }
}
