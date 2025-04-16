import Foundation
import SwiftUI

/// User preferences and settings
public class UserSettings: ObservableObject {
    @Published public var isLeftHanded: Bool = false
    @Published public var showNoteNames: Bool = true
    @Published public var showIntervals: Bool = false
    @Published public var soundEnabled: Bool = true
    @Published public var theme: AppTheme = .system
    
    // Progress tracking
    @Published public var completedLessons: Set<String> = []
    @Published public var noteAccuracy: [String: Double] = [:] // Note name to accuracy percentage
    
    // Test settings
    @Published public var testTimeLimit: Int = 60 // seconds
    @Published public var testDifficulty: TestDifficulty = .medium
    
    public enum AppTheme: String, CaseIterable {
        case light, dark, system
    }
    
    public enum TestDifficulty: String, CaseIterable {
        case easy, medium, hard
    }
    
    public init() {}
    
    // MARK: - Progress Tracking
    
    public func updateNoteAccuracy(noteName: String, correct: Bool) {
        let currentAccuracy = noteAccuracy[noteName] ?? 0.0
        let newAccuracy = (currentAccuracy * 0.9) + (correct ? 1.0 : 0.0) * 0.1
        noteAccuracy[noteName] = newAccuracy
    }
    
    public func markLessonCompleted(_ lessonId: String) {
        completedLessons.insert(lessonId)
    }
    
    // MARK: - Persistence
    
    public func save() {
        // TODO: Implement persistence using UserDefaults or CoreData
    }
    
    public func load() {
        // TODO: Implement loading from persistence
    }
} 