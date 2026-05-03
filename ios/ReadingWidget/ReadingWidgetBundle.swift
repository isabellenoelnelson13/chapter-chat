import WidgetKit
import SwiftUI

@main
struct ReadingWidgetBundle: WidgetBundle {
    var body: some Widget {
        ReadingWidget()
        ReadingWidgetLiveActivity()
    }
}
