document.addEventListener('DOMContentLoaded', () => {
    const player = new Plyr('#player');
    const videoTitle = document.getElementById('video-title');
    const playlistGrid = document.getElementById('playlist-grid');
    const categoryFilters = document.getElementById('category-filters');

    // 🔴 আপনার M3U/M3U8 প্লেলিস্টের URL এখানে দিন
    const m3uPlaylistUrl = 'https://cdn.jsdelivr.net/gh/jiocreator/streaming@main/streams/vod.m3u'; 
    
    let hls;
    let allItems = []; // সব আইটেম এখানে স্টোর হবে

    // ভিডিও সোর্স লোড করার ফাংশন
    function loadVideoSource(url, title) {
        if (Hls.isSupported()) {
            if (hls) hls.destroy();
            hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(document.getElementById('player'));
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                player.play();
                videoTitle.textContent = title;
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        } else if (player.media.canPlayType('application/vnd.apple.mpegurl')) {
            player.source = { type: 'video', sources: [{ src: url, type: 'application/x-mpegURL' }] };
            player.play();
            videoTitle.textContent = title;
        }
    }

    // M3U প্লেলিস্ট লোড এবং পার্স করার প্রধান ফাংশন
    async function initializePlayer() {
        try {
            const response = await fetch(m3uPlaylistUrl);
            if (!response.ok) throw new Error('Network response failed.');
            const data = await response.text();
            
            allItems = parseM3u(data);
            renderCategories(allItems);
            renderPlaylistGrid(allItems);

        } catch (error) {
            console.error('Error loading playlist:', error);
            playlistGrid.innerHTML = '<p style="text-align:center; grid-column: 1 / -1;">প্লেলিস্ট লোড করা যায়নি।</p>';
        }
    }

    // M3U ফাইল থেকে ডেটা পার্স করার ফাংশন (group-title সহ)
    function parseM3u(data) {
        const lines = data.trim().split('\n');
        const items = [];
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXTINF:')) {
                const info = lines[i];
                const url = lines[++i].trim();
                if (!url) continue;

                const name = info.split(',').pop() || 'Unknown Title';
                const logoMatch = info.match(/tvg-logo="([^"]+)"/);
                const logo = logoMatch ? logoMatch[1] : 'https://via.placeholder.com/180x250.png?text=No+Poster';
                const groupMatch = info.match(/group-title="([^"]+)"/);
                const category = groupMatch ? groupMatch[1] : 'General';
                
                items.push({ name, url, logo, category });
            }
        }
        return items;
    }
    
    // ক্যাটেগরি বাটন তৈরি এবং দেখানোর ফাংশন
    function renderCategories(items) {
        const categories = ['All', ...new Set(items.map(item => item.category))];
        categoryFilters.innerHTML = '';
        categories.forEach(category => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.textContent = category;
            if (category === 'All') btn.classList.add('active');
            
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const filteredItems = category === 'All' ? items : items.filter(item => item.category === category);
                renderPlaylistGrid(filteredItems);
            });
            categoryFilters.appendChild(btn);
        });
    }

    // গ্রিড আকারে প্লেলিস্ট দেখানোর ফাংশন
    function renderPlaylistGrid(items) {
        playlistGrid.innerHTML = ''; // আগের আইটেম মুছে ফেলুন
        if (items.length === 0) {
            playlistGrid.innerHTML = '<p style="text-align:center; grid-column: 1 / -1;">এই ক্যাটেগরিতে কিছু নেই।</p>';
            return;
        }

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'grid-item';
            div.innerHTML = `
                <img src="${item.logo}" alt="${item.name}" loading="lazy">
                <div class="title">${item.name}</div>
            `;
            div.addEventListener('click', () => loadVideoSource(item.url, item.name));
            playlistGrid.appendChild(div);
        });
    }

    // প্লেয়ার চালু করুন
    initializePlayer();
});
