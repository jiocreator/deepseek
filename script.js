Document.addEventListener('DOMContentLoaded', () => {
    // DOM উপাদান এবং প্লেয়ার ইন্সট্যান্স শুরু করুন
    const videoElement = document.getElementById('player');
    const videoTitle = document.getElementById('video-title');
    const playlistGrid = document.getElementById('playlist-grid');
    const categoryFilters = document.getElementById('category-filters');
    const searchBar = document.getElementById('search-bar');
    
    const player = new Plyr(videoElement, {
        // এখানে Plyr এর অপশনগুলো রাখতে পারেন
        tooltips: { controls: true, seek: true },
    });
    
    // গ্লোবাল ভ্যারিয়েবল
    let hls = new Hls();
    let allItems = []; // সব আইটেম এখানে স্টোর হবে

    // 🔴 আপনার M3U/M3U8 প্লেলিস্টের URL এখানে দিন
    const m3uPlaylistUrl = 'https://raw.githubusercontent.com/jiocreator/streaming/refs/heads/main/streams/live-events.m3u';

    /**
     * HLS.js এবং Plyr.io ব্যবহার করে ভিডিও সোর্স লোড করে এবং কোয়ালিটি অপশন সেট করে
     * @param {string} url - M3U8 ফাইলের URL
     * @param {string} title - ভিডিওর টাইটেল
     */
    function loadVideoWithQuality(url, title) {
        if (Hls.isSupported()) {
            hls.destroy(); // আগের ইন্সট্যান্স ধ্বংস করুন
            hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(videoElement);

            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                const availableQualities = hls.levels.map((l) => l.height);
                
                const sourceConfig = {
                    type: 'video',
                    title: title,
                    sources: [{ src: url, type: 'application/x-mpegURL' }],
                };

                if (availableQualities.length > 1) {
                    sourceConfig.quality = {
                        default: availableQualities[availableQualities.length - 1],
                        options: availableQualities,
                        forced: true,
                        onChange: (quality) => {
                            hls.levels.forEach((level, levelIndex) => {
                                if (level.height === quality) {
                                    hls.currentLevel = levelIndex;
                                }
                            });
                        },
                    };
                }

                player.source = sourceConfig;
                player.play();
                videoTitle.textContent = title;
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        } else {
            player.source = { type: 'video', title: title, sources: [{ src: url }] };
            player.play();
        }
    }

    /**
     * M3U ফাইল পার্স করে এবং আইটেম অবজেক্টের একটি অ্যারে রিটার্ন করে (উন্নত সংস্করণ)
     * @param {string} data - M3U ফাইলের টেক্সট কন্টেন্ট
     * @returns {Array} - প্লেলিস্ট আইটেমের অ্যারে
     */
    function parseM3u(data) {
        const lines = data.trim().split('\n');
        const items = [];
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXTINF:')) {
                const infoLine = lines[i];
                let url = '';

                // #EXTINF এর পরের লাইনগুলো থেকে আসল URL টি খুঁজে বের করুন
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j].trim();
                    if (nextLine && !nextLine.startsWith('#')) {
                        url = nextLine;
                        i = j; // মূল লুপের ইনডেক্স আপডেট করুন
                        break;
                    }
                }

                if (!url) continue; // যদি কোনো URL খুঁজে না পাওয়া যায়, তবে এই আইটেমটি বাদ দিন

                const commaIndex = infoLine.indexOf(',');
                const name = (commaIndex !== -1) ? infoLine.substring(commaIndex + 1).trim() : 'Unknown Title';

                const logoMatch = infoLine.match(/tvg-logo="([^"]+)"/);
                const logo = logoMatch ? logoMatch[1] : 'https://via.placeholder.com/180x250.png?text=No+Poster';
                
                const groupMatch = infoLine.match(/group-title="([^"]+)"/);
                const category = groupMatch ? groupMatch[1] : 'General';
                
                items.push({ name, url, logo, category });
            }
        }
        return items;
    }
    
    /**
     * আইটেমের অ্যারে থেকে ক্যাটেগরি বাটন তৈরি করে
     * @param {Array} items - প্লেলিস্ট আইটেমের অ্যারে
     */
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
                const filteredItems = category === 'All' ? allItems : allItems.filter(item => item.category === category);
                renderPlaylistGrid(filteredItems);
            });
            categoryFilters.appendChild(btn);
        });
    }

    /**
     * গ্রিডে প্লেলিস্ট আইটেমগুলো রেন্ডার করে
     * @param {Array} items - দেখানোর জন্য আইটেমের অ্যারে
     */
    function renderPlaylistGrid(items) {
        playlistGrid.innerHTML = ''; 
        if (items.length === 0) {
            playlistGrid.innerHTML = '<p style="text-align:center; grid-column: 1 / -1;">কোনো কন্টেন্ট পাওয়া যায়নি।</p>';
            return;
        }
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'grid-item';
            div.innerHTML = `
                <img src="${item.logo}" alt="${item.name}" loading="lazy">
                <div class="title">${item.name}</div>
            `;
            div.addEventListener('click', () => loadVideoWithQuality(item.url, item.name));
            playlistGrid.appendChild(div);
        });
    }
    
    // সার্চ ফাংশনালিটি
    searchBar.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const activeCategoryBtn = document.querySelector('.filter-btn.active');
        const activeCategory = activeCategoryBtn ? activeCategoryBtn.textContent : 'All';

        let categoryFilteredItems = allItems;
        if (activeCategory !== 'All') {
            categoryFilteredItems = allItems.filter(item => item.category === activeCategory);
        }

        const searchFilteredItems = categoryFilteredItems.filter(item => 
            item.name.toLowerCase().includes(searchTerm)
        );
        renderPlaylistGrid(searchFilteredItems);
    });

    /**
     * প্লেয়ার শুরু করার প্রধান ফাংশন
     */
    async function initializeApp() {
        try {
            const response = await fetch(m3uPlaylistUrl);
            if (!response.ok) throw new Error('Network response failed.');
            const data = await response.text();
            
            allItems = parseM3u(data);
            renderCategories(allItems);
            renderPlaylistGrid(allItems);

        } catch (error) {
            console.error('Error initializing app:', error);
            playlistGrid.innerHTML = '<p style="text-align:center; grid-column: 1 / -1;">প্লেলিস্ট লোড করা যায়নি। URL অথবা CORS পলিসি চেক করুন।</p>';
        }
    }

    // অ্যাপ চালু করুন
    initializeApp();
});
