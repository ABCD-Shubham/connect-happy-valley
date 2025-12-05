const OPENROUTER_API_KEY = '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';
const OPENROUTER_MODEL = 'openai/gpt-oss-20b:free';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const Icons = {
    location: `<svg class="result-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    phone: `<svg class="result-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
    clock: `<svg class="result-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    starFilled: `<svg class="star-icon" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>`,
    starEmpty: `<svg class="star-icon empty" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>`,
    pricing: `<svg class="result-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
    search: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    spinner: `<svg class="searching-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`
};

let restaurants = [];

async function loadRestaurantData() {
    try {
        const response = await fetch('/api/restaurants');
        if (!response.ok) {
            throw new Error('Failed to fetch restaurant data');
        }
        restaurants = await response.json();
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('resultsContainer').innerHTML = '<div class="loading">Error loading data. Please ensure the server is running.</div>';
    }
}

function getCurrentStatus(schedule) {
    if (!schedule || schedule.toLowerCase().includes('verify') || schedule.toLowerCase().includes('check') || schedule.toLowerCase().includes('varies')) {
        return { status: 'unknown', message: 'Check hours' };
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 100 + now.getMinutes();

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = dayNames[currentDay];
    const scheduleLower = schedule.toLowerCase();

    if (scheduleLower.includes('closed on ' + currentDayName.toLowerCase()) ||
        (scheduleLower.includes('(' + currentDayName.toLowerCase() + ' to') && scheduleLower.includes('closed'))) {
        return { status: 'closed', message: 'Closed today' };
    }

    if (scheduleLower.includes('closed') && !scheduleLower.includes('open')) {
        const closedMatch = schedule.match(/closed[^.]*?(\d+):(\d+)\s*(am|pm)/i);
        if (closedMatch) {
            return { status: 'closed', message: `Closed till ${closedMatch[1]}:${closedMatch[2]} ${closedMatch[3].toUpperCase()}` };
        }
        return { status: 'closed', message: 'Closed' };
    }

    const timePatterns = [
        {
            pattern: /(\w+day)[\s–-]+(\w+day)[\s:]+(\d+):(\d+)\s*(am|pm)[\s–-]+(\d+):(\d+)\s*(am|pm)/gi,
            extract: (match) => ({
                startHour: parseInt(match[3]),
                startMin: parseInt(match[4]),
                startPeriod: match[5].toLowerCase(),
                endHour: parseInt(match[6]),
                endMin: parseInt(match[7]),
                endPeriod: match[8].toLowerCase(),
                dayRange: [match[1], match[2]]
            })
        },
        {
            pattern: /(\w+day)[\s:]+(\d+):(\d+)\s*(am|pm)[\s–-]+(\d+):(\d+)\s*(am|pm)/gi,
            extract: (match) => ({
                startHour: parseInt(match[2]),
                startMin: parseInt(match[3]),
                startPeriod: match[4].toLowerCase(),
                endHour: parseInt(match[5]),
                endMin: parseInt(match[6]),
                endPeriod: match[7].toLowerCase(),
                dayRange: [match[1]]
            })
        },
        {
            pattern: /(\d+):(\d+)\s*(am|pm)[\s–-]+(\d+):(\d+)\s*(am|pm)/gi,
            extract: (match) => ({
                startHour: parseInt(match[1]),
                startMin: parseInt(match[2]),
                startPeriod: match[3].toLowerCase(),
                endHour: parseInt(match[4]),
                endMin: parseInt(match[5]),
                endPeriod: match[6].toLowerCase(),
                dayRange: null
            })
        }
    ];

    for (const { pattern, extract } of timePatterns) {
        const matches = [...schedule.matchAll(pattern)];
        for (const match of matches) {
            const timeData = extract(match);

            let startHour = timeData.startHour;
            let startMin = timeData.startMin;
            let startPeriod = timeData.startPeriod;
            let endHour = timeData.endHour;
            let endMin = timeData.endMin;
            let endPeriod = timeData.endPeriod;

            if (startPeriod === 'pm' && startHour !== 12) startHour += 12;
            if (startPeriod === 'am' && startHour === 12) startHour = 0;
            if (endPeriod === 'pm' && endHour !== 12) endHour += 12;
            if (endPeriod === 'am' && endHour === 12) endHour = 0;

            const startTime = startHour * 100 + startMin;
            const endTime = endHour * 100 + endMin;

            if (timeData.dayRange) {
                const dayIndices = timeData.dayRange.map(day => {
                    const idx = dayNames.findIndex(d => d.toLowerCase() === day.toLowerCase());
                    return idx !== -1 ? idx : null;
                }).filter(idx => idx !== null);

                if (dayIndices.length > 0) {
                    const dayInRange = dayIndices.some(idx => idx === currentDay) ||
                        (dayIndices.length === 2 && currentDay >= dayIndices[0] && currentDay <= dayIndices[1]);
                    if (!dayInRange) continue;
                }
            }

            if (currentTime >= startTime && currentTime <= endTime) {
                const endHour12 = endHour > 12 ? endHour - 12 : (endHour === 0 ? 12 : endHour);
                const endTimeStr = `${endHour12}:${endMin.toString().padStart(2, '0')} ${endPeriod.toUpperCase()}`;
                return { status: 'open', message: `Open till ${endTimeStr}` };
            } else if (currentTime < startTime) {
                const startHour12 = startHour > 12 ? startHour - 12 : (startHour === 0 ? 12 : startHour);
                const startTimeStr = `${startHour12}:${startMin.toString().padStart(2, '0')} ${startPeriod.toUpperCase()}`;
                return { status: 'closed', message: `Closed till ${startTimeStr}` };
            }
        }
    }

    if (scheduleLower.includes('closed')) {
        return { status: 'closed', message: 'Closed' };
    }

    return { status: 'unknown', message: 'Check hours' };
}

async function searchRestaurants(query) {
    if (!query.trim()) {
        return [];
    }

    // Enhanced system prompt to ALWAYS return results
    const systemPrompt = `You are a helpful restaurant search assistant. Given a search query and a list of restaurants, you MUST return a JSON array of restaurant names that are relevant to the query.

IMPORTANT RULES:
1. ALWAYS return at least 3-5 restaurant names, even if the match is not perfect
2. Be very flexible with matching - consider:
   - Cuisine type (Italian, Chinese, American, etc.)
   - Food items (pizza, burgers, tacos, etc.)
   - Price range (cheap, expensive, affordable)
   - Atmosphere (casual, upscale, family-friendly)
   - Location keywords
   - Any keywords in the description
3. If the query is vague or general, return the most popular/diverse options
4. NEVER return an empty array
5. Return ONLY valid JSON array format: ["Restaurant Name 1", "Restaurant Name 2", ...]`;

    // Include more details for better matching
    const restaurantList = restaurants.map(r =>
        `- ${r.name}: ${r.description || ''} | Pricing: ${r.pricing || 'N/A'} | Location: ${r.location || ''}`
    ).join('\n');

    const userPrompt = `Search query: "${query}"

Available restaurants:
${restaurantList}

Return a JSON array of the most relevant restaurant names (minimum 3, maximum 10):`;

    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Connect HappyValley'
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.5  // Slightly higher for more creative matching
            })
        });

        const data = await response.json();
        const content = data.choices[0].message.content.trim();

        let matchedNames = [];
        try {
            const jsonMatch = content.match(/\[.*\]/s);
            if (jsonMatch) {
                matchedNames = JSON.parse(jsonMatch[0]);
            } else {
                matchedNames = content.split('\n')
                    .filter(line => line.trim())
                    .map(line => line.replace(/^[-•*\d.)\s]+/, '').replace(/^["']|["']$/g, '').trim())
                    .filter(name => name.length > 0);
            }
        } catch (e) {
            console.error('JSON parse error:', e);
            matchedNames = content.split('\n')
                .filter(line => line.trim() && restaurants.some(r => line.includes(r.name)))
                .map(line => {
                    const match = restaurants.find(r => line.includes(r.name));
                    return match ? match.name : null;
                })
                .filter(Boolean);
        }

        // Filter restaurants by matched names
        let results = restaurants.filter(r => matchedNames.includes(r.name));

        // If AI returned no results or too few, fall back to keyword search
        if (results.length < 3) {
            console.log('AI returned too few results, using fallback search');
            results = restaurants.filter(r =>
                r.name.toLowerCase().includes(query.toLowerCase()) ||
                (r.description && r.description.toLowerCase().includes(query.toLowerCase())) ||
                (r.location && r.location.toLowerCase().includes(query.toLowerCase())) ||
                (r.pricing && r.pricing.toLowerCase().includes(query.toLowerCase()))
            );

            // If still no results, return top 5 restaurants
            if (results.length === 0) {
                results = restaurants.slice(0, 5);
            }
        }

        return results;
    } catch (error) {
        console.error('Search error:', error);
        // Fallback: keyword search
        const results = restaurants.filter(r =>
            r.name.toLowerCase().includes(query.toLowerCase()) ||
            (r.description && r.description.toLowerCase().includes(query.toLowerCase())) ||
            (r.location && r.location.toLowerCase().includes(query.toLowerCase())) ||
            (r.pricing && r.pricing.toLowerCase().includes(query.toLowerCase()))
        );

        // If no keyword matches, return top 5 restaurants
        return results.length > 0 ? results : restaurants.slice(0, 5);
    }
}

