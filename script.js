document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('player');
    const playlistContainer = document.getElementById('playlist');
    const videoTitle = document.getElementById('video-title');
    const searchBar = document.getElementById('search-bar');

    // Plyr প্লেয়ার শুরু করুন
    const player = new Plyr(video, {
        captions: { active: true, update: true, language: 'en' },
    });

    // 🔴 আপনার M3U/M3U8 প্লেলিস্টের URL এখানে দিন
    const m3uPlaylistUrl = 'https://cdn.jsdelivr.net/gh/jiocreator/streaming@main/streams/vod.m3u'; 
    
    let hls;
    let playlistItems = []; // প্লেলিস্ট আইটেমগুলো এখানে স্টোর হবে

    // একটি ভিডিও সোর্স লোড করার ফাংশন
    function loadVideoSource(url, title) {
        if (Hls.isSupported()) {
            if (hls) {
                hls.destroy();
            }
            hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play();
                videoTitle.textContent = title;
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            video.addEventListener('loadedmetadata', () => {
                video.play();
                videoTitle.textContent = title;
            });
        }
    }

    // M3U প্লেলিস্ট লোড এবং পার্স করার প্রধান ফাংশন
    async function loadPlaylist() {
        try {
            const response = await fetch(m3uPlaylistUrl);
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            const data = await response.text();
            
            playlistItems = parseM3u(data);
            renderPlaylist(playlistItems);

        } catch (error) {
            console.error('প্লেলিস্ট লোড করতে ব্যর্থ:', error);
            playlistContainer.innerHTML = '<p style="padding: 20px; text-align: center;">দুঃখিত, প্লেলিস্ট লোড করা সম্ভব হয়নি। CORS সমস্যা হতে পারে।</p>';
        }
    }

    // M3U ফাইল থেকে ডেটা পার্স করার ফাংশন
    function parseM3u(data) {
        const lines = data.trim().split('\n');
        const items = [];
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXTINF:')) {
                const info = lines[i];
                const url = lines[++i].trim();

                const nameMatch = info.match(/,(.+)/);
                const name = nameMatch ? nameMatch[1] : 'Unknown Title';

                const logoMatch = info.match(/tvg-logo="([^"]+)"/);
                const logo = logoMatch ? logoMatch[1] : 'https://via.placeholder.com/50x70.png?text=No+Art';

                if (url) {
                    items.push({ name, url, logo });
                }
            }
        }
        return items;
    }

    // প্লেলিস্ট UI তে দেখানোর ফাংশন
    function renderPlaylist(items) {
        playlistContainer.innerHTML = ''; // আগের আইটেম মুছে ফেলুন
        if (items.length === 0) {
            playlistContainer.innerHTML = '<p style="padding: 20px; text-align: center;">কোনো আইটেম পাওয়া যায়নি।</p>';
            return;
        }

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'playlist-item';
            div.innerHTML = `
                <img src="${item.logo}" alt="${item.name}">
                <span>${item.name}</span>
            `;

            div.addEventListener('click', () => {
                loadVideoSource(item.url, item.name);
                // Active class যোগ করা
                document.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');
            });

            playlistContainer.appendChild(div);
        });
    }

    // সার্চ ফাংশনালিটি
    searchBar.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredItems = playlistItems.filter(item => 
            item.name.toLowerCase().includes(searchTerm)
        );
        renderPlaylist(filteredItems);
    });

    // প্রথমে প্লেলিস্ট লোড করুন
    loadPlaylist();
});
