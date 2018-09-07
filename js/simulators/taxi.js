/**
 *  Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *  
 *      http://www.apache.org/licenses/LICENSE-2.0
 *  
 *  or in the "license" file accompanying this file. This file is distributed 
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either 
 *  express or implied. See the License for the specific language governing 
 *  permissions and limitations under the License.
 */
Playground.registerSimulation({
	name: 'taxi',
	order: 1,
	displayName: 'Taxi Sandbox',
	description: 'Train your own emulator based on a taxi simulator.',
	image: 'img/taxisim.png',
}, function (container, options) {

	// Ensure dependencies are present
	if (window.Playground == undefined) new Error('Playground.js must be included first');
	if (window.THREE == undefined) new Error('THREE.js is required');

	/* 
     * Global options 
     */

	/**
     * The inputs of the simulator
     */
	var inputs = {
		/**
         * The number of roads (there are gridSize * gridSize blocks)
         */
		gridSize: {
			displayName: '@numRoads/title',
			description: '@numRoads/description',
			value: 5,
			previous: undefined,
			min: 3,
			max: 10,
			onchange: function () {
				calculateGridMetrics();
				disposeObjects(taxis);
				setupScene();
				for (var i = 0; i < inputs.taxiCount.value; i++) {
					if (taxis.length > getMaxJourneys()) { this.value = taxis.length; return; }
					taxis.push(new Taxi(getRandomRoad()));
				}
			}
		},
		/**
         * The number of taxis
         */
		taxiCount: {
			displayName: '@numTaxis/title',
			description: '@numTaxis/description',
			value: 20,
			previous: undefined,
			min: 1,
			max: 100,
			onchange: function () {
				if (taxis != undefined) {
					while (taxis.length > this.value) {
						var rTaxi = taxis[rand(taxis.length)];
						rTaxi.dispose();
					}
					while (taxis.length < this.value) {
						if (taxis.length > getMaxJourneys()) { this.value = taxis.length; return; }
						taxis.push(new Taxi(getRandomRoad()));
					}
				}
			}
		},
		/**
         * The frequency of journeys being spawned
         */
		journeyFrequency: {
			displayName: '@journeyFrequency/title',
			description: '@journeyFrequency/description',
			value: 50,
			previous: undefined,
			adjVal: 26,
			onchange: function () {
				this.adjVal = Math.ceil(((1 / 100) * Math.pow(this.value - 100, 2) + 1));
			},
			min: 1,
			max: 100
		},
		/**
         * The base taxi fare
         */
		baseFare: {
			displayName: '@baseFare/title',
			description: '@baseFare/description',
			value: 5,
			min: 0,
			max: 15
		},
		/**
         * Cost per tile
         */
		costPerTile: {
			displayName: '@costPerTile/title',
			description: '@costPerTile/description',
			min: 1,
			max: 20,
			value: 5
		},
		/**
         * The maximum multiplier charged at peak times
         */
		maxMultiplier: {
			displayName: '@maxMultiplier/title',
			description: '@maxMultiplier/description',
			min: 1,
			max: 3,
			step: 0.1,
			valueFormat: (v) => v.toFixed(1),
			value: 2
		},
		/**
         * The simulation speed
         */
		speed: {
			hidden: true,
			value: 90,
			previous: undefined,
			adjVal: 2,
			onchange: function () {
				this.adjVal = Math.ceil(((1 / 200) * Math.pow(this.value - 100, 2) + 1));
			},
			min: 1,
			max: 100
		}
	};

	/**
     * The outputs of the simulator
     */
	var outputs = {
		/**
         * The profit generated during the simulation
         */
		profit: {
			displayName: '@profit/title',
			value: 0,
			toString: function () {
				// Display as $### if under $1000, or $#.#k if over
				if (this.value < -1000) return '-$' + Math.abs((this.value / 1000).toFixed(1)) + 'k';
				else if (this.value < 0) return '-$' + Math.abs(this.value.toFixed(2));
				else if (this.value < 1000) return '$' + this.value.toFixed(2);
				else return '$' + (this.value / 1000).toFixed(1) + 'k';
			},
			variance: 5000
		},
		/**
         * The number of customers missed at the end of the simulation
         */
		missed: {
			displayName: '@customersMissed/title',
			value: 0,
			toString: function () {
				return this.value;
			},
			variance: 80
		},
		/**
         * The average time it takes for a taxi to pick a passenger up
         */
		pickUpTime: {
			displayName: '@meanPickUpTime/title',
			value: 0,
			toString: function () {
				return this.value.toFixed() + ' mins';
			},
			variance: 20
		},
		/**
         * The number of completed journeys
         */
		journeysCompleted: {
			displayName: '@journeysCompleted/title',
			value: 0,
			toString: function () {
				return this.value;
			},
			variance: 200
		},
		/**
         * The profit per journey
         */
		profitPerJourney: {
			displayName: '@profitPerJourney/title',
			value: 0,
			toString: function () {
				return '$' + this.value.toFixed(2);
			},
			variance: 20,
		},
		/**
         * The progress of the simulation (hidden from outputs)
         */
		simulationProgress: {
			hidden: true,
			value: 0,
			toString: function () {
				return this.value.toFixed();
			}
		}
	};

	// Colors
	var sceneBackgroundColor = 0x26c6da;
	var sidewalkColor = 0x9e9e9e;
	var startJourneyColor = 0x3d5afe;
	var endJourneyColor = 0xf44336;

	// Grid configuration
	var defaultRoadWidth = 2;
	var defaultRoadLength = 10;

	/*
     * Internal vars
     */
	var scene, camera, renderer, controls, paused = false,
		simulationRunning = false,
		terminated = false,
		geometries = {},
		loader, loadingManager, grid = {},
		taxis = [],
		journeys = [],
		journeyQueue = [],
		grossProfit = 0,
		ticks = 0,
		callTick = 0,
		clock = 0,
		carry = 0,
		resizeEvent, pickupsCompleted = 0,
		maxSteps = options.maxSteps || 10000,
		materials = {
			sidewalk: generateMesh(sidewalkColor),
			startJourney: generateMesh(startJourneyColor),
			endJourney: generateMesh(endJourneyColor)
		};

	var roadWidth = defaultRoadWidth,
		roadLength = defaultRoadLength,
		roadSize = roadWidth + roadLength,
		gridWidth = (roadWidth * inputs.gridSize.value) + (roadLength * (inputs.gridSize.value - 1)) + 2;


	/*
     * Helper functions
     */

	/**
     * Get the maximum number of journeys allowed given the current inputs
     */
	function getMaxJourneys() {
		return (inputs.gridSize.value - 1) * 4 * roadLength;
	}

	/**
     * Bredth first search
     * @param {Position} origin the start position
     * @param {Position} destination the destination position
     */
	function bfs(origin, destination) {
		var queue = [],
			visited = {};

		// Add the origin position to the queue
		queue.push({
			position: origin,
			path: []
		});

		while (queue.length > 0) {
			var pos = queue[0].position;
			var valid = pos.getValidMoves();

			if (pos.x == destination.x && pos.z == destination.z) {
				// We have reached the destination
				var path = queue[0].path;
				path.push(pos);
				// Splice the origin from the path
				path = path.splice(1);
				return path;
			}

			// Append this position to the path
			var nPath = Array.from(queue[0].path);
			nPath.push(pos);

			// If there are valid moves, add them to the queue
			if (valid.x != 0) {
				let nPos = pos.getRelativePosition(valid.x, 0);
				if (!visited[nPos.toString()]) {
					queue.push({
						position: nPos,
						path: nPath
					});
					visited[nPos.toString()] = true;
				}
			}
			if (valid.z != 0) {
				let nPos = pos.getRelativePosition(0, valid.z);
				if (!visited[nPos.toString()]) {
					queue.push({
						position: nPos,
						path: nPath
					});
					visited[nPos.toString()] = true;
				}
			}
			queue = queue.splice(1);
		}

		// No path was found
		return [];
	}

	/**
     * Convert a collada scene into a collection of geometries and materials
     * @param {ColladaScene} collada the collada scene
     * @param {Number} scale the relative scale of the object
     */
	function colladaToGeometryMaterial(collada, scaleX = 1, scaleY = scaleX, scaleZ = scaleX) {
		var result = [];

		// For each child object in the collada scene
		collada.scene.children.forEach(function (model) {
			// Get and scale the geometry
			var geometry = model.geometry;
			geometry.scale(scaleX, scaleY, scaleZ);
			// Translate the geometry such that 0, 0 corrosponds to 

			// Create the material from the map
			var material = new THREE.MeshStandardMaterial({
				map: model.material.map,
				roughness: 1,
				metalness: 0
			});
			material.map.magFilter = THREE.NearestFilter;

			// Push to the result array
			result.push({
				geometry: geometry,
				material: material
			});
		});

		return result;
	}

	/**
     * Spawn static scenery in the scene
     * @param {String} name the name of the object
     * @param {Number} rotation the rotation in radians
     * @param {Number} x the x position of the object
     * @param {Number} z the z position of the object
     */
	function spawnScenery(name, x, z, rotation = 0) {
		var mesh = new THREE.Mesh(geometries[name], materials[name]);
		mesh.position.set(x, 0, z);
		mesh.rotation.set(0, rotation, 0);
		scene.add(mesh);
		return mesh;
	}

	/**
     * Spawn a vehicle instance in the scene
     * @param {String} name the name of the vehicle object
     * @param {Position} position the starting position of the vehicle
     */
	function spawnVehicle(name, position) {
		var mesh = new THREE.Mesh(geometries[name], materials[name]);
		var scenePos = position.getScenePosition();
		mesh.position.set(scenePos.x, 0, scenePos.z);
		scene.add(mesh);
		return mesh;
	}

	/**
     * 
     * @param {String} material the name of the material
     * @param {Position} position the position to spawn the marker at
     */
	function spawnMarker(material, position) {
		var mesh = new THREE.Mesh(geometries.marker, materials[material]);
		var scenePos = position.getScenePosition();
		var posX = scenePos.x + ((position.x % roadSize == 0) ? .3 : -.3);
		var posZ = scenePos.z + ((position.z % roadSize == 0) ? .3 : -.3);
		mesh.position.set(posX, 0, posZ);
		scene.add(mesh);
		return mesh;
	}

	/**
     * Calculates the grid metrics based on the grid size
     */
	function calculateGridMetrics() {
		roadSize = roadLength + roadWidth;
		gridWidth = (roadWidth * inputs.gridSize.value) + (roadLength * (inputs.gridSize.value - 1)) + 2;
	}

	/**
     * Calculates the road tile next to a sidewalk
     * @param {Position} sidewalk the sidewalk position
     */
	function calculateAdjacentRoadTile(sidewalk) {
		var xMod = sidewalk.x % roadSize,
			zMod = sidewalk.z % roadSize;

		var tileX = sidewalk.x,
			tileZ = sidewalk.z;

		if (xMod == 0) tileX++;
		if (xMod == roadWidth + 1) tileX--;
		if (zMod == 0) tileZ++;
		if (zMod == roadWidth + 1) tileZ--;

		return new Position(tileX, tileZ);
	}

	/**
     * Generate a standard material mesh with a given color
     * @param {Number} color the color of the mesh
     */
	function generateMesh(color) {
		return new THREE.MeshStandardMaterial({
			color: color,
			refractionRatio: 0.0,
			roughness: 1,
			metalness: 0
		});
	}

	/**
     * Removes an object from the scene
     */
	function removeFromScene(object) {
		if (object.children.length > 0) {
			object.children.forEach(function (child) {
				removeFromScene(child);
			});
		}
		scene.remove(object);
	}

	/**
     * Generates a random number between min and max
     * @param {Number} max 
     * @param {Number} min 
     */
	function rand(max, min = 0) {
		return Math.floor(min + Math.random() * (max - min));
	}

	function eventOccurs(value, max) {
		var r = Math.random();
		value /= max;
		return value > r;
	}

	/**
     * Generates a random unoccupied position on a sidewalk
     */
	function getRandomSidewalk() {
		var p1 = roadSize * rand(inputs.gridSize.value) + 3 * rand(2);
		var p2 = 3 + roadSize * rand(inputs.gridSize.value - 1) + rand(roadLength);

		var position;

		if (rand(2) == 0) {
			position = new Position(p1, p2);
		} else {
			position = new Position(p2, p1);
		}

		if (position.isOccupied()) return getRandomSidewalk();
		position.setOccupied(true);
		return position;
	}

	/**
     * Generates a random unoccupied position on a road
     */
	function getRandomRoad() {
		var p1 = roadSize * rand(inputs.gridSize.value) + rand(3, 1);
		var p2 = 3 + roadSize * rand(inputs.gridSize.value - 1) + rand(roadLength);

		var position;

		if (rand(2) == 0) {
			position = new Position(p1, p2);
		} else {
			position = new Position(p2, p1);
		}

		if (position.isOccupied()) return getRandomRoad();
		position.setOccupied(true);
		return position;
	}

	/**
     * Clears the scene
     */
	function clearScene() {
		while (scene.children.length > 0) {
			removeFromScene(scene.children[0]);
		}
	}

	/**
     * Disposes of an array or object
     * @param {Array | Object} a 
     */
	function disposeObjects(a) {
		if (!Array.isArray(a)) {
			Object.keys(a).forEach(function (k) {
				a[k].dispose();
			});
		} else {
			while (a.length > 0) {
				a[0].dispose();
			}
		}
	}

	/* 
     * Classes
     */
	class Position {

		constructor(x, z) {
			this.x = x;
			this.z = z;
		}

		/**
         * Gets the valid moves from this position
         */
		getValidMoves() {
			var xMod = this.x % roadSize,
				zMod = this.z % roadSize;

			var valid = {
				x: 0,
				z: 0
			};

			if (xMod == 1) valid.z++;
			if (xMod == 2) valid.z--;
			if (zMod == 1) valid.x--;
			if (zMod == 2) valid.x++;

			// Fix grid edges
			if ((this.x == 1 && valid.x == -1) || (this.x == gridWidth - 2 && valid.x == 1)) valid.x = 0;
			if ((this.z == 1 && valid.z == -1) || (this.z == gridWidth - 2 && valid.z == 1)) valid.z = 0;

			return valid;
		}

		/**
         * Gets the corrosponding position in the scene
         */
		getScenePosition() {
			return {
				x: this.x + .5 - gridWidth / 2,
				z: this.z + .5 - gridWidth / 2
			};
		}

		/**
         * Convert the position to a string of the form "X_Z"
         */
		toString() {
			return this.x + '_' + this.z;
		}

		/**
         * Returns true if this grid space is occupied
         */
		isOccupied() {
			return grid[this.toString()];
		}

		/**
         * Returns the straight line distance to another position
         * @param {Position} position 
         */
		distanceTo(position) {
			return Math.abs(Math.sqrt(
				Math.pow(position.x - this.x, 2) +
                Math.pow(position.z - this.z, 2)
			));
		}

		/**
         * Returns the Manhattan distance to another position
         */
		manhattan(position) {
			return Math.abs(position.x - this.x) + Math.abs(position.z + this.z);
		}


		/**
         * Sets if this position is occupied
         * @param {boolean} value 
         */
		setOccupied(value) {
			if (typeof value != 'boolean') return;
			grid[this.toString()] = value;
		}

		/**
         * Returns true if the position matches this position
         * @param {Position} position 
         */
		equals(position) {
			return this.x == position.x && this.z == position.z;
		}

		/**
         * Gets an instance of a position relative to this one
         * @param {Number} x the relative x distance
         * @param {Number} z the relative z distance
         */
		getRelativePosition(x, z) {
			return new Position(this.x + x, this.z + z);
		}

	}

	/**
     * Taxi class
     * Handles taxi functionality
     */
	class Taxi {

		constructor(position) {
			this.position = position;
			this.available = true;
			this.path = [];
			this.moving = false;
			this.lastPosition = this.position;
			this.stopped = 0; // Measures how long the taxi has been stationary for

			this.journeysCompleted = 0;

			// Create taxi in scene
			this.object = spawnVehicle('taxi', position);

		}

		/**
         * Generates a path to the destination and starts following
         * @param {Position} destination 
         * @param {Function} cb 
         */
		goto(destination, cb) {
			this.path = bfs(this.position, destination);
			this.cb = cb;
			if (this.position.equals(destination)) this.finishRoute();
		}

		/**
         * Triggers the journey end callback and finds another journey
         */
		finishRoute() {
			if (this.cb != undefined) this.cb();
			if (this.available && journeyQueue.length > 0) journeyQueue[0].search();
		}

		/**
         * The new position
         * @param {Position} newPosition 
         */
		setPosition(newPosition) {

			if (newPosition.isOccupied()) {
				this.moving = false;
				return false;
			}

			this.moving = true;
			this.stopped = 0;

			this.lastPosition = this.position;

			this.lastPosition.setOccupied(false);

			// Calculate direction travelled for rotation
			var dX = newPosition.x - this.position.x,
				dZ = newPosition.z - this.position.z,
				r = 0;

			if (dX == 1) r = 1;
			if (dZ == -1) r = 2;
			if (dX == -1) r = 3;
			this.object.rotation.set(0, r * .5 * Math.PI, 0);

			newPosition.setOccupied(true);
			this.position = newPosition;

			var pos = newPosition.getScenePosition();

			this.object.position.x = pos.x;
			this.object.position.z = pos.z;

			return true;
		}

		/**
         * Remove the taxi 
         */
		dispose() {
			removeFromScene(this.object);
			this.position.setOccupied(false);
			taxis.splice(taxis.indexOf(this), 1);
		}

		/**
         * Called upon simulation tick
         */
		update() {
			if (this.path.length > 0) {
				// Go along the path
				if (this.setPosition(this.path[0])) {
					this.path = this.path.splice(1);
					if (this.path.length == 0) this.finishRoute();
				} else {
					// Traffic jam resolution
					// If the taxi is stopped for more than 3 steps, try to reroute
					if (this.stopped >= 3) {
						let valid = this.position.getValidMoves();

						// Try to move in a direction
						var moved = this.setPosition(this.position.getRelativePosition(valid.x, 0));
						if (!moved) {
							moved = this.setPosition(this.position.getRelativePosition(0, valid.z));
						}

						if (moved) {
							this.path = bfs(this.position, this.path[this.path.length - 1]);
						}
					} else {
						this.stopped++;
					}
				}
			} else {
				let valid = this.position.getValidMoves();
				var moveX = true; // Assume we want to move in the x axis
				if (valid.x == 0) {
					moveX = false; // We can't move in the x axis, move z
				} else if (valid.z != 0) {
					var rnd = Math.random(); // We can move x or z, move randomly in one direction
					moveX = rnd >= .5;
				}

				// Apply the move
				if (moveX) this.setPosition(this.position.getRelativePosition(valid.x, 0));
				else this.setPosition(this.position.getRelativePosition(0, valid.z));
			}
		}

	}

	/**
     * Journey class
     * Handles the functionality of a journey
     */
	class Journey {

		constructor(origin, destination) {
			this.origin = origin;
			this.destination = destination;

			// Cancel journey if price is too high
			var B  = inputs.baseFare.value
				, Bh = inputs.baseFare.max / 2
				, C  = inputs.costPerTile.value
				, Ch = inputs.costPerTile.max / 2
				, Cd = 1 - ((C-Ch) / Bh)
				, M  = inputs.maxMultiplier.value
				, Mh = inputs.maxMultiplier.max
				, Mp = .9*M/Mh;
            
			var cancel = (B > Bh && eventOccurs(B - Bh + Cd * Mp, Bh))
                      || (C > Ch && eventOccurs(C - Ch + Cd * Mp, Ch));
            
			if (!cancel) {
				// Spawn a start and end marker
				this.startMarker = spawnMarker('startJourney', origin);
				this.endMarker = spawnMarker('endJourney', destination);

				this.startTime = clock;

				this.search();
			} else {
				this.dispose();
			}
		}

		/**
         * Estimates the price of the journey based on distance
         */
		calculatePriceEstimate() {
			var p = journeyQueue.length / getMaxJourneys();
			var multiplier = p * p * (inputs.maxMultiplier.value - 1) + 1;
			return multiplier * inputs.costPerTile.value;
		}

		/**
         * Search for an available taxi
         */
		search() {
			// Remove this journey from the backlog
			var index = journeyQueue.indexOf(this);
			if (index >= 0) journeyQueue.splice(i, 1);

			// Find the closest available taxi taxi
			var min = Number.POSITIVE_INFINITY;
			var taxiIndex = -1;

			for (var i = 0; i < taxis.length; i++) {
				if (taxis[i].available == false) continue;

				var dist = taxis[i].position.distanceTo(this.origin);
				if (dist < min) {
					min = dist;
					taxiIndex = i;
				}
			}

			// Re-add this taxi to the queue if there are no available taxis
			if (taxiIndex == -1) {
				journeyQueue.push(this);
				return;
			}

			// Tell the taxi to pick up this journey
			this.taxi = taxis[taxiIndex];

			var road = calculateAdjacentRoadTile(this.origin);
			this.taxi.available = false;
			this.taxi.goto(road, this.pickupCallback.bind(this));
		}

		/**
         * Callback when a passenger is picked up
         */
		pickupCallback() {
			// Remove the start marker from the scene
			removeFromScene(this.startMarker);
			this.startMarker = undefined;
			this.origin.setOccupied(false);

			// Calculate the destination position the taxi should travel to
			var road = calculateAdjacentRoadTile(this.destination);
			this.taxi.goto(road, this.endJourney.bind(this));

			// Update the pickup time output
			this.pickupTime = clock;
			var diff = this.pickupTime - this.startTime;
			var newAvg = (outputs.pickUpTime.value * pickupsCompleted + diff) / (pickupsCompleted + 1);
			setOutput('pickUpTime', newAvg);
			pickupsCompleted++;
		}

		/**
         * Callback when a passenger reaches the destination
         */
		endJourney() {
			removeFromScene(this.endMarker);
			this.endMarker = undefined;
			this.destination.setOccupied(false);
			this.taxi.available = true;

			this.endTime = clock;
			var diff = this.endTime - this.pickupTime;
			var maxCost = inputs.maxMultiplier.value;
			var easing = function (t) {
				return t * t;
			};
			var currency = inputs.costPerTile.value / 10;
			var extra = diff * easing(journeyQueue.length / getMaxJourneys()) * (maxCost - 1);
			var profit = inputs.baseFare.value + (diff + extra) * currency;

			modifyOutput('profit', profit);
			grossProfit += profit;

			modifyOutput('journeysCompleted', 1);
			setOutput('profitPerJourney', grossProfit / outputs.journeysCompleted.value);

			journeys.splice(journeys.indexOf(this), 1);
		}

		/**
         * Called on simulation tick
         */
		update() {
			// Scale up the size of the start and end markers
			var diff = clock - this.startTime;
			var newY = 1 + (3 * diff / 500);
			if (this.startMarker != undefined) {
				this.startMarker.scale.y = newY;
				this.startMarker.position.y = (newY) / 1.6 - .22;
			}
			if (this.endMarker != undefined) {
				this.endMarker.scale.y = newY;
				this.endMarker.position.y = (newY) / 1.6 - .22;
			}
		}

		/**
         * Dispose of a taxi
         */
		dispose() {
			// Update the taxi state
			if (this.taxi != undefined) {
				this.taxi.available = true;
				this.taxi.path = [];
			}

			// Increment the 'missed' output
			modifyOutput('missed', 1);

			// Remove the start and end markers if applicable
			if (this.startMarker != undefined) {
				removeFromScene(this.startMarker);
			}
			if (this.endMarker != undefined) {
				removeFromScene(this.endMarker);
			}

			this.origin.setOccupied(false);
			this.destination.setOccupied(false);

			// Remove this journey from the backlog
			var journeyIndex = journeys.indexOf(this);
			if (journeyIndex >= 0) journeys.splice(journeyIndex, 1);
			else {
				// Ensure it isn't added after the constructor has yielded
				setTimeout(() => {
					journeyIndex = journeys.indexOf(this);
					if (journeyIndex >= 0) journeys.splice(journeyIndex, 1);
				}, 1000);
			}
			var queueIndex = journeyQueue.indexOf(this);
			if (queueIndex >= 0) journeyQueue.splice(queueIndex, 1);
		}

	}

	/*
     * Setup
     */
	loadingManager = new THREE.LoadingManager(function () {
		init();
	});

	// Load the collada models
	loader = new THREE.ColladaLoader(loadingManager);

	/**
     * Loads a collada model from a file
     * @param {String} file the file location
     * @param {String} name the name of the model
     * @param {Number|Object} [scale] the relative scale of to load the model
     * @param {Object} [translate] the translation to the origin that should be applied to the loaded geometry
     */
	function loadModel(file, name, scale = 1, translate) {
		if (typeof scale == 'number') {
			scale = {
				x: scale,
				y: scale,
				z: scale
			};
		}
		loader.load(file, function (collada) {
			var model = colladaToGeometryMaterial(collada, scale.x, scale.y, scale.z)[0];
			geometries[name] = model.geometry;
			materials[name] = model.material;

			if (translate != undefined) {
				geometries[name].translate(translate.x || 0, translate.y || 0, translate.z || 0);
			}
		});
	}

	loadModel('./models/taxi/Taxi.dae', 'taxi', 0.08, {
		x: 0.04,
	});
	loadModel('./models/taxi/RoadEnd.dae', 'roadEnd', {
		x: 0.08,
		y: 0.1,
		z: 0.08
	}, {
		y: -.28,
		z: -.04
	});
	loadModel('./models/taxi/RoadIntersection.dae', 'roadIntersection', {
		x: 0.08,
		y: 0.1,
		z: 0.08
	}, {
		y: -.28,
		z: -.04
	});
	loadModel('./models/taxi/RoadStraight.dae', 'roadStraight', {
		x: 0.08,
		y: 0.1,
		z: 0.08
	}, {
		y: -.28,
		z: -.04
	});
	loadModel('./models/taxi/Park.dae', 'park', 0.1, {
		y: 4.57
	});

	/**
     * Sets up the Three.js scene, renderer, camera and controls
     */
	function setupThree() {
		// Setup THREE.js
		scene = new THREE.Scene();
		scene.background = new THREE.Color(sceneBackgroundColor);
		camera = new THREE.PerspectiveCamera(75, container.offsetWidth / container.offsetHeight, 0.1, 1000);
		renderer = new THREE.WebGLRenderer({
			antialias: true
		});
		renderer.setSize(container.offsetWidth, container.offsetHeight);
		renderer.domElement.id = 'canvas';
		container.appendChild(renderer.domElement);
		camera.position.set(1, 1, 1);
		camera.lookAt(scene.position);
		camera.position.set(40, 40, 40);
		controls = new THREE.OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.mouseButton = {
			PAN: THREE.MOUSE.RIGHT,
			ZOOM: THREE.MOUSE.MIDDLE,
			ORBIT: THREE.MOUSE.LEFT
		};

		// Handle resizing window
		resizeEvent = function () {
			camera.aspect = container.offsetWidth / container.offsetHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(container.offsetWidth, container.offsetHeight);
		};

		window.addEventListener('resize', resizeEvent);
	}

	/**
     * Sets up the scene
     */
	function setupScene() {
		clearScene();

		// Setup scene lighting
		var light = new THREE.DirectionalLight(0xefefff, 1);
		light.position.set(10, 20, -5).normalize();
		scene.add(light);
		var backlight = new THREE.DirectionalLight(0xffefef, 0.6);
		backlight.position.set(-10, 20, 5).normalize();
		scene.add(backlight);

		// Setup roads
		var gridStartX = -gridWidth / 2 + 2;
		var gridStartZ = -gridWidth / 2 + 2;
		for (let x = 0; x < gridWidth - 2; x += 2) {
			for (let z = 0; z < gridWidth - 2; z += 2) {
				let xMod = x % roadSize,
					zMod = z % roadSize;

				// Continue if a road shouldn't be placed here
				if (xMod != 0 && zMod != 0) continue;

				let gX = gridStartX + x,
					gZ = gridStartZ + z;
				if (xMod == 0 && zMod == 0) {
					spawnScenery('roadIntersection', gX, gZ);
				} else if (xMod == 0 && zMod == 2) {
					spawnScenery('roadEnd', gX, gZ, Math.PI);
				} else if (xMod == 0 && zMod >= roadSize - roadWidth) {
					spawnScenery('roadEnd', gX, gZ);
				} else if (xMod == 2 && zMod == 0) {
					spawnScenery('roadEnd', gX, gZ, 3 * Math.PI / 2);
				} else if (xMod >= roadSize - roadWidth && zMod == 0) {
					spawnScenery('roadEnd', gX, gZ, Math.PI / 2);
				} else if (xMod == 0) {
					spawnScenery('roadStraight', gX, gZ);
				} else if (zMod == 0) {
					spawnScenery('roadStraight', gX, gZ, Math.PI / 2);
				}
			}
		}
		// Create outer sidewalk
		geometries.sidewalk = new THREE.BoxGeometry(0.4, 0.2, gridWidth - 1.2);
		geometries.sidewalk.translate(0, -.33, 0);
		spawnScenery('sidewalk', gridWidth / 2 + .2 - 1, 0);
		spawnScenery('sidewalk', -gridWidth / 2 + .8, 0);
		spawnScenery('sidewalk', 0, gridWidth / 2 + .2 - 1, Math.PI / 2);
		spawnScenery('sidewalk', 0, -gridWidth / 2 + .8, Math.PI / 2);

		geometries.marker = new THREE.BoxGeometry(0.4, 1, 0.4);
		geometries.marker.translate(0, .25 - .38, 0);

		// Setup blocks
		var blockStartX = -gridWidth / 2 + (roadSize / 2) + 2;
		var blockStartZ = -gridWidth / 2 + (roadSize / 2) + 2;
		for (let x = 0; x < inputs.gridSize.value - 1; x++) {
			for (let z = 0; z < inputs.gridSize.value - 1; z++) {
				var r = Math.floor(Math.random() * 4);
				let gX = blockStartX + x * roadSize;
				let gZ = blockStartZ + z * roadSize;
				spawnScenery('park', gX, gZ, r * .5 * Math.PI);
			}
		}
	}

	/**
     * Initial setup function
     */
	function init() {
		setupThree();
		setupScene();

		setTimeout(innerClock, 1);

		animate();
	}

	/**
     * Internal clock used to manage steps
     */
	function innerClock() {
		if (terminated) return;
		if (!paused) {
			ticks++;
			if (ticks >= inputs.speed.adjVal) {
				ticks = 0;
				simulationStep();
			}
		}
		setTimeout(innerClock, 1);
	}

	/**
     * Called to run a single simulation step
     */
	function simulationStep() {
		taxis.forEach(function (taxi) {
			taxi.update();
		});
		if (simulationRunning) {
			clock++;

			journeys.forEach(function (journey) {
				journey.update();
			});

			if (Math.round(clock * 100 / maxSteps) != outputs.simulationProgress.value) {
				setOutput('simulationProgress', Math.round(clock * 100 / maxSteps));
			}

			if (clock >= maxSteps) {
				finishSimulation();
			} else {
				callTick++;
				if (callTick >= 10) {
					callTick = 0;
					var adj = inputs.journeyFrequency.value / 10;
					var i = Math.floor(adj);
					carry += adj - i;

					while (Object.keys(journeys).length < getMaxJourneys() && i > 0) {
						journeys.push(new Journey(getRandomSidewalk(), getRandomSidewalk()));
						i--;
					}

					while (Object.keys(journeys).length < getMaxJourneys() && carry > 1) {
						journeys.push(new Journey(getRandomSidewalk(), getRandomSidewalk()));
						carry--;
					}
				}

				modifyOutput('profit', -.1 * inputs.taxiCount.value);
			}
		}

		window.grid = grid;
	}

	/**
     * Starts a simulation run
     */
	function startSimulation() {
		// Clear outputs
		clock = 0;
		Object.keys(outputs).forEach(function (o) {
			outputs[o].value = 0;
		});
		pickupsCompleted = 0;
		grossProfit = 0;
		disposeObjects(journeys);

		simulationRunning = true;
	}

	/**
     * Sets the internal state to finished once a simulation run has completed
     */
	function finishSimulation() {
		simulationRunning = false;

		disposeObjects(journeys);

		notifyFinish();
	}

	/**
     * The animation loop
     */
	function animate() {
		if (terminated) return;

		// Interpolate cars if they are between simulation steps
		taxis.forEach(function (taxi) {
			if (taxi.moving) {
				var scenePosStart = taxi.lastPosition.getScenePosition();
				var scenePosEnd = taxi.position.getScenePosition();

				var dX = scenePosEnd.x - scenePosStart.x;
				var dZ = scenePosEnd.z - scenePosStart.z;

				var frameProgress = ticks / inputs.speed.adjVal;

				var nX = scenePosStart.x + dX * frameProgress;
				var nZ = scenePosStart.z + dZ * frameProgress;

				taxi.object.position.x = nX;
				taxi.object.position.z = nZ;
			}
		});

		// Check if the inputs have changed
		checkInputs();

		// Update controls and renderer
		controls.update();
		renderer.render(scene, camera);

		requestAnimationFrame(animate);
	}

	/**
     * Sets an input to a given value
     * @param {String} key the key of the input
     * @param {Number} value the new value
     */
	function setValue(key, value) {
		inputs[key].value = Number.parseFloat(value);
	}

	/**
     * Sets an output to a given value
     * @param {String} key the key of the output
     * @param {Number} value the new value
     */
	function setOutput(key, value) {
		outputs[key].value = value;
		if (typeof (options.onOutputsUpdated) == 'function') options.onOutputsUpdated(outputs);
	}

	/**
     * Adds a given delta to the value of an output
     * @param {String} key the key of the output
     * @param {Number} delta the change in value
     */
	function modifyOutput(key, delta) {
		outputs[key].value += delta;
		if (typeof (options.onOutputsUpdated) == 'function') options.onOutputsUpdated(outputs);
	}

	/**
     * Notifies the Playground once a simulation run has been completed
     */
	function notifyFinish() {
		if (typeof (options.onFinish) == 'function') options.onFinish();
	}

	/**
     * Checks for input changes
     */
	function checkInputs() {
		var keys = Object.keys(inputs);

		keys.forEach(function (key) {
			if (inputs[key].value != inputs[key].previous) {
				if (typeof (inputs[key].onchange) == 'function') inputs[key].onchange();
				inputs[key].previous = inputs[key].value;
			}
		});
	}

	/**
     * Returns the inputs
     */
	function getInputs() {
		return inputs;
	}
	/**
     * Returns the outputs
     */
	function getOutputs() {
		return outputs;
	}

	/**
     * Dispose of the scene
     */
	function dispose() {
		// Consider researching better disposal of Three.js scenes.
		// Currently there are no docs on the best way to do this.
		// This solution still results in leaked memory, but is better
		// than doing nothing.
		terminated = true;

		disposeObjects(taxis);
		disposeObjects(geometries);
		disposeObjects(materials);

		clearScene();

		renderer.dispose();

		scene = undefined;
		camera = undefined;
		renderer = undefined;

		window.removeEventListener('resize', resizeEvent);
	}

	/**
     * Sets the pause state of the simulator
     * @param {Boolean} state 
     */
	function setPaused(state) {
		paused = state;
	}

	// Export public interface
	return {
		getInputs: getInputs,
		setPaused: setPaused,
		getOutputs: getOutputs,
		setValue: setValue,
		dispose: dispose,
		startSimulation: startSimulation,
	};

});