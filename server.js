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
const SETS_DIR = path.join(__dirname, 'sets');
const DEFAULT_SET_ID = '1';

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// State
let slides = [];
let currentSlideIndex = 0;
let currentSetId = DEFAULT_SET_ID;
let availableLanguages = [];
let timerState = {
  running: false,
  timeLeft: 0, // seconds
  totalTime: 0
};

function loadLegacyTranslations() {
  try {
    const csvPath = path.join(__dirname, 'translations.csv');
    if (!fs.existsSync(csvPath)) {
      return null;
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
          duration: parseInt(row.duration) || 0
        };
      }
      
      const lang = row.language;
      if (lang) {
        slideMap[slideId].title[lang] = row.title || '';
        slideMap[slideId].content[lang] = row.content || '';
      }
    });
    
    const slides = Object.values(slideMap).sort((a, b) => Number(a.id) - Number(b.id));
    return {
      slides,
      languages: getAvailableLanguagesFromSlides(slides)
    };
  } catch (error) {
    console.error('Error loading legacy translations:', error);
    return null;
  }
}

function loadSet(setId) {
  try {
    const setDir = path.join(SETS_DIR, setId);
    const translationsDir = path.join(setDir, 'translations');
    const timePath = path.join(setDir, 'time.csv');
    if (!fs.existsSync(translationsDir) || !fs.existsSync(timePath)) {
      return null;
    }
    
    const slideMap = {};
    const languages = [];
    const translationFiles = fs.readdirSync(translationsDir).filter(file => file.endsWith('.csv'));
    
    translationFiles.forEach(file => {
      const lang = path.basename(file, '.csv');
      languages.push(lang);
      const fileContent = fs.readFileSync(path.join(translationsDir, file), 'utf-8');
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true
      });
      
      records.forEach(row => {
        const slideId = row.slideId || row.id || '1';
        if (!slideMap[slideId]) {
          slideMap[slideId] = {
            id: slideId,
            title: {},
            content: {},
            duration: 0
          };
        }
        slideMap[slideId].title[lang] = row.title || '';
        slideMap[slideId].content[lang] = row.content || '';
      });
    });
    
    const timeContent = fs.readFileSync(timePath, 'utf-8');
    const timeRecords = parse(timeContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    timeRecords.forEach(row => {
      const slideId = row.slideId || row.id || '1';
      if (!slideMap[slideId]) {
        slideMap[slideId] = {
          id: slideId,
          title: {},
          content: {},
          duration: 0
        };
      }
      slideMap[slideId].duration = parseInt(row.duration) || 0;
    });
    
    const slides = Object.values(slideMap).sort((a, b) => Number(a.id) - Number(b.id));
    return { slides, languages };
  } catch (error) {
    console.error('Error loading set:', setId, error);
    return null;
  }
}

function listSets() {
  if (!fs.existsSync(SETS_DIR)) return [];
  return fs.readdirSync(SETS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const data = loadSet(entry.name);
      if (!data) return null;
      return {
        id: entry.name,
        languages: data.languages
      };
    })
    .filter(Boolean);
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
      return {
        currentSlideIndex: data.currentSlide || 0,
        currentSetId: data.currentSetId || DEFAULT_SET_ID
      };
    }
  } catch (error) {
    console.error('Error loading state:', error);
  }
  return {
    currentSlideIndex: 0,
    currentSetId: DEFAULT_SET_ID
  };
}

// Save state to file
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      currentSlide: currentSlideIndex,
      currentSetId,
      timestamp: new Date().toISOString()
    }), 'utf-8');
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

function getAvailableLanguagesFromSlides(slidesData) {
  const langs = new Set();
  slidesData.forEach(slide => {
    Object.keys(slide.title || {}).forEach(lang => langs.add(lang));
  });
  return Array.from(langs);
}

// Initialize slides
const savedState = loadState();
currentSetId = savedState.currentSetId || DEFAULT_SET_ID;
const setData = loadSet(currentSetId) || loadLegacyTranslations();
if (setData) {
  slides = setData.slides;
  availableLanguages = setData.languages;
} else {
  slides = createDefaultSlides();
  availableLanguages = getAvailableLanguagesFromSlides(slides);
}
currentSlideIndex = Math.min(savedState.currentSlideIndex || 0, slides.length - 1);
timerState = {
  running: false,
  timeLeft: slides[currentSlideIndex]?.duration || 0,
  totalTime: slides[currentSlideIndex]?.duration || 0
};

// Get available languages
function getAvailableLanguages() {
  return availableLanguages;
}

// Sets API
app.get('/api/sets', (req, res) => {
  res.json({
    sets: listSets()
  });
});

app.post('/api/set', (req, res) => {
  const { setId } = req.body || {};
  if (!setId) {
    return res.status(400).json({ error: 'setId is required' });
  }
  const data = loadSet(setId);
  if (!data) {
    return res.status(404).json({ error: 'Set not found' });
  }
  currentSetId = setId;
  slides = data.slides;
  availableLanguages = data.languages;
  currentSlideIndex = 0;
  timerState = {
    running: false,
    timeLeft: slides[currentSlideIndex]?.duration || 0,
    totalTime: slides[currentSlideIndex]?.duration || 0
  };
  saveState();
  io.emit('slidesUpdated', {
    slides,
    currentSlide: currentSlideIndex,
    languages: availableLanguages,
    timer: timerState,
    setId: currentSetId
  });
  return res.json({ ok: true });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send initial state
  socket.emit('init', {
    slides,
    currentSlide: currentSlideIndex,
    languages: getAvailableLanguages(),
    timer: timerState,
    setId: currentSetId
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
