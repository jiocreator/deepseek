// --- Element References ---
const video = document.getElementById("video");
const channelList = document.getElementById("channelList");
const searchInput = document.getElementById("search");
const categoryFilter = document.getElementById("categoryFilter");
const qualitySelector = document.getElementById("qualitySelector");
const listViewBtn = document.getElementById("listViewBtn");
const gridViewBtn = document.getElementById("gridViewBtn");
const sortSelector = document.getElementById("sortSelector");
const toastNotification = document.getElementById("toastNotification");
const loadingSpinner = document.getElementById("loadingSpinner");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// --- App State ---
const appState = {
    allChannels: [],
    currentFilteredChannels: [],
    pageToLoad: 1,
    isLoading: false,
    currentChannelIndex: -1,
    hls: null,
    pressTimer: null,
    isLongPress: false,
    CHANNELS_PER_LOAD: 20
};

// --- আপনার মাল্টিপল M3U প্লেলিস্টের URL পুনরুদ্ধার করা হলো ---
const playlistUrls = [
    "https://cdn.jsdelivr.net/gh/jiocreator/streaming@main/streams/channels.m3u",
    "https://cdn.statically.io/gh/jiocreator/streaming/main/streams/quran-bangla.m3u",
    "https://cdn.statically.io/gh/jiocreator/streaming/main/streams/vod-ott.m3u",
    "https://raw.githubusercontent.com/jiocreator/streaming/refs/heads/main/streams/vod.m3u",
    "https://cdn.statically.io/gh/jiocreator/streaming/main/streams/..m3u",
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

// --- Core Functions ---
async function loadAllPlaylists() {
    channelList.innerHTML = '⏳ Loading...';
    try {
        const responses = await Promise.all(playlistUrls.map(url => fetch(url).catch(e => console.error(`Failed to fetch ${url}`, e))));
        const textPromises = responses.map(res => (res && res.ok) ? res.text() : Promise.resolve(""));
        const allTexts = await Promise.all(textPromises);
        let combinedChannels = [];
        allTexts.forEach(text => {
            if (text) combinedChannels = combinedChannels.concat(parseM3U(text));
        });
        appState.allChannels = combinedChannels;
        populateCategories();
        setupInitialView();
    } catch (error) {
        channelList.innerHTML = `<div style="color: red; padding: 20px;">Error loading playlists.</div>`;
    }
}

function parseM3U(data) {
    const lines = data.split("\n");
    const channels = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("#EXTINF")) {
            const meta = lines[i];
            const url = lines[i + 1];
            if (!url || url.trim() === '') continue;
            const nameMatch = meta.match(/,(.*)$/);
            const logoMatch = meta.match(/tvg-logo="(.*?)"/);
            const groupMatch = meta.match(/group-title="(.*?)"/);
            channels.push({
                name: nameMatch ? nameMatch[1].trim() : "Unnamed",
                logo: logoMatch ? logoMatch[1] : "",
                group: groupMatch ? groupMatch[1] : "Others",
                url: url.trim()
            });
        }
    }
    return channels;
}

// --- setupInitialView ফাংশনটি ঠিক করা হলো ---
function setupInitialView() {
    const search = searchInput.value.toLowerCase();
    const selectedGroup = categoryFilter.value;
    let filteredChannels;

    // ধাপ ১: ক্যাটাগরি অনুযায়ী ফিল্টার
    if (selectedGroup === "Favorites") {
        filteredChannels = getFavorites();
    } else {
        filteredChannels = appState.allChannels.filter(ch => 
            selectedGroup === "" || ch.group === selectedGroup
        );
    }

    // ধাপ ২: সার্চ টেক্সট প্রয়োগ
    if (search) {
        filteredChannels = filteredChannels.filter(ch =>
            ch.name.toLowerCase().includes(search)
        );
    }
    
    // ধাপ ৩: সর্টিং প্রয়োগ
    const sortOrder = sortSelector.value;
    if (sortOrder === 'newest') {
        filteredChannels.reverse();
    } else if (sortOrder === 'az') {
        filteredChannels.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === 'za') {
        filteredChannels.sort((a, b) => b.name.localeCompare(a.name));
    }

    appState.currentFilteredChannels = filteredChannels;
    
    // ধাপ ৪: ভিউ রিসেট এবং চ্যানেল লোড
    channelList.innerHTML = "";
    appState.pageToLoad = 1;
    loadMoreChannels();
}

