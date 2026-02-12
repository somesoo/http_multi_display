const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;
const STATE_FILE = path.join(__dirname, 'state.json');
const SETS_DIR = path.join(__dirname, 'sets');
const DEFAULT_SET_ID = '1';
const HOST_AUTH_FILE = path.join(__dirname, 'host-auth.json');
const SESSION_TIMEOUT = 60 * 60 * 1000; // 60 minutes

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// State
const setStates = new Map();
let hostAuth = {
  username: 'niewiem',
  passwordHash: '5f5ee9e522506362e78cf4b2aca91cd8fb17af9d20aa4a4e05c84522850ce659'
};

if (fs.existsSync(HOST_AUTH_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(HOST_AUTH_FILE, 'utf-8'));
    if (data && data.username && data.passwordHash) {
      hostAuth = data;
    }
  } catch (error) {
    console.error('Error loading host-auth.json:', error);
  }
}

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

function getSetState(setId) {
  if (setStates.has(setId)) {
    return setStates.get(setId);
  }
  const data = loadSet(setId) || loadLegacyTranslations();
  if (!data) {
    const fallbackSlides = createDefaultSlides();
    const state = {
      setId,
      slides: fallbackSlides,
      languages: getAvailableLanguagesFromSlides(fallbackSlides),
      currentSlideIndex: 0,
      timerState: {
        running: false,
        timeLeft: fallbackSlides[0]?.duration || 0,
        totalTime: fallbackSlides[0]?.duration || 0
      }
    };
    setStates.set(setId, state);
    return state;
  }

  const state = {
    setId,
    slides: data.slides,
    languages: data.languages,
    currentSlideIndex: 0,
    timerState: {
      running: false,
      timeLeft: data.slides[0]?.duration || 0,
      totalTime: data.slides[0]?.duration || 0
    }
  };
  setStates.set(setId, state);
  return state;
}

function listSets() {
  if (!fs.existsSync(SETS_DIR)) return [];
  return fs.readdirSync(SETS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const data = loadSet(entry.name);
      if (!data) return null;
      const metaPath = path.join(SETS_DIR, entry.name, 'set.json');
      let name = `Zestaw ${entry.name}`;
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          if (meta && meta.name) name = meta.name;
        } catch (error) {
          console.error('Error reading set metadata:', entry.name, error);
        }
      }
      return {
        id: entry.name,
        name,
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
      if (data.sets && typeof data.sets === 'object') {
        return { sets: data.sets };
      }
      if (typeof data.currentSlide !== 'undefined') {
        return {
          sets: {
            [data.currentSetId || DEFAULT_SET_ID]: {
              currentSlide: data.currentSlide || 0
            }
          }
        };
      }
    }
  } catch (error) {
    console.error('Error loading state:', error);
  }
  return { sets: {} };
}