function renderStars(ratingString) {
    const match = ratingString.match(/([\d.]+)/);
    const rating = match ? parseFloat(match[1]) : 0;
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;

    let html = '';
    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            html += Icons.starFilled;
        } else {
            html += Icons.starEmpty;
        }
    }
    return html;
}


function displayResults(results, query) {
    const container = document.getElementById('resultsContainer');
    const info = document.getElementById('resultsInfo');

    if (results.length === 0) {
        container.innerHTML = '<div class="loading">No results found</div>';
        info.textContent = '';
        return;
    }

    info.textContent = `Found ${results.length} result${results.length !== 1 ? 's' : ''} for '${query}'`;

    container.innerHTML = results.map((restaurant, index) => {
        const status = getCurrentStatus(restaurant.schedule);
        const statusClass = status.status === 'open' ? 'status-open' : 'status-closed';
        const uniqueId = `details-${index}`;

        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        return `
            <div class="result-card" id="card-${index}" onclick="toggleDetails('${uniqueId}', 'card-${index}')">
                <div class="result-header">
                    <div class="result-name">${restaurant.name}</div>
                    <span class="result-status ${statusClass}">${status.message}</span>
                </div>
                <div class="result-details">
                    <div class="result-item">
                        ${Icons.location}
                        <span class="result-value">${restaurant.location || 'N/A'}</span>
                    </div>
                    <div class="result-item">
                        ${Icons.pricing}
                        <span class="result-value">${restaurant.pricing || 'N/A'}</span>
                    </div>
                    <div class="result-item">
                        <div class="rating-stars">
                            ${renderStars(restaurant.rating || '0')}
                        </div>
                        <span class="result-value">${restaurant.rating || 'N/A'}</span>
                    </div>
                </div>
                
                <div id="${uniqueId}" class="expanded-details" style="display: none;">
                    <div class="detail-separator"></div>
                    <div class="detail-info-grid">
                        <div class="detail-section">
                            <div class="detail-section-title">${Icons.phone} Contact</div>
                            <div class="detail-section-content">${escapeHtml(restaurant.contact || 'N/A')}</div>
                        </div>
                        <div class="detail-section">
                            <div class="detail-section-title">${Icons.clock} Hours</div>
                            <div class="detail-section-content">${escapeHtml(restaurant.schedule || 'N/A')}</div>
                        </div>
                    </div>
                    <div class="detail-section">
                        <div class="detail-section-title">Description</div>
                        <div class="detail-description">${escapeHtml(restaurant.description || 'No description available.')}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleDetails(detailsId, cardId) {
    const detailsElement = document.getElementById(detailsId);
    const cardElement = document.getElementById(cardId);

    // Close all other expanded cards
    document.querySelectorAll('.expanded-details').forEach(el => {
        if (el.id !== detailsId) {
            el.style.display = 'none';
            el.closest('.result-card').classList.remove('expanded');
        }
    });

    if (detailsElement.style.display === 'none') {
        detailsElement.style.display = 'block';
        cardElement.classList.add('expanded');
        // Add a small animation class
        detailsElement.classList.add('fade-in');
    } else {
        detailsElement.style.display = 'none';
        cardElement.classList.remove('expanded');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadRestaurantData();

    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsInfo = document.getElementById('resultsInfo');

    // Inject search icon into button
    searchButton.innerHTML = `${Icons.search} Search`;

    const performSearch = async () => {
        const query = searchInput.value.trim();
        if (!query) return;

        resultsInfo.textContent = '';
        resultsContainer.innerHTML = `
            <div class="searching-animation">
                ${Icons.spinner}
                <span class="searching-text">Searching...</span>
            </div>
        `;

        const results = await searchRestaurants(query);
        displayResults(results, query);
    };

    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    window.toggleDetails = toggleDetails;
});