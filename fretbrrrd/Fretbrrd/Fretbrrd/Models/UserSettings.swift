import Foundation
import SwiftUI

/// Keys for UserDefaults
private enum UserDefaultsKeys {
    static let isLeftHanded = "isLeftHanded"
    static let showNoteNames = "showNoteNames"
    static let showIntervals = "showIntervals"
    static let showOnlyNaturalNotes = "showOnlyNaturalNotes"
    static let soundEnabled = "soundEnabled"
    static let themeSetting = "themeSetting"
    static let testTimeLimit = "testTimeLimit"
    static let testDifficulty = "testDifficulty"
    static let completedLessons = "completedLessons"
    static let noteAccuracy = "noteAccuracy"
}

/// User preferences and settings
public class UserSettings: ObservableObject {
    // The UserDefaults standard instance
    private let defaults = UserDefaults.standard
    
    // MARK: - Display Settings
    
    @Published public var isLeftHanded: Bool {
        didSet {
            defaults.set(isLeftHanded, forKey: UserDefaultsKeys.isLeftHanded)
            objectWillChange.send()
        }
    }
    
    @Published public var showNoteNames: Bool {
        didSet {
            defaults.set(showNoteNames, forKey: UserDefaultsKeys.showNoteNames)
            objectWillChange.send()
        }
    }
    
    @Published public var showIntervals: Bool {
        didSet {
            defaults.set(showIntervals, forKey: UserDefaultsKeys.showIntervals)
            objectWillChange.send()
        }
    }
    
    @Published public var showOnlyNaturalNotes: Bool {
        didSet {
            defaults.set(showOnlyNaturalNotes, forKey: UserDefaultsKeys.showOnlyNaturalNotes)
            objectWillChange.send()
        }
    }
    
    // MARK: - Sound Settings
    
    @Published public var soundEnabled: Bool {
        didSet {
            defaults.set(soundEnabled, forKey: UserDefaultsKeys.soundEnabled)
            objectWillChange.send()
        }
    }
    
    // MARK: - Theme Settings
    
    @Published public var theme: AppTheme {
        didSet {
            defaults.set(theme.rawValue, forKey: UserDefaultsKeys.themeSetting)
            objectWillChange.send()
        }
    }
    
    // MARK: - Test Settings
    
    @Published public var testTimeLimit: Int {
        didSet {
            defaults.set(testTimeLimit, forKey: UserDefaultsKeys.testTimeLimit)
            objectWillChange.send()
        }
    }
    
    @Published public var testDifficulty: TestDifficulty {
        didSet {
            defaults.set(testDifficulty.rawValue, forKey: UserDefaultsKeys.testDifficulty)
            objectWillChange.send()
        }
    }
    
    // MARK: - Progress Tracking
    
    @Published public var completedLessons: Set<String> {
        didSet {
            defaults.set(Array(completedLessons), forKey: UserDefaultsKeys.completedLessons)
            objectWillChange.send()
        }
    }
    
    @Published public var noteAccuracy: [String: Double] {
        didSet {
            // Convert the dictionary to a format that can be stored in UserDefaults
            defaults.set(noteAccuracy.convertToPlistCompatible(), forKey: UserDefaultsKeys.noteAccuracy)
            objectWillChange.send()
        }
    }
    
    // MARK: - Enums
    
    public enum TestDifficulty: String, CaseIterable {
        case easy = "easy"
        case medium = "medium"
        case hard = "hard"
    }
    
    public enum AppTheme: String, CaseIterable {
        case light = "light"
        case dark = "dark"
        case system = "system"
    }
    
    // MARK: - Initialization
    
    public init() {
        // First, initialize all properties with default values
        // This ensures all stored properties are initialized before using self
        self.isLeftHanded = false
        self.showNoteNames = true
        self.showIntervals = false
        self.showOnlyNaturalNotes = false
        self.soundEnabled = true
        self.theme = .system
        self.testTimeLimit = 60  // Default
        self.testDifficulty = .medium
        self.completedLessons = []
        self.noteAccuracy = [:]
        
        // Now load values from UserDefaults if they exist
        if defaults.object(forKey: UserDefaultsKeys.isLeftHanded) != nil {
            self.isLeftHanded = defaults.bool(forKey: UserDefaultsKeys.isLeftHanded)
        }
        
        if defaults.object(forKey: UserDefaultsKeys.showNoteNames) != nil {
            self.showNoteNames = defaults.bool(forKey: UserDefaultsKeys.showNoteNames)
        }
        
        if defaults.object(forKey: UserDefaultsKeys.showIntervals) != nil {
            self.showIntervals = defaults.bool(forKey: UserDefaultsKeys.showIntervals)
        }
        
        if defaults.object(forKey: UserDefaultsKeys.showOnlyNaturalNotes) != nil {
            self.showOnlyNaturalNotes = defaults.bool(forKey: UserDefaultsKeys.showOnlyNaturalNotes)
        }
        
        if defaults.object(forKey: UserDefaultsKeys.soundEnabled) != nil {
            self.soundEnabled = defaults.bool(forKey: UserDefaultsKeys.soundEnabled)
        }
        
        // Theme
        if let themeString = defaults.string(forKey: UserDefaultsKeys.themeSetting),
           let theme = AppTheme(rawValue: themeString) {
            self.theme = theme
        }
        
        // Test settings
        if defaults.object(forKey: UserDefaultsKeys.testTimeLimit) != nil {
            let storedTimeLimit = defaults.integer(forKey: UserDefaultsKeys.testTimeLimit)
            if storedTimeLimit > 0 {
                self.testTimeLimit = storedTimeLimit
            }
        }
        
        if let difficultyString = defaults.string(forKey: UserDefaultsKeys.testDifficulty),
           let difficulty = TestDifficulty(rawValue: difficultyString) {
            self.testDifficulty = difficulty
        }
        
        // Progress
        if let completedLessonsArray = defaults.stringArray(forKey: UserDefaultsKeys.completedLessons) {
            self.completedLessons = Set(completedLessonsArray)
        }
        
        if let savedDict = defaults.dictionary(forKey: UserDefaultsKeys.noteAccuracy) {
            self.noteAccuracy = [String: Double].createFromPlistCompatible(savedDict)
        }
    }
    
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
    
    public func resetAllSettings() {
        // Reset all settings to default values
        isLeftHanded = false
        showNoteNames = true
        showIntervals = false
        showOnlyNaturalNotes = false
        soundEnabled = true
        theme = .system
        testTimeLimit = 60
        testDifficulty = .medium
        completedLessons = []
        noteAccuracy = [:]
        
        // Force save
        save()
    }
    
    public func save() {
        // Force a save of all values to UserDefaults
        defaults.synchronize()
    }
}

// MARK: - Dictionary Extensions for UserDefaults

extension Dictionary where Key == String, Value == Double {
    func convertToPlistCompatible() -> [String: NSNumber] {
        var result = [String: NSNumber]()
        for (key, value) in self {
            result[key] = NSNumber(value: value)
        }
        return result
    }
    
    static func createFromPlistCompatible(_ dict: [String: Any]) -> [String: Double] {
        var result = [String: Double]()
        for (key, value) in dict {
            if let number = value as? NSNumber {
                result[key] = number.doubleValue
            }
        }
        return result
    }
} 