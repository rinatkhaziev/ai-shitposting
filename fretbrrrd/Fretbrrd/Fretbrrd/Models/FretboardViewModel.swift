import Foundation
import Combine
import SwiftUI

/// ViewModel for the fretboard, handling state and logic
public class FretboardViewModel: ObservableObject {
    // Fretboard state
    @Published public var selectedNote: Note?
    @Published public var highlightedNotes: Set<Note> = []
    @Published public var visibleFrets: ClosedRange<Int> = 0...12  // Default visible fret range
    @Published public var showOnlyNaturalNotes: Bool = false  // Whether to show only natural notes
    
    // Computed properties for fret display
    public var visibleFretCount: Int {
        return visibleFrets.upperBound - visibleFrets.lowerBound + 1
    }
    
    public var visibleFretArray: [Int] {
        return Array(visibleFrets)
    }
    
    // User settings reference
    private var userSettings: UserSettings
    private var userProgress: UserProgress
    
    // Cancellable subscriptions
    private var cancellables = Set<AnyCancellable>()
    
    public init(userSettings: UserSettings, userProgress: UserProgress) {
        self.userSettings = userSettings
        self.userProgress = userProgress
        self.showOnlyNaturalNotes = userSettings.showOnlyNaturalNotes
        
        setupSubscriptions()
    }
    
    private func setupSubscriptions() {
        // Respond to changes in user settings
        userSettings.$isLeftHanded
            .sink { [weak self] _ in
                // Perform any necessary updates when handedness changes
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)
            
        // Respond to changes in the natural notes preference
        userSettings.$showOnlyNaturalNotes
            .removeDuplicates() // Only respond to actual changes
            .sink { [weak self] showNatural in
                guard let self = self else { return }
                // This is critical - update our local state from UserSettings
                if self.showOnlyNaturalNotes != showNatural {
                    self.showOnlyNaturalNotes = showNatural
                    // Force view refresh when the setting changes
                    self.objectWillChange.send()
                }
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Actions
    
    /// Handle tap on a note
    public func onNoteTap(_ note: Note) {
        selectedNote = note
        
        // Find all notes with the same pitch class
        if userSettings.showIntervals {
            highlightSamePitchClassNotes(note)
        }
    }
    
    /// Clear all highlights and selections
    public func clearSelection() {
        selectedNote = nil
        highlightedNotes = []
    }
    
    /// Set the visible fret range
    public func setVisibleFrets(range: ClosedRange<Int>) {
        visibleFrets = range
    }
    
    /// Toggle display of only natural notes
    public func toggleOnlyNaturalNotes() {
        showOnlyNaturalNotes.toggle()
        // Update UserSettings (will sync to UserDefaults via didSet)
        userSettings.showOnlyNaturalNotes = showOnlyNaturalNotes
        // Force view refresh
        objectWillChange.send()
    }
    
    // MARK: - Helper Methods
    
    /// Highlight all notes with the same pitch class
    private func highlightSamePitchClassNotes(_ note: Note) {
        highlightedNotes = Set(Note.allNotes.filter { $0.isSamePitchClass(as: note) })
    }
    
    /// Get all notes currently visible on the fretboard
    public func visibleNotes() -> [Note] {
        let notes = Note.allNotes.filter { 
            visibleFrets.lowerBound <= $0.fretNumber && 
            visibleFrets.upperBound >= $0.fretNumber
        }
        
        // If we're only showing natural notes, apply that filter
        if showOnlyNaturalNotes {
            return notes.filter { $0.isNatural }
        }
        
        return notes
    }
    
    /// Check if a note should be visually highlighted
    public func isNoteHighlighted(_ note: Note) -> Bool {
        return highlightedNotes.contains { $0.stringNumber == note.stringNumber && $0.fretNumber == note.fretNumber }
    }
    
    /// Get color for a note based on its pitch class and state
    public func colorForNote(_ note: Note, isSelected: Bool = false) -> Color {
        if isSelected || isNoteHighlighted(note) {
            return .blue.opacity(0.8)  // Highlighted state
        }
        
        // Standard color based on pitch class
        switch note.pitchClass {
        case 0: return .red        // C
        case 1: return .orange     // C#/Db
        case 2: return .yellow     // D
        case 3: return .green      // D#/Eb
        case 4: return .blue       // E
        case 5: return .purple     // F
        case 6: return .pink       // F#/Gb
        case 7: return .red        // G
        case 8: return .orange     // G#/Ab
        case 9: return .yellow     // A
        case 10: return .green     // A#/Bb
        case 11: return .blue      // B
        default: return .gray
        }
    }
} 