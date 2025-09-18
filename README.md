# 🎵 SoundWave Music Player

<div align="center">

![SoundWave Logo](https://img.shields.io/badge/SoundWave-Music%20Player-FF6B9D?style=for-the-badge&logo=spotify&logoColor=white)

**A Professional-Grade Web Music Player with Spotify Integration**

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)](https://html.spec.whatwg.org/)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)](https://www.w3.org/Style/CSS/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://www.javascript.com/)
[![Spotify API](https://img.shields.io/badge/Spotify-1DB954?style=flat-square&logo=spotify&logoColor=white)](https://developer.spotify.com/)
[![IndexedDB](https://img.shields.io/badge/IndexedDB-FF6B35?style=flat-square&logo=firefox&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

| [📖 Documentation](#features) | [🛠️ Installation](#installation) | 

</div>

---

## ✨ Overview

**SoundWave** is a cutting-edge, professional music player built entirely with modern web technologies. Combining sleek design with powerful functionality, it offers a premium music streaming experience that rivals native applications.

### 🏆 Why SoundWave?

- **🎯 Professional-Grade**: Built with enterprise-level code architecture
- **🔊 Multiple Sources**: Supports local files, Spotify streaming, and web audio
- **🎮 Full Control**: Complete playback controls with real-time synchronization
- **📱 Responsive**: Pixel-perfect design across all devices
- **⚡ Performance**: Optimized for speed and smooth user experience

---

## 🚀 Key Features

### 🎵 **Audio Playback & Control**
- **Multi-Source Support**: Local files (MP3, WAV, FLAC) + Spotify integration
- **Professional Controls**: Play, pause, next, previous, shuffle, repeat
- **Smart Seeking**: Forward/backward skip with real-time progress tracking
- **Volume Management**: Smooth volume control with visual feedback
- **Keyboard Shortcuts**: Full keyboard navigation support

### 🎧 **Spotify Integration**
- **Web Playback SDK**: Full track streaming for Spotify Premium users
- **Connect Integration**: Appears as official Spotify Connect device
- **Smart Fallback**: Automatic preview mode for free users
- **Real-time Sync**: Live playback state synchronization
- **Enhanced Search**: Browse and add tracks directly from Spotify

### 📚 **Library Management**
- **Smart Playlists**: Create and manage custom playlists
- **File Upload**: Drag-and-drop local music files
- **Search & Filter**: Advanced filtering by source, artist, album
- **Persistent Storage**: IndexedDB for offline playlist management
- **Metadata Extraction**: Automatic song information parsing

### 🎨 **User Experience**
- **Modern UI/UX**: Clean, intuitive interface with smooth animations
- **Dark/Light Themes**: Automatic theme switching with user preference
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Visual Feedback**: Interactive elements with hover states and transitions
- **Real-time Visualizer**: Dynamic audio visualization

### 🛠️ **Developer Features**
- **Clean Architecture**: Modular, maintainable code structure
- **Cross-Browser Support**: Works on all modern browsers
- **Performance Optimized**: Debounced operations and efficient rendering
- **Error Handling**: Graceful fallbacks and user-friendly error messages
- **Extensible Design**: Easy to add new features and integrations

---

## 🛠️ Technology Stack

<div align="center">

| Frontend | Backend | APIs | Storage |
|----------|---------|------|---------|
| ![HTML5](https://img.shields.io/badge/-HTML5-E34F26?style=flat-square&logo=html5&logoColor=white) | ![Node.js](https://img.shields.io/badge/-Node.js-339933?style=flat-square&logo=node.js&logoColor=white) | ![Spotify](https://img.shields.io/badge/-Spotify%20API-1DB954?style=flat-square&logo=spotify&logoColor=white) | ![IndexedDB](https://img.shields.io/badge/-IndexedDB-FF6B35?style=flat-square&logo=firefox&logoColor=white) |
| ![CSS3](https://img.shields.io/badge/-CSS3-1572B6?style=flat-square&logo=css3&logoColor=white) | ![Express](https://img.shields.io/badge/-Express-000000?style=flat-square&logo=express&logoColor=white) | ![Web Audio](https://img.shields.io/badge/-Web%20Audio%20API-FF6B9D?style=flat-square&logo=webaudio&logoColor=white) | ![Local Storage](https://img.shields.io/badge/-Local%20Storage-FFA500?style=flat-square&logo=html5&logoColor=white) |
| ![JavaScript](https://img.shields.io/badge/-JavaScript%20ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black) | ![File System](https://img.shields.io/badge/-File%20System-4285F4?style=flat-square&logo=files&logoColor=white) | ![OAuth 2.0](https://img.shields.io/badge/-OAuth%202.0-3C99DC?style=flat-square&logo=oauth&logoColor=white) | ![Blob Storage](https://img.shields.io/badge/-Blob%20Storage-0078D4?style=flat-square&logo=microsoftazure&logoColor=white) |

</div>

---

## ⚡ Installation

### 🔧 Prerequisites

- Modern web browser (Chrome 80+, Firefox 75+, Safari 13+, Edge 80+)
- Spotify Developer Account (for Spotify features)
- Web server (for local development)

### 📦 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/soundwave-music-player.git

# Navigate to project directory
cd soundwave-music-player

# Start local server (Python example)
python -m http.server 8000

# Or use Node.js
npx serve .

# Open in browser
open http://localhost:8000
```

### 🔑 Spotify Setup

1. **Create Spotify App**:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create new app with following settings:
   - **Redirect URIs**: `http://localhost:8000`, `http://127.0.0.1:8000`
   - **Scopes**: `streaming`, `user-read-email`, `user-read-private`, `user-read-playback-state`, `user-modify-playback-state`

2. **Configure Client ID**:
   ```javascript
   // In app.js, update SPOTIFY_CONFIG
   const SPOTIFY_CONFIG = {
       clientId: 'YOUR_SPOTIFY_CLIENT_ID_HERE',
       redirectUri: 'http://localhost:8000',
       // ... other config
   };
   ```

3. **Add SDK Script**:
   ```html
   <!-- Add before closing </body> tag -->
   <script src="https://sdk.scdn.co/spotify-player.js"></script>
   ```

---

## 🎮 Usage

### 🚀 Getting Started

1. **Launch the app** in your browser
2. **Connect Spotify** (optional) for streaming capabilities
3. **Upload music files** or search Spotify tracks
4. **Create playlists** and organize your music
5. **Enjoy high-quality music** streaming!

### ⌨️ Keyboard Shortcuts

| Key | Action | Key | Action |
|-----|--------|-----|--------|
| `Space` | Play/Pause | `M` | Mute/Unmute |
| `←` | Previous Track | `→` | Next Track |
| `Shift + ←` | Skip Back 10s | `Shift + →` | Skip Forward 10s |
| `↑` | Volume Up | `↓` | Volume Down |
| `S` | Toggle Shuffle | `R` | Toggle Repeat |
| `J` | Skip Back 5s | `L` | Skip Forward 5s |
| `0-9` | Set Volume (0-100%) | `F` | Toggle Fullscreen |

### 🎵 Features Guide

#### **Local Music Upload**
- Drag and drop audio files directly into the player
- Supports MP3, WAV, FLAC, and more
- Automatic metadata extraction
- Persistent storage in browser

#### **Spotify Integration**
- **Premium Users**: Full track streaming with Web Playback SDK
- **Free Users**: 30-second preview mode
- Real-time playback synchronization
- Appears in Spotify Connect devices

#### **Playlist Management**
- Create unlimited custom playlists
- Mix local and Spotify tracks
- Search and filter functionality
- Persistent storage across sessions

---

## 🏗️ Architecture

### 📁 Project Structure

```
soundwave-music-player/
├── index.html              # Main HTML structure
├── style.css              # Complete styling and themes
├── app.js                 # Core application logic
├── README.md              # Project documentation

```

### 🔧 Core Components

#### **MusicPlayer Class**
- **Purpose**: Main application controller
- **Features**: Playback management, UI updates, event handling
- **Methods**: `play()`, `pause()`, `nextSong()`, `previousSong()`, `loadSong()`

#### **SpotifyAPI Class**
- **Purpose**: Spotify Web API integration
- **Features**: Authentication, search, Web Playback SDK
- **Methods**: `authenticate()`, `searchTracks()`, `playTrack()`, `togglePlayback()`

#### **ThemeUtil Object**
- **Purpose**: Theme management system
- **Features**: Dark/light mode, user preferences
- **Methods**: `setTheme()`, `toggleTheme()`, `initTheme()`

### 🔄 Data Flow

1. **User Interaction** → UI Event Handler
2. **Event Handler** → MusicPlayer Controller
3. **Controller** → Audio Engine / Spotify API
4. **Response** → UI Update / State Management
5. **Persistence** → IndexedDB Storage

---

## 🌟 Advanced Features

### 🎯 Smart Playback
- **Automatic Fallbacks**: Seamlessly switches between Spotify SDK, preview URLs, and local files
- **Cross-Device Sync**: Real-time synchronization across devices via Spotify Connect
- **Optimistic UI Updates**: Instant visual feedback while operations process in background

### 🔍 Enhanced Search
- **Multi-Source Search**: Search across local library and Spotify simultaneously
- **Intelligent Filtering**: Filter by source, artist, album, genre
- **Fuzzy Matching**: Find tracks even with partial or misspelled queries

### 🎨 Customization
- **Theme System**: Dynamic dark/light theme switching with CSS custom properties
- **Responsive Layout**: Optimized layouts for desktop, tablet, and mobile devices
- **Visual Feedback**: Smooth animations and transitions for all user interactions

---

## 🚀 Performance

### ⚡ Optimization Features

- **Lazy Loading**: Audio files loaded only when needed
- **Debounced Operations**: Prevents rapid-fire API calls and UI updates
- **Efficient Rendering**: Optimized DOM updates with minimal reflows
- **Memory Management**: Proper cleanup of audio resources and event listeners

### 📊 Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 80+ | ✅ Full Support |
| Firefox | 75+ | ✅ Full Support |
| Safari | 13+ | ✅ Full Support |
| Edge | 80+ | ✅ Full Support |
| Mobile Safari | 13+ | ✅ Responsive |
| Chrome Mobile | 80+ | ✅ Responsive |

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### 🔧 Development Setup

```bash
# Fork the repository
git clone https://github.com/yourusername/soundwave-music-player.git

# Create feature branch
git checkout -b feature/amazing-feature

# Make your changes
# ... code, code, code ...

# Commit changes
git commit -m "Add amazing feature"

# Push to branch
git push origin feature/amazing-feature

# Open Pull Request
```

### 📋 Contribution Guidelines

- **Code Style**: Follow existing patterns and conventions
- **Testing**: Test across multiple browsers and devices
- **Documentation**: Update README and comments as needed
- **Commits**: Use clear, descriptive commit messages
- **Issues**: Reference relevant issues in pull requests

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 SoundWave Music Player

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

## 🙏 Acknowledgments

### 🛠️ Built With Love By

- **Developer**: G. Meher Prateek(https://github.com/Prateek05-coder)
- **Company**: [HexSoftwares](https://hexsoftwares.com)
- **Year**: 2025

### 🌟 Special Thanks

- **Spotify** for their amazing Web API and Playback SDK
- **MDN Web Docs** for comprehensive web API documentation
- **Font Awesome** for beautiful icons
- **The Web Audio Community** for inspiration and best practices

### 🎵 Music Industry Support

This project supports artists and the music industry by:
- Encouraging legitimate music streaming through Spotify
- Respecting copyright and licensing agreements
- Promoting legal music consumption

---

## 📞 Support & Contact

<div align="center">

### 🌐 **Links**
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/prateek05-coder/soundwave-music-player)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/g-meher-prateek)

### 📧 **Get in Touch**

**Email**: meherprateekg@gmail.com   
**Website**: [https://Prateek.com](https://prateek](https://prateek05-coder.github.io/))

</div>

---

<div align="center">

### 🌟 **Show Your Support**

If you found this project helpful, please consider:

[![Star on GitHub](https://img.shields.io/github/stars/prateek05-coder/soundwave-music-player?style=social)](https://github.com/prateek05-coder/soundwave-music-player/stargazers)
[![Fork on GitHub](https://img.shields.io/github/forks/prateek05-coder/soundwave-music-player?style=social)](https://github.com/prateek05-coder/soundwave-music-player/network/members)
[![Follow on GitHub](https://img.shields.io/github/followers/prateek05-coder?style=social)](https://github.com/prateek05-coder)

**⭐ Star the repository** | **🍴 Fork the project** | **🐛 Report bugs** | **💡 Request features**

---

### 🎵 *"Music is the universal language of mankind"* 🎵

**Made with ❤️ by developers, for music lovers worldwide**

</div>
