import Foundation
import Combine

/// Tracks a user's progress in the app
public class UserProgress: ObservableObject {
    // Note accuracy tracking
    @Published public var noteAccuracy: [String: NoteStats] = [:]
    
    // Test history
    @Published public var testHistory: [TestResult] = []
    
    // Completed lessons
    @Published public var completedLessons: Set<String> = []
    
    public init() {}
    
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
    
    /// Saves progress to UserDefaults
    public func save() {
        // TODO: Implement persistence using UserDefaults or CoreData
    }
    
    /// Loads progress from UserDefaults
    public func load() {
        // TODO: Implement loading from persistence
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
