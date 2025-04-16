import Foundation
import SwiftUI

/// Represents a note on the guitar fretboard
public struct Note: Identifiable, Hashable {
    public let id = UUID()
    public let name: String
    public let stringNumber: Int
    public let fretNumber: Int
    public let pitchClass: Int // 0-11 representing C through B
    
    /// Standard tuning notes (EADGBE)
    public static let standardTuning = ["E", "A", "D", "G", "B", "E"]
    
    /// All possible note names
    public static let noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    
    /// Interval names (from C as root)
    private static let intervalNames = ["Root", "m2", "M2", "m3", "M3", "P4", "Tritone", "P5", "m6", "M6", "m7", "M7"]
    
    /// The interval name relative to C as the root
    public var interval: String {
        return Note.intervalNames[pitchClass]
    }
    
    /// Computed property that returns all notes on the fretboard (standard tuning)
    public static var allNotes: [Note] {
        var notes = [Note]()
        // For each string (1-6)
        for stringNum in 1...6 {
            // For each fret (0-24)
            for fretNum in 0...24 {
                notes.append(Note(stringNumber: stringNum, fretNumber: fretNum))
            }
        }
        return notes
    }
    
    /// Creates a note from string and fret numbers
    public init(stringNumber: Int, fretNumber: Int) {
        self.stringNumber = stringNumber
        self.fretNumber = fretNumber
        
        // Calculate pitch class based on standard tuning
        let openNoteIndex = (Note.noteNames.firstIndex(of: Note.standardTuning[stringNumber - 1]) ?? 0)
        let pitchClass = (openNoteIndex + fretNumber) % 12
        self.pitchClass = pitchClass
        self.name = Note.noteNames[pitchClass]
    }
    
    /// Checks if two notes are the same pitch class (e.g., E2 and E4)
    public func isSamePitchClass(as other: Note) -> Bool {
        return pitchClass == other.pitchClass
    }
    
    /// Calculates the distance in semitones to another note
    public func distanceTo(_ other: Note) -> Int {
        let stringDiff = (other.stringNumber - stringNumber) * 5 // Approximate semitones per string
        let fretDiff = other.fretNumber - fretNumber
        return stringDiff + fretDiff
    }
    
    /// Returns the interval name between this note and another note
    public func intervalTo(_ other: Note) -> String {
        let semitones = (other.pitchClass - pitchClass + 12) % 12
        return Note.intervalNames[semitones]
    }
    
    // Hashable conformance
    public func hash(into hasher: inout Hasher) {
        hasher.combine(stringNumber)
        hasher.combine(fretNumber)
    }
    
    public static func == (lhs: Note, rhs: Note) -> Bool {
        return lhs.stringNumber == rhs.stringNumber && lhs.fretNumber == rhs.fretNumber
    }
} 
