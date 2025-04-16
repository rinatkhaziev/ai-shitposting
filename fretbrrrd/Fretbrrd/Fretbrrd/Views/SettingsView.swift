import SwiftUI

public struct SettingsView: View {
    @EnvironmentObject var settings: UserSettings
    @EnvironmentObject var progress: UserProgress
    
    public init() {}
    
    public var body: some View {
        Form {
            Section(header: Text("Display Settings")) {
                Toggle("Left-handed Mode", isOn: $settings.isLeftHanded)
                Toggle("Show Note Names", isOn: $settings.showNoteNames)
                Toggle("Show Intervals", isOn: $settings.showIntervals)
            }
            
            Section(header: Text("Sound Settings")) {
                Toggle("Enable Sound", isOn: $settings.soundEnabled)
            }
            
            Section(header: Text("Theme")) {
                Picker("Theme", selection: $settings.theme) {
                    ForEach(AppTheme.allCases, id: \.self) { theme in
                        Text(theme.rawValue.capitalized)
                            .tag(theme)
                    }
                }
            }
            
            Section(header: Text("Test Settings")) {
                Picker("Difficulty", selection: $settings.testDifficulty) {
                    ForEach(TestDifficulty.allCases, id: \.self) { difficulty in
                        Text(difficulty.rawValue.capitalized)
                            .tag(difficulty)
                    }
                }
                
                Stepper("Time Limit: \(settings.testTimeLimit)s",
                        value: $settings.testTimeLimit,
                        in: 0...300,
                        step: 30)
            }
            
            Section(header: Text("Progress Statistics")) {
                ForEach(Note.noteNames.sorted(), id: \.self) { noteName in
                    if let stats = progress.noteAccuracy[noteName] {
                        HStack {
                            Text(noteName)
                            Spacer()
                            
                            // Progress bar
                            GeometryReader { geometry in
                                ZStack(alignment: .leading) {
                                    Rectangle()
                                        .fill(Color.gray.opacity(0.3))
                                        .frame(width: geometry.size.width, height: 6)
                                    
                                    Rectangle()
                                        .fill(progressColor(for: stats.accuracy))
                                        .frame(width: geometry.size.width * CGFloat(stats.accuracy), height: 6)
                                }
                            }
                            .frame(width: 100, height: 6)
                            
                            // Accuracy percentage
                            Text("\(Int(stats.accuracy * 100))%")
                                .font(.caption)
                                .monospacedDigit()
                                .foregroundColor(.secondary)
                                .frame(width: 40, alignment: .trailing)
                        }
                    }
                }
            }
            
            Section(header: Text("Completed Lessons")) {
                if progress.completedLessons.isEmpty {
                    Text("No lessons completed yet")
                        .foregroundColor(.secondary)
                        .italic()
                } else {
                    ForEach(Array(progress.completedLessons).sorted(), id: \.self) { lessonId in
                        Text("Lesson: \(lessonId)")
                    }
                }
            }
            
            Section {
                Button("Reset All Progress") {
                    // Show confirmation dialog
                    // TODO: Implement reset functionality
                }
                .foregroundColor(.red)
            }
        }
        .navigationTitle("Settings")
    }
    
    private func progressColor(for accuracy: Double) -> Color {
        switch accuracy {
        case 0..<0.4:
            return .red
        case 0.4..<0.7:
            return .orange
        case 0.7..<0.9:
            return .yellow
        default:
            return .green
        }
    }
}

#Preview {
    NavigationView {
        SettingsView()
            .environmentObject(UserSettings())
            .environmentObject(UserProgress())
    }
} 