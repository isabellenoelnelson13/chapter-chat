import ActivityKit
import SwiftUI
import WidgetKit

// Matches the app's primary color (#7C5CBF)
private let accent = Color(red: 0.486, green: 0.361, blue: 0.749)

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

            // ── Lock screen / notification banner ──────────────────────────
            let pagesRead = context.state.currentPage - context.state.startPage

            HStack(spacing: 12) {

                // Tinted book icon
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(accent.opacity(0.15))
                        .frame(width: 44, height: 44)
                    Image(systemName: "book.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(accent)
                }

                // Title + author
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.attributes.bookTitle)
                        .font(.system(.subheadline, weight: .semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text(context.attributes.author)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                // Timer / paused state + pages read
                VStack(alignment: .trailing, spacing: 3) {
                    if context.state.isPaused {
                        HStack(spacing: 4) {
                            Image(systemName: "pause.fill").font(.caption2)
                            Text(formatElapsed(context.state.startDate))
                                .font(.system(.subheadline, design: .monospaced, weight: .semibold))
                        }
                        .foregroundStyle(.secondary)
                    } else {
                        Text(context.state.startDate, style: .timer)
                            .font(.system(.subheadline, design: .monospaced, weight: .semibold))
                            .foregroundStyle(accent)
                            .monospacedDigit()
                    }

                    Text(pagesRead > 0 ? "+\(pagesRead) pg" : "p. \(context.state.currentPage)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .activityBackgroundTint(Color(.systemBackground))

        } dynamicIsland: { context in

            let pagesRead = context.state.currentPage - context.state.startPage

            DynamicIsland {

                // Expanded — leading: icon + author, center: title, trailing: timer + pages
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: "book.fill")
                            .foregroundStyle(accent)
                            .font(.callout)
                        Text(context.attributes.author)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.bookTitle)
                        .font(.system(.caption, weight: .semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                        .multilineTextAlignment(.center)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        if context.state.isPaused {
                            Image(systemName: "pause.circle.fill")
                                .foregroundStyle(.secondary)
                                .font(.title3)
                        } else {
                            Text(context.state.startDate, style: .timer)
                                .font(.system(.callout, design: .monospaced, weight: .semibold))
                                .foregroundStyle(accent)
                                .monospacedDigit()
                        }
                        Text(pagesRead > 0 ? "+\(pagesRead) pg" : "p. \(context.state.currentPage)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }

            } compactLeading: {
                Image(systemName: "book.fill")
                    .foregroundStyle(accent)
                    .font(.caption)

            } compactTrailing: {
                if context.state.isPaused {
                    Image(systemName: "pause.fill")
                        .foregroundStyle(.secondary)
                        .font(.caption)
                } else {
                    Text(context.state.startDate, style: .timer)
                        .font(.system(.caption2, design: .monospaced))
                        .foregroundStyle(accent)
                        .monospacedDigit()
                        .frame(width: 44)
                }

            } minimal: {
                Image(systemName: "book.fill")
                    .foregroundStyle(accent)
            }
        }
    }
}
