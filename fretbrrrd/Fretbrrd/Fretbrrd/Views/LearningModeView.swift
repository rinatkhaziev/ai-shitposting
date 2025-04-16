import SwiftUI

public struct LearningModeView: View {
    @EnvironmentObject var settings: UserSettings
    @EnvironmentObject var progress: UserProgress
    
    // Initialize view models
    @StateObject private var fretboardViewModel: FretboardViewModel
    @StateObject private var learningViewModel: LearningViewModel
    
    public init() {
        // Create ViewModels
        let settings = UserSettings()
        let progress = UserProgress()
        
        let fretboardVM = FretboardViewModel(userSettings: settings, userProgress: progress)
        self._fretboardViewModel = StateObject(wrappedValue: fretboardVM)
        
        let learningVM = LearningViewModel(
            fretboardViewModel: fretboardVM,
            userSettings: settings,
            userProgress: progress
        )
        self._learningViewModel = StateObject(wrappedValue: learningVM)
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            // Lesson info header
            if let lesson = learningViewModel.currentLesson {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(lesson.title)
                            .font(.title2.bold())
                        
                        Spacer()
                        
                        // Progress indicator
                        ProgressView(value: learningViewModel.lessonProgress)
                            .progressViewStyle(CircularProgressViewStyle())
                            .frame(width: 40, height: 40)
                    }
                    
                    Text(lesson.description)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(Color(.systemBackground))
                .cornerRadius(10)
                .shadow(radius: 2)
                .padding(.horizontal)
                .padding(.top)
            }
            
            // Fretboard
            FretboardView()
                .environmentObject(fretboardViewModel)
                .frame(height: 250)
                .padding(.vertical)
            
            // Lesson navigation
            HStack {
                Button(action: learningViewModel.selectPreviousLesson) {
                    Image(systemName: "chevron.left")
                        .font(.title2)
                        .padding()
                }
                .disabled(learningViewModel.currentLesson == nil)
                
                Spacer()
                
                Button(action: learningViewModel.completeLesson) {
                    Text("Complete Lesson")
                        .font(.headline)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                }
                .disabled(learningViewModel.currentLesson == nil)
                
                Spacer()
                
                Button(action: learningViewModel.selectNextLesson) {
                    Image(systemName: "chevron.right")
                        .font(.title2)
                        .padding()
                }
                .disabled(learningViewModel.currentLesson == nil)
            }
            .padding()
            
            // Lesson selection
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHGrid(rows: [GridItem(.flexible())], spacing: 15) {
                    ForEach(learningViewModel.allLessons) { lesson in
                        LessonButton(
                            lesson: lesson,
                            isSelected: learningViewModel.currentLesson?.id == lesson.id,
                            isCompleted: progress.isLessonCompleted(lesson.id.uuidString)
                        ) {
                            learningViewModel.selectLesson(lesson)
                        }
                    }
                }
                .padding()
            }
            .frame(height: 150)
            .background(Color(.systemGray6))
        }
        .navigationTitle("Learning Mode")
        .onAppear {
            // Select first lesson if none is selected
            if learningViewModel.currentLesson == nil && !learningViewModel.allLessons.isEmpty {
                learningViewModel.selectLesson(learningViewModel.allLessons[0])
            }
        }
    }
}

struct LessonButton: View {
    let lesson: Lesson
    let isSelected: Bool
    let isCompleted: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading) {
                HStack {
                    Text(lesson.title)
                        .font(.headline)
                    
                    if isCompleted {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                    }
                }
                
                Text(lesson.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                
                // Difficulty indicator
                HStack {
                    ForEach(0..<difficultyLevel, id: \.self) { _ in
                        Image(systemName: "star.fill")
                            .foregroundColor(.yellow)
                            .font(.system(size: 8))
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
        switch lesson.difficulty {
        case .beginner: return 1
        case .intermediate: return 2
        case .advanced: return 3
        }
    }
}

#Preview {
    NavigationView {
        LearningModeView()
            .environmentObject(UserSettings())
            .environmentObject(UserProgress())
    }
} 
