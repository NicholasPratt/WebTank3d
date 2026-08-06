

        class CyberCommanderGame {
            constructor() {
                const config=window.CYBER_CONFIG;
                this.scene = null; this.camera = null; this.renderer = null; this.raycaster = new THREE.Raycaster(); this.clock = new THREE.Clock();
                this.level = 1; this.turretAngle = 0; this.gunElevation = 0; this.tankRotation = 0;
                this.mouseSensitivity = 0.1; this.mouseYInverted = false;
                
                this.keys = { w: false, a: false, s: false, d: false, r: false };
                this.mouse = { left: false, right: false };
                this.keyPressed = {};
                
                this.playerTank = null; this.turret = null; this.barrel = null; this.barrelPivot = null;
                this.enemies = []; this.projectiles = []; this.terrain = null; this.obstacles = []; this.debris = [];
                this.healthPacks = []; this.powerPacks = [];
                this.healthShards = []; this.powerShards = [];
                this.particles = [];
                this.spawnQueue = [];
                this.safeSpawnPoints = [];
                this.warningMarkers = [];
                this.projectilePool = [];
                this.particlePool = [];
                this.obstacleColliders = [];
                this.score = 0; this.kills = 0; this.combo = 1; this.comboTimer = 0;
                this.screenShake = 0; this.uiTimer = 0; this.engineTrailTimer = 0;
                this.waveRewardPending = false; this.arenaEvent = null; this.boss = null; this.nextSpawnTime=0;
                const launchParams=new URLSearchParams(location.search); this.debugMode = launchParams.has('debug')||launchParams.has('sandbox'); this.sandboxMode=launchParams.has('sandbox'); this.autoStart=launchParams.has('autostart');

                this.MAX_ENEMIES = config.maxEnemies;

                this.playerStats = { 
                    hp: config.player.hp, maxHP: config.player.hp, armor: config.player.armor,
                    power: config.player.power, baseMaxPower: config.player.power, absoluteMaxPower: 300,
                    powerRegenRate: config.player.powerRegen, lowPowerThreshold: config.player.lowPower,
                    storedPowerPacks: 0, maxStoredPacks: 3,
                    healthShards: 0, 
                    powerShards: 0,
                    powerShardsRequired: 20,
                    powerUpgradeTier: 1
                };
                this.weapons = {
                    cannon: { reloadTime: config.weapons.cannon.reloadMs, timeUntilReloaded: 0, powerCost: config.weapons.cannon.powerCost, damageMultiplier:1, blastRadius:config.weapons.cannon.blastRadius },
                    mg: { reloadTime: config.weapons.machineGun.reloadMs, timeUntilReloaded: 0, powerCost: config.weapons.machineGun.powerCost, heat: 0, maxHeat: config.weapons.machineGun.maxHeat, heatPerShot: config.weapons.machineGun.heatPerShot, coolRate: config.weapons.machineGun.coolRate, damageMultiplier:1 }
                };

                this.messageTimeout = null; this.waveBannerTimeout = null;
                this.isGameOver = false; this.isPaused = false; this.isGlitching = false;
                this.isTransitioningWave = false;
                this.audioManager = new AudioManager();
                this.audioListener = null;
                this.splashText = null; this.gameState = 'splash';
                
                this.tankVelocity = new THREE.Vector3(0, 0, 0);
                this.tankAcceleration = config.movement.acceleration; this.tankDeceleration = config.movement.deceleration; this.maxSpeed = config.movement.maxSpeed; this.rotationSpeed = config.movement.rotationSpeed;
                this.mapBoundary = config.mapBoundary;
                this.init().catch(error => { console.error(error); document.body.dataset.runtimeError=error.message; const loading=document.getElementById('loadingScreen'); loading.style.display='block'; loading.textContent=`SYSTEM BOOT ERROR: ${error.message}`; });
            }
            
            async init() {
                await this.initThree();
                this.createScene();
                this.initControls();
                document.getElementById('loadingScreen').style.display = 'none';
                if(this.autoStart){document.getElementById('splashPrompt').style.display='none';this.startGame();}
                this.animate();
            }
            
            async initThree() {
                this.scene = new THREE.Scene();
                this.scene.background = new THREE.Color(0x000005);
                this.scene.fog = new THREE.Fog(0x000005, 150, 300);
                const canvas = document.getElementById('gameCanvas');
                this.camera = new THREE.PerspectiveCamera(70, canvas.offsetWidth / canvas.offsetHeight, 0.1, 1000);
                this.audioListener = new THREE.AudioListener();
                this.camera.add(this.audioListener);
                this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
                this.renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                this.scene.add(new THREE.AmbientLight(0x888888, 1.0));
                const keyLight=new THREE.DirectionalLight(0x66ddff,.55);keyLight.position.set(80,140,40);this.scene.add(keyLight);this.scene.add(new THREE.HemisphereLight(0x003344,0x110022,.5));
            }
            
            createScene() { 
                this.createTerrain(); 
                this.createPlayerTank(); 
                this.createObstacles();
                this.precalculateSpawnPoints();
                this.createSplashText(); 
            }
            
            createSplashText() {
                const loader = new THREE.FontLoader();
                loader.load('vendor/helvetiker_bold.typeface.json',
                    (font) => {
                        const textGeo = new THREE.TextGeometry('CYBER COMMANDER', {
                            font: font, size: 8, height: 1, curveSegments: 12,
                        });
                        textGeo.center();
                        const textMesh = this.createStylizedMesh(textGeo, 0x00ffff);
                        textMesh.scale.set(1.5, 1.5, 1.5);
                        textMesh.position.set(0, 25, -60);
                        this.splashText = textMesh;
                        this.scene.add(this.splashText);
                    },
                    undefined,
                    (error) => {
                        console.error('An error occurred loading the font for the splash screen:', error);
                    }
                );
            }

            createTerrain() { const mapSize = 500; const grid = new THREE.GridHelper(mapSize, 50, 0x00ffff, 0x00ffff); grid.material.transparent = true; grid.material.opacity = 0.5; this.scene.add(grid); const groundGeo = new THREE.PlaneGeometry(mapSize, mapSize); const groundMat = new THREE.MeshBasicMaterial({color: 0x000000}); this.terrain = new THREE.Mesh(groundGeo, groundMat); this.terrain.rotation.x = -Math.PI / 2; this.scene.add(this.terrain); }
            createObstacles() { const numTrees = 64; for(let i=0; i<numTrees; i++) { const pos = this.getValidSpawnPosition(10); if (Math.hypot(pos.x,pos.z) < 30) continue; const tree = this.createStylizedTree(); tree.position.set(pos.x, 0, pos.z); tree.userData = { kind:'tree', destructible:true, hp:25 }; this.obstacles.push(tree); this.scene.add(tree); } const numClusters = 4; const clusterGridSize = 3; const buildingSpacing = 25; for (let i = 0; i < numClusters; i++) { const angle = i * Math.PI/2 + Math.random()*.3; const radius = 90 + Math.random()*90; const clusterCenter = {x:Math.sin(angle)*radius,z:Math.cos(angle)*radius}; for (let x = -1; x <= 1; x++) { for (let z = -1; z <= 1; z++) { if (Math.random() > 0.78) continue; const buildingX = clusterCenter.x + x * buildingSpacing + (Math.random()-.5)*6; const buildingZ = clusterCenter.z + z * buildingSpacing + (Math.random()-.5)*6; const building = this.createBuilding(8 + Math.random() * 8, 10 + Math.random() * 25, 8 + Math.random() * 8); building.position.set(buildingX, 0, buildingZ); building.userData = { kind:'building', destructible:true, hp:120 }; this.obstacles.push(building); this.scene.add(building); } } } this.refreshObstacleColliders(); }

            refreshObstacleColliders() {
                this.obstacleColliders = this.obstacles.filter(o=>o.visible).map(obstacle => ({ obstacle, box: new THREE.Box3().setFromObject(obstacle.children[0] || obstacle) }));
            }

            precalculateSpawnPoints() {
                const range = this.mapBoundary * 0.95;
                const minObstacleDist = 15;
                const numSamples = 2000;

                for (let i = 0; i < numSamples; i++) {
                    const candidatePos = new THREE.Vector3(
                        (Math.random() - 0.5) * range * 2,
                        0,
                        (Math.random() - 0.5) * range * 2
                    );

                    let isTooCloseToObstacle = false;
                    for (const obstacle of this.obstacles) {
                        const obstaclePosXZ = new THREE.Vector3(obstacle.position.x, 0, obstacle.position.z);
                        if (candidatePos.distanceTo(obstaclePosXZ) < minObstacleDist) {
                            isTooCloseToObstacle = true;
                            break;
                        }
                    }

                    if (!isTooCloseToObstacle) {
                        this.safeSpawnPoints.push(candidatePos);
                    }
                }
                console.log(`Pre-calculated ${this.safeSpawnPoints.length} safe spawn points.`);
            }
            
            getValidSpawnPosition(minPlayerDist = 60) {
                if (this.safeSpawnPoints.length === 0) {
                    console.error("No safe spawn points were pre-calculated. Spawning at random.");
                    return { x: (Math.random() - 0.5) * this.mapBoundary * 1.8, z: (Math.random() - 0.5) * this.mapBoundary * 1.8 };
                }

                let attempts = 0;
                while (attempts < 50) {
                    attempts++;
                    const randomIndex = Math.floor(Math.random() * this.safeSpawnPoints.length);
                    const spawnPoint = this.safeSpawnPoints[randomIndex];

                    if (!this.playerTank || this.playerTank.position.distanceTo(spawnPoint) > minPlayerDist) {
                        return { x: spawnPoint.x, z: spawnPoint.z };
                    }
                }
                
                console.warn("Could not find a pre-calculated spawn point far enough from the player. Using a random one.");
                const randomIndex = Math.floor(Math.random() * this.safeSpawnPoints.length);
                const spawnPoint = this.safeSpawnPoints[randomIndex];
                return { x: spawnPoint.x, z: spawnPoint.z };
            }

            createStylizedTree() { const height = 8 + Math.random() * 8; const geo = new THREE.ConeGeometry(3, height, 4); return this.createStylizedMesh(geo, 0xffffff); }
            createBuilding(w, h, d) { const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, h / 2, 0); return this.createStylizedMesh(geo, 0xffffff); }
            
            createPlayerTank() {
                this.playerTank = this.createEnhancedTankMesh(0x00ffff);
                this.playerTank.position.set(0, 1.0, 0);
                this.playerTank.userData = { alive: true };
                this.turret = this.playerTank.children.find(c => c.userData.type === 'turret');
                this.barrel = this.playerTank.children.find(c => c.userData.type === 'barrel');
                this.barrelPivot = this.barrel.children[0];
                this.scene.add(this.playerTank);
            }
            
            queueSpawnsForLevel() {
                this.spawnQueue = [];
                const wave = this.level;
                const spawns = {
                    scouts: 2 + Math.floor(wave / 2),
                    infantry: 3 + wave,
                    artillery: wave >= 2 ? 1 + Math.floor((wave - 2) / 2) : 0,
                    heavy: wave >= 3 ? 1 + Math.floor((wave - 3) / 3) : 0
                };
                const bossWave = wave > 0 && wave % 5 === 0;

                if (spawns.heavy > 0) {
                    spawns.scouts = Math.max(1, spawns.scouts - 1);
                    spawns.infantry = Math.max(2, spawns.infantry - 2);
                }

                const totalSpawns = Math.min(this.MAX_ENEMIES, spawns.scouts + spawns.infantry + spawns.artillery + spawns.heavy);
                let currentSpawns = 0;

                if (bossWave) { this.spawnQueue.push({type:'boss'}); currentSpawns++; }

                for (let i = 0; i < spawns.heavy && currentSpawns < totalSpawns; i++, currentSpawns++) {
                    this.spawnQueue.push({type: 'heavy'});
                }
                for (let i = 0; i < spawns.scouts && currentSpawns < totalSpawns; i++, currentSpawns++) {
                    this.spawnQueue.push({type: 'scout'});
                }
                for (let i = 0; i < spawns.artillery && currentSpawns < totalSpawns; i++, currentSpawns++) {
                    this.spawnQueue.push({type: 'artillery'});
                }

                const infantryCount = Math.min(spawns.infantry, totalSpawns - currentSpawns);
                const squadSizeMin = 3;
                const squadSizeMax = 6;
                let infantrySpawned = 0;
                while (infantrySpawned < infantryCount) {
                    const squadSize = Math.floor(Math.random() * (squadSizeMax - squadSizeMin + 1)) + squadSizeMin;
                    this.spawnQueue.push({type: 'infantry_squad', size: Math.min(squadSize, infantryCount - infantrySpawned) });
                    infantrySpawned += squadSize;
                }
                
                for(let i=0; i<2; i++){ this.spawnQueue.push({type:'pickup_health'}); }
                for(let i=0; i<(1+Math.floor(this.level/3)); i++){ this.spawnQueue.push({type:'pickup_power'}); }
            }

            createStylizedMesh(geometry, edgeColor) { const group = new THREE.Group(); const baseMaterial = new THREE.MeshPhongMaterial({ color: 0x05070a,shininess:70,specular:new THREE.Color(edgeColor).multiplyScalar(.35) }); const baseMesh = new THREE.Mesh(geometry, baseMaterial); group.add(baseMesh); const edges = new THREE.EdgesGeometry(geometry); const lineMaterial = new THREE.LineBasicMaterial({ color: edgeColor }); const wireframe = new THREE.LineSegments(edges, lineMaterial); group.add(wireframe); return group; }
            createEnhancedTankMesh(color) { const group = new THREE.Group(); const bodyShape = new THREE.Shape(); bodyShape.moveTo(-1.5, -2); bodyShape.lineTo(1.5, -2); bodyShape.lineTo(0.8, 2); bodyShape.lineTo(-0.8, 2); bodyShape.lineTo(-1.5, -2); const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 1, bevelEnabled: false }); bodyGeo.rotateX(-Math.PI/2); bodyGeo.translate(0, 0.5, 0); const body = this.createStylizedMesh(bodyGeo, color); body.userData.type = 'body'; group.add(body); const turretGeo = new THREE.CylinderGeometry(1, 1, 0.8, 8); turretGeo.translate(0, 1.4, 0); const turret = this.createStylizedMesh(turretGeo, color); turret.userData.type = 'turret'; group.add(turret); const barrelGroup = new THREE.Group(); barrelGroup.position.set(0, 1.7, 0); barrelGroup.userData = { type: 'barrel' }; const barrelPivot = new THREE.Group(); barrelPivot.position.set(0, 0, 1.2); const barrelGeo = new THREE.CylinderGeometry(0.2, 0.2, 3, 8); barrelGeo.rotateX(Math.PI / 2); barrelGeo.translate(0, 0, 1.5); const barrel = this.createStylizedMesh(barrelGeo, color); barrelPivot.add(barrel); barrelGroup.add(barrelPivot); group.add(barrelGroup); const light = new THREE.PointLight(color, 3, 40); light.position.y = 2; group.add(light); return group; }
            createHeavyTankMesh(color) { const group = new THREE.Group(); const bodyGeo = new THREE.BoxGeometry(4, 2, 6); bodyGeo.translate(0,1,0); const body = this.createStylizedMesh(bodyGeo, color); body.userData.type = 'body'; group.add(body); const turretGeo = new THREE.CylinderGeometry(1.5, 1.8, 1, 8); turretGeo.translate(0, 2.5, 0); const turret = this.createStylizedMesh(turretGeo, color); turret.userData.type = 'turret'; group.add(turret); const barrelGroup = new THREE.Group(); barrelGroup.position.set(0, 2.8, 0); barrelGroup.userData = { type: 'barrel' }; const barrelPivot = new THREE.Group(); barrelPivot.position.set(0, 0, 1.8); const barrelGeo = new THREE.CylinderGeometry(0.4, 0.35, 4, 8); barrelGeo.rotateX(Math.PI / 2); barrelGeo.translate(0, 0, 2); const barrel = this.createStylizedMesh(barrelGeo, color); barrelPivot.add(barrel); barrelGroup.add(barrelPivot); group.add(barrelGroup); const light = new THREE.PointLight(color, 5, 50); light.position.y = 3; group.add(light); return group; }
            createInfantryMesh(color) { const group = new THREE.Group(); const bodyHeight = 2.5; const bodyGeo = new THREE.ConeGeometry(0.7, bodyHeight, 4); bodyGeo.translate(0, bodyHeight / 2, 0); const body = this.createStylizedMesh(bodyGeo, color); group.add(body); const gunGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6); gunGeo.rotateX(Math.PI / 2); gunGeo.translate(0, 1, 0.75); const gun = this.createStylizedMesh(gunGeo, 0xaaaaaa); group.add(gun); return group; }
            createArtilleryMesh(color) {
                const group = new THREE.Group();
                const baseGeo = new THREE.BoxGeometry(6, 1, 8);
                const base = this.createStylizedMesh(baseGeo, color);
                base.userData.type = 'body';
                group.add(base);

                const barrelGeo = new THREE.CylinderGeometry(0.4, 0.3, 8, 8);
                barrelGeo.translate(0, 4, 0);
                const barrel = this.createStylizedMesh(barrelGeo, 0xcccccc);
                barrel.rotation.x = -Math.PI / 3;
                barrel.position.y = 0.5;
                barrel.userData.type = 'barrel_artillery';
                group.add(barrel);
                const light = new THREE.PointLight(color, 4, 50);
                light.position.y = 3;
                group.add(light);
                return group;
            }

            updateCameraPosition() { if (!this.playerTank || !this.barrelPivot) return; const pivotPos = new THREE.Vector3(); this.barrelPivot.getWorldPosition(pivotPos); const pointInFront = new THREE.Vector3(0, 0, 1); this.barrelPivot.localToWorld(pointInFront); const gunDir = new THREE.Vector3().subVectors(pointInFront, pivotPos).normalize(); const behindOffset = 7; const aboveOffset = 2.5; const camPos = new THREE.Vector3().copy(pivotPos).sub(gunDir.clone().multiplyScalar(behindOffset)); camPos.y += aboveOffset; const lookAtPos = new THREE.Vector3().copy(pivotPos).add(gunDir.clone().multiplyScalar(50)); this.camera.position.copy(camPos); this.camera.lookAt(lookAtPos); }
            
            initControls() {
                const canvas = document.getElementById('gameCanvas'); const splashPrompt = document.getElementById('splashPrompt');
                const startHandler = () => { if (this.gameState !== 'splash') return; splashPrompt.style.opacity = '0'; splashPrompt.addEventListener('transitionend', () => splashPrompt.style.display = 'none', { once: true }); this.audioManager.init(this.audioListener.context); this.audioManager.setVolume(document.getElementById('volume').value); if(!this.isGameOver) canvas.requestPointerLock(); let fallSpeed = 0; const animateTitleOut = () => { if (this.splashText && this.splashText.position.y > -50) { fallSpeed += 0.5; this.splashText.position.y -= fallSpeed; this.splashText.rotation.x += 0.05; requestAnimationFrame(animateTitleOut); } else if(this.splashText) { this.scene.remove(this.splashText); this.splashText = null; } }; animateTitleOut(); this.startGame(); };
                splashPrompt.addEventListener('click', startHandler, { once: true }); canvas.addEventListener('click', startHandler, { once: true });
                document.addEventListener('pointerlockchange', () => { const lost = document.pointerLockElement !== canvas; this.isPaused = lost && this.gameState === 'playing' && !this.isGameOver && !this.waveRewardPending; document.getElementById('pauseOverlay').classList.toggle('visible', this.isPaused); this.mouse.left = this.mouse.right = false; }, false);
                document.addEventListener('mousemove', (e) => this.onMouseMove(e)); window.addEventListener('keydown', (e) => this.onKeyDown(e)); window.addEventListener('keyup', (e) => this.onKeyUp(e)); canvas.addEventListener('mousedown', (e) => this.onMouseDown(e)); canvas.addEventListener('mouseup', (e) => this.onMouseUp(e)); canvas.addEventListener('contextmenu', (e) => e.preventDefault()); window.addEventListener('resize', () => this.handleResize());
                document.getElementById('restartButton').addEventListener('click', () => this.restartGame());
                document.getElementById('resumeButton').addEventListener('click', () => canvas.requestPointerLock());
                const sensitivity = document.getElementById('sensitivity'), volume = document.getElementById('volume'), quality = document.getElementById('quality'), invert = document.getElementById('invertAim');
                try { const saved = JSON.parse(localStorage.getItem('cyberCommanderSettings') || '{}'); if(saved.sensitivity) sensitivity.value=saved.sensitivity; if(saved.volume !== undefined) volume.value=saved.volume; if(saved.quality) quality.value=saved.quality; invert.checked=!!saved.invert; } catch(e) {}
                const applySettings = () => { this.mouseSensitivity=Number(sensitivity.value); this.mouseYInverted=invert.checked; this.audioManager.setVolume(volume.value); const ratios={high:2,medium:1.25,low:1}; this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,ratios[quality.value])); document.getElementById('sensitivityValue').value=this.mouseSensitivity.toFixed(2); document.getElementById('volumeValue').value=Math.round(volume.value*100)+'%'; localStorage.setItem('cyberCommanderSettings', JSON.stringify({sensitivity:sensitivity.value,volume:volume.value,quality:quality.value,invert:invert.checked})); this.handleResize(); };
                [sensitivity,volume,quality,invert].forEach(el=>el.addEventListener('input',applySettings)); applySettings();
            }
            
            onMouseMove(event) { if (this.isPaused || this.isGameOver || document.pointerLockElement !== this.renderer.domElement) return; this.turretAngle = (this.turretAngle - event.movementX * this.mouseSensitivity + 360) % 360; const verticalMove = event.movementY * this.mouseSensitivity * (this.mouseYInverted ? 1 : -1); this.gunElevation += verticalMove; this.gunElevation = Math.max(-10, Math.min(20, this.gunElevation)); }
            onMouseDown(event) { if (this.isPaused || this.isGameOver || document.pointerLockElement !== this.renderer.domElement) return; if (event.button === 0) this.mouse.left = true; if (event.button === 2) this.mouse.right = true; }
            onMouseUp(event) { if (event.button === 0) this.mouse.left = false; if (event.button === 2) this.mouse.right = false; }
            
            onKeyDown(event) {
                const key = event.key.toLowerCase();
                if (this.keys.hasOwnProperty(key)) {
                    this.keys[key] = true;
                }
                if (!this.keyPressed[key] && this.gameState === 'playing') {
                    this.keyPressed[key] = true;
                    if (key === 'r') {
                        this.usePowerPack();
                    }
                    if (key === 'n' && this.debugMode) { 
                        this.enemies.forEach(e => {
                            if (e.userData.alive) {
                                e.userData.alive = false;
                            }
                        });
                        this.checkLevelCompletion();
                    }
                }
            }

            onKeyUp(event) { const key = event.key.toLowerCase(); if (this.keys.hasOwnProperty(key)) { this.keys[key] = false; } this.keyPressed[key] = false; }
            
            updatePlayerControls(deltaTime) {
                if (!this.playerTank) return;
                
                const isMoving = this.keys.w || this.keys.s;

                if (!isMoving && this.playerStats.power < this.playerStats.baseMaxPower) {
                    this.playerStats.power = Math.min(this.playerStats.baseMaxPower, this.playerStats.power + this.playerStats.powerRegenRate * (this.arenaEvent==='power_surge'?2:1) * deltaTime);
                }
                const isLowPower = this.playerStats.power < this.playerStats.lowPowerThreshold;
                const isBoosted = this.playerStats.power > this.playerStats.baseMaxPower;

                let currentAcceleration = this.tankAcceleration;
                let currentMaxSpeed = this.maxSpeed;
                let powerDrain = 2.5;

                if (isBoosted) {
                    currentAcceleration *= 1.5;
                    currentMaxSpeed *= 1.5;
                    powerDrain *= 2.0;
                    if(isMoving) this.showMessage("SPEED BOOST ACTIVE", "success");
                } else if (isLowPower) {
                    currentAcceleration *= 0.4;
                    currentMaxSpeed *= 0.4;
                }

                const rotationDelta = this.rotationSpeed * deltaTime;
                if (this.keys.d) { this.tankRotation = (this.tankRotation - rotationDelta + 360) % 360; this.turretAngle = (this.turretAngle - rotationDelta + 360) % 360; }
                if (this.keys.a) { this.tankRotation = (this.tankRotation + rotationDelta) % 360; this.turretAngle = (this.turretAngle + rotationDelta) % 360; }
                this.playerTank.rotation.y = this.tankRotation * Math.PI / 180;
                
                const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.tankRotation * Math.PI / 180);

                if (this.keys.w) { this.tankVelocity.add(forward.multiplyScalar(currentAcceleration * deltaTime)); }
                if (this.keys.s) { this.tankVelocity.add(forward.multiplyScalar(-currentAcceleration * deltaTime)); }
                
                if (isMoving) { this.playerStats.power -= powerDrain * deltaTime; }

                this.tankVelocity.multiplyScalar(1 - this.tankDeceleration * deltaTime);
                if (this.tankVelocity.length() > currentMaxSpeed) { this.tankVelocity.normalize().multiplyScalar(currentMaxSpeed); }
                this.playerTank.position.addScaledVector(this.tankVelocity, deltaTime);

                // --- NEW COLLISION HANDLING ---
                const playerCollider = new THREE.Sphere(this.playerTank.position, 2.5);

                for (const entry of this.obstacleColliders) {
                    const obstacleBox = entry.box;
                    
                    if (obstacleBox.intersectsSphere(playerCollider)) {
                        // Find the closest point on the bounding box to the sphere's center
                        const closestPoint = new THREE.Vector3();
                        obstacleBox.clampPoint(playerCollider.center, closestPoint);

                        // Calculate the vector from the closest point to the sphere's center
                        const penetrationVector = new THREE.Vector3().subVectors(playerCollider.center, closestPoint);
                        if (penetrationVector.lengthSq() < .0001) penetrationVector.set(1,0,0);
                        const penetrationDepth = playerCollider.radius - penetrationVector.length();
                        
                        // Push the sphere out of the box
                        this.playerTank.position.addScaledVector(penetrationVector.normalize(), penetrationDepth);
                        
                        // Project the velocity onto the collision normal and subtract it to create a slide
                        const collisionNormal = penetrationVector.normalize();
                        const dot = this.tankVelocity.dot(collisionNormal);
                        if (dot < 0) { // Only act if moving towards the obstacle
                            const counterForce = collisionNormal.multiplyScalar(dot);
                            this.tankVelocity.sub(counterForce);
                        }
                    }
                }
                
                const boundary = this.mapBoundary;
                if (this.playerTank.position.x > boundary) { this.playerTank.position.x = boundary; this.tankVelocity.x = 0; }
                else if (this.playerTank.position.x < -boundary) { this.playerTank.position.x = -boundary; this.tankVelocity.x = 0; }
                if (this.playerTank.position.z > boundary) { this.playerTank.position.z = boundary; this.tankVelocity.z = 0; }
                else if (this.playerTank.position.z < -boundary) { this.playerTank.position.z = -boundary; this.tankVelocity.z = 0; }

                this.checkPickups();
                this.playerStats.power = Math.max(0, this.playerStats.power);
                this.engineTrailTimer -= deltaTime;
                if (isMoving && this.tankVelocity.length() > 2 && this.engineTrailTimer <= 0) { this.engineTrailTimer=.08; const trailPos=this.playerTank.position.clone().add(new THREE.Vector3(0,.4,0)); this.createExplosion(trailPos,0x008899,1,.35); }

                if (this.turret) this.turret.rotation.y = (this.turretAngle - this.tankRotation) * Math.PI / 180;
                if (this.barrel) this.barrel.rotation.y = (this.turretAngle - this.tankRotation) * Math.PI / 180;
                if (this.barrelPivot) this.barrelPivot.rotation.x = -(this.gunElevation * Math.PI) / 180;

                if (this.weapons.cannon.timeUntilReloaded > 0) this.weapons.cannon.timeUntilReloaded -= deltaTime * 1000;
                if (this.weapons.mg.timeUntilReloaded > 0) this.weapons.mg.timeUntilReloaded -= deltaTime * 1000;
                this.weapons.mg.heat = Math.max(0, this.weapons.mg.heat - this.weapons.mg.coolRate * deltaTime);

                if (this.mouse.left && this.weapons.cannon.timeUntilReloaded <= 0) this.fireCannon();
                if (this.mouse.right && this.weapons.mg.timeUntilReloaded <= 0 && this.weapons.mg.heat < this.weapons.mg.maxHeat) this.fireMachineGun();
            }
            
            handleResize() { const canvas = document.getElementById('gameCanvas'); this.camera.aspect = canvas.offsetWidth / canvas.offsetHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(canvas.offsetWidth, canvas.offsetHeight); }
            
            fireCannon() {
                const cannonCost=this.weapons.cannon.powerCost*(this.arenaEvent==='power_surge' ? 0.5 : 1); if (this.playerStats.power < cannonCost) { this.showMessage("LOW POWER", "danger"); return; }
                this.playerStats.power -= cannonCost;
                const isLowPower = this.playerStats.power < this.playerStats.lowPowerThreshold;
                this.weapons.cannon.timeUntilReloaded = isLowPower ? this.weapons.cannon.reloadTime * 2.0 : this.weapons.cannon.reloadTime;
                this.audioManager.playerShootCannon();
                const startPos = new THREE.Vector3(); this.barrelPivot.children[0].children[0].getWorldPosition(startPos);
                this.createExplosion(startPos,0x00ffff,5,.16); this.screenShake=.16;
                const totalAngleRad = this.turretAngle * Math.PI / 180; const elevationRad = this.gunElevation * Math.PI / 180;
                const baseSpeed = 80; const hSpeed = Math.cos(elevationRad) * baseSpeed; const vSpeed = Math.sin(elevationRad) * baseSpeed;
                const velocity = new THREE.Vector3(Math.sin(totalAngleRad) * hSpeed, vSpeed, Math.cos(totalAngleRad) * hSpeed);
                this.createProjectile(startPos, velocity, { isPlayer: true, type: 'cannon' });
            }

            fireMachineGun() {
                const mgCost=this.weapons.mg.powerCost*(this.arenaEvent==='power_surge' ? 0.5 : 1); if (this.playerStats.power < mgCost) return;
                this.playerStats.power -= mgCost;
                this.weapons.mg.timeUntilReloaded = this.weapons.mg.reloadTime;
                this.weapons.mg.heat += this.weapons.mg.heatPerShot;
                this.audioManager.playerShootMG();
                
                const startPos = new THREE.Vector3(); this.barrelPivot.children[0].children[0].getWorldPosition(startPos);
                this.createExplosion(startPos,0xffff00,1,.08);
                const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
                const spread = 0.02;
                dir.x += (Math.random() - 0.5) * spread;
                dir.y += (Math.random() - 0.5) * spread;
                dir.z += (Math.random() - 0.5) * spread;
                const velocity = dir.multiplyScalar(150);
                this.createProjectile(startPos, velocity, { isPlayer: true, type: 'mg' });
            }

            createProjectile(startPos, velocity, data) {
                let color, size, gravity;
                switch (data.type) {
                    case 'cannon':
                        color = data.isPlayer ? 0x00ffff : 0xff4400;
                        size = 0.5;
                        gravity = 10.0;
                        break;
                    case 'artillery_shell':
                        color = 0xff4400;
                        size = 0.8;
                        gravity = 20.0;
                        break;
                    case 'mg':
                    case 'infantry_mg':
                        color = data.type === 'mg' ? 0xffff00 : 0xff8800;
                        size = data.type === 'mg' ? 0.15 : 0.1;
                        gravity = 0.0;
                        break;
                    default:
                        color = 0xffffff;
                        size = 0.2;
                        gravity = 0.0;
                }
                const poolKey = `${data.type}:${data.isPlayer ? 'player':'enemy'}`;
                let poolIndex = this.projectilePool.findIndex(item => item.userData.poolKey === poolKey);
                const p = poolIndex >= 0 ? this.projectilePool.splice(poolIndex,1)[0] : new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), new THREE.MeshBasicMaterial({ color: color }));
                p.visible = true; p.material.opacity = 1;
                p.position.copy(startPos);
                
                if ((data.type === 'cannon' || data.type === 'artillery_shell') && !p.children.some(c=>c.isPointLight)) {
                    const light = new THREE.PointLight(color, 1, 10); p.add(light);
                }
                
                p.userData = { velocity, active: true, life: 0, gravity: gravity, maxLife: 10, poolKey, ...data };
                
                if (data.type === 'artillery_shell') {
                    const whistleNode = this.audioManager.artilleryWhistle(data.timeToTarget);
                    if (whistleNode) {
                        const positionalAudio = new THREE.PositionalAudio(this.audioListener);
                        positionalAudio.setNodeSource(whistleNode);
                        positionalAudio.setRefDistance(10);
                        positionalAudio.setRolloffFactor(2);
                        p.add(positionalAudio);
                        positionalAudio.play();
                    }
                }

                this.projectiles.push(p); this.scene.add(p);
            }

            releaseProjectile(projectile) {
                projectile.visible=false; projectile.userData.active=false; this.scene.remove(projectile);
                projectile.children.filter(c=>c.isPositionalAudio).forEach(c=>{ try { if(c.isPlaying)c.stop(); c.disconnect(); } catch(e){} projectile.remove(c); });
                if (this.projectilePool.length < 120) this.projectilePool.push(projectile); else this.disposeMesh(projectile);
            }

            segmentHitsSphere(a,b,center,radius) {
                const ab=new THREE.Vector3().subVectors(b,a), ac=new THREE.Vector3().subVectors(center,a);
                const lengthSq=ab.lengthSq(); const t=lengthSq ? THREE.MathUtils.clamp(ac.dot(ab)/lengthSq,0,1) : 0;
                return a.clone().addScaledVector(ab,t).distanceToSquared(center) <= radius*radius;
            }

            findWorldImpact(from,to) {
                const direction=new THREE.Vector3().subVectors(to,from); const distance=direction.length(); if(!distance)return null; direction.normalize();
                const ray=new THREE.Ray(from,direction); let nearest=null;
                for(const entry of this.obstacleColliders) { const point=ray.intersectBox(entry.box,new THREE.Vector3()); if(point){ const d=point.distanceTo(from); if(d<=distance && (!nearest || d<nearest.distance)) nearest={...entry,point,distance:d}; } }
                return nearest;
            }

            damageObstacle(obstacle, damage, point) {
                if(!obstacle.userData.destructible)return;
                obstacle.userData.hp -= damage; this.createExplosion(point, obstacle.userData.kind==='tree'?0x00aa88:0xdddddd, 8, .55);
                if(obstacle.userData.hp<=0){ obstacle.visible=false; this.createDestructionExplosion(obstacle.position,0x00ffff); this.obstacles=this.obstacles.filter(o=>o!==obstacle); this.refreshObstacleColliders(); this.score+=50; }
            }

            updateProjectiles(deltaTime) {
                for (let i = this.projectiles.length - 1; i >= 0; i--) {
                    const p = this.projectiles[i];
                    if (!p.userData.active) {
                        this.releaseProjectile(p);
                        this.projectiles.splice(i, 1);
                        continue;
                    }
                    
                    const previousPosition=p.position.clone();
                    if (p.userData.gravity > 0) p.userData.velocity.y -= p.userData.gravity * deltaTime;
                    p.position.addScaledVector(p.userData.velocity, deltaTime);
                    p.userData.life += deltaTime;

                    if (p.userData.type === 'artillery_shell' && Math.random() < 0.5) {
                        this.createExplosion(p.position, 0xffaa00, 1, 0.2);
                    }
                    if(p.userData.type==='cannon'&&Math.random()<.35)this.createExplosion(p.position,p.material.color.getHex(),1,.18);

                    const worldImpact=this.findWorldImpact(previousPosition,p.position);
                    if(worldImpact){ p.position.copy(worldImpact.point); this.damageObstacle(worldImpact.obstacle,p.userData.type==='cannon'?70:8,worldImpact.point); this.createScorch(worldImpact.point,p.material.color.getHex()); if(p.userData.type==='cannon'||p.userData.type==='artillery_shell')this.explodeProjectile(p); else this.createExplosion(p.position,p.material.color.getHex(),2,.15); p.userData.active=false; continue; }

                    if (p.position.y < 0.2 || p.userData.life > p.userData.maxLife) {
                        if(p.position.y<.2)this.createScorch(p.position,p.material.color.getHex());
                        if (p.userData.type === 'cannon' || p.userData.type === 'artillery_shell') this.explodeProjectile(p);
                        p.userData.active = false;
                        continue;
                    }

                    const targets = p.userData.isPlayer ? this.enemies : [this.playerTank];
                    for (const target of targets) {
                        if (target.userData && target.userData.alive && this.segmentHitsSphere(previousPosition,p.position,target.position,target.userData.type === 'infantry' ? 1.5 : 4)) {
                           if (p.userData.isPlayer) this.handlePlayerProjectileHit(p, target);
                           else this.handleEnemyProjectileHit(p, target);
                           p.userData.active = false;
                           break; 
                        }
                    }
                }
            }

            handlePlayerProjectileHit(projectile, target) {
                 const pData = projectile.userData;
                 const tData = target.userData;

                 if (pData.type === 'cannon') {
                     this.explodeProjectile(projectile);
                 } else if (pData.type === 'mg') {
                     if (tData.type === 'infantry') {
                         tData.hp -= 5*this.weapons.mg.damageMultiplier; 
                         this.confirmHit(target);
                         this.audioManager.infantryHit();
                         if (tData.hp <= 0) {
                             tData.alive = false; target.visible = false;
                             this.createExplosion(target.position, 0xffaa00, 5, 0.2);
                             this.awardKill(target,100);
                             this.checkLevelCompletion();
                         }
                     } else if (tData.type === 'artillery') {
                        tData.hp -= this.weapons.mg.damageMultiplier;
                        this.confirmHit(target);
                        if(tData.hp<=0){tData.alive=false;target.visible=false;this.createDebrisExplosion(target);this.awardKill(target,300);this.checkLevelCompletion();}
                     } else if (tData.type === 'scout') {
                        tData.stunTimer = 2.0; // Stun scout
                        tData.hp -= 2*this.weapons.mg.damageMultiplier; this.confirmHit(target);
                        if(tData.hp<=0){tData.alive=false;target.visible=false;this.createDebrisExplosion(target);this.awardKill(target,200);this.checkLevelCompletion();}
                     }
                 }
            }

            confirmHit(target){ const marker=document.getElementById('hitMarker'); marker.classList.remove('show'); void marker.offsetWidth; marker.classList.add('show'); target.traverse(node=>{if(node.isLineSegments&&node.material){const original=node.material.color.getHex();node.material.color.setHex(0xffffff);setTimeout(()=>{if(node.material)node.material.color.setHex(original);},80);}}); }
            awardKill(target,base=150){ this.kills++; this.combo=this.comboTimer>0?Math.min(8,this.combo+1):1; this.comboTimer=3; this.score+=base*this.combo; if(target.userData.type==='boss'){this.score+=5000;this.boss=null;this.showMessage('ELITE SIGNAL DESTROYED','success');} }

            handleEnemyProjectileHit(projectile, player) {
                const pData = projectile.userData;
                if (pData.type === 'cannon' || pData.type === 'artillery_shell') {
                    this.explodeProjectile(projectile);
                } else if (pData.type === 'infantry_mg') {
                    this.audioManager.playerHit();
                    const actualDmg = 1.5 + (this.level - 1) * 0.5; 
                    this.playerStats.hp = Math.max(0, this.playerStats.hp - actualDmg);
                    this.showDamageIndicator(projectile.position);
                    if (this.playerStats.hp <= 0) this.gameOver();
                    this.updateUI();
                }
            }

            explodeProjectile(projectile) {
                const isArtillery = projectile.userData.type === 'artillery_shell';
                const explosionRadius = isArtillery ? 15 : (projectile.userData.isPlayer?this.weapons.cannon.blastRadius:10);
                this.createExplosion(projectile.position, projectile.material.color.getHex(), isArtillery ? 30 : 15, isArtillery ? 1.5 : 1.0);
                this.audioManager.explosion();

                if (projectile.userData.isPlayer) {
                    this.enemies.forEach(enemy => {
                        if (enemy.userData.alive && projectile.position.distanceTo(enemy.position) < explosionRadius) {
                            if (enemy.userData.type === 'infantry') {
                                enemy.userData.stunTimer = 10.0;
                                return;
                            }

                            const dist = projectile.position.distanceTo(enemy.position);
                            const damage = Math.max(25, 65 - (dist * 4))*this.weapons.cannon.damageMultiplier;
                            enemy.userData.hp -= damage;
                            this.confirmHit(enemy);

                            if ((enemy.userData.type === 'scout' || enemy.userData.type === 'artillery') && !enemy.userData.evadeTarget) {
                                enemy.userData.evadeTimer = 2.0 + Math.random();
                                const evadeDir = new THREE.Vector3().subVectors(enemy.position, projectile.position).normalize();
                                evadeDir.y = 0;
                                const evadeDist = 15 + Math.random() * 10;
                                const targetPos = new THREE.Vector3().copy(enemy.position).addScaledVector(evadeDir, evadeDist);
                                
                                targetPos.x = Math.max(-this.mapBoundary, Math.min(this.mapBoundary, targetPos.x));
                                targetPos.z = Math.max(-this.mapBoundary, Math.min(this.mapBoundary, targetPos.z));

                                enemy.userData.evadeTarget = targetPos;
                            }

                            if (enemy.userData.hp <= 0) {
                                enemy.userData.alive = false; enemy.visible = false;
                                if (enemy.userData.type === 'heavy' || enemy.userData.type === 'boss') {
                                    this.createDebrisExplosion(enemy);
                                    this.spawnInfantrySquad(enemy.position, 3);
                                } else if (enemy.userData.type === 'scout' || enemy.userData.type === 'artillery') {
                                    this.createDebrisExplosion(enemy);
                                    this.spawnPowerPack(enemy.position);
                                }
                                this.awardKill(enemy,enemy.userData.type==='boss'?1000:enemy.userData.type==='heavy'?500:250);
                                this.showMessage(`ENEMY DESTROYED`, 'success');
                                this.checkLevelCompletion();
                            } else { this.audioManager.playerHit(); }
                        }
                    });
                } else if (this.playerTank.position.distanceTo(projectile.position) < explosionRadius) {
                    this.audioManager.playerHit();
                    const dist = this.playerTank.position.distanceTo(projectile.position);
                    let baseDmg = 0;
                    if (isArtillery) {
                        baseDmg = Math.max(20, 70 - dist * 3) + projectile.userData.damageBonus;
                    } else {
                        baseDmg = (Math.max(15, 40 - dist * 3)) + projectile.userData.damageBonus;
                         if (projectile.userData.spawnerType === 'scout') {
                            baseDmg *= 0.6; // 40% damage reduction for scouts
                        }
                    }
                    const actualDmg = Math.max(1, baseDmg - this.playerStats.armor / 4);
                    this.playerStats.hp = Math.max(0, this.playerStats.hp - actualDmg);
                    this.showDamageIndicator(projectile.position);
                    if (this.playerStats.hp <= 0) this.gameOver();
                }
                this.updateUI();
            }

            createExplosion(position, color = 0xffffff, particleCount = 20, lifeMax = 1.0) {
                 if(particleCount>10)this.screenShake=Math.max(this.screenShake,Math.min(.8,particleCount/50));
                 for (let i = 0; i < particleCount; i++) {
                    const recycled=this.particlePool.pop(); const particleMesh=recycled||new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5),new THREE.MeshBasicMaterial({transparent:true})); particleMesh.material.color.setHex(Math.random() > 0.5 ? color : 0xffffff); particleMesh.material.opacity=1; particleMesh.visible=true;
                    const particle = {
                        mesh: particleMesh,
                        velocity: new THREE.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20),
                        life: lifeMax,
                        maxLife: lifeMax,
                    };
                    particle.mesh.position.copy(position);
                    this.particles.push(particle);
                    this.scene.add(particle.mesh);
                }
            }
            createDestructionExplosion(position, color) { this.audioManager.destruction(); this.createExplosion(position, color, 30, 1.2); const flash = new THREE.PointLight(color, 5, 80, 2); flash.position.copy(position); this.scene.add(flash); let lightIntensity = 5; const fadeLight = () => { lightIntensity -= 0.2; flash.intensity = lightIntensity; if(lightIntensity > 0) requestAnimationFrame(fadeLight); else this.scene.remove(flash); }; fadeLight(); }
            createDebrisExplosion(tank) {
                const light = tank.children.find(c => c.isPointLight);
                const color = light ? light.color.getHex() : 0xffffff;
                this.createDestructionExplosion(tank.position, color);
                
                const debrisParts = tank.children.filter(child =>
                    child.userData.type === 'turret' ||
                    child.userData.type === 'body' ||
                    child.userData.type === 'barrel_artillery'
                );
                
                debrisParts.forEach(child => {
                    const component = child.clone();
                    component.traverse(node=>{if(node.geometry)node.geometry=node.geometry.clone();if(node.material)node.material=Array.isArray(node.material)?node.material.map(m=>m.clone()):node.material.clone();});
                    const pos = new THREE.Vector3();
                    child.getWorldPosition(pos);
                    component.position.copy(pos);
                    component.quaternion.copy(tank.quaternion);
                    const debrisData = {
                        mesh: component,
                        velocity: new THREE.Vector3((Math.random() - 0.5) * 15, Math.random() * 20 + 5, (Math.random() - 0.5) * 15),
                        angularVelocity: new THREE.Vector3(Math.random() * 5, Math.random() * 5, Math.random() * 5),
                        life: 3.0
                    };
                    this.debris.push(debrisData);
                    this.scene.add(component);
                });
            }
            updateDebris(deltaTime) { 
                for (let i = this.debris.length - 1; i >= 0; i--) {
                    const d = this.debris[i];
                    d.life -= deltaTime;
                    if (d.life <= 0) {
                        this.disposeMesh(d.mesh);
                        this.debris.splice(i, 1);
                        continue;
                    }
                    d.velocity.y -= 20 * deltaTime;
                    d.mesh.position.addScaledVector(d.velocity, deltaTime);
                    d.mesh.rotation.x += d.angularVelocity.x * deltaTime;
                    d.mesh.rotation.y += d.angularVelocity.y * deltaTime;
                    d.mesh.rotation.z += d.angularVelocity.z * deltaTime;
                }
            }
            updateParticles(deltaTime) {
                for (let i = this.particles.length - 1; i >= 0; i--) {
                    const p = this.particles[i];
                    p.life -= deltaTime;
                    if (p.life <= 0) {
                        this.scene.remove(p.mesh); p.mesh.visible=false; if(this.particlePool.length<300)this.particlePool.push(p.mesh); else this.disposeMesh(p.mesh);
                        this.particles.splice(i, 1);
                        continue;
                    }
                    p.mesh.position.addScaledVector(p.velocity, deltaTime);
                    p.mesh.material.opacity = p.life / p.maxLife;
                }
            }
            
            updateEnemies(deltaTime) {
                const alive=this.enemies.filter(e=>e.userData.alive);
                alive.forEach(enemy => { if(enemy.userData.spawnDelay>0){ enemy.userData.spawnDelay-=deltaTime; if(enemy.userData.spawnDelay<=0)enemy.visible=true; return; } const distanceToPlayer = enemy.position.distanceTo(this.playerTank.position); if (enemy.userData.type === 'scout') this.updateScoutAI(enemy,distanceToPlayer,deltaTime); else if (enemy.userData.type === 'heavy'||enemy.userData.type==='boss') this.updateHeavyAI(enemy,distanceToPlayer,deltaTime); else if (enemy.userData.type === 'infantry') this.updateInfantryAI(enemy,distanceToPlayer,deltaTime); else if (enemy.userData.type === 'artillery') this.updateArtilleryAI(enemy,distanceToPlayer,deltaTime); enemy.position.x=THREE.MathUtils.clamp(enemy.position.x,-this.mapBoundary,this.mapBoundary); enemy.position.z=THREE.MathUtils.clamp(enemy.position.z,-this.mapBoundary,this.mapBoundary); });
                for(let i=0;i<alive.length;i++) for(let j=i+1;j<alive.length;j++){ const a=alive[i],b=alive[j],delta=new THREE.Vector3().subVectors(a.position,b.position); delta.y=0; const min=a.userData.type==='infantry'&&b.userData.type==='infantry'?1.4:3.2; if(delta.lengthSq()>0&&delta.lengthSq()<min*min){ const push=(min-delta.length())*.5; delta.normalize(); a.position.addScaledVector(delta,push); b.position.addScaledVector(delta,-push); } }
                alive.forEach(enemy=>{ const radius=enemy.userData.type==='infantry'?0.8:2.2; const sphere=new THREE.Sphere(enemy.position,radius); for(const entry of this.obstacleColliders){ if(entry.box.intersectsSphere(sphere)){ const closest=entry.box.clampPoint(enemy.position,new THREE.Vector3()); const push=new THREE.Vector3().subVectors(enemy.position,closest); push.y=0; if(push.lengthSq()<.001)push.set(1,0,0); enemy.position.addScaledVector(push.normalize(),radius); } } });
            }
            
            updateScoutAI(enemy, distanceToPlayer, deltaTime) {
                if (enemy.userData.stunTimer > 0) {
                    enemy.userData.stunTimer -= deltaTime;
                    return;
                }

                const enemySpeed = 10.0;
                if (enemy.userData.evadeTarget) {
                    enemy.userData.evadeTimer -= deltaTime;
                    const dirToTarget = new THREE.Vector3().subVectors(enemy.userData.evadeTarget, enemy.position);

                    if (dirToTarget.length() < 1.0 || enemy.userData.evadeTimer <= 0) {
                        enemy.userData.evadeTarget = null;
                        enemy.userData.evadeTimer = 0;
                        return;
                    }

                    dirToTarget.normalize();
                    enemy.position.addScaledVector(dirToTarget, enemySpeed * 1.5 * deltaTime);
                    
                    const angleToTarget = Math.atan2(dirToTarget.x, dirToTarget.z);
                    enemy.rotation.y = angleToTarget;
                    
                    return; 
                }

                enemy.userData.sonarTimer -= deltaTime;
                if (enemy.userData.sonarTimer <= 0) {
                    const maxDist = 80, minDist = 15, maxInterval = 5.0, minInterval = 1.0; let interval = maxInterval; if (distanceToPlayer < maxDist) { const ratio = (distanceToPlayer - minDist) / (maxDist - minDist); interval = minInterval + (maxInterval - minInterval) * Math.max(0, Math.min(1, ratio)); }
                    enemy.userData.sonarTimer = interval;
                    if (this.audioManager.audioCtx) {
                        const audioCtx = this.audioManager.audioCtx;
                        const oscillator = audioCtx.createOscillator();
                        oscillator.type = 'sine';
                        oscillator.frequency.setValueAtTime(enemy.userData.sonarFreq, audioCtx.currentTime);
                        const gainNode = audioCtx.createGain();
                        gainNode.gain.setValueAtTime(0.7, audioCtx.currentTime);
                        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.0);
                        oscillator.connect(gainNode);
                        if (enemy.userData.sonarSource.isPlaying) enemy.userData.sonarSource.stop();
                        enemy.userData.sonarSource.setNodeSource(gainNode);
                        oscillator.start();
                        oscillator.stop(audioCtx.currentTime + 1.05);
                        setTimeout(() => {
                            try {
                                oscillator.disconnect();
                                gainNode.disconnect();
                            } catch(e) {}
                        }, 1200);
                    }
                }
                if (enemy.userData.timeUntilReloaded > 0) enemy.userData.timeUntilReloaded -= deltaTime * 1000 * (this.arenaEvent==='ion_storm' ? 0.7 : 1);
                if (distanceToPlayer < 120) { 
                    const angleToPlayer = Math.atan2(this.playerTank.position.x - enemy.position.x, this.playerTank.position.z - enemy.position.z);
                    let yawDiff = angleToPlayer - enemy.userData.yaw;
                    while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
                    while (yawDiff > Math.PI) yawDiff -= 2 * Math.PI;
                    enemy.userData.yaw += yawDiff * 0.08; 
                    enemy.rotation.y = enemy.userData.yaw;
                    
                    if (distanceToPlayer > 40) { 
                        enemy.translateZ(enemySpeed * deltaTime); 
                    } else if (distanceToPlayer < 30) { 
                        enemy.translateZ(-enemySpeed * 0.5 * deltaTime); 
                    } else { 
                        enemy.translateX(enemySpeed * 0.8 * enemy.userData.strafeDirection * deltaTime); 
                        if (Math.random() < 0.02) enemy.userData.strafeDirection *= -1;
                    }
                
                    const startPos = new THREE.Vector3();
                    const enemyTurret = enemy.children.find(c => c.userData.type === 'turret'); 
                    if (enemyTurret) {
                        enemyTurret.rotation.y = angleToPlayer - enemy.userData.yaw; 
                        const barrelTip = enemyTurret.getObjectByName('barrel_tip', true); 
                        if(barrelTip) barrelTip.getWorldPosition(startPos);
                        else enemyTurret.getWorldPosition(startPos);
                    }
                    
                    if (this.hasLineOfSight(startPos, this.playerTank.position) && enemy.userData.timeUntilReloaded <= 0) { 
                        this.audioManager.enemyShoot(); 
                        enemy.userData.timeUntilReloaded = enemy.userData.reloadTime; 
                        const targetPos = this.playerTank.position.clone(); 
                        const leadAmount = distanceToPlayer / 20; 
                        targetPos.y += leadAmount; 
                        const direction = new THREE.Vector3().subVectors(targetPos, startPos).normalize(); 
                        const velocity = direction.multiplyScalar(70); 
                        this.createProjectile(startPos, velocity, {isPlayer: false, type: 'cannon', damageBonus: enemy.userData.damageBonus, spawnerType: 'scout'}); 
                    } 
                }
            }

            updateHeavyAI(enemy, distanceToPlayer, deltaTime) {
                const enemySpeed = 3.0;
                
                if (enemy.userData.timeUntilReloaded > 0) enemy.userData.timeUntilReloaded -= deltaTime * 1000 * (this.arenaEvent==='ion_storm' ? 0.7 : 1);

                const angleToPlayer = Math.atan2(this.playerTank.position.x - enemy.position.x, this.playerTank.position.z - enemy.position.z);
                let yawDiff = angleToPlayer - enemy.rotation.y;
                while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
                while (yawDiff > Math.PI) yawDiff -= 2 * Math.PI;
                enemy.rotation.y += yawDiff * 0.02;

                if (distanceToPlayer > 60) {
                    enemy.translateZ(enemySpeed * deltaTime);
                }
                
                const startPos = new THREE.Vector3();
                const enemyTurret = enemy.children.find(c => c.userData.type === 'turret');
                if (enemyTurret) {
                    let turretYawDiff = angleToPlayer - enemy.rotation.y - enemyTurret.rotation.y;
                    while (turretYawDiff < -Math.PI) turretYawDiff += 2 * Math.PI;
                    while (turretYawDiff > Math.PI) turretYawDiff -= 2 * Math.PI;
                    enemyTurret.rotation.y += turretYawDiff * 0.03;
                    const barrel = enemy.children.find(c => c.userData.type === 'barrel');
                    if (barrel) barrel.children[0].children[0].getWorldPosition(startPos);
                }

                if (this.hasLineOfSight(startPos, this.playerTank.position) && enemy.userData.timeUntilReloaded <= 0) {
                    this.audioManager.enemyShoot();
                    enemy.userData.timeUntilReloaded = enemy.userData.reloadTime;
                    const targetPos = this.playerTank.position.clone();
                    const leadAmount = distanceToPlayer / 30;
                    targetPos.y += leadAmount;
                    const direction = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
                    const velocity = direction.multiplyScalar(90);
                    this.createProjectile(startPos, velocity, {isPlayer: false, type: 'cannon', damageBonus: enemy.userData.damageBonus, spawnerType: 'heavy'});
                }
            }

            updateInfantryAI(enemy, distanceToPlayer, deltaTime) {
                if (enemy.userData.stunTimer > 0) {
                    enemy.userData.stunTimer -= deltaTime;
                    return;
                }

                const speed = 4.0; const chargeDistance = 150; const attackDistance = 120; const stopDistance = 20;
                if (distanceToPlayer < chargeDistance && distanceToPlayer > stopDistance) {
                    const directionToPlayer = new THREE.Vector3().subVectors(this.playerTank.position, enemy.position).normalize();
                    const tangent = new THREE.Vector3(-directionToPlayer.z, 0, directionToPlayer.x);
                    const strafeInfluence = THREE.MathUtils.clamp(1 - (distanceToPlayer / chargeDistance), 0.3, 0.7);
                    const moveDirection = new THREE.Vector3().add(directionToPlayer.multiplyScalar(1 - strafeInfluence)).add(tangent.multiplyScalar(strafeInfluence * enemy.userData.flankDirection)).normalize();
                    enemy.position.addScaledVector(moveDirection, speed * deltaTime);
                }
                enemy.lookAt(this.playerTank.position);
                if (enemy.userData.timeUntilReloaded > 0) { enemy.userData.timeUntilReloaded -= deltaTime * 1000 * (this.arenaEvent==='ion_storm' ? 0.7 : 1); }
                if (distanceToPlayer < attackDistance && enemy.userData.timeUntilReloaded <= 0) {
                     const startPos = enemy.position.clone().add(new THREE.Vector3(0, 1.5, 0));
                     if (this.hasLineOfSight(startPos, this.playerTank.position)) {
                        enemy.userData.timeUntilReloaded = enemy.userData.reloadTime;
                        this.audioManager.infantryShoot();
                        const direction = new THREE.Vector3().subVectors(this.playerTank.position, startPos).normalize();
                        const spread = 0.05;
                        direction.x += (Math.random() - 0.5) * spread;
                        direction.y += (Math.random() - 0.5) * spread;
                        direction.z += (Math.random() - 0.5) * spread;
                        const velocity = direction.multiplyScalar(120);
                        this.createProjectile(startPos, velocity, {isPlayer: false, type: 'infantry_mg'});
                     }
                }
            }

            updateArtilleryAI(enemy, distanceToPlayer, deltaTime) {
                if (enemy.userData.evadeTarget) {
                    enemy.userData.evadeTimer -= deltaTime;
                    const artilleryEvadeSpeed = 4.0;
                    const dirToTarget = new THREE.Vector3().subVectors(enemy.userData.evadeTarget, enemy.position);

                    if (dirToTarget.length() < 1.0 || enemy.userData.evadeTimer <= 0) {
                        enemy.userData.evadeTarget = null;
                        enemy.userData.evadeTimer = 0;
                        return;
                    }

                    dirToTarget.normalize();
                    enemy.position.addScaledVector(dirToTarget, artilleryEvadeSpeed * deltaTime);
                    
                    const angleToTarget = Math.atan2(dirToTarget.x, dirToTarget.z);
                    enemy.rotation.y = angleToTarget;

                    return; 
                }

                if (enemy.userData.timeUntilReloaded > 0) { enemy.userData.timeUntilReloaded -= deltaTime * 1000 * (this.arenaEvent==='ion_storm' ? 0.7 : 1); }
                enemy.lookAt(this.playerTank.position);
                if (enemy.userData.timeUntilReloaded <= 0) {
                    enemy.userData.timeUntilReloaded = enemy.userData.reloadTime;
                    this.audioManager.artilleryFire();
                    const startPos = new THREE.Vector3();
                    const barrel = enemy.children.find(c => c.userData.type === 'barrel_artillery');
                    if (!barrel) return;
                    barrel.getWorldPosition(startPos);
                    startPos.y += 2;
                    const targetPos = this.playerTank.position.clone();
                    targetPos.x += (Math.random() - 0.5) * 15;
                    targetPos.z += (Math.random() - 0.5) * 15;
                    const gravity = 20.0;
                    const peakHeight = 40 + Math.random() * 20;
                    const heightDiff = targetPos.y - startPos.y;
                    const timeToPeak = Math.sqrt(2 * peakHeight / gravity);
                    const timeToFall = Math.sqrt(2 * (peakHeight + heightDiff) / gravity);
                    const totalTime = timeToPeak + timeToFall;
                    const velocityY = gravity * timeToPeak;
                    const velocityXZ = new THREE.Vector3(targetPos.x - startPos.x, 0, targetPos.z - startPos.z).divideScalar(totalTime);
                    const initialVelocity = new THREE.Vector3(velocityXZ.x, velocityY, velocityXZ.z);
                    this.createWarningMarker(targetPos,0xff4400,totalTime,12);
                    this.createProjectile(startPos, initialVelocity, { isPlayer: false, type: 'artillery_shell', damageBonus: enemy.userData.damageBonus, timeToTarget: totalTime });
                }
            }

            hasLineOfSight(sourcePos, targetPos) { 
                const direction = new THREE.Vector3().subVectors(targetPos, sourcePos).normalize(); 
                this.raycaster.set(sourcePos, direction); 
                const objectsToCheck = this.obstacles.map(o => o.children[0]).concat(this.terrain);
                const intersects = this.raycaster.intersectObjects(objectsToCheck, false);
                return !(intersects.length > 0 && intersects[0].distance < sourcePos.distanceTo(targetPos) - 1); 
            }
            
            checkLevelCompletion() {
                if (this.isTransitioningWave) return;

                const allEnemiesDead = this.enemies.every(e => !e.userData.alive);
                if (allEnemiesDead && this.spawnQueue.length === 0) {
                    this.isTransitioningWave = true;
                    this.showMessage(`WAVE CLEARED`, "success");
                    this.score+=this.level*500; setTimeout(() => this.showUpgradeSelection(), 900);
                }
            }

            showUpgradeSelection(){
                if(this.isGameOver)return; this.waveRewardPending=true; document.exitPointerLock(); const screen=document.getElementById('upgradeScreen'),grid=document.getElementById('upgradeChoices');
                const upgrades=[
                    {name:'REACTIVE ARMOR',desc:'+25 maximum hull and repair 25.',apply:()=>{this.playerStats.maxHP+=25;this.playerStats.hp=Math.min(this.playerStats.maxHP,this.playerStats.hp+25);}},
                    {name:'OVERCHARGED CANNON',desc:'+20% cannon damage.',apply:()=>this.weapons.cannon.damageMultiplier*=1.2},
                    {name:'EXPANDED WARHEAD',desc:'+2 metres blast radius.',apply:()=>this.weapons.cannon.blastRadius=Math.min(18,this.weapons.cannon.blastRadius+2)},
                    {name:'THERMAL SHUNT',desc:'+25% machine-gun cooling.',apply:()=>this.weapons.mg.coolRate*=1.25},
                    {name:'KINETIC DRIVE',desc:'+10% acceleration and top speed.',apply:()=>{this.maxSpeed*=1.1;this.tankAcceleration*=1.1;}},
                    {name:'POWER MATRIX',desc:'+20 maximum power and +1 regeneration.',apply:()=>{this.playerStats.baseMaxPower=Math.min(this.playerStats.absoluteMaxPower,this.playerStats.baseMaxPower+20);this.playerStats.powerRegenRate+=1;}},
                    {name:'ARMOR LATTICE',desc:'+5 flat armor.',apply:()=>this.playerStats.armor+=5},
                    {name:'GAUSS FEED',desc:'+25% machine-gun damage.',apply:()=>this.weapons.mg.damageMultiplier*=1.25}
                ];
                for(let i=upgrades.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[upgrades[i],upgrades[j]]=[upgrades[j],upgrades[i]];} grid.innerHTML=''; upgrades.slice(0,3).forEach(up=>{const button=document.createElement('button');button.className='upgrade-card';button.innerHTML=`<strong>${up.name}</strong>${up.desc}`;button.addEventListener('click',()=>{up.apply();this.waveRewardPending=false;screen.classList.remove('visible');this.beginNextWave();document.getElementById('gameCanvas').requestPointerLock();},{once:true});grid.appendChild(button);}); screen.classList.add('visible');
            }

            showWaveBanner(title,brief){ const banner=document.getElementById('waveBanner');document.getElementById('waveTitle').textContent=title;document.getElementById('waveBrief').textContent=brief;banner.classList.add('visible');clearTimeout(this.waveBannerTimeout);this.waveBannerTimeout=setTimeout(()=>banner.classList.remove('visible'),2200); }

            configureArenaEvent(){ this.arenaEvent=null; let eventText='STANDARD COMBAT CONDITIONS'; if(this.level%4===0){this.arenaEvent='ion_storm';eventText='ION STORM: HOSTILE WEAPONS DISRUPTED';}else if(this.level%3===0){this.arenaEvent='power_surge';eventText='POWER SURGE: ENERGY COSTS HALVED';} document.getElementById('objectiveText').textContent=this.level%5===0?'DESTROY THE ELITE COMMAND TANK':'ELIMINATE ALL HOSTILE SIGNALS'; return eventText; }

            beginNextWave() {
                try {
                    this.triggerGlitchEffect();
                    const deadEnemies = this.enemies.filter(e => !e.userData.alive);
                    deadEnemies.forEach(e => this.disposeMesh(e));
                    this.enemies = this.enemies.filter(e => e.userData.alive);
                    this.spawnPickups();
                    this.scatterShardsAcrossLandscape();
                    
                    this.level++;
                    this.showMessage(`// INCOMING WAVE ${this.level}`, 'success');
                    const eventText=this.configureArenaEvent(); this.showWaveBanner(this.level%5===0?`ELITE WAVE ${this.level}`:`WAVE ${this.level}`,eventText);

                    this.playerStats.hp = Math.min(this.playerStats.maxHP, this.playerStats.hp + 50);
                    this.playerTank.position.set(0, 1.0, 0);
                    this.tankRotation = 0;
                    this.playerTank.rotation.y = 0;
                    this.tankVelocity.set(0,0,0);
                    
                    this.queueSpawnsForLevel();
                    this.updateUI();

                } catch (error) {
                    console.error("Error during wave transition:", error);
                } finally {
                    this.isTransitioningWave = false; 
                }
            }
            
            showDamageIndicator(sourcePosition) { const playerPos = this.playerTank.position.clone(); const damageVec = new THREE.Vector3().subVectors(sourcePosition, playerPos); const forwardVec = new THREE.Vector3(0, 0, 1).applyQuaternion(this.playerTank.quaternion); forwardVec.y = 0; forwardVec.normalize(); damageVec.y = 0; damageVec.normalize(); const angle = Math.atan2(damageVec.x, damageVec.z) - Math.atan2(forwardVec.x, forwardVec.z); const angleDeg = angle * 180 / Math.PI; let indicatorId; if (angleDeg > -45 && angleDeg <= 45) indicatorId = 'damage-top'; else if (angleDeg > 45 && angleDeg <= 135) indicatorId = 'damage-right'; else if (angleDeg < -45 && angleDeg >= -135) indicatorId = 'damage-left'; else indicatorId = 'damage-bottom'; const indicator = document.getElementById(indicatorId); indicator.style.opacity = 1; setTimeout(() => { indicator.style.opacity = 0; }, 500); }
            
            gameOver() { 
                if(this.isGameOver) return; 
                this.isGameOver = true; 
                this.playerTank.userData.alive = false;
                this.createDebrisExplosion(this.playerTank); 
                document.exitPointerLock(); 
                document.getElementById('gameOverScreen').style.display = 'flex'; 
                this.playerTank.visible = false; 
            }
            restartGame() { 
                this.isGameOver = false; 
                this.isTransitioningWave = true;
                this.playerTank.visible = true;
                this.playerTank.userData.alive = true;
                document.getElementById('gameOverScreen').style.display = 'none'; 
                this.level = 0; 
                this.playerStats.hp = 100;
                this.playerStats.maxHP = 100;
                this.playerStats.power = 100;
                this.playerStats.baseMaxPower = 100;
                this.playerStats.healthShards = 0;
                this.playerStats.powerShards = 0;
                this.playerStats.powerShardsRequired = 20;
                this.playerStats.powerUpgradeTier = 1;
                this.weapons.cannon.timeUntilReloaded = 0; 
                this.weapons.mg.timeUntilReloaded = 0; this.weapons.mg.heat = 0; 
                this.weapons.cannon.damageMultiplier=1; this.weapons.cannon.blastRadius=10; this.weapons.mg.damageMultiplier=1; this.weapons.mg.coolRate=30;
                this.maxSpeed=12;this.tankAcceleration=25;this.playerStats.armor=25;this.playerStats.powerRegenRate=6;
                this.playerStats.storedPowerPacks = 0;
                
                this.enemies.forEach(e => this.disposeMesh(e));
                this.projectiles.forEach(p => this.disposeMesh(p));
                this.debris.forEach(d => this.disposeMesh(d.mesh));
                this.particles.forEach(p=>this.disposeMesh(p.mesh)); this.warningMarkers.forEach(w=>this.disposeMesh(w.mesh));
                
                this.spawnPickups();
                
                this.enemies = []; this.projectiles = []; this.debris = []; this.particles = []; this.warningMarkers=[]; this.spawnQueue = []; this.score=0;this.kills=0;this.combo=1;this.boss=null;
                
                this.beginNextWave(); 
                document.getElementById('gameCanvas').requestPointerLock(); 
            }
            
            triggerGlitchEffect() { this.isGlitching = true; this.audioManager.playGlitchSound(); setTimeout(() => { this.isGlitching = false; document.getElementById('glitchOverlay').style.display = 'none'; }, 300); }
            applyGlitchEffect() { this.camera.position.x += (Math.random() - 0.5) * 0.5; const overlay = document.getElementById('glitchOverlay'); if (Math.random() > 0.3) { const sliceHeight = Math.random() * 20 + 5; const sliceTop = Math.random() * (100 - sliceHeight); overlay.style.display = 'block'; overlay.style.top = `${sliceTop}vh`; overlay.style.height = `${sliceHeight}vh`; } else { overlay.style.display = 'none'; } }
            showMessage(text, type = 'info') { const statusEl = document.getElementById('gameStatus'); if (this.messageTimeout) clearTimeout(this.messageTimeout); statusEl.textContent = text; if (type === 'success') statusEl.style.color = '#2ecc71'; else if (type === 'danger') statusEl.style.color = '#ff4400'; else statusEl.style.color = '#00ffff'; this.messageTimeout = setTimeout(() => { statusEl.textContent = "ONLINE"; statusEl.style.color = '#00ffff'; }, 3000); }
            
            updateUI() {
                document.getElementById('levelCounter').textContent = this.level;
                const aliveEnemies = this.enemies.filter(e => e.userData.alive);
                document.getElementById('enemiesLeft').textContent = aliveEnemies.length;

                const enemyCounts = aliveEnemies.reduce((counts, enemy) => {
                    const type = enemy.userData.type.toUpperCase();
                    counts[type] = (counts[type] || 0) + 1;
                    return counts;
                }, {});

                let breakdownHTML = '';
                if (enemyCounts.HEAVY > 0) breakdownHTML += `<div>HEAVY: ${enemyCounts.HEAVY}</div>`;
                if (enemyCounts.BOSS > 0) breakdownHTML += `<div style="color:#ff4400">ELITE: ${enemyCounts.BOSS}</div>`;
                if (enemyCounts.SCOUT > 0) breakdownHTML += `<div>SCOUTS: ${enemyCounts.SCOUT}</div>`;
                if (enemyCounts.INFANTRY > 0) breakdownHTML += `<div>INFANTRY: ${enemyCounts.INFANTRY}</div>`;
                if (enemyCounts.ARTILLERY > 0) breakdownHTML += `<div>ARTILLERY: ${enemyCounts.ARTILLERY}</div>`;
                document.getElementById('enemyBreakdown').innerHTML = breakdownHTML;


                document.getElementById('playerHP').textContent = Math.round(this.playerStats.hp);
                document.getElementById('playerMaxHP').textContent = Math.round(this.playerStats.maxHP);
                document.getElementById('playerArmor').textContent=Math.round(this.playerStats.armor);
                const powerEl = document.getElementById('playerPower');
                powerEl.textContent = Math.round(this.playerStats.power);
                document.getElementById('playerMaxPower').textContent = Math.round(this.playerStats.baseMaxPower);
                powerEl.style.color = this.playerStats.power < this.playerStats.lowPowerThreshold ? '#ff4400' : '#00ffff';
                document.getElementById('hpBar').style.width=`${THREE.MathUtils.clamp(this.playerStats.hp/this.playerStats.maxHP*100,0,100)}%`;
                document.getElementById('powerBar').style.width=`${THREE.MathUtils.clamp(this.playerStats.power/this.playerStats.baseMaxPower*100,0,100)}%`;
                document.getElementById('storedPacks').textContent = this.playerStats.storedPowerPacks;

                document.getElementById('healthShards').textContent = this.playerStats.healthShards;
                document.getElementById('powerShards').textContent = `${this.playerStats.powerShards}/${this.playerStats.powerShardsRequired}`;

                const weaponNameEl = document.getElementById('weaponName');
                const weaponStatusEl = document.getElementById('weaponStatus');
                document.getElementById('heatBar').style.width=`${THREE.MathUtils.clamp(this.weapons.mg.heat,0,100)}%`;
                if (this.weapons.mg.heat >= this.weapons.mg.maxHeat) {
                    weaponNameEl.textContent = 'MG OVERHEATED';
                    weaponStatusEl.textContent = `COOLDOWN ${Math.round(this.weapons.mg.heat)}%`;
                    weaponStatusEl.style.color = '#ff4400';
                } else if (this.mouse.right) {
                    weaponNameEl.textContent = 'MACHINE GUN';
                    weaponStatusEl.textContent = `HEAT: ${Math.round(this.weapons.mg.heat)}%`;
                    weaponStatusEl.style.color = this.weapons.mg.heat > 70 ? '#ffaa00' : '#ffff00';
                } else {
                    weaponNameEl.textContent = 'CANNON';
                    if (this.weapons.cannon.timeUntilReloaded > 0) {
                        weaponStatusEl.textContent = `RECHARGING (${(this.weapons.cannon.timeUntilReloaded / 1000).toFixed(1)}s)`;
                        weaponStatusEl.style.color = '#ff4400';
                    } else {
                        weaponStatusEl.textContent = 'READY';
                        weaponStatusEl.style.color = '#2ecc71';
                    }
                }
                document.getElementById('score').textContent=String(Math.round(this.score)).padStart(6,'0')+(this.combo>1?`  x${this.combo}`:'');
                const bossWrap=document.getElementById('bossBarWrap'); if(this.boss&&this.boss.userData.alive){bossWrap.style.display='block';document.getElementById('bossBar').style.width=`${Math.max(0,this.boss.userData.hp/this.boss.userData.maxHP*100)}%`;}else bossWrap.style.display='none';
                this.drawRadar();
            }

            drawRadar(){ const canvas=document.getElementById('radar'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,cx=w/2,cy=h/2,range=150;ctx.clearRect(0,0,w,h);ctx.strokeStyle='#07545a';ctx.lineWidth=1;[.33,.66,1].forEach(r=>{ctx.beginPath();ctx.arc(cx,cy,cx*r-2,0,Math.PI*2);ctx.stroke();});ctx.beginPath();ctx.moveTo(cx,0);ctx.lineTo(cx,h);ctx.moveTo(0,cy);ctx.lineTo(w,cy);ctx.stroke();ctx.fillStyle='#00ffff';ctx.beginPath();ctx.moveTo(cx,cy-6);ctx.lineTo(cx-4,cy+5);ctx.lineTo(cx+4,cy+5);ctx.fill();const rot=-this.tankRotation*Math.PI/180;this.enemies.filter(e=>e.userData.alive&&e.visible).forEach(enemy=>{const dx=enemy.position.x-this.playerTank.position.x,dz=enemy.position.z-this.playerTank.position.z,x=(dx*Math.cos(rot)-dz*Math.sin(rot))/range*cx,z=(dx*Math.sin(rot)+dz*Math.cos(rot))/range*cy;if(Math.abs(x)>cx||Math.abs(z)>cy)return;ctx.fillStyle=enemy.userData.type==='boss'?'#ff0044':enemy.userData.type==='artillery'?'#ff00ff':enemy.userData.type==='infantry'?'#ffaa00':'#ff4400';ctx.fillRect(cx+x-2,cy-z-2,enemy.userData.type==='boss'?7:4,enemy.userData.type==='boss'?7:4);}); }

            startGame() { 
                this.gameState = 'playing'; 
                this.level = 0; 
                this.playerStats.power = this.playerStats.baseMaxPower; 
                this.playerStats.storedPowerPacks = 0; 
                this.isTransitioningWave = true; 
                if(this.sandboxMode)this.beginCombatSandbox();else this.beginNextWave();
                this.isGameOver = false; 
            }

            beginCombatSandbox(){ this.level=1;this.isTransitioningWave=false;this.spawnQueue=[];this.showWaveBanner('COMBAT SANDBOX','FIXED ENCOUNTER · DEBUG KEYS ENABLED'); const definitions=[['scout',this.createEnhancedTankMesh(0xff4400),-28,55,80],['heavy',this.createHeavyTankMesh(0xff8800),32,75,300],['artillery',this.createArtilleryMesh(0xff00ff),-65,125,120],['infantry',this.createInfantryMesh(0xffaa00),18,38,20]];definitions.forEach(([type,mesh,x,z,hp])=>{mesh.position.set(x,type==='infantry'?0:1,z);mesh.userData={type,hp,maxHP:hp,damageBonus:0,alive:true,reloadTime:type==='infantry'?1800:5000,timeUntilReloaded:2000,yaw:0,strafeDirection:1,flankDirection:1,sonarTimer:999,sonarFreq:400,stunTimer:0,evadeTimer:0,evadeTarget:null};if(type==='scout'){const audio=new THREE.PositionalAudio(this.audioListener);mesh.add(audio);mesh.userData.sonarSource=audio;}this.enemies.push(mesh);this.scene.add(mesh);});this.updateUI(); }

            debugSnapshot(){ return {wave:this.level,score:this.score,player:{...this.playerStats},weapons:JSON.parse(JSON.stringify(this.weapons)),enemies:this.enemies.filter(e=>e.userData.alive).map(e=>({type:e.userData.type,hp:e.userData.hp,position:e.position.toArray()})),projectiles:this.projectiles.length,pools:{projectiles:this.projectilePool.length,particles:this.particlePool.length}}; }
            
            processSpawnQueue() {
                if (this.isTransitioningWave || this.spawnQueue.length === 0) return;
                if(performance.now()<this.nextSpawnTime)return; this.nextSpawnTime=performance.now()+220;
            
                const spawnsPerFrame = 1;
                for (let i = 0; i < spawnsPerFrame && this.spawnQueue.length > 0; i++) {
                    const spawn = this.spawnQueue.shift();
                    const wave = this.level;
                    const hpBonus = (wave - 1) * 10;
                    const damageBonus = (wave - 1) * 1.5;

                    switch (spawn.type) {
                        case 'scout': {
                            const tank = this.createEnhancedTankMesh(0xff4400); const pos = this.getValidSpawnPosition(100); tank.position.set(pos.x, 1.0, pos.z);
                            const finalHP = 80 + hpBonus;
                            tank.userData = { type: 'scout', hp: finalHP, maxHP: finalHP, damageBonus, alive: true, reloadTime: 4000 + Math.random() * 2000, timeUntilReloaded: 2000, yaw: Math.random() * Math.PI * 2, isMoving: false, sonarTimer: 2 + Math.random() * 3, sonarFreq: 300 + Math.random() * 200, strafeDirection: (Math.random() > 0.5 ? 1 : -1), evadeTimer: 0, evadeTarget: null, stunTimer: 0 };
                            const positionalAudio = new THREE.PositionalAudio(this.audioListener);
                            positionalAudio.setRefDistance(20); positionalAudio.setRolloffFactor(3);
                            tank.add(positionalAudio); tank.userData.sonarSource = positionalAudio;
                            this.telegraphEnemy(tank,0xff4400);
                            this.enemies.push(tank); this.scene.add(tank);
                            break;
                        }
                        case 'heavy': {
                            const tank = this.createHeavyTankMesh(0xff8800); const pos = this.getValidSpawnPosition(120); tank.position.set(pos.x, 1.0, pos.z);
                            const finalHP = 300 + hpBonus * 2;
                            tank.userData = { type: 'heavy', hp: finalHP, maxHP: finalHP, damageBonus: damageBonus + 10, alive: true, reloadTime: 5000, timeUntilReloaded: 3000 };
                            this.telegraphEnemy(tank,0xff8800);
                            this.enemies.push(tank); this.scene.add(tank);
                            break;
                        }
                        case 'boss': {
                            const tank=this.createHeavyTankMesh(0xff0044), pos=this.getValidSpawnPosition(150); tank.position.set(pos.x,1,pos.z); tank.scale.setScalar(1.65);
                            const finalHP=900+wave*100; tank.userData={type:'boss',hp:finalHP,maxHP:finalHP,damageBonus:25+wave*2,alive:true,reloadTime:3200,timeUntilReloaded:2500}; this.boss=tank; this.telegraphEnemy(tank,0xff0044,1.4); this.enemies.push(tank); this.scene.add(tank); break;
                        }
                        case 'artillery': {
                            const artillery = this.createArtilleryMesh(0xff00ff);
                            const pos = this.getValidSpawnPosition(200);
                            artillery.position.set(pos.x, 1.5, pos.z);
                            artillery.lookAt(this.playerTank.position);
                            const finalHP = 120 + hpBonus;
                            artillery.userData = { type: 'artillery', hp: finalHP, maxHP: finalHP, damageBonus, alive: true, reloadTime: 8000 + Math.random() * 4000, timeUntilReloaded: 5000 + Math.random() * 4000, evadeTimer: 0, evadeTarget: null };
                            this.telegraphEnemy(artillery,0xff00ff);
                            this.enemies.push(artillery);
                            this.scene.add(artillery);
                            break;
                        }
                        case 'infantry_squad': {
                            const squadCenterPos = this.getValidSpawnPosition();
                            this.spawnInfantrySquad(new THREE.Vector3(squadCenterPos.x, 0, squadCenterPos.z), spawn.size);
                            break;
                        }
                        case 'pickup_health': {
                             const pack = this.createHealthPack();
                             const pos = this.getValidSpawnPosition(10);
                             pack.position.set(pos.x, 1.5, pos.z);
                             this.healthPacks.push(pack); this.scene.add(pack);
                             break;
                        }
                        case 'pickup_power': {
                            const pack = this.createPowerPack('field_pickup');
                            const pos = this.getValidSpawnPosition(10);
                            pack.position.set(pos.x, 2, pos.z);
                            this.powerPacks.push(pack); this.scene.add(pack);
                            break;
                        }
                    }
                }
            }

            telegraphEnemy(enemy,color,delay=.75){ enemy.visible=false; enemy.userData.spawnDelay=delay; this.createWarningMarker(enemy.position,color,delay,4); }
            createWarningMarker(position,color,life=1,radius=5){ const geo=new THREE.RingGeometry(radius*.72,radius,32); const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}); const mesh=new THREE.Mesh(geo,mat); mesh.rotation.x=-Math.PI/2; mesh.position.copy(position); mesh.position.y=.12; this.warningMarkers.push({mesh,life,maxLife:life}); this.scene.add(mesh); return mesh; }
            createScorch(position,color){const mesh=this.createWarningMarker(position,color,8,2.2),w=this.warningMarkers[this.warningMarkers.length-1];w.scorch=true;mesh.material.opacity=.28;}
            updateWarningMarkers(deltaTime){ for(let i=this.warningMarkers.length-1;i>=0;i--){ const w=this.warningMarkers[i]; w.life-=deltaTime; if(w.scorch){w.mesh.material.opacity=Math.max(0,.28*w.life/w.maxLife);}else{w.mesh.scale.setScalar(1+(1-w.life/w.maxLife)*.45);w.mesh.material.opacity=Math.max(0,w.life/w.maxLife);} if(w.life<=0){this.disposeMesh(w.mesh);this.warningMarkers.splice(i,1);} } }

            animate() { 
                requestAnimationFrame(() => this.animate()); 
                const deltaTime = Math.min(this.clock.getDelta(), 0.05); 
                if (this.gameState === 'splash' && this.splashText) { this.splashText.rotation.y += deltaTime * 0.1; this.splashText.position.y += Math.sin(this.clock.getElapsedTime() * 0.5) * 0.02; } 
                if(this.isGameOver) { this.updateDebris(deltaTime);this.updateParticles(deltaTime);this.updateWarningMarkers(deltaTime);this.updateCameraPosition();this.renderer.render(this.scene,this.camera);return; } 
                if(this.isPaused) return; 
                if(this.comboTimer>0){this.comboTimer-=deltaTime;if(this.comboTimer<=0)this.combo=1;}
                
                this.processSpawnQueue();

                if (this.gameState === 'playing' && !this.isTransitioningWave) { 
                    this.updatePlayerControls(deltaTime); 
                    this.updateEnemies(deltaTime); 
                } 

                if (this.gameState === 'playing') {
                    this.updateProjectiles(deltaTime); 
                    this.updateDebris(deltaTime);
                    this.updateParticles(deltaTime);
                    this.updateWarningMarkers(deltaTime);
                    this.powerPacks.forEach(p => { p.rotation.y -= deltaTime * 1.5; });
                    this.healthPacks.forEach(p => { p.rotation.y += deltaTime * 1.0; });
                    this.healthShards.forEach(p => { p.rotation.y += deltaTime * 2.5; });
                    this.powerShards.forEach(p => { p.rotation.y -= deltaTime * 2.5; });
                    this.uiTimer-=deltaTime; if(this.uiTimer<=0){this.uiTimer=.1;this.updateUI();}
                }
                
                this.updateCameraPosition(); 
                if(this.screenShake>0){this.camera.position.x+=(Math.random()-.5)*this.screenShake;this.camera.position.y+=(Math.random()-.5)*this.screenShake;this.screenShake=Math.max(0,this.screenShake-deltaTime*2.5);}
                if (this.isGlitching) this.applyGlitchEffect(); 
                this.renderer.render(this.scene, this.camera); 
            }
            
            spawnPickups() {
                 this.healthPacks.forEach(h=>this.disposeMesh(h));
                 this.powerPacks.forEach(p=>this.disposeMesh(p));
                 this.healthShards.forEach(s=>this.disposeMesh(s));
                 this.powerShards.forEach(s=>this.disposeMesh(s));
                 this.healthPacks = [];
                 this.powerPacks = [];
                 this.healthShards = [];
                 this.powerShards = [];
            }

            scatterShardsAcrossLandscape() {
                const numHealthShards = 8 + Math.floor(Math.random() * 9);
                const numPowerShards = 10 + Math.floor(Math.random() * 9);

                for (let i = 0; i < numHealthShards; i++) {
                    const pos = this.getValidSpawnPosition(10);
                    this.spawnHealthShard(new THREE.Vector3(pos.x, 0, pos.z));
                }

                for (let i = 0; i < numPowerShards; i++) {
                    const pos = this.getValidSpawnPosition(10);
                    this.spawnPowerShard(new THREE.Vector3(pos.x, 0, pos.z));
                }
            }

            spawnPowerPack(position) {
                const pack = this.createPowerPack('enemy_drop');
                pack.position.copy(position);
                pack.position.y = 2;
                this.powerPacks.push(pack);
                this.scene.add(pack);
            }

            spawnHealthPack(position) {
                const pack = this.createHealthPack();
                pack.position.copy(position);
                pack.position.y = 1.5;
                this.healthPacks.push(pack);
                this.scene.add(pack);
            }

            spawnHealthShard(position) {
                const shard = this.createHealthShard();
                shard.position.copy(position);
                shard.position.y = 1;
                this.healthShards.push(shard);
                this.scene.add(shard);
            }

            spawnPowerShard(position) {
                const shard = this.createPowerShard();
                shard.position.copy(position);
                shard.position.y = 1;
                this.powerShards.push(shard);
                this.scene.add(shard);
            }

            spawnInfantrySquad(centerPos, size) {
                for (let j = 0; j < size; j++) {
                    const offsetAngle = Math.random() * Math.PI * 2;
                    const offsetRadius = 2 + Math.random() * 4;
                    const infantryX = centerPos.x + Math.cos(offsetAngle) * offsetRadius;
                    const infantryZ = centerPos.z + Math.sin(offsetAngle) * offsetRadius;

                    const infantry = this.createInfantryMesh(0xffaa00);
                    infantry.position.set(infantryX, 0, infantryZ);

                    const finalHP = 15 + (this.level - 1) * 5;
                    infantry.userData = { type: 'infantry', hp: finalHP, maxHP: finalHP, alive: true, reloadTime: 1500 + Math.random() * 1000, timeUntilReloaded: Math.random() * 1500, flankDirection: Math.random() > 0.5 ? 1 : -1, stunTimer: 0 };
                    this.telegraphEnemy(infantry,0xffaa00,.55);
                    this.enemies.push(infantry);
                    this.scene.add(infantry);
                }
            }

            createHealthPack() { const group = new THREE.Group(); const geo = new THREE.BoxGeometry(2,0.5,1); const mesh = this.createStylizedMesh(geo, 0x2ecc71); const vMesh = mesh.clone(); vMesh.rotation.y = Math.PI/2; group.add(mesh,vMesh); return group; }
            createPowerPack(type) { const geo = new THREE.BoxGeometry(1.5, 1.5, 1.5); const pack = this.createStylizedMesh(geo, 0x9b59b6); pack.userData.type = type; return pack; }
            createHealthShard() { const geo = new THREE.IcosahedronGeometry(0.5, 0); return this.createStylizedMesh(geo, 0x2ecc71); }
            createPowerShard() { const geo = new THREE.IcosahedronGeometry(0.5, 0); return this.createStylizedMesh(geo, 0x9b59b6); }
            
            checkPickups() {
                for (let i = this.healthPacks.length - 1; i >= 0; i--) {
                    const p = this.healthPacks[i];
                    if (this.playerTank.position.distanceTo(p.position) < 4) {
                        const heal = Math.min(this.playerStats.maxHP - this.playerStats.hp, 30);
                        if (heal > 0) {
                            this.playerStats.hp += heal;
                            this.showMessage(`HEALTH +${heal} HP`, 'success');
                        }
                        this.audioManager.powerupPickup();
                        this.disposeMesh(p);
                        this.healthPacks.splice(i, 1);
                    }
                }
        
                for (let i = this.powerPacks.length - 1; i >= 0; i--) {
                    const p = this.powerPacks[i];
                    if (this.playerTank.position.distanceTo(p.position) < 4) {
                        if (p.userData.type === 'field_pickup') {
                            this.playerStats.power = Math.min(this.playerStats.baseMaxPower, this.playerStats.power + 20);
                            this.showMessage(`POWER +20`, 'success');
                            this.audioManager.powerupPickup();
                            this.disposeMesh(p);
                            this.powerPacks.splice(i, 1);
                        } else { 
                            if (this.playerStats.storedPowerPacks < this.playerStats.maxStoredPacks) {
                                this.playerStats.storedPowerPacks++;
                                this.audioManager.powerupPickup();
                                this.showMessage("POWER PACK STORED", "success");
                                this.disposeMesh(p);
                                this.powerPacks.splice(i, 1);
                            } else {
                                this.showMessage("STORAGE FULL", "danger");
                            }
                        }
                    }
                }

                for (let i = this.healthShards.length - 1; i >= 0; i--) {
                    const s = this.healthShards[i];
                    if (this.playerTank.position.distanceTo(s.position) < 3) {
                        this.playerStats.healthShards++;
                        this.playerStats.maxHP++;
                        this.playerStats.hp++;
                        this.audioManager.shardPickup();
                        this.disposeMesh(s);
                        this.healthShards.splice(i, 1);
                    }
                }

                for (let i = this.powerShards.length - 1; i >= 0; i--) {
                    const s = this.powerShards[i];
                    if (this.playerTank.position.distanceTo(s.position) < 3) {
                        this.playerStats.powerShards++;
                        if (this.playerStats.powerShards >= this.playerStats.powerShardsRequired) {
                            const upgradeAmount = 10 + (10 * this.playerStats.powerUpgradeTier);
                            this.playerStats.baseMaxPower += upgradeAmount;
                            this.playerStats.powerShards = 0; // Reset for next level
                            this.showMessage("POWER CORE UPGRADED", "success");
                            
                            this.playerStats.powerUpgradeTier++;
                            this.playerStats.powerShardsRequired += 10;
                        }
                        this.audioManager.shardPickup();
                        this.disposeMesh(s);
                        this.powerShards.splice(i, 1);
                    }
                }
            }

            usePowerPack() { if (this.playerStats.storedPowerPacks > 0) { this.playerStats.storedPowerPacks--; this.playerStats.power = Math.min(this.playerStats.absoluteMaxPower, this.playerStats.power + 100); this.audioManager.powerupPickup(); this.showMessage("POWER BOOSTED", "success"); } else { this.showMessage("NO PACKS STORED", "danger"); } }
        
            disposeMesh(mesh) {
                if (!mesh) return;
                this.scene.remove(mesh);
                mesh.traverse(node => {
                    if (node.geometry) node.geometry.dispose();
                    if (node.material) {
                        if (Array.isArray(node.material)) {
                            node.material.forEach(m => m.dispose());
                        } else {
                            node.material.dispose();
                        }
                    }
                    if (node.isPositionalAudio) {
                        try { 
                            if (node.isPlaying) node.stop();
                            node.disconnect(); 
                        } catch(e) {}
                    }
                });
            }
        }
        
        window.addEventListener('DOMContentLoaded', () => { window.cyberCommander = new CyberCommanderGame(); });
