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

class Matrix {

	/**
	 * Constructs a new matrix
	 * @param {Number} rows the number of rows
	 * @param {Number} cols the number of columns
	 */
	constructor(rows, cols) {

		this.M = new Float64Array(rows * cols);

		this.rows = rows;
		this.cols = cols;

	}

	/**
	 * Get a value from the matrix at position i, j
	 * @param {Number} i the row index of the matrix
	 * @param {Number} j the column index of the matrix
	 */
	get(i, j) {
		if (i >= this.rows) throw new Error('Row index out of bounds');
		if (j >= this.cols) throw new Error('Column index out of bounds');

		return this.M[i * this.cols + j];
	}

	/**
	 * Sets the matrix to a given value at row i, column j
	 * @param {Number} i 
	 * @param {Number} j 
	 * @param {Float} value 
	 */
	set(i, j, value) {
		if (i >= this.rows) throw new Error('Row index out of bounds');
		if (j >= this.cols) throw new Error('Column index out of bounds');

		this.M[i * this.cols + j] = value;
	}

	/**
	 * Scale (element-wise multiply) the matrix by a scalar
	 * @param {Number} amount the scalar to multiply each element by
	 */
	scale(amount) {
		var C = this.copy();
		for (var i = 0; i < C.M.length; i++) {
			C.M[i] *= amount;
		}
		return C;
	}

	/**
	 * Creates a copy of the matrix
	 */
	copy() {
		var C = new Matrix(this.rows, this.cols);
		for (var i = 0; i < this.rows; i++) {
			for (var j = 0; j < this.cols; j++) {
				C.set(i, j, this.get(i, j));
			}
		}
		return C;
	}

	/**
	 * Returns the transpose of the matrix
	 */
	get T() {
		var n = this.cols;
		var m = this.rows;
		var out = new Matrix(n, m);

		for (var i = 0; i < n; i++) {
			for (var j = 0; j < m; j++) {
				out.set(i, j, this.get(j, i));
			}
		}

		return out;
	}

	/**
	 * Convert matrix to a flat array
	 */
	toArray() {
		return [].slice.call(this.M);
	}

	/**
	 * Generates a matrix of a single row
	 * @param {Number} index the index of the row to extract
	 */
	row(index) {
		var n = 1;
		var m = this.cols;
		var out = new Matrix(n, m);

		for (var i = 0; i < m; i++) {
			var v = this.get(index, i);
			out.set(0, i, v);
		}

		return out;
	}

}

/* exported np */

/**
 * JS implementation of required Numpy functionality
 */
