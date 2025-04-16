import Foundation
import Combine
import SwiftUI

/// ViewModel for test mode
public class TestViewModel: ObservableObject {
    // Test state
    @Published public var currentTest: Test?
    @Published public var currentQuestion: TestQuestion?
    @Published public var score: Int = 0
    @Published public var maxScore: Int = 0
    @Published public var timeRemaining: Int = 0
    @Published public var isTestRunning: Bool = false
    @Published public var testProgress: Double = 0.0 // 0.0 to 1.0
    
    // Reference to other ViewModels
    private let fretboardViewModel: FretboardViewModel
    
    // User settings and progress
    private let userSettings: UserSettings
    private let userProgress: UserProgress
    
    // Timer for timed tests
    private var timer: Timer?
    private var startTime: Date?
    
    // Test questions
    private var questions: [TestQuestion] = []
    private var currentQuestionIndex: Int = 0
    
    // Cancellable subscriptions
    private var cancellables = Set<AnyCancellable>()
    
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
        // Example: When a note is selected on the fretboard, check the answer for find-note questions
        fretboardViewModel.$selectedNote
            .sink { [weak self] note in
                guard let self = self, 
                      let note = note, 
                      let question = self.currentQuestion,
                      case .findNote(let targetNote) = question.type,
                      self.isTestRunning else { return }
                
                self.checkAnswer(note: note, forTargetNote: targetNote)
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Test Actions
    
    /// Start a test with the given parameters
    public func startTest(_ test: Test) {
        // Reset test state
        score = 0
        maxScore = 0
        isTestRunning = true
        fretboardViewModel.clearSelection()
        
        // Generate questions
        generateQuestions(for: test)
        
        // Setup timer if needed
        if test.timeLimit > 0 {
            timeRemaining = test.timeLimit
            startTime = Date()
            timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
                guard let self = self else { return }
                
                if self.timeRemaining > 0 {
                    self.timeRemaining -= 1
                } else {
                    self.endTest()
                }
            }
        }
        
        // Start with first question
        currentTest = test
        if !questions.isEmpty {
            showQuestion(at: 0)
        } else {
            endTest()
        }
    }
    
    /// End the current test
    public func endTest() {
        isTestRunning = false
        timer?.invalidate()
        timer = nil
        
        // Calculate time spent
        let timeSpent: TimeInterval
        if let startTime = startTime {
            timeSpent = Date().timeIntervalSince(startTime)
        } else {
            timeSpent = 0
        }
        
        // Record results
        if let test = currentTest, maxScore > 0 {
            userProgress.recordTestResult(
                testType: test.title,
                score: score,
                maxScore: maxScore,
                timeSpent: timeSpent
            )
        }
        
        // Clear state
        currentTest = nil
        currentQuestion = nil
        questions = []
        fretboardViewModel.clearSelection()
    }
    
    /// Submit an answer for the current identify-note question
    public func submitAnswer(_ noteName: String) {
        guard let question = currentQuestion,
              case .identifyNote(let notePosition) = question.type else {
            return
        }
        
        let correctNote = Note(stringNumber: notePosition.stringNumber, fretNumber: notePosition.fretNumber)
        let isCorrect = correctNote.name == noteName
        
        processAnswer(isCorrect: isCorrect, forNote: correctNote.name)
    }
    
    /// Move to the next question
    public func nextQuestion() {
        if currentQuestionIndex + 1 < questions.count {
            showQuestion(at: currentQuestionIndex + 1)
        } else {
            endTest()
        }
    }
    
    // MARK: - Helper Methods
    
    /// Generate questions for the given test
    private func generateQuestions(for test: Test) {
        questions = []
        
        switch test.type {
        case .identifyNote:
            // Generate random notes to identify
            for _ in 0..<test.questionCount {
                // Get a random fret and string
                let stringNumber = Int.random(in: 1...6)
                let fretNumber = Int.random(in: 0...12)
                
                let question = TestQuestion(
                    prompt: "What note is at string \(stringNumber), fret \(fretNumber)?",
                    type: .identifyNote(NotePosition(stringNumber: stringNumber, fretNumber: fretNumber))
                )
                questions.append(question)
            }
            
        case .findNote:
            // Generate find-all-notes questions for each note name
            for noteName in Note.noteNames {
                let question = TestQuestion(
                    prompt: "Find all \(noteName) notes on the fretboard",
                    type: .findNote(noteName)
                )
                questions.append(question)
            }
            
            // Shuffle and limit to the test's question count
            questions.shuffle()
            if questions.count > test.questionCount {
                questions = Array(questions.prefix(test.questionCount))
            }
        }
        
        // Update max score
        maxScore = questions.count
    }
    
