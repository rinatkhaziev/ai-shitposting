//
//  ContentView.swift
//  Fretbrrd
//
//  Created by Rinat K on 4/15/25.
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var userSettings: UserSettings
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            LearningModeView()
                .tabItem {
                    Label("Learn", systemImage: "book.fill")
                }
                .tag(0)
            
            TestModeView()
                .tabItem {
                    Label("Test", systemImage: "checkmark.circle.fill")
                }
                .tag(1)
            
            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(2)
        }
        .environmentObject(userSettings)
    }
}

#Preview {
    ContentView()
        .environmentObject(UserSettings())
}
