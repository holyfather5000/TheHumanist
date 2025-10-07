const NewsApp = {
    // Configuration
    config: {
        feedSources: [
            "https://feeds.bbci.co.uk/news/rss.xml",
            "https://feedx.net/rss/ap.xml",
            "https://www.euronews.com/rss",
            "https://time.com/feed/",
            "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
            "https://www.cbc.ca/webfeed/rss/rss-topstories",
            "https://globalnews.ca/feed/",
            "https://www.aljazeera.com/xml/rss/all.xml",
            "https://www.npr.org/rss/rss.php?id=1001",
            // "https://reliefweb.int/updates/rss.xml",
            "https://www.odditycentral.com/feed",
            "https://www.huffpost.com/section/weird-news/feed"
        ],
        earthquakeFeed: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
        keywords: ["disaster", "tragedy", "crisis", "emergency", "catastrophe", "accident", "collision", "crash", "wreck", "derailment", "failure", "collapse", "explosion", "bomb", "attack", "massacre", "shooting", "terrorism", "riot", "war", "conflict", "death", "injured", "epidemic", "pandemic", "outbreak", "disease", "pollution", "danger", "killed in deadly",],
        blockedKeywords: ["netflix series", "Assessment", "hulu", "disney+", "prime video", "streaming", "tv show", "spoilers", "movie review", "tobacco", "celebrity gossip", "album release", "video game", "gaming console", "Twisty Ending", "Update #", "Years after", "seasonal monitor", "Iraq: ISHM", "Annunciation", "lauded", "situation report", "summary report", "canoe trip", "3W Mapping", "Locust Bulletin", "Flash Update", "Howard Stern", "Country Brief", "Apple's iPhone", "Apple has unveiled"],
        fallbackImages: [
            'newsfb/F1.jpg',
            'newsfb/F2.jpg',
            'newsfb/F3.jpg',
            'newsfb/F4.jpg',
            'newsfb/F5.jpg',
            'newsfb/F6.jpg'
        ]
    },

    // --- Core Functions ---
    async fetchAllFeeds() {
        const promises = this.config.feedSources.map(url => this.fetchFeed(url));
        const results = await Promise.all(promises.map(p => p.catch(e => {
            console.error('Error fetching a feed', e);
            return [];
        })));
        return results.flat();
    },

    async fetchFeed(url) {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        return data.items || [];
    },

    async fetchEarthquakes() {
        try {
            const response = await fetch(this.config.earthquakeFeed);
            const data = await response.json();
            return data.features || [];
        } catch (e) {
            console.error('Failed to fetch earthquake data:', e);
            return [];
        }
    },

    filterArticles(articles) {
        return articles.filter(article => {
            const text = (article.title + " " + (article.description || "")).toLowerCase();
            const hasKeyword = this.config.keywords.some(k => text.includes(k));
            const hasBlocked = this.config.blockedKeywords.some(b => text.includes(b.toLowerCase()));
            return hasKeyword && !hasBlocked;
        });
    },

    mixArticlesBySource(articles, minSpacing = 3) {
        const result = [];
        const remaining = [...articles];
        while (remaining.length) {
            let placed = false;
            for (let i = 0; i < remaining.length; i++) {
                const { domain } = this.getDomainInfo(remaining[i].link);
                const lastIndexes = result.map((a, idx) => ({ domain: this.getDomainInfo(a.link).domain, idx })).filter(a => a.domain === domain).map(a => a.idx);
                if (lastIndexes.length === 0 || (result.length - lastIndexes[lastIndexes.length - 1]) >= minSpacing) {
                    result.push(remaining[i]);
                    remaining.splice(i, 1);
                    placed = true;
                    break;
                }
            }
            if (!placed) remaining.shift();
        }
        return result;
    },
    
    // Limits the number of articles from a specific source
    limitSourceArticles(articles, sourceDomain, maxCount) {
        const limitedArticles = [];
        let sourceCount = 0;
        
        for (const article of articles) {
            const { domain } = this.getDomainInfo(article.link);
            if (domain.includes(sourceDomain)) {
                if (sourceCount < maxCount) {
                    limitedArticles.push(article);
                    sourceCount++;
                }
            } else {
                limitedArticles.push(article);
            }
        }
        return limitedArticles;
    },

    // --- Rendering Functions ---
    async renderArticles(articles) {
        const container = document.getElementById('news-container');
        container.innerHTML = '';
        let articlesToRender = [...articles];

        // Fetch earthquakes
        const earthquakes = await this.fetchEarthquakes();

        // Render the top featured section with earthquake data
        if (articlesToRender.length >= 2) {
            this.renderFeaturedSection(
                articlesToRender.shift(), // First article for the main featured
                [articlesToRender.shift(), articlesToRender.shift()], // Next two articles for the stacked column
                earthquakes
            );
        }

        // Render alternating sections
        while (articlesToRender.length > 0) {
            // Two rows of secondary articles (4 articles)
            const secondaryArticles = articlesToRender.splice(0, 4);
            if (secondaryArticles.length > 0) {
                this.renderArticlesInGrid(secondaryArticles, 'secondary-articles-grid', this.renderSecondaryArticle);
            }

            // Two rows of main articles (3 articles)
            const mainArticles = articlesToRender.splice(0, 3);
            if (mainArticles.length > 0) {
                this.renderArticlesInGrid(mainArticles, 'main-articles-row', this.renderMainArticle);
            }
        }
    },

    renderFeaturedSection(mainArticle, smallArticles, earthquakes) {
        const container = document.getElementById('news-container');
        const section = document.createElement('div');
        section.className = 'featured-layout';

        // Main featured article on the left
        const mainFeatured = document.createElement('div');
        mainFeatured.className = 'custom-featured';
        mainFeatured.innerHTML = `
            <a href="${mainArticle.link}" target="_blank">
                <div class="featured-image">
                    <img src="${mainArticle.thumbnail || mainArticle.enclosure?.link}" alt="${mainArticle.title}" onerror="NewsApp.getRandomFallbackImage(this)">
                </div>
                <div class="featured-content">
                    <h4 class="title">${mainArticle.title}</h4>
                    <span class="meta">
                        <span class="source">${this.getDomainInfo(mainArticle.link).cleanName}</span> · 
                        <span class="date">${this.formatTimeAgo(mainArticle.pubDate)}</span>
                    </span>
                </div>
            </a>
        `;
        section.appendChild(mainFeatured);

        // Stacked articles in the center
        const smallArticlesContainer = document.createElement('div');
        smallArticlesContainer.className = 'featured-small-articles';
        smallArticles.forEach(article => {
            const smallArticleDiv = document.createElement('div');
            smallArticleDiv.className = 'custom-featured-small';
            smallArticleDiv.innerHTML = `
                <a href="${article.link}" target="_blank">
                    <div class="featured-image-small">
                        <img src="${article.thumbnail || article.enclosure?.link}" alt="${article.title}" onerror="NewsApp.getRandomFallbackImage(this)">
                    </div>
                    <div class="featured-content-small">
                        <h4 class="title">${article.title}</h4>
                        <span class="meta">
                            <span class="source">${this.getDomainInfo(article.link).cleanName}</span> · 
                            <span class="date">${this.formatTimeAgo(article.pubDate)}</span>
                        </span>
                    </div>
                </a>
            `;
            smallArticlesContainer.appendChild(smallArticleDiv);
        });
        section.appendChild(smallArticlesContainer);

        // Column for earthquakes on the right
        const earthquakeColumn = document.createElement('div');
        earthquakeColumn.className = 'temporary-column';
        let earthquakeListHTML = `<span class="h3quake">Earthquakes Today</span><br><br>`;

        // Sort earthquakes by magnitude in descending order and get the top 5
        const displayQuakes = earthquakes.sort((a, b) => b.properties.mag - a.properties.mag).slice(0, 5);

        if (displayQuakes.length > 0) {
            earthquakeListHTML += `<ul>`;
            displayQuakes.forEach(quake => {
                const magnitude = quake.properties.mag.toFixed(1);
                const fullPlace = quake.properties.place;
                const time = this.formatTimeAgo(quake.properties.time);

                // Split the place string to try and get a simplified location (e.g., "California" or "Japan")
                const placeParts = fullPlace.split(',').map(s => s.trim());
                let simplifiedPlace = placeParts[placeParts.length - 1] || "Unknown Location";
                
                // Add a link to the USGS page for the earthquake
                const link = quake.properties.url;

                earthquakeListHTML += `
                    <li>
                        <a href="${link}" target="_blank">
                            <span class="quake-magnitude">M${magnitude}</span>
                            <span class="quake-location">${simplifiedPlace}</span>
                            <span class="quake-time">${time}</span>
                        </a>
                    </li>
                `;
            });
            earthquakeListHTML += `</ul>`;
        } else {
            earthquakeListHTML = `<p>No recent significant earthquakes.</p>`;
        }
        
        earthquakeColumn.innerHTML = earthquakeListHTML;
        section.appendChild(earthquakeColumn);

        container.appendChild(section);
    },

    renderArticlesInGrid(articles, gridId, renderFunction) {
        if (articles.length === 0) return;
        const container = document.getElementById('news-container');
        const gridContainer = document.createElement('div');
        gridContainer.id = gridId;
        articles.forEach(article => renderFunction.call(this, article, gridContainer));
        container.appendChild(gridContainer);
    },

    renderMainArticle(article, parent) {
        const imgSrc = article.thumbnail || article.enclosure?.link || '';
        const { domain, cleanName } = this.getDomainInfo(article.link);
        parent.innerHTML += `
            <div class="main-article">
                <div class="thumb">
                    <img src="${imgSrc}" alt="${article.title}" onerror="NewsApp.getRandomFallbackImage(this)">
                </div>
                <div class="news-text">
                    <a href="${article.link}" target="_blank">${article.title}</a>
                    <span class="meta"><br>
                        <a class="source" href="https://${domain}" target="_blank">${cleanName}</a> ·
                        <span class="date">${this.formatTimeAgo(article.pubDate)}</span>
                    </span>
                </div>
            </div>
        `;
    },

    renderSecondaryArticle(article, parent) {
        const imgSrc = this.getDomainLogo(article.link);
        const { domain, cleanName } = this.getDomainInfo(article.link);
        const item = document.createElement('div');
        item.className = 'secondary-article animated-on-scroll';
        const link = document.createElement('a');
        link.href = article.link;
        link.target = "_blank";
        link.innerHTML = `
            <div class="thumb">
                <img src="${imgSrc}" alt="${cleanName} logo" onerror="this.src='images/placeholder.png'">
            </div>
            <div class="news-text">
                <h4>${article.title}</h4>
                <span class="meta">
                    <span class="source">${cleanName}</span> ·
                    <span class="date">${this.formatTimeAgo(article.pubDate)}</span>
                </span>
            </div>
        `;
        item.appendChild(link);
        parent.appendChild(item);
    },

    // --- Utility Functions ---
    formatTimeAgo(dateString) {
        const pubDate = new Date(dateString);
        const now = new Date();
        const diffInMinutes = Math.floor((now - pubDate) / 60000);
        
        // Show "Just now" for articles published within the last 20 minutes
        if (diffInMinutes <= 20) {
            return "Just now";
        } 
        // Show "X mins ago" for articles published 21-59 minutes ago
        else if (diffInMinutes >= 21 && diffInMinutes <= 59) {
            return `${diffInMinutes} mins ago`;
        }
        
        const diffInHours = Math.floor(diffInMinutes / 60);

        // Show "X hours ago" for articles published 1-23 hours ago
        if (diffInHours >= 1 && diffInHours <= 23) {
            return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
        }
        
        // For anything older than 24 hours, show the month and day
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[pubDate.getMonth()]} ${pubDate.getDate()}`;
    },

    getRandomFallbackImage(imgElement) {
        const randomIndex = Math.floor(Math.random() * this.config.fallbackImages.length);
        imgElement.src = this.config.fallbackImages[randomIndex];
    },

    getDomainLogo(url) {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        } catch {
            return "images/placeholder.png";
        }
    },

    getDomainInfo(url) {
        try {
            const domain = new URL(url).hostname.replace(/^www\./, "");
            const cleanName = domain.split(".")[0];
            return { domain, cleanName };
        } catch {
            return { domain: "", cleanName: "Unknown" };
        }
    },

    showLoadingState() {
        document.getElementById('news-container').innerHTML = `
            <div class="friendly-message" id="friendly-message">
                <div class="spinner"></div>
                Loading news...
            </div>
        `;
    },

    // --- Animation and Initialization ---
    initScrollAnimation() {
        const articlesToAnimate = document.querySelectorAll('.secondary-article');
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        articlesToAnimate.forEach(article => observer.observe(article));
    },

    async init() {
        this.showLoadingState();
        try {
            let allArticles = await this.fetchAllFeeds();
            let filteredArticles = this.filterArticles(allArticles);
            // Limit "reliefweb" articles to a maximum of 2
            filteredArticles = this.limitSourceArticles(filteredArticles, 'reliefweb.int', 2);
            filteredArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            filteredArticles = this.mixArticlesBySource(filteredArticles, 3);
            if (filteredArticles.length === 0) {
                document.getElementById('news-container').innerHTML = '<p class="friendly-message">No articles found.</p>';
            } else {
                await this.renderArticles(filteredArticles);
                this.initScrollAnimation();
            }
        } catch (e) {
            document.getElementById('news-container').innerHTML = '<p class="friendly-message">Failed to load news. Please try again later.</p>';
            console.error("Failed to load news feeds.", e);
        }
    }
};

// --- Header Scroll Animation (Outside the main object) ---
const header = document.querySelector('header');
const body = document.body;
let isScrolling = false;

window.addEventListener('scroll', () => {
    if (!isScrolling) {
        isScrolling = true;
        window.requestAnimationFrame(() => {
            const scrollThreshold = 50;
            if (window.scrollY > scrollThreshold) {
                header.classList.add('stuck');
                body.classList.add('stuck-header-active');
            } else {
                header.classList.remove('stuck');
                body.classList.remove('stuck-header-active');
            }
            isScrolling = false;
        });
    }
});

// Initialize the app on page load
document.addEventListener('DOMContentLoaded', () => {
    NewsApp.init();
});
