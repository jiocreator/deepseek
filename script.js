// --- Configuration ---
const isAdGateEnabled = true;
const areAnimationsEnabled = true;

// --- Element References ---
const player = videojs('video', { controls: true, autoplay: true, preload: 'auto', fluid: true, html5: { vhs: { overrideNative: true, withCredentials: false } } });
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
const themeToggle = document.getElementById('themeToggle');
const body = document.body;
const iframeEl = document.getElementById('iframePlayer');
const iframeContainer = document.getElementById('iframeContainer');
const customFullscreenBtn = document.getElementById('customFullscreenBtn');
const adGateOverlay = document.getElementById('ad-gate-overlay');
const unlockButton = document.getElementById('unlockButton');
// NEW: Match Spotlight elements
const matchSpotlightOverlay = document.getElementById('match-spotlight-overlay');
const matchSpotlightList = document.getElementById('match-spotlight-list');
const skipSpotlightBtn = document.getElementById('skipSpotlightBtn');

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
    matchUpdateInterval: null,
};

// --- Persistence Keys ---
const LAST_PLAYED_INDEX_KEY = 'lastPlayedChannelIndex';
const LAST_PLAYBACK_TIME_KEY = 'lastPlaybackTime';
const THEME_KEY = 'userPreferredTheme';

// --- Playlist URLs ---
const playlistUrls = [
    "https://raw.githubusercontent.com/jiocreator/io/refs/heads/main/live-events.m3u",
    "https://raw.githubusercontent.com/abusaeeidx/IPTV-Scraper-Zilla/main/CricHD.m3u",
    // Add other playlist URLs here
];

// --- Ad Gate System ---
document.addEventListener('DOMContentLoaded', () => {
    if (!isAdGateEnabled) {
        adGateOverlay.style.display = 'none';
        runPostAdGateLogic();
    } else {
        const adLink = 'https://www.profitableratecpm.com/yrygzszmx?key=b43ea4afe6263aed815797a0ebb4f75d';
        const storageKey = 'lastAdUnlockTime';
        const twentyFourHours = 24 * 60 * 60 * 1000;
        const lastUnlockTime = localStorage.getItem(storageKey);
        const currentTime = new Date().getTime();

        if (lastUnlockTime && (currentTime - lastUnlockTime < twentyFourHours)) {
            adGateOverlay.style.display = 'none';
            runPostAdGateLogic();
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
                    if (adWindow) try { adWindow.close(); } catch (e) {}
                    runPostAdGateLogic();
                }
            }, 1000);
        });
    }
});

function runPostAdGateLogic() {
    const specialMatches = appState.allChannels
        .filter(ch => ch.startTime && ch.endTime && new Date(ch.endTime) > new Date())
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    if (specialMatches.length > 0) {
        displayMatchSpotlight(specialMatches);
    } else {
        showMainContent();
    }
}

function showMainContent() {
    matchSpotlightOverlay.classList.add('hidden');
    body.classList.remove('player-focused-mode');
    populateCategories();
    setupInitialView();
    restoreLastSession();
}

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

// --- Theme Switcher Logic ---
function applyTheme(theme) {
    body.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    themeToggle.checked = theme === 'dark';
}