function loadMoreChannels() {
    if (appState.isLoading) return;
    appState.isLoading = true;
    loadingSpinner.classList.remove('hidden');
    const startIndex = (appState.pageToLoad - 1) * appState.CHANNELS_PER_LOAD;
    const channelsToRender = appState.currentFilteredChannels.slice(startIndex, startIndex + appState.CHANNELS_PER_LOAD);
    if (channelsToRender.length === 0 && appState.pageToLoad === 1) {
        channelList.innerHTML = `<div style="padding: 20px;">Not found.</div>`;
    }
    channelsToRender.forEach(ch => {
        const div = document.createElement("div");
        div.className = "channel";
        const globalIndex = appState.allChannels.findIndex(c => c.name === ch.name && c.url === ch.url);
        div.dataset.index = globalIndex;
        const img = document.createElement("img");
        img.dataset.src = ch.logo || "https://via.placeholder.com/50";
        img.classList.add("lazy");
        img.onerror = () => { img.src = "https://via.placeholder.com/50"; };
        lazyImageObserver.observe(img);
        const nameSpan = document.createElement("span");
        nameSpan.className = "channel-name";
        nameSpan.textContent = ch.name;
        div.appendChild(img);
        div.appendChild(nameSpan);
        channelList.appendChild(div);
    });
    appState.pageToLoad++;
    appState.isLoading = false;
    loadingSpinner.classList.add('hidden');
}

function playStream(channel, index) {
    if (!channel) return;
    appState.currentChannelIndex = index;
    document.querySelectorAll('.channel').forEach(d => d.classList.remove('active'));
    const activeElement = document.querySelector(`.channel[data-index="${index}"]`);
    if (activeElement) activeElement.classList.add('active');
    if (appState.hls) appState.hls.destroy();
    const url = channel.url;
    if (url.endsWith('.m3u8')) {
        if (Hls.isSupported()) {
            appState.hls = new Hls();
            appState.hls.loadSource(url);
            appState.hls.attachMedia(video);
            appState.hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => renderQualitySelector(data.levels));
        }
    } else {
        video.src = url;
        video.play();
        qualitySelector.innerHTML = "";
    }
}

function renderQualitySelector(levels) {
    qualitySelector.innerHTML = "";
    if (!levels || levels.length === 0) return;
    const autoBtn = document.createElement("button");
    autoBtn.textContent = "Auto";
    autoBtn.onclick = () => { appState.hls.currentLevel = -1; };
    qualitySelector.appendChild(autoBtn);
    levels.forEach((level, i) => {
        const btn = document.createElement("button");
        btn.textContent = `${level.height}p`;
        btn.onclick = () => { appState.hls.currentLevel = i; };
        qualitySelector.appendChild(btn);
    });
}

