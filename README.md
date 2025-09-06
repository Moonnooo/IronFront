[README.md](https://github.com/user-attachments/files/22192261/README.md)
# IronFront

A web‑based RTS skirmish prototype where players and AI push a shifting **front line** to destroy the enemy base. Built for the browser with **PHP + JS + CSS** and a MySQL backend for persistence.

> Live site (when available): https://exudizmono.com/  
> Contribute on GitHub: https://github.com/Moonnooo/IronFront

---

## ✨ Features

- **Front line warfare** — units hold and push the line toward the opposing base; win by destroying the base.  
- **Unit selection** — click to select a unit, or **click‑drag** to show a selection box and select multiple.  
- **Help Tip mode** — toggle contextual tips on/off in‑game.  
- **Pause system** — press **Esc** to pause; game state and AI truly pause; quit to home with a warning.  
- **Armory / Store** — buy units and upgrades with command points (CP).  
- **Persistent stats** — purchases and match results save to the database (not the browser).  
- **Accounts + Leaderboard** — players sign up, log in, play, and see results on a rolling leaderboard.  
- **Clean HUD** — header/footer coexist with the canvas; UI avoids overlapping the minimap.

---

## 🧱 Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5 Canvas, CSS
- **Backend:** PHP 8+ (procedural with small helpers)
- **Database:** MySQL (PDO)
- **Pages & endpoints (key):**
  - `/game/ironfront.php` — main game
  - `/api/ironfront_submit.php` — save game events/results
  - `/profile.php` — player profile
  - `/leaderboard.php` — leaderboard
  - `/includes/db.php` — DB connection
  - `/includes/header.php`, `/includes/footer.php` — layout

---

## 🚀 Quick Start (Local)

These steps assume **XAMPP** or another PHP + MySQL stack.

1. **Clone**
   ```bash
   git clone https://github.com/Moonnooo/IronFront.git
   cd IronFront
   ```

2. **Create database**
   ```sql
   CREATE DATABASE ironfront CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   USE ironfront;

   -- Users
   CREATE TABLE users (
     id INT AUTO_INCREMENT PRIMARY KEY,
     email VARCHAR(255) UNIQUE,
     username VARCHAR(50),
     pass_hash VARCHAR(255),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   -- Game results (minimal example; extend as needed)
   CREATE TABLE game_results (
     id INT AUTO_INCREMENT PRIMARY KEY,
     user_id INT NOT NULL,
     result ENUM('win','loss') NOT NULL,
     cp_earned INT DEFAULT 0,
     units_killed INT DEFAULT 0,
     duration_seconds INT DEFAULT 0,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX (user_id),
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   );

   -- Purchases (store/armory)
   CREATE TABLE purchases (
     id INT AUTO_INCREMENT PRIMARY KEY,
     user_id INT NOT NULL,
     item_code VARCHAR(64) NOT NULL,
     qty INT DEFAULT 1,
     cost_cp INT DEFAULT 0,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX (user_id),
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   );
   ```

3. **Configure PHP DB connection**  
   Edit `/includes/db.php` (example):
   ```php
   <?php
   // includes/db.php
   $servername = "localhost";
   $username   = "root";
   $password   = "";
   $dbname     = "ironfront";

   $pdo = new PDO("mysql:host=$servername;dbname=$dbname;charset=utf8mb4", $username, $password, [
     PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
     PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
   ]);
   ```

4. **Place the project under your web root**  
   - XAMPP default: `C:\xampp\htdocs\IronFront\`  
   - Visit `http://localhost/IronFront/`

5. **Create an account and play**  
   - Sign up, log in, and click **Play Game** to open `/game/ironfront.php`.

---

## 🔌 Persistence & API

- **Saving during/after a match** happens via `POST` to `/api/ironfront_submit.php`.  
- Ensure your PHP session is active; only logged‑in players can post results.  
- Server validates and records:
  - `result` (`win`/`loss`), `cp_earned`, `units_killed`, `duration_seconds`
  - Purchases made during the session (from the Armory/Store)

> Note: Client‑only storage is avoided for core stats; DB is the source of truth.

---

## 🧭 Gameplay Notes

- Selecting a different friendly unit **selects it** (it does not move the old selection).  
- Units will **not push beyond** the enemy if engaged; they hold formation and fight.  
- The **front line** is drawn and updated as conflict shifts.  
- **Esc**: shows Pause overlay (takes precedence over Armory).  
- Quitting from Pause returns to the home page (current run progress is lost).

---

## 🧪 Dev Tips

- Keep UI elements off the canvas/minimap area; use fixed wrappers with `pointer-events` appropriately.  
- When adding new store items, record a durable `item_code` and cost logic on the server side.  
- If you see `csrf` errors on JSON POSTs, include a session‑backed token (e.g., `X-CSRF-Token`).  
- Prefer **parameterized queries** (PDO) and **server‑side validation** for all POSTs.

---

## 🤝 Contributing

We welcome PRs! Here’s the workflow:

1. **Fork** and create a feature branch: `feat/my-improvement` or `fix/issue-123`  
2. Make focused changes with clear commit messages.  
3. If you change gameplay values/UX, add a short note in your PR description.  
4. Test locally (start, pause, store purchase, match end, leaderboard update).  
5. Open a Pull Request to `main`.

### Code style
- JS: Prefer small modules/functions; avoid global leaks; keep UI and state separate when possible.  
- PHP: Use PDO, input filtering, and return JSON for API endpoints.  
- CSS: BEM‑ish class names; avoid canvas overlap.

### Issues
- Please include **steps to reproduce**, **expected vs actual**, and browser/OS.  
- Screenshots or short clips help a ton.

---

## 🗺️ Roadmap (short list)

- Better **formations** & **unit cohesion**  
- Smarter **AI push/retreat** and target selection  
- Smoother **front line** visuals  
- Expanded **Armory** (unit types, upgrades)  
- Match **replays** / telemetry  
- Server‑hosted **multiplayer**

---

## 📜 License

MIT © 2025 Moonnooo. See [LICENSE](LICENSE) for details.

> Note: Some third‑party libraries/assets may have their own licenses.

## 📣 Community

- Discord (IronFront): https://discord.gg/d88pPZtrJ8
- Project home: https://exudizmono.com/

---

**Made with PHP + JS + CSS.** Contributions welcome!
