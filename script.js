// --- Configuration ---
const isAdGateEnabled = true;
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
            if (!adWindow) {
                alert("পপ-আপ ব্লক করা হয়েছে। পপ-আপ অনুমতি দিন এবং আবার চেষ্টা করুন।");
                return;
            }
            unlockButton.textContent = "দয়া করে ১০ সেকেন্ড অপেক্ষা করুন...";
            unlockButton.disabled = true;
            let timeWaited = 0;
            const requiredWaitTime = 10;
            const timer = setInterval(() => {
                if (!adWindow || adWindow.closed) {
                    clearInterval(timer);
                    alert("দয়া করে অ্যাড পেজটি ১০ সেকেন্ডের আগে বন্ধ করবেন না।");
                    window.location.href = adLink;
                    return;
                }
                timeWaited++;
                unlockButton.textContent = `অপেক্ষা করুন... ${requiredWaitTime - timeWaited}সে`;
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
    fluid: true,
    html5: {
        vhs: {
            overrideNative: true,
            withCredentials: false
        }
    }
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
const themeToggle = document.getElementById('themeToggle');
const body = document.body;
const iframeEl = document.getElementById('iframePlayer');
const iframeContainer = document.getElementById('iframeContainer');
const customFullscreenBtn = document.getElementById('customFullscreenBtn');
const matchesSection = document.getElementById('matchesSection');
const matchesBox = document.getElementById('matchesBox');
const matchesInner = document.querySelector('.matches-inner');

// --- App State ---
const appState = {
    allChannels: [],
    currentFilteredChannels: [],
    pageToLoad: 1,
    isLoading: false,
    currentChannelIndex: -1,
    pressTimer: null,
    isLongPress: false,
    CHANNELS_PER_LOAD: 20,
    matches: []
};

// --- Persistence Keys ---
const LAST_PLAYED_INDEX_KEY = 'lastPlayedChannelIndex';
const LAST_PLAYBACK_TIME_KEY = 'lastPlaybackTime';
const THEME_KEY = 'userPreferredTheme';

// --- Playlist URLs ---
const playlistUrls = [
    "https://raw.githubusercontent.com/abusaeeidx/IPTV-Scraper-Zilla/main/CricHD.m3u",
    "streams/channel1.m3u",
    "streams/channels.m3u",
    "streams/dirilis-ertugrul.m3u",
    "streams/kurulus-osman.m3u",
    "streams/the-great-seljuk.m3u",
    "streams/alp-arsalan.m3u",
    "streams/channel2.m3u",
    "streams/channel3.m3u",
    "streams/al-quran.m3u",
    "streams/al-quran-bangla.m3u",
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

// --- Theme Switcher Logic ---
function applyTheme(theme) {
    body.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    themeToggle.checked = theme === 'dark';
}

themeToggle.addEventListener('change', () => {
    applyTheme(themeToggle.checked ? 'dark' : 'light');
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

// --- Matches Carousel Logic ---
function getMatchStatus(startTime, endTime) {
    const now = new Date();
    const start = startTime ? new Date(startTime) : null;
    const end = endTime ? new Date(endTime) : null;
    if (!start || !end) return 'unknown';
    if (now < start) return 'upcoming';
    if (now >= start && now <= end) return 'ongoing';
    return 'ended';
}

function formatCountdown(startTime) {
    if (!startTime) return 'এন/এ';
    const now = new Date();
    const start = new Date(startTime);
    const diff = start - now;
    if (diff <= 0) return '';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours > 0 ? hours + 'ঘণ্টা ' : ''}${minutes > 0 ? minutes + 'মিনিট ' : ''}${seconds}সে`;
}

function updateMatchStatus() {
    const matchItems = matchesInner.querySelectorAll('.match-item');
    matchItems.forEach(item => {
        const index = parseInt(item.dataset.index, 10);
        const match = appState.matches.find(m => m.index === index);
        if (match) {
            const status = getMatchStatus(match.startTime, match.endTime);
            const statusElement = item.querySelector('.match-status');
            const countdownElement = item.querySelector('.countdown-timer');
            statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            statusElement.className = `match-status status-${status}`;
            if (status === 'upcoming') {
                countdownElement.textContent = formatCountdown(match.startTime);
            } else {
                countdownElement.textContent = '';
            }
        }
    });
}

function renderMatchesCarousel() {
    if (!appState.matches.length) {
        matchesSection.style.display = 'none';
        return;
    }
    matchesSection.style.display = 'block';
    matchesInner.innerHTML = '';
    const matchesToRender = [...appState.matches, ...appState.matches];
    matchesToRender.forEach((match, index) => {
        const status = getMatchStatus(match.startTime, match.endTime);
        const countdown = status === 'upcoming' ? formatCountdown(match.startTime) : '';
        const div = document.createElement('div');
        div.className = 'match-item';
        div.dataset.index = match.index;
        div.innerHTML = `
            <img src="${match.logo || 'https://via.placeholder.com/40'}" alt="${match.name}" class="lazy">
            <span class="match-name">${match.name}</span>
            <span class="match-status status-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
            <span class="countdown-timer">${countdown}</span>
            <span class="match-time">${match.startTime ? new Date(match.startTime).toLocaleTimeString() : 'এন/এ'}</span>
        `;
        matchesInner.appendChild(div);
        const img = div.querySelector('img');
        if (img) lazyImageObserver.observe(img);
        div.addEventListener('click', () => {
            const channelIndex = parseInt(div.dataset.index, 10);
            if (!isNaN(channelIndex) && appState.allChannels[channelIndex]) {
                playStream(appState.allChannels[channelIndex], channelIndex);
            } else {
                console.error(`Invalid channel index: ${channelIndex}`);
                showToast("কন্টেন্ট লোড করা যায়নি। আবার চেষ্টা করুন।");
            }
        });
    });
    setInterval(updateMatchStatus, 1000);
}

// --- Core Functions ---
async function loadAllPlaylists() {
    console.log("Starting to load all playlists...");
    channelList.innerHTML = 'লোডিং হচ্ছে...';
    try {
        const promises = playlistUrls.map(async (url) => {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status} for ${url}`);
                const text = await res.text();
                return { url, text };
            } catch (e) {
                console.error(`Failed to load playlist: ${url}`, e);
                return null;
            }
        });
        const results = await Promise.all(promises);
        let combinedChannels = [];
        results.forEach(result => {
            if (result) {
                console.log(`Playlist loaded successfully: ${result.url}`);
                combinedChannels = combinedChannels.concat(parseM3U(result.text, result.url));
            }
        });
        combinedChannels.forEach((ch, index) => ch.index = index);
        console.log(`Total channels parsed: ${combinedChannels.length}`);
        appState.allChannels = combinedChannels;
        appState.matches = combinedChannels.filter(ch => ch.startTime && ch.endTime);
        if (appState.allChannels.length === 0) {
            channelList.innerHTML = `<div style="color: #f44336; padding: 20px;">কোনো চ্যানেল লোড করা যায়নি। নেটওয়ার্ক চেক করুন।</div>`;
            return;
        }
        populateCategories();
        setupInitialView();
        renderMatchesCarousel();
        restoreLastSession();
    } catch (error) {
        console.error("Critical error during playlist loading:", error);
        channelList.innerHTML = `<div style="color: #f44336; padding: 20px;">ত্রুটি হয়েছে। কনসোল চেক করুন।</div>`;
    }
}

