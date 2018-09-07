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
Chart.plugins.register({

	/**
     * Draws a line on the canvas
     */
	drawLine: function (chart, from, to, style = '#ff0000', dashed = false) {
		const ctx = chart.chart.ctx;

		ctx.save();

		ctx.strokeStyle = style;
		ctx.lineWidth = 2;
		if (dashed) {
			ctx.setLineDash([5, 5]);
		}
		ctx.beginPath();
		ctx.moveTo(from.x, from.y);
		ctx.lineTo(to.x, to.y);
		ctx.stroke();

		ctx.restore();
	},

	dataPointToCanvasPoint(chart, point) {
		const xAxis = chart.scales['x-axis-0'];
		const yAxis = chart.scales['y-axis-0'];

		const xP = (point.x - xAxis.min) / (xAxis.max - xAxis.min);
		const yP = 1 - (point.y - yAxis.min) / (yAxis.max - yAxis.min);

		const x = xP * (xAxis.right - xAxis.left) + xAxis.left;
		const y = yP * (yAxis.bottom - yAxis.top) + yAxis.top;

		return {
			x: x,
			y: y
		};
	},

	afterDatasetsDraw: function (chart) {

		const xAxis = chart.scales['x-axis-0'];
		const yAxis = chart.scales['y-axis-0'];

		// Draw input line
		if (chart.config.input) {
			var x = xAxis.left + (xAxis.right - xAxis.left) * (chart.config.input - xAxis.min) / (xAxis.max - xAxis.min);
			let from = {
				x: x,
				y: yAxis.top
			};
			let to = {
				x: x,
				y: yAxis.bottom
			};
			this.drawLine(chart, from, to, '#20237b', true);
		}

		// Draw tangent
		if (chart.config.tangent) {

			// Calculate from and to points
			const m = chart.config.tangent.gradient;
			const c = chart.config.tangent.intercept;
			const minX = xAxis.min;
			const maxX = xAxis.max;
			const minY = yAxis.min;
			const maxY = yAxis.max;

			let from = {
				x: 0,
				y: 0
			};
			let to = {
				x: 0,
				y: 0
			};

			var y0 = m * minX + c; // y(x), x = 0
			var yN = m * maxX + c; // y(x), x = N
			var x0 = (minY - c) / m; // x(y), y = 0
			var xN = (maxY - c) / m; // x(y), y = N

			// Calculate from point
			if (y0 > minY && y0 < maxY) {
				// Line starts on left of graph
				from.x = minX;
				from.y = y0;
			} else if (x0 > minX && x0 < maxX) {
				// Line starts on bottom of graph
				from.x = x0;
				from.y = minY;
			} else if (xN > minX && xN < maxX) {
				// Line starts from top of graph
				from.x = xN;
				from.y = maxY;
			} else return;

			// Calculate to point
			if (yN > minY && yN < maxY) {
				// Line exits on right of graph
				to.x = maxX;
				to.y = yN;
			} else if (xN > minX && xN < maxX) {
				// Line exits on top of graph
				to.x = xN;
				to.y = maxY;
			} else if (x0 > minX && x0 < maxX) {
				// Exit to bottom of graph
				to.x = x0;
				to.y = minY;
			}

			var cFrom = this.dataPointToCanvasPoint(chart, from);
			var cTo = this.dataPointToCanvasPoint(chart, to);

			this.drawLine(chart, cFrom, cTo, '#ff9800');
		}
	},

	afterEvent: function (chart) {

		const xAxis = chart.scales['x-axis-0'];
		const yAxis = chart.scales['y-axis-0'];

		if (chart.config.tangent) {
			chart.draw();

			// Calculate from and to points
			const m = chart.config.tangent.gradient;
			const c = chart.config.tangent.intercept;
			const minX = xAxis.min;
			const maxX = xAxis.max;
			const minY = yAxis.min;
			const maxY = yAxis.max;

			var from = {
				x: 0,
				y: 0
			};
			var to = {
				x: 0,
				y: 0
			};

			var y0 = m * minX + c; // y(x), x = 0
			var yN = m * maxX + c; // y(x), x = N
			var x0 = (minY - c) / m; // x(y), y = 0
			var xN = (maxY - c) / m; // x(y), y = N

			// Calculate from point
			if (y0 > minY && y0 < maxY) {
				// Line starts on left of graph
				from.x = minX;
				from.y = y0;
			} else if (x0 > minX && x0 < maxX) {
				// Line starts on bottom of graph
				from.x = x0;
				from.y = minY;
			} else if (xN > minX && xN < maxX) {
				// Line starts from top of graph
				from.x = xN;
				from.y = maxY;
			} else return;

			// Calculate to point
			if (yN > minY && yN < maxY) {
				// Line exits on right of graph
				to.x = maxX;
				to.y = yN;
			} else if (xN > minX && xN < maxX) {
				// Line exits on top of graph
				to.x = xN;
				to.y = maxY;
			} else if (x0 > minX && x0 < maxX) {
				// Exit to bottom of graph
				to.x = x0;
				to.y = minY;
			}

			var cFrom = this.dataPointToCanvasPoint(chart, from);
			var cTo = this.dataPointToCanvasPoint(chart, to);

			this.drawLine(chart, cFrom, cTo, '#ff9800');
		}
	}
});