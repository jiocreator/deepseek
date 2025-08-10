document.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.getElementById('player');
    const videoTitle = document.getElementById('video-title');
    const playlistGrid = document.getElementById('playlist-grid');
    const categoryFilters = document.getElementById('category-filters');
    const searchBar = document.getElementById('search-bar');
    
    const player = new Plyr(videoElement, {
        tooltips: { controls: true, seek: true },
    });
    
    let hls = new Hls();
    let allItems = []; 

    const m3uPlaylistUrl = 'https://raw.githubusercontent.com/jiocreator/streaming/refs/heads/main/streams/live-events.m3u';

    function loadVideoWithQuality(url, title) {
        if (!url || !url.startsWith('http')) {
            console.error('অবৈধ URL প্রদান করা হয়েছে:', url);
            alert('দুঃখিত, এই ভিডিওটির লিংক সঠিক নয়।');
            return;
        }

        if (Hls.isSupported()) {
            hls.destroy();
            hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(videoElement);

            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                const availableQualities = hls.levels.map(l => l.height);
                
                const sourceConfig = {
                    type: 'video',
                    title: title,
                    sources: [
                        {
                            src: url,
                            type: 'application/x-mpegURL',
                            size: 720, // একটি ডিফল্ট সাইজ, এটি আসলে কোনো প্রভাব ফেলবে না
                        },
                    ],
                };
                
                // যদি একাধিক কোয়ালিটি অপশন থাকে, তবে তা যুক্ত করুন
                if (availableQualities.length > 1) {
                    sourceConfig.quality = {
                        default: 'auto',
                        options: ['auto', ...availableQualities.sort((a, b) => b - a)], // কোয়ালিটিগুলো বড় থেকে ছোট সাজান
                        forced: true,
                        onChange: (quality) => {
                            if (quality === 'auto') {
                                hls.currentLevel = -1;
                            } else {
                                hls.levels.forEach((level, levelIndex) => {
                                    if (level.height === quality) {
                                        hls.currentLevel = levelIndex;
                                    }
                                });
                            }
                        },
                    };
                }
                
                // *** সমাধান: এই অংশটি প্লেয়ারকে নতুন ভিডিও সোর্স এবং কোয়ালিটি সম্পর্কে জানায় ***
                player.source = sourceConfig;

                player.play();
                videoTitle.textContent = title;
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    }

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
    
    searchBar.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const activeCategoryBtn = document.querySelector('.filter-btn.active');
        const activeCategory = activeCategoryBtn ? activeCategoryBtn.textContent : 'All';
        let itemsToFilter = (activeCategory === 'All') ? allItems : allItems.filter(item => item.category === activeCategory);
        const searchFilteredItems = itemsToFilter.filter(item => item.name.toLowerCase().includes(searchTerm));
        renderPlaylistGrid(searchFilteredItems);
    });

    async function initializeApp() {
        try {
            const response = await fetch(m3uPlaylistUrl);
            if (!response.ok) throw new Error(`নেটওয়ার্ক রেসপন্স সঠিক নয়: ${response.statusText}`);
            const data = await response.text();
            
            allItems = parseM3u(data);
            if(allItems.length > 0) {
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