function parseM3U(data, url) {
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
                const startTimeMatch = meta.match(/tvg-start="([^"]*)"/);
                const endTimeMatch = meta.match(/tvg-end="([^"]*)"/);

                currentChannel = {
                    name: nameMatch ? nameMatch[1].trim().split('|')[0] : "নামহীন কন্টেন্ট",
                    logo: logoMatch ? logoMatch[1] : "",
                    group: groupMatch ? groupMatch[1].trim() : "সাধারণ",
                    type: typeMatch ? typeMatch[1].trim() : "stream",
                    url: null,
                    userAgent: null,
                    startTime: startTimeMatch ? startTimeMatch[1] : null,
                    endTime: endTimeMatch ? endTimeMatch[1] : null
                };
                console.log(`Parsed channel: ${currentChannel.name}, Type: ${currentChannel.type}, Logo: ${currentChannel.logo}, Group: ${currentChannel.group}`);
            } catch (e) {
                console.warn("Skipping a malformed M3U entry.", e);
                currentChannel = null;
            }
        } else if (line.startsWith("#EXTVLCOPT:http-user-agent=") && currentChannel) {
            const userAgentMatch = line.match(/#EXTVLCOPT:http-user-agent=(.+)$/);
            if (userAgentMatch) {
                currentChannel.userAgent = userAgentMatch[1].trim();
            }
        } else if (line && !line.startsWith('#') && currentChannel) {
            let channelURL = line;
            const isIframe = currentChannel.type === "iframe" || line.includes("|<iframe");
            if (isIframe) {
                const parts = line.split("|<iframe");
                channelURL = parts[0].trim();
                if (parts[1]) {
                    const iframeTag = "<iframe" + parts[1];
                    const srcMatch = iframeTag.match(/src="([^"]*)"/);
                    if (srcMatch && srcMatch[1]) {
                        channelURL = srcMatch[1];
                        currentChannel.type = "iframe";
                    }
                }
            } else if (channelURL.match(/\.(m3u8|mp4|webm|mp3)$/i)) {
                currentChannel.type = "stream";
            } else {
                currentChannel.type = "iframe";
            }
            currentChannel.url = channelURL;
            channels.push(currentChannel);
            currentChannel = null;
        }
    }
    return channels;
}

