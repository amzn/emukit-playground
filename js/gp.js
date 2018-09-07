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
(function (global) {

	class GPRegression {

		/**
         * @param {Function} kernel the kernel function
         * @param {Object} hyperparameters an object containing the hyperparameters variance, length scale, and noise
         */
		constructor(kernel, hyperparameters) {
			this.kernel = kernel;
			this.hyperparameters = hyperparameters;
		}

		/**
         * Sets the input data
         * @param {Array} x the array of x values
         * @param {Array} y the array of y values
         */
		setData(x, y) {
			if (x.length != y.length) throw new Error('Regression inputs mismatch');

			this.x = np.array(x);
			this.y = np.array(y);
		}

		/**
         * Predicts the mean, variance and quantiles.
         * @param {Matrix} x_new the new x values to predict
         */
		predict(x_new) {
			x_new = np.array(x_new);

			var K = this.kernel(this.x, this.x, this.hyperparameters.length);
			var L = np.linalg.cholesky(np.add(K, np.eye(this.x.rows).scale(this.hyperparameters.noise)));

			// Compute the mean
			var K_s = this.kernel(this.x, x_new, this.hyperparameters.length);
			var Lk = np.linalg.solve(L, K_s);
			var mu = np.dot(Lk.T, np.linalg.solve(L, this.y));

			// Compute deviation
			var K_ss = this.kernel(x_new, x_new, this.hyperparameters.length);
			var s2 = np.subtract(np.array(np.diag(K_ss), 1), np.array(np.sum(np.pow(Lk, 2), 0), 1));
			var variance = np.sqrt(np.abs(s2));

			// Return mean, variance and 95% confidence quantiles
			return {
				mean: mu.toArray(),
				variance: variance.toArray(),
				lower: np.subtract(mu.T, variance.scale(this.hyperparameters.variance)).toArray(),
				upper: np.add(mu.T, variance.scale(this.hyperparameters.variance)).toArray()
			};
		}

	}

	/**
     * Kernel functions
     */
	var Kernel = {
		/**
         * Radial Basis Function kernel
         */
		RBF: function (a, b, param) {
			var sumA = np.array(np.sum(np.pow(a, 2), 1));
			var sumB = np.array(np.sum(np.pow(b, 2), 1), 1);
			var sumT = np.add(sumA, sumB);
			var dist = np.dot(a, b.T).scale(2);
			var sqdist = np.subtract(sumT, dist);
			return np.exp(sqdist.scale(-.5 * (1 / param)));
		}
	};

	/**
     * Emulator class
     * Handles chart interactions
     */
	class Emulator {

		constructor(chart, options = {}) {
			// Fetch input options
			this.chart = chart;
			this.input = options.input;
			this.output = options.output;
			this.inputUpdated = options.inputUpdated;
			this.positiveOnly = options.beginAtZero || false;
			this.minX = options.minX || 0;
			this.maxX = options.maxX || 100;
			this.x = options.x || [];
			this.y = options.y || [];
			this.hyperparameters = options.hyperparameters || {
				variance: 100,
				length: this.maxX / this.minX * 5,
				noise: .005
			};
			var showSensitivity = (options.showSensitivity != undefined) ? options.showSensitivity : true;
			this.inputLine = options.inputLine;

			this.chart.options.events = ['hover', 'click', 'mouseout'];
			// Register click event
			this.chart.options.onClick = this.onClick.bind(this);
			// Register hover event - Now shown at the given index
			// if (showSensitivity) {
			// 	this.chart.options.hover.onHover = this.onHover.bind(this);
			// }

			this.showSensitivity = showSensitivity;

			// Dotted line input marker
			this.chart.config.input = this.inputLine;

			// Create the regression
			this.regression = new GPRegression(Kernel.RBF, this.hyperparameters, this.maxX);
		}

		/**
         * Update a dataset
         */
		set(index, x, y) {
			var zip = (x, y) => x.map((v, i) => {
				return {
					x: v,
					y: y[i]
				};
			});
			this.chart.data.datasets[index].data = zip(x, y);
		}

		/**
         * Handles a chart click event
         */
		onClick(event) {
			var scaleWidth = this.chart.scales['x-axis-0'].right - this.chart.scales['x-axis-0'].left;
			var cursorPosX = event.layerX - this.chart.scales['x-axis-0'].left;
			var percentage = cursorPosX / scaleWidth;

			if (percentage < 0 || percentage > 1)
				return;

			var newVal = Math.round(percentage * (this.maxX - this.minX)) + this.minX;

			if (this.showSensitivity && this.x.length > 0) {
				var tangent = this.getTangentAtIndex(Math.floor(this.x_axis.length * percentage));
				this.chart.config.tangent = tangent;
			}

			this.inputUpdated(newVal);
		}

		/**
         * Handles a chart hover event
         */
		onHover(event) {

			if (this.x.length == 0) return;
			if (this.showSensitivity == false) return;

			// Calculate the position of the mouse relative to the graph
			var scaleWidth = this.chart.scales['x-axis-0'].right - this.chart.scales['x-axis-0'].left;
			var cursorPosX = event.layerX - this.chart.scales['x-axis-0'].left;
			var percentage = cursorPosX / scaleWidth;

			if (percentage < 0 || percentage > 1 || this.x_axis == undefined) return;

			var index = Math.round(percentage * this.x_axis.length);

			var tangent = this.getTangentAtIndex(index);

			this.chart.config.tangent = tangent;

		}

		/**
         * Gets the tangent at a given index
         */
		getTangentAtIndex(index) {
			if (index == this.x_axis.length) index--;
			var Xa = (index > 0) ? index - 1 : 0;
			var Xb = (index < this.x_axis.length - 1) ? index + 1 : index;

			// Calculate the equation of the tangent
			var m = (this.mean[Xb] - this.mean[Xa]) / (this.x_axis[Xb] - this.x_axis[Xa]);
			var c = (this.chart.data.datasets[1].data[index].y - m * this.x_axis[index]);

			return {
				gradient: m,
				intercept: c
			};
		}

		/**
         * Recalculates the regression and updates the chart
         */
		refresh(animate = true) {
			if (this.chart == undefined) return;

			this.regression.setData(this.x, this.y);

			var opts = {};
			if (!animate) opts.duration = 0;

			if (this.x.length == 0 || this.y.length == 0) {
				// Clear chart
				for (var i = 0; i < 4; i++) this.set(i, [], []);
				this.chart.update(opts);
				return;
			}

			var x_axis = np.linspace(this.minX, this.maxX, 1000);
			var prediction = this.regression.predict(x_axis);

			this.x_axis = np.array(x_axis).toArray();
			this.mean = prediction.mean;

			this.set(0, this.x, this.y); // Raw data points
			this.set(1, this.x_axis, prediction.mean); // Mean prediction
			this.set(2, this.x_axis, prediction.upper); // Upper 95 quantile
			this.set(3, this.x_axis, prediction.lower); // Lower 95 quantile

			// Update the chart
			this.chart.update(opts);

			// Update sensitivity
			if (this.showSensitivity && this.x.length > 0) {
				var tangent = this.getTangentAtIndex(Math.floor(this.x_axis.length * (this.chart.config.input-this.minX) / (this.maxX-this.minX)));
				this.chart.config.tangent = tangent;
			}
		}

		/**
		 * Updates the input value line and tangent (if applicable)
		 * @param {Number} newVal 
		 */
		updateInputMarker(newVal) {
			// Update input line
			this.chart.config.input = newVal;
			// Update sensitivity
			if (this.showSensitivity && this.x.length > 0) {
				var tangent = this.getTangentAtIndex(Math.floor(this.x_axis.length * (this.chart.config.input-this.minX) / (this.maxX-this.minX)));
				this.chart.config.tangent = tangent;
			}
			// Refresh
			this.chart.update();
		}

		/**
         * Adds an observation to the Emulator
         */
		addObservation(xN, yN) {
			this.x.push(xN);
			this.y.push(yN);

			this.refresh();
		}

		/**
         * Removes all data points
         */
		clear() {
			this.x = [];
			this.y = [];

			this.refresh();
		}

	}

	// Expose the Emulator class
	global.Emulator = Emulator;
	global.GPR = GPRegression;
	global.Kernel = Kernel;

})(this);