function populateCategories() {
    const groups = new Set(appState.allChannels.map(ch => ch.group));
    categoryFilter.innerHTML = `<option value="">All Categories</option>`;
    const favOpt = document.createElement("option");
    favOpt.value = "Favorites";
    favOpt.textContent = "⭐ Favorites";
    categoryFilter.appendChild(favOpt);
    groups.forEach(group => {
        const opt = document.createElement("option");
        opt.value = group;
        opt.textContent = group;
        categoryFilter.appendChild(opt);
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
    let favorites = getFavorites();
    const index = favorites.findIndex(fav => fav.name === channel.name && fav.url === channel.url);
    if (index > -1) {
        favorites.splice(index, 1);
        showToast(`'${channel.name}' removed from Favorites`);
    } else {
        favorites.push(channel);
        showToast(`'${channel.name}' added to Favorites!`);
    }
    saveFavorites(favorites);
    if (categoryFilter.value === 'Favorites') setupInitialView();
}

function playNext() {
    if (appState.currentFilteredChannels.length < 1) return;
    const currentItem = appState.allChannels[appState.currentChannelIndex];
    let currentIndexInFiltered = -1;
    if(currentItem) currentIndexInFiltered = appState.currentFilteredChannels.findIndex(c => c.url === currentItem.url);
    const nextIndexInFiltered = (currentIndexInFiltered + 1) % appState.currentFilteredChannels.length;
    const nextChannel = appState.currentFilteredChannels[nextIndexInFiltered];
    if (!nextChannel) return;
    const nextGlobalIndex = appState.allChannels.findIndex(c => c.url === nextChannel.url);
    if (nextGlobalIndex !== -1) playStream(nextChannel, nextGlobalIndex);
}

function playPrevious() {
    if (appState.currentFilteredChannels.length < 1) return;
    const currentItem = appState.allChannels[appState.currentChannelIndex];
    let currentIndexInFiltered = 0;
    if(currentItem) currentIndexInFiltered = appState.currentFilteredChannels.findIndex(c => c.url === currentItem.url);
    if (currentIndexInFiltered === -1) currentIndexInFiltered = 0;
    let prevIndexInFiltered = currentIndexInFiltered - 1;
    if (prevIndexInFiltered < 0) prevIndexInFiltered = appState.currentFilteredChannels.length - 1;
    const prevChannel = appState.currentFilteredChannels[prevIndexInFiltered];
    if (!prevChannel) return;
    const prevGlobalIndex = appState.allChannels.findIndex(c => c.url === prevChannel.url);
    if (prevGlobalIndex !== -1) playStream(prevChannel, prevGlobalIndex);
}

// Event Listeners
const startPress = (event) => {
    const channelDiv = event.target.closest('.channel');
    if (!channelDiv) return;
    appState.isLongPress = false;
    appState.pressTimer = setTimeout(() => {
        appState.isLongPress = true;
        const channel = appState.allChannels[channelDiv.dataset.index];
        if (channel) toggleFavorite(channel);
    }, 1500);
};
const cancelPress = () => clearTimeout(appState.pressTimer);
const handleClick = (event) => {
    const channelDiv = event.target.closest('.channel');
    if (channelDiv && !appState.isLongPress) {
        const channel = appState.allChannels[channelDiv.dataset.index];
        if (channel) playStream(channel, parseInt(channelDiv.dataset.index));
    }
};

channelList.addEventListener('mousedown', startPress);
channelList.addEventListener('mouseup', cancelPress);
channelList.addEventListener('mouseleave', cancelPress);
channelList.addEventListener('click', handleClick);
channelList.addEventListener('touchstart', startPress);
channelList.addEventListener('touchend', cancelPress);
channelList.addEventListener('touchmove', cancelPress);
channelList.addEventListener('scroll', () => {
    if (channelList.scrollTop + channelList.clientHeight >= channelList.scrollHeight - 200) {
        loadMoreChannels();
    }
});
video.addEventListener('ended', playNext);
searchInput.addEventListener("input", setupInitialView);
categoryFilter.addEventListener("change", setupInitialView);
sortSelector.addEventListener("change", setupInitialView);
listViewBtn.addEventListener('click', () => setView('list'));
gridViewBtn.addEventListener('click', () => setView('grid'));
prevBtn.addEventListener('click', playPrevious);
nextBtn.addEventListener('click', playNext);

document.addEventListener('DOMContentLoaded', () => {
    const preferredView = localStorage.getItem('preferredView') || 'list';
    setView(preferredView);
    loadAllPlaylists();
});
// --- টিভি রিমোটের Next/Previous বাটনের জন্য নতুন কোড ---

document.addEventListener('keydown', (event) => {
    // keydown ইভেন্টটি নিরীক্ষণ করা হচ্ছে

    switch (event.key) {
        case 'ArrowRight': // ডান দিকের অ্যারো বাটন (Next)
        case 'MediaTrackNext': // রিমোটের সাধারণ Next বাটন
            playNext();
            break;

        case 'ArrowLeft': // বাম দিকের অ্যারো বাটন (Previous)
        case 'MediaTrackPrevious': // রিমোটের সাধারণ Previous বাটন
            playPrevious();
            break;
    }
});
// --- মাউসের অতিরিক্ত বাটনের জন্য নতুন কোড ---

document.addEventListener('mouseup', (event) => {
    // মাউসের কোন বাটন চাপা হয়েছে তা পরীক্ষা করা হচ্ছে

    // event.button === 3 হলো মাউসের "Back" বাটন (সাধারণত সাইডের পেছনের বাটন)
    if (event.button === 3) {
        playPrevious();
    }

    // event.button === 4 হলো মাউসের "Forward" বাটন (সাধারণত সাইডের সামনের বাটন)
    if (event.button === 4) {
        playNext();
    }
});
// Automatically update the copyright year
document.getElementById('currentYear').textContent = new Date().getFullYear();
