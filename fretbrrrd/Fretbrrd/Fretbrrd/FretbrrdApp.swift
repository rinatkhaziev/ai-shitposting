//
//  FretbrrdApp.swift
//  Fretbrrd
//
//  Created by Rinat K on 4/15/25.
//

import SwiftUI

@main
struct FretbrrdApp: App {
    @StateObject private var userSettings = UserSettings()
    @StateObject private var userProgress = UserProgress()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(userSettings)
                .environmentObject(userProgress)
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(UserSettings())
        .environmentObject(UserProgress())
}
