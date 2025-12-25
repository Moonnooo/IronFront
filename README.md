
# Iron Front

A web‑based RTS territory-control prototype inspired by **OpenFront.io**. Players push a shifting **front line**, manage armies, and expand into AI-controlled territory using terrain and economic strategy. Built with **vanilla JS + HTML5 Canvas + CSS**.

> Live demo: *(Not available yet)*
> Contribute on GitHub: *(https://github.com/Moonnooo/IronFront)*

## ✨ Features

* **Territory control & combat math** — click to expand or attack; combat resolves using army sizes and terrain bonuses instead of instant tile flips.
* **Terrain mechanics** — plains, forests, and mountains affect movement cost and defense. Mountains are strong defensive chokepoints; plains are easy to expand into.
* **Armies per tile** — each tile has an army size. Only part of the army moves when expanding or attacking.
* **Economic system** — balance/interest limits rapid expansion. Actions consume balance; regenerate over time.
* **AI opponent** — AI expands and attacks using the same rules, creating strategic frontlines.
* **Clean, scalable UI** — army numbers, balance bar, and tile colors indicate ownership and resources clearly.
* **Expandable map** — supports larger grids (64×64) for deeper strategy.

## 🧭 How to Play

1. Click on the canvas to push your front in the direction relative to the center.
2. Monitor **Balance** — expansion and attacks cost balance. Wait for regeneration if depleted.
3. Watch terrain effects — mountains slow advances, forests moderate, plains are cheap.
4. Tile armies fight based on size and terrain; stronger tiles hold longer.
5. Capture AI territory to dominate the map.

## 🧱 Tech Stack

* **Frontend:** Vanilla JavaScript, HTML5 Canvas, CSS
* **No backend yet** — prototype runs entirely in the browser
* **Future extension:** PHP + MySQL for persistence and multiplayer

## 🚀 Quick Start (Local)

1. Clone the repository:

```bash
git clone https://github.com/yourusername/pixel-front.git
cd pixel-front
```

2. Open `index.html` in a modern web browser.

3. Click on the canvas to expand or attack AI territory.

## 🔌 Gameplay Mechanics

* **Combat math** — attacks and defenses consider both army size and terrain.
* **Partial force movement** — only a portion of armies move during an expansion or attack.
* **Balance / interest** — resources that limit expansion; regenerates over time.
* **AI** — pushes into territory, responds to player expansion, and defends its tiles.
* **UI indicators** — armies displayed on tiles; balance shown with color-coded bar.

## 🧪 Dev Notes

* Map grid and tile army sizes are adjustable in `index.html` for testing.
* Terrain generation is randomized but can be fixed for consistent gameplay.
* Combat math is isolated in `resolveCombat()` — easy to tweak damage formulas.
* AI is currently simple but modular, ready to be moved to a separate `ai.js`.
* Canvas and UI elements scale cleanly; balance bar is outside the game canvas.

## 🤝 Contributing

* Fork the repo, create a branch (`feat/my-feature` or `fix/bug`), and submit a PR.
* Test the prototype in the browser; ensure army, terrain, balance, and AI interactions work correctly.
* Provide screenshots or short clips for visual changes.

## 🗺️ Roadmap

* Tile regeneration / per-tile growth
* Combat animations and visual feedback
* Smarter AI with target prioritization
* Larger maps with panning and zoom
* Persistent accounts and leaderboards

## 📜 License

Attribution-NonCommercial-ShareAlike 4.0 International © 2025 *(Your Name)*. See [LICENSE](LICENSE) for details.