const np = {

	/**
	 * Linear algebra functions
	 */
	linalg: {

		/**
		 * Cholesky decomposition of a positive-definite square matrix
		 */
		cholesky: function (matrix) {
			if (matrix.rows != matrix.cols) throw new Error('Must pass a square matrix');

			let n = matrix.rows;
			let a = new Matrix(matrix.rows, matrix.cols);

			for (let i = 0; i < n; i++) {
				for (let j = 0; j < i + 1; j++) {
					let s = np.dot(a.row(i), a.row(j), true);
					let res = (i == j) ?
						Math.sqrt(matrix.get(i, i) - s) :
						(1 / a.get(j, j) * (matrix.get(i, j) - s));
					a.set(i, j, res);
				}
			}

			return a;
		},

		/**
		 * Matrix inversion
		 */
		inv: function (x) {
			if (x.rows != x.cols) throw new Error('Cannot invert a non-square matrix');

			var n = x.rows;

			// Identity matrix
			var I = np.eye(n);
			var C = x.copy();

			for (let i = 0; i < n; i++) {
				// Get the diagonal element
				var d = C.get(i, i);

				if (d == 0) {
					for (let j = i; j < n; j++) {
						if (C.get(j, i) != 0) {
							for (let k = 0; k < n; k++) {
								// Swap C[i, k] with C[j, k]
								var t = C.get(i, k);
								C.set(i, k, C.get(j, k));
								C.set(j, k, t);

								// Swap I[i, k] with I[j, k]
								t = I.get(i, k);
								C.set(i, k, C.get(j, k));
								C.set(j, k, t);
							}
							break;
						}
					}
					d = C.get(i, i);
					if (d == 0) throw new Error('Matrix is not invertable');
				}

				for (let j = 0; j < n; j++) {
					C.set(i, j, C.get(i, j) / d);
					I.set(i, j, I.get(i, j) / d);
				}

				for (let j = 0; j < n; j++) {
					if (j == i) continue;

					d = C.get(j, i);

					for (let k = 0; k < n; k++) {
						C.set(j, k, C.get(j, k) - d * C.get(i, k));
						I.set(j, k, I.get(j, k) - d * I.get(i, k));
					}
				}
			}

			// Return inverted matrix
			return I;
		},

		/**
		 * Solve linear equation
		 */
		solve: function (a, b) {
			var invA = np.linalg.inv(a);
			return np.dot(invA, b);
		}

	},

	/**
	 * Returns an n*n identity matrix
	 */
	eye: function (n) {
		let m = new Matrix(n, n);
		let i = -1;
		while (++i < n) {
			m.set(i, i, 1);
		}
		return m;
	},

	/**
	 * Returns the diagonal of a matrix
	 */
	diag: function (m) {
		let n = Math.min(m.rows, m.cols);
		let out = new Float64Array(n);
		let i = -1;
		while (++i < n)
			out[i] = m.get(i, i);
		return out;
	},

	/**
	 * Sums an array-like object
	 */
	sum: function (a, axis) {
		if (axis != undefined) {

			if (axis == 0) {
				// Sum rows
				let out = [];
				for (let i = 0; i < a.cols; i++) {
					let s = 0;
					for (let j = 0; j < a.rows; j++)
						s += a.get(j, i);
					out.push(s);
				}
				return out;
			}

			if (axis == 1) {
				// Sum columns
				let out = [];
				for (let i = 0; i < a.rows; i++) {
					let s = 0;
					for (let j = 0; j < a.cols; j++)
						s += a.get(i, j);
					out.push(s);
				}
				return out;
			}

		}

		var s = 0;
		for (let v of a) s += v;
		return s;
	},

	/**
	 * Square root
	 */
	sqrt: function (a) {
		var n = a.rows,
			m = a.cols;
		var out = new Matrix(n, m);
		for (let i = 0; i < n; i++)
			for (let j = 0; j < m; j++)
				out.set(i, j, Math.sqrt(a.get(i, j)));
		return out;
	},

	/**
	 * Dot product
	 */
	dot: function (a, b, su = false) {
		let n = a.rows,
			m = b.cols;

		if (su) {
			if (n == 1) {
				let sum = 0;
				for (let i = 0; i < m; i++) {
					sum += a.M[i] * b.M[i];
				}
				return sum;
			} else {
				let sum = 0;
				for (let i = 0; i < n; i++) {
					sum += a.M[i] * b.M[i];
				}
				return sum;
			}
		} else {
			var out = new Matrix(n, m);
			for (let i = 0; i < n; i++)
				for (let j = 0; j < m; j++) {
					let v = 0;
					let l = Math.min(a.cols, b.rows);
					for (let k = 0; k < l; k++) {
						v += a.get(i, k) * b.get(k, j);
					}
					out.set(i, j, v);
				}

			return out;
		}

	},

	/**
	 * Generate linearly spaced array
	 */
	linspace: function (a, b, n) {
		var out = new Float64Array(n);

		// Increment value
		let incr = (b - a) / (n - 1);

		for (let i = 0; i < n; i++)
			out[i] = a + incr * i;

		return out;
	},

	/**
	 * Convert a 1d array to a matrix
	 */
	array: function (array, axis = 0) {
		let out = (axis == 0) ? new Matrix(array.length, 1) : new Matrix(1, array.length);
		let arr = new Float64Array(array);
		out.M = arr;
		return out;
	},

	/**
	 * Raise all elements to a power
	 */
	pow: function (m, e) {
		let C = m.copy();
		for (let i = 0; i < C.M.length; i++) {
			C.M[i] = Math.pow(C.M[i], e);
		}
		return C;
	},

	/**
	 * Element-wise addition
	 */
	add: function (...a) {
		if (a.length == 0) return 0;

		let res = a[0].copy();

		for (let i = 1; i < a.length; i++) {
			if (res.rows < a[i].rows && res.rows == 1) {
				// Column vector - Matrix
				let n = a[i].rows,
					m = res.cols;
				let resNew = new Matrix(n, m);
				for (let j = 0; j < n; j++)
					for (let k = 0; k < m; k++)
						resNew.set(j, k, res.M[k]);
				res = resNew;
			}
			if (res.cols < a[i].cols && res.cols == 1) {
				// Row vector - Matrix
				let n = res.rows,
					m = a[i].cols;
				let resNew = new Matrix(n, m);
				for (let j = 0; j < n; j++)
					for (let k = 0; k < m; k++)
						resNew.set(j, k, res.M[j]);
				res = resNew;
			}
			if (a[i].rows == 1) {
				// Row vector
				for (let j = 0; j < res.rows; j++) {
					for (let k = 0; k < a[i].cols; k++) {
						res.set(j, k, res.get(j, k) + a[i].M[k]);
					}
				}
			} else if (a[i].cols == 1) {
				// Column vector
				for (let j = 0; j < res.cols; j++) {
					for (let k = 0; k < a[i].rows; k++) {
						res.set(k, j, res.get(k, j) + a[i].M[k]);
					}
				}
			} else {
				// Matrix + Matrix
				if (a[i].rows != res.rows || a[i].cols != res.cols) throw new Error('Cannot add shapes');
				for (let j = 0; j < res.M.length; j++) {
					res.M[j] += a[i].M[j];
				}
			}
		}
		return res;
	},

	/**
	 * Element-wise subtraction
	 */
	subtract: function (...a) {
		if (a.length == 0) return 0;

		let res = a[0].copy();

		for (let i = 1; i < a.length; i++) {
			if (typeof a[i] == 'number') {
				/**
				 * Matrix - Scalar
				 * res(i,j) -= x, for all i, j
				 */
				for (let j = 0; j < res.M.length; j++)
					res.M[j] -= a[i];
			} else {
				if (res.rows < a[i].rows && res.rows == 1) {
					/**
					 * Column Vector - Matrix
					 * res(i, j) = res(i, 0) - x(i, j)
					 */
					let n = a[i].rows,
						m = res.cols;
					let resNew = new Matrix(n, m);
					for (let j = 0; j < n; j++)
						for (let k = 0; k < m; k++)
							resNew.set(j, k, res.M[k]);
					res = resNew;
				}
				if (res.cols < a[i].cols && res.cols == 1) {
					// Row vector - Matrix
					let n = res.rows,
						m = a[i].cols;
					let resNew = new Matrix(n, m);
					for (let j = 0; j < n; j++)
						for (let k = 0; k < m; k++)
							resNew.set(j, k, res.M[j]);
					res = resNew;
				}
				if (a[i].rows == 1) {
					// Row vector
					for (let j = 0; j < res.rows; j++) {
						for (let k = 0; k < a[i].cols; k++) {
							res.set(j, k, res.get(j, k) - a[i].M[k]);
						}
					}
				} else if (a[i].cols == 1) {
					// Column vector
					for (let j = 0; j < res.cols; j++) {
						for (let k = 0; k < a[i].rows; k++) {
							res.set(k, j, res.get(k, j) - a[i].M[k]);
						}
					}
				} else {
					// Matrix + Matrix
					if (a[i].rows != res.rows || a[i].cols != res.cols) throw new Error('Cannot subtract shapes');
					for (let j = 0; j < res.M.length; j++) {
						res.M[j] -= a[i].M[j];
					}
				}
			}
		}

		return res;
	},

	/**
	 * Calculate the exponential of all elements in the input matrix
	 */
	exp: function (m) {
		let C = m.copy();
		for (let i = 0; i < C.M.length; i++) {
			C.M[i] = Math.exp(C.M[i]);
		}
		return C;
	},

	/**
	 * Calculate the absolute value of all elements in the input matrix
	 */
	abs: function (m) {
		let C = m.copy();
		for (let i = 0; i < C.M.length; i++) {
			C.M[i] = Math.abs(C.M[i]);
		}
		return C;
	}

};