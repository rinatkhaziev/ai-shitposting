import SwiftUI

public struct TestModeView: View {
    @EnvironmentObject var settings: UserSettings
    @EnvironmentObject var progress: UserProgress
    
    // Initialize view models
    @StateObject private var fretboardViewModel: FretboardViewModel
    @StateObject private var testViewModel: TestViewModel
    
    public init() {
        // Create ViewModels
        let settings = UserSettings()
        let progress = UserProgress()
        
        let fretboardVM = FretboardViewModel(userSettings: settings, userProgress: progress)
        self._fretboardViewModel = StateObject(wrappedValue: fretboardVM)
        
        let testVM = TestViewModel(
            fretboardViewModel: fretboardVM,
            userSettings: settings,
            userProgress: progress
        )
        self._testViewModel = StateObject(wrappedValue: testVM)
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            // Test info and score header
            HStack {
                if let test = testViewModel.currentTest {
                    VStack(alignment: .leading) {
                        Text(test.title)
                            .font(.headline)
                        Text(test.description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                } else {
                    Text("Select a test to begin")
                        .font(.headline)
                }
                
                Spacer()
                
                if testViewModel.isTestRunning {
                    VStack(alignment: .trailing) {
                        Text("Score: \(testViewModel.score)/\(testViewModel.maxScore)")
                            .font(.headline)
                            .foregroundColor(.blue)
                        
                        if testViewModel.timeRemaining > 0 {
                            HStack {
                                Image(systemName: "clock")
                                Text("\(testViewModel.timeRemaining)s")
                            }
                            .foregroundColor(testViewModel.timeRemaining < 10 ? .red : .primary)
                            .font(.subheadline)
                        }
                    }
                }
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(10)
            .shadow(radius: 2)
            .padding(.horizontal)
            .padding(.top)
            
            // Current question display
            if let question = testViewModel.currentQuestion {
                Text(question.prompt)
                    .font(.title3.bold())
                    .multilineTextAlignment(.center)
                    .padding()
            }
            
            // Fretboard
            FretboardView()
                .environmentObject(fretboardViewModel)
                .frame(height: 250)
                .padding(.vertical)
            
            // Multiple choice answers for identifyNote questions
            if let question = testViewModel.currentQuestion,
               case .identifyNote = question.type {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 60))]) {
                    ForEach(Note.noteNames, id: \.self) { noteName in
                        Button(action: {
                            testViewModel.submitAnswer(noteName)
                        }) {
                            Text(noteName)
                                .frame(minWidth: 40)
                                .padding()
                                .background(Color.blue)
                                .foregroundColor(.white)
                                .cornerRadius(8)
                        }
                    }
                }
                .padding()
            }
            
            // Test selection
            if !testViewModel.isTestRunning {
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHGrid(rows: [GridItem(.flexible())], spacing: 15) {
                        ForEach(Test.allTests) { test in
                            TestButton(test: test, isSelected: testViewModel.currentTest?.id == test.id) {
                                testViewModel.startTest(test)
                            }
                        }
                    }
                    .padding()
                }
                .frame(height: 150)
                .background(Color(.systemGray6))
            }
        }
        .navigationTitle("Test Mode")
    }
}

struct TestButton: View {
    let test: Test
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading) {
                Text(test.title)
                    .font(.headline)
                
                Text(test.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                
                HStack {
                    Label("\(test.timeLimit)s", systemImage: "clock")
                        .font(.caption2)
                    
                    Spacer()
                    
                    // Difficulty indicator
                    HStack {
                        ForEach(0..<difficultyLevel, id: \.self) { _ in
                            Image(systemName: "star.fill")
                                .foregroundColor(.yellow)
                                .font(.system(size: 8))
                        }
                    }
                }
            }
            .frame(width: 200, alignment: .leading)
            .padding()
            .background(isSelected ? Color.blue.opacity(0.2) : Color(.systemBackground))
            .cornerRadius(10)
            .shadow(radius: isSelected ? 3 : 1)
            .animation(.easeInOut, value: isSelected)
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var difficultyLevel: Int {
        switch test.difficulty {
        case .easy: return 1
        case .medium: return 2
        case .hard: return 3
        }
    }
}

#Preview {
    NavigationView {
        TestModeView()
            .environmentObject(UserSettings())
            .environmentObject(UserProgress())
    }
} 