// --- Custom Dropdown Logic ---
function initializeCustomSelects() {
    window.addEventListener('click', e => {
        document.querySelectorAll('.custom-select.open').forEach(select => {
            if (!select.contains(e.target)) select.classList.remove('open');
        });
    });
    document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const optionsContainer = wrapper.querySelector('.custom-options');
        const selectContainer = wrapper.querySelector('.custom-select');

        trigger.addEventListener('click', e => {
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
    try {
        const promises = playlistUrls.map(url => fetch(url).then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status} for ${url}`);
            return res.text();
        }));
        const results = await Promise.allSettled(promises);
        let combinedChannels = [];
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                combinedChannels = combinedChannels.concat(parseM3U(result.value));
            } else if (result.status === 'rejected') {
                console.error(`❌ FAILED to load playlist: ${playlistUrls[index]}`, result.reason);
            }
        });
        console.log(`🎉 Total channels parsed: ${combinedChannels.length}`);
        appState.allChannels = combinedChannels;
        
        // This function is now called after the ad-gate logic
        // runPostAdGateLogic(); 
        
    } catch (error) {
        console.error("A critical error occurred during playlist loading:", error);
        channelList.innerHTML = `<div style="color: #f44336; padding: 20px;">A critical error occurred.</div>`;
    }
}

function parseM3U(data) {
    const lines = data.split("\n");
    let channels = [];
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("#EXTINF")) {
            try {
                const meta = line;
                const nameMatch = meta.match(/,(.+)$/);
                const logoMatch = meta.match(/tvg-logo="([^"]*)"/);
                const groupMatch = meta.match(/group-title="([^"]*)"/);
                const typeMatch = meta.match(/tvg-type="([^"]*)"/);
                // NEW: Parse match start and end times
                const startMatch = meta.match(/match-start="([^"]*)"/);
                const endMatch = meta.match(/match-end="([^"]*)"/);

                currentChannel = {
                    name: nameMatch ? nameMatch[1].trim().split('|')[0] : "Unnamed Channel",
                    logo: logoMatch ? logoMatch[1] : "",
                    group: groupMatch ? groupMatch[1].trim() : "General",
                    type: typeMatch ? typeMatch[1].trim() : "stream",
                    startTime: startMatch ? new Date(startMatch[1]) : null,
                    endTime: endMatch ? new Date(endMatch[1]) : null,
                    url: null,
                    userAgent: null
                };
            } catch (e) {
                console.warn("Skipping a malformed M3U entry.", e);
                currentChannel = null;
            }
        } else if (line.startsWith("#EXTVLCOPT:http-user-agent=") && currentChannel) {
            const userAgentMatch = line.match(/#EXTVLCOPT:http-user-agent=(.+)$/);
            if (userAgentMatch) currentChannel.userAgent = userAgentMatch[1].trim();
        } else if (line && !line.startsWith('#') && currentChannel) {
            let channelURL = line;
            if (line.includes("|<iframe")) {
                const parts = line.split("|<iframe");
                channelURL = parts[0].trim();
                const iframeTag = "<iframe" + parts[1];
                const srcMatch = iframeTag.match(/src="([^"]*)"/);
                if (srcMatch && srcMatch[1]) {
                    channelURL = srcMatch[1];
                    currentChannel.type = "iframe";
                }
            }
            currentChannel.url = channelURL;
            channels.push(currentChannel);
            currentChannel = null;
        }
    }
    return channels;
}

// --- NEW: Match Spotlight Feature Logic ---
function getMatchStatus(startTime, endTime) {
    const now = new Date();
    if (now > endTime) return { status: 'Ended', text: 'Match Ended' };
    if (now < startTime) {
        const diff = startTime - now;
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff / 1000 / 60) % 60);
        return { status: 'Upcoming', text: `Starts in ${h}h ${m}m` };
    }
    return { status: 'Ongoing', text: '🔴 Ongoing' };
}

function updateSpotlightTimers() {
    document.querySelectorAll('.spotlight-item').forEach(item => {
        const index = parseInt(item.dataset.index, 10);
        const channel = appState.allChannels[index];
        if (!channel || !channel.startTime) return;

        const statusInfo = getMatchStatus(new Date(channel.startTime), new Date(channel.endTime));
        const statusBadge = item.querySelector('.status-badge');

        if (statusBadge.textContent !== statusInfo.text) {
            statusBadge.textContent = statusInfo.text;
            statusBadge.className = 'status-badge'; // reset classes
            item.classList.remove('status-upcoming', 'status-ongoing', 'status-ended');
            
            statusBadge.classList.add(`status-${statusInfo.status.toLowerCase()}`);
            item.classList.add(`status-${statusInfo.status.toLowerCase()}`);
        }
    });
}

function displayMatchSpotlight(matches) {
    matchSpotlightList.innerHTML = '';
    matchSpotlightOverlay.classList.remove('hidden');

    matches.forEach((match, i) => {
        setTimeout(() => {
            const index = appState.allChannels.findIndex(ch => ch === match);
            const statusInfo = getMatchStatus(new Date(match.startTime), new Date(match.endTime));

            const item = document.createElement('div');
            item.className = `spotlight-item status-${statusInfo.status.toLowerCase()}`;
            item.dataset.index = index;
            
            item.innerHTML = `
                <img src="${match.logo || 'https://via.placeholder.com/60'}" class="channel-logo" onerror="this.src='https://via.placeholder.com/60'">
                <div class="spotlight-info">
                    <h3>${match.name}</h3>
                    <span class="status-badge status-${statusInfo.status.toLowerCase()}">${statusInfo.text}</span>
                </div>
                <i class="fa-solid fa-play fa-2x" style="color: var(--primary-color);"></i>
            `;
            
            matchSpotlightList.appendChild(item);
            
            // Trigger animation
            requestAnimationFrame(() => {
                item.classList.add('visible');
            });
            
            item.addEventListener('click', () => {
                if (statusInfo.status !== 'Ended') {
                    playStream(match, index);
                    body.classList.add('player-focused-mode');
                    matchSpotlightOverlay.classList.add('hidden');
                    if (appState.matchUpdateInterval) clearInterval(appState.matchUpdateInterval);
                }
            });
        }, i * 150); // Staggered animation delay
    });

    if (appState.matchUpdateInterval) clearInterval(appState.matchUpdateInterval);
    appState.matchUpdateInterval = setInterval(updateSpotlightTimers, 30000); // Update every 30 seconds
}

// --- Existing Functions (Modified/Unmodified) ---
function setupInitialView() {
    const search = searchInput.value.toLowerCase().trim();
    const selectedGroup = categoryFilter.dataset.value || "";
    const sortOrder = sortSelector.dataset.value || "default";
    let tempChannels = [...appState.allChannels];
    if (selectedGroup === "Favorites") tempChannels = getFavorites();
    else if (selectedGroup) tempChannels = tempChannels.filter(ch => ch.group === selectedGroup);
    if (search) tempChannels = tempChannels.filter(ch => ch.name.toLowerCase().includes(search));
    if (sortOrder === 'az') tempChannels.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortOrder === 'za') tempChannels.sort((a, b) => b.name.localeCompare(a.name));
    appState.currentFilteredChannels = tempChannels;
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
        div.dataset.index = appState.allChannels.findIndex(c => c === ch);
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

function playStream(channel, index) {
    if (!channel) return;
    document.title = `${channel.name} - Streaming`;
    appState.currentChannelIndex = index;
    localStorage.setItem(LAST_PLAYED_INDEX_KEY, index);
    document.querySelector('.channel.is-playing')?.classList.remove('is-playing', 'active');
    const activeElement = document.querySelector(`.channel[data-index="${index}"]`);
    if (activeElement) activeElement.classList.add('active', 'is-playing');
    
    if (channel.type === 'stream') {
        player.el().style.display = '';
        iframeContainer.style.display = 'none';
        iframeEl.src = 'about:blank';
        qualitySelector.style.display = '';
        customFullscreenBtn.style.display = 'none';
        
        const source = { src: channel.url, type: 'application/x-mpegURL' };
        if (channel.userAgent) source.headers = { 'User-Agent': channel.userAgent };
        
        player.src(source);
        player.one('loadedmetadata', () => {
            const qualityLevels = player.qualityLevels();
            renderQualitySelector(qualityLevels);
            qualityLevels.off('addqualitylevel');
            qualityLevels.on('addqualitylevel', () => renderQualitySelector(qualityLevels));
        });
    } else if (channel.type === 'iframe') {
        player.pause();
        player.el().style.display = 'none';
        iframeContainer.style.display = 'block';
        iframeEl.src = channel.url;
        qualitySelector.innerHTML = '';
        qualitySelector.style.display = 'none';
        customFullscreenBtn.style.display = 'inline-flex';
    }
}

function restoreLastSession() {
    const lastIndex = localStorage.getItem(LAST_PLAYED_INDEX_KEY);
    if (lastIndex === null) return;
    
    const channelToRestore = appState.allChannels[lastIndex];
    if (channelToRestore && channelToRestore.startTime) {
        // Don't auto-play matches from the past
        const status = getMatchStatus(new Date(channelToRestore.startTime), new Date(channelToRestore.endTime));
        if (status.status === 'Ended') {
            localStorage.removeItem(LAST_PLAYED_INDEX_KEY);
            localStorage.removeItem(LAST_PLAYBACK_TIME_KEY);
            return;
        }
    }
    
    if (channelToRestore) {
        playStream(channelToRestore, parseInt(lastIndex, 10));
        player.one('canplay', () => {
            const lastTime = localStorage.getItem(LAST_PLAYBACK_TIME_KEY);
            if (lastTime) player.currentTime(parseFloat(lastTime));
            player.play();
        });
        showToast(`Resuming: ${channelToRestore.name}`);
    }
}

function renderQualitySelector(qualityLevels) {
    qualitySelector.innerHTML = "";
    const validLevels = Array.from(qualityLevels).filter(level => level.height).sort((a, b) => a.height - b.height);
    if (validLevels.length <= 1) return;
    const autoBtn = document.createElement("button");
    autoBtn.textContent = "Auto";
    autoBtn.onclick = () => {
        qualityLevels.forEach(level => level.enabled = true);
        showToast('Auto quality selected');
    };
    qualitySelector.appendChild(autoBtn);
    validLevels.forEach(level => {
        const btn = document.createElement("button");
        btn.textContent = `${level.height}p`;
        btn.onclick = () => {
            qualityLevels.forEach(l => l.enabled = (l === level));
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
    const groups = [...new Set(appState.allChannels.map(ch => ch.group).filter(Boolean))].sort();
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

function getFavorites() { return JSON.parse(localStorage.getItem('myFavoriteChannels')) || []; }
function saveFavorites(favorites) { localStorage.setItem('myFavoriteChannels', JSON.stringify(favorites)); }
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
    const nextGlobalIndex = appState.allChannels.findIndex(c => c === nextChannel);
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
    const prevGlobalIndex = appState.allChannels.findIndex(c => c === prevChannel);
    if (prevGlobalIndex > -1) playStream(appState.allChannels[prevGlobalIndex], prevGlobalIndex);
}

// --- Event Listeners ---
let isScrolling = false;
const startPress = (event) => {
    isScrolling = false;
    const channelDiv = event.target.closest('.channel');
    if (!channelDiv) return;
    appState.isLongPress = false;
    appState.pressTimer = setTimeout(() => {
        if (!isScrolling) {
            appState.isLongPress = true;
            toggleFavorite(appState.allChannels[channelDiv.dataset.index]);
        }
    }, 1000);
};
const cancelPress = () => clearTimeout(appState.pressTimer);
const handleClick = (event) => {
    const channelDiv = event.target.closest('.channel');
    if (channelDiv && !appState.isLongPress && !isScrolling) {
        const channelIndex = parseInt(channelDiv.dataset.index, 10);
        if (!isNaN(channelIndex)) playStream(appState.allChannels[channelIndex], channelIndex);
    }
    appState.isLongPress = false;
};
const handleMove = () => { isScrolling = true; clearTimeout(appState.pressTimer); };
channelList.addEventListener('mousedown', startPress);
channelList.addEventListener('mouseup', cancelPress);
channelList.addEventListener('mouseleave', cancelPress);
channelList.addEventListener('click', handleClick);
channelList.addEventListener('touchstart', startPress, { passive: true });
channelList.addEventListener('touchend', cancelPress);
channelList.addEventListener('touchmove', handleMove);
channelList.addEventListener('scroll', () => { if (channelList.scrollTop + channelList.clientHeight >= channelList.scrollHeight - 400) loadMoreChannels(); });
player.on('ended', playNext);
let lastTimeUpdate = 0;
player.on('timeupdate', () => {
    const now = Date.now();
    if (now - lastTimeUpdate > 5000) {
        if (player.currentTime() > 0) localStorage.setItem(LAST_PLAYBACK_TIME_KEY, player.currentTime());
        lastTimeUpdate = now;
    }
});
searchInput.addEventListener("input", setupInitialView);
listViewBtn.addEventListener('click', () => setView('list'));
gridViewBtn.addEventListener('click', () => setView('grid'));
prevBtn.addEventListener('click', playPrevious);
nextBtn.addEventListener('click', playNext);
skipSpotlightBtn.addEventListener('click', showMainContent);
customFullscreenBtn.addEventListener('click', () => { if (iframeContainer.style.display === 'block') iframeEl.requestFullscreen(); });
function handleFullscreenChange() {
    try {
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
        if (isFullscreen && screen.orientation && typeof screen.orientation.lock === 'function') screen.orientation.lock('landscape').catch(()=>{});
        else if (!isFullscreen && screen.orientation && typeof screen.orientation.unlock === 'function') screen.orientation.unlock();
    } catch (e) { console.warn("Screen Orientation API not fully supported.", e); }
}
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
    setView(localStorage.getItem('preferredView') || 'list');
    initializeCustomSelects();
    loadAllPlaylists();
});
document.addEventListener('keydown', (event) => { if (event.target.tagName !== 'INPUT') { if (event.key === 'ArrowRight') playNext(); if (event.key === 'ArrowLeft') playPrevious(); } });
document.addEventListener('mouseup', (event) => { if (event.button === 3) playPrevious(); if (event.button === 4) playNext(); });
document.getElementById('currentYear').textContent = new Date().getFullYear();
themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked ? 'dark' : 'light'));
