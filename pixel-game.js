// Pixel Territory Conquest Game
class TerritoryGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 80; // 80x80 grid (6400 tiles!)
        this.tileSize = 10; // pixels per tile (adjusted for larger map)
        
        // Water system: -1 = ocean, -2 = river
        this.waterGrid = []; // Separate grid for water (to track water vs land)
        
        // Calculate canvas size to fit screen
        const maxWidth = window.innerWidth - 290; // Leave room for UI
        const maxHeight = window.innerHeight - 20;
        
        const idealWidth = this.gridSize * this.tileSize;
        const idealHeight = this.gridSize * this.tileSize;
        
        // Scale canvas to fit while maintaining aspect ratio
        const scaleX = maxWidth / idealWidth;
        const scaleY = maxHeight / idealHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up
        
        this.canvas.width = idealWidth;
        this.canvas.height = idealHeight;
        this.canvas.style.width = (idealWidth * scale) + 'px';
        this.canvas.style.height = (idealHeight * scale) + 'px';
        
        // Store scale for click coordinate calculations
        this.canvasScale = scale;
        
        this.grid = [];
        this.troops = []; // Troops per tile
        this.ownedCount = 0;
        this.totalTiles = this.gridSize * this.gridSize;
        this.clicks = 0;
        this.bots = [];
        this.botColors = [
            { color: '#ff0000', name: 'Red Bot', owned: 0, troops: 0 },
            { color: '#0000ff', name: 'Blue Bot', owned: 0, troops: 0 },
            { color: '#ff00ff', name: 'Purple Bot', owned: 0, troops: 0 }
        ];
        this.botSpeed = 500; // milliseconds between bot moves
        this.baseTroopGenerationRate = 0.05; // Base troop generation
        this.troopGenerationRate = 0.05; // Troops generated per tile per frame (scaled by population)
        this.baseTroopsPerTile = 10; // Base troops when tile is captured
        this.maxTroopsPerTile = 100; // Maximum troops a single tile can hold
        this.selectedTroops = 100; // Default selected troops for attack
        this.attackPercentage = 50; // Percentage of troops to send (0-100)
        
        // Resources (OpenFront.io style)
        // Start with enough gold to try buildings immediately.
        this.gold = 1000;
        this.population = 100;
        this.maxPopulation = 1000;
        this.goldPerSecond = 0;

        // Bot resources
        this.botGold = this.botColors.map(() => 1000);
        this.botGoldPerSecond = this.botColors.map(() => 0);
        
        // Buildings
        this.buildings = []; // Store building data: {x, y, type}
        this.buildingTypes = {
            city: { cost: 500, goldIncome: 2, populationBonus: 100, name: 'City' },
            defense: { cost: 200, defenseBonus: 50, name: 'Defense Post' },
            port: { cost: 300, goldIncome: 1, name: 'Port' },
            factory: { cost: 400, name: 'Factory' }
        };
        this.selectedBuilding = null;

        // Trade (ports spawn bolts that travel on water to other ports)
        this.tradeBolts = []; // {ownerId, from:{x,y}, to:{x,y}, path:[[x,y],...], step, progress}
        this.tradeIncomePerTrip = 10;
        
        // Train system
        this.trainLines = []; // Array of {factoryX, factoryY, targetX, targetY, path: [[x,y],...]}
        this.trains = []; // Array of {lineIndex, position, progress: 0-1}
        this.trainIncomePerTrip = 5; // Gold earned per train trip
        this.trainSpeed = 0.005; // Progress per frame (0-1)
        
        // Territory states: 0 = neutral, 1 = player owned, 2+ = bot owned (bot ID)
        this.initGrid();
        this.setupEventListeners();
        this.gameLoop();
    }
    
    initGrid() {
        // Initialize grids with neutral tiles
        for (let y = 0; y < this.gridSize; y++) {
            this.grid[y] = [];
            this.troops[y] = [];
            this.waterGrid[y] = [];
            for (let x = 0; x < this.gridSize; x++) {
                this.grid[y][x] = 0; // 0 = neutral
                this.troops[y][x] = 0; // 0 troops
                this.waterGrid[y][x] = 0; // 0 = land
            }
        }
        
        // Generate water (oceans and rivers)
        this.generateWater();
        
        // Start with center tile owned by player (ensure it's land)
        const center = Math.floor(this.gridSize / 2);
        // Find nearest land tile to center
        let startX = center;
        let startY = center;
        for (let radius = 0; radius < this.gridSize / 2; radius++) {
            let found = false;
            for (let dy = -radius; dy <= radius && !found; dy++) {
                for (let dx = -radius; dx <= radius && !found; dx++) {
                    const x = center + dx;
                    const y = center + dy;
                    if (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
                        if (this.waterGrid[y][x] === 0) { // Land tile
                            startX = x;
                            startY = y;
                            found = true;
                        }
                    }
                }
            }
            if (found) break;
        }
        
        this.grid[startY][startX] = 1;
        this.troops[startY][startX] = this.baseTroopsPerTile;
        this.ownedCount = 1;
        
        // Initialize bots at corners (ensure land tiles)
        this.initBots();
        
        this.updateUI();
        this.startBotAI();
        this.startTroopGeneration();
        this.startResourceGeneration();
        this.startTradeSystem();
        this.startTrainSystem();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    startTrainSystem() {
        // Update trains every frame
        const update = () => {
            this.updateTrains();
            requestAnimationFrame(update);
        };
        update();
    }
    
    generateWater() {
        // Generate oceans around edges (1-tile border).
        // This keeps a clear coastline: land at distToEdge==1 is always buildable and adjacent to ocean.
        const oceanDepth = 1; // Tiles from edge
        
        // First pass: Create ocean border (all edge tiles must be ocean)
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const distToEdge = Math.min(x, y, this.gridSize - 1 - x, this.gridSize - 1 - y);
                
                // All edge tiles (distToEdge === 0) must be ocean
                if (distToEdge === 0) {
                    this.waterGrid[y][x] = -1; // Ocean
                }
                // Optional: deeper ocean could be added here, but keep it deterministic for ports/trade.
            }
        }
        
        // Fill in any gaps in the ocean border using flood fill
        this.fillOceanGaps();
        
        // Avoid random single-tile inland water "puddles" (they break port/trade routing).
        // If you want lakes later, generate them as connected blobs instead.
        
        // Generate rivers connecting ocean-to-ocean
        this.generateRivers();
        
        // Ensure all rivers connect to ocean (fill diagonal gaps)
        this.connectRiversToOcean();

        // Make rivers boat-friendly: avoid diagonal-only connections and add width.
        this.thickenRivers();
    }
    
    fillOceanGaps() {
        // Fill gaps in ocean edges by checking if edge tiles have ocean neighbors
        const directions = [
            [0, -1], [0, 1], [-1, 0], [1, 0],
            [-1, -1], [-1, 1], [1, -1], [1, 1]
        ];
        
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const distToEdge = Math.min(x, y, this.gridSize - 1 - x, this.gridSize - 1 - y);
                
                // Check tiles near edges (0-2 tiles from edge)
                if (distToEdge <= 2 && this.waterGrid[y][x] !== -1) {
                    let oceanNeighbors = 0;
                    
                    for (let [dx, dy] of directions) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                            if (this.waterGrid[ny][nx] === -1) {
                                oceanNeighbors++;
                            }
                        }
                    }
                    
                    // If surrounded by mostly ocean, fill the gap
                    if (oceanNeighbors >= 5 && distToEdge <= 1) {
                        this.waterGrid[y][x] = -1;
                    }
                }
            }
        }
    }
    
    generateRivers() {
        // Create a few long rivers that connect one ocean edge to another ocean edge.
        const numRivers = 2 + Math.floor(Math.random() * 2); // 2-3 main rivers
        for (let i = 0; i < numRivers; i++) {
            const a = this.pickRandomOceanEdgePoint();
            const b = this.pickRandomOceanEdgePoint(a.side);
            if (!a || !b) continue;
            this.createRiverPath(a.x, a.y, b.x, b.y, { allowOceanTarget: true });
        }
    }
    
    pickRandomOceanEdgePoint(excludeSide = null) {
        const sides = ['top', 'bottom', 'left', 'right'].filter(s => s !== excludeSide);
        if (sides.length === 0) return null;
        const side = sides[Math.floor(Math.random() * sides.length)];
        const max = this.gridSize - 1;

        // Pick an actual ocean tile on that edge (edge is always ocean by generation).
        if (side === 'top') return { x: Math.floor(Math.random() * this.gridSize), y: 0, side };
        if (side === 'bottom') return { x: Math.floor(Math.random() * this.gridSize), y: max, side };
        if (side === 'left') return { x: 0, y: Math.floor(Math.random() * this.gridSize), side };
        return { x: max, y: Math.floor(Math.random() * this.gridSize), side };
    }

    createRiverPath(startX, startY, targetX, targetY, opts = {}) {
        // Use A* pathfinding to create connected river path
        const directions = [
            [0, -1], [0, 1], [-1, 0], [1, 0]
        ];
        
        const openSet = [{x: startX, y: startY, g: 0, h: 0, parent: null}];
        const closedSet = new Set();
        const getKey = (x, y) => `${x},${y}`;
        const heuristic = (x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2);
        
        let targetReached = false;
        let finalNode = null;
        
        while (openSet.length > 0 && !targetReached) {
            openSet.sort((a, b) => (a.g + a.h) - (b.g + b.h));
            const current = openSet.shift();
            const currentKey = getKey(current.x, current.y);
            
            if (closedSet.has(currentKey)) continue;
            closedSet.add(currentKey);
            
            // Check if reached target
            if (current.x === targetX && current.y === targetY) {
                targetReached = true;
                finalNode = current;
                break;
            }
            
            // Check all neighbors (including diagonals)
            for (let [dx, dy] of directions) {
                const nx = current.x + dx;
                const ny = current.y + dy;
                const neighborKey = getKey(nx, ny);
                
                if (nx < 0 || nx >= this.gridSize || ny < 0 || ny >= this.gridSize) continue;
                if (closedSet.has(neighborKey)) continue;
                
                // River can carve through land/river, and may end on ocean (target).
                if (!opts.allowOceanTarget && this.waterGrid[ny][nx] === -1) continue;
                if (opts.allowOceanTarget && this.waterGrid[ny][nx] === -1 && !(nx === targetX && ny === targetY)) {
                    continue;
                }
                
                const g = current.g + (dx !== 0 && dy !== 0 ? 1.414 : 1); // Diagonal costs more
                const h = heuristic(nx, ny, targetX, targetY);
                
                const existing = openSet.find(n => n.x === nx && n.y === ny);
                if (existing) {
                    if (g < existing.g) {
                        existing.g = g;
                        existing.parent = current;
                    }
                } else {
                    openSet.push({x: nx, y: ny, g, h, parent: current});
                }
            }
            
            if (closedSet.size > 2000) break; // Limit pathfinding for long rivers
        }
        
        // Reconstruct path and mark as river
        if (finalNode) {
            const path = [];
            let node = finalNode;
            while (node) {
                path.unshift([node.x, node.y]);
                node = node.parent;
            }
            
            // Mark path as river (keep the ocean endpoints as ocean).
            for (let [px, py] of path) {
                if (this.waterGrid[py][px] === -1) continue;
                this.waterGrid[py][px] = -2; // River
            }
        }
    }
    
    connectRiversToOcean() {
        // Ensure all river tiles connect to ocean (4-direction connectivity).
        
        // Find all river tiles
        const riverTiles = [];
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (this.waterGrid[y][x] === -2) {
                    riverTiles.push([x, y]);
                }
            }
        }
        
        // For each river tile, check if it connects to ocean (using flood fill)
        for (let [rx, ry] of riverTiles) {
            if (!this.isRiverConnectedToOcean(rx, ry)) {
                // Find nearest ocean and create connection
                this.connectRiverToNearestOcean(rx, ry);
            }
        }
    }
    
    connectRiverToNearestOcean(riverX, riverY) {
        // Find nearest ocean tile and create path
        let nearestOcean = null;
        let minDist = Infinity;
        
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (this.waterGrid[y][x] === -1) {
                    const dist = Math.abs(x - riverX) + Math.abs(y - riverY);
                    if (dist < minDist) {
                        minDist = dist;
                        nearestOcean = [x, y];
                    }
                }
            }
        }
        
        if (!nearestOcean) return;
        
        // Create connecting path
        const [ox, oy] = nearestOcean;
        const directions = [
            [0, -1], [0, 1], [-1, 0], [1, 0]
        ];
        
        // Simple path - move towards ocean
        let currentX = riverX;
        let currentY = riverY;
        const visited = new Set();
        
        while (Math.abs(currentX - ox) > 1 || Math.abs(currentY - oy) > 1) {
            visited.add(`${currentX},${currentY}`);
            
            let bestDir = null;
            let bestDist = Infinity;
            
            for (let [dx, dy] of directions) {
                const nx = currentX + dx;
                const ny = currentY + dy;
                const key = `${nx},${ny}`;
                
                if (nx < 0 || nx >= this.gridSize || ny < 0 || ny >= this.gridSize) continue;
                if (visited.has(key)) continue;
                if (this.waterGrid[ny][nx] === -1) {
                    // Reached ocean!
                    if (this.waterGrid[currentY][currentX] !== -1) {
                        this.waterGrid[currentY][currentX] = -2; // Mark as river
                    }
                    return;
                }
                
                const dist = Math.abs(nx - ox) + Math.abs(ny - oy);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestDir = [dx, dy];
                }
            }
            
            if (!bestDir) break;
            
            currentX += bestDir[0];
            currentY += bestDir[1];
            
            if (this.waterGrid[currentY][currentX] !== -1) {
                this.waterGrid[currentY][currentX] = -2; // Mark as river
            }
            
            if (visited.size > 50) break; // Limit iterations
        }
    }

    thickenRivers() {
        // Ensure rivers are boat-navigable on a 4-direction grid:
        // - No diagonal-only connections
        // - Add width along segments and at turns
        const riverTiles = [];
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (this.waterGrid[y][x] === -2) riverTiles.push([x, y]);
            }
        }

        const isOcean = (x, y) => this.waterGrid?.[y]?.[x] === -1;
        const isRiver = (x, y) => this.waterGrid?.[y]?.[x] === -2;

        const carveRiver = (x, y) => {
            if (x < 0 || y < 0 || x >= this.gridSize || y >= this.gridSize) return;
            if (isOcean(x, y)) return;
            this.waterGrid[y][x] = -2;
        };

        for (const [x, y] of riverTiles) {
            const up = isRiver(x, y - 1);
            const down = isRiver(x, y + 1);
            const left = isRiver(x - 1, y);
            const right = isRiver(x + 1, y);

            const hasVertical = up || down;
            const hasHorizontal = left || right;

            if (hasVertical && hasHorizontal) {
                // Turn/intersection: fill a 2x2 around the corner area
                carveRiver(x + 1, y);
                carveRiver(x, y + 1);
                carveRiver(x + 1, y + 1);
                carveRiver(x - 1, y);
                carveRiver(x, y - 1);
                carveRiver(x - 1, y - 1);
            } else if (hasVertical) {
                // Vertical segment: widen left/right
                carveRiver(x - 1, y);
                carveRiver(x + 1, y);
            } else if (hasHorizontal) {
                // Horizontal segment: widen up/down
                carveRiver(x, y - 1);
                carveRiver(x, y + 1);
            }
        }
    }
    
    onWindowResize() {
        // Recalculate canvas size on window resize
        const maxWidth = window.innerWidth - 290;
        const maxHeight = window.innerHeight - 20;
        
        const idealWidth = this.gridSize * this.tileSize;
        const idealHeight = this.gridSize * this.tileSize;
        
        const scaleX = maxWidth / idealWidth;
        const scaleY = maxHeight / idealHeight;
        const scale = Math.min(scaleX, scaleY, 1);
        
        this.canvas.style.width = (idealWidth * scale) + 'px';
        this.canvas.style.height = (idealHeight * scale) + 'px';
        this.canvasScale = scale;
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e, false));
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleClick(e, true);
        });
        
        // Prevent right-click menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Troop selector slider
        const troopSelector = document.getElementById('troopSelector');
        if (troopSelector) {
            troopSelector.addEventListener('input', (e) => {
                this.selectedTroops = parseInt(e.target.value);
                document.getElementById('selectedTroops').textContent = this.selectedTroops;
                this.updateUI();
            });
        }
        
        // Attack percentage slider (OpenFront.io style)
        const attackPercentageSlider = document.getElementById('attackPercentage');
        if (attackPercentageSlider) {
            attackPercentageSlider.addEventListener('input', (e) => {
                this.attackPercentage = parseInt(e.target.value);
                document.getElementById('attackPercentageValue').textContent = this.attackPercentage + '%';
                this.updateUI();
            });
        }
        
        // Building buttons
        document.querySelectorAll('[data-building]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent canvas click
                e.preventDefault(); // Prevent any default behavior
                const buildingType = btn.dataset.building;
                this.selectedBuilding = buildingType;
                document.querySelectorAll('[data-building]').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.updateBuildingStatus();
                console.log('Selected building:', buildingType);
            });
        });
        
        // Keyboard shortcuts for buildings
        document.addEventListener('keydown', (e) => {
            if (e.key === '1') {
                this.selectedBuilding = 'city';
                document.querySelectorAll('[data-building]').forEach(b => {
                    b.classList.remove('selected');
                    if (b.dataset.building === 'city') b.classList.add('selected');
                });
                this.updateBuildingStatus();
                console.log('Selected City (press 1)');
            } else if (e.key === '2') {
                this.selectedBuilding = 'defense';
                document.querySelectorAll('[data-building]').forEach(b => {
                    b.classList.remove('selected');
                    if (b.dataset.building === 'defense') b.classList.add('selected');
                });
                this.updateBuildingStatus();
                console.log('Selected Defense Post (press 2)');
            } else if (e.key === '3') {
                this.selectedBuilding = 'port';
                document.querySelectorAll('[data-building]').forEach(b => {
                    b.classList.remove('selected');
                    if (b.dataset.building === 'port') b.classList.add('selected');
                });
                this.updateBuildingStatus();
                console.log('Selected Port (press 3)');
            } else if (e.key === '4') {
                this.selectedBuilding = 'factory';
                document.querySelectorAll('[data-building]').forEach(b => {
                    b.classList.remove('selected');
                    if (b.dataset.building === 'factory') b.classList.add('selected');
                });
                this.updateBuildingStatus();
                console.log('Selected Factory (press 4)');
            } else if (e.key === 'Escape' || e.key === '0') {
                this.selectedBuilding = null;
                document.querySelectorAll('[data-building]').forEach(b => b.classList.remove('selected'));
                this.updateBuildingStatus();
                console.log('Building selection cleared');
            }
        });
        
        // Note: Building is handled in handleClick when clicking own tiles
    }
    
    handleClick(e, expandMode) {
        const rect = this.canvas.getBoundingClientRect();
        // Account for canvas scaling
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX / this.tileSize);
        const y = Math.floor((e.clientY - rect.top) * scaleY / this.tileSize);
        
        if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return;
        
        // Check if clicking on own tile with building selected - build instead of attack
        if (this.grid[y][x] === 1 && !expandMode && this.selectedBuilding) {
            const success = this.buildStructure(x, y, this.selectedBuilding);
            if (success) {
                this.updateUI();
                this.updateBuildingStatus(`Built ${this.buildingTypes[this.selectedBuilding].name}!`);
                // Keep building selected for multiple placements
                return; // Don't count as attack click
            }
            // Building failed - keep selection but show error
            return; // Do nothing on failed build
        }
        
        // If building selected but clicking non-owned tile, clear selection and attack
        if (this.selectedBuilding && this.grid[y][x] !== 1 && !expandMode) {
            this.selectedBuilding = null;
            document.querySelectorAll('[data-building]').forEach(b => b.classList.remove('selected'));
        }
        
        if (expandMode) {
            // Right-click: expand from owned territory
            this.expandTerritory(x, y);
        } else {
            // Left-click: expand/attack from adjacent tiles (OpenFront.io style)
            // Find all adjacent owned tiles and expand from them
            this.expandFromAdjacent(x, y);
        }
        
        this.clicks++;
        this.updateUI();
        this.checkVictory();
    }
    
    expandFromAdjacent(x, y) {
        // OpenFront.io style: Expand outward in ALL directions from all adjacent owned tiles
        const directions = [
            [0, -1], [0, 1], [-1, 0], [1, 0],
            [-1, -1], [-1, 1], [1, -1], [1, 1]
        ];
        
        // Find all player-owned tiles adjacent to the clicked area
        const adjacentOwnedTiles = [];
        for (let [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                if (this.grid[ny][nx] === 1) {
                    adjacentOwnedTiles.push([nx, ny]);
                }
            }
        }
        
        if (adjacentOwnedTiles.length === 0) return; // Not adjacent to player territory
        
        // Get available troops for expansion
        const attackTroops = Math.min(this.selectedTroops, this.getAvailableTroopsForAttack());
        const actualAttackTroops = Math.floor(attackTroops * (this.attackPercentage / 100));
        const captureRate = this.getCaptureRate(1);
        
        // Determine what we're attacking: neutral (0) or enemy (2+)
        const targetType = this.grid[y][x]; // 0 = neutral/wasteland, 2+ = enemy
        
        // Use BFS to find ALL tiles of target type that are reachable from player territory
        // Expand outward in all directions simultaneously
        const tilesToCapture = [];
        const visited = new Set();
        const queue = [];
        
        // Start from all adjacent owned tiles
        for (let [ox, oy] of adjacentOwnedTiles) {
            queue.push([ox, oy]);
            visited.add(`${ox},${oy}`);
        }
        
        // Much larger expansion radius - expand until we hit limits or run out of valid tiles
        const maxExpansionDistance = Math.max(10, captureRate * 2); // Expand much further
        
        // Expand in waves outward from all owned tiles
        while (queue.length > 0 && tilesToCapture.length < captureRate * 10) {
            const [cx, cy] = queue.shift();
            
            // Check all 8 directions from current tile
            for (let [dx, dy] of directions) {
                const nx = cx + dx;
                const ny = cy + dy;
                const neighborKey = `${nx},${ny}`;
                
                if (nx < 0 || nx >= this.gridSize || ny < 0 || ny >= this.gridSize) continue;
                if (visited.has(neighborKey)) continue;
                if (this.waterGrid[ny][nx] === -1) continue; // Skip ocean
                
                visited.add(neighborKey);
                const neighborType = this.grid[ny][nx];
                
                // If this tile is owned by player, continue expanding from it
                if (neighborType === 1) {
                    queue.push([nx, ny]);
                    continue;
                }
                
                // Can capture if:
                // 1. It's the same type as what we clicked (neutral or same enemy bot)
                // 2. It's adjacent to player territory (can be attacked)
                if (neighborType === targetType && this.canAttackTile(nx, ny, 1)) {
                    tilesToCapture.push([nx, ny]);
                    queue.push([nx, ny]); // Continue expanding from this captured tile
                }
            }
        }
        
        // Sort tiles by distance to clicked position (capture closest first)
        tilesToCapture.sort((a, b) => {
            const distA = Math.abs(a[0] - x) + Math.abs(a[1] - y);
            const distB = Math.abs(b[0] - x) + Math.abs(b[1] - y);
            return distA - distB;
        });
        
        // Calculate troops per tile and capture as many as we can
        const maxCaptures = Math.min(captureRate, tilesToCapture.length);
        const troopsPerTile = maxCaptures > 0 ? Math.floor(actualAttackTroops / maxCaptures) : 0;
        
        // Capture tiles in all directions simultaneously
        let captured = 0;
        for (let [tx, ty] of tilesToCapture) {
            if (captured >= captureRate) break;
            if (this.attackTile(tx, ty, 1, troopsPerTile)) {
                captured++;
            }
        }
    }
    
    buildStructure(x, y, buildingType, ownerId = 1) {
        if (this.grid[y][x] !== ownerId) {
            console.log('Cannot build: Not on player territory');
            if (ownerId === 1) this.updateBuildingStatus('Cannot build: place on your territory', '#ff4444');
            return false; // Must be on own territory
        }
        
        const building = this.buildingTypes[buildingType];
        if (!building) {
            console.log('Cannot build: Invalid building type');
            this.updateBuildingStatus('Cannot build: invalid building type', '#ff4444');
            return false;
        }
        
        const ownerGold = ownerId === 1 ? this.gold : this.botGold[ownerId - 2];
        if (ownerGold < building.cost) {
            console.log(`Cannot build: Not enough gold (need ${building.cost}, have ${Math.floor(ownerGold)})`);
            if (ownerId === 1) this.updateBuildingStatus(`Not enough gold (${Math.floor(this.gold)}/${building.cost}g)`, '#ff4444');
            return false; // Not enough gold
        }
        
        // Check if tile already has a building
        if (this.getBuildingAt(x, y)) {
            console.log('Cannot build: Tile already has a building');
            this.updateBuildingStatus('Cannot build: tile already has a building', '#ff4444');
            return false;
        }
        
        // Special check for ports: must be on coastline or river connected to ocean
        if (buildingType === 'port') {
            if (!this.canBuildPort(x, y)) {
                console.log('Cannot build port: Must be on coastline or river connected to ocean');
                if (ownerId === 1) this.updateBuildingStatus('Port must be on map edge next to water', '#ff4444');
                return false;
            }
        }
        
        // Build the structure
        this.buildings.push({ x, y, type: buildingType, owner: ownerId });
        if (ownerId === 1) this.gold -= building.cost;
        else this.botGold[ownerId - 2] -= building.cost;
        
        if (buildingType === 'city') {
            if (ownerId === 1) this.maxPopulation += building.populationBonus;
        } else if (buildingType === 'factory') {
            // When factory is built, create train line to nearest city/port
            this.createTrainLine(x, y);
        }
        
        console.log(`Built ${building.name} at (${x}, ${y})`);
        return true;
    }
    
    createTrainLine(factoryX, factoryY) {
        // Find nearest city or port
        let nearestCity = null;
        let nearestPort = null;
        let minCityDist = Infinity;
        let minPortDist = Infinity;
        
        for (let building of this.buildings) {
            if (this.grid[building.y][building.x] !== 1) continue; // Must be owned by player
            
            if (building.type === 'city') {
                const dist = Math.abs(building.x - factoryX) + Math.abs(building.y - factoryY);
                if (dist < minCityDist) {
                    minCityDist = dist;
                    nearestCity = building;
                }
            } else if (building.type === 'port') {
                const dist = Math.abs(building.x - factoryX) + Math.abs(building.y - factoryY);
                if (dist < minPortDist) {
                    minPortDist = dist;
                    nearestPort = building;
                }
            }
        }
        
        // Prefer city over port, but use whichever is closer
        let target = null;
        if (nearestCity && nearestPort) {
            target = minCityDist <= minPortDist ? nearestCity : nearestPort;
        } else if (nearestCity) {
            target = nearestCity;
        } else if (nearestPort) {
            target = nearestPort;
        }
        
        if (!target) return; // No city or port found
        
        // Create path from factory to target using simple pathfinding
        const path = this.findPath(factoryX, factoryY, target.x, target.y);
        if (path.length > 0) {
            this.trainLines.push({
                factoryX, factoryY,
                targetX: target.x, targetY: target.y,
                path: path
            });
            
            // Create a train on this line
            this.trains.push({
                lineIndex: this.trainLines.length - 1,
                progress: 0
            });
        }
    }
    
    findPath(startX, startY, endX, endY) {
        // Simple A* pathfinding (simplified for performance)
        const path = [];
        const openSet = [{x: startX, y: startY, g: 0, h: 0, parent: null}];
        const closedSet = new Set();
        
        const getKey = (x, y) => `${x},${y}`;
        const heuristic = (x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2);
        
        while (openSet.length > 0) {
            // Get node with lowest f score
            openSet.sort((a, b) => (a.g + a.h) - (b.g + b.h));
            const current = openSet.shift();
            
            const currentKey = getKey(current.x, current.y);
            if (closedSet.has(currentKey)) continue;
            closedSet.add(currentKey);
            
            // Check if we reached the target
            if (current.x === endX && current.y === endY) {
                // Reconstruct path
                let node = current;
                while (node) {
                    path.unshift([node.x, node.y]);
                    node = node.parent;
                }
                return path;
            }
            
            // Check neighbors
            const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
            for (let [dx, dy] of directions) {
                const nx = current.x + dx;
                const ny = current.y + dy;
                
                if (nx < 0 || nx >= this.gridSize || ny < 0 || ny >= this.gridSize) continue;
                
                // Can only build train lines on owned territory
                if (this.grid[ny][nx] !== 1) continue;
                
                const neighborKey = getKey(nx, ny);
                if (closedSet.has(neighborKey)) continue;
                
                const g = current.g + 1;
                const h = heuristic(nx, ny, endX, endY);
                
                // Check if already in open set
                const existing = openSet.find(n => n.x === nx && n.y === ny);
                if (existing) {
                    if (g < existing.g) {
                        existing.g = g;
                        existing.parent = current;
                    }
                } else {
                    openSet.push({x: nx, y: ny, g, h, parent: current});
                }
            }
            
            // Limit pathfinding to prevent infinite loops
            if (closedSet.size > 200) break;
        }
        
        return path; // Return empty or partial path if target not reached
    }
    
    updateTrains() {
        // Update train positions and generate income
        for (let i = this.trains.length - 1; i >= 0; i--) {
            const train = this.trains[i];
            const line = this.trainLines[train.lineIndex];
            
            if (!line) {
                this.trains.splice(i, 1);
                continue;
            }
            
            // Move train along the line
            train.progress += this.trainSpeed;
            
            // Check if train reached destination
            if (train.progress >= 1.0) {
                // Train completed trip - generate income
                this.gold += this.trainIncomePerTrip;
                train.progress = 0; // Reset to start
            }
        }
    }
    
    canBuildPort(x, y) {
        // Ports must be placed on LAND that is adjacent (4-direction) to CONNECTED water.
        // This avoids ports next to isolated puddles and ensures trade routes exist.
        if (this.waterGrid[y][x] !== 0) return false; // must be land

        const waterNeighbors = this.getWaterNeighbors(x, y);
        if (waterNeighbors.length === 0) return false;

        // Require that at least one adjacent water neighbor can reach the ocean through connected water.
        for (const [wx, wy] of waterNeighbors) {
            if (this.isWaterConnectedToOcean(wx, wy, 50)) return true;
        }
        return false;
    }

    isWaterConnectedToOcean(startX, startY, minVisited = 0) {
        // Flood fill on water tiles; succeed if we hit ocean and the water body isn't tiny.
        // Special case: directly adjacent to ocean should always be valid for ports.
        if (this.waterGrid?.[startY]?.[startX] === -1) return true;
        const visited = new Set();
        const queue = [[startX, startY]];
        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

        while (queue.length) {
            const [cx, cy] = queue.shift();
            const k = `${cx},${cy}`;
            if (visited.has(k)) continue;
            visited.add(k);

            const t = this.waterGrid?.[cy]?.[cx];
            if (t === -1) {
                return visited.size >= minVisited;
            }
            if (t !== -1 && t !== -2) continue;

            for (const [dx, dy] of dirs) {
                const nx = cx + dx, ny = cy + dy;
                if (nx < 0 || ny < 0 || nx >= this.gridSize || ny >= this.gridSize) continue;
                const nt = this.waterGrid?.[ny]?.[nx];
                if (nt === -1 || nt === -2) queue.push([nx, ny]);
            }
        }
        return false;
    }
    
    isCoastline(x, y) {
        // Check if land tile is adjacent to any water
        const directions = [
            [0, -1], [0, 1], [-1, 0], [1, 0],
            [-1, -1], [-1, 1], [1, -1], [1, 1]
        ];
        
        for (let [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                if (this.waterGrid[ny][nx] === -1 || this.waterGrid[ny][nx] === -2) {
                    return true; // Adjacent to ocean or river
                }
            }
        }
        return false;
    }
    
    isRiverConnectedToOcean(x, y) {
        // Use flood fill to check if river connects to ocean (4-direction).
        const visited = new Set();
        const queue = [[x, y]];
        const directions = [
            [0, -1], [0, 1], [-1, 0], [1, 0]
        ];
        
        while (queue.length > 0) {
            const [cx, cy] = queue.shift();
            const key = `${cx},${cy}`;
            if (visited.has(key)) continue;
            visited.add(key);
            
            // Check if this tile is ocean
            if (this.waterGrid[cy][cx] === -1) {
                return true; // Connected to ocean!
            }
            
            // Only follow river tiles (and ocean tiles)
            if (this.waterGrid[cy][cx] === -2 || this.waterGrid[cy][cx] === -1) {
                for (let [dx, dy] of directions) {
                    const nx = cx + dx;
                    const ny = cy + dy;
                    if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                        const nextKey = `${nx},${ny}`;
                        if (!visited.has(nextKey)) {
                            queue.push([nx, ny]);
                        }
                    }
                }
            }
        }
        
        return false; // River doesn't connect to ocean
    }
    
    startResourceGeneration() {
        setInterval(() => {
            // Gold generation from owned tiles (reduced significantly)
            let goldIncome = this.ownedCount * 0.01; // Much lower base income per tile (0.01 instead of 0.1)
            
            // Gold from buildings (also reduced)
            this.buildings.forEach(building => {
                if (this.grid[building.y][building.x] === 1) {
                    const buildingData = this.buildingTypes[building.type];
                    if (buildingData.goldIncome) {
                        goldIncome += buildingData.goldIncome;
                    }
                }
            });
            
            // Train income (generated by trains completing trips)
            // Trains generate income automatically when they complete trips
            
            this.gold += goldIncome / 10; // Update 10 times per second
            this.goldPerSecond = goldIncome;

            // Bot gold generation
            for (let i = 0; i < this.botColors.length; i++) {
                const botId = i + 2;
                let botIncome = this.botColors[i].owned * 0.01;

                this.buildings.forEach(building => {
                    if (this.grid[building.y][building.x] === botId) {
                        const buildingData = this.buildingTypes[building.type];
                        if (buildingData && buildingData.goldIncome) {
                            botIncome += buildingData.goldIncome;
                        }
                    }
                });

                this.botGold[i] += botIncome / 10;
                this.botGoldPerSecond[i] = botIncome;
            }
            
            // Population growth (like OpenFront.io)
            if (this.population < this.maxPopulation) {
                const growthRate = Math.min(this.ownedCount * 0.5, this.maxPopulation - this.population);
                this.population += growthRate / 10;
            }
            
            this.updateUI();
        }, 100);
    }

    startTradeSystem() {
        setInterval(() => {
            const ports = this.buildings.filter(b => b.type === 'port' && this.grid[b.y]?.[b.x] > 0);
            if (ports.length < 2) return;

            for (let attempt = 0; attempt < 4; attempt++) {
                const from = ports[Math.floor(Math.random() * ports.length)];
                const to = ports[Math.floor(Math.random() * ports.length)];
                if (!from || !to) continue;
                if (from.x === to.x && from.y === to.y) continue;

                const ownerId = this.grid[from.y][from.x];
                const targetOwnerId = this.grid[to.y][to.x];
                if (ownerId <= 0 || targetOwnerId <= 0) continue;

                const path = this.findWaterPathBetweenPorts(from.x, from.y, to.x, to.y);
                if (!path || path.length < 2) continue;

                this.tradeBolts.push({
                    ownerId,
                    from: { x: from.x, y: from.y },
                    to: { x: to.x, y: to.y },
                    path,
                    step: 0,
                    progress: 0
                });
            }
        }, 1200);
    }

    isWaterTile(x, y) {
        const t = this.waterGrid?.[y]?.[x];
        return t === -1 || t === -2;
    }

    getWaterNeighbors(x, y) {
        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        const out = [];
        for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= this.gridSize || ny >= this.gridSize) continue;
            if (this.isWaterTile(nx, ny)) out.push([nx, ny]);
        }
        return out;
    }

    findWaterPathBetweenPorts(fromX, fromY, toX, toY) {
        const starts = this.getWaterNeighbors(fromX, fromY);
        const goals = new Set(this.getWaterNeighbors(toX, toY).map(([x, y]) => `${x},${y}`));
        if (starts.length === 0 || goals.size === 0) return null;

        const queue = [];
        const prev = new Map();
        const seen = new Set();

        for (const [sx, sy] of starts) {
            const k = `${sx},${sy}`;
            queue.push([sx, sy]);
            seen.add(k);
            prev.set(k, null);
        }

        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        let foundKey = null;

        while (queue.length) {
            const [cx, cy] = queue.shift();
            const ck = `${cx},${cy}`;
            if (goals.has(ck)) {
                foundKey = ck;
                break;
            }
            for (const [dx, dy] of dirs) {
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx < 0 || ny < 0 || nx >= this.gridSize || ny >= this.gridSize) continue;
                if (!this.isWaterTile(nx, ny)) continue;
                const nk = `${nx},${ny}`;
                if (seen.has(nk)) continue;
                seen.add(nk);
                prev.set(nk, ck);
                queue.push([nx, ny]);
            }
        }

        if (!foundKey) return null;

        const path = [];
        let cur = foundKey;
        while (cur) {
            const [x, y] = cur.split(',').map(Number);
            path.push([x, y]);
            cur = prev.get(cur);
        }
        path.reverse();
        return path;
    }

    addGoldForOwner(ownerId, amount) {
        if (ownerId === 1) this.gold += amount;
        else if (ownerId >= 2 && ownerId - 2 < this.botGold.length) this.botGold[ownerId - 2] += amount;
    }
    
    isAdjacentToOwned(x, y, ownerId = 1) {
        // Check if tile is adjacent to owned territory
        const directions = [
            [0, -1], [0, 1], [-1, 0], [1, 0], // up, down, left, right
            [-1, -1], [-1, 1], [1, -1], [1, 1] // diagonals
        ];
        
        for (let [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                if (this.grid[ny][nx] === ownerId) {
                    return true;
                }
            }
        }
        return false;
    }
    
    getTotalTroops(ownerId = 1) {
        let total = 0;
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (this.grid[y][x] === ownerId) {
                    total += this.troops[y][x];
                }
            }
        }
        return total;
    }
    
    getCaptureRate(ownerId = 1) {
        const totalTroops = this.getTotalTroops(ownerId);
        // Base: 1 tile per click
        // Scale: 1 tile per 100 troops (capped at 10 tiles per click)
        return Math.min(10, Math.max(1, Math.floor(totalTroops / 100) + 1));
    }
    
    canAttackTile(x, y, attackerId) {
        // Cannot attack ocean tiles
        if (this.waterGrid && this.waterGrid[y] && this.waterGrid[y][x] === -1) return false;
        
        // Check if tile can be attacked (must be adjacent to attacker's territory)
        return this.isAdjacentToOwned(x, y, attackerId);
    }
    
    getTilePopulation(x, y) {
        // Population based on tile troops
        return Math.floor(this.troops[y][x] || 0);
    }
    
    getBuildingAt(x, y) {
        return this.buildings.find(b => b.x === x && b.y === y);
    }
    
    attackTile(x, y, attackerId, attackTroops = null) {
        // Cannot capture ocean tiles
        if (this.waterGrid[y][x] === -1) return false;
        
        const defenderId = this.grid[y][x];
        if (defenderId === attackerId) return false; // Already owned by attacker
        if (!this.canAttackTile(x, y, attackerId)) return false; // Not adjacent
        
        const defenderTroops = defenderId > 0 ? this.troops[y][x] : 0;
        
        // Get attacker power
        let totalAttackerPower = 0;
        
        if (attackerId === 1 && attackTroops !== null) {
            // Player: call sites already apply attackPercentage and split per-tile.
            // Treat attackTroops as the actual power being sent to this tile.
            totalAttackerPower = Math.floor(attackTroops);
        } else {
            // Bots or default: use all adjacent troops
            const directions = [
                [0, -1], [0, 1], [-1, 0], [1, 0],
                [-1, -1], [-1, 1], [1, -1], [1, 1]
            ];
            
            directions.forEach(([dx, dy]) => {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                    if (this.grid[ny][nx] === attackerId) {
                        totalAttackerPower += this.troops[ny][nx] || 0;
                    }
                }
            });
        }
        
        // Check for defense bonus from buildings
        const defenderBuilding = this.getBuildingAt(x, y);
        let defenseBonus = 1.3; // Reduced base defense ratio (was 1.5)
        if (defenderBuilding && defenderBuilding.type === 'defense') {
            defenseBonus = 1.6; // Reduced defense post bonus (was 2.0)
        }
        
        // Attacker needs at least defenseBonus * defender troops to win
        const requiredPower = (defenderTroops * defenseBonus);
        
        if (totalAttackerPower >= requiredPower || defenderId === 0) {
            // Attack successful
            const oldOwner = this.grid[y][x];
            
            // Rivers become owned when captured (water but buildable)
            // Ocean remains -1 (un-capturable)
            
            if (oldOwner === 1) {
                this.ownedCount--;
            } else if (oldOwner >= 2) {
                const botIndex = oldOwner - 2;
                if (botIndex < this.botColors.length) {
                    this.botColors[botIndex].owned--;
                }
            }
            
            this.grid[y][x] = attackerId;
            // Rivers become owned but keep water type
            if (this.waterGrid[y][x] === -2) {
                // River stays as river, but becomes owned
            }
            this.troops[y][x] = this.baseTroopsPerTile;
            
            // Remove any buildings on captured tile
            const buildingIndex = this.buildings.findIndex(b => b.x === x && b.y === y);
            if (buildingIndex !== -1) {
                this.buildings.splice(buildingIndex, 1);
            }
            
            if (attackerId === 1) {
                this.ownedCount++;
            } else if (attackerId >= 2) {
                const botIndex = attackerId - 2;
                if (botIndex < this.botColors.length) {
                    this.botColors[botIndex].owned++;
                }
            }
            
            return true;
        }
        
        return false;
    }
    
    getAvailableTroopsForAttack() {
        // Get total troops from all adjacent tiles to attackable positions
        let totalAvailable = 0;
        
        // Find all tiles adjacent to player territory that can be attacked
        const attackablePositions = new Set();
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (this.grid[y][x] !== 1 && this.canAttackTile(x, y, 1)) {
                    const directions = [
                        [0, -1], [0, 1], [-1, 0], [1, 0],
                        [-1, -1], [-1, 1], [1, -1], [1, 1]
                    ];
                    
                    directions.forEach(([dx, dy]) => {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                            if (this.grid[ny][nx] === 1) {
                                attackablePositions.add(`${nx},${ny}`);
                            }
                        }
                    });
                }
            }
        }
        
        // Sum troops from all tiles that border attackable positions
        attackablePositions.forEach(pos => {
            const [x, y] = pos.split(',').map(Number);
            totalAvailable += this.troops[y][x] || 0;
        });
        
        // Use total troops if no specific attackable positions
        if (totalAvailable === 0) {
            totalAvailable = this.getTotalTroops(1);
        }
        
        return Math.floor(totalAvailable);
    }
    
    captureTile(x, y) {
        // This is now handled by expandFromAdjacent
        // Keeping for backwards compatibility
        this.expandFromAdjacent(x, y);
    }
    
    expandTerritory(x, y) {
        // Right-click: expand in radius from clicked position (if adjacent)
        if (!this.canAttackTile(x, y, 1)) return;
        
        const captureRate = this.getCaptureRate(1);
        const availableTroops = this.getAvailableTroopsForAttack();
        const attackTroops = Math.min(this.selectedTroops, availableTroops);
        const actualAttackTroops = Math.floor(attackTroops * (this.attackPercentage / 100));
        const troopsPerTile = Math.floor(actualAttackTroops / captureRate);
        
        let captured = 0;
        
        // Try to attack the clicked tile first
        if (this.attackTile(x, y, 1, troopsPerTile)) {
            captured++;
        }
        
        // Expand in a radius, but only if adjacent to player territory
        const radius = 3;
        const tilesToCapture = [];
        
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= radius && nx >= 0 && nx < this.gridSize && 
                    ny >= 0 && ny < this.gridSize && this.grid[ny][nx] !== 1) {
                    // Check if this tile can be attacked
                    if (this.canAttackTile(nx, ny, 1)) {
                        tilesToCapture.push([nx, ny]);
                    }
                }
            }
        }
        
        // Attack up to captureRate tiles (random order)
        tilesToCapture.sort(() => Math.random() - 0.5);
        for (let [tx, ty] of tilesToCapture) {
            if (captured >= captureRate) break;
            if (this.attackTile(tx, ty, 1, troopsPerTile)) {
                captured++;
            }
        }
    }
    
    initBots() {
        // Place bots at corners (ensure land tiles)
        const corners = [
            [5, 5], // Top-left
            [this.gridSize - 6, 5], // Top-right
            [5, this.gridSize - 6]  // Bottom-left
        ];
        
        for (let i = 0; i < corners.length && i < this.botColors.length; i++) {
            let [x, y] = corners[i];
            
            // Find nearest land tile
            let found = false;
            for (let radius = 0; radius < 10 && !found; radius++) {
                for (let dy = -radius; dy <= radius && !found; dy++) {
                    for (let dx = -radius; dx <= radius && !found; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                            if (this.waterGrid[ny][nx] === 0 && this.grid[ny][nx] === 0) { // Land and neutral
                                x = nx;
                                y = ny;
                                found = true;
                            }
                        }
                    }
                }
            }
            
            if (found) {
                this.grid[y][x] = i + 2; // Bot IDs start at 2
                this.troops[y][x] = this.baseTroopsPerTile;
            }
        }
    }
    
    botMove() {
        // Each bot tries to expand/attack based on their troop count
        for (let i = 0; i < this.botColors.length; i++) {
            const botId = i + 2;
            const botTroops = this.getTotalTroops(botId);
            const botCaptureRate = Math.min(10, Math.max(1, Math.floor(botTroops / 100) + 1));
            
            // Find all tiles that can be attacked (neutral or enemy)
            const availableTiles = [];
            
            for (let y = 0; y < this.gridSize; y++) {
                for (let x = 0; x < this.gridSize; x++) {
                    // Can attack neutral tiles or enemy tiles (player or other bots)
                    if (this.grid[y][x] !== botId && this.canAttackTile(x, y, botId)) {
                        availableTiles.push([x, y]);
                    }
                }
            }
            
            // Prioritize attacking player territory
            const playerTiles = availableTiles.filter(([x, y]) => this.grid[y][x] === 1);
            const neutralTiles = availableTiles.filter(([x, y]) => this.grid[y][x] === 0);
            
            // Bot attacks based on their capture rate
            let attacks = 0;
            const maxAttacks = botCaptureRate;
            
            // Prefer attacking player, then neutral, then other bots
            const attackPriority = [
                ...playerTiles,
                ...neutralTiles,
                ...availableTiles.filter(([x, y]) => this.grid[y][x] !== 0 && this.grid[y][x] !== 1)
            ];
            
            attackPriority.sort(() => Math.random() - 0.5);
            
            for (let [x, y] of attackPriority) {
                if (attacks >= maxAttacks) break;
                if (this.attackTile(x, y, botId)) {
                    attacks++;
                }
            }

            // Build buildings too (simple economy + strategy).
            this.botTryBuild(i);
        }
        
        this.updateUI();
        this.checkVictory();
    }

    botTryBuild(botIndex) {
        const botId = botIndex + 2;

        // Don’t build every tick (keeps bots from spamming and reduces CPU).
        if (Math.random() > 0.25) return;

        const budget = this.botGold?.[botIndex] || 0;
        if (budget < 200) return;

        const botPorts = this.buildings.filter(b => b.type === 'port' && this.grid[b.y]?.[b.x] === botId);
        const botCities = this.buildings.filter(b => b.type === 'city' && this.grid[b.y]?.[b.x] === botId);

        let choices = ['defense', 'city', 'factory'];
        if (botPorts.length === 0) choices.unshift('port');
        if (botCities.length === 0) choices.unshift('city');

        choices = choices.filter(t => this.buildingTypes[t] && this.buildingTypes[t].cost <= budget);
        if (choices.length === 0) return;

        const type = choices[Math.floor(Math.random() * choices.length)];

        // Pick a random owned tile without a building (and valid port rules if port).
        const candidates = [];
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (this.grid[y][x] !== botId) continue;
                if (this.getBuildingAt(x, y)) continue;
                if (type === 'port' && !this.canBuildPort(x, y)) continue;
                candidates.push([x, y]);
            }
        }
        if (candidates.length === 0) return;

        const [bx, by] = candidates[Math.floor(Math.random() * candidates.length)];
        this.buildStructure(bx, by, type, botId);
    }
    
    getBotTerritory(botId) {
        let count = 0;
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (this.grid[y][x] === botId) count++;
            }
        }
        return count;
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#16213e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const state = this.grid[y][x];
                const waterType = this.waterGrid[y][x];
                const px = x * this.tileSize;
                const py = y * this.tileSize;
                
                // Draw water first (ocean and rivers)
                if (waterType === -1) {
                    // Ocean - deep blue
                    this.ctx.fillStyle = '#1e3a8a';
                    this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
                    this.ctx.fillStyle = '#3b82f6';
                    this.ctx.fillRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);
                } else if (waterType === -2) {
                    // River - lighter blue
                    this.ctx.fillStyle = '#2563eb';
                    this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
                    this.ctx.fillStyle = '#60a5fa';
                    this.ctx.fillRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);
                }
                
                // Draw territory over water (for owned rivers)
                if (state === 1) {
                    // Player owned territory - green with pattern
                    if (waterType === -2) {
                        // Owned river - tinted green-blue
                        this.ctx.fillStyle = '#00aa88';
                        this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
                        this.ctx.fillStyle = '#00ccaa';
                        this.ctx.fillRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);
                    } else {
                        // Normal land
                        this.ctx.fillStyle = '#00ff00';
                        this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
                        
                        // Add pixel pattern
                        this.ctx.fillStyle = '#00cc00';
                        this.ctx.fillRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);
                        
                        // Add corner highlights
                        this.ctx.fillStyle = '#88ff88';
                        this.ctx.fillRect(px, py, 3, 3);
                        this.ctx.fillRect(px + this.tileSize - 3, py, 3, 3);
                        this.ctx.fillRect(px, py + this.tileSize - 3, 3, 3);
                        this.ctx.fillRect(px + this.tileSize - 3, py + this.tileSize - 3, 3, 3);
                    }
                } else if (state >= 2) {
                    // Bot owned territory
                    const botIndex = state - 2;
                    if (botIndex < this.botColors.length) {
                        if (waterType === -2) {
                            // Owned river - tinted with bot color
                            const botColor = this.botColors[botIndex].color;
                            this.ctx.fillStyle = botColor;
                            this.ctx.globalAlpha = 0.6;
                            this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
                            this.ctx.globalAlpha = 1.0;
                        } else {
                            const botColor = this.botColors[botIndex].color;
                            this.ctx.fillStyle = botColor;
                            this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
                            
                            // Darker shade for pattern
                            const darker = this.darkenColor(botColor, 0.7);
                            this.ctx.fillStyle = darker;
                            this.ctx.fillRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);
                        }
                    }
                } else if (waterType === 0) {
                    // Neutral land territory - gray with subtle pattern
                    this.ctx.fillStyle = '#4a5568';
                    this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
                    
                    // Grid lines
                    this.ctx.strokeStyle = '#2d3748';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(px, py, this.tileSize, this.tileSize);
                    
                    // Dots pattern
                    this.ctx.fillStyle = '#718096';
                    this.ctx.fillRect(px + this.tileSize / 2 - 1, py + this.tileSize / 2 - 1, 2, 2);
                }
            }
        }
        
        // Draw train lines
        this.trainLines.forEach(line => {
            if (line.path.length < 2) return;
            
            this.ctx.strokeStyle = '#ffaa00';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            
            for (let i = 0; i < line.path.length; i++) {
                const [x, y] = line.path[i];
                const px = x * this.tileSize + this.tileSize / 2;
                const py = y * this.tileSize + this.tileSize / 2;
                
                if (i === 0) {
                    this.ctx.moveTo(px, py);
                } else {
                    this.ctx.lineTo(px, py);
                }
            }
            this.ctx.stroke();
        });
        
        // Draw trains
        this.trains.forEach(train => {
            const line = this.trainLines[train.lineIndex];
            if (!line || line.path.length < 2) return;
            
            const pathIndex = Math.floor(train.progress * (line.path.length - 1));
            const nextIndex = Math.min(pathIndex + 1, line.path.length - 1);
            const segmentProgress = (train.progress * (line.path.length - 1)) % 1;
            
            const [x1, y1] = line.path[pathIndex];
            const [x2, y2] = line.path[nextIndex];
            
            const x = (x1 + (x2 - x1) * segmentProgress) * this.tileSize + this.tileSize / 2;
            const y = (y1 + (y2 - y1) * segmentProgress) * this.tileSize + this.tileSize / 2;
            
            // Draw train (small circle)
            this.ctx.fillStyle = '#ffff00';
            this.ctx.beginPath();
            this.ctx.arc(x, y, 3, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // Draw buildings
        this.buildings.forEach(building => {
            if (this.grid[building.y][building.x] === 1) {
                const px = building.x * this.tileSize;
                const py = building.y * this.tileSize;
                
                // Draw building icon
                this.ctx.fillStyle = '#ffff00';
                if (building.type === 'city') {
                    // City - square icon
                    this.ctx.fillRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);
                } else if (building.type === 'defense') {
                    // Defense - triangle
                    this.ctx.beginPath();
                    this.ctx.moveTo(px + this.tileSize / 2, py + 2);
                    this.ctx.lineTo(px + 2, py + this.tileSize - 2);
                    this.ctx.lineTo(px + this.tileSize - 2, py + this.tileSize - 2);
                    this.ctx.closePath();
                    this.ctx.fill();
                } else if (building.type === 'port') {
                    // Port - circle
                    this.ctx.beginPath();
                    this.ctx.arc(px + this.tileSize / 2, py + this.tileSize / 2, (this.tileSize - 4) / 2, 0, Math.PI * 2);
                    this.ctx.fill();
                } else if (building.type === 'factory') {
                    // Factory - diamond shape
                    this.ctx.beginPath();
                    this.ctx.moveTo(px + this.tileSize / 2, py + 2);
                    this.ctx.lineTo(px + this.tileSize - 2, py + this.tileSize / 2);
                    this.ctx.lineTo(px + this.tileSize / 2, py + this.tileSize - 2);
                    this.ctx.lineTo(px + 2, py + this.tileSize / 2);
                    this.ctx.closePath();
                    this.ctx.fill();
                }
            }
        });

        // Draw trade bolts on water paths
        if (this.tradeBolts && this.tradeBolts.length) {
            for (const bolt of this.tradeBolts) {
                const a = bolt.path[Math.max(0, Math.min(bolt.step, bolt.path.length - 1))];
                const b = bolt.path[Math.max(0, Math.min(bolt.step + 1, bolt.path.length - 1))];
                const t = bolt.progress;
                const wx = (a[0] + (b[0] - a[0]) * t) * this.tileSize + this.tileSize / 2;
                const wy = (a[1] + (b[1] - a[1]) * t) * this.tileSize + this.tileSize / 2;

                let color = '#ffff00';
                if (bolt.ownerId >= 2) {
                    const idx = bolt.ownerId - 2;
                    color = this.botColors[idx]?.color || '#ffff00';
                }
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.arc(wx, wy, 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        // Draw border
        this.ctx.strokeStyle = '#0f3460';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    darkenColor(color, factor) {
        // Convert hex to RGB
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Darken
        const newR = Math.floor(r * factor);
        const newG = Math.floor(g * factor);
        const newB = Math.floor(b * factor);
        
        return `rgb(${newR}, ${newG}, ${newB})`;
    }
    
    startTroopGeneration() {
        // Generate troops every frame (scaled by population)
        const generate = () => {
            // Troop generation rate scales with population (like OpenFront.io)
            const populationMultiplier = Math.max(0.5, this.population / 500);
            
            // Generate troops for player tiles
            for (let y = 0; y < this.gridSize; y++) {
                for (let x = 0; x < this.gridSize; x++) {
                    if (this.grid[y][x] === 1) {
                        // Cap troops at maxTroopsPerTile
                        if (this.troops[y][x] < this.maxTroopsPerTile) {
                            this.troops[y][x] = Math.min(
                                this.maxTroopsPerTile,
                                this.troops[y][x] + this.baseTroopGenerationRate * populationMultiplier
                            );
                        }
                    } else if (this.grid[y][x] >= 2) {
                        // Generate troops for bot tiles (they also scale, with cap)
                        if (this.troops[y][x] < this.maxTroopsPerTile) {
                            this.troops[y][x] = Math.min(
                                this.maxTroopsPerTile,
                                this.troops[y][x] + this.baseTroopGenerationRate * 1.2 // Bots generate slightly faster
                            );
                        }
                    }
                }
            }
            requestAnimationFrame(generate);
        };
        generate();
    }
    
    updateUI() {
        // Update player stats
        document.getElementById('owned').textContent = this.ownedCount;
        const totalTroops = this.getTotalTroops(1);
        document.getElementById('troops').textContent = Math.floor(totalTroops);
        document.getElementById('troopsPerTile').textContent = 
            this.ownedCount > 0 ? Math.floor(totalTroops / this.ownedCount) : 0;
        document.getElementById('captureRate').textContent = this.getCaptureRate(1);
        
        // Update troop selector
        const maxAttackTroops = this.getAvailableTroopsForAttack();
        const troopSelector = document.getElementById('troopSelector');
        if (troopSelector) {
            troopSelector.max = Math.max(1000, maxAttackTroops);
            if (this.selectedTroops > maxAttackTroops) {
                this.selectedTroops = maxAttackTroops;
                troopSelector.value = this.selectedTroops;
            }
        }
        document.getElementById('maxAttackTroops').textContent = maxAttackTroops;
        document.getElementById('selectedTroops').textContent = this.selectedTroops;
        document.getElementById('actualAttackTroops').textContent = 
            Math.floor(this.selectedTroops * (this.attackPercentage / 100));
        
        // Update resources
        document.getElementById('gold').textContent = Math.floor(this.gold);
        document.getElementById('goldPerSec').textContent = this.goldPerSecond.toFixed(1);
        document.getElementById('population').textContent = Math.floor(this.population);
        document.getElementById('maxPopulation').textContent = this.maxPopulation;
        
        // Update defense stats
        const defenseTroops = Math.floor(totalTroops - this.selectedTroops);
        document.getElementById('defenseTroops').textContent = Math.max(0, defenseTroops);
        
        // Defense strength indicator
        const defensePct = totalTroops > 0 ? (defenseTroops / totalTroops) * 100 : 0;
        let defenseStrength = 'Balanced';
        let defenseColor = '#00ff88';
        
        if (defensePct < 20) {
            defenseStrength = 'Very Weak Defense';
            defenseColor = '#ff0000';
        } else if (defensePct < 40) {
            defenseStrength = 'Weak Defense';
            defenseColor = '#ff8800';
        } else if (defensePct < 60) {
            defenseStrength = 'Balanced';
            defenseColor = '#ffff00';
        } else if (defensePct < 80) {
            defenseStrength = 'Strong Defense';
            defenseColor = '#88ff00';
        } else {
            defenseStrength = 'Very Strong Defense';
            defenseColor = '#00ff00';
        }
        
        const defenseEl = document.getElementById('defenseStrength');
        defenseEl.textContent = defenseStrength;
        defenseEl.style.color = defenseColor;
        
        // Update bot stats (count only land tiles for win condition)
        const landTiles = this.getLandTileCount();
        for (let i = 0; i < this.botColors.length; i++) {
            const botId = i + 2;
            const botOwned = this.getBotTerritory(botId);
            this.botColors[i].owned = botOwned;
            const botPct = landTiles > 0 ? Math.round((botOwned / landTiles) * 100) : 0;
            document.getElementById(`bot${i}`).textContent = botOwned;
            document.getElementById(`bot${i}Pct`).textContent = botPct + '%';
        }
        
        // Calculate total owned (player + bots) - only count land tiles
        let totalOwned = this.ownedCount;
        for (let bot of this.botColors) {
            totalOwned += bot.owned;
        }
        
        const playerPct = landTiles > 0 ? Math.round((this.ownedCount / landTiles) * 100) : 0;
        document.getElementById('playerPct').textContent = playerPct + '%';
        document.getElementById('progress').textContent = 
            landTiles > 0 ? Math.round((totalOwned / landTiles) * 100) + '%' : '0%';
        document.getElementById('clicks').textContent = this.clicks;
        
        // Update building status to reflect gold changes
        this.updateBuildingStatus();
    }
    
    getLandTileCount() {
        // Count only land tiles (excluding ocean, but including rivers)
        let count = 0;
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (this.waterGrid[y][x] !== -1) { // Not ocean
                    count++;
                }
            }
        }
        return count;
    }
    
    updateBuildingStatus(message = null, color = null) {
        const statusEl = document.getElementById('buildingStatus');
        if (!statusEl) return;
        
        if (message) {
            statusEl.textContent = message;
            statusEl.style.color = color || '#00ff00';
            // Clear message after 2 seconds
            setTimeout(() => {
                if (statusEl.textContent === message) {
                    this.updateBuildingStatus();
                }
            }, 2000);
            return;
        }
        
        if (this.selectedBuilding) {
            const building = this.buildingTypes[this.selectedBuilding];
            const canAfford = this.gold >= building.cost;
            statusEl.textContent = `Selected: ${building.name} (${building.cost}g)`;
            statusEl.style.color = canAfford ? '#00ff00' : '#ff0000';
        } else {
            statusEl.textContent = 'None selected - Click button or press 1/2/3';
            statusEl.style.color = '#888';
        }
    }
    
    checkVictory() {
        const landTiles = this.getLandTileCount();
        const winThreshold = Math.floor(landTiles * 0.9); // 90% of land (excluding ocean)
        
        // Check if player won (controls 90%+)
        if (this.ownedCount >= winThreshold) {
            const victoryEl = document.getElementById('victory');
            document.getElementById('victoryClicks').textContent = this.clicks;
            victoryEl.querySelector('h1').textContent = 'VICTORY!';
            const landTiles = this.getLandTileCount();
            victoryEl.querySelectorAll('p')[0].textContent = `You control ${Math.round((this.ownedCount / landTiles) * 100)}% of the land!`;
            victoryEl.classList.add('show');
            
            // Stop bot AI
            if (this.botInterval) {
                clearInterval(this.botInterval);
            }
            return;
        }
        
        // Check if any bot won (controls 90%+)
        for (let i = 0; i < this.botColors.length; i++) {
            const botOwned = this.botColors[i].owned;
            if (botOwned >= winThreshold) {
                const victoryEl = document.getElementById('victory');
                document.getElementById('victoryClicks').textContent = this.clicks;
                victoryEl.querySelector('h1').textContent = 'DEFEAT!';
                const landTiles = this.getLandTileCount();
                victoryEl.querySelectorAll('p')[0].textContent = `${this.botColors[i].name} controls ${Math.round((botOwned / landTiles) * 100)}% of the land!`;
                victoryEl.classList.add('show');
                
                // Stop bot AI
                if (this.botInterval) {
                    clearInterval(this.botInterval);
                }
                return;
            }
        }
        
        // Check if player lost (no territory left)
        if (this.ownedCount === 0) {
            const victoryEl = document.getElementById('victory');
            document.getElementById('victoryClicks').textContent = this.clicks;
            victoryEl.querySelector('h1').textContent = 'DEFEAT!';
            victoryEl.querySelectorAll('p')[0].textContent = 'Your territory was completely conquered!';
            victoryEl.classList.add('show');
            
            // Stop bot AI
            if (this.botInterval) {
                clearInterval(this.botInterval);
            }
        }
    }
    
    totalOwned() {
        let total = this.ownedCount;
        for (let bot of this.botColors) {
            total += bot.owned;
        }
        return total;
    }
    
    restart() {
        document.getElementById('victory').classList.remove('show');
        
        // Clear bot intervals
        if (this.botInterval) {
            clearInterval(this.botInterval);
        }
        
        this.grid = [];
        this.troops = [];
        this.waterGrid = [];
        this.ownedCount = 0;
        this.clicks = 0;
        this.buildings = [];
        this.gold = 1000;
        this.botGold = this.botColors.map(() => 1000);
        this.botGoldPerSecond = this.botColors.map(() => 0);
        this.tradeBolts = [];
        this.population = 100;
        this.maxPopulation = 1000;
        this.selectedBuilding = null;
        this.selectedTroops = 100;
        this.attackPercentage = 50;
        
        // Reset bot ownership
        for (let bot of this.botColors) {
            bot.owned = 0;
            bot.troops = 0;
        }
        
        // Clear building selection
        document.querySelectorAll('[data-building]').forEach(b => b.classList.remove('selected'));
        
        // Reset sliders
        document.getElementById('troopSelector').value = 100;
        document.getElementById('attackPercentage').value = 50;
        
        this.initGrid();
        this.updateUI();
    }
    
    startBotAI() {
        this.botInterval = setInterval(() => this.botMove(), this.botSpeed);
    }
    
    gameLoop() {
        this.updateTradeBolts();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    updateTradeBolts() {
        if (!this.tradeBolts || this.tradeBolts.length === 0) return;

        const speed = 0.15;
        for (let i = this.tradeBolts.length - 1; i >= 0; i--) {
            const bolt = this.tradeBolts[i];
            if (!bolt.path || bolt.path.length < 2) {
                this.tradeBolts.splice(i, 1);
                continue;
            }

            bolt.progress += speed;
            while (bolt.progress >= 1) {
                bolt.progress -= 1;
                bolt.step++;

                if (bolt.step >= bolt.path.length - 1) {
                    // Arrived: both sides get paid.
                    const receiverOwnerId = this.grid[bolt.to.y]?.[bolt.to.x];
                    this.addGoldForOwner(bolt.ownerId, this.tradeIncomePerTrip);
                    if (receiverOwnerId && receiverOwnerId > 0) {
                        this.addGoldForOwner(receiverOwnerId, this.tradeIncomePerTrip);
                    }
                    this.tradeBolts.splice(i, 1);
                    break;
                }
            }
        }
    }
}

// Start the game when page loads
let game;
window.addEventListener('DOMContentLoaded', () => {
    game = new TerritoryGame();
});