function setupInitialView() {
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
        channelList.innerHTML = `<div style="padding: 20px; text-align: center;">কোনো কন্টেন্ট পাওয়া যায়নি।</div>`;
    }
    channelsToRender.forEach(ch => {
        const div = document.createElement("div");
        div.className = "channel";
        div.dataset.index = ch.index;
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
    if (!channel || isNaN(index)) {
        console.error("Invalid channel or index:", channel, index);
        showToast("কন্টেন্ট লোড করা যায়নি। আবার চেষ্টা করুন।");
        return;
    }
    if (channel.name) document.title = `${channel.name} - স্ট্রিমিং`;
    appState.currentChannelIndex = index;
    localStorage.setItem(LAST_PLAYED_INDEX_KEY, index);
    document.querySelector('.channel.is-playing')?.classList.remove('is-playing', 'active');
    const activeElement = document.querySelector(`.channel[data-index="${index}"]`);
    if (activeElement) {
        activeElement.classList.add('active', 'is-playing');
    }
    
    if (channel.type === 'stream') {
        player.el().style.display = '';
        iframeContainer.style.display = 'none';
        iframeEl.src = 'about:blank';
        qualitySelector.style.display = '';
        customFullscreenBtn.style.display = 'none';
        
        const source = {
            src: channel.url,
            type: channel.url.match(/\.mp4$/i) ? 'video/mp4' : 
                  channel.url.match(/\.webm$/i) ? 'video/webm' : 
                  channel.url.match(/\.mp3$/i) ? 'audio/mp3' : 'application/x-mpegURL'
        };
        if (channel.userAgent) {
            source.headers = {
                'User-Agent': channel.userAgent
            };
        }
        player.reset();
        player.src(source);
        player.play().catch(e => {
            console.error("Error playing stream:", e);
            showToast("কন্টেন্ট প্লে করা যায়নি। কনসোল চেক করুন।");
        });
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
        setupIframeEndDetection(channel, index);
    }
}

function setupIframeEndDetection(channel, index) {
    setTimeout(() => {
        if (iframeContainer.style.display === 'block' && appState.currentChannelIndex === index) {
            showToast("কন্টেন্ট শেষ হয়েছে। পরের কন্টেন্ট চালু হচ্ছে...");
            playNext();
        }
    }, 300000); // 5 minutes
}

function restoreLastSession() {
    const lastIndex = localStorage.getItem(LAST_PLAYED_INDEX_KEY);
    const lastTime = localStorage.getItem(LAST_PLAYBACK_TIME_KEY);
    if (lastIndex !== null && appState.allChannels[lastIndex]) {
        const channelToRestore = appState.allChannels[lastIndex];
        playStream(channelToRestore, parseInt(lastIndex, 10));
        player.one('canplay', () => {
            if (lastTime) {
                const seekTime = parseFloat(lastTime);
                player.currentTime(seekTime);
            }
            player.play();
        });
        showToast(`পুনরায় চালু হচ্ছে: ${channelToRestore.name}`);
    }
}

function renderQualitySelector(qualityLevels) {
    qualitySelector.innerHTML = "";
    const validLevels = Array.from(qualityLevels).filter(level => level.height);
    if (validLevels.length <= 1) return;
    validLevels.sort((a, b) => a.height - b.height);
    const autoBtn = document.createElement("button");
    autoBtn.textContent = "অটো";
    autoBtn.onclick = () => {
        for (let i = 0; i < qualityLevels.length; i++) qualityLevels[i].enabled = true;
        showToast('অটো কোয়ালিটি নির্বাচিত');
    };
    qualitySelector.appendChild(autoBtn);
    validLevels.forEach(level => {
        const btn = document.createElement("button");
        btn.textContent = `${level.height}p`;
        btn.onclick = () => {
            for (let i = 0; i < qualityLevels.length; i++) qualityLevels[i].enabled = false;
            level.enabled = true;
            showToast(`${level.height}p কোয়ালিটি নির্বাচিত`);
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
    allOpt.textContent = "সব ক্যাটাগরি";
    optionsContainer.appendChild(allOpt);
    const favOpt = document.createElement("span");
    favOpt.className = "custom-option";
    favOpt.dataset.value = "Favorites";
    favOpt.textContent = "⭐ ফেভারিট";
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
        showToast(`'${channel.name}' ফেভারিট থেকে সরানো হয়েছে`);
    } else {
        favorites.push(channel);
        showToast(`'${channel.name}' ফেভারিটে যোগ করা হয়েছে!`);
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
    const nextGlobalIndex = appState.allChannels.findIndex(c => c.url === nextChannel.url && c.name === nextChannel.name);
    if (nextGlobalIndex > -1) {
        playStream(appState.allChannels[nextGlobalIndex], nextGlobalIndex);
    }
}

function playPrevious() {
    if (appState.currentFilteredChannels.length < 1) return;
    const currentItem = appState.allChannels[appState.currentChannelIndex];
    let currentIndexInFiltered = currentItem ? appState.currentFilteredChannels.findIndex(c => c.url === currentItem.url) : 0;
    let prevIndexInFiltered = currentIndexInFiltered - 1;
    if (prevIndexInFiltered < 0) prevIndexInFiltered = appState.currentFilteredChannels.length - 1;
    const prevChannel = appState.currentFilteredChannels[prevIndexInFiltered];
    if (!prevChannel) return;
    const prevGlobalIndex = appState.allChannels.findIndex(c => c.url === prevChannel.url && c.name === prevChannel.name);
    if (prevGlobalIndex > -1) {
        playStream(appState.allChannels[prevGlobalIndex], prevGlobalIndex);
    }
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
            const channel = appState.allChannels[channelDiv.dataset.index];
            toggleFavorite(channel);
        }
    }, 1000);
};

const cancelPress = () => {
    clearTimeout(appState.pressTimer);
};

const handleClick = (event) => {
    const channelDiv = event.target.closest('.channel');
    if (channelDiv && !appState.isLongPress && !isScrolling) {
        const channelIndex = parseInt(channelDiv.dataset.index, 10);
        if (!isNaN(channelIndex) && appState.allChannels[channelIndex]) {
            playStream(appState.allChannels[channelIndex], channelIndex);
        } else {
            console.error(`Invalid channel index: ${channelIndex}`);
            showToast("কন্টেন্ট লোড করা যায়নি। আবার চেষ্টা করুন।");
        }
    }
    appState.isLongPress = false;
};

const handleMove = () => {
    isScrolling = true;
    clearTimeout(appState.pressTimer);
};

channelList.addEventListener('mousedown', startPress);
channelList.addEventListener('mouseup', cancelPress);
channelList.addEventListener('mouseleave', cancelPress);
channelList.addEventListener('click', handleClick);
channelList.addEventListener('touchstart', startPress, { passive: true });
channelList.addEventListener('touchend', cancelPress);
channelList.addEventListener('touchmove', handleMove);

channelList.addEventListener('scroll', () => {
    if (channelList.scrollTop + channelList.clientHeight >= channelList.scrollHeight - 400) {
        loadMoreChannels();
    }
});

player.on('ended', () => {
    localStorage.removeItem(LAST_PLAYED_INDEX_KEY);
    localStorage.removeItem(LAST_PLAYBACK_TIME_KEY);
    showToast("কন্টেন্ট শেষ হয়েছে। পরের কন্টেন্ট চালু হচ্ছে...");
    playNext();
});

player.on('error', () => {
    localStorage.removeItem(LAST_PLAYED_INDEX_KEY);
    localStorage.removeItem(LAST_PLAYBACK_TIME_KEY);
    showToast("কন্টেন্ট লোড করা যায়নি। অন্য একটি সিলেক্ট করুন।");
});

let lastTimeUpdate = 0;
player.on('timeupdate', () => {
    const now = Date.now();
    if (now - lastTimeUpdate > 5000) {
        const currentTime = player.currentTime();
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

customFullscreenBtn.addEventListener('click', () => {
    if (iframeContainer.style.display === 'block') {
        if (iframeEl.requestFullscreen) {
            iframeEl.requestFullscreen();
        } else if (iframeEl.mozRequestFullScreen) {
            iframeEl.mozRequestFullScreen();
        } else if (iframeEl.webkitRequestFullscreen) {
            iframeEl.webkitRequestFullscreen();
        } else if (iframeEl.msRequestFullscreen) {
            iframeEl.msRequestFullscreen();
        }
    }
});

function handleFullscreenChange() {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    try {
        if (isFullscreen) {
            if (screen.orientation && typeof screen.orientation.lock === 'function') {
                screen.orientation.lock('landscape').catch(err => {});
            }
        } else {
            if (screen.orientation && typeof screen.orientation.unlock === 'function') {
                screen.orientation.unlock();
            }
        }
    } catch (e) {
        console.warn("Screen Orientation API not fully supported.", e);
    }
}

document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(savedTheme);
    setView(localStorage.getItem('preferredView') || 'list');
    initializeCustomSelects();
    loadAllPlaylists();
});

document.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'INPUT') return;
    if (event.key === 'ArrowRight') playNext();
    if (event.key === 'ArrowLeft') playPrevious();
});

document.addEventListener('mouseup', (event) => {
    if (event.button === 3) playPrevious();
    if (event.button === 4) playNext();
});

document.getElementById('currentYear').textContent = new Date().getFullYear();
