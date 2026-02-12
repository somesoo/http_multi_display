const socket = io();

// Get selected languages from URL
const urlParams = new URLSearchParams(window.location.search);
const selectedLangs = urlParams.get('langs')?.split(',') || ['en'];

let slides = [];
let currentSlideIndex = 0;
let timerState = null;

const languageNames = {
    en: 'English',
    pl: 'Polski',
    de: 'Deutsch',
    es: 'Español',
    fr: 'Français',
    it: 'Italiano',
    ru: 'Русский',
    uk: 'Українська',
    cs: 'Čeština',
    sk: 'Slovenčina'
};

// Text sizing configuration
const MAX_FONT_SIZE = 300;
const MIN_FONT_SIZE_TITLE = 56;
const MIN_FONT_SIZE_CONTENT = 36;

// Socket events
socket.on('connect', () => {
    document.getElementById('connectionStatus').textContent = 'Connected';
    document.getElementById('connectionStatus').className = 'connection-status connected';
});

socket.on('disconnect', () => {
    document.getElementById('connectionStatus').textContent = 'Disconnected';
    document.getElementById('connectionStatus').className = 'connection-status disconnected';
});

socket.on('init', (data) => {
    slides = data.slides;
    currentSlideIndex = data.currentSlide;
    timerState = data.timer;
    
    renderSlide();
    updateTimer();
    
    // Hide timer bar if slide has no duration
    const timerBar = document.querySelector('.timer-bar');
    if (timerBar) {
        if (slides[currentSlideIndex] && slides[currentSlideIndex].duration === 0) {
            timerBar.classList.add('hidden');
        } else {
            timerBar.classList.remove('hidden');
        }
    }
});

socket.on('slideChanged', (index) => {
    currentSlideIndex = index;
    renderSlide();
    updateTimer();
    
    // Hide timer bar if slide has no duration
    const timerBar = document.querySelector('.timer-bar');
    if (timerBar) {
        if (slides[currentSlideIndex] && slides[currentSlideIndex].duration === 0) {
            timerBar.classList.add('hidden');
        } else {
            timerBar.classList.remove('hidden');
        }
    }
});

socket.on('timerUpdate', (state) => {
    timerState = state;
    updateTimer();
});

socket.on('slidesUpdated', (data) => {
    slides = data.slides;
    currentSlideIndex = data.currentSlide;
    timerState = data.timer;
    renderSlide();
    updateTimer();

    const timerBar = document.querySelector('.timer-bar');
    if (timerBar) {
        if (slides[currentSlideIndex] && slides[currentSlideIndex].duration === 0) {
            timerBar.classList.add('hidden');
        } else {
            timerBar.classList.remove('hidden');
        }
    }
});

// Render current slide
function renderSlide() {
    const slide = slides[currentSlideIndex];
    if (!slide) return;
    
    const container = document.getElementById('slideContainer');
    
    if (selectedLangs.length === 1) {
        // Single language view
        const lang = selectedLangs[0];
        container.className = 'slide-container single-lang';
        container.innerHTML = `
            <div class="slide-content">
                <h1 class="slide-title">${slide.title[lang] || 'No translation'}</h1>
                <p class="slide-content">${slide.content[lang] || ''}</p>
            </div>
        `;
    } else {
        // Dual language view - both in one container to measure
        container.className = 'slide-container dual-lang';
        const langSections = selectedLangs.map(lang => `
            <div class="lang-section">
                <div class="lang-label">${languageNames[lang] || lang}</div>
                <h1 class="slide-title">${slide.title[lang] || 'No translation'}</h1>
                <p class="slide-content">${slide.content[lang] || ''}</p>
            </div>
        `).join('');
        container.innerHTML = langSections;
    }
    
    // Update indicator
    document.getElementById('slideIndicator').textContent = 
        `Slide ${currentSlideIndex + 1} / ${slides.length}`;
    
    // Dynamically adjust font sizes after rendering
    setTimeout(() => adjustFontSizes(), 100);
}

// Measure content and adjust font sizes
function adjustFontSizes() {
    const container = document.getElementById('slideContainer');
    const contentArea = document.querySelector('.content-area');
    
    if (!container || !contentArea) return;
    
    // Get available space (height of content-area)
    const availableHeight = contentArea.offsetHeight - 40; // 40px for padding
    const availableWidth = contentArea.offsetWidth - 40;   // 40px for padding
    
    // Temporarily remove overflow to measure actual content size
    const originalOverflow = container.style.overflow;
    container.style.overflow = 'visible';
    
    // Binary search for best font size
    let low = MIN_FONT_SIZE_CONTENT;
    let high = MAX_FONT_SIZE;
    let bestSize = MIN_FONT_SIZE_CONTENT;
    
    while (high - low > 2) {
        const mid = Math.floor((high + low) / 2);
        
        // Apply font size
        applyFontSize(container, mid);
        
        // Measure actual content
        const actualHeight = container.offsetHeight;
        const actualWidth = container.offsetWidth;
        
        // Check if it fits
        if (actualHeight <= availableHeight && actualWidth <= availableWidth) {
            // Fits! Try larger
            bestSize = mid;
            low = mid;
        } else {
            // Too big, try smaller
            high = mid;
        }
    }
    
    // Apply the best size found
    applyFontSize(container, bestSize);
    
    // Restore overflow
    container.style.overflow = originalOverflow;
}

// Helper function to apply font size to all text elements
function applyFontSize(container, fontSize) {
    const titles = container.querySelectorAll('.slide-title');
    const contents = container.querySelectorAll('.slide-content');
    
    titles.forEach(title => {
        title.style.fontSize = fontSize + 'px';
    });
    
    contents.forEach(content => {
        content.style.fontSize = (fontSize * 0.7) + 'px';
    });
}

// Update timer display
function updateTimer() {
    if (!timerState) return;
    
    const timerEl = document.getElementById('timerDisplay');
    timerEl.textContent = timerState.timeLeft;
    
    // Warning colors - always update based on current time
    timerEl.className = 'timer-display';
    if (timerState.timeLeft <= 10 && timerState.timeLeft > 5) {
        timerEl.classList.add('warning');
    } else if (timerState.timeLeft <= 5 && timerState.timeLeft > 0) {
        timerEl.classList.add('critical');
    }
}

// Recalculate font sizes on window resize
window.addEventListener('resize', () => {
    adjustFontSizes();
});
