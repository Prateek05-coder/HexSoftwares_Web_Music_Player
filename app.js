const SPOTIFY_CONFIG = {
    clientId: 'c20e547c138f45419ca85b1020f795e8',
    redirectUri: 'http://127.0.0.1:5500/',
    scopes: [
        'streaming',                    
        'user-read-email',
        'user-read-private',
        'user-read-playback-state',     
        'user-modify-playback-state',   
        'playlist-read-private',
        'user-library-read'
    ],
    apiUrl: 'https://api.spotify.com/v1',
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token'
};

const ThemeUtil = {
    getStoredTheme() { return localStorage.getItem('soundwave-theme') || null; },
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-color-scheme', theme);
        localStorage.setItem('soundwave-theme', theme);
        
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            const i = toggleBtn.querySelector('i');
            if (i) i.className = (theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon');
        }
        
        if (window.musicPlayerInstance && window.musicPlayerInstance.showToast) {
            window.musicPlayerInstance.showToast(`Switched to ${theme} theme`, 'info');
        }
    },
    toggleTheme() {
        const curr = document.documentElement.getAttribute('data-theme') || 'light';
        this.setTheme(curr === 'dark' ? 'light' : 'dark');
    },
    initTheme() {
        const stored = this.getStoredTheme();
        if (stored) {
            this.setTheme(stored);
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setTheme(prefersDark ? 'dark' : 'light');
        }
    }
};

let spotifyToken = null;
let spotifyTokenExpiry = 0;
let spotifyRefreshToken = null;

const setSpotifyToken = (access, expires, refresh) => {
    spotifyToken = access;
    spotifyRefreshToken = refresh;
    spotifyTokenExpiry = expires ? Date.now() + (expires * 1000) : 0;
};

const isSpotifyTokenValid = () => spotifyToken && Date.now() < spotifyTokenExpiry - 60000;
class SpotifyAPI {
    constructor(config) {
        this.config = config;
        this.player = null;
        this.device_id = null;
        this.playerReady = false;
    }

    async authenticate() {
        const params = new URLSearchParams(window.location.search);
        const error = params.get('error');
        const code = params.get('code');
        const state = params.get('state');

        if (error) {
            if (window.musicPlayerInstance && window.musicPlayerInstance.showToast) {
                window.musicPlayerInstance.showToast(`Spotify authentication cancelled: ${error}`, 'warning');
            }
            this.cleanupOAuth();
            return false;
        }

        if (code && state) {
            const savedState = localStorage.getItem('spotify_auth_state');
            if (state !== savedState) {
                if (window.musicPlayerInstance && window.musicPlayerInstance.showToast) {
                    window.musicPlayerInstance.showToast('Spotify authentication failed: Invalid state', 'error');
                }
                this.cleanupOAuth();
                return false;
            }
            await this.exchangeCodeForToken(code);
            this.cleanupOAuth();
            return true;
        }
        return false;
    }

    cleanupOAuth() {
        window.history.replaceState({}, '', window.location.pathname);
        localStorage.removeItem('spotify_pkce_verifier');
        localStorage.removeItem('spotify_auth_state');
    }

    startOAuthFlow() {
        if (this.config.clientId === 'YOUR_SPOTIFY_CLIENT_ID') {
            if (window.musicPlayerInstance && window.musicPlayerInstance.showToast) {
                window.musicPlayerInstance.showToast('Using demo mode with sample tracks', 'info');
            }
            setTimeout(() => {
                if (window.musicPlayerInstance) {
                    window.musicPlayerInstance.setSpotifyConnected(true);
                    window.musicPlayerInstance.showToast('Demo mode: Sample tracks ready', 'info');
                }
            }, 1000);
            return;
        }

        try {
            const codeVerifier = SpotifyAPI.generateRandomString(128);
            localStorage.setItem('spotify_pkce_verifier', codeVerifier);

            SpotifyAPI.generateCodeChallenge(codeVerifier).then(codeChallenge => {
                const state = SpotifyAPI.generateRandomString(16);
                localStorage.setItem('spotify_auth_state', state);

                const params = new URLSearchParams({
                    client_id: this.config.clientId,
                    response_type: 'code',
                    redirect_uri: this.config.redirectUri,
                    scope: this.config.scopes.join(' '),
                    code_challenge_method: 'S256',
                    code_challenge: codeChallenge,
                    state
                });

                const url = `${this.config.authUrl}?${params}`;
                window.location.assign(url);
            });
        } catch (error) {
            if (window.musicPlayerInstance && window.musicPlayerInstance.showToast) {
                window.musicPlayerInstance.showToast('Error starting Spotify authentication', 'error');
            }
        }
    }

    async exchangeCodeForToken(code) {
        const verifier = localStorage.getItem('spotify_pkce_verifier');
        if (!verifier) {
            if (window.musicPlayerInstance && window.musicPlayerInstance.showToast) {
                window.musicPlayerInstance.showToast('Missing verification code', 'error');
            }
            return;
        }

        try {
            if (window.musicPlayerInstance && window.musicPlayerInstance.showLoading) {
                window.musicPlayerInstance.showLoading('Connecting to Spotify...');
            }

            const body = new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.config.redirectUri,
                client_id: this.config.clientId,
                code_verifier: verifier
            });

            const response = await fetch(this.config.tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body
            });

            const json = await response.json();

            if (json.access_token) {
                setSpotifyToken(json.access_token, json.expires_in, json.refresh_token);
                
                await this.initializeWebPlaybackSDK();
                
                if (window.musicPlayerInstance) {
                    window.musicPlayerInstance.setSpotifyConnected(true);
                    window.musicPlayerInstance.showToast('Spotify connected successfully!', 'success');
                }
            } else {
                if (window.musicPlayerInstance && window.musicPlayerInstance.showToast) {
                    window.musicPlayerInstance.showToast('Spotify authentication failed', 'error');
                }
            }
        } catch (error) {
            if (window.musicPlayerInstance && window.musicPlayerInstance.showToast) {
                window.musicPlayerInstance.showToast('Error connecting to Spotify', 'error');
            }
        } finally {
            if (window.musicPlayerInstance && window.musicPlayerInstance.hideLoading) {
                window.musicPlayerInstance.hideLoading();
            }
        }
    }

    async initializeWebPlaybackSDK() {
        if (!window.Spotify || !spotifyToken) {
            console.log('Spotify SDK not loaded or no token available');
            return;
        }

        try {
            // Wait for SDK to be ready
            await new Promise(resolve => {
                if (window.onSpotifyWebPlaybackSDKReady) {
                    resolve();
                } else {
                    window.onSpotifyWebPlaybackSDKReady = resolve;
                }
            });

            this.player = new window.Spotify.Player({
                name: 'SoundWave Music Player',
                getOAuthToken: cb => { cb(spotifyToken); },
                volume: 0.5
            });

            this.player.addListener('initialization_error', ({ message }) => {
                console.error('Failed to initialize Spotify player:', message);
            });

            this.player.addListener('authentication_error', ({ message }) => {
                console.error('Failed to authenticate Spotify player:', message);
                if (window.musicPlayerInstance) {
                    window.musicPlayerInstance.showToast('Spotify authentication error', 'error');
                }
            });

            this.player.addListener('account_error', ({ message }) => {
                console.error('Failed to validate Spotify account:', message);
                if (window.musicPlayerInstance) {
                    window.musicPlayerInstance.showToast('Spotify Premium required for Web Playback', 'warning');
                }
            });

            this.player.addListener('playback_error', ({ message }) => {
                console.error('Failed to perform playback:', message);
            });
            this.player.addListener('player_state_changed', state => {
                if (!state) return;
                
                const track = state.track_window.current_track;
                const isPlaying = !state.paused;
                
                if (window.musicPlayerInstance) {
                    window.musicPlayerInstance.handleSpotifyStateChange(state, isPlaying);
                }
                
                console.log('Currently Playing:', track.name, 'by', track.artists.map(a => a.name).join(', '));
                console.log('Playing:', isPlaying);
            });

            this.player.addListener('ready', ({ device_id }) => {
                console.log('Spotify Web Playback SDK Ready with Device ID:', device_id);
                this.device_id = device_id;
                this.playerReady = true;
                
                if (window.musicPlayerInstance) {
                    window.musicPlayerInstance.showToast('🎵 Spotify Web Player Ready!', 'success');
                }
            });

            this.player.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline:', device_id);
                this.playerReady = false;
            });

            const success = await this.player.connect();
            
            if (success) {
                console.log('Successfully connected to Spotify Web Player');
            } else {
                console.error('Failed to connect to Spotify Web Player');
            }

        } catch (error) {
            console.error('Error initializing Spotify Web Playback SDK:', error);
        }
    }

    async playTrack(spotifyUri) {
        if (!this.playerReady || !this.device_id) {
            console.log('Spotify player not ready, falling back to preview');
            return false;
        }

        try {
            await fetch(`${this.config.apiUrl}/me/player`, {
                method: 'PUT',
                body: JSON.stringify({
                    device_ids: [this.device_id],
                    play: false,
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${spotifyToken}`
                },
            });

            // Play the track
            const response = await fetch(`${this.config.apiUrl}/me/player/play?device_id=${this.device_id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    uris: [spotifyUri]
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${spotifyToken}`
                },
            });

            if (response.ok) {
                console.log('Successfully started playback via Spotify Web API');
                return true;
            } else {
                console.error('Failed to start playback:', response.status, response.statusText);
                return false;
            }

        } catch (error) {
            console.error('Error playing track via Spotify Web API:', error);
            return false;
        }
    }

    
    async togglePlayback() {
        if (!this.playerReady) return false;
        
        try {
            await this.player.togglePlay();
            return true;
        } catch (error) {
            console.error('Error toggling playback:', error);
            return false;
        }
    }

    async nextTrack() {
        if (!this.playerReady) return false;
        
        try {
            await this.player.nextTrack();
            return true;
        } catch (error) {
            console.error('Error skipping to next track:', error);
            return false;
        }
    }

    async previousTrack() {
        if (!this.playerReady) return false;
        
        try {
            await this.player.previousTrack();
            return true;
        } catch (error) {
            console.error('Error skipping to previous track:', error);
            return false;
        }
    }

    async setVolume(volume) {
        if (!this.playerReady) return false;
        
        try {
            await this.player.setVolume(volume);
            return true;
        } catch (error) {
            console.error('Error setting volume:', error);
            return false;
        }
    }

    async getPlaybackState() {
        if (!this.playerReady) return null;
        
        try {
            const state = await this.player.getCurrentState();
            return state;
        } catch (error) {
            console.error('Error getting playback state:', error);
            return null;
        }
    }

    async searchTracks(query) {
        if (!spotifyToken && this.config.clientId === 'YOUR_SPOTIFY_CLIENT_ID') {
            return this.getMockSearchResults(query);
        }

        if (!spotifyToken) throw new Error('Spotify not authenticated');

        const response = await fetch(`${this.config.apiUrl}/search?q=${encodeURIComponent(query)}&type=track&limit=20`, {
            headers: { Authorization: `Bearer ${spotifyToken}` }
        });

        if (!response.ok) {
            if (response.status === 401) {
                if (window.musicPlayerInstance) {
                    window.musicPlayerInstance.showToast('Spotify session expired. Please reconnect.', 'warning');
                    window.musicPlayerInstance.setSpotifyConnected(false);
                }
                spotifyToken = null;
            }
            throw new Error('Spotify search failed');
        }

        return response.json();
    }

    getMockSearchResults(query) {
        
        const workingAudioUrls = [
            'https://www2.cs.uic.edu/~i101/SoundFiles/CantinaBand3.wav',
            'https://www2.cs.uic.edu/~i101/SoundFiles/StarWars3.wav',
            'https://www2.cs.uic.edu/~i101/SoundFiles/CantinaBand60.wav',
            'https://www2.cs.uic.edu/~i101/SoundFiles/ImperialMarch60.wav',
            'https://www2.cs.uic.edu/~i101/SoundFiles/taunt.wav'
        ];

        const mockTracks = [
            {
                id: 'demo_1',
                name: `${query} - Demo Track 1`,
                artists: [{ name: 'Demo Artist' }],
                album: { 
                    name: 'Demo Album', 
                    images: [{ url: this.getDefaultArtwork() }] 
                },
                duration_ms: 60000,
                preview_url: workingAudioUrls[0],
                external_urls: { spotify: '#' },
                uri: 'spotify:track:demo_1'
            },
            {
                id: 'demo_2',
                name: `${query} - Demo Track 2`,
                artists: [{ name: 'Sample Artist' }],
                album: { 
                    name: 'Sample Collection', 
                    images: [{ url: this.getDefaultArtwork() }] 
                },
                duration_ms: 45000,
                preview_url: workingAudioUrls[1],
                external_urls: { spotify: '#' },
                uri: 'spotify:track:demo_2'
            },
            {
                id: 'demo_3',
                name: `${query} (Extended Mix)`,
                artists: [{ name: 'Test Artist' }],
                album: { 
                    name: 'Test Album', 
                    images: [{ url: this.getDefaultArtwork() }] 
                },
                duration_ms: 180000,
                preview_url: workingAudioUrls[2],
                external_urls: { spotify: '#' },
                uri: 'spotify:track:demo_3'
            }
        ];

        return Promise.resolve({ tracks: { items: mockTracks } });
    }

    getDefaultArtwork() {
        return 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
                <rect width="300" height="300" fill="#ff6b9d"/>
                <text x="150" y="150" font-family="Arial" font-size="80" fill="white" text-anchor="middle" dy="20">♪</text>
            </svg>
        `);
    }

    static generateRandomString(length) {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let text = '';
        for (let i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    static async generateCodeChallenge(verifier) {
        function base64urlencode(str) {
            return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
                .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        }

        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return base64urlencode(digest);
    }
}

const DB_NAME = 'SoundWaveDB';
const DB_VERSION = 1;

class MusicPlayer {
    constructor() {
        this.currentSongIndex = 0;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.volume = 0.7;
        this.isMuted = false;
        this.isShuffling = false;
        this.repeatMode = 'none';
        this.isDragging = false;
        this.currentSource = 'all';
        this.searchQuery = '';
        
        // Playlists and songs
        this.playlists = new Map();
        this.currentPlaylistId = 'my-music';
        this.songs = [];
        this.filteredSongs = [];
        this.originalSongs = [];
        
        // Enhanced Spotify properties
        this.spotifyAccessToken = null;
        this.spotifyPlayer = null;
        this.isSpotifyConnected = false;
        this.spotifyApi = null;
        this.isUsingSpotifySDK = false; // NEW: Track if using Web Playback SDK
        
        // Audio context
        this.audioContext = null;
        this.currentAudioSource = null;
        
        // UI state
        this.isKeyboardShortcutsActive = true;
        this.simulationInterval = null;
        this.previousVolume = 0.7;
        this.progressInterval = null;
        
        // User interaction flag for autoplay
        this.userInteracted = false;
        
        // NEW: Flag to debounce playback commands for smooth operation
        this.isPlaybackCommandRunning = false;
        
        this.init();
    }

    async init() {
        try {
            this.setupElements();
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            this.startVisualizer();
            
            await this.initDB();
            await this.loadPlaylists();
            
            this.spotifyApi = new SpotifyAPI(SPOTIFY_CONFIG);
            this.checkSpotifyAuth();
            this.setupSpotifySDKReadyCallback();
            
            ThemeUtil.initTheme();
            this.showEmptyState();
            
            console.log('🎵 Complete Enhanced Music Player with Spotify Web Playback SDK initialized');
        } catch (error) {
            console.error('Error initializing music player:', error);
            this.showToast('Error initializing music player', 'error');
        }
    }
updatePlayOverlay() {
    const albumWrapper = document.querySelector('.album-art-wrapper');
    if (albumWrapper) {
        if (this.isPlaying) {
            albumWrapper.classList.add('playing');
        } else {
            albumWrapper.classList.remove('playing');
        }
    }
    
    const playIcon = document.querySelector('.play-overlay i');
    if (playIcon) {
        if (this.isPlaying) {
            playIcon.className = 'fas fa-pause';
        } else {
            playIcon.className = 'fas fa-play';
        }
    }
}
    setupSpotifySDKReadyCallback() {
        window.onSpotifyWebPlaybackSDKReady = () => {
            console.log('🎵 Spotify Web Playback SDK is ready');
            if (this.spotifyApi && spotifyToken) {
                this.spotifyApi.initializeWebPlaybackSDK();
            }
        };
    }
    handleSpotifyStateChange(state, isPlaying) {
        if (!state || !state.track_window.current_track) return;

        const track = state.track_window.current_track;
        
        // Update current song info
        this.isPlaying = isPlaying;
        this.currentTime = state.position / 1000; // Convert to seconds
        this.duration = state.duration / 1000; // Convert to seconds
        
        // Update UI
        this.updatePlayPauseButton();
        this.updateProgress();
        
        // Update now playing display
        if (this.songTitle) this.songTitle.textContent = track.name;
        if (this.songArtist) this.songArtist.textContent = track.artists.map(a => a.name).join(', ');
        if (this.songAlbum) this.songAlbum.textContent = track.album.name;
        if (this.albumArt && track.album.images[0]) {
            this.albumArt.src = track.album.images[0].url;
        }
        
        // Update source indicator
        if (this.songSource) {
            const sourceIcon = this.songSource.querySelector('i');
            const sourceText = this.songSource.querySelector('span');
            if (sourceIcon && sourceText) {
                sourceIcon.className = 'fab fa-spotify';
                sourceText.textContent = 'Spotify Web Player';
                this.songSource.classList.add('spotify');
            }
        }
        
        this.hideEmptyState();
        this.updatePlayOverlay();
        if (isPlaying) {
            this.startSpotifyProgressTracking();
        } else {
            this.stopProgressTracking();
        }
    }
    startSpotifyProgressTracking() {
        this.stopProgressTracking();
        this.progressInterval = setInterval(async () => {
            if (this.spotifyApi && this.spotifyApi.playerReady) {
                const state = await this.spotifyApi.getPlaybackState();
                if (state && !this.isDragging) {
                    this.currentTime = state.position / 1000;
                    this.duration = state.duration / 1000;
                    this.updateProgress();
                    
                    if (this.totalTimeEl) {
                        this.totalTimeEl.textContent = this.formatTime(this.duration);
                    }
                }
            }
        }, 1000);
    }
    async play() {
        if (!this.userInteracted) {
            this.showToast('Click anywhere first to enable audio playback', 'info');
            return;
        }

        if (this.filteredSongs.length === 0) {
            this.showToast('No songs available to play', 'warning');
            return;
        }

        const currentSong = this.filteredSongs[this.currentSongIndex];

        this.isPlaying = true;
        this.updatePlayPauseButton();

        if (
            currentSong &&
            currentSong.source === 'spotify' &&
            this.spotifyApi &&
            this.spotifyApi.playerReady &&
            currentSong.spotifyUri
        ) {
            try {
                if (this.isPlaybackCommandRunning) return;
                this.isPlaybackCommandRunning = true;

                const success = await this.spotifyApi.playTrack(currentSong.spotifyUri);

                if (!success) {
                    this.isUsingSpotifySDK = false;
                    await this.playLocalAudio(currentSong);
                } else {
                    this.isUsingSpotifySDK = true;
                    this.showToast(`🎵 Playing: ${currentSong.title}`, 'success');
                }
            } finally {
                this.isPlaybackCommandRunning = false;
            }
        } else {
            this.isUsingSpotifySDK = false;
            await this.playLocalAudio(currentSong);
        }

        if (this.isUsingSpotifySDK) {
            this.startSpotifyProgressTracking();
        } else {
            this.startProgressTracking();
        }
    }

    async playLocalAudio(song) {
        if (!song || !song.audioUrl) {
            this.showToast('No audio source for this song', 'error');
            return;
        }
        if (this.audio.src !== song.audioUrl) {
            this.audio.src = song.audioUrl;
            this.audio.load();
        }
        try {
            await this.audio.play();
            this.showToast(`♪ Now playing: ${song.title}`, 'success');
        } catch (err) {
            console.error('Audio playback failed:', err);
            this.showToast(`Audio blocked - using simulation for ${song?.title}`, 'info');
            this.simulatePlayback();
        }
    }

    async pause() {
        this.isPlaying = false;
        this.updatePlayPauseButton();

        if (this.isUsingSpotifySDK && this.spotifyApi && this.spotifyApi.playerReady) {
            if (this.isPlaybackCommandRunning) return;
            this.isPlaybackCommandRunning = true;
            try {
                const success = await this.spotifyApi.togglePlayback(); 
                if (!success && this.audio) this.audio.pause();
            } finally {
                this.isPlaybackCommandRunning = false;
            }
        } else {
            if (this.audio) this.audio.pause();
        }

        this.stopProgressTracking();
    }

async nextSong() {
    if (this.filteredSongs.length === 0) return;

    if (this.isUsingSpotifySDK && this.spotifyApi && this.spotifyApi.playerReady) {
        if (this.isPlaybackCommandRunning) return;
        this.isPlaybackCommandRunning = true;
        try {
            const success = await this.spotifyApi.nextTrack();
            if (success) return; // SDK handled it
        } catch (error) {
            console.log('Spotify SDK next failed, using fallback');
        } finally {
            this.isPlaybackCommandRunning = false;
        }
    }

    let nextIndex;
    if (this.isShuffling) {
        nextIndex = Math.floor(Math.random() * this.filteredSongs.length);
    } else {
        nextIndex = (this.currentSongIndex + 1) % this.filteredSongs.length;
    }
    
    this.currentSongIndex = nextIndex;
    this.loadSong(nextIndex);
    this.updatePlaylistHighlight();
    
    if (this.isPlaying) {
        setTimeout(() => this.play(), 200);
    }
}

async previousSong() {
    if (this.filteredSongs.length === 0) return;

    // Try Spotify SDK first
    if (this.isUsingSpotifySDK && this.spotifyApi && this.spotifyApi.playerReady) {
        if (this.isPlaybackCommandRunning) return;
        this.isPlaybackCommandRunning = true;
        try {
            const success = await this.spotifyApi.previousTrack();
            if (success) return; // SDK handled it
        } finally {
            this.isPlaybackCommandRunning = false;
        }
    }

    if (this.currentTime > 3) {
        this.currentTime = 0;
        if (this.audio) this.audio.currentTime = 0;
        this.updateProgress();
        return;
    }
    
    // Go to previous song
    let prevIndex;
    if (this.isShuffling) {
        prevIndex = Math.floor(Math.random() * this.filteredSongs.length);
    } else {
        prevIndex = this.currentSongIndex - 1;
        if (prevIndex < 0) prevIndex = this.filteredSongs.length - 1;
    }
    
    // IMPORTANT: Update the index BEFORE loading
    this.currentSongIndex = prevIndex;
    this.loadSong(prevIndex);
    
    if (this.isPlaying) {
        setTimeout(() => this.play(), 100);
    }
    
    // Update playlist highlight
    this.updatePlaylistHighlight();
}


    async skipTime(seconds) {
        if (this.isUsingSpotifySDK && this.spotifyApi && this.spotifyApi.playerReady) {
            try {
                const state = await this.spotifyApi.getPlaybackState();
                if (!state) return;

                let newPositionMs = state.position + seconds * 1000;
                newPositionMs = Math.min(Math.max(newPositionMs, 0), state.duration);

                if (this.isPlaybackCommandRunning) return;
                this.isPlaybackCommandRunning = true;

                await fetch(
                    `https://api.spotify.com/v1/me/player/seek?position_ms=${newPositionMs}`,
                    { method: 'PUT', headers: { Authorization: `Bearer ${spotifyToken}` } }
                );
                this.currentTime = newPositionMs / 1000;
                this.updateProgress();
            } catch (e) {
                console.error('Spotify seek error:', e);
            } finally {
                this.isPlaybackCommandRunning = false;
            }
        } else {
            this.currentTime = Math.max(0, Math.min(this.duration, this.currentTime + seconds));
            if (this.audio && !this.audio.error) this.audio.currentTime = this.currentTime;
            this.updateProgress();
        }
    }
    setupElements() {

        this.audio = document.getElementById('audioPlayer');
        if (!this.audio) {
            this.audio = new Audio();
            this.audio.id = 'audioPlayer';
            document.body.appendChild(this.audio);
        }
        
        this.audio.preload = 'none';
        this.audio.crossOrigin = 'anonymous';
        this.audio.volume = this.volume;
        
        // Controls
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.skipBackBtn = document.getElementById('skipBackBtn');
        this.skipForwardBtn = document.getElementById('skipForwardBtn');
        
        // Progress
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.progressHandle = document.getElementById('progressHandle');
        this.currentTimeEl = document.getElementById('currentTime');
        this.totalTimeEl = document.getElementById('totalTime');
        
        // Volume elements with proper initialization
        this.volumeBtn = document.getElementById('volumeBtn');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumePercentage = document.getElementById('volumePercentage') || document.getElementById('volumeTooltip');
        
        // Song info
        this.albumArt = document.getElementById('albumArt');
        this.songTitle = document.getElementById('songTitle');
        this.songArtist = document.getElementById('songArtist');
        this.songAlbum = document.getElementById('songAlbum');
        this.songSource = document.getElementById('songSource');
        
        // UI sections
        this.emptyState = document.getElementById('emptyState');
        this.nowPlaying = document.getElementById('nowPlaying');
        this.progressSection = document.getElementById('progressSection');
        this.mainControls = document.getElementById('mainControls');
        this.secondaryControls = document.getElementById('secondaryControls');
        this.visualizer = document.getElementById('visualizer');
        
        // Playlist
        this.playlistContainer = document.getElementById('playlist') || document.getElementById('playlistSongs');
        this.playlistEmpty = document.getElementById('playlistEmpty');
        this.playlistSelector = document.getElementById('playlistSelector');
        this.searchInput = document.getElementById('searchInput');
        
        // Source filter
        this.filterAll = document.getElementById('filterAll');
        this.filterLocal = document.getElementById('filterLocal');
        this.filterSpotify = document.getElementById('filterSpotify');
        
        // Secondary controls
        this.shuffleBtn = document.getElementById('shuffleBtn');
        this.repeatBtn = document.getElementById('repeatBtn');
        
        // Spotify
        this.spotifyConnect = document.getElementById('spotifyConnect');
        this.spotifyConnected = document.getElementById('spotifyConnected');
        this.spotifyStatus = document.getElementById('spotifyStatus');
        
        // Modals
        this.addMusicModal = document.getElementById('addMusicModal');
        this.uploadModal = document.getElementById('uploadModal');
        this.spotifyModal = document.getElementById('spotifyModal');
        this.createPlaylistModal = document.getElementById('createPlaylistModal');
        
        // File input
        this.fileInput = document.getElementById('fileInput');
        this.uploadZone = document.getElementById('uploadZone');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.uploadFiles = document.getElementById('uploadFiles');
        
        // Context menu
        this.contextMenu = document.getElementById('contextMenu');
        
        // Play overlay
        this.playOverlay = document.getElementById('playOverlay');
        
        // Toast container
        this.toastContainer = document.getElementById('toastContainer');
        
        // Loading overlay
        this.loadingOverlay = document.getElementById('loadingOverlay');

   
        if (this.volumeSlider) {
            this.volumeSlider.value = this.volume * 100; 
            this.volumeSlider.min = '0';
            this.volumeSlider.max = '100';
            this.volumeSlider.step = '1';
        }
        if (this.volumePercentage) {
            this.volumePercentage.textContent = Math.round(this.volume * 100) + '%';
        }
    }

    setupEventListeners() {
        if (this.playOverlay) {
        this.playOverlay.addEventListener('click', (e) => {
        e.stopPropagation();
        this.userInteracted = true;
        this.togglePlayPause();
        });
      }
        if (this.audio) {
            this.audio.addEventListener('loadedmetadata', () => {
                this.duration = this.audio.duration || 0;
                if (this.totalTimeEl) {
                    this.totalTimeEl.textContent = this.formatTime(this.duration);
                }
                console.log('Audio loaded, duration:', this.duration);
            });

            this.audio.addEventListener('timeupdate', () => {
                if (!this.isDragging) {
                    this.currentTime = this.audio.currentTime || 0;
                    this.updateProgress();
                }
            });

            this.audio.addEventListener('ended', () => this.handleSongEnd());

            this.audio.addEventListener('error', (e) => {
                console.error('Audio error:', e);
                this.showToast('Audio error occurred, trying alternative playback', 'warning');
            });

            this.audio.addEventListener('play', () => {
                this.isPlaying = true;
                this.updatePlayPauseButton();
                this.startProgressTracking();
                console.log('Audio started playing');
            });

            this.audio.addEventListener('pause', () => {
                this.isPlaying = false;
                this.updatePlayPauseButton();
                this.stopProgressTracking();
                console.log('Audio paused');
            });

            this.audio.addEventListener('canplay', () => {
                console.log('Audio can play');
            });

            // Volume change event for UI updates
            this.audio.addEventListener('volumechange', () => {
                this.updateVolumeUI();
            });

            // Add loadstart event for loading feedback
            this.audio.addEventListener('loadstart', () => {
                console.log('Audio loading started');
            });
        }

        // User interaction detection for autoplay
        document.addEventListener('click', () => {
            if (!this.userInteracted) {
                this.userInteracted = true;
                console.log('User interaction detected - autoplay enabled');
            }
        }, { once: false });

        // Control buttons
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => {
                this.userInteracted = true;
                this.togglePlayPause();
            });
        }
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => this.previousSong());
        }
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.nextSong());
        }
        if (this.skipBackBtn) {
            this.skipBackBtn.addEventListener('click', () => this.skipTime(-15));
        }
        if (this.skipForwardBtn) {
            this.skipForwardBtn.addEventListener('click', () => this.skipTime(15));
        }

        // Progress bar
        if (this.progressBar) {
            this.progressBar.addEventListener('click', (e) => this.seek(e));
        }
        if (this.progressHandle) {
            this.progressHandle.addEventListener('mousedown', (e) => this.startDrag(e));
        }

        // Volume controls with proper range handling
        if (this.volumeBtn) {
            this.volumeBtn.addEventListener('click', () => this.toggleMute());
        }
        if (this.volumeSlider) {
            // Handle both input and change events for better responsiveness
            this.volumeSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value) / 100; // Convert from 0-100 to 0-1
                this.setVolume(value);
            });
            
            this.volumeSlider.addEventListener('change', (e) => {
                const value = parseFloat(e.target.value) / 100;
                this.setVolume(value);
            });
            
            // Mouse events for drag detection
            this.volumeSlider.addEventListener('mousedown', () => {
                this.isDraggingVolume = true;
            });
            
            document.addEventListener('mouseup', () => {
                this.isDraggingVolume = false;
            });
        }

        // Secondary controls
        if (this.shuffleBtn) {
            this.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        }
        if (this.repeatBtn) {
            this.repeatBtn.addEventListener('click', () => this.toggleRepeat());
        }

        // Search
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.searchSongs(e.target.value));
        }

        // Playlist selector
        if (this.playlistSelector) {
            this.playlistSelector.addEventListener('change', (e) => this.switchPlaylist(e.target.value));
        }

        // Source filter
        if (this.filterAll) {
            this.filterAll.addEventListener('click', () => this.filterBySource('all'));
        }
        if (this.filterLocal) {
            this.filterLocal.addEventListener('click', () => this.filterBySource('local'));
        }
        if (this.filterSpotify) {
            this.filterSpotify.addEventListener('click', () => this.filterBySource('spotify'));
        }

        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => ThemeUtil.toggleTheme());
        }

        // Add music buttons
        const addSongBtn = document.getElementById('addSongBtn');
        const addMusicEmpty = document.getElementById('addMusicEmpty');
        const addMusicEmpty2 = document.getElementById('addMusicEmpty2');
        
        if (addSongBtn) {
            addSongBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openAddMusicModal();
            });
        }
        if (addMusicEmpty) {
            addMusicEmpty.addEventListener('click', (e) => {
                e.preventDefault();
                this.openAddMusicModal();
            });
        }
        if (addMusicEmpty2) {
            addMusicEmpty2.addEventListener('click', (e) => {
                e.preventDefault();
                this.openAddMusicModal();
            });
        }

        // Create playlist
        const createPlaylistBtn = document.getElementById('createPlaylistBtn');
        if (createPlaylistBtn) {
            createPlaylistBtn.addEventListener('click', () => this.openCreatePlaylistModal());
        }

        // Spotify connect
        if (this.spotifyConnect) {
            this.spotifyConnect.addEventListener('click', () => this.connectSpotify());
        }

        // Modal close buttons and other events...
        this.setupModalEventListeners();
        this.setupFileUploadListeners();
        this.setupSpotifySearchListeners();
        this.setupPlaylistListeners();
        this.setupContextMenuListeners();
        this.setupDragListeners();
    }

    setupModalEventListeners() {
        // Modal close buttons
        const closeButtons = [
            { id: 'closeAddMusicModal', modal: 'addMusicModal' },
            { id: 'closeUploadModal', modal: 'uploadModal' },
            { id: 'closeSpotifyModal', modal: 'spotifyModal' },
            { id: 'closePlaylistModal', modal: 'createPlaylistModal' }
        ];

        closeButtons.forEach(({ id, modal }) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => this.closeModal(modal));
            }
        });

        // Add music options
        const uploadOption = document.getElementById('uploadOption');
        const spotifyOption = document.getElementById('spotifyOption');
        
        if (uploadOption) {
            uploadOption.addEventListener('click', () => this.openUploadModal());
        }
        if (spotifyOption) {
            spotifyOption.addEventListener('click', () => this.openSpotifyModal());
        }

        // Modal backdrop clicks
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    const modal = backdrop.closest('.modal');
                    if (modal) this.closeModal(modal.id);
                }
            });
        });
    }

    setupFileUploadListeners() {
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        if (this.uploadZone) {
            this.uploadZone.addEventListener('click', () => {
                if (this.fileInput) this.fileInput.click();
            });
            this.uploadZone.addEventListener('dragover', (e) => this.handleDragOver(e));
            this.uploadZone.addEventListener('drop', (e) => this.handleFileDrop(e));
            this.uploadZone.addEventListener('dragleave', () => {
                if (this.uploadZone) this.uploadZone.classList.remove('dragover');
            });
        }
    }

    setupSpotifySearchListeners() {
        const spotifySearchBtn = document.getElementById('spotifySearchBtn');
        const spotifySearchInput = document.getElementById('spotifySearchInput');
        
        if (spotifySearchBtn) {
            spotifySearchBtn.addEventListener('click', () => this.searchSpotify());
        }
        if (spotifySearchInput) {
            spotifySearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchSpotify();
            });
        }
    }

    setupPlaylistListeners() {
        const confirmPlaylist = document.getElementById('confirmPlaylist');
        const cancelPlaylist = document.getElementById('cancelPlaylist');
        
        if (confirmPlaylist) {
            confirmPlaylist.addEventListener('click', () => this.createPlaylist());
        }
        if (cancelPlaylist) {
            cancelPlaylist.addEventListener('click', () => this.closeModal('createPlaylistModal'));
        }

        if (this.playOverlay) {
            this.playOverlay.addEventListener('click', () => {
                this.userInteracted = true;
                this.togglePlayPause();
            });
        }
    }

    setupContextMenuListeners() {
        document.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        document.addEventListener('click', () => this.hideContextMenu());
    }

    setupDragListeners() {
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.endDrag());
    }

    // PRESERVED: All your existing keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (!this.isKeyboardShortcutsActive) return;

            const handledKeys = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
            const handledKeyCodes = ['KeyM', 'KeyS', 'KeyR', 'KeyL', 'KeyJ', 'KeyK', 'KeyF', 'KeyH', 'Escape'];
            const digitKeys = ['Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'];
            
            if (handledKeys.includes(e.code) || handledKeyCodes.includes(e.code) || digitKeys.includes(e.code)) {
                e.preventDefault();
                e.stopPropagation();
            }

            switch(e.code) {
                case 'Space':
                    this.userInteracted = true;
                    this.togglePlayPause();
                    this.showToast('⏯️ Play/Pause', 'info');
                    break;
                    
                case 'ArrowLeft':
                    if (e.shiftKey) {
                        this.seekBackward(10);
                        this.showToast('⏪ -10 seconds', 'info');
                    } else {
                        this.previousSong();
                        this.showToast('⏮️ Previous track', 'info');
                    }
                    break;
                    
                case 'ArrowRight':
                    if (e.shiftKey) {
                        this.seekForward(10);
                        this.showToast('⏩ +10 seconds', 'info');
                    } else {
                        this.nextSong();
                        this.showToast('⏭️ Next track', 'info');
                    }
                    break;
                    
                case 'ArrowUp':
                    this.adjustVolume(5);
                    this.showToast(`🔊 Volume: ${Math.round(this.volume * 100)}%`, 'info');
                    break;
                    
                case 'ArrowDown':
                    this.adjustVolume(-5);
                    this.showToast(`🔉 Volume: ${Math.round(this.volume * 100)}%`, 'info');
                    break;
                    
                case 'KeyM':
                    this.toggleMute();
                    this.showToast(this.isMuted ? '🔇 Muted' : '🔊 Unmuted', 'info');
                    break;
                    
                case 'KeyS':
                    this.toggleShuffle();
                    this.showToast(this.isShuffling ? '🔀 Shuffle ON' : '🔀 Shuffle OFF', 'info');
                    break;
                    
                case 'KeyR':
                    this.toggleRepeat();
                    const repeatModes = { 'none': 'OFF', 'single': 'Single', 'all': 'All' };
                    this.showToast(`🔁 Repeat: ${repeatModes[this.repeatMode]}`, 'info');
                    break;
                    
                case 'KeyJ':
                    this.seekBackward(5);
                    this.showToast('⏪ -5 seconds', 'info');
                    break;
                    
                case 'KeyK':
                    this.userInteracted = true;
                    this.togglePlayPause();
                    this.showToast('⏯️ Play/Pause', 'info');
                    break;
                    
                case 'KeyL':
                    this.seekForward(5);
                    this.showToast('⏩ +5 seconds', 'info');
                    break;
                    
                // Volume presets
                case 'Digit0': this.setVolume(0); this.showToast('🔇 Volume: 0%', 'info'); break;
                case 'Digit1': this.setVolume(0.1); this.showToast('🔉 Volume: 10%', 'info'); break;
                case 'Digit2': this.setVolume(0.2); this.showToast('🔉 Volume: 20%', 'info'); break;
                case 'Digit3': this.setVolume(0.3); this.showToast('🔉 Volume: 30%', 'info'); break;
                case 'Digit4': this.setVolume(0.4); this.showToast('🔊 Volume: 40%', 'info'); break;
                case 'Digit5': this.setVolume(0.5); this.showToast('🔊 Volume: 50%', 'info'); break;
                case 'Digit6': this.setVolume(0.6); this.showToast('🔊 Volume: 60%', 'info'); break;
                case 'Digit7': this.setVolume(0.7); this.showToast('🔊 Volume: 70%', 'info'); break;
                case 'Digit8': this.setVolume(0.8); this.showToast('🔊 Volume: 80%', 'info'); break;
                case 'Digit9': this.setVolume(0.9); this.showToast('🔊 Volume: 90%', 'info'); break;
                    
                case 'KeyF':
                    this.toggleFullscreen();
                    this.showToast('🖥️ Fullscreen toggled', 'info');
                    break;
                    
                case 'KeyH':
                    this.showKeyboardShortcutsHelp();
                    break;
                    
                case 'Escape':
                    this.closeAllModals();
                    break;
            }
        });
    }

    // Keyboard shortcut helpers
    seekForward(seconds) {
        this.skipTime(seconds);
    }

    seekBackward(seconds) {
        this.skipTime(-seconds);
    }

    adjustVolume(delta) {
        if (this.audio) {
            const newVolume = Math.max(0, Math.min(1, this.audio.volume + (delta / 100)));
            this.setVolume(newVolume);
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                this.showToast('Fullscreen not supported', 'error');
            });
        } else {
            document.exitFullscreen();
        }
    }

    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            this.closeModal(modal.id);
        });
    }

    showKeyboardShortcutsHelp() {
        this.showToast('Keyboard shortcuts: Space=Play/Pause, ←→=Prev/Next, ↑↓=Volume, M=Mute, S=Shuffle, R=Repeat', 'info');
    }

    // PRESERVED: Progress tracking with enhancement for Spotify SDK
    startProgressTracking() {
        this.stopProgressTracking();
        this.progressInterval = setInterval(() => {
            if (this.isPlaying && !this.isDragging) {
                if (this.audio && this.audio.src && !this.audio.error) {
                    this.currentTime = this.audio.currentTime || 0;
                } else {
                    this.currentTime += 1;
                }
                this.updateProgress();
                
                if (this.currentTime >= this.duration) {
                    this.handleSongEnd();
                }
            }
        }, 1000);
    }

    stopProgressTracking() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
    }

    // PRESERVED: Complete volume UI update system
    updateVolumeUI() {
        const currentVolume = this.audio ? this.audio.volume : this.volume;
        this.volume = currentVolume;
        
        // Update volume slider (convert 0-1 to 0-100)
        if (this.volumeSlider) {
            this.volumeSlider.value = Math.round(currentVolume * 100);
        }
        
        // Update volume percentage display
        if (this.volumePercentage) {
            this.volumePercentage.textContent = Math.round(currentVolume * 100) + '%';
        }
        
        // Update volume button icon
        if (this.volumeBtn) {
            const icon = this.volumeBtn.querySelector('i');
            if (icon) {
                if (this.isMuted || currentVolume === 0) {
                    icon.className = 'fas fa-volume-mute';
                } else if (currentVolume < 0.5) {
                    icon.className = 'fas fa-volume-down';
                } else {
                    icon.className = 'fas fa-volume-high';
                }
            }
        }
        
        console.log(`Volume UI updated: ${Math.round(currentVolume * 100)}%`);
    }
    setVolume(value) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;
        
        const clampedValue = Math.max(0, Math.min(1, numValue));
        
        // Set volume on Spotify Web Player if active
        if (this.isUsingSpotifySDK && this.spotifyApi && this.spotifyApi.playerReady) {
            this.spotifyApi.setVolume(clampedValue);
        }
        
        // Also set on regular audio element
        if (this.audio) {
            this.audio.volume = clampedValue;
        }
        
        this.volume = clampedValue;
        
        if (clampedValue > 0) {
            this.isMuted = false;
        }
        
        this.updateVolumeUI();
        console.log(`Volume set to: ${Math.round(clampedValue * 100)}%`);
    }

    // PRESERVED: All your existing database methods
    async initDB() {
        try {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    this.db = request.result;
                    resolve();
                };
                
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    
                    if (!db.objectStoreNames.contains('playlists')) {
                        const playlistStore = db.createObjectStore('playlists', { keyPath: 'id' });
                        playlistStore.createIndex('name', 'name', { unique: false });
                    }
                    
                    if (!db.objectStoreNames.contains('songs')) {
                        const songStore = db.createObjectStore('songs', { keyPath: 'id' });
                        songStore.createIndex('source', 'source', { unique: false });
                        songStore.createIndex('playlistId', 'playlistId', { unique: false });
                    }
                    
                    if (!db.objectStoreNames.contains('files')) {
                        db.createObjectStore('files', { keyPath: 'id' });
                    }
                };
            });
        } catch (error) {
            console.error('Error initializing IndexedDB:', error);
            this.db = null;
        }
    }

    async loadPlaylists() {
        try {
            if (!this.db) {
                await this.createDefaultPlaylists();
                return;
            }

            const transaction = this.db.transaction(['playlists', 'songs'], 'readonly');
            const playlistStore = transaction.objectStore('playlists');
            const songStore = transaction.objectStore('songs');
            
            const playlistRequest = playlistStore.getAll();
            const playlists = await new Promise((resolve, reject) => {
                playlistRequest.onsuccess = () => resolve(playlistRequest.result);
                playlistRequest.onerror = () => reject(playlistRequest.error);
            });
            
            const songRequest = songStore.getAll();
            const allSongs = await new Promise((resolve, reject) => {
                songRequest.onsuccess = () => resolve(songRequest.result);
                songRequest.onerror = () => reject(songRequest.error);
            });
            
            if (playlists.length === 0) {
                await this.createDefaultPlaylists();
            } else {
                this.playlists.clear();
                playlists.forEach(playlist => {
                    this.playlists.set(playlist.id, playlist);
                });
                this.updatePlaylistSelector();
            }
            
            this.songs = allSongs.filter(song => song.playlistId === this.currentPlaylistId);
            this.filteredSongs = [...this.songs];
            this.originalSongs = [...this.songs];
            
            this.renderPlaylist();
            
        } catch (error) {
            console.error('Error loading playlists:', error);
            await this.createDefaultPlaylists();
        }
    }

    async createDefaultPlaylists() {
        const defaultPlaylists = [
            {
                id: 'my-music',
                name: 'My Music',
                description: 'Your uploaded music',
                songs: [],
                isDefault: true,
                createdAt: Date.now()
            },
            {
                id: 'spotify-tracks',
                name: 'Spotify Tracks',
                description: 'Songs from Spotify',
                songs: [],
                isDefault: true,
                createdAt: Date.now()
            }
        ];

        if (this.db) {
            const transaction = this.db.transaction(['playlists'], 'readwrite');
            const store = transaction.objectStore('playlists');
            
            for (const playlist of defaultPlaylists) {
                try {
                    await new Promise((resolve, reject) => {
                        const request = store.add(playlist);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                } catch (error) {
                    console.log('Playlist already exists:', playlist.id);
                }
                
                this.playlists.set(playlist.id, playlist);
            }
        } else {
            defaultPlaylists.forEach(playlist => {
                this.playlists.set(playlist.id, playlist);
            });
        }
        
        this.updatePlaylistSelector();
    }

    // PRESERVED: Allow re-adding deleted songs
    async addSongToPlaylist(songData, playlistId = 'my-music') {
        try {
            if (!this.playlists.has(playlistId)) {
                this.playlists.set(playlistId, {
                    id: playlistId,
                    name: playlistId === 'my-music' ? 'My Music' : 'New Playlist',
                    songs: []
                });
            }
            
            // Only check current songs, allow re-adding deleted ones
            const existsInCurrent = this.originalSongs.find(song =>
                song.title.toLowerCase() === songData.title.toLowerCase() && 
                song.artist.toLowerCase() === songData.artist.toLowerCase()
            );
            
            if (existsInCurrent) {
                this.showToast(`"${songData.title}" is already in the playlist`, 'warning');
                return false;
            }
            
            const playlist = this.playlists.get(playlistId);
            playlist.songs.push(songData);
            
            await this.savePlaylist(playlist);
            await this.saveSong(songData);
            
            if (this.currentPlaylistId === playlistId) {
                this.songs.push(songData);
                this.originalSongs.push(songData);
                this.filteredSongs.push(songData);
                this.renderPlaylist();
            }
            
            if (playlist.songs.length === 1) {
                this.hideEmptyState();
            }
            
            return true;
        } catch (error) {
            console.error('Error adding song to playlist:', error);
            return false;
        }
    }

    async savePlaylist(playlist) {
        if (!this.db) return Promise.resolve();
        
        try {
            const transaction = this.db.transaction(['playlists'], 'readwrite');
            const store = transaction.objectStore('playlists');
            
            return new Promise((resolve, reject) => {
                const request = store.put(playlist);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error saving playlist:', error);
            return Promise.resolve();
        }
    }

    async saveSong(song) {
        if (!this.db) return Promise.resolve();
        
        try {
            const transaction = this.db.transaction(['songs'], 'readwrite');
            const store = transaction.objectStore('songs');
            
            return new Promise((resolve, reject) => {
                const request = store.put(song);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error saving song:', error);
            return Promise.resolve();
        }
    }

    // PRESERVED: UI state methods
    showEmptyState() {
        if (this.emptyState) this.emptyState.style.display = 'flex';
        if (this.nowPlaying) this.nowPlaying.style.display = 'none';
        if (this.progressSection) this.progressSection.style.display = 'none';
        if (this.mainControls) this.mainControls.style.display = 'none';
        if (this.secondaryControls) this.secondaryControls.style.display = 'none';
        if (this.visualizer) this.visualizer.style.display = 'none';
    }

    hideEmptyState() {
        if (this.emptyState) this.emptyState.style.display = 'none';
        if (this.nowPlaying) this.nowPlaying.style.display = 'block';
        this.showPlayer();
    }

    showPlayer() {
        if (this.nowPlaying) this.nowPlaying.style.display = 'flex';
        if (this.progressSection) this.progressSection.style.display = 'flex';
        if (this.mainControls) this.mainControls.style.display = 'flex';
        if (this.secondaryControls) this.secondaryControls.style.display = 'flex';
        if (this.visualizer) this.visualizer.style.display = 'flex';
    }

    // PRESERVED: Modal methods
    openAddMusicModal() {
        console.log('Opening add music modal');
        if (this.addMusicModal) {
            this.addMusicModal.classList.remove('hidden');
            this.addMusicModal.style.display = 'flex';
        }
    }

    openUploadModal() {
        this.closeModal('addMusicModal');
        if (this.uploadModal) {
            this.uploadModal.classList.remove('hidden');
            this.uploadModal.style.display = 'flex';
        }
    }

    openSpotifyModal() {
        this.closeModal('addMusicModal');
        if (this.spotifyModal) {
            this.spotifyModal.classList.remove('hidden');
            this.spotifyModal.style.display = 'flex';
        }
    }

    openCreatePlaylistModal() {
        if (this.createPlaylistModal) {
            this.createPlaylistModal.classList.remove('hidden');
            this.createPlaylistModal.style.display = 'flex';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }

    // PRESERVED: File upload methods
    async handleFileSelect(event) {
        const files = Array.from(event.target.files);
        await this.processFiles(files);
        event.target.value = '';
    }

    handleDragOver(event) {
        event.preventDefault();
        if (this.uploadZone) {
            this.uploadZone.classList.add('dragover');
        }
    }

    async handleFileDrop(event) {
        event.preventDefault();
        if (this.uploadZone) {
            this.uploadZone.classList.remove('dragover');
        }
        
        const files = Array.from(event.dataTransfer.files);
        const audioFiles = files.filter(file => file.type.startsWith('audio/'));
        
        if (audioFiles.length === 0) {
            this.showToast('Please drop audio files only', 'error');
            return;
        }
        
        await this.processFiles(audioFiles);
    }

    async processFiles(files) {
        if (this.uploadProgress) {
            this.uploadProgress.style.display = 'block';
        }
        if (this.uploadFiles) {
            this.uploadFiles.innerHTML = '';
        }
        
        for (const file of files) {
            await this.processFile(file);
        }
        
        setTimeout(() => {
            this.closeModal('uploadModal');
            if (this.uploadProgress) {
                this.uploadProgress.style.display = 'none';
            }
            this.showToast(`Added ${files.length} song${files.length > 1 ? 's' : ''} to your library`, 'success');
            this.renderPlaylist();
        }, 1000);
    }

    async processFile(file) {
        const fileId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        if (this.uploadFiles) {
            const fileEl = document.createElement('div');
            fileEl.className = 'upload-file';
            fileEl.innerHTML = `
                <div class="upload-file-info">
                    <div class="upload-file-name">${file.name}</div>
                    <div class="upload-file-progress">
                        <div class="upload-file-progress-fill" style="width: 0%"></div>
                    </div>
                </div>
            `;
            
            this.uploadFiles.appendChild(fileEl);
            const progressFill = fileEl.querySelector('.upload-file-progress-fill');
            
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 20;
                if (progress > 100) progress = 100;
                progressFill.style.width = progress + '%';
                
                if (progress >= 100) {
                    clearInterval(progressInterval);
                }
            }, 100);
        }
        
        try {
            const metadata = await this.extractMetadata(file);
            const blobUrl = URL.createObjectURL(file);
            
            const song = {
                id: fileId,
                title: metadata.title || file.name.replace(/\.[^/.]+$/, ""),
                artist: metadata.artist || 'Unknown Artist',
                album: metadata.album || 'Unknown Album',
                duration: metadata.duration || '0:00',
                durationSeconds: metadata.durationSeconds || 0,
                audioUrl: blobUrl,
                fileId: fileId,
                artworkUrl: metadata.artwork || this.getDefaultArtwork(),
                source: 'local',
                playlistId: this.currentPlaylistId,
                addedAt: Date.now()
            };
            
            await this.addSongToPlaylist(song, this.currentPlaylistId);
            
        } catch (error) {
            console.error('Error processing file:', error);
            this.showToast(`Error processing ${file.name}`, 'error');
        }
    }

    async extractMetadata(file) {
        return new Promise((resolve) => {
            const audio = new Audio();
            const url = URL.createObjectURL(file);
            
            audio.addEventListener('loadedmetadata', () => {
                const duration = audio.duration;
                const metadata = {
                    duration: this.formatTime(duration),
                    durationSeconds: duration,
                    title: file.name.replace(/\.[^/.]+$/, ""),
                    artist: 'Unknown Artist',
                    album: 'Unknown Album'
                };
                
                URL.revokeObjectURL(url);
                resolve(metadata);
            });
            
            audio.addEventListener('error', () => {
                URL.revokeObjectURL(url);
                resolve({
                    title: file.name.replace(/\.[^/.]+$/, ""),
                    artist: 'Unknown Artist',
                    album: 'Unknown Album',
                    duration: '0:00',
                    durationSeconds: 0
                });
            });
            
            audio.src = url;
        });
    }

    getDefaultArtwork() {
        return 'data:image/svg+xml,' + encodeURIComponent(`
            <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
                <rect width="300" height="300" fill="#2a2a2a"/>
                <path d="M150 75c41.4 0 75 33.6 75 75s-33.6 75-75 75-75-33.6-75-75s33.6-75 75-75zm0 120c24.9 0 45-20.1 45-45s-20.1-45-45-45-45 20.1-45 45 20.1 45 45 45z" fill="#ff6b9d"/>
                <circle cx="150" cy="150" r="15" fill="#ff6b9d"/>
            </svg>
        `);
    }

    // PRESERVED: Spotify connection methods
    connectSpotify() {
        // Allow demo connection
        this.setSpotifyConnected(true);
        this.showToast('Demo mode: Using sample tracks with real audio', 'info');
        
        if (SPOTIFY_CONFIG.clientId !== 'YOUR_SPOTIFY_CLIENT_ID') {
            if (this.spotifyApi) {
                this.spotifyApi.startOAuthFlow();
            }
        }
    }

    setSpotifyConnected(connected) {
        this.isSpotifyConnected = connected;
        
        if (this.spotifyConnect) {
            this.spotifyConnect.style.display = connected ? 'none' : 'flex';
        }
        if (this.spotifyConnected) {
            this.spotifyConnected.style.display = connected ? 'flex' : 'none';
        }
        this.updateSpotifyStatus();
    }

    updateSpotifyStatus() {
        if (this.spotifyConnect) {
            if (this.isSpotifyConnected) {
                this.spotifyConnect.innerHTML = '<i class="fab fa-spotify"></i> Connected';
                if (this.spotifyStatus) {
                    this.spotifyStatus.classList.add('connected');
                }
            } else {
                this.spotifyConnect.innerHTML = '<i class="fab fa-spotify"></i> Connect Spotify';
                if (this.spotifyStatus) {
                    this.spotifyStatus.classList.remove('connected');
                }
            }
        }
    }

    checkSpotifyAuth() {
        if (this.spotifyApi) {
            this.spotifyApi.authenticate().then(authenticated => {
                if (authenticated || isSpotifyTokenValid()) {
                    this.setSpotifyConnected(true);
                }
            });
        }
    }

    async searchSpotify() {
        const searchInput = document.getElementById('spotifySearchInput');
        const query = searchInput ? searchInput.value.trim() : '';
        if (!query) {
            this.showToast('Please enter a search query', 'warning');
            return;
        }
        
        const loadingEl = document.getElementById('spotifyLoading');
        const resultsEl = document.getElementById('spotifyResults');
        
        if (loadingEl) loadingEl.style.display = 'flex';
        if (resultsEl) resultsEl.innerHTML = '';
        
        try {
            if (!this.spotifyApi) this.spotifyApi = new SpotifyAPI(SPOTIFY_CONFIG);
            const data = await this.spotifyApi.searchTracks(query);
            
            if (loadingEl) loadingEl.style.display = 'none';
            
            if (!data.tracks?.items?.length) {
                if (resultsEl) {
                    resultsEl.innerHTML = `
                        <div class="text-center text-muted p-4">
                            <p>No results found for "${query}"</p>
                        </div>
                    `;
                }
                return;
            }
            
            this.renderSpotifyResults(data.tracks.items);
        } catch (error) {
            if (loadingEl) loadingEl.style.display = 'none';
            if (resultsEl) {
                resultsEl.innerHTML = `
                    <div class="text-center text-muted p-4">
                        <p>Search failed. Please try again.</p>
                    </div>
                `;
            }
            console.error('Spotify search error:', error);
            this.showToast('Spotify search failed', 'error');
        }
    }

    renderSpotifyResults(tracks) {
        const resultsContainer = document.getElementById('spotifyResults');
        if (!resultsContainer) return;
        
        resultsContainer.innerHTML = '';
        
        tracks.forEach(track => {
            const trackEl = document.createElement('div');
            trackEl.className = 'spotify-result spotify-track-item';
            
            // Show Web Playback capability indicator
            const webPlaybackIndicator = this.spotifyApi && this.spotifyApi.playerReady ? 
                '<span class="web-playback-indicator" title="Full track streaming available">🎵</span>' : '';
            
            trackEl.innerHTML = `
                <img src="${track.album.images[0]?.url || this.getDefaultArtwork()}" 
                     alt="${track.name}" class="spotify-result-artwork track-artwork">
                <div class="spotify-result-info track-info">
                    <div class="spotify-result-title track-title">
                        ${track.name} ${webPlaybackIndicator}
                    </div>
                    <div class="spotify-result-artist track-artist">${track.artists.map(a => a.name).join(', ')}</div>
                    <div class="track-album">${track.album.name}</div>
                </div>
                <div class="spotify-result-duration track-duration">${this.formatTime(track.duration_ms / 1000)}</div>
                <button class="spotify-result-add add-track-btn btn btn--sm btn--primary" data-track-id="${track.id}">
                    Add
                </button>
            `;
            
            const addButton = trackEl.querySelector('.add-track-btn');
            addButton.addEventListener('click', () => this.addSpotifyTrack(track.id, track));
            
            resultsContainer.appendChild(trackEl);
        });
    }

    // ENHANCED: Add Spotify track with URI preservation for Web Playback SDK
    async addSpotifyTrack(trackId, trackData) {
        const song = {
            id: 'spotify_' + trackId,
            title: trackData.name,
            artist: trackData.artists.map(a => a.name).join(', '),
            album: trackData.album.name,
            duration: this.formatTime(trackData.duration_ms / 1000),
            durationSeconds: trackData.duration_ms / 1000,
            audioUrl: trackData.preview_url || trackData.external_urls?.spotify,
            artworkUrl: trackData.album.images[0]?.url || this.getDefaultArtwork(),
            source: 'spotify',
            playlistId: this.currentPlaylistId,
            spotifyId: trackId,
            spotifyUri: trackData.uri, // IMPORTANT: Preserve URI for Web Playback SDK
            addedAt: Date.now()
        };
        
        try {
            const success = await this.addSongToPlaylist(song, this.currentPlaylistId);
            
            if (success) {
                this.showToast(`Added "${song.title}" to playlist`, 'success');
                
                // Show Web Playback capability notice
                if (this.spotifyApi && this.spotifyApi.playerReady) {
                    setTimeout(() => {
                        this.showToast('🎵 Full track streaming available via Spotify Web Player!', 'info');
                    }, 1500);
                }
            }
        } catch (error) {
            console.error('Error adding Spotify track:', error);
            this.showToast('Error adding track', 'error');
        }
    }

    // PRESERVED: Playlist management
    async createPlaylist() {
        const nameInput = document.getElementById('playlistNameInput');
        const descInput = document.getElementById('playlistDescInput');
        
        const name = nameInput ? nameInput.value.trim() : '';
        const description = descInput ? descInput.value.trim() : '';
        
        if (!name) {
            this.showToast('Please enter a playlist name', 'error');
            return;
        }
        
        const playlist = {
            id: 'playlist_' + Date.now(),
            name: name,
            description: description || '',
            songs: [],
            isDefault: false,
            createdAt: Date.now()
        };
        
        try {
            if (this.db) {
                const transaction = this.db.transaction(['playlists'], 'readwrite');
                const store = transaction.objectStore('playlists');
                
                await new Promise((resolve, reject) => {
                    const request = store.add(playlist);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }
            
            this.playlists.set(playlist.id, playlist);
            this.updatePlaylistSelector();
            this.closeModal('createPlaylistModal');
            
            if (nameInput) nameInput.value = '';
            if (descInput) descInput.value = '';
            
            this.showToast(`Created playlist "${name}"`, 'success');
            
        } catch (error) {
            console.error('Error creating playlist:', error);
            this.showToast('Error creating playlist', 'error');
        }
    }

    updatePlaylistSelector() {
        if (!this.playlistSelector) return;
        
        this.playlistSelector.innerHTML = '';
        
        this.playlists.forEach(playlist => {
            const option = document.createElement('option');
            option.value = playlist.id;
            option.textContent = playlist.name;
            this.playlistSelector.appendChild(option);
        });
        
        this.playlistSelector.value = this.currentPlaylistId;
    }

    async switchPlaylist(playlistId) {
        this.currentPlaylistId = playlistId;
        
        try {
            if (this.db) {
                const transaction = this.db.transaction(['songs'], 'readonly');
                const store = transaction.objectStore('songs');
                const index = store.index('playlistId');
                
                const songs = await new Promise((resolve, reject) => {
                    const request = index.getAll(playlistId);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                
                this.songs = songs;
            } else {
                this.songs = [];
            }
            
            this.filteredSongs = [...this.songs];
            this.originalSongs = [...this.songs];
            
            this.renderPlaylist();
            this.currentSongIndex = 0;
            
        } catch (error) {
            console.error('Error switching playlist:', error);
            this.showToast('Error loading playlist', 'error');
        }
    }

    // PRESERVED: Playback methods with Web Playback SDK integration
    loadSong(index) {
        if (index < 0 || index >= this.filteredSongs.length) return;
        
        const song = this.filteredSongs[index];
        this.currentSongIndex = index;

        // Update UI
        if (this.songTitle) this.songTitle.textContent = song.title;
        if (this.songArtist) this.songArtist.textContent = song.artist;
        if (this.songAlbum) this.songAlbum.textContent = song.album;
        if (this.albumArt) this.albumArt.src = song.artworkUrl;
        
        // Update source indicator
        if (this.songSource) {
            const sourceIcon = this.songSource.querySelector('i');
            const sourceText = this.songSource.querySelector('span');
            
            if (sourceIcon && sourceText) {
                if (song.source === 'spotify') {
                    sourceIcon.className = 'fab fa-spotify';
                    sourceText.textContent = 'Spotify';
                    this.songSource.classList.add('spotify');
                } else {
                    sourceIcon.className = 'fas fa-folder';
                    sourceText.textContent = 'My Music';
                    this.songSource.classList.remove('spotify');
                }
            }
        }
        
        // Load audio with better error handling
        if (this.audio && song.audioUrl) {
            this.audio.src = song.audioUrl;
            this.duration = song.durationSeconds || 0;
            if (this.totalTimeEl) {
                this.totalTimeEl.textContent = song.duration || '0:00';
            }
            
            // Preload metadata
            this.audio.load();
        }
        
        this.showPlayer();
        this.updatePlaylistHighlight();
        
        this.currentTime = 0;
        this.updateProgress();
        
        console.log(`Loaded song: ${song.title} - ${song.audioUrl}`);
    }

    async playSong(index) {
        if (index < 0 || index >= this.filteredSongs.length) return;
        
        const song = this.filteredSongs[index];
        this.currentSongIndex = index;
        
        try {
            this.hideEmptyState();
            const nowPlaying = document.getElementById('nowPlaying');
            if (nowPlaying) nowPlaying.style.display = 'block';
            
            if (this.songTitle) this.songTitle.textContent = song.title;
            if (this.songArtist) this.songArtist.textContent = song.artist;
            if (this.songAlbum) this.songAlbum.textContent = song.album;
            if (this.albumArt) this.albumArt.src = song.artworkUrl;
            
            const sourceIndicator = document.getElementById('sourceIndicator');
            if (sourceIndicator) {
                sourceIndicator.innerHTML = `
                    <i class="${song.source === 'spotify' ? 'fab fa-spotify' : 'fas fa-music'}"></i>
                    <span>${song.source === 'spotify' ? 'Spotify' : 'Local'}</span>
                `;
            }
            
            this.loadSong(index);
            this.play();
            
        } catch (error) {
            console.error('Error playing song:', error);
            this.showToast('Failed to play song', 'error');
        }
    }

    // ENHANCED: Toggle play/pause with Web Playback SDK integration
    async togglePlayPause() {
        if (this.filteredSongs.length === 0) {
            this.showToast('No songs to play. Add some music first!', 'info');
            return;
        }

        if (this.isUsingSpotifySDK && this.spotifyApi && this.spotifyApi.playerReady) {
            const success = await this.spotifyApi.togglePlayback();
            if (success) {
                // State will be updated via the state_changed listener
                return;
            }
        }

        // Fallback to existing logic
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    // Enhanced simulation with better user feedback
    simulatePlayback() {
        this.isPlaying = true;
        this.updatePlayPauseButton();
        
        if (this.filteredSongs[this.currentSongIndex]) {
            this.duration = this.filteredSongs[this.currentSongIndex].durationSeconds;
            if (this.totalTimeEl) {
                this.totalTimeEl.textContent = this.filteredSongs[this.currentSongIndex].duration;
            }
            console.log('Simulating playback for:', this.filteredSongs[this.currentSongIndex].title);
        }
        
        this.startProgressTracking();
    }

    updatePlayPauseButton() {
        if (this.playPauseBtn) {
            const icon = this.playPauseBtn.querySelector('i');
            if (icon) {
                icon.className = this.isPlaying ? 'fas fa-pause' : 'fas fa-play';
            }
        }
        this.updatePlayOverlay();
    }

handleSongEnd() {
    console.log('Song ended, repeat mode:', this.repeatMode);
    this.stopProgressTracking();
    
    if (this.repeatMode === 'single') {
        // Repeat current song
        this.currentTime = 0;
        if (this.audio) this.audio.currentTime = 0;
        this.updateProgress();
        setTimeout(() => this.play(), 100);
    } else if (this.repeatMode === 'all' || this.currentSongIndex < this.filteredSongs.length - 1) {
        // Play next song
        this.nextSong();
    } else {
        // End of playlist, stop playing
        this.isPlaying = false;
        this.updatePlayPauseButton();
        this.showToast('Playlist ended', 'info');
    }
}


    seek(e) {
        if (!this.progressBar) return;
        
        const rect = this.progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        this.currentTime = percent * this.duration;
        if (this.audio && !this.audio.error) this.audio.currentTime = this.currentTime;
        this.updateProgress();
    }

    startDrag(e) {
        this.isDragging = true;
        e.preventDefault();
    }

    drag(e) {
        if (!this.isDragging || !this.progressBar) return;
        
        const rect = this.progressBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        
        this.currentTime = percent * this.duration;
        this.updateProgress();
    }

    endDrag() {
        if (this.isDragging) {
            if (this.audio && !this.audio.error) this.audio.currentTime = this.currentTime;
        }
        this.isDragging = false;
    }

    updateProgress() {
        if (this.progressFill && this.currentTimeEl) {
            const percent = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
            this.progressFill.style.width = percent + '%';
            this.currentTimeEl.textContent = this.formatTime(this.currentTime);
        }
    }

    // PRESERVED: All your existing utility methods
    toggleMute() {
        if (this.audio) {
            if (this.isMuted) {
                this.audio.volume = this.previousVolume;
                this.isMuted = false;
            } else {
                this.previousVolume = this.audio.volume;
                this.audio.volume = 0;
                this.isMuted = true;
            }
            this.updateVolumeUI();
        }
    }

toggleShuffle() {
    this.isShuffling = !this.isShuffling;
    
 
    if (this.shuffleBtn) {
        this.shuffleBtn.classList.toggle('active', this.isShuffling);
        
        this.shuffleBtn.setAttribute('aria-pressed', this.isShuffling.toString());
    }
    
    // Show feedback
    this.showToast(this.isShuffling ? '🔀 Shuffle ON' : '🔀 Shuffle OFF', 'info');
    console.log('Shuffle toggled:', this.isShuffling);
}


toggleRepeat() {
    const modes = ['none', 'single', 'all'];
    const currentIndex = modes.indexOf(this.repeatMode);
    this.repeatMode = modes[(currentIndex + 1) % modes.length];
    
    if (this.repeatBtn) {

        this.repeatBtn.classList.remove('active', 'repeat-single', 'repeat-all');
        if (this.repeatMode !== 'none') {
            this.repeatBtn.classList.add('active');
            if (this.repeatMode === 'single') {
                this.repeatBtn.classList.add('repeat-single');
            } else if (this.repeatMode === 'all') {
                this.repeatBtn.classList.add('repeat-all');
            }
        }
        
        const icon = this.repeatBtn.querySelector('i');
        if (icon) {
            if (this.repeatMode === 'single') {
                icon.className = 'fas fa-repeat-1';
            } else {
                icon.className = 'fas fa-repeat';
            }
        }
        this.repeatBtn.setAttribute('aria-pressed', (this.repeatMode !== 'none').toString());
    }
    
    // Show feedback
    const modeNames = { 'none': 'OFF', 'single': 'Single', 'all': 'All' };
    this.showToast(`🔁 Repeat: ${modeNames[this.repeatMode]}`, 'info');
    console.log('Repeat mode:', this.repeatMode);
}


    // Search and filter methods
    searchSongs(query) {
        this.searchQuery = query;
        this.applyFilters();
    }

    filterBySource(source) {
        this.currentSource = source;
        
        const filterButtons = [this.filterAll, this.filterLocal, this.filterSpotify];
        filterButtons.forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        
        if (source === 'all' && this.filterAll) this.filterAll.classList.add('active');
        else if (source === 'local' && this.filterLocal) this.filterLocal.classList.add('active');
        else if (source === 'spotify' && this.filterSpotify) this.filterSpotify.classList.add('active');
        
        this.applyFilters();
    }

    applyFilters() {
        let filteredSongs = [...this.originalSongs];
        
        if (this.currentSource !== 'all') {
            filteredSongs = filteredSongs.filter(song => song.source === this.currentSource);
        }
        
        if (this.searchQuery && this.searchQuery.trim()) {
            const query = this.searchQuery.toLowerCase().trim();
            filteredSongs = filteredSongs.filter(song => 
                song.title.toLowerCase().includes(query) ||
                song.artist.toLowerCase().includes(query) ||
                song.album.toLowerCase().includes(query)
            );
        }
        
        this.filteredSongs = filteredSongs;
        this.renderPlaylist();
        
        if (this.originalSongs[this.currentSongIndex]) {
            const currentSong = this.originalSongs[this.currentSongIndex];
            const newIndex = this.filteredSongs.findIndex(song => song.id === currentSong.id);
            this.currentSongIndex = newIndex >= 0 ? newIndex : 0;
        }
    }

    // Playlist display methods
    renderPlaylist() {
        if (!this.playlistContainer) return;
        
        if (this.filteredSongs.length === 0) {
            if (this.playlistContainer) this.playlistContainer.style.display = 'none';
            if (this.playlistEmpty) this.playlistEmpty.style.display = 'flex';
            return;
        }
        
        if (this.playlistContainer) this.playlistContainer.style.display = 'block';
        if (this.playlistEmpty) this.playlistEmpty.style.display = 'none';
        this.playlistContainer.innerHTML = '';
        
        this.filteredSongs.forEach((song, index) => {
            const songEl = document.createElement('div');
            songEl.className = 'song-item';
            songEl.innerHTML = `
                <img src="${song.artworkUrl}" alt="${song.title}" class="song-thumbnail song-artwork" onerror="this.src='${this.getDefaultArtwork()}'">
                <div class="song-details song-info">
                    <h4 class="song-title">${song.title}</h4>
                    <p class="song-artist">${song.artist}</p>
                </div>
                <div class="song-source-icon song-source ${song.source}">
                    <i class="${song.source === 'spotify' ? 'fab fa-spotify' : 'fas fa-folder'}"></i>
                </div>
                <span class="song-duration">${song.duration}</span>
                <div class="song-actions">
                    <button class="song-action-btn" title="Remove">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            songEl.addEventListener('click', (e) => {
                if (!e.target.closest('.song-actions')) {
                    this.userInteracted = true;
                    this.playSong(index);
                }
            });
            
            const removeBtn = songEl.querySelector('.song-action-btn');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeSong(song.id);
            });
            
            this.playlistContainer.appendChild(songEl);
        });
        
        this.updatePlaylistHighlight();
    }

    updatePlaylistHighlight() {
        const songItems = document.querySelectorAll('.song-item');
        songItems.forEach((item, index) => {
            item.classList.toggle('playing', index === this.currentSongIndex);
        });
    }

    async removeSong(songId) {
        try {
            if (this.db) {
                const transaction = this.db.transaction(['songs'], 'readwrite');
                const store = transaction.objectStore('songs');
                
                await new Promise((resolve, reject) => {
                    const request = store.delete(songId);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }
            
            const songIndex = this.originalSongs.findIndex(song => song.id === songId);
            if (songIndex >= 0) {
                const song = this.originalSongs[songIndex];
                this.originalSongs.splice(songIndex, 1);
                
                this.songs = this.songs.filter(s => s.id !== songId);
                this.filteredSongs = this.filteredSongs.filter(s => s.id !== songId);
                
                if (this.currentSongIndex >= songIndex) {
                    this.currentSongIndex = Math.max(0, this.currentSongIndex - 1);
                }
                
                this.renderPlaylist();
                this.showToast(`Removed "${song.title}" from playlist`);
                
                if (song.source === 'local' && song.audioUrl && song.audioUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(song.audioUrl);
                }
                
                if (this.filteredSongs.length === 0) {
                    this.showEmptyState();
                }
            }
            
        } catch (error) {
            console.error('Error removing song:', error);
            this.showToast('Error removing song', 'error');
        }
    }

    // Context menu methods
    handleContextMenu(e) {
        if (e.target.closest('.song-item')) {
            e.preventDefault();
            this.showContextMenu(e.clientX, e.clientY);
        }
    }

    showContextMenu(x, y) {
        if (this.contextMenu) {
            this.contextMenu.style.left = x + 'px';
            this.contextMenu.style.top = y + 'px';
            this.contextMenu.classList.remove('hidden');
        }
    }

    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.classList.add('hidden');
        }
    }

    // Visualizer methods
    startVisualizer() {
        const bars = document.querySelectorAll('.visualizer-bar');
        
        setInterval(() => {
            if (this.isPlaying) {
                bars.forEach(bar => {
                    const height = Math.random() * 40 + 4;
                    bar.style.height = height + 'px';
                });
            } else {
                bars.forEach(bar => {
                    bar.style.height = '4px';
                });
            }
        }, 150);
    }

    // Utility methods
    showToast(message, type = 'info') {
        if (!this.toastContainer) {
            this.toastContainer = document.createElement('div');
            this.toastContainer.id = 'toastContainer';
            this.toastContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
            `;
            document.body.appendChild(this.toastContainer);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        
        let icon;
        switch(type) {
            case 'success': icon = 'fas fa-check'; break;
            case 'error': icon = 'fas fa-exclamation-triangle'; break;
            case 'warning': icon = 'fas fa-exclamation'; break;
            default: icon = 'fas fa-info';
        }
        
        toast.innerHTML = `
            <div class="toast-content">
                <i class="${icon}"></i>
                <span>${message}</span>
            </div>
        `;
        
        if (!document.querySelector('#toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                .toast {
                    background: var(--bg-secondary, #333);
                    color: var(--text-primary, #fff);
                    padding: 12px 16px;
                    margin-bottom: 8px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    transform: translateX(100%);
                    transition: transform 0.3s ease;
                    pointer-events: auto;
                    max-width: 300px;
                }
                .toast--show { transform: translateX(0); }
                .toast--success { border-left: 4px solid #10b981; }
                .toast--error { border-left: 4px solid #ef4444; }
                .toast--warning { border-left: 4px solid #f59e0b; }
                .toast--info { border-left: 4px solid #3b82f6; }
                .toast-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .web-playback-indicator {
                    font-size: 0.8em;
                    opacity: 0.7;
                    margin-left: 4px;
                }
            `;
            document.head.appendChild(style);
        }
        
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => toast.classList.add('toast--show'), 100);
        
        setTimeout(() => {
            toast.classList.remove('toast--show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 3000);
    }

    showLoading(message) {
        console.log('Loading:', message);
    }

    hideLoading() {
        console.log('Loading hidden');
    }

    formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Initialize the complete enhanced music player when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.musicPlayerInstance = new MusicPlayer();
        window.player = window.musicPlayerInstance;
        console.log('🎵 Complete Enhanced SoundWave Music Player with Spotify Web Playback SDK and Optimized Playback initialized successfully');
    } catch (error) {
        console.error('❌ Error creating complete enhanced music player:', error);
    }
});