import Foundation
import Combine

/// Keys for UserDefaults
private enum ProgressDefaultsKeys {
    static let noteAccuracy = "progressNoteAccuracy"
    static let testHistory = "progressTestHistory"
    static let completedLessons = "progressCompletedLessons"
}

/// Tracks a user's progress in the app
public class UserProgress: ObservableObject {
    // UserDefaults for persistence
    private let defaults = UserDefaults.standard
    
    // Note accuracy tracking
    @Published public var noteAccuracy: [String: NoteStats] {
        didSet {
            saveNoteAccuracy()
        }
    }
    
    // Test history
    @Published public var testHistory: [TestResult] {
        didSet {
            saveTestHistory()
        }
    }
    
    // Completed lessons
    @Published public var completedLessons: Set<String> {
        didSet {
            defaults.set(Array(completedLessons), forKey: ProgressDefaultsKeys.completedLessons)
        }
    }
    
    public init() {
        // Initialize with values from UserDefaults
        if let data = defaults.data(forKey: ProgressDefaultsKeys.noteAccuracy),
           let decoded = try? JSONDecoder().decode([String: NoteStats].self, from: data) {
            self.noteAccuracy = decoded
        } else {
            self.noteAccuracy = [:]
        }
        
        if let data = defaults.data(forKey: ProgressDefaultsKeys.testHistory),
           let decoded = try? JSONDecoder().decode([TestResult].self, from: data) {
            self.testHistory = decoded
        } else {
            self.testHistory = []
        }
        
        if let lessonsArray = defaults.stringArray(forKey: ProgressDefaultsKeys.completedLessons) {
            self.completedLessons = Set(lessonsArray)
        } else {
            self.completedLessons = []
        }
    }
    
    // MARK: - Note Progress Tracking
    
    /// Updates the accuracy for a specific note
    public func updateNoteAccuracy(noteName: String, correct: Bool) {
        if var stats = noteAccuracy[noteName] {
            stats.attempts += 1
            if correct {
                stats.correctAnswers += 1
            }
            noteAccuracy[noteName] = stats
        } else {
            noteAccuracy[noteName] = NoteStats(
                attempts: 1,
                correctAnswers: correct ? 1 : 0
            )
        }
    }
    
    /// Returns the accuracy percentage for a specific note
    public func accuracyFor(noteName: String) -> Double {
        guard let stats = noteAccuracy[noteName], stats.attempts > 0 else {
            return 0
        }
        return Double(stats.correctAnswers) / Double(stats.attempts)
    }
    
    // MARK: - Lesson Tracking
    
    /// Marks a lesson as completed
    public func markLessonCompleted(_ lessonId: String) {
        completedLessons.insert(lessonId)
    }
    
    /// Checks if a lesson is completed
    public func isLessonCompleted(_ lessonId: String) -> Bool {
        return completedLessons.contains(lessonId)
    }
    
    // MARK: - Test Tracking
    
    /// Records the result of a test
    public func recordTestResult(testType: String, score: Int, maxScore: Int, timeSpent: TimeInterval) {
        let result = TestResult(
            timestamp: Date(),
            testType: testType,
            score: score,
            maxScore: maxScore,
            timeSpent: timeSpent
        )
        testHistory.append(result)
    }
    
    /// Returns the average score for a specific test type
    public func averageScoreFor(testType: String) -> Double {
        let relevantTests = testHistory.filter { $0.testType == testType }
        guard !relevantTests.isEmpty else { return 0 }
        
        let totalScore = relevantTests.reduce(0) { result, test in
            result + test.percentageScore
        }
        return totalScore / Double(relevantTests.count)
    }
    
    // MARK: - Persistence
    
    private func saveNoteAccuracy() {
        if let encoded = try? JSONEncoder().encode(noteAccuracy) {
            defaults.set(encoded, forKey: ProgressDefaultsKeys.noteAccuracy)
        }
    }
    
    private func saveTestHistory() {
        if let encoded = try? JSONEncoder().encode(testHistory) {
            defaults.set(encoded, forKey: ProgressDefaultsKeys.testHistory)
        }
    }
    
    /// Saves all progress to UserDefaults
    public func save() {
        saveNoteAccuracy()
        saveTestHistory()
        defaults.set(Array(completedLessons), forKey: ProgressDefaultsKeys.completedLessons)
        defaults.synchronize()
    }
    
    /// Resets all progress
    public func resetAllProgress() {
        noteAccuracy = [:]
        testHistory = []
        completedLessons = []
        save()
    }
}

// MARK: - Supporting Structures

/// Statistics for a single note
public struct NoteStats: Codable {
    public var attempts: Int
    public var correctAnswers: Int
    
    public var accuracy: Double {
        guard attempts > 0 else { return 0 }
        return Double(correctAnswers) / Double(attempts)
    }
}

/// Represents the result of a completed test
public struct TestResult: Identifiable, Codable {
    public var id = UUID()
    public let timestamp: Date
    public let testType: String
    public let score: Int
    public let maxScore: Int
    public let timeSpent: TimeInterval
    
    public var percentageScore: Double {
        guard maxScore > 0 else { return 0 }
        return Double(score) / Double(maxScore) * 100
    }
} 
