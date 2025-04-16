import SwiftUI

// Constants for fretboard layout
private enum FretboardLayout {
    static let stringCount = 6
    static let fretCount = 24
}

public struct FretboardView: View {
    @EnvironmentObject var settings: UserSettings
    @EnvironmentObject var viewModel: FretboardViewModel
    
    // Optional overrides for specific views
    let isLeftHanded: Bool?
    let showNoteNames: Bool?
    let showIntervals: Bool?
    
    public init(
        isLeftHanded: Bool? = nil,
        showNoteNames: Bool? = nil,
        showIntervals: Bool? = nil
    ) {
        self.isLeftHanded = isLeftHanded
        self.showNoteNames = showNoteNames
        self.showIntervals = showIntervals
    }
    
    private var effectiveLeftHanded: Bool {
        return isLeftHanded ?? settings.isLeftHanded
    }
    
    private var effectiveShowNoteNames: Bool {
        return showNoteNames ?? settings.showNoteNames
    }
    
    private var effectiveShowIntervals: Bool {
        return showIntervals ?? settings.showIntervals
    }
    
    public var body: some View {
        GeometryReader { geometry in
            let fretboardWidth = geometry.size.width
            let fretboardHeight = geometry.size.height
            let stringSpacing = fretboardHeight / CGFloat(FretboardLayout.stringCount - 1)
            let fretWidth = fretboardWidth / CGFloat(viewModel.visibleFretCount)
            
            ZStack {
                // Fretboard background
                Rectangle()
                    .fill(Color(.systemGray6))
                
                // Strings
                ForEach(0..<FretboardLayout.stringCount, id: \.self) { stringIndex in
                    let y = CGFloat(stringIndex) * stringSpacing
                    Rectangle()
                        .fill(Color.gray)
                        .frame(width: fretboardWidth, height: 1 + (stringIndex == 0 || stringIndex == 5 ? 1 : 0))
                        .position(x: fretboardWidth / 2, y: y)
                }
                
                // Frets
                ForEach(Array(viewModel.visibleFretArray.enumerated()), id: \.element) { index, fretNumber in
                    let x = CGFloat(index) * fretWidth
                    Rectangle()
                        .fill(Color.gray)
                        .frame(width: 2, height: fretboardHeight)
                        .position(x: x, y: fretboardHeight / 2)
                }
                
                // Fret markers (dots at frets 3, 5, 7, 9, 12, etc.)
                ForEach([3, 5, 7, 9, 12, 15, 17, 19, 21, 24], id: \.self) { fretNumber in
                    if viewModel.visibleFrets.lowerBound <= fretNumber && viewModel.visibleFrets.upperBound >= fretNumber {
                        let fretPosition = fretNumber - viewModel.visibleFrets.lowerBound
                        let x = (CGFloat(fretPosition) + 0.5) * fretWidth
                        
                        if fretNumber == 12 || fretNumber == 24 {
                            // Double dot for 12th and 24th fret
                            VStack(spacing: fretboardHeight / 3) {
                                Circle()
                                    .fill(Color.gray.opacity(0.5))
                                    .frame(width: 10, height: 10)
                                Circle()
                                    .fill(Color.gray.opacity(0.5))
                                    .frame(width: 10, height: 10)
                            }
                            .position(x: x, y: fretboardHeight / 2)
                        } else {
                            // Single dot for other marked frets
                            Circle()
                                .fill(Color.gray.opacity(0.5))
                                .frame(width: 10, height: 10)
                                .position(x: x, y: fretboardHeight / 2)
                        }
                    }
                }
                
                // Notes
                ForEach(viewModel.visibleNotes()) { note in
                    if viewModel.visibleFrets.lowerBound <= note.fretNumber && viewModel.visibleFrets.upperBound >= note.fretNumber {
                        let fretPosition = note.fretNumber - viewModel.visibleFrets.lowerBound
                        let noteX = (CGFloat(fretPosition) + 0.5) * fretWidth
                        let noteY = CGFloat(note.stringNumber - 1) * stringSpacing
                        
                        let isSelected = viewModel.selectedNote?.stringNumber == note.stringNumber && 
                                         viewModel.selectedNote?.fretNumber == note.fretNumber
                        
                        let isHighlighted = viewModel.isNoteHighlighted(note)
                        
                        ZStack {
                            // Note circle
                            Circle()
                                .fill(viewModel.colorForNote(note, isSelected: isSelected))
                                .frame(width: min(stringSpacing, fretWidth) * 0.8)
                            
                            // Note name label
                            if effectiveShowNoteNames || isSelected {
                                Text(note.name)
                                    .font(.caption)
                                    .foregroundColor(.white)
                                    .fontWeight(isSelected ? .bold : .regular)
                            }
                            
                            // Interval label (below note name)
                            if effectiveShowIntervals && (isSelected || viewModel.selectedNote != nil) {
                                Text(viewModel.selectedNote?.intervalTo(note) ?? "")
                                    .font(.caption2)
                                    .foregroundColor(.white)
                                    .offset(y: 12)
                            }
                        }
                        .position(x: noteX, y: noteY)
                        .onTapGesture {
                            viewModel.onNoteTap(note)
                        }
                        .scaleEffect(isSelected || isHighlighted ? 1.2 : 1.0)
                        .animation(.spring(), value: isSelected || isHighlighted)
                    }
                }
            }
            .rotationEffect(.degrees(effectiveLeftHanded ? 180 : 0))
        }
    }
}

#Preview {
    let userSettings = UserSettings()
    let userProgress = UserProgress()
    let fretboardViewModel = FretboardViewModel(userSettings: userSettings, userProgress: userProgress)
    
    FretboardView()
        .environmentObject(userSettings)
        .environmentObject(fretboardViewModel)
        .frame(width: 400, height: 300)
} 