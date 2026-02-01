# Multi-Language Synchronized Presentation System

Aplikacja webowa do synchronicznego wyświetlania tej samej treści w różnych językach z kontrolą hosta.

## 🚀 Funkcje

- **Real-time synchronizacja** - WebSocket (Socket.io) zapewnia natychmiastową synchronizację
- **Multi-language support** - Wyświetlanie 1 lub 2 języków jednocześnie
- **Timer countdown** - Odliczanie czasu widoczne na żywo dla wszystkich
- **Host control panel** - Pełna kontrola prezentacji przez hosta
- **Lekki client** - Minimalna ilość JavaScriptu, brak frameworków
- **CSV import** - Tłumaczenia ładowane z pliku CSV

## 📋 Wymagania

- Node.js (v14 lub nowszy)
- NPM

## 🛠️ Instalacja

```bash
# Zainstaluj zależności
npm install
```

## ▶️ Uruchomienie

```bash
# Start serwera
npm start
```

Serwer uruchomi się na `http://localhost:3000`

## 📱 Użycie

### Dla Hosta

1. Otwórz: `http://localhost:3000/host.html`
2. Kontroluj slajdy używając przycisków lub strzałek klawiatury
3. Ustaw timer i kontroluj odliczanie

### Dla Klientów

1. Otwórz: `http://localhost:3000`
2. Wybierz język (lub dwa języki)
3. Oglądaj prezentację - wszystko synchronizuje się automatycznie

## 📝 Format pliku CSV

Plik `translations.csv` powinien mieć następujące kolumny:

```csv
slideId,language,title,content
1,en,Welcome,Welcome to our presentation
1,pl,Witamy,Witamy na naszej prezentacji
```

- **slideId** - numer slajdu
- **language** - kod języka (en, pl, de, itp.)
- **title** - tytuł slajdu
- **content** - treść slajdu

## 🌍 Dodawanie nowych języków

1. Edytuj plik `translations.csv`
2. Dodaj nowe wiersze z odpowiednim kodem języka
3. Zrestartuj serwer
4. Nowy język pojawi się automatycznie w selektorze

## 🎨 Struktura projektu

```
http_multi_display/
├── server.js              # Backend (Node.js + Socket.io)
├── package.json           # Zależności projektu
├── translations.csv       # Tłumaczenia slajdów
└── public/
    ├── index.html         # Wybór języka (home page)
    ├── client.html        # Widok klienta
    └── host.html          # Panel kontrolny hosta
```

## 🔧 Konfiguracja

### Port serwera

Domyślnie: `3000`. Zmień w `server.js` lub ustaw zmienną środowiskową:

```bash
PORT=8080 npm start
```

## 📦 Zależności

- **express** - Web server
- **socket.io** - WebSocket real-time communication
- **csv-parse** - Parser plików CSV

## 💡 Skróty klawiszowe (Host)

- `←` Poprzedni slajd
- `→` Następny slajd

## 🐧 Uruchomienie na Linux

```bash
# Instalacja Node.js (Ubuntu/Debian)
sudo apt update
sudo apt install nodejs npm

# Klonowanie/kopiowanie projektu
cd /path/to/project

# Instalacja i uruchomienie
npm install
npm start
```

## 🔒 Bezpieczeństwo

W wersji produkcyjnej rozważ:
- Autoryzację dla panelu hosta
- HTTPS
- Rate limiting
- Walidację danych wejściowych

## 📄 Licencja

MIT