// Save state to file
function saveState() {
  try {
    const setsState = {};
    setStates.forEach((state, setId) => {
      setsState[setId] = {
        currentSlide: state.currentSlideIndex
      };
    });
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      sets: setsState,
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
const existingSets = listSets();
if (existingSets.length === 0) {
  getSetState(DEFAULT_SET_ID);
} else {
  existingSets.forEach(setInfo => {
    getSetState(setInfo.id);
  });
}
Object.entries(savedState.sets || {}).forEach(([setId, state]) => {
  const setState = getSetState(setId);
  setState.currentSlideIndex = Math.min(state.currentSlide || 0, setState.slides.length - 1);
  setState.timerState = {
    running: false,
    timeLeft: setState.slides[setState.currentSlideIndex]?.duration || 0,
    totalTime: setState.slides[setState.currentSlideIndex]?.duration || 0
  };
});

// Get available languages
function getAvailableLanguages() {
  return [];
}

// Sets API
app.get('/api/sets', (req, res) => {
  res.json({
    sets: listSets()
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Wait for set selection from client/host
  socket.on('host:login', (payload) => {
    const { username, password } = payload || {};
    const hash = crypto.createHash('sha256').update(password || '').digest('hex');
    if (username === hostAuth.username && hash === hostAuth.passwordHash) {
      socket.data.isHost = true;
      socket.data.loginTime = Date.now();
      socket.emit('host:loginResult', { ok: true });
    } else {
      socket.emit('host:loginResult', { ok: false });
    }
  });

  // Helper to check if host session is still valid
  const checkHostSession = () => {
    if (!socket.data.isHost) return false;
    if (!socket.data.loginTime) return false;
    const elapsed = Date.now() - socket.data.loginTime;
    if (elapsed > SESSION_TIMEOUT) {
      socket.data.isHost = false;
      socket.data.loginTime = null;
      socket.emit('host:sessionExpired');
      return false;
    }
    return true;
  };
  
  // Host controls
  socket.on('joinSet', (setId) => {
    const targetSetId = setId || DEFAULT_SET_ID;
    if (socket.data.setId) {
      socket.leave(socket.data.setId);
    }
    socket.data.setId = targetSetId;
    socket.join(targetSetId);
    const state = getSetState(targetSetId);
    socket.emit('init', {
      slides: state.slides,
      currentSlide: state.currentSlideIndex,
      languages: state.languages,
      timer: state.timerState,
      setId: targetSetId
    });
  });

  socket.on('host:selectSet', (setId) => {
    if (!checkHostSession()) return;
    const targetSetId = setId || DEFAULT_SET_ID;
    if (socket.data.setId) {
      socket.leave(socket.data.setId);
    }
    socket.data.setId = targetSetId;
    socket.join(targetSetId);
    const state = getSetState(targetSetId);
    socket.emit('init', {
      slides: state.slides,
      currentSlide: state.currentSlideIndex,
      languages: state.languages,
      timer: state.timerState,
      setId: targetSetId
    });
  });

  socket.on('host:changeSlide', (index) => {
    if (!checkHostSession()) return;
    const setId = socket.data.setId || DEFAULT_SET_ID;
    const state = getSetState(setId);
    if (index >= 0 && index < state.slides.length) {
      if (index !== state.currentSlideIndex) {
        state.currentSlideIndex = index;
        saveState();
        const currentSlide = state.slides[state.currentSlideIndex];
        state.timerState = {
          running: false,
          timeLeft: currentSlide.duration || 0,
          totalTime: currentSlide.duration || 0
        };
        io.to(setId).emit('slideChanged', state.currentSlideIndex);
        io.to(setId).emit('timerUpdate', state.timerState);
      }
    }
  });
  
  socket.on('host:nextSlide', () => {
    if (!checkHostSession()) return;
    const setId = socket.data.setId || DEFAULT_SET_ID;
    const state = getSetState(setId);
    if (state.currentSlideIndex < state.slides.length - 1) {
      state.currentSlideIndex++;
      saveState();
      const currentSlide = state.slides[state.currentSlideIndex];
      state.timerState = {
        running: false,
        timeLeft: currentSlide.duration || 0,
        totalTime: currentSlide.duration || 0
      };
      io.to(setId).emit('slideChanged', state.currentSlideIndex);
      io.to(setId).emit('timerUpdate', state.timerState);
    }
  });
  
  socket.on('host:prevSlide', () => {
    if (!checkHostSession()) return;
    const setId = socket.data.setId || DEFAULT_SET_ID;
    const state = getSetState(setId);
    if (state.currentSlideIndex > 0) {
      state.currentSlideIndex--;
      saveState();
      const currentSlide = state.slides[state.currentSlideIndex];
      state.timerState = {
        running: false,
        timeLeft: currentSlide.duration || 0,
        totalTime: currentSlide.duration || 0
      };
      io.to(setId).emit('slideChanged', state.currentSlideIndex);
      io.to(setId).emit('timerUpdate', state.timerState);
    }
  });
  
  socket.on('host:startTimer', (seconds) => {
    if (!checkHostSession()) return;
    const setId = socket.data.setId || DEFAULT_SET_ID;
    const state = getSetState(setId);
    state.timerState = {
      running: true,
      timeLeft: seconds,
      totalTime: seconds,
      startTime: Date.now()
    };
    io.to(setId).emit('timerUpdate', state.timerState);
  });
  
  socket.on('host:stopTimer', () => {
    if (!checkHostSession()) return;
    const setId = socket.data.setId || DEFAULT_SET_ID;
    const state = getSetState(setId);
    state.timerState.running = false;
    io.to(setId).emit('timerUpdate', state.timerState);
  });
  
  socket.on('host:resetTimer', () => {
    if (!socket.data.isHost) return;
    const setId = socket.data.setId || DEFAULT_SET_ID;
    const state = getSetState(setId);
    state.timerState = {
      running: false,
      timeLeft: 0,
      totalTime: 0
    };
    io.to(setId).emit('timerUpdate', state.timerState);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Timer countdown
setInterval(() => {
  setStates.forEach((state, setId) => {
    if (state.timerState.running && state.timerState.timeLeft > 0) {
      const elapsed = Math.floor((Date.now() - state.timerState.startTime) / 1000);
      state.timerState.timeLeft = Math.max(0, state.timerState.totalTime - elapsed);
      
      if (state.timerState.timeLeft === 0) {
        state.timerState.running = false;
      }
      
      io.to(setId).emit('timerUpdate', state.timerState);
    }
  });
}, 1000);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Host panel: http://localhost:${PORT}/host.html`);
  console.log(`Client view: http://localhost:${PORT}/`);
});
