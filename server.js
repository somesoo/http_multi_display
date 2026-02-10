const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;
const STATE_FILE = path.join(__dirname, 'state.json');

// Serve static files
app.use(express.static('public'));

// State
let slides = [];
let currentSlideIndex = 0;
let timerState = {
  running: false,
  timeLeft: 0, // seconds
  totalTime: 0
};

// Load translations from CSV
function loadTranslations() {
  try {
    const csvPath = path.join(__dirname, 'translations.csv');
    if (!fs.existsSync(csvPath)) {
      console.log('No translations.csv found, using default data');
      return createDefaultSlides();
    }
    
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    // Group by slideId
    const slideMap = {};
    records.forEach(row => {
      const slideId = row.slideId || '1';
      if (!slideMap[slideId]) {
        slideMap[slideId] = {
          id: slideId,
          title: {},
          content: {},
          duration: parseInt(row.duration) || 0  // Duration in seconds
        };
      }
      
      const lang = row.language;
      if (lang) {
        slideMap[slideId].title[lang] = row.title || '';
        slideMap[slideId].content[lang] = row.content || '';
      }
    });
    
    return Object.values(slideMap);
  } catch (error) {
    console.error('Error loading translations:', error);
    return createDefaultSlides();
  }
}

function createDefaultSlides() {
  return [
    {
      id: '1',
      title: {
        en: 'Welcome',
        pl: 'Witamy',
        de: 'Willkommen'
      },
      content: {
        en: 'Welcome to our presentation',
        pl: 'Witamy na naszej prezentacji',
        de: 'Willkommen zu unserer Präsentation'
      },
      duration: 30
    },
    {
      id: '2',
      title: {
        en: 'Slide 2',
        pl: 'Slajd 2',
        de: 'Folie 2'
      },
      content: {
        en: 'This is slide number two',
        pl: 'To jest slajd numer dwa',
        de: 'Dies ist Folie Nummer zwei'
      },
      duration: 45
    }
  ];
}

// Load state from file
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      currentSlideIndex = Math.min(data.currentSlide || 0, slides.length - 1);
      console.log('State loaded: current slide =', currentSlideIndex);
    }
  } catch (error) {
    console.error('Error loading state:', error);
    currentSlideIndex = 0;
  }
}

// Save state to file
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      currentSlide: currentSlideIndex,
      timestamp: new Date().toISOString()
    }), 'utf-8');
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

// Initialize slides
slides = loadTranslations();
loadState();

// Get available languages
function getAvailableLanguages() {
  const langs = new Set();
  slides.forEach(slide => {
    Object.keys(slide.title).forEach(lang => langs.add(lang));
  });
  return Array.from(langs);
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send initial state
  socket.emit('init', {
    slides,
    currentSlide: currentSlideIndex,
    languages: getAvailableLanguages(),
    timer: timerState
  });
  
  // Host controls
  socket.on('host:changeSlide', (index) => {
    if (index >= 0 && index < slides.length) {
      // Only reset timer if changing to a different slide
      if (index !== currentSlideIndex) {
        currentSlideIndex = index;
        saveState();
        
        // Reset timer to slide duration
        const currentSlide = slides[currentSlideIndex];
        timerState = {
          running: false,
          timeLeft: currentSlide.duration || 0,
          totalTime: currentSlide.duration || 0
        };
        
        io.emit('slideChanged', currentSlideIndex);
        io.emit('timerUpdate', timerState);
      }
    }
  });
  
  socket.on('host:nextSlide', () => {
    if (currentSlideIndex < slides.length - 1) {
      currentSlideIndex++;
      saveState();
      
      // Reset timer to slide duration
      const currentSlide = slides[currentSlideIndex];
      timerState = {
        running: false,
        timeLeft: currentSlide.duration || 0,
        totalTime: currentSlide.duration || 0
      };
      
      io.emit('slideChanged', currentSlideIndex);
      io.emit('timerUpdate', timerState);
    }
  });
  
  socket.on('host:prevSlide', () => {
    if (currentSlideIndex > 0) {
      currentSlideIndex--;
      saveState();
      
      // Reset timer to slide duration
      const currentSlide = slides[currentSlideIndex];
      timerState = {
        running: false,
        timeLeft: currentSlide.duration || 0,
        totalTime: currentSlide.duration || 0
      };
      
      io.emit('slideChanged', currentSlideIndex);
      io.emit('timerUpdate', timerState);
    }
  });
  
  socket.on('host:startTimer', (seconds) => {
    timerState = {
      running: true,
      timeLeft: seconds,
      totalTime: seconds,
      startTime: Date.now()
    };
    io.emit('timerUpdate', timerState);
  });
  
  socket.on('host:stopTimer', () => {
    timerState.running = false;
    io.emit('timerUpdate', timerState);
  });
  
  socket.on('host:resetTimer', () => {
    timerState = {
      running: false,
      timeLeft: 0,
      totalTime: 0
    };
    io.emit('timerUpdate', timerState);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Timer countdown
setInterval(() => {
  if (timerState.running && timerState.timeLeft > 0) {
    const elapsed = Math.floor((Date.now() - timerState.startTime) / 1000);
    timerState.timeLeft = Math.max(0, timerState.totalTime - elapsed);
    
    if (timerState.timeLeft === 0) {
      timerState.running = false;
    }
    
    io.emit('timerUpdate', timerState);
  }
}, 1000);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Host panel: http://localhost:${PORT}/host.html`);
  console.log(`Client view: http://localhost:${PORT}/`);
});
