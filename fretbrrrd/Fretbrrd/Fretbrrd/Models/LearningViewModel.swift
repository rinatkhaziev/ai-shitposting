import Foundation
import Combine
import SwiftUI

/// ViewModel for the learning mode
public class LearningViewModel: ObservableObject {
    // Learning state
    @Published public var currentLesson: Lesson?
    @Published public var lessonProgress: Double = 0.0 // 0.0 to 1.0
    
    // Reference to fretboard ViewModel
    private let fretboardViewModel: FretboardViewModel
    
    // User settings and progress
    private let userSettings: UserSettings
    private let userProgress: UserProgress
    
    // Cancellable subscriptions
    private var cancellables = Set<AnyCancellable>()
    
    // All available lessons
    public var allLessons: [Lesson] {
        return Lesson.allLessons
    }
    
    public init(
        fretboardViewModel: FretboardViewModel,
        userSettings: UserSettings,
        userProgress: UserProgress
    ) {
        self.fretboardViewModel = fretboardViewModel
        self.userSettings = userSettings
        self.userProgress = userProgress
        
        setupSubscriptions()
    }
    
    private func setupSubscriptions() {
        // Example: When a note is selected on the fretboard, update learning state
        fretboardViewModel.$selectedNote
            .sink { [weak self] note in
                guard let self = self, let note = note, let lesson = self.currentLesson else { return }
                
                // Check if the selected note is relevant to the current lesson
                if lesson.notes.contains(where: { $0.isSamePitchClass(as: note) }) {
                    self.updateLessonProgress()
                }
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Actions
    
    /// Select a lesson to start
    public func selectLesson(_ lesson: Lesson) {
        currentLesson = lesson
        lessonProgress = calculateLessonProgress(lesson)
        
        // Highlight relevant notes on fretboard
        if userSettings.showNoteNames {
            fretboardViewModel.highlightedNotes = Set(lesson.notes)
        }
    }
    
    /// Complete the current lesson
    public func completeLesson() {
        guard let lesson = currentLesson else { return }
        
        userProgress.markLessonCompleted(lesson.id.uuidString)
        lessonProgress = 1.0
        
        // Move to next lesson automatically if needed
        // Uncomment to enable auto-progression
        // selectNextLesson()
    }
    
    /// Move to the next lesson
    public func selectNextLesson() {
        guard let currentLesson = currentLesson,
              let currentIndex = allLessons.firstIndex(where: { $0.id == currentLesson.id }),
              currentIndex + 1 < allLessons.count else {
            return
        }
        
        selectLesson(allLessons[currentIndex + 1])
    }
    
    /// Move to the previous lesson
    public func selectPreviousLesson() {
        guard let currentLesson = currentLesson,
              let currentIndex = allLessons.firstIndex(where: { $0.id == currentLesson.id }),
              currentIndex > 0 else {
            return
        }
        
        selectLesson(allLessons[currentIndex - 1])
    }
    
    // MARK: - Helper Methods
    
    /// Update the progress for the current lesson
    private func updateLessonProgress() {
        guard let lesson = currentLesson else { return }
        
        // Calculate new progress
        lessonProgress = min(lessonProgress + 0.1, 1.0)
        
        // Mark lesson as completed if progress reaches 100%
        if lessonProgress >= 1.0 {
            userProgress.markLessonCompleted(lesson.id.uuidString)
        }
    }
    
    /// Calculate progress for a lesson based on past user interaction
    private func calculateLessonProgress(_ lesson: Lesson) -> Double {
        if userProgress.isLessonCompleted(lesson.id.uuidString) {
            return 1.0
        }
        
        // For uncompleted lessons, check notes accuracy
        let notesInLesson = Set(lesson.notes.map { $0.name })
        var totalAccuracy = 0.0
        var noteCount = 0
        
        for noteName in notesInLesson {
            let accuracy = userProgress.accuracyFor(noteName: noteName)
            if accuracy > 0 {
                totalAccuracy += accuracy
                noteCount += 1
            }
        }
        
        if noteCount > 0 {
            return totalAccuracy / Double(noteCount)
        }
        
        return 0.0
    }
}

/// Represents a learning lesson
public struct Lesson: Identifiable {
    public let id: UUID
    public let title: String
    public let description: String
    public let notes: [Note]
    public let difficulty: Difficulty
    
    public enum Difficulty {
        case beginner, intermediate, advanced
    }
    
    public init(
        id: UUID = UUID(),
        title: String,
        description: String,
        notes: [Note],
        difficulty: Difficulty = .beginner
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.notes = notes
        self.difficulty = difficulty
    }
    
    /// Predefined lessons
    public static let allLessons: [Lesson] = [
        // String-based lessons
        Lesson(
            title: "Open Strings",
            description: "Learn the notes of the open strings (standard tuning)",
            notes: [
                Note(stringNumber: 1, fretNumber: 0), // E
                Note(stringNumber: 2, fretNumber: 0), // B
                Note(stringNumber: 3, fretNumber: 0), // G
                Note(stringNumber: 4, fretNumber: 0), // D
                Note(stringNumber: 5, fretNumber: 0), // A
                Note(stringNumber: 6, fretNumber: 0)  // E
            ],
            difficulty: .beginner
        ),
        
        Lesson(
            title: "Low E String",
            description: "Learn all notes on the low E string (first 12 frets)",
            notes: (0...12).map { Note(stringNumber: 6, fretNumber: $0) },
            difficulty: .beginner
        ),
        
        Lesson(
            title: "A String",
            description: "Learn all notes on the A string (first 12 frets)",
            notes: (0...12).map { Note(stringNumber: 5, fretNumber: $0) },
            difficulty: .beginner
        ),
        
        Lesson(
            title: "D String",
            description: "Learn all notes on the D string (first 12 frets)",
            notes: (0...12).map { Note(stringNumber: 4, fretNumber: $0) },
            difficulty: .beginner
        ),
        
        Lesson(
            title: "G String",
            description: "Learn all notes on the G string (first 12 frets)",
            notes: (0...12).map { Note(stringNumber: 3, fretNumber: $0) },
            difficulty: .beginner
        ),
        
        Lesson(
            title: "B String",
            description: "Learn all notes on the B string (first 12 frets)",
            notes: (0...12).map { Note(stringNumber: 2, fretNumber: $0) },
            difficulty: .beginner
        ),
        
        Lesson(
            title: "High E String",
            description: "Learn all notes on the high E string (first 12 frets)",
            notes: (0...12).map { Note(stringNumber: 1, fretNumber: $0) },
            difficulty: .beginner
        ),
        
        // Note-specific lessons
        Lesson(
            title: "All E Notes",
            description: "Find all E notes across the fretboard",
            notes: Note.allNotes.filter { $0.name == "E" && $0.fretNumber <= 12 },
            difficulty: .intermediate
        ),
        
        Lesson(
            title: "All A Notes",
            description: "Find all A notes across the fretboard",
            notes: Note.allNotes.filter { $0.name == "A" && $0.fretNumber <= 12 },
            difficulty: .intermediate
        ),
        
        Lesson(
            title: "All D Notes",
            description: "Find all D notes across the fretboard",
            notes: Note.allNotes.filter { $0.name == "D" && $0.fretNumber <= 12 },
            difficulty: .intermediate
        ),
        
        Lesson(
            title: "All G Notes",
            description: "Find all G notes across the fretboard",
            notes: Note.allNotes.filter { $0.name == "G" && $0.fretNumber <= 12 },
            difficulty: .intermediate
        ),
        
        Lesson(
            title: "All B Notes",
            description: "Find all B notes across the fretboard",
            notes: Note.allNotes.filter { $0.name == "B" && $0.fretNumber <= 12 },
            difficulty: .intermediate
        ),
        
        // Fret-based lessons
        Lesson(
            title: "First Position",
            description: "Learn all notes in the first position (frets 0-4)",
            notes: Note.allNotes.filter { $0.fretNumber >= 0 && $0.fretNumber <= 4 },
            difficulty: .intermediate
        ),
        
        Lesson(
            title: "Fifth Position",
            description: "Learn all notes in the fifth position (frets 5-8)",
            notes: Note.allNotes.filter { $0.fretNumber >= 5 && $0.fretNumber <= 8 },
            difficulty: .intermediate
        ),
        
        Lesson(
            title: "Octave Patterns",
            description: "Learn to find octaves across the fretboard",
            notes: Note.allNotes.filter { ($0.name == "E" || $0.name == "A") && $0.fretNumber <= 12 },
            difficulty: .advanced
        )
    ]
} 