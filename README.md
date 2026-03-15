# SBB Live Board (ÆROforge 2026)

A high-fidelity, real-time Swiss Railway (SBB) departure board. This web application provides a live-updating station board experience, complete with an interactive route map, weather integration, and detailed transit timelines.

![Version](https://img.shields.io/badge/version-v6%20Interlaken-eb0000?style=for-the-badge)
![License](https://img.shields.io/badge/license-GNU%20GPLv3-eb0000?style=for-the-badge)

![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23F7DF1E.svg?style=for-the-badge&logo=javascript&logoColor=black)

## Features

* **Real-Time Departures:** Fetches live data via the OpenTransport API.
* **Interactive SBB Clock:** A high-performance, CSS/JS-driven Swiss railway clock with smooth-sweep second hand.
* **Dynamic Route Mapping:** Integrates Leaflet.js to show station locations and draws the physical train path when a departure is selected.
* **Transit Timelines:** Click any entry to see a vertical "next stops" timeline including:
    * Live delay prognosis (+X′).
    * Real-time platform/track changes.
    * Total journey duration.
    * Service operator info.
* **Weather Integration:** Live temperature display based on the selected station's coordinates.
* **Personalization:** * Save favorite stations for quick access.
    * Toggle between 12h/24h time formats and Celsius/Fahrenheit.
    * Customizable "Max Entries" display.

## Installation & Usage
* **You do NOT need to install to run; you can run it thru the offical website or download it if you desire.**

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/AEROmicro/SBB-Live-Board.git
    ```
2.  **Open the project:**
    Simply open `index.html` in any modern web browser. No backend or local server is required as it uses client-side Fetch API.

3.  **Deployment:**
    The project is PWA-ready. You can host it via GitHub Pages, Vercel, or Netlify by simply uploading the directory.

## Tech Stack (The nerd stuff)

* **HTML5 / CSS3:** Custom styles utilizing SBB branding guidelines (`#2d327d` blue and `#eb0000` red).
* **Vanilla JavaScript:** Asynchronous API handling and DOM manipulation.
* **Leaflet.js:** Open-source interactive maps and polyline route rendering.
* **OpenStreetMap:** Map tile provider.
* **APIs:**
    * [Transport OpenData CH](https://transport.opendata.ch/): Real-time railway data.
    * [Open-Meteo](https://open-meteo.com/): Current weather data based on station coordinates.

## License (The fun legal stuff)

Distributed under the **GNU GPLv3 License**. See `LICENSE` for more information.
* *WARNING:* all software that uses part or all of this program must distriube under the same licence. Failure to do so can result in legal consquences. This software also provides *ZERO* warranty of any kind. Any events that occur due to this software are not at fault at AEROmicro (ÆROxol) or anyone who developed this project. Sole responiabilty for proper and legal use of this software are carried by the user. 

---
Developed by **ÆROforge 2026**.  
*All station data and SBB branding used under official terms.*
*This project is not affliated with SBB CFF FFS in any way.*
*All copyright from SBB CFF FFS such as the logo, the Swiss railways clock, and any other property is in control and legal ownership of the SBB CFF FFS.
