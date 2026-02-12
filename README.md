# HTTP Multi Display

Wielojęzyczny system prezentacji z obsługą wielu niezależnych zestawów slajdów, timera i zdalnego sterowania przez panel hosta.

## Funkcje

- Wielojęzyczne prezentacje (wsparcie dla dowolnej liczby języków)
- Wiele niezależnych zestawów prezentacji działających jednocześnie
- Panel hosta z autoryzacją (SHA-256) i timeoutem sesji (60 minut)
- Timer z automatycznym przełączaniem slajdów
- Real-time synchronizacja między hostem a klientami przez Socket.IO
- Responsywny interfejs z niestandardowymi czcionkami i tłami
- Wskaźniki czasu trwania dla każdego slajdu

## Wymagania

- Node.js (v14 lub nowszy)
- NPM

## Instalacja

```bash
npm install
```

## Uruchomienie

```bash
npm start
```

Aplikacja uruchomi się na porcie 3000 (lub PORT z zmiennych środowiskowych).

## Użycie

### Ekran wyboru zestawu (/)

Strona główna pozwala wybrać jeden z dostępnych zestawów prezentacji.

### Panel hosta (/host.html)

Panel sterowania dla osoby prowadzącej prezentację.

**Logowanie:**
- Sesja wygasa po 60 minutach braku aktywności

**Funkcje:**
- Wybór zestawu prezentacji
- Nawigacja między slajdami (poprzedni/następny lub kliknięcie na listę)
- Podgląd treści slajdu w wybranym języku
- Uruchamianie timera z automatycznym przełączaniem
- Zatrzymywanie timera
- Wskaźniki czasu trwania każdego slajdu

**Sterowanie:**
- Kliknij na slajd z listy aby przejść do niego
- Użyj przycisków "Previous" / "Next" do nawigacji
- Ustaw czas w sekundach i kliknij "Start Timer" aby uruchomić timer
- "Stop Timer" zatrzymuje odliczanie

### Ekran klienta (/client.html)

Wyświetla prezentację dla widzów.

**Parametry URL:**
- `?set=1` - ID zestawu prezentacji (domyślnie: 1)
- `?langs=pl,en,de` - języki do wyświetlenia, rozdzielone przecinkami

**Przykład:**
```
http://localhost:3000/client.html?set=2&langs=pl,en
```

**Funkcje:**
- Automatyczna synchronizacja z hostem
- Wyświetlanie wielu języków jednocześnie
- Dynamiczne dopasowanie rozmiaru czcionki
- Timer z odliczaniem
- Niestandardowe tło i przezroczystość kart

## Struktura zestawów

Każdy zestaw znajduje się w katalogu `sets/{id}/`:

```
sets/
  1/
    set.json                 # Metadata (nazwa zestawu)
    time.csv                 # Czasy trwania slajdów
    translations/
      en.csv                 # Tłumaczenia angielskie
      pl.csv                 # Tłumaczenia polskie
      de.csv                 # Tłumaczenia niemieckie
```

**set.json:**
```json
{
  "name": "Nazwa zestawu"
}
```

**time.csv:**
```csv
id,time
slide1,30
slide2,45
slide3,0
```

Wartość `0` oznacza slajd bez automatycznego przełączania.

**translations/{lang}.csv:**
```csv
id,title,body
slide1,Tytuł slajdu,Treść slajdu
slide2,Kolejny tytuł,Kolejna treść
```

## Konfiguracja

### Autoryzacja hosta

Edytuj `host-auth.json`:

```json
{
  "username": "admin",
  "passwordHash": "sha256_hash_hasla"
}
```

Aby wygenerować hash SHA-256:
```bash
printf '%s' 'twoje_haslo' | sha256sum | awk '{print $1}'
```

### Timeout sesji

W `server.js` zmieniaj `SESSION_TIMEOUT` (domyślnie: 60 minut):

```javascript
const SESSION_TIMEOUT = 60 * 60 * 1000; // czas w milisekundach
```

### Tło i style

Umieść plik `pbe_bck.jpg` w katalogu `public/` aby użyć niestandardowego tła.

Modyfikuj zmienne CSS w `public/style.css`:
```css
--bg-image: url('pbe_bck.jpg');
--bg-opacity: 0.24;
```

## Hosting

Aplikacja wymaga hostingu obsługującego Socket.IO (długo działające WebSocket połączenia).

**Rekomendowane platformy:**
- Railway.app
- Render.com
- Fly.io
- Heroku

**Nie wspierane:**
- Vercel (serverless, brak WebSocket)
- Netlify (tylko statyczne strony)

## Struktura projektu

```
http_multi_display/
├── server.js              # Backend (Node.js + Express + Socket.IO)
├── package.json           # Zależności projektu
├── host-auth.json         # Dane logowania hosta
├── state.json             # Stan aplikacji (opcjonalny)
├── sets/                  # Katalog zestawów prezentacji
│   ├── 1/
│   ├── 2/
│   └── 3/
└── public/
    ├── index.html         # Wybór zestawu
    ├── client.html        # Widok klienta
    ├── host.html          # Panel kontrolny hosta
    ├── script.js          # Logika klienta
    ├── style.css          # Style klienta
    └── pbe_bck.jpg        # Tło (opcjonalne)
```

## Technologie

- Node.js + Express
- Socket.IO (real-time komunikacja)
- csv-parse (parsowanie CSV)
- Inter font (Google Fonts)

## Licencja

MIT