    /// Display a question at the given index
    private func showQuestion(at index: Int) {
        guard index < questions.count else { return }
        
        currentQuestionIndex = index
        currentQuestion = questions[index]
        testProgress = Double(index) / Double(questions.count)
        
        // For find-note questions, highlight the target notes
        if case .findNote(let targetNote) = currentQuestion?.type {
            _ = Note.allNotes.filter { 
                $0.name == targetNote && $0.fretNumber <= 12 
            }
            // Don't actually highlight them, as the user needs to find them
            fretboardViewModel.clearSelection()
        }
        // For identify-note questions, highlight the position
        else if case .identifyNote(let position) = currentQuestion?.type {
            fretboardViewModel.selectedNote = Note(
                stringNumber: position.stringNumber,
                fretNumber: position.fretNumber
            )
        }
    }
    
    /// Check if a tapped note is correct for a find-note question
    private func checkAnswer(note: Note, forTargetNote targetName: String) {
        let isCorrect = note.name == targetName
        processAnswer(isCorrect: isCorrect, forNote: note.name)
    }
    
    /// Process the result of an answer
    private func processAnswer(isCorrect: Bool, forNote noteName: String) {
        if isCorrect {
            score += 1
            userProgress.updateNoteAccuracy(noteName: noteName, correct: true)
        } else {
            userProgress.updateNoteAccuracy(noteName: noteName, correct: false)
        }
        
        // Automatically move to next question after a delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.nextQuestion()
        }
    }
}

// MARK: - Supporting Structures

/// Represents a test type
public struct Test: Identifiable {
    public let id = UUID()
    public let title: String
    public let description: String
    public let type: TestType
    public let questionCount: Int
    public let timeLimit: Int  // In seconds, 0 means no time limit
    public let difficulty: TestDifficulty
    
    public enum TestType {
        case identifyNote
        case findNote
    }
    
    public init(
        title: String,
        description: String,
        type: TestType,
        questionCount: Int = 10,
        timeLimit: Int = 0,
        difficulty: TestDifficulty = .medium
    ) {
        self.title = title
        self.description = description
        self.type = type
        self.questionCount = questionCount
        self.timeLimit = timeLimit
        self.difficulty = difficulty
    }
    
    /// Predefined tests
    public static let allTests: [Test] = [
        // Identify-note tests
        Test(
            title: "Beginner Note Identification",
            description: "Identify notes on the fretboard (first 5 frets)",
            type: .identifyNote,
            questionCount: 10,
            timeLimit: 60,
            difficulty: .easy
        ),
        
        Test(
            title: "Intermediate Note Identification",
            description: "Identify notes on the fretboard (all frets)",
            type: .identifyNote,
            questionCount: 20,
            timeLimit: 120,
            difficulty: .medium
        ),
        
        Test(
            title: "Speed Note Identification",
            description: "Quickly identify notes (timed challenge)",
            type: .identifyNote,
            questionCount: 30,
            timeLimit: 60,
            difficulty: .hard
        ),
        
        // Find-note tests
        Test(
            title: "Note Location - Easy",
            description: "Find specific notes on the fretboard (open strings)",
            type: .findNote,
            questionCount: 6,
            timeLimit: 60,
            difficulty: .easy
        ),
        
        Test(
            title: "Note Location - Medium",
            description: "Find specific notes on the fretboard (first 5 frets)",
            type: .findNote,
            questionCount: 10,
            timeLimit: 120,
            difficulty: .medium
        ),
        
        Test(
            title: "Note Location - Hard",
            description: "Find all occurrences of notes (all frets)",
            type: .findNote,
            questionCount: 12,
            timeLimit: 180,
            difficulty: .hard
        )
    ]
}

/// Represents a test question
public struct TestQuestion {
    public let prompt: String
    public let type: QuestionType
    
    public enum QuestionType {
        case identifyNote(NotePosition)
        case findNote(String)
    }
}

/// Represents a position on the fretboard
public struct NotePosition: Equatable {
    public let stringNumber: Int
    public let fretNumber: Int
} 
