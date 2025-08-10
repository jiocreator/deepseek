document.addEventListener('DOMContentLoaded', () => {
    // DOM উপাদান এবং প্লেয়ার ইন্সট্যান্স শুরু করুন
    const videoElement = document.getElementById('player');
    const videoTitle = document.getElementById('video-title');
    const playlistGrid = document.getElementById('playlist-grid');
    const categoryFilters = document.getElementById('category-filters');
    const searchBar = document.getElementById('search-bar');
    
    // Plyr প্লেয়ার শুরু করুন
    const player = new Plyr(videoElement, {
        tooltips: { controls: true, seek: true },
        // এখানে কোয়ালিটি অপশন ডিফল্টভাবে থাকবে
        quality: {
            default: 'auto', // ডিফল্ট কোয়ালিটি
            options: [],     // এখানে আমরা ডায়নামিকভাবে কোয়ালিটি যোগ করবো
            forced: true,    // Plyr কে কোয়ালিটি কন্ট্রোল নিতে বাধ্য করুন
            onChange: (quality) => onQualityChange(quality),
        }
    });
    
    // গ্লোবাল ভ্যারিয়েবল
    let hls = new Hls();
    let allItems = []; 

    const m3uPlaylistUrl = 'https://raw.githubusercontent.com/jiocreator/streaming/refs/heads/main/streams/live-events.m3u';
    
    /**
     * HLS.js এবং Plyr.io ব্যবহার করে ভিডিও সোর্স লোড করে এবং কোয়ালিটি অপশন সেট করে
     * @param {string} url - M3U8 ফাইলের URL
     * @param {string} title - ভিডিওর টাইটেল
     */
    function loadVideoWithQuality(url, title) {
        if (!url || !url.startsWith('http')) {
            console.error('অবৈধ URL প্রদান করা হয়েছে:', url);
            return;
        }

        if (Hls.isSupported()) {
            hls.destroy();
            hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(videoElement);

            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                // অ্যাভেইলেবল কোয়ালিটি লেভেলগুলো পান (যেমন: 720, 1080)
                const qualityOptions = hls.levels.map(level => level.height);
                qualityOptions.unshift('auto'); // শুরুতে 'auto' অপশন যোগ করুন

                // Plyr এর কনফিগারেশন আপডেট করুন
                player.config.quality.options = qualityOptions;
                player.config.quality.default = 'auto'; // অটো-কে ডিফল্ট করুন
                
                // Plyr এর UI আপডেট করার জন্য একটি ইভেন্ট পাঠান
                const event = new CustomEvent('qualityUpdated');
                videoElement.dispatchEvent(event);

                player.play();
                videoTitle.textContent = title;
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    }

    /**
     * যখন ব্যবহারকারী Plyr এর সেটিং থেকে কোয়ালিটি পরিবর্তন করে
     * @param {number | string} newQuality - নতুন সিলেক্ট করা কোয়ালিটি
     */
    function onQualityChange(newQuality) {
        if (newQuality === 'auto') {
            hls.currentLevel = -1; // HLS.js কে অটোমেটিক লেভেল সুইচ করতে বলুন
        } else {
            hls.levels.forEach((level, levelIndex) => {
                if (level.height === newQuality) {
                    hls.currentLevel = levelIndex;
                }
            });
        }
    }

    /**
     * M3U ফাইল পার্স করে
     */
    function parseM3u(data) {
        const lines = data.trim().split('\n');
        const items = [];
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXTINF:')) {
                const infoLine = lines[i];
                let url = '';

                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j].trim();
                    if (nextLine && !nextLine.startsWith('#')) {
                        url = nextLine;
                        i = j;
                        break;
                    }
                }

                if (!url) continue;

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
     * ক্যাটেগরি বাটন তৈরি করে
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
     * প্লেলিস্ট গ্রিড রেন্ডার করে
     */
    function renderPlaylistGrid(items) {
        playlistGrid.innerHTML = ''; 
        if (items.length === 0) {
            playlistGrid.innerHTML = '<p class="loading-message">কোনো কন্টেন্ট পাওয়া যায়নি।</p>';
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
        let itemsToFilter = (activeCategory === 'All') ? allItems : allItems.filter(item => item.category === activeCategory);
        const searchFilteredItems = itemsToFilter.filter(item => item.name.toLowerCase().includes(searchTerm));
        renderPlaylistGrid(searchFilteredItems);
    });

    /**
     * অ্যাপ শুরু করার প্রধান ফাংশন
     */
    async function initializeApp() {
        try {
            const response = await fetch(m3uPlaylistUrl);
            if (!response.ok) throw new Error(`নেটওয়ার্ক রেসপন্স সঠিক নয়: ${response.statusText}`);
            const data = await response.text();
            
            allItems = parseM3u(data);
            if (allItems.length > 0) {
                renderCategories(allItems);
                renderPlaylistGrid(allItems);
            } else {
                playlistGrid.innerHTML = '<p class="loading-message">প্লেলিস্ট পার্স করা সম্ভব হয়নি বা প্লেলিস্টটি খালি।</p>';
            }
        } catch (error) {
            playlistGrid.innerHTML = `<p class="loading-message">প্লেলিস্ট লোড করা যায়নি। সমস্যা: ${error.message}</p>`;
        }
    }

    initializeApp();
});
