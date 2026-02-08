const CLIENT_ID = '1033134295530-pi2h820jain283909outp94cj8gbc0hb.apps.googleusercontent.com';

const authorizeButton = document.getElementById('authorize-button');
const signoutButton = document.getElementById('signout-button');
const content = document.getElementById('content');
const statusMessage = document.getElementById('status');
const container = document.getElementById('song-container');
const createPlaylistBtn = document.getElementById('create-playlist-button');
const playlistTitleInput = document.getElementById('playlist-title');

// Load the API client and auth2 library
function handleClientLoad() {
    gapi.load('client:auth2', initClient);
}

function initClient() {
    gapi.client.init({
        clientId: CLIENT_ID,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest'],
        scope: SCOPES
    }).then(() => {
        // Listen for sign-in state changes
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
        
        // Handle initial sign-in state
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        
        authorizeButton.onclick = handleAuthClick;
        signoutButton.onclick = handleSignoutClick;
    }).catch((error) => {
        statusMessage.textContent = 'Error loading Google API: ' + JSON.stringify(error);
    });
}

function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'block';
        content.style.display = 'block';
        statusMessage.textContent = 'Signed in successfully!';
        
        // Create first input if none exist
        if (container.children.length === 0) {
            createInput();
        }
    } else {
        authorizeButton.style.display = 'block';
        signoutButton.style.display = 'none';
        content.style.display = 'none';
        statusMessage.textContent = 'Please sign in to continue.';
    }
}

function handleAuthClick() {
    gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick() {
    google.accounts.id.disableAutoSelect();
    statusMessage.textContent = 'Signed out successfully!';
    content.style.display = 'none';
    authorizeButton.style.display = 'block';
    signoutButton.style.display = 'none';
}

function createInput() {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter song name (e.g., "Bohemian Rhapsody Queen")';
    input.className = 'song-input';
    
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
        // Create the playlist
        const playlistResponse = await gapi.client.youtube.playlists.insert({
            part: 'snippet,status',
            resource: {
                snippet: {
                    title: playlistTitle,
                    description: 'Created with Playlist Creator'
                },
                status: {
                    privacyStatus: 'private'
                }
            }
        });
        
        const playlistId = playlistResponse.result.id;
        statusMessage.textContent = `Playlist created! Adding ${songNames.length} songs...`;
        
        // Search and add each song
        for (let i = 0; i < songNames.length; i++) {
            statusMessage.textContent = `Adding song ${i + 1} of ${songNames.length}: ${songNames[i]}`;
            
            // Search for the video
            const searchResponse = await gapi.client.youtube.search.list({
                part: 'snippet',
                q: songNames[i],
                type: 'video',
                maxResults: 1
            });
            
            if (searchResponse.result.items.length === 0) {
                console.log(`No results found for: ${songNames[i]}`);
                continue;
            }
            
            const videoId = searchResponse.result.items[0].id.videoId;
            
            // Add video to playlist
            await gapi.client.youtube.playlistItems.insert({
                part: 'snippet',
                resource: {
                    snippet: {
                        playlistId: playlistId,
                        resourceId: {
                            kind: 'youtube#video',
                            videoId: videoId
                        }
                    }
                }
            });
            
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        statusMessage.innerHTML = `Success! <a href="https://www.youtube.com/playlist?list=${playlistId}" target="_blank">View your playlist on YouTube</a>`;
        
    } catch (error) {
        statusMessage.textContent = 'Error: ' + error.result.error.message;
        console.error(error);
    } finally {
        createPlaylistBtn.disabled = false;
    }
}

createPlaylistBtn.addEventListener('click', createPlaylist);

// Replacing deprecated gapi.auth2 with Google Identity Services (GIS)
function handleCredentialResponse(response) {
    console.log('Encoded JWT ID token: ' + response.credential);
    statusMessage.textContent = 'Signed in successfully!';
    content.style.display = 'block';
    authorizeButton.style.display = 'none';
    signoutButton.style.display = 'block';
}

function initializeGSI() {
    google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredentialResponse
    });

    google.accounts.id.renderButton(
        authorizeButton, // The button container
        { theme: 'outline', size: 'large' } // Button customization
    );

    google.accounts.id.prompt(); // Automatically prompt the user
}

// Initialize GIS on page load
initializeGSI();