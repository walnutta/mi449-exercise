const CLIENT_ID = (window.CONFIG && window.CONFIG.CLIENT_ID) || '1033134295530-pi2h820jain283909outp94cj8gbc0hb.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/youtube';

const authorizeButton = document.getElementById('authorize-button');
const signoutButton = document.getElementById('signout-button');
const content = document.getElementById('content');
const statusMessage = document.getElementById('status');
const container = document.getElementById('song-container');
const createPlaylistBtn = document.getElementById('create-playlist-button');
const playlistTitleInput = document.getElementById('playlist-title');

let tokenClient;
let accessToken = null;

// Helper to call YouTube REST endpoints with fetch
async function youtubeFetch(endpoint, params = {}, method = 'GET', body = null) {
    if (!accessToken) throw new Error('No access token');
    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, params[key]);
        }
    });

    const res = await fetch(url.toString(), {
        method,
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Accept': 'application/json',
            'Content-Type': body ? 'application/json' : 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || err.message || res.statusText);
    }

    return res.json();
}

// Initialize gapi
gapi.load('client', async () => {
    await gapi.client.init({
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest']
    });
    
});

// Initialize Google OAuth2
function initializeGSI() {
    // Create OAuth2 token client
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
            if (response.error) {
                console.error(response);
                statusMessage.textContent = 'Error signing in: ' + response.error;
                return;
            }
            accessToken = response.access_token;
            gapi.client.setToken({access_token: accessToken});
            
            // Update UI
            statusMessage.textContent = 'Signed in successfully!';
            content.style.display = 'block';
            authorizeButton.style.display = 'none';
            signoutButton.style.display = 'block';
        }
    });

    // Render the Google Sign-In button
    google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleSignInWithGoogle
    });

    google.accounts.id.renderButton(
        authorizeButton,
        { 
            theme: 'outline', 
            size: 'large',
            text: 'signin_with',
            width: 250
        }
    );
}

// This handles the visual sign-in, then we request OAuth token
function handleSignInWithGoogle(response) {
    console.log('Signed in, now requesting YouTube permissions...');
    // After sign-in, request OAuth token for YouTube access
    tokenClient.requestAccessToken({prompt: 'consent'});
}

// Handle sign out
function handleSignoutClick() {
    if (accessToken) {
        google.accounts.oauth2.revoke(accessToken);
        gapi.client.setToken(null);
        accessToken = null;
        
        google.accounts.id.disableAutoSelect();
        
        statusMessage.textContent = 'Signed out successfully!';
        content.style.display = 'none';
        authorizeButton.style.display = 'block';
        signoutButton.style.display = 'none';
        container.innerHTML = '';
    }
}

function createInput() {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter song (press Enter for next)';
    input.className = 'song-input w-[100%] max-w-[600px] box-border px-4 py-2 mb-2 rounded border border-[#3772FF] bg-white text-black';
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            createInput();
            const inputs = container.querySelectorAll('.song-input');
            inputs[inputs.length - 1].focus();
        }
    });
    
    container.appendChild(input);
    return input;
}

async function createPlaylist() {
    const playlistTitle = playlistTitleInput.value.trim() || 'My Playlist';
    const songInputs = Array.from(document.querySelectorAll('.song-input'));
    const songNames = songInputs
        .map(input => input.value.trim())
        .filter(value => value !== '');
    
    if (songNames.length === 0) {
        statusMessage.textContent = 'Please add at least one song!';
        return;
    }
    
    statusMessage.textContent = 'Creating playlist...';
    createPlaylistBtn.disabled = true;
    
    try {
        // Create the playlist via REST
        const playlistResponse = await youtubeFetch('playlists', { part: 'snippet,status' }, 'POST', {
            snippet: {
                title: playlistTitle,
                description: 'Created with Playlist Creator'
            },
            status: { privacyStatus: 'private' }
        });

        const playlistId = playlistResponse.id;
        statusMessage.textContent = `Playlist created! Adding ${songNames.length} songs...`;

        // Search and add each song
        for (let i = 0; i < songNames.length; i++) {
            statusMessage.textContent = `Adding song ${i + 1} of ${songNames.length}: ${songNames[i]}`;

            // Search for the video via REST
            const searchResponse = await youtubeFetch('search', {
                part: 'snippet',
                q: songNames[i],
                type: 'video',
                videoCategoryId: '10',
                order: 'relevance',
                maxResults: 1
            });

            if (!searchResponse.items || searchResponse.items.length === 0) {
                console.log(`No results found for: ${songNames[i]}`);
                continue;
            }

            const videoId = searchResponse.items[0].id.videoId;

            // Add video to playlist via REST
            await youtubeFetch('playlistItems', { part: 'snippet' }, 'POST', {
                snippet: {
                    playlistId: playlistId,
                    resourceId: { kind: 'youtube#video', videoId: videoId }
                }
            });

            await new Promise(resolve => setTimeout(resolve, 200));
        }

        statusMessage.innerHTML = `✅ Success! <a href="https://www.youtube.com/playlist?list=${playlistId}" target="_blank">View your playlist on YouTube</a>`;

    } catch (error) {
        statusMessage.textContent = 'Error: ' + (error.result?.error?.message || error.message);
        console.error(error);
    } finally {
        createPlaylistBtn.disabled = false;
    }
}

// Add event listeners for the Reflection modal
const reflectionToggle = document.getElementById('reflection-toggle');
const reflectionModal = document.getElementById('reflection-modal');
const closeReflection = document.getElementById('close-reflection');

reflectionToggle.addEventListener('click', () => {
    reflectionModal.classList.remove('hidden');
});

closeReflection.addEventListener('click', () => {
    reflectionModal.classList.add('hidden');
});

// Event listeners
signoutButton.addEventListener('click', handleSignoutClick);
createPlaylistBtn.addEventListener('click', createPlaylist);

// Initialize everything on page load
initializeGSI();
createInput();