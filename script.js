// --- Configuration ---
const isAdGateEnabled = false;
const areAnimationsEnabled = true;

// --- Ad Gate System ---
document.addEventListener('DOMContentLoaded', () => {
    if (!isAdGateEnabled) {
        const adGateOverlay = document.getElementById('ad-gate-overlay');
        if (adGateOverlay) adGateOverlay.style.display = 'none';
    } else {
        const adGateOverlay = document.getElementById('ad-gate-overlay');
        const unlockButton = document.getElementById('unlockButton');
        const adLink = 'https://www.profitableratecpm.com/yrygzszmx?key=b43ea4afe6263aed815797a0ebb4f75d';
        const storageKey = 'lastAdUnlockTime';
        const twentyFourHours = 24 * 60 * 60 * 1000;
        const lastUnlockTime = localStorage.getItem(storageKey);
        const currentTime = new Date().getTime();

        if (lastUnlockTime && (currentTime - lastUnlockTime < twentyFourHours)) {
            adGateOverlay.style.display = 'none';
        } else {
            adGateOverlay.style.display = 'flex';
        }

        unlockButton.addEventListener('click', () => {
            const adWindow = window.open(adLink, '_blank');
            unlockButton.textContent = "Please wait 10 seconds...";
            unlockButton.disabled = true;

            let timeWaited = 0;
            const requiredWaitTime = 10;

            const timer = setInterval(() => {
                if (!adWindow || adWindow.closed) {
                    clearInterval(timer);
                    alert("Please do not close the ad page before 10 seconds.");
                    window.location.href = adLink;
                    return;
                }
                timeWaited++;
                unlockButton.textContent = `Waiting... ${requiredWaitTime - timeWaited}s`;
                if (timeWaited >= requiredWaitTime) {
                    clearInterval(timer);
                    localStorage.setItem(storageKey, new Date().getTime());
                    adGateOverlay.style.display = 'none';
                    try {
                        adWindow.close();
                    } catch (e) {
                        console.warn("Could not close ad window.");
                    }
                }
            }, 1000);
        });
    }
});

// --- Element References ---
const player = videojs('video', {
    controls: true,
    autoplay: true,
    preload: 'auto',
    fluid: true
});

const channelList = document.getElementById("channelList");
const searchInput = document.getElementById("search");
const qualitySelector = document.getElementById("qualitySelector");
const listViewBtn = document.getElementById("listViewBtn");
const gridViewBtn = document.getElementById("gridViewBtn");
const toastNotification = document.getElementById("toastNotification");
const loadingSpinner = document.getElementById("loadingSpinner");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const categoryFilter = document.getElementById("categoryFilter");
const sortSelector = document.getElementById("sortSelector");

// --- App State ---
const appState = {
    allChannels: [],
    currentFilteredChannels: [],
    pageToLoad: 1,
    isLoading: false,
    currentChannelIndex: -1,
    pressTimer: null,
    isLongPress: false,
    CHANNELS_PER_LOAD: 40,
    brightness: 1,
    volume: 1
};

// --- NEW: Session Persistence Keys ---
const LAST_PLAYED_INDEX_KEY = 'lastPlayedChannelIndex';
const LAST_PLAYBACK_TIME_KEY = 'lastPlaybackTime';

// --- Playlist URLs ---
const playlistUrls = [
    "https://raw.githubusercontent.com/jiocreator/streaming/refs/heads/main/streams/live-events.m3u",
    "https://cdn.jsdelivr.net/gh/jiocreator/streaming@main/streams/quran-bangla.m3u",
    "https://cdn.jsdelivr.net/gh/jiocreator/streaming@main/streams/channels.m3u",
    "https://cdn.jsdelivr.net/gh/jiocreator/streaming@main/streams/vod.m3u",
    "https://cdn.jsdelivr.net/gh/jiocreator/streaming@main/streams/movies.m3u",
    "https://cdn.jsdelivr.net/gh/jiocreator/streaming@main/streams/dirilis-ertugrul.m3u",
    "https://cdn.jsdelivr.net/gh/jiocreator/streaming@main/streams/kurulus-osman.m3u",
    "https://cdn.jsdelivr.net/gh/jiocreator/streaming@main/streams/alp-arsalan.m3u",
    "https://cdn.jsdelivr.net/gh/jiocreator/streaming@main/streams/the-great-seljuk.m3u",
];

// --- Lazy Loading Images ---
const lazyImageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) img.src = img.dataset.src;
            img.classList.remove("lazy");
            observer.unobserve(img);
        }
    });
});

// --- Custom Dropdown Logic ---
function initializeCustomSelects() {
    window.addEventListener('click', e => {
        document.querySelectorAll('.custom-select.open').forEach(select => {
            if (!select.contains(e.target)) {
                select.classList.remove('open');
            }
        });
    });
    document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const optionsContainer = wrapper.querySelector('.custom-options');
        const selectContainer = wrapper.querySelector('.custom-select');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-select.open').forEach(openSelect => {
                if (openSelect !== selectContainer) openSelect.classList.remove('open');
            });
            selectContainer.classList.toggle('open');
        });
        optionsContainer.addEventListener('click', e => {
            if (e.target.classList.contains('custom-option')) {
                trigger.querySelector('span').textContent = e.target.textContent;
                selectContainer.dataset.value = e.target.dataset.value;
                optionsContainer.querySelector('.selected')?.classList.remove('selected');
                e.target.classList.add('selected');
                selectContainer.classList.remove('open');
                setupInitialView();
            }
        });
    });
}

// --- Core Functions ---

async function loadAllPlaylists() {
    console.log("🚀 Starting to load all playlists...");
    channelList.innerHTML = '⏳ Loading Playlists...';
    try {
        const promises = playlistUrls.map(url => fetch(url).then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status} for ${url}`);
            return res.text();
        }));

        const results = await Promise.allSettled(promises);
        
        let combinedChannels = [];
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                console.log(`✅ Playlist loaded successfully: ${playlistUrls[index]}`);
                combinedChannels = combinedChannels.concat(parseM3U(result.value));
            } else if (result.status === 'rejected') {
                console.error(`❌ FAILED to load playlist: ${playlistUrls[index]}`, result.reason);
            }
        });
        
        console.log(`🎉 Total channels parsed: ${combinedChannels.length}`);
        appState.allChannels = combinedChannels;
        
        if (appState.allChannels.length === 0) {
            channelList.innerHTML = `<div style="color: #f44336; padding: 20px;">Could not load any channels. Please check network connection or console for errors.</div>`;
            return;
        }

        populateCategories();
        setupInitialView();
        restoreLastSession(); // --- NEW: Restore session after channels are loaded
    } catch (error) {
        console.error("A critical error occurred during playlist loading:", error);
        channelList.innerHTML = `<div style="color: #f44336; padding: 20px;">A critical error occurred. Please check console.</div>`;
    }
}

function parseM3U(data) {
    const lines = data.split("\n");
    let channels = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("#EXTINF")) {
            try {
                const meta = lines[i];
                const url = lines[i + 1]?.trim();
                if (!url) continue;
                const nameMatch = meta.match(/,(.*)$/);
                const logoMatch = meta.match(/tvg-logo="(.*?)"/);
                const groupMatch = meta.match(/group-title="(.*?)"/);
                channels.push({
                    name: nameMatch ? nameMatch[1].trim() : "Unnamed Channel",
                    logo: logoMatch ? logoMatch[1] : "",
                    group: groupMatch ? groupMatch[1].trim() : "General",
                    url: url
                });
            } catch (e) {
                console.warn("Skipping a malformed M3U entry.");
            }
        }
    }
    return channels;
}

function setupInitialView() {
    console.log("🔄 Setting up view...");
    const search = searchInput.value.toLowerCase().trim();
    const selectedGroup = categoryFilter.dataset.value || "";
    const sortOrder = sortSelector.dataset.value || "default";

    let tempChannels = [...appState.allChannels];

    if (selectedGroup === "Favorites") {
        tempChannels = getFavorites();
    } else if (selectedGroup !== "") {
        tempChannels = tempChannels.filter(ch => ch.group === selectedGroup);
    }
    if (search) {
        tempChannels = tempChannels.filter(ch => ch.name.toLowerCase().includes(search));
    }

    if (sortOrder === 'az') {
        tempChannels.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === 'za') {
        tempChannels.sort((a, b) => b.name.localeCompare(a.name));
    }

    appState.currentFilteredChannels = tempChannels;
    console.log(`📺 Found ${appState.currentFilteredChannels.length} channels for the current view.`);

    channelList.innerHTML = "";
    appState.pageToLoad = 1;
    loadMoreChannels();
}

function loadMoreChannels() {
    if (appState.isLoading) return;
    appState.isLoading = true;
    loadingSpinner.style.display = 'block';

    const startIndex = (appState.pageToLoad - 1) * appState.CHANNELS_PER_LOAD;
    const channelsToRender = appState.currentFilteredChannels.slice(startIndex, startIndex + appState.CHANNELS_PER_LOAD);
    
    if (channelsToRender.length === 0 && appState.pageToLoad === 1) {
        channelList.innerHTML = `<div style="padding: 20px; text-align: center;">No content found.</div>`;
    }

    channelsToRender.forEach(ch => {
        const div = document.createElement("div");
        div.className = "channel";
        div.dataset.index = appState.allChannels.findIndex(c => c.url === ch.url);
        
        const img = document.createElement("img");
        img.dataset.src = ch.logo || "https://via.placeholder.com/50";
        img.classList.add("lazy");
        img.onerror = () => { img.src = "https://via.placeholder.com/50"; };
        lazyImageObserver.observe(img);
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "channel-name";
        nameSpan.textContent = ch.name;
        
        const playingIndicator = document.createElement("div");
        playingIndicator.className = 'playing-indicator';
        playingIndicator.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        
        div.append(img, nameSpan, playingIndicator);
        channelList.appendChild(div);
    });

    appState.pageToLoad++;
    appState.isLoading = false;
    loadingSpinner.style.display = 'none';
}

// --- MODIFIED: playStream now saves the channel index ---
function playStream(channel, index) {
    if (!channel) return;
    if (channel.name) document.title = `${channel.name} - Streaming`;
    appState.currentChannelIndex = index;
    
    // --- NEW: Save the index of the currently playing channel ---
    localStorage.setItem(LAST_PLAYED_INDEX_KEY, index);

    document.querySelector('.channel.is-playing')?.classList.remove('is-playing', 'active');
    
    const activeElement = document.querySelector(`.channel[data-index="${index}"]`);
    if (activeElement) {
        activeElement.classList.add('active', 'is-playing');
    }
    
    player.src({ src: channel.url });
    player.one('loadedmetadata', () => {
        const qualityLevels = player.qualityLevels();
        renderQualitySelector(qualityLevels);
        qualityLevels.off('addqualitylevel');
        qualityLevels.on('addqualitylevel', () => renderQualitySelector(qualityLevels));
    });
}

// --- NEW: Function to restore the last played session ---
function restoreLastSession() {
    const lastIndex = localStorage.getItem(LAST_PLAYED_INDEX_KEY);
    const lastTime = localStorage.getItem(LAST_PLAYBACK_TIME_KEY);

    // Check if a valid index is stored and if that channel exists
    if (lastIndex !== null && appState.allChannels[lastIndex]) {
        const channelToRestore = appState.allChannels[lastIndex];
        console.log(`🔄 Resuming last session: Playing '${channelToRestore.name}'`);
        
        // Play the stream but don't autoplay it immediately, we'll handle it
        playStream(channelToRestore, parseInt(lastIndex, 10));

        // Wait for the video to be ready to play before seeking
        player.one('canplay', () => {
            if (lastTime) {
                const seekTime = parseFloat(lastTime);
                player.currentTime(seekTime);
                console.log(`⏩ Seeking to saved time: ${seekTime.toFixed(2)}s`);
            }
            player.play(); // Now, play the video
        });
        showToast(`Resuming: ${channelToRestore.name}`);
    }
}

function renderQualitySelector(qualityLevels) {
    qualitySelector.innerHTML = "";
    const validLevels = Array.from(qualityLevels).filter(level => level.height);
    if (validLevels.length <= 1) return;
    validLevels.sort((a, b) => a.height - b.height);
    const autoBtn = document.createElement("button");
    autoBtn.textContent = "Auto";
    autoBtn.onclick = () => {
        for (let i = 0; i < qualityLevels.length; i++) qualityLevels[i].enabled = true;
        showToast('Auto quality selected');
    };
    qualitySelector.appendChild(autoBtn);
    validLevels.forEach(level => {
        const btn = document.createElement("button");
        btn.textContent = `${level.height}p`;
        btn.onclick = () => {
            for (let i = 0; i < qualityLevels.length; i++) qualityLevels[i].enabled = false;
            level.enabled = true;
            showToast(`${level.height}p quality selected`);
        };
        qualitySelector.appendChild(btn);
    });
}

function populateCategories() {
    const optionsContainer = categoryFilter.querySelector('.custom-options');
    optionsContainer.innerHTML = '';
    
    const allOpt = document.createElement("span");
    allOpt.className = "custom-option selected";
    allOpt.dataset.value = "";
    allOpt.textContent = "All Categories";
    optionsContainer.appendChild(allOpt);
    
    const favOpt = document.createElement("span");
    favOpt.className = "custom-option";
    favOpt.dataset.value = "Favorites";
    favOpt.textContent = "⭐ Favorites";
    optionsContainer.appendChild(favOpt);
    
    const groups = [...new Set(appState.allChannels.map(ch => ch.group).filter(Boolean))];
    groups.sort((a, b) => a.localeCompare(b));
    groups.forEach(group => {
        const opt = document.createElement("span");
        opt.className = "custom-option";
        opt.dataset.value = group;
        opt.textContent = group;
        optionsContainer.appendChild(opt);
    });
}

function setView(view) {
    channelList.className = view === 'grid' ? 'grid-view' : 'list-view';
    gridViewBtn.classList.toggle('active', view === 'grid');
    listViewBtn.classList.toggle('active', view !== 'grid');
    localStorage.setItem('preferredView', view);
}

function showToast(message) {
    toastNotification.textContent = message;
    toastNotification.classList.add('show');
    setTimeout(() => toastNotification.classList.remove('show'), 2500);
}

function getFavorites() {
    return JSON.parse(localStorage.getItem('myFavoriteChannels')) || [];
}

function saveFavorites(favorites) {
    localStorage.setItem('myFavoriteChannels', JSON.stringify(favorites));
}

function toggleFavorite(channel) {
    if (!channel) return;
    let favorites = getFavorites();
    const index = favorites.findIndex(fav => fav.url === channel.url);
    if (index > -1) {
        favorites.splice(index, 1);
        showToast(`'${channel.name}' removed from Favorites`);
    } else {
        favorites.push(channel);
        showToast(`'${channel.name}' added to Favorites!`);
    }
    saveFavorites(favorites);
    if (categoryFilter.dataset.value === 'Favorites') setupInitialView();
}

function playNext() {
    if (appState.currentFilteredChannels.length < 1) return;
    const currentItem = appState.allChannels[appState.currentChannelIndex];
    let currentIndexInFiltered = currentItem ? appState.currentFilteredChannels.findIndex(c => c.url === currentItem.url) : -1;
    const nextIndexInFiltered = (currentIndexInFiltered + 1) % appState.currentFilteredChannels.length;
    const nextChannel = appState.currentFilteredChannels[nextIndexInFiltered];
    if (!nextChannel) return;
    const nextGlobalIndex = appState.allChannels.findIndex(c => c.url === nextChannel.url);
    if (nextGlobalIndex > -1) playStream(appState.allChannels[nextGlobalIndex], nextGlobalIndex);
}

function playPrevious() {
    if (appState.currentFilteredChannels.length < 1) return;
    const currentItem = appState.allChannels[appState.currentChannelIndex];
    let currentIndexInFiltered = currentItem ? appState.currentFilteredChannels.findIndex(c => c.url === currentItem.url) : 0;
    let prevIndexInFiltered = currentIndexInFiltered - 1;
    if (prevIndexInFiltered < 0) prevIndexInFiltered = appState.currentFilteredChannels.length - 1;
    const prevChannel = appState.currentFilteredChannels[prevIndexInFiltered];
    if (!prevChannel) return;
    const prevGlobalIndex = appState.allChannels.findIndex(c => c.url === prevChannel.url);
    if (prevGlobalIndex > -1) playStream(appState.allChannels[prevGlobalIndex], prevGlobalIndex);
}

// --- Gesture Controls for Volume and Brightness in Fullscreen ---
let touchStartY = 0;
let touchStartX = 0;
let isGesturing = false;
let gestureSide = null;
let brightnessIndicator, volumeIndicator;

function createGestureOverlays() {
    const videoWrapper = document.querySelector('.video-section-wrapper');
    const overlay = document.createElement('div');
    overlay.className = 'gesture-overlay';
    overlay.innerHTML = `
        <div id="brightnessIndicator" class="gesture-indicator" style="display: none;">
            Brightness: <span id="brightnessValue">100%</span>
            <div class="progress-bar">
                <div class="progress" id="brightnessProgress" style="width: 100%;"></div>
            </div>
        </div>
        <div id="volumeIndicator" class="gesture-indicator" style="display: none;">
            Volume: <span id="volumeValue">100%</span>
            <div class="progress-bar">
                <div class="progress" id="volumeProgress" style="width: 100%;"></div>
            </div>
        </div>
    `;
    videoWrapper.appendChild(overlay);
    brightnessIndicator = document.getElementById('brightnessIndicator');
    volumeIndicator = document.getElementById('volumeIndicator');
}

function handleTouchStart(e) {
    if (!player.isFullscreen()) return;
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    isGesturing = true;
    const videoWidth = player.el().offsetWidth;
    gestureSide = touchStartX < videoWidth / 2 ? 'left' : 'right';
}

function handleTouchMove(e) {
    if (!isGesturing || !player.isFullscreen()) return;
    const touchY = e.touches[0].clientY;
    const deltaY = touchStartY - touchY;
    const sensitivity = 2;
    const change = deltaY / player.el().offsetHeight * sensitivity;

    if (gestureSide === 'left') {
        appState.brightness = Math.max(0.1, Math.min(2, appState.brightness + change));
        player.el().style.filter = `brightness(${appState.brightness})`;
        const percent = Math.round(appState.brightness * 100);
        document.getElementById('brightnessValue').textContent = `${percent}%`;
        document.getElementById('brightnessProgress').style.width = `${percent}%`;
        brightnessIndicator.style.display = 'flex';
    } else if (gestureSide === 'right') {
        appState.volume = Math.max(0, Math.min(1, appState.volume + change));
        player.volume(appState.volume);
        const percent = Math.round(appState.volume * 100);
        document.getElementById('volumeValue').textContent = `${percent}%`;
        document.getElementById('volumeProgress').style.width = `${percent}%`;
        volumeIndicator.style.display = 'flex';
    }
}

function handleTouchEnd() {
    isGesturing = false;
    setTimeout(() => {
        brightnessIndicator.style.display = 'none';
        volumeIndicator.style.display = 'none';
    }, 1000);
}

// --- Event Listeners ---
const startPress = (event) => {
    const channelDiv = event.target.closest('.channel');
    if (!channelDiv) return;
    appState.isLongPress = false;
    appState.pressTimer = setTimeout(() => {
        appState.isLongPress = true;
        const channel = appState.allChannels[channelDiv.dataset.index];
        toggleFavorite(channel);
    }, 1000);
};
const cancelPress = () => clearTimeout(appState.pressTimer);
const handleClick = (event) => {
    const channelDiv = event.target.closest('.channel');
    if (channelDiv && !appState.isLongPress) {
        const channel = appState.allChannels[channelDiv.dataset.index];
        if (channel) playStream(channel, parseInt(channelDiv.dataset.index, 10));
    }
};

channelList.addEventListener('mousedown', startPress);
channelList.addEventListener('mouseup', cancelPress);
channelList.addEventListener('mouseleave', cancelPress);
channelList.addEventListener('click', handleClick);
channelList.addEventListener('touchstart', startPress, { passive: true });
channelList.addEventListener('touchend', cancelPress);
channelList.addEventListener('touchmove', cancelPress);

channelList.addEventListener('scroll', () => {
    if (channelList.scrollTop + channelList.clientHeight >= channelList.scrollHeight - 400) {
        loadMoreChannels();
    }
});

// --- MODIFIED: player 'ended' event handler now clears session data ---
player.on('ended', () => {
    // Clear the keys so it doesn't try to resume a finished video
    localStorage.removeItem(LAST_PLAYED_INDEX_KEY);
    localStorage.removeItem(LAST_PLAYBACK_TIME_KEY);
    playNext();
});

// --- NEW: Periodically save the video's current time ---
let lastTimeUpdate = 0;
player.on('timeupdate', () => {
    // Throttle updates to every 5 seconds to avoid excessive localStorage writes
    const now = Date.now();
    if (now - lastTimeUpdate > 5000) {
        const currentTime = player.currentTime();
        // Only save if playback has started (currentTime > 0)
        if (currentTime > 0) {
            localStorage.setItem(LAST_PLAYBACK_TIME_KEY, currentTime);
        }
        lastTimeUpdate = now;
    }
});


searchInput.addEventListener("input", setupInitialView);
listViewBtn.addEventListener('click', () => setView('list'));
gridViewBtn.addEventListener('click', () => setView('grid'));
prevBtn.addEventListener('click', playPrevious);
nextBtn.addEventListener('click', playNext);

player.on('fullscreenchange', function() {
    try {
        if (player.isFullscreen()) {
            screen.orientation.lock('landscape');
        } else {
            screen.orientation.unlock();
        }
    } catch (e) {
        console.warn("Screen Orientation API not fully supported.", e);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    setView(localStorage.getItem('preferredView') || 'list');
    initializeCustomSelects();
    loadAllPlaylists(); // This will now also trigger session restoration
    if (!areAnimationsEnabled) {
        document.body.classList.add('animations-disabled');
    }
    const adsterraDirectLink = 'https://www.profitableratecpm.com/yrygzszmx?key=b43ea4afe6263aed815797a0ebb4f75d';
    const storageKey = 'lastAdRedirectTime';
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const lastAdTime = localStorage.getItem(storageKey);
    const currentTime = new Date().getTime();
    if (!lastAdTime || (currentTime - lastAdTime > twentyFourHours)) {
        document.body.addEventListener('click', function handleFirstClick() {
            window.open(adsterraDirectLink, '_blank');
            localStorage.setItem(storageKey, currentTime);
            document.body.removeEventListener('click', handleFirstClick);
        }, { once: true });
    }

    createGestureOverlays();
    const videoEl = player.el();
    videoEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    videoEl.addEventListener('touchmove', handleTouchMove, { passive: true });
    videoEl.addEventListener('touchend', handleTouchEnd);
});

document.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'INPUT') return;
    switch (event.key) {
        case 'ArrowRight': playNext(); break;
        case 'ArrowLeft': playPrevious(); break;
    }
});

document.addEventListener('mouseup', (event) => {
    if (event.button === 3) playPrevious();
    if (event.button === 4) playNext();
});

document.getElementById('currentYear').textContent = new Date().getFullYear();
