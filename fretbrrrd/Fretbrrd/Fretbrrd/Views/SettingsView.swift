import SwiftUI

public struct SettingsView: View {
    @EnvironmentObject var settings: UserSettings
    @EnvironmentObject var progress: UserProgress
    
    // Import the TestDifficulty enum from UserSettings
    typealias TestDifficulty = UserSettings.TestDifficulty
    
    public init() {}
    
    public var body: some View {
        Form {
            Section(header: Text("Display Settings")) {
                Toggle("Left-handed Mode", isOn: $settings.isLeftHanded)
                Toggle("Show Note Names", isOn: $settings.showNoteNames)
                Toggle("Show Intervals", isOn: $settings.showIntervals)
                Toggle("Show Only Natural Notes", isOn: $settings.showOnlyNaturalNotes)
                    .onChange(of: settings.showOnlyNaturalNotes) { oldValue, newValue in
                        // The onChange handler is required for macOS 14+ compatibility
                        // UserDefaults persistence is handled in the UserSettings didSet
                    }
            }
            
            Section(header: Text("Sound Settings")) {
                Toggle("Enable Sound", isOn: $settings.soundEnabled)
            }
            
            Section(header: Text("Test Settings")) {
                Picker("Difficulty", selection: $settings.testDifficulty) {
                    ForEach(UserSettings.TestDifficulty.allCases, id: \.self) { difficulty in
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
                    showResetConfirmation = true
                }
                .foregroundColor(.red)
                .alert(isPresented: $showResetConfirmation) {
                    Alert(
                        title: Text("Reset Progress"),
                        message: Text("Are you sure you want to reset all progress? This cannot be undone."),
                        primaryButton: .destructive(Text("Reset")) {
                            resetAllData()
                        },
                        secondaryButton: .cancel()
                    )
                }
            }
        }
        .navigationTitle("Settings")
    }
    
    @State private var showResetConfirmation = false
    
    private func resetAllData() {
        progress.resetAllProgress()
        settings.resetAllSettings()
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