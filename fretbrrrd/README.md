## Human message

It got so scary good that I decided I'll see you all in the App Store. Here's a couple of screenshots of early buggy builds for the reference.

![Init build iOS](./Screenshot%202025-04-15%20at%209.38.06 PM.png "")
![Natural/all notes switch on MacOS](./Screenshot%202025-04-18%20at%2010.39.06 AM.png "")


# Fretbrrd

A cross-platform guitar learning app built with SwiftUI that helps users memorize the fretboard through interactive lessons and tests.

## Features

- Interactive fretboard visualization
- Learning mode with guided lessons
- Test mode with various quiz types
- Progress tracking
- Support for both left and right-handed players
- Cross-platform support (iOS, iPadOS, macOS, watchOS, visionOS)

## Project Structure

```
Fretbrrd/
├── Models/
│   ├── Note.swift
│   └── UserSettings.swift
├── Views/
│   ├── FretboardView.swift
│   ├── LearningModeView.swift
│   ├── TestModeView.swift
│   └── SettingsView.swift
└── FretbrrdApp.swift
```

## Requirements

- Swift 6.1
- Xcode 16.3
- iOS 17.0+
- macOS 14.0+
- watchOS 10.0+
- visionOS 1.0+

## Setup

1. Clone the repository
2. Open `Fretbrrd.xcodeproj` in Xcode
3. Select your target platform
4. Build and run

## Architecture

The app follows the MVVM (Model-View-ViewModel) architecture pattern:

- **Models**: Core data structures and business logic
- **Views**: SwiftUI views for the user interface
- **ViewModels**: State management and business logic for views

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 