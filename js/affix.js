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

/* exported Affix */

/**
 * affix.js
 * Affixes elements to other elements
 */
var Affix = (function (global) {

	var elements = [];
	var padding = 10;

	/**
     * Affixes an element to another element
     * @param {Element} target 
     */
	Element.prototype.affix = function (target) {
		// Remove any prior contraints
		this.free();

		this.dataset.affixId = elements.length;

		elements.push({
			element: this,
			target: target,
			pz: target.style['z-index']
		});

		target.style['z-index'] = 9999;

		// Calculate the new position
		calculatePosition(this, target);
	};

	/**
     * Removes an element from being fixed to another
     */
	Element.prototype.free = function () {
		var affixId = this.dataset.affixId;
		if (affixId == undefined || elements[affixId] == undefined) return;
		elements[affixId].target.style['z-index'] = elements[affixId].pz;
		elements.splice(affixId, 1);
		this.dataset.affixId = undefined;
		this.style.transform = '';
	};

	/**
	 * Frees all affixed elements
	 */
	function freeAll() {
		for (var i = 0; i < elements.length; i++) {
			elements[i].element.free();
		}
	}

	/**
     * 
     * @param {Element} element the element to calculate the position for
     * @param {Element} target the target element to affix to
     */
	function calculatePosition(element, target) {
		// Clear prior transforms
		element.style.transform = '';

		// Compute metrics
		var targetBounding = target.getBoundingClientRect();
		var elementBounding = element.getBoundingClientRect();
		var screenWidth = window.innerWidth,
			screenHeight = window.innerHeight;

		if (elementBounding.width == 0) elementBounding.width = 500;
		if (elementBounding.height == 0) elementBounding.height = 150;

		// Placement priority: Right, Left, Bottom, Top, Bottom right in element

		// Bring into view if off screen
		if (targetBounding.top < padding || targetBounding.top + targetBounding.height > screenHeight) {
			target.scrollIntoView();
		}

		var x, y;
		if (targetBounding.left + targetBounding.width + elementBounding.width + padding < screenWidth &&
            targetBounding.top + (targetBounding.height / 2) + (elementBounding.height / 2) < screenHeight) {
			// Place to right
			x = targetBounding.left + targetBounding.width + padding;
			y = targetBounding.top + (targetBounding.height / 2) - (elementBounding.height / 2);
		} else if (targetBounding.left - elementBounding.width - padding > 0 &&
            targetBounding.top + (targetBounding.height / 2) + (elementBounding.height / 2) < screenHeight) {
			// Place to left
			x = targetBounding.left - elementBounding.width - padding;
			y = targetBounding.top + (targetBounding.height / 2) - (elementBounding.height / 2);
		} else if (targetBounding.top + targetBounding.height + elementBounding.height + padding < screenHeight) {
			// Place to bottom
			x = targetBounding.left + (targetBounding.width / 2) - (elementBounding.width / 2);
			if (x < padding) x = padding; if (x + elementBounding.width > screenWidth - padding) x = screenWidth - padding - elementBounding.width;
			y = targetBounding.top + targetBounding.height + padding;
		} else if (targetBounding.top - elementBounding.height + padding > 0) {
			// Place to top
			x = targetBounding.left + (targetBounding.width / 2) - (elementBounding.width / 2);
			if (x < padding) x = padding; if (x + elementBounding.width > screenWidth - padding) x = screenWidth - padding - elementBounding.width;
			y = targetBounding.top - elementBounding.height - padding;
		} else {
			// Place inside at bottom right
			x = targetBounding.left + targetBounding.width - elementBounding.width - padding;
			y = targetBounding.top + targetBounding.height - elementBounding.height - padding;
			if (y > screenHeight - elementBounding.height - padding) y = screenHeight - elementBounding.height - padding;
		}

		// Translate the element
		var dX = x - elementBounding.left;
		var dY = y - elementBounding.top;
		element.style.transform = 'translate(' + dX + 'px, ' + dY + 'px)';
	}

	/**
     * Handles a window resize or scroll event
     */
	function redraw() {
		for (var i = 0; i < elements.length; i++) {
			calculatePosition(elements[i].element, elements[i].target);
		}
	}

	// Register event listeners
	global.addEventListener('resize', redraw);
	global.addEventListener('scroll', redraw);

	function registerSidebar(sidebar) {
		if (sidebar.dataset.sb) return;

		sidebar.dataset.sb = true;
		sidebar.addEventListener('scroll', redraw);
	}

	return {
		registerSidebar: registerSidebar,
		updateAffixed: redraw,
		freeAll: freeAll
	};

})(this);