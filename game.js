// Virtual World Game Engine
class VirtualWorld {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.avatar = null;
        this.clock = new THREE.Clock();
        
        // Controls
        this.keys = {};
        this.moveVector = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        
        // Camera settings - will be created in init()
        this.euler = new THREE.Euler(0, 0, 0, 'XYZ');
        this.pitchObject = null;
        this.yawObject = null;
        
        // Physics
        this.velocityY = 0;
        this.onGround = true;
        this.gravity = -30;
        this.jumpForce = 15;
        
        // Settings
        this.moveSpeed = 5;
        this.runSpeed = 10;
        this.mouseSensitivity = 0.002;
        
        // Stats
        this.fps = 60;
        this.frameCount = 0;
        this.lastTime = performance.now();
        
        // Loading progress
        this.loadingProgress = 0;
        this.loadingStatus = 'Initializing...';
        
        this.init();
    }
    
    init() {
        this.updateLoadingProgress(5, 'Creating scene...');
        
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 100, 500);
        
        this.updateLoadingProgress(10, 'Setting up camera...');
        
        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        
        // Create camera hierarchy for first-person controls
        this.yawObject = new THREE.Object3D();
        this.pitchObject = new THREE.Object3D();
        this.yawObject.add(this.pitchObject);
        this.pitchObject.add(this.camera);
        
        // Add camera to scene so it can be positioned
        this.scene.add(this.yawObject);
        
        console.log('Camera created with FOV 75, aspect:', window.innerWidth / window.innerHeight);
        
        this.updateLoadingProgress(20, 'Creating renderer...');
        
        // Renderer setup
        const container = document.getElementById('canvas-container');
        
        if (!container) {
            console.error('Canvas container not found!');
            return;
        }
        
        // Try to create WebGL renderer with software rendering support
        try {
            // Create WebGL renderer with settings optimized for software rendering
            this.renderer = new THREE.WebGLRenderer({ 
                antialias: false, // Disable for better compatibility
                powerPreference: "default",
                failIfMajorPerformanceCaveat: false, // Don't fail even if performance is bad
                preserveDrawingBuffer: false,
                alpha: false,
                stencil: false, // Disable stencil for better compatibility
                depth: true
            });
            
            // Test if WebGL context is actually working
            const gl = this.renderer.getContext();
            if (!gl) {
                throw new Error('WebGL context creation failed');
            }
            
            // Get renderer info
            const rendererInfo = this.renderer.info;
            console.log('WebGL renderer created successfully');
            console.log('Renderer info:', {
                render: rendererInfo.render,
                geometries: rendererInfo.geometries,
                textures: rendererInfo.textures
            });
            
            // Check WebGL version
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                console.log('WebGL Vendor:', vendor);
                console.log('WebGL Renderer:', renderer);
            }
            
        } catch (e) {
            console.error('WebGL renderer creation failed:', e);
            console.log('Attempting fallback renderer...');
            
            // Try basic WebGL renderer as fallback
            try {
                this.renderer = new THREE.WebGLRenderer({ 
                    antialias: false,
                    failIfMajorPerformanceCaveat: false
                });
                console.log('Fallback WebGL renderer created');
            } catch (e2) {
                console.error('All WebGL attempts failed:', e2);
                alert('WebGL is not available. The 3D world cannot be rendered.');
                return;
            }
        }
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // Limit pixel ratio for performance
        
        // Enable shadows (may not work in software mode)
        if (this.renderer.shadowMap) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.BasicShadowMap; // Use basic shadows for compatibility
        }
        
        // Set clear color to sky blue
        this.renderer.setClearColor(0x87CEEB, 1);
        
        container.appendChild(this.renderer.domElement);
        console.log('Renderer added to DOM');
        
        this.updateLoadingProgress(35, 'Renderer ready');
        
        // Handle WebGL context loss
        this.renderer.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            console.warn('WebGL context lost, attempting to restore...');
        });
        
        this.renderer.domElement.addEventListener('webglcontextrestored', () => {
            console.log('WebGL context restored');
            this.init(); // Reinitialize
        });
        
        // Lighting
        this.updateLoadingProgress(40, 'Setting up lighting...');
        this.setupLighting();
        console.log('Lighting setup complete');
        
        // World
        this.updateLoadingProgress(45, 'Generating world...');
        this.createWorld();
        console.log('World created, scene has', this.scene.children.length, 'objects');
        
        this.updateLoadingProgress(90, 'Creating avatar...');
        // Avatar
        this.createAvatar();
        console.log('Avatar created at position:', this.avatar.position);
        
        // Controls
        this.updateLoadingProgress(95, 'Setting up controls...');
        this.setupControls();
        console.log('Controls setup complete');
        
        this.updateLoadingProgress(100, 'Ready!');
        
        // Test render immediately
        this.renderer.render(this.scene, this.camera);
        console.log('Initial render complete');
        
        // Start render loop
        this.animate();
        console.log('Animation loop started');
        
        // Hide loading screen after a short delay
        setTimeout(() => {
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.classList.add('hidden');
            }
        }, 500);
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Initial UI update after a short delay to ensure DOM is ready
        setTimeout(() => {
            this.updateUI();
            console.log('Initial avatar position:', this.avatar.position);
            console.log('Camera position:', this.camera.position);
            console.log('Yaw object position:', this.yawObject.position);
        }, 200);
    }
    
    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        directionalLight.shadow.bias = -0.0001;
        this.scene.add(directionalLight);
        
        // Point lights for atmosphere
        const pointLight1 = new THREE.PointLight(0xffa500, 0.5, 100);
        pointLight1.position.set(-20, 10, -20);
        this.scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0x00ff88, 0.4, 100);
        pointLight2.position.set(30, 10, 30);
        this.scene.add(pointLight2);
    }
    
    createWorld() {
        // Ground - simplified geometry to reduce GPU load
        const groundGeometry = new THREE.PlaneGeometry(500, 500, 10, 10); // Reduced segments
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x4a7c59,
            roughness: 0.8,
            wireframe: false
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Grid helper - simplified
        const gridHelper = new THREE.GridHelper(500, 25, 0xffffff, 0x888888); // Reduced divisions
        gridHelper.position.y = 0.02;
        this.scene.add(gridHelper);
        
        // Add a visible center marker - simplified
        const centerMarkerGeometry = new THREE.RingGeometry(0.5, 1, 16); // Reduced from 32 to 16
        const centerMarkerMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,
            side: THREE.DoubleSide
        });
        const centerMarker = new THREE.Mesh(centerMarkerGeometry, centerMarkerMaterial);
        centerMarker.rotation.x = -Math.PI / 2;
        centerMarker.position.y = 0.03;
        this.scene.add(centerMarker);
        
        // Create various objects in the world
        this.createWorldObjects();
        
        // Skybox/sky
        this.createSky();
    }
    
    createWorldObjects() {
        // Create objects immediately visible around spawn point
        this.createSpawnArea();
        this.updateLoadingProgress(50, 'Creating spawn area...');
        
        // Reduced object count to prevent GPU overload
        // Trees - reduced from 100 to 40 for better performance
        const treeCount = 40;
        let progressStart = 50;
        let progressRange = 15; // Trees take 15% of loading
        
        for (let i = 0; i < treeCount; i++) {
            try {
                const tree = this.createTree();
                const angle = Math.random() * Math.PI * 2;
                const distance = 5 + Math.random() * 150;
            tree.position.x = Math.cos(angle) * distance;
            tree.position.z = Math.sin(angle) * distance;
            this.scene.add(tree);
            
            // Update progress for trees
            if (i % 5 === 0) {
                const progress = progressStart + (i / treeCount) * progressRange;
                this.updateLoadingProgress(progress, `Creating trees... ${i}/${treeCount}`);
            }
            } catch (e) {
                console.warn('Error creating tree:', e);
                break;
            }
        }
        
        this.updateLoadingProgress(65, 'Creating buildings...');
        // Buildings/structures
        this.createBuildings();
        
        this.updateLoadingProgress(70, 'Creating rocks...');
        // Rocks - reduced from 50 to 25
        const rockCount = 25;
        progressStart = 70;
        progressRange = 10; // Rocks take 10% of loading
        
        for (let i = 0; i < rockCount; i++) {
            try {
                const rock = this.createRock();
                const angle = Math.random() * Math.PI * 2;
                const distance = 3 + Math.random() * 120;
                rock.position.x = Math.cos(angle) * distance;
            rock.position.z = Math.sin(angle) * distance;
            rock.rotation.y = Math.random() * Math.PI * 2;
            this.scene.add(rock);
            
            // Update progress for rocks
            if (i % 5 === 0) {
                const progress = progressStart + (i / rockCount) * progressRange;
                this.updateLoadingProgress(progress, `Creating rocks... ${i}/${rockCount}`);
            }
            } catch (e) {
                console.warn('Error creating rock:', e);
                break;
            }
        }
        
        this.updateLoadingProgress(80, 'Adding decorative objects...');
        // Add colorful objects for visibility - reduced from 30 to 15
        this.createColorfulObjects(15);
        
        this.updateLoadingProgress(85, 'World generation complete!');
    }
    
    createSpawnArea() {
        // Create a large visible platform/area at spawn
        const platformGeometry = new THREE.CylinderGeometry(15, 15, 0.5, 16);
        const platformMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x888888,
            emissive: 0x222222
        });
        const platform = new THREE.Mesh(platformGeometry, platformMaterial);
        platform.rotation.x = -Math.PI / 2;
        platform.position.y = 0.25;
        platform.receiveShadow = true;
        this.scene.add(platform);
        
        // Add a huge bright red test cube right in front to verify rendering
        const testCubeGeometry = new THREE.BoxGeometry(5, 5, 5);
        const testCubeMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            wireframe: false
        });
        const testCube = new THREE.Mesh(testCubeGeometry, testCubeMaterial);
        testCube.position.set(0, 2.5, -10); // 10 units in front of spawn
        this.scene.add(testCube);
        console.log('Added bright red test cube at', testCube.position);
        
        // Add colored pillars around spawn point as landmarks
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const distance = 10;
            const pillar = this.createPillar(colors[i]);
            pillar.position.x = Math.cos(angle) * distance;
            pillar.position.z = Math.sin(angle) * distance;
            this.scene.add(pillar);
        }
        
        // Add some objects very close to spawn
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 3 + Math.random() * 8;
            const tree = this.createTree();
            tree.position.x = Math.cos(angle) * distance;
            tree.position.z = Math.sin(angle) * distance;
            this.scene.add(tree);
        }
    }
    
    createPillar(color) {
        const pillarGeometry = new THREE.CylinderGeometry(1, 1, 8, 6); // Reduced segments
        const pillarMaterial = new THREE.MeshLambertMaterial({ 
            color: color,
            emissive: color,
            emissiveIntensity: 0.3
        });
        const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
        pillar.position.y = 4;
        pillar.castShadow = true;
        return pillar;
    }
    
    createColorfulObjects(count = 15) {
        // Add colorful boxes and spheres around the world
        for (let i = 0; i < count; i++) {
            const color = new THREE.Color().setHSL(Math.random(), 0.7, 0.5);
            let object;
            
            if (Math.random() > 0.5) {
                // Create a box
                const geometry = new THREE.BoxGeometry(2, 2, 2);
                const material = new THREE.MeshLambertMaterial({ 
                    color: color,
                    emissive: color,
                    emissiveIntensity: 0.2
                });
                object = new THREE.Mesh(geometry, material);
            } else {
                // Create a sphere - simplified geometry
                const geometry = new THREE.SphereGeometry(1, 12, 12); // Reduced from 16,16 to 12,12
                const material = new THREE.MeshLambertMaterial({ 
                    color: color,
                    emissive: color,
                    emissiveIntensity: 0.2
                });
                object = new THREE.Mesh(geometry, material);
            }
            
            const angle = Math.random() * Math.PI * 2;
            const distance = 8 + Math.random() * 150;
            object.position.x = Math.cos(angle) * distance;
            object.position.z = Math.sin(angle) * distance;
            object.position.y = 1;
            object.castShadow = true;
            object.receiveShadow = true;
            
            // Add rotation animation
            object.userData.rotationSpeed = {
                x: (Math.random() - 0.5) * 0.02,
                y: (Math.random() - 0.5) * 0.02,
                z: (Math.random() - 0.5) * 0.02
            };
            
            this.scene.add(object);
        }
    }
    
    createTree() {
        const tree = new THREE.Group();
        
        // Trunk - simplified geometry (reduced segments)
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.8, 6, 6); // Reduced from 8 to 6
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 3;
        trunk.castShadow = true;
        tree.add(trunk);
        
        // Leaves - simplified geometry
        const leavesGeometry = new THREE.ConeGeometry(4, 8, 6); // Reduced from 8 to 6
        const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 8;
        leaves.castShadow = true;
        tree.add(leaves);
        
        return tree;
    }
    
    createRock() {
        const rockGeometry = new THREE.DodecahedronGeometry(1 + Math.random() * 2, 0);
        const rockMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x666666,
            roughness: 0.9
        });
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.scale.set(
            0.5 + Math.random(),
            0.5 + Math.random() * 0.5,
            0.5 + Math.random()
        );
        rock.position.y = rock.scale.y;
        rock.castShadow = true;
        rock.receiveShadow = true;
        return rock;
    }
    
    createBuildings() {
        // Buildings closer to spawn and further away
        const buildingPositions = [
            { x: -25, z: -25 },
            { x: 25, z: -25 },
            { x: -25, z: 25 },
            { x: 25, z: 25 },
            { x: -50, z: -50 },
            { x: 50, z: -50 },
            { x: -50, z: 50 },
            { x: 50, z: 50 },
            { x: 0, z: -40 },
            { x: 0, z: 40 },
            { x: -40, z: 0 },
            { x: 40, z: 0 }
        ];
        
        buildingPositions.forEach(pos => {
            const building = this.createBuilding();
            building.position.set(pos.x, 0, pos.z);
            this.scene.add(building);
        });
    }
    
    createBuilding() {
        const building = new THREE.Group();
        
        const height = 10 + Math.random() * 15;
        const width = 8 + Math.random() * 7;
        const depth = 8 + Math.random() * 7;
        
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshLambertMaterial({ 
            color: new THREE.Color().setHSL(0.1, 0.3, 0.5 + Math.random() * 0.3)
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = height / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        building.add(mesh);
        
        // Windows
        const windowCount = Math.floor(height / 3);
        for (let i = 1; i < windowCount; i++) {
            const windowGeometry = new THREE.PlaneGeometry(width * 0.8, depth * 0.8);
            const windowMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x4444ff,
                transparent: true,
                opacity: 0.7
            });
            const window = new THREE.Mesh(windowGeometry, windowMaterial);
            window.position.y = (i / windowCount) * height - height / 2;
            window.position.z = depth / 2 + 0.01;
            building.add(window);
        }
        
        return building;
    }
    
    createSky() {
        // Simple sky gradient using fog color
        // Could be enhanced with a skybox texture
    }
    
    createAvatar() {
        // Create a simple avatar representation (invisible, just for position tracking)
        // The camera acts as the avatar's head
        this.avatar = {
            position: new THREE.Vector3(0, 5, 0),
            height: 5
        };
        
        // Position camera at spawn point
        this.yawObject.position.set(
            this.avatar.position.x,
            this.avatar.position.y,
            this.avatar.position.z
        );
        
        // Reset rotations
        this.yawObject.rotation.set(0, 0, 0);
        this.pitchObject.rotation.set(-0.3, 0, 0); // Look slightly down
        this.camera.rotation.set(0, 0, 0);
        
        // Make sure camera is looking forward initially
        this.camera.lookAt(
            this.avatar.position.x,
            this.avatar.position.y,
            this.avatar.position.z - 10
        );
        
        console.log('Avatar created at:', this.avatar.position);
        console.log('Camera positioned at:', this.yawObject.position);
        
        // Update UI immediately
        setTimeout(() => this.updateUI(), 100);
    }
    
    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            
            if (event.code === 'KeyR') {
                this.resetPosition();
            }
            
            // Debug: log key presses
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
                console.log('Movement key pressed:', event.code);
            }
        });
        
        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });
        
        // Mouse controls - movement should work even without pointer lock for testing
        let isPointerLocked = false;
        
        document.addEventListener('mousemove', (event) => {
            if (isPointerLocked) {
                const movementX = event.movementX || 0;
                const movementY = event.movementY || 0;
                
                this.yawObject.rotation.y -= movementX * this.mouseSensitivity;
                this.pitchObject.rotation.x -= movementY * this.mouseSensitivity;
                
                // Limit pitch
                this.pitchObject.rotation.x = Math.max(
                    -Math.PI / 2,
                    Math.min(Math.PI / 2, this.pitchObject.rotation.x)
                );
            }
        });
        
        // Click to lock pointer
        this.renderer.domElement.addEventListener('click', () => {
            this.renderer.domElement.requestPointerLock().catch(err => {
                console.log('Pointer lock failed:', err);
            });
        });
        
        // Pointer lock change
        document.addEventListener('pointerlockchange', () => {
            isPointerLocked = (document.pointerLockElement === this.renderer.domElement);
            console.log('Pointer lock:', isPointerLocked ? 'locked' : 'unlocked');
        });
        
        // Also allow movement without pointer lock for testing
        // This helps debug movement issues
    }
    
    resetPosition() {
        this.avatar.position.set(0, 5, 0);
        this.yawObject.position.copy(this.avatar.position);
        this.velocityY = 0;
    }
    
    updateMovement(delta) {
        this.moveVector.set(0, 0, 0);
        
        const speed = this.keys['ShiftLeft'] || this.keys['ShiftRight'] ? this.runSpeed : this.moveSpeed;
        
        // Check for movement keys
        if (this.keys['KeyW']) this.moveVector.z -= 1;
        if (this.keys['KeyS']) this.moveVector.z += 1;
        if (this.keys['KeyA']) this.moveVector.x -= 1;
        if (this.keys['KeyD']) this.moveVector.x += 1;
        
        // Normalize and apply speed
        if (this.moveVector.length() > 0) {
            this.moveVector.normalize();
            this.moveVector.multiplyScalar(speed);
            
            // Apply camera rotation to movement direction
            this.moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yawObject.rotation.y);
        }
        
        // Gravity and jumping
        if (this.keys['Space'] && this.onGround) {
            this.velocityY = this.jumpForce;
            this.onGround = false;
        }
        
        this.velocityY += this.gravity * delta;
        
        // Store old position for debugging
        const wasMoving = this.moveVector.length() > 0 || Math.abs(this.velocityY) > 0.01;
        
        // Update avatar position
        this.avatar.position.x += this.moveVector.x * delta;
        this.avatar.position.z += this.moveVector.z * delta;
        this.avatar.position.y += this.velocityY * delta;
        
        // Ground collision
        if (this.avatar.position.y < this.avatar.height) {
            this.avatar.position.y = this.avatar.height;
            this.velocityY = 0;
            this.onGround = true;
        }
        
        // Debug: Log position changes
        if (wasMoving && (this.frameCount % 30 === 0)) {
            console.log('Avatar position:', this.avatar.position.x.toFixed(2), this.avatar.position.y.toFixed(2), this.avatar.position.z.toFixed(2));
        }
        
        // Update camera position to match avatar - this is critical!
        this.yawObject.position.set(
            this.avatar.position.x,
            this.avatar.position.y,
            this.avatar.position.z
        );
    }
    
    updateUI() {
        const pos = this.avatar.position;
        
        // Always update position - check if element exists
        const positionElement = document.getElementById('position');
        if (positionElement) {
            const posText = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
            positionElement.textContent = posText;
        } else {
            console.warn('Position element not found!');
        }
        
        const speedElement = document.getElementById('speed');
        if (speedElement) {
            const speed = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) ? 'Running' : 'Walking';
            speedElement.textContent = speed;
        }
        
        // FPS calculation
        this.frameCount++;
        const currentTime = performance.now();
        if (currentTime >= this.lastTime + 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
        
        const fpsElement = document.getElementById('fps');
        if (fpsElement) {
            fpsElement.textContent = this.fps;
        }
    }
    
    updateLoadingProgress(percent, status) {
        this.loadingProgress = percent;
        if (status) this.loadingStatus = status;
        
        const percentEl = document.getElementById('loading-percent');
        const statusEl = document.getElementById('loading-status');
        const barFillEl = document.getElementById('loading-bar-fill');
        
        if (percentEl) percentEl.textContent = Math.round(percent) + '%';
        if (statusEl) statusEl.textContent = this.loadingStatus;
        if (barFillEl) barFillEl.style.width = percent + '%';
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = Math.min(this.clock.getDelta(), 0.1);
        
        // Animate colorful objects rotation
        this.scene.children.forEach(child => {
            if (child.userData && child.userData.rotationSpeed) {
                child.rotation.x += child.userData.rotationSpeed.x;
                child.rotation.y += child.userData.rotationSpeed.y;
                child.rotation.z += child.userData.rotationSpeed.z;
            }
        });
        
        this.updateMovement(delta);
        this.updateUI();
        
        // Render the scene - make sure we're rendering with the camera
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        } else {
            console.error('Cannot render: missing renderer, scene, or camera');
        }
    }
}

// Start the game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new VirtualWorld();
});

