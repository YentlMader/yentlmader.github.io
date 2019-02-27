document.addEventListener("DOMContentLoaded", function(){
    const WIDTH = 720;
    const HEIGHT = 1248;
    const NEAR_CLIP = 30;

    // Scene
    var renderer;
    var scene;
    var camera;
    var light;

    // Gameplay
    var speedIntervalClock;
    var obstacleIntervalClock;
    var speed = 0.3; // starting speed
    const increaseSpeed = 0.02; // constant for regular speed increasement
    var increaseSpeedInterval = 10; // seconds until speed is increased

    var playing = false;
    var introAnim = true;
    var obstacles = [];
    var obstacleModels = [];
    var obstacleInterval = 1.0; // seconds until obstacle is created
    // obstacle spawn position
    var obstacleSpawnZ = -30;
    var obstacleSpawnY = 0.2;
    var obstacleSpawnX = 7;

    var prevObstacles = [];

    /*
     * 5 lanes for spawning objects
     */
    const numLanes = 5;
    const laneWidth = 1.3;
    // variables for mid-point of lanes
    const left = -2 * laneWidth;
    const midLeft = -laneWidth;
    const mid = 0;
    const midRight = laneWidth;
    const right = 2 * laneWidth;
    // array storing lane positions
    const lanes = [left, midLeft, mid, midRight, right];
    var currentLane;

    // Player and obstacles
    var char;
    const heroSize = 1; // hero size for rough collision detection based on distance between objects
    const heroPosZ = 20;

    // Controls
    var start;
    var lft;
    var rgt;

    // Score
    var scoreText;
    var score = 0;


    function init() {
        // Set up the scene
        createScene();

        // Add event listeners for controls
        start = document.querySelector(".start img");
        start.addEventListener("click", startGame);

        lft = document.querySelector(".btn_left");
        lft.addEventListener("click", function() {
            keydownHandler({"keyCode": 37});
        });

        rgt = document.querySelector(".btn_right");
        rgt.addEventListener("click", function() {
            keydownHandler({"keyCode": 39});
        });
        
        document.addEventListener("keydown", keydownHandler);

        // Call game loop
        update();
    }

    /**
     * Create initial scene with renderer and point light
     * Load models for character and obstacles
     * Create and start game clocks
     */
    function createScene() {
        // Create renderer with transparent background
        // Background is just a static image
        renderer = new THREE.WebGLRenderer({
            alpha: true // remove canvas' bg color
        });
        renderer.setSize(WIDTH, HEIGHT);

        // Append rendered output (canvas) to document
        document.querySelector("#container").appendChild(renderer.domElement);

        // Create scene
        scene = new THREE.Scene();

        // Create camera and set camera position
        camera = new THREE.PerspectiveCamera(55, WIDTH / HEIGHT, 0.1, 10000);
        camera.position.set(0, 8, NEAR_CLIP);
        camera.lookAt(0, 0, 0);
        // Add camera to scene
        scene.add(camera);

        // Point light
        light = new THREE.PointLight(0xffffff);
        light.position.set(0, 300, 200);
        
        scene.add(light);

        // Distance fog
        scene.fog = new THREE.FogExp2(0x11899a, 0.02);

        // Add character to scene
        addCharacter();

        // Load models used for obstacles
        loadObstacles();

        // Score display
        scoreText = document.querySelector(".scoreText");

        // Create clocks
        speedIntervalClock = new THREE.Clock();
        speedIntervalClock.start();
        obstacleIntervalClock = new THREE.Clock();
        obstacleIntervalClock.start();
    }

    /**
     * Load character model and material
     * Add character to scene and position at starting point
     */
    function addCharacter() {
        let loader = new THREE.OBJLoader2();
        loader.loadMtl("models/dataPackage_GRP.mtl", null, function(materials) {
            loader.setModelName("dataPackage");
            loader.setMaterials(materials);
            loader.setLogging(false, false);
            loader.load("models/dataPackage_GRP.obj", function(object) {
                char = object.detail.loaderRootNode;
                currentLane = mid;
                char.position.set(currentLane, 1, heroPosZ);
                
                scene.add(char);
            }, null, null, null, false );
        });
    }

    /**
     * Load obstacle models and materials
     */
    function loadObstacles() {
        let loader1 = new THREE.OBJLoader2();
        loader1.loadMtl("models/error_GRP.mtl", null, function(materials) {
            loader1.setModelName("error");
            loader1.setMaterials(materials);
            loader1.setLogging(false, false);
            loader1.load("models/error_GRP.obj", function(object) {
                object.detail.loaderRootNode.visible = false;
                obstacleModels.push(object.detail.loaderRootNode);
                scene.add(obstacleModels[0]);
            }, null, null, null, false );
        });

        let loader2 = new THREE.OBJLoader2();
        loader2.loadMtl("models/warning_GRP.mtl", null, function(materials) {
            loader2.setModelName("error");
            loader2.setMaterials(materials);
            loader2.setLogging(false, false);
            loader2.load("models/warning_GRP.obj", function(object) {
                object.detail.loaderRootNode.visible = false;
                obstacleModels.push(object.detail.loaderRootNode);
            }, null, null, null, false );
        });

        let loader3 = new THREE.OBJLoader2();
        loader3.loadMtl("models/noWiFi_GRP.mtl", null, function(materials) {
            loader3.setModelName("error");
            loader3.setMaterials(materials);
            loader3.setLogging(false, false);
            loader3.load("models/noWiFi_GRP.obj", function(object) {
                object.detail.loaderRootNode.visible = false;
                obstacleModels.push(object.detail.loaderRootNode);
            }, null, null, null, false );
        });
    }

    function startGame() {
        // Reset everything
        obstacles.forEach(function(o) {
            scene.remove(o);
        });
        obstacles = [];
        char.position.set(0, 1, heroPosZ);
        currentLane = 0;
        
        score = 0;
        scoreText.innerHTML = score;

        introAnim = false;
        playing = true;
        start.style.display = "none";

        render();
    }

    function spawnObstacle() {
        // Obstacle types
        /*
         * - 0 -
         * single obstacle
         * | | |x| | |
         * 
         * - 1 -
         * two obstacles right next to each other
         * | |x|x| | |
         * 
         * - 2 -
         * three obstacles with space inbetween
         * |x| |x| |x|
         * 
         * - 3 -
         * four obstacles with gap at random position
         * |x|x|x| |x|
         * 
         * - 4 -
         * three obstacles with gap at random position
         * |x| |x|x| |
         * 
         * - 5 -
         * two obstacles at random positions
         * | |x| | |x|
         */
        let type = Math.floor(Math.random() * 6);

        // Check if previous two obstacles are the same
        // as the one being created and change type if so
        let matches = 0;
        for(let i = 0; i < prevObstacles.length; i++) {
            if(type == prevObstacles[i]) matches++;
        }
        if(matches > 1) {
            spawnObstacle();
        }
        else {
            prevObstacles.push(type);
            if(prevObstacles.length > 2) {
                prevObstacles.shift();
            }

            addObstacle(type);
        }
    }

    /**
     * Add obstacle to scene
     */
    function addObstacle(type) {
        let obstacle = createObstacle(type);
        obstacle.visible = true;
        obstacles.push(obstacle);

        obstacle.position.set(obstacleSpawnX, 1, obstacleSpawnZ);
        scene.add(obstacle);
    }

    /**
     * Create and return a new obstacle
     */
    function createObstacle(type) {
        let obstacle = new THREE.Group();
        obstacle.occupiedLanes = []
        let modelType = Math.floor(Math.random() * obstacleModels.length);
        
        if(type == 0) {
            let obstacleMid = obstacleModels[modelType].clone();
            obstacleMid.visible = true;
            let lane = randLane();
            obstacleMid.position.set(lanes[lane], obstacleSpawnY, 0);
            obstacle.occupiedLanes = [lane];

            obstacle.add(obstacleMid);
        }
        else if(type == 1) {
            let obstacleLeft = obstacleModels[modelType].clone();
            let pos1 = randLane();
            let pos2 = (pos1 + 1) < numLanes ? pos1 + 1 : pos1 - 1;
            obstacleLeft.position.set(lanes[pos1], obstacleSpawnY, 0);
            obstacleLeft.visible = true;
            let obstacleRight = obstacleModels[modelType].clone();
            obstacleRight.position.set(lanes[pos2], obstacleSpawnY, 0);
            obstacleRight.visible = true;

            obstacle.occupiedLanes = [pos1, pos2];

            obstacle.add(obstacleLeft);
            obstacle.add(obstacleRight);
        }
        else if(type == 2) {
            let obstacleLeft = obstacleModels[modelType].clone();
            obstacleLeft.position.set(lanes[0], obstacleSpawnY, 0);
            obstacleLeft.visible = true;
            let obstacleMid = obstacleModels[modelType].clone();
            obstacleMid.position.set(lanes[2], obstacleSpawnY, 0);
            obstacleMid.visible = true;
            let obstacleRight = obstacleModels[modelType].clone();
            obstacleRight.position.set(lanes[4], obstacleSpawnY, 0);
            obstacleRight.visible = true;

            obstacle.occupiedLanes = [0, 2, 4];

            obstacle.add(obstacleLeft);
            obstacle.add(obstacleMid);
            obstacle.add(obstacleRight);
        }
        else if(type == 3) {
            let gapPos = randLane();

            for(let i = 0; i < numLanes; i++) {
                if(i != gapPos) {
                    let o = obstacleModels[modelType].clone();
                    o.position.set(lanes[i], obstacleSpawnY, 0);
                    o.visible = true;

                    obstacle.occupiedLanes.push(i);
                    obstacle.add(o);
                }
            }
        }
        else if(type == 4) {
            let gapPos1 = randLane();
            let gapPos2 = randLane(gapPos1);

            for(let i = 0; i < numLanes; i++) {
                if(i != gapPos1 && i != gapPos2) {
                    let o = obstacleModels[modelType].clone();
                    o.position.set(lanes[i], obstacleSpawnY, 0);
                    o.visible = true;

                    obstacle.occupiedLanes.push(i);
                    obstacle.add(o);
                }
            }
        }
        else if(type == 5) {
            let pos1 = randLane();
            let pos2 = randLane(pos1);

            let obstacleLeft = obstacleModels[modelType].clone();
            obstacleLeft.position.set(lanes[pos1], obstacleSpawnY, 0);
            obstacleLeft.visible = true;
            let obstacleRight = obstacleModels[modelType].clone();
            obstacleRight.position.set(lanes[pos2], obstacleSpawnY, 0);
            obstacleRight.visible = true;

            obstacle.occupiedLanes = [pos1, pos2];
            obstacle.add(obstacleLeft);
            obstacle.add(obstacleRight);
        }

        return obstacle;
    }

    /**
     * Return random lane index
     */
    function randLane(lane = null) {
        let newLane = Math.floor(Math.random() * numLanes);
        if(newLane == lane) {
            return randLane(lane);
        }
        else {
            return newLane;
        }

    }

    function update() {
        // Spawn obstacle if time elapsed is bigger than the interval specified
        if(obstacleIntervalClock.getElapsedTime() > obstacleInterval) {
            obstacleIntervalClock.start(); // Restart obstacle timer
            spawnObstacle();
        }

        if(!introAnim) {
            // Increase speed if time elapsed is bigger than the interval specified
            if(speedIntervalClock.getElapsedTime() > increaseSpeedInterval) {
                speedIntervalClock.start(); // Restart speed timer
                if(increaseSpeedInterval > 1) {
                    increaseSpeedInterval -= 0.5;
                }
                if(obstacleInterval > (3 * increaseSpeed)) {
                    obstacleInterval -= 2 * increaseSpeed;
                }
                speed += increaseSpeed;
            }
        }
        updateObstacles();

        render();

        if(playing || introAnim) {
            requestAnimationFrame(update);
        }
    }

    function stop() {
        speedIntervalClock.stop();
        obstacleIntervalClock.stop();
        playing = false;
    }

    function updateObstacles() {
        let obstacle;
        let obstaclePos = new THREE.Vector3();
        let removeObstacles = [];

        if(introAnim && obstacles.length) {
            let nextObstacle = obstacles[0];
            let laneIdx = lanes.indexOf(currentLane);
            if(nextObstacle.position.z > 0 && nextObstacle.occupiedLanes.includes(laneIdx)) {
                let availableLanes = [0, 1, 2, 3, 4];
                availableLanes = availableLanes.filter(lane => !nextObstacle.occupiedLanes.includes(lane));
                
                let dst = Math.abs(laneIdx - availableLanes[0]);
                currentLane = lanes[availableLanes[0]];
                for(let al of availableLanes) {
                    if(Math.abs(laneIdx - al) < dst) {
                        dst = Math.abs(laneIdx - al);
                        currentLane = lanes[al];
                    }
                    else if(Math.abs(laneIdx - al) == dst) {
                        if(Math.random() > 0.5) {
                            dst = Math.abs(laneIdx - al);
                            currentLane = lanes[al];
                        }
                    }
                }

                animate(-1, char.position.x, currentLane, 1, 0, 0.2);
            }
        }

        // Loop through obstacles
        obstacles.forEach(function(obstacle) {
            obstacle.position.z += speed;
            obstaclePos.setFromMatrixPosition(obstacle.matrixWorld);

            // Map x position between 7 and 0 from z -20 to 10 to get curved movement
            // using sine for easing
            if(obstacle.position.z < 10) {
                let offset = mapValue(obstacle.position.z, obstacleSpawnZ, 10.0, 0.0, 90.0) * (Math.PI / 180);
                let posX = obstacleSpawnX - mapValue(Math.sin(offset), 0.0, 1.0, 0.0, obstacleSpawnX);
                obstacle.position.x = posX;
            }

            // Check for colliding obstacles
            let objPos = new THREE.Vector3();
            let charPos = new THREE.Vector3();
            for(let obj of obstacle.children) {
                if(obj.getWorldPosition(objPos).distanceTo(char.getWorldPosition(charPos)) < heroSize - 0.1) {
                    stop();
                }
            }

            // Remove obstacles out of camera view
            if(obstaclePos.z > heroPosZ + 5 && obstacle.visible) {
                removeObstacles.push(obstacle);
            }
        });

        let i;
        removeObstacles.forEach(function(obj, index) {
            obstacle = removeObstacles[index];
            i = obstacles.indexOf(obstacle);

            obstacles.splice(i, 1);
            scene.remove(obstacle);

            score++;
            scoreText.innerHTML = score;
        });
    }

    function keydownHandler(event) {
        if(playing && !introAnim) {
            if(event.keyCode == 37 || event.keyCode == 65) { // left arrow || a
                if(currentLane > left) { // animate cube to left
                    currentLane -= laneWidth;
                    animate(1, char.position.x, currentLane, 1, 0, 0.2);
                }
            }
            else if(event.keyCode == 39 || event.keyCode == 68) { // right arrow || d
                if(currentLane < right) { // animate cube to right
                    currentLane += laneWidth;
                    animate(-1, char.position.x, currentLane, 1, 0, 0.2);
                }
            }
        }
    }

    /**
     * Animate character from one lane to another
     */
    function animate(duration, start, end, duration, time, steps) {
        var newX = lerp(start, end, ease(duration, time));
        char.position.x = newX;
        char.rotation.y = Math.sin(mapValue(newX, end + (duration * laneWidth), end, 0, 180) * Math.PI / 180);
        time += steps;

        render();

        if(time < duration && (playing || introAnim)) {
            requestAnimationFrame(function() {
                animate(duration, newX, end, duration, time, steps);
            });
        }
        else {
            char.position.x = currentLane;
            char.rotation.y = 0;
        }
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    // quad easeInOut
    function ease(d, t) { return t < (d * 0.5) ? 2*t*t : -1+(4-2*t)*t; }

    function mapValue(number, in_min, in_max, out_min, out_max) {
        return (number - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
    }

    function render() {
        renderer.render(scene, camera);
    }

    init();
});