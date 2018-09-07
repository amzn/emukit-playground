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

/* exported Playground */
const Playground = (function (global) {

	const githubLink = 'https://github.com/amzn/emukit-playground';

	// Globals
	var root = document.body,
		tutorials = {},
		sandboxes = {},
		simulators = {},
		strings = {},
		loaded = false,
		tutorialCard,
		mobile = false,
		isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

	// i18n
	// To add new langs, add the ID to lanauges and put the JSON string file in config/i18n/[ID].json
	var languages = ['en'];
	var language = 'en';
	// Find language preference from browser
	if (languages.indexOf(navigator.language) >= 0) language = navigator.language;
	else if (navigator.languages != undefined) {
		for (var i = 0; i < navigator.languages.length; i++) {
			if (languages.indexOf(navigator.languages[i]) >= 0) {
				language = navigator.languages[i];
				break;
			}
		}
	}

	/**
     * Gets an i18n string.
     * 
     * If 'ref' starts with '@/', the string is fetched from the root object,
     * otherwise if ref starts with '@' and prefix is not null, the string is
     * fetched from '@[prefix]/'. If the string does not start with '@', the
     * string is returned unaltered.
     * 
     * For example, if ref = '@/a/b/c', strings[lang][a][b][c] is returned,
     * if ref = '@c' and prefix = 'a/b', strings[lang][a][b][c] is returned
     * 
     * @param {String} ref the string reference
     * @param {String} the prefix to apply
     */
	function getString(ref, prefix) {
		if (ref.startsWith('@')) {
			// Prefixes a path to the string reference
			if (ref.startsWith('@/')) ref = '@' + ref.substr(2);
			else if (prefix != undefined) {
				ref = '@' + prefix + '/' + ref.substr(1);
			}
			if (strings[language] != undefined) {
				// Split the reference into components, eg '@a/b/c' -> [ a, b, c ]
				var split = ref.substr(1).split('/');

				var tmp = strings[language];
				for (var i = 0; i < split.length; i++) {
					tmp = tmp[split[i]];
					if (tmp == undefined) return ref;
				}
				return tmp;
			} else return ref;
		} else return ref;
	}

	/**
     * Generates a link callback
     * @param {String} path the link path
     * @param {Object} data the data to send to the new page
     */
	function link(path, data) {
		if (path.startsWith('http://') || path.startsWith('https://')) {
			// External redirect
			return function() { window.open(path, '_blank'); };
		} else {
			// Local page request
			return function() { 
				// Reset state
				PlaygroundController.tutorialPage = 0;

				// Free affixed elments
				Affix.freeAll();
				
				// Set the page
				m.route.set(path, data);

				// If the link is the page we are currently on, ensure it is reloaded
				m.redraw();
			};
		}
	}

	/**
     * Maintains the overall state of the web-app
     */
	var PlaygroundController = {

		/**
         * The active simulator
         */
		simulator: undefined,

		/**
         * The name (id) of the active simulator
         */
		simulatorName: undefined,

		/**
         * The DOM element the simulator should be loaded within
         */
		simulatorDom: undefined,

		/**
         * The current outputs of the simulator
         */
		outputs: undefined,

		/**
         * The options to initiate the simulator with
         */
		options: undefined,

		/**
         * The active tutorial object
         */
		tutorial: undefined,

		/**
         * The id of the active tutorial
         */
		tutorialId: undefined,

		/**
         * Flag to determine if a required action has occured before showing
         * a tutorial step
         */
		showTriggered: false,

		/**
         * Returns true if the simulator is running
         */
		simulatorRunning: false,

		/**
         * The current tutorial page index
         */
		tutorialPage: 0,

		/**
         * The id of the selected input on the emulator controller
         */
		selectedInput: undefined,

		/**
         * The id of the selected output on the emulator controller
         */
		selectedOutput: undefined,

		/**
         * Array of emulators to initiate in the sandbox view
         */
		emulatorDefinitions: [],

		/**
         * Array of active emulator objects
         */
		emulators: [],

		/**
         * The output component DOM element
         */
		outputComponent: undefined,

		/**
         * The visualisation controls component DOM element
         */
		visualisationComponent: undefined,

		/**
         * Initiates a simulator.
         * 
         * Simulators must be loaded with Playground.registerSimulator (see the 
         * 'Simulators' docs for more details on registering simulators).
         * 
         * Any previous instance of a loaded simulator will be disposed.
         * 
         * If a simulator of a given name has not yet loaded, it will load once
         * the simulator is registered.
         * @param {String} simulatorName the name of the simulator
         * @param {Object} options the simulator options
         * @param {DOMElement} domElement the DOM element to initiate the simulator in
         */
		setSimulator: function (simulatorName, options, domElement) {
			// Dispose previously active simulators
			if (this.simulator != undefined && typeof (this.simulator.dispose) == 'function') {
				this.simulator.dispose();
			}

			// Initiate the new simulator
			this.simulatorName = simulatorName;
			this.simulatorDom = domElement;
			this.simulatorRunning = false;
			this.options = options;
			if (simulators[simulatorName] != undefined) {
				options.onOutputsUpdated = this.onOutputChanged;
				options.onFinish = this.onFinish;
				this.simulator = simulators[simulatorName](this.simulatorDom, options);
				this.outputs = this.simulator.getOutputs();
			}

			// Force a redraw
			m.redraw();
		},

		/**
         * Adds an emulator to be initiated later. After calling this method,
         * the playground will generate an emulator the next time it is
         * drawing the sandbox
         */
		addEmulator: function (input, output) {
			PlaygroundController.emulatorDefinitions.push({
				input: input,
				output: output
			});
		},

		/**
         * Notifies once a new simulator has been loaded with 
         * Playground.registerSimulator
         * 
         * If the name of the simulator is equal to the active simulator,
         * the simulation is loaded.
         * @param {String} simulatorName the name of the loaded simulator
         */
		notifySimulatorLoad: function (simulatorName) {
			if (PlaygroundController.simulator == undefined && simulatorName == PlaygroundController.simulatorName) {
				PlaygroundController.setSimulator(simulatorName, this.options, this.simulatorDom);
			}
		},

		/**
         * Callback for when a simulation run has finished
         */
		onFinish: function () {
			// Update the controller state
			PlaygroundController.simulatorRunning = false;

			// Add the new result to the appropriate emulators
			PlaygroundController.emulators.forEach(function (emulator) {
				var inputs = PlaygroundController.simulator.getInputs();
				var x = inputs[emulator.input].value;
				var y = PlaygroundController.outputs[emulator.output].value;
				emulator.addObservation(x, y);
			});

			// Update triggered tutorial step if applicable
			var page = PlaygroundController.getTutorialPage();
			if (page != undefined && page.trigger == 'endSimulation') {
				PlaygroundController.showTriggered = true;
			}

			m.redraw();
		},

		/**
         * Callback for when an output has changed
         * @param {Object} outputs the new outputs
         */
		onOutputChanged: function (outputs) {
			this.outputs = outputs;

			// Handle mid simulation tutorial pausing
			if (this.outputs.simulationProgress.value == 90) {
				var page = PlaygroundController.getTutorialPage();
				if (page != undefined && page.trigger == 'midSimulation') {
					PlaygroundController.simulator.setPaused(true);
					PlaygroundController.showTriggered = true;
					m.redraw();
				}
			}

			/**
             * Since this method is called many times, calling m.redraw() delivers
             * poor performance. Instead we use m.mount, which while requiring the
             * creation of a new vnode tree every call, is still more efficient 
             * than reredering the whole view. 
             * See https://mithril.js.org/mount.html for details
             */
			if (PlaygroundController.outputComponent != undefined) {
				m.mount(PlaygroundController.outputComponent, SimulatorOutputsComponent);
			}
			if (PlaygroundController.visualisationComponent != undefined) {
				m.mount(PlaygroundController.visualisationComponent, VisualisationProgress);
			}
		},

		/**
         * Starts a simulation run
         */
		start: function () {
			if (this.simulator == undefined) return;
			if (PlaygroundController.simulatorRunning) return;

			// Start the simulator
			this.simulator.startSimulation();

			// Update the controller state
			PlaygroundController.simulatorRunning = true;

			// Handle simulation triggers
			var page = PlaygroundController.getTutorialPage();
			if (page != undefined && page.action == 'playSimulation')
				PlaygroundController.nextTutorialPage();
			PlaygroundController.showTriggered = false;

			m.redraw();
		},

		/**
         * Sets an input value of the simulator
         * @param {String} key the name of the input
         * @param {Number} value the value to set the input to
         */
		setValue: function (key, value) {
			// Handle input changes during simulations
			if (key != 'speed' && PlaygroundController.simulatorRunning) {
				return;
			}

			// Update simulator value
			this.simulator.setValue(key, value);

			// Update Emulators
			PlaygroundController.emulators.forEach(e => {
				if (e.input == key)
					e.updateInputMarker(value);
			});

			// Redraw
			m.redraw();
		},

		/**
         * Navigates to the tutorial page
         */
		nextTutorialPage: function () {
			if (PlaygroundController.simulator == undefined) return;

			// Play simulation if action is set
			// if (PlaygroundController.getTutorialPage().action == 'playSimulation') {
			// 	PlaygroundController.start();
			// }

			// Update index
			PlaygroundController.tutorialPage++;

			if (PlaygroundController.tutorialPage >= PlaygroundController.tutorial.tutorial_steps.length) {
				m.redraw();
				return;
			}

			// Fetch the new tutorial page object
			var page = PlaygroundController.getTutorialPage();

			// Handle mid simulation highlight trigger
			if (page.trigger != 'midSimulation') {
				PlaygroundController.simulator.setPaused(false);
				PlaygroundController.showTriggered = false;
			}

			// Handle end of simulation trigger
			if (!PlaygroundController.simulatorRunning && page.trigger == 'endSimulation') {
				PlaygroundController.showTriggered = true;
			}

			// Force a redraw
			m.redraw();
		},

		/**
         * Navigates to the previous tutorial page
         */
		prevTutorialPage: function () {
			if (PlaygroundController.simulator == undefined) return;
			if (PlaygroundController.tutorialPage <= 0) return;

			// Fetch the current tutorial page
			var page = PlaygroundController.getTutorialPage();

			// Hide elements if they were made visible at this step
			if (page.show != undefined) {
				page.show.forEach(x => {
					document.getElementById(x).style.visibility = 'hidden';
				});
			}

			// Update index
			PlaygroundController.tutorialPage--;

			// Get the new tutorial page
			page = PlaygroundController.getTutorialPage();

			// Handle triggers
			if (page.trigger != 'midSimulation' && page.trigger != 'endSimulation') {
				PlaygroundController.simulator.setPaused(false);
				PlaygroundController.showTriggered = false;
			} else {
				PlaygroundController.showTriggered = true;
			}

			// Force a redraw
			m.redraw();
		},

		/**
         * Returns the active tutorial page object
         */
		getTutorialPage: function () {
			if (PlaygroundController.tutorial == undefined) return;

			return PlaygroundController.tutorial.tutorial_steps[PlaygroundController.tutorialPage];
		},

		/**
         * Sets the tutorial from an id
         * @param {String} id the id of the tutorial
         */
		setTutorial: function (id) {
			if (id == PlaygroundController.tutorialId) return;
			PlaygroundController.tutorialId = id;
			PlaygroundController.tutorial = tutorials[id];
			PlaygroundController.tutorialPage = 0;
			PlaygroundController.onFinish();
			PlaygroundController.emulators = [];
			PlaygroundController.simulatorRunning = false;
		},

		/**
         * Unsets the tutorial
         */
		unsetTutorial: function () {
			PlaygroundController.tutorialId = undefined;
			PlaygroundController.tutorial = undefined;
			PlaygroundController.tutorialPage = 0;
			PlaygroundController.simulatorRunning = false;
		}
	};

	/**
	 * Tab controller (Mobile only)
	 */
	var TabController = {

		/**
		 * The current index of the tab
		 */
		index: 0,

		/**
		 * Sets a tab to a given index
		 * @param {Number} newIndex the index to set the tab to
		 */
		setTab: function(newIndex) {
			TabController.index = newIndex;
			m.redraw();
		},

	};

	/*
     * Components
     */

	/**
	 * Tab component (Mobile only)
	 * @param {Number} id the index of this tab
	 * @param {String} text the text to display on this tab
	 */
	var Tab = {
		view: function(vnode) {
			var id = vnode.attrs.id;
			var active = TabController.index == id;
			var text = vnode.attrs.text;
			
			return m('div', { 
				class: (active) ? 'tab tab-active' : 'tab',
				onclick: () => {
					TabController.setTab(id);
				}
			}, text);
		}
	};

	/**
	 * Playground tabs component (Mobile only)
	 */
	var Tabs = {
		view: function() {
			if (!mobile) return;
			
			var options = [ 
				{ id: 0, text: getString('@visualise', 'core') }, 
				{ id: 1, text: getString('@simulate', 'core') },
				{ id: 2, text: getString('@emulate', 'core') }, 
			];

			var tabList = [];
			options.forEach(t => {
				tabList.push(m(Tab, { 
					id: t.id, 
					text: t.text
				}));
			});

			return m('div', { class: 'tabs' }, tabList);
		}
	};

	/**
     * Button component.
     * 
     * @param {String} text the text displayed within the button
     * @param {String} class the class name(s) to add to the button
     * @param {Boolean} disabled sets the button to disabled if true
     */
	var Button = {
		view: function (vnode) {
			// Get attributes
			var disabled = vnode.attrs.disabled || false;
			var text = vnode.attrs.text;
			var className = (vnode.attrs.class == undefined) ? 'btn' : 'btn ' + vnode.attrs.class;
			if (disabled) className += ' btn-disabled';
			var onclick = (disabled) ? undefined : vnode.attrs.onclick;

			// Return the new button
			return m('button', {
				class: className,
				disabled: disabled,
				onclick: onclick
			}, text);
		}
	};

	/**
     * Floating action button
     * 
     * @param {Function} onclick the on click callback
     */
	var FabButton = {
		view: function (vnode) {
			return m('div', {
				id: 'playButton',
				class: 'btn-fab btn-simulation-fab',
				onclick: vnode.attrs.onclick
			}, [
				m('svg', {
					width: 32,
					height: 32,
					style: 'margin-top: 24px; margin-left: 26px;'
				},
				m('path', {
					style: 'fill: #fff; stroke: none;',
					d: 'M 0 0 L 0 32 L 32 16 Z'
				})
				)
			]);
		}
	};

	/**
     * Select dropdown component
     * @param {Array} options an array of options, each is an object of the form { value: #, label: # }
     * @param {Function} onchange the on click callback
     */
	var Select = {
		view: function (vnode) {
			// Get options
			var options = vnode.attrs.options;
			var onchange = vnode.attrs.onchange;

			// Map the options into <option> elements
			var optionsEl = options.map(o => {
				return m('option', {
					value: o.value
				}, o.label);
			});

			return m('select', {
				onchange: m.withAttr('value', onchange)
			}, optionsEl);
		}
	};

	/**
     * Slider component
     * @param {String} name the id of the slider
     * @param {Number} step the step of the range (defaults to 10
     * @param {Number} min the minimum value of the range
     * @param {Number} max the maximum value of the range
     * @param {Number} value the default value of the range
     * @param {Function} valueFormat a function to convert the current value to a string. Used for the output label
     * @param {String} label the label text displayed above the slider
     * @param {Boolean} hideOutput hides the output label displaying the current value
     * @param {String} style the class name(s) to add to the slider
     * @param {Boolean} oninput if true, the slider will call onchange every time the oninput event fires
     * @param {Boolean} disabled if disabled, the slider cannot be edited
     * @param {String} hint if set, the hint is displayed when the user hovers the label
     */
	var Slider = {
		oncreate: function(vnode) {
			var disabled = vnode.attrs.disabled || false;

			if (isMobileDevice && !disabled) {
				/**
				 * Handle mobile devices:
				 * mousedown, mousemove and mouseup events don't have support for many mobile browsers.
				 * Instead we replace these events with touchstart, touchmove and touchend.
				 */
				var name = vnode.attrs.key;
				var step = vnode.attrs.step || 1;
				var min = vnode.attrs.min / step;
				var max = vnode.attrs.max / step;

				// Register on change event
				var onchange = vnode.attrs.onchange;
				if (onchange == undefined) {
					onchange = function (v) {
						PlaygroundController.setValue(name, v);
					};
				}

				var __oc = onchange;
				onchange = (v) => __oc(v * step);

				// Move event (when slider is held down)
				var touchmove = function(e) {
					e.preventDefault();

					// Calculate the corrosponding value based on the X pos of the mouse
					var x = e.clientX || e.pageX || e.screenX || e.changedTouches[0].clientX || e.changedTouches[0].pageX;

					var box = vnode.dom.getBoundingClientRect();

					var percentageX = (x - box.left) / box.width;
					var actualX = Math.round((max - min) * percentageX + min);

					if (actualX > max) actualX = max;
					if (actualX < min) actualX = min;
					onchange(actualX);
				};
				
				// End of touch event
				var touchend = function() {
					document.removeEventListener('touchend', arguments.callee);
					document.removeEventListener('touchmove', touchmove);
				};


				var el = vnode.dom;

				el.childNodes.forEach(element => {
					// Remove onmousedown listeners
					if (el.onmousedown != undefined)
						el.onmousedown = undefined;

					// Add on touch listeners
					element.addEventListener('touchstart', function(e) {
						e.preventDefault();
						document.addEventListener('touchmove', touchmove);
						document.addEventListener('touchend', touchend);
					});
				});
			}
		},
		view: function (vnode) {
			// Get options
			var name = vnode.attrs.key;
			var step = vnode.attrs.step || 1;
			var min = vnode.attrs.min / step;
			var max = vnode.attrs.max / step;
			var value = vnode.attrs.value / step;
			var valueFormat = vnode.attrs.valueFormat || ((v) => v.toFixed());
			var label = vnode.attrs.label;
			var hideOutput = vnode.attrs.hideOutput;
			var style = (vnode.attrs.style == undefined) ? 'slider' : 'slider ' + vnode.attrs.style;
			var oninput = (vnode.attrs.oninput == undefined) ? true : vnode.attrs.oninput;
			var disabled = vnode.attrs.disabled || false;
			var hint = vnode.attrs.hint;

			// Output label mouse down handler
			var outputMouseDown = function (e) {
				e.preventDefault();

				// Register a move event that is unregistered when the mouse is unclicked
				document.onmouseup = () => {
					document.onmouseup = null;
					document.onmousemove = null;
				};
				document.onmousemove = (e) => {
					e.preventDefault();

					// Calculate the corrosponding value based on the X pos of the mouse
					var x = e.clientX || e.pageX || e.screenX;
					var box = vnode.dom.getBoundingClientRect();

					var percentageX = (x - box.left) / box.width;
					var actualX = Math.round((max - min) * percentageX + min);

					if (actualX > max) actualX = max;
					if (actualX < min) actualX = min;
					onchange(actualX);
				};
			};

			// Calculate the output label offset
			var leftOffset = -9 + 157 * (value - min) / (max - min);

			// Register on change event
			var onchange = vnode.attrs.onchange;
			if (onchange == undefined) {
				onchange = function (v) {
					PlaygroundController.setValue(name, v);
				};
			}

			var __oc = onchange;
			onchange = (v) => __oc(v * step);

			var labelContents = [];

			if (hint != undefined) {
				labelContents.push(m('div', {
					class: 'hint'
				}, hint));
			}
			labelContents.push(label);

			// Contents container
			var contents = [
				m('div', {
					class: 'input-label hoverable'
				}, labelContents),
				m('input[type=range]', {
					class: style,
					name: name,
					id: 'range-' + name,
					oninput: (oninput && !disabled) ? m.withAttr('value', onchange) : undefined,
					onchange: (!disabled) ? m.withAttr('value', onchange) : undefined,
					min: min,
					max: max,
					value: value,
					disabled: disabled
				})
			];

			var onmousedown = (disabled) ? undefined : (e) => {
				outputMouseDown(e);
			};

			// Add output label
			if (!hideOutput) {
				contents.push(m('output', {
					class: 'slider-output',
					style: 'margin-left: ' + leftOffset + 'px;',
					for: name,
					value: valueFormat(value * step),
					onmousedown: onmousedown
				}));
			}

			return m('div', contents);
		}
	};

	/**
     * Input component
     * @param {String} class the class name(s) to add to this element
     */
	var Input = {
		view: function (vnode) {
			var className = (vnode.attrs.class == undefined) ? 'input' : 'input ' + vnode.attrs.class;
			return m('div', {
				class: className
			}, vnode.children);
		}
	};

	/**
     * Output component
     * @param {String} label the label of the output
     * @param {String} value the value of the output
     * @param {String} hint if provided, the output will show a hint when hovered
     */
	var Output = {
		view: function (vnode) {
			var hint = vnode.attrs.hint;
			var contents = [];
			if (hint != undefined)
				contents.push(m('div', {
					class: 'hint'
				}, hint));

			contents.push(
				m('div', {
					class: 'output-label'
				}, vnode.attrs.label),
				m('div', {
					class: 'output-value'
				}, vnode.attrs.value)
			);
			return m('div', {
				id: vnode.attrs.id,
				class: 'output hoverable'
			}, contents);
		}
	};

	/**
     * Header component
     * @param {Boolean} isHome if true hides the 'return to home' button.
     */
	var Header = {
		view: function (vnode) {
			// Left header layout
			var leftLayout = [
				m('h1', {
					class: 'title'
				}, getString('@title', 'core')),
			];

			// Show the back to home button if this is not on the homepage
			if (!vnode.attrs.isHome) {
				leftLayout.push(
					m(Button, {
						text: getString('@btnHome', 'core'),
						onclick: link('/')
					})
				);
			}

			return m('div', {
				class: 'header'
			}, [
				m('div', {
					class: 'header-left'
				}, leftLayout),
				m('div', {
					class: 'header-right'
				}, [
					m(Button, {
						text: getString('@btnFork', 'core'),
						class: 'btn-github',
						onclick: link(githubLink)
					})
				])
			]);
		}
	};

	/**
     * Hero section component
     */
	var HeroSection = {
		view: function () {
			return m('div', {
				class: 'hero'
			}, [
				m('div', {
					class: 'hero-image'
				}),
				m('div', {
					class: 'hero-content'
				}, [
					m('h1', {
						class: 'hero-title'
					}, getString('@heroTitle', 'core')),
					m(Button, {
						text: getString('@btnStartLearning', 'core'),
						onclick: link('/learn/introduction'),
						class: 'btn-fw centered'
					})
				])
			]);
		}
	};

	/**
     * Card component
     * @param {String} image the image url to feature on the card
     * @param {String} title the title to display on the card
     * @param {String} subtitle the subtitle to display on the card
     * @param {Array} actions array of vnodes containing action items
     * @param {String} class class name(s) to add to the card
     */
	var Card = {
		view: function (vnode) {
			var layout = [];
			var contentLayout = [];

			// Card image setup
			if (vnode.attrs.image != undefined) {
				layout.push(
					m('div', {
						class: 'card-image',
						style: `background-image:url('${vnode.attrs.image}')`
					})
				);
			}

			// Title
			if (vnode.attrs.title != undefined) {
				contentLayout.push(
					m('div', {
						class: 'card-title'
					}, vnode.attrs.title)
				);
			}

			// Subtitle
			if (vnode.attrs.subtitle != undefined) {
				contentLayout.push(
					m('div', {
						class: 'card-subtitle'
					}, vnode.attrs.subtitle)
				);
			}

			if (vnode.children != undefined) {
				contentLayout.push(vnode.children);
			}

			// Setup actions
			if (vnode.attrs.actions) {
				contentLayout.push(
					m('div', {
						class: 'card-action'
					}, vnode.attrs.actions)
				);
			}

			layout.push(
				m('div', {
					class: 'card-content'
				}, contentLayout)
			);

			return m('div', {
				id: vnode.attrs.id,
				class: `card${vnode.attrs.class ? ' ' + vnode.attrs.class : ''}`,
				style: (vnode.attrs.style != undefined) ? vnode.attrs.style : ''
			}, layout);
		}
	};

	/**
     * Card Section
     * Used on home page to contain the list of tutorials and sandboxes
     * @param {String} title the title of the section
     * @param {Array} cards an array of cards
     */
	var CardSection = {
		view: function (vnode) {

			// Gather options
			var title = vnode.attrs.title;
			var cards = vnode.attrs.cards;

			var cardsLayout = [];

			// Add cards
			cards.forEach(function (card) {
				cardsLayout.push(
					m(Card, {
						class: 'card-experiment',
						title: card.title,
						subtitle: card.subtitle,
						image: card.image,
						actions: [
							m('div', {
								class: 'card-info'
							}, card.info),
							m(Button, {
								text: card.button.text,
								onclick: card.button.onclick
							})
						]
					})
				);
			});

			// Return the layout
			return m('div', {
				class: 'section'
			}, [
				m('h2', {
					class: 'section-title'
				}, title),
				m('div', {
					class: 'card-container'
				}, cardsLayout)
			]);

		}
	};

	/**
     * Visualisation component
     * Contains active simulators
     * @param {Object} simulator details about the simulator to initiate
     */
	var Visualisation = {
		oncreate: function (vnode) {
			PlaygroundController.setSimulator(vnode.attrs.simulator.name, {
				maxSteps: vnode.attrs.simulator.steps
			}, vnode.dom);
		},
		view: function () {
			return m('div', {
				id: 'simulator',
				class: 'visualisation'
			});
		}
	};

	/**
     * Visualisation progress component
     * Contains the simulation status label. Seperate element allows m.mount to be called
     */
	var VisualisationProgress = {
		oncreate: function (vnode) {
			PlaygroundController.visualisationComponent = vnode.dom.parentNode;
		},
		view: function () {
			// Get strings
			var simulationStatus = getString('@simulationStatus', 'core');
			var status = (PlaygroundController.simulatorRunning) ? getString('@simulationRunning', 'core') : getString('@simulationReady', 'core');
			var progress = getString('@simulationProgress', 'core');

			// Return layout
			return m('div', {
				class: 'control control-progress'
			}, [
				m('div', simulationStatus + ': ' + status),
				m('div', progress + ': ' + ((PlaygroundController.simulator != undefined) ? PlaygroundController.outputs.simulationProgress.value : 0) + '%')
			]);
		}
	};

	/**
     * Visualisation controls component
     * Contains play button, speed slider and visualisation state details
     */
	var VisualisationControls = {
		view: function () {
			// Get strings
			var simulationSpeed = getString('@simulationSpeed', 'core');

			// Return layout
			return m('div', {
				class: 'controls'
			}, [
				m('div', m(VisualisationProgress)),
				m(FabButton, {
					onclick: function () {
						PlaygroundController.start();
					}
				}),
				m('div', {
					id: 'speedSlider',
					class: 'control'
				}, [
					m(Slider, {
						label: simulationSpeed + ': ' + ((PlaygroundController.simulator != undefined) ? PlaygroundController.simulator.getInputs().speed.value : 50) + 'x',
						min: 1,
						max: 100,
						value: (PlaygroundController.simulator != undefined) ? PlaygroundController.simulator.getInputs().speed.value : 50,
						key: 'speed',
						hideOutput: true
					})
				])
			]);
		}
	};

	/**
     * Chart JS wrapper
     * @param {String} id the id of the chart
     * @param {String} type the type of the chart
     * @param {Object} data the dataset object
     * @param {Object} options Chart.js options. See Chart.js docs for more details
     */
	var ChartComponent = {
		view: function (vnode) {
			return m('canvas', {
				id: 'chart-' + vnode.attrs.id
			});
		},
		oncreate: function (vnode) {
			var chart = new Chart('chart-' + vnode.attrs.id, {
				type: vnode.attrs.type,
				data: vnode.attrs.data,
				options: vnode.attrs.options
			});

			if (typeof (vnode.attrs.chartReady) == 'function') vnode.attrs.chartReady(chart);
		}
	};

	/**
     * Simulation inputs component
     * Contains input sliders on the sidebar
     */
	var SimulatorInputsComponent = {
		view: function (vnode) {
			var editable = vnode.attrs.editable;
			// Fetch the inputs from the active simulator
			var inputs = [];
			var i18nPrefixSim = 'simulator/' + PlaygroundController.simulatorName;
			if (PlaygroundController.simulator != undefined) {
				var simInputs = PlaygroundController.simulator.getInputs();
				Object.keys(simInputs).forEach(function (inputName) {
					var input = simInputs[inputName];
					if (input.hidden) return;
					var disabled = editable != undefined && editable.indexOf(inputName) == -1;
					var opts = (disabled) ? {
						class: 'input-disabled'
					} : {};
					inputs.push(
						m(Input, opts, m(Slider, {
							label: getString(input.displayName, i18nPrefixSim),
							key: inputName,
							min: input.min,
							max: input.max,
							value: input.value,
							step: input.step,
							valueFormat: input.valueFormat,
							disabled: disabled,
							hint: getString(input.description, i18nPrefixSim)
						}))
					);
				});
			}

			// Return the layout
			return m(Card, {
				id: 'inputs',
				class: 'overflow',
				title: getString('@simulationInputs', 'core')
			}, [
				m('div', {
					class: 'input-container'
				}, inputs)
			]);
		}
	};

	/**
     * Simulator output component
     * Contains outputs on the sidebar while a simulator is running
     */
	var SimulatorOutputsComponent = {
		oncreate: function (vnode) {
			PlaygroundController.outputComponent = vnode.dom.parentNode;
		},
		view: function () {
			// Fetch the outputs from the active simulator
			var i18nPrefixSim = 'simulator/' + PlaygroundController.simulatorName;
			var outputs = [];
			if (PlaygroundController.simulator != undefined) {
				var simOutputs = PlaygroundController.outputs;

				Object.keys(simOutputs).forEach(function (outputName) {
					var output = simOutputs[outputName];
					var hint = (output.description != undefined) ? getString(output.description, i18nPrefixSim) : undefined;
					if (!output.hidden) {
						outputs.push(
							m(Output, {
								id: outputName,
								label: getString(output.displayName, i18nPrefixSim),
								value: output.toString(),
								hint: hint
							})
						);
					}
				});
			}

			// Return the layout
			return m(Card, {
				id: 'outputs',
				title: getString('@simulationOutputs', 'core')
			}, [
				m('div', {
					class: 'output-container'
				}, outputs)
			]);
		}
	};

	/**
     * Emulator controller component
     * Used in sandbox mode to add and remove emulators
     */
	var EmulatorControllerComponent = {
		view: function () {

			if (PlaygroundController.simulator == undefined) return;

			var i18n = 'simulator/' + PlaygroundController.simulatorName;

			var inputs = PlaygroundController.simulator.getInputs();
			var outputs = PlaygroundController.simulator.getOutputs();

			var inputOptions = [],
				outputOptions = [];
			Object.keys(inputs).forEach(i => {
				if (i == 'speed') return;
				inputOptions.push({
					value: i,
					label: getString(inputs[i].displayName, i18n)
				});
			});
			Object.keys(outputs).forEach(o => {
				if (o == 'simulationProgress') return;
				outputOptions.push({
					value: o,
					label: getString(outputs[o].displayName, i18n)
				});
			});

			// Check if any emulator has data
			var emulatorsHaveData = false;
			PlaygroundController.emulators.forEach(e => {
				if (e.x.length > 0) emulatorsHaveData = true;
			});

			var controller = m(Card, {
				id: 'emulator_controller',
				title: getString('@emulators', 'core'),
				actions: [
					m('div'),
					m(Button, {
						text: getString('@resetEmulators', 'core'),
						class: 'btn-danger',
						disabled: !emulatorsHaveData,
						onclick: () => {
							PlaygroundController.emulators.forEach(e => {
								e.clear();
								m.redraw();
							});
						}
					}),
					m('div'),
				]
			}, [
				m('div', {
					class: 'emulator-controls-container'
				}, [
					m(Select, {
						options: inputOptions,
						onchange: (v) => {
							PlaygroundController.selectedInput = v;
						}
					}),
					' against ',
					m(Select, {
						options: outputOptions,
						onchange: (v) => {
							PlaygroundController.selectedOutput = v;
						}
					}),
					m(Button, {
						text: getString('@add', 'core'),
						onclick: () => {
							// Set defaults if undefined
							if (PlaygroundController.selectedInput == undefined) {
								var inputs = PlaygroundController.simulator.getInputs();
								PlaygroundController.selectedInput = Object.keys(inputs)[0];
							}
							if (PlaygroundController.selectedOutput == undefined) {
								var outputs = PlaygroundController.simulator.getOutputs();
								PlaygroundController.selectedOutput = Object.keys(outputs)[0];
							}

							// Get the selected keys
							var input = PlaygroundController.selectedInput;
							var output = PlaygroundController.selectedOutput;

							// Add the emulator
							PlaygroundController.addEmulator(input, output);
							m.redraw();
						},
						disabled: PlaygroundController.emulatorDefinitions.findIndex(x => x.input == PlaygroundController.selectedInput && x.output == PlaygroundController.selectedOutput) > -1
					})
				])
			]);

			return controller;
		}
	};

	/**
     * Emulator component
     * Creates underlying emulator model and manages chart interactions
     * @param {String} input the input to model
     * @param {String} output the output to model
     * @param {String} title the title of the emulator
     * @param {String} id the id of the emulator
     * @param {String} xAxisLabel the label for the x axis of the chart
     * @param {String} yAxisLabel the label for the y axis of the chart
     * @param {Boolean} beginAtZero if true, the y axis begins from zero
     * @param {Object} hyperparameters the initial hyperparameters of the emulator
     * @param {Boolean} showSensitivity if true, sensitivity analysis is added to the chart upon hover
     */
	var EmulatorComponent = {
		view: function (vnode) {

			// Setup datasets
			var dataset = [
				// Raw data points
				{
					data: [],
					fill: false,
					showLine: false,
					pointBackgroundColor: 'rgb(255, 152, 0)',
					pointRadius: 5
				},
				// Mean
				{
					data: [],
					fill: false,
					borderColor: 'rgb(32, 35, 42)',
					lineTension: 0.1,
					pointRadius: 0,
					cubicInterpolationMode: 'monotone'
				},
				// Upper quantile
				{
					data: [],
					fill: '+1',
					backgroundColor: 'rgba(216, 216, 216, .74)',
					pointRadius: 0,
					borderWidth: 0,
					cubicInterpolationMode: 'monotone'
				},
				// Lower quantile
				{
					data: [],
					fill: false,
					pointRadius: 0,
					borderWidth: 0,
					cubicInterpolationMode: 'monotone'
				},
			];

			// Gather options
			var title;
			if (vnode.attrs.title) getString(vnode.attrs.title, 'tutorial/' + PlaygroundController.tutorialId);
			var input = vnode.attrs.input;
			var output = vnode.attrs.output;
			var id = vnode.attrs.id || input + '-' + output;
			var xAxisLabel = vnode.attrs.xAxisLabel;
			var yAxisLabel = vnode.attrs.yAxisLabel;
			var beginAtZero = vnode.attrs.beginAtZero || false;
			var hyperparameters = vnode.attrs.hyperparameters;
			var showSensitivity = vnode.attrs.showSensitivity;
			var inputLine;
			var hidden = (vnode.attrs.hidden == undefined) ? false : vnode.attrs.hidden;

			// Setup defaults from active simulator
			var inputs, maxX = 100,
				minX = 0;
			if (PlaygroundController.simulator == undefined) return;
			if (PlaygroundController.simulator != undefined) {
				inputs = PlaygroundController.simulator.getInputs();
				maxX = inputs[input].max;
				minX = inputs[input].min;

				var outputs = PlaygroundController.simulator.getOutputs();
				var i18n = 'simulator/' + PlaygroundController.simulatorName;
				if (xAxisLabel == undefined) xAxisLabel = getString(inputs[input].displayName, i18n);
				if (yAxisLabel == undefined) yAxisLabel = getString(outputs[output].displayName, i18n);
				if (title == undefined) title = xAxisLabel + ' vs ' + yAxisLabel;

				if (hyperparameters == undefined) {
					hyperparameters = {
						variance: outputs[output].variance || 100,
						length: (maxX - minX) * 5,
						noise: 0.005
					};
				}

				inputLine = inputs[input].value;
			}

			// Card contents
			var contents = [
				m(ChartComponent, {
					id: id,
					type: 'line',
					data: {
						datasets: dataset
					},
					options: {
						legend: {
							display: false
						},
						tooltips: {
							enabled: false
						},
						scales: {
							yAxes: [{
								scaleLabel: {
									display: true,
									labelString: yAxisLabel
								},
								ticks: {
									beginAtZero: true
								}
							}],
							xAxes: [{
								type: 'linear',
								scaleLabel: {
									display: true,
									labelString: xAxisLabel
								},
								ticks: {
									min: minX,
									max: maxX,
								}
							}]
						},
					},
					chartReady: function (chart) {
						// Create an Emulator instance
						PlaygroundController.emulators.push(new Emulator(chart, {
							input: input,
							output: output,
							hyperparameters: hyperparameters,
							inputUpdated: (newVal) => {
								// Set the new value
								PlaygroundController.setValue(input, newVal);
							},
							beginAtZero: beginAtZero,
							showSensitivity: showSensitivity,
							minX: minX,
							maxX: maxX,
							inputLine: inputLine
						}));45*

						m.redraw();
					}
				})
			];

			// Add hyperparameters
			if (vnode.attrs.showHyperparameters) {
				var maxVariance = hyperparameters.variance * 2;
				var maxLength = hyperparameters.length * 2;
				var maxNoise = 0.3;

				var emulatorIndex = PlaygroundController.emulators.findIndex(x => x.input == input && x.output == output);
				if (emulatorIndex == -1) emulatorIndex = PlaygroundController.emulators.length;

				contents.push([
					m('div', {
						class: 'hyperparams'
					}, m(Slider, {
						label: getString('@variance', 'core'),
						min: 0,
						max: maxVariance,
						value: (PlaygroundController.emulators[emulatorIndex] != undefined) ? PlaygroundController.emulators[emulatorIndex].regression.hyperparameters.variance : 0,
						onchange: function (value) {
							setTimeout(() => {
								PlaygroundController.emulators[emulatorIndex].regression.hyperparameters.variance = value;
								PlaygroundController.emulators[emulatorIndex].refresh();
							});
						},
						hideOutput: true,
						style: 'slider-hyper',
						oninput: false,
						hint: getString('@varianceDescription', 'core')
					})),
					m('div', {
						class: 'hyperparams'
					}, m(Slider, {
						label: getString('@length', 'core'),
						min: 1,
						max: maxLength,
						value: (PlaygroundController.emulators[emulatorIndex] != undefined) ? PlaygroundController.emulators[emulatorIndex].regression.hyperparameters.length : 0,
						onchange: function (value) {
							PlaygroundController.emulators[emulatorIndex].regression.hyperparameters.length = value;
							PlaygroundController.emulators[emulatorIndex].refresh();
						},
						hideOutput: true,
						style: 'slider-hyper',
						oninput: false,
						hint: getString('@lengthDescription', 'core')
					})),
					m('div', {
						class: 'hyperparams'
					}, m(Slider, {
						label: getString('@noise', 'core'),
						min: 0,
						max: maxNoise,
						value: (PlaygroundController.emulators[emulatorIndex] != undefined) ? Math.sqrt(PlaygroundController.emulators[emulatorIndex].regression.hyperparameters.noise / 2) : 0,
						onchange: function (value) {
							value = 2 * Math.pow(value, 2);
							PlaygroundController.emulators[emulatorIndex].regression.hyperparameters.noise = value;
							PlaygroundController.emulators[emulatorIndex].refresh();
						},
						hideOutput: true,
						style: 'slider-hyper',
						oninput: false,
						step: 0.0005,
						hint: getString('@noiseDescription', 'core')
					}))
				]);
			}

			var actions = [];

			var predicate = x => x.input == input && x.output == output;
			var spl = x => x.splice(x.findIndex(predicate), 1);

			if (vnode.attrs.showControls) {
				actions.push([
					m(Button, {
						text: getString('@removeData', 'core'),
						class: 'btn-danger',
						onclick: () => {
							var emulator = PlaygroundController.emulators[PlaygroundController.emulators.findIndex(predicate)];
							emulator.clear();
						}
					}),
					m(Button, {
						text: getString('@removeEmulator', 'core'),
						class: 'btn-danger',
						onclick: () => {
							// Remove emulator
							spl(PlaygroundController.emulatorDefinitions);
							spl(PlaygroundController.emulators);
							m.redraw();
						}
					})
				]);
			}

			// Return the layout
			return m(Card, {
				id: id,
				title: getString('@emulator', 'core') + ': ' + title,
				actions: actions,
				style: (hidden) ? 'visibility: hidden' : ''
			}, contents);
		}
	};

	/**
     * End card component
     * Once a tutorial is complete, contains further steps for the user
     */
	var EndCard = {
		oncreate: function(vnode) {
			if (mobile) {
				TabController.setTab(1);
			}
			Affix.freeAll();
			vnode.dom.scrollIntoView();
		},
		view: function () {
			var tutorial = PlaygroundController.tutorial;
			var tutorialId = PlaygroundController.tutorialId;
			if (tutorial == undefined) return;
			var endCard = tutorial.end_card;

			var title = getString('@tutorialEndCardTitle', 'core').replace('$0', getString(tutorial.title, 'tutorial/' + tutorialId));
			var extra = getString(endCard.extra_action, 'tutorial/' + tutorialId);

			var nextTutorial = endCard.next_tutorial;

			// Card actions
			var actions = [
				m(Button, {
					text: getString('@btnHome', 'core'),
					onclick: link('/'),
					class: 'btn-autow'
				}),
			];
			if (nextTutorial != undefined && nextTutorial != '') {
				extra += ' ' + getString('@nextTutorial', 'core');
				actions.push(
					m(Button, {
						text: getString('@btnNextTutorial', 'core'),
						onclick: link('/learn/' + nextTutorial),
						class: 'btn-autow'
					})
				);
			}

			Affix.freeAll();

			return m(Card, {
				title: title,
				actions: actions
			}, extra);
		}
	};

	/**
     * Tutorial component
     * Handles tutorial overlay
     */
	var TutorialComponent = {
		onupdate: function (vnode) {
			if (vnode.dom != undefined)
				tutorialCard = vnode.dom.childNodes[0];
			Affix.updateAffixed();
			if (mobile) {
				if (TabController.index == 0) {
					let el = document.getElementById('simulate');
					Affix.registerSidebar(el);
				}
				if (TabController.index == 1) {
					let el = document.getElementById('emulate');
					Affix.registerSidebar(el);
				}
			} else {
				var sidebarEl = document.getElementsByClassName('sidebar')[0];
				if (sidebarEl != undefined)
					Affix.registerSidebar(sidebarEl);
			}
			
		},
		view: function () {

			// Get the tutorial page index
			var tutorialPage = PlaygroundController.tutorialPage;

			if (tutorialPage == PlaygroundController.tutorial.tutorial_steps.length) return;

			var i18nPrefix = 'tutorial/' + PlaygroundController.tutorialId;

			var tutorial = PlaygroundController.getTutorialPage();
			var title = getString(tutorial.title || `@slide${tutorialPage+1}/title`, i18nPrefix);
			if (title.startsWith('@')) title = '';
			var subtitle = getString(tutorial.description || `@slide${tutorialPage+1}/description`, i18nPrefix);

			var hidden = tutorial.trigger != undefined && !PlaygroundController.showTriggered;
			var style = (hidden) ? 'visibility: hidden; ' : '';

			/**
             * Set simulator values
             */
			if (!hidden && tutorial.simulator_values != undefined && PlaygroundController.simulator != undefined) {
				var inputs = PlaygroundController.simulator.getInputs();
				Object.keys(tutorial.simulator_values).forEach(k => {
					if (inputs[k].value != tutorial.simulator_values[k])
						PlaygroundController.setValue(k, tutorial.simulator_values[k]);
				});
			}

			var highlightedEl = document.getElementById(tutorial.highlight);

			var playButton = document.getElementById('playButton');
			if (playButton != undefined) {
				if (tutorial.highlight == 'playButton' && !PlaygroundController.simulatorRunning) {
					playButton.classList.add('btn-fab-highlight');
				} else {
					playButton.classList.remove('btn-fab-highlight');
				}
				if (tutorial.highlight == 'simulator') {
					playButton.classList.add('btn-fab-hf');
				} else {
					playButton.classList.remove('btn-fab-hf');
				}
			}

			var card = m(Card, {
				title: title,
				subtitle: subtitle,
				actions: [
					m(Button, {
						text: getString('@btnBack', 'core'),
						onclick: PlaygroundController.prevTutorialPage,
						disabled: tutorialPage == 0
					}),
					m('div', {
						class: 'card-info'
					}, `${tutorialPage + 1}/${PlaygroundController.tutorial.tutorial_steps.length}`),
					m(Button, {
						text: getString('@btnNext', 'core'),
						onclick: PlaygroundController.nextTutorialPage,
						disabled: tutorialPage >= PlaygroundController.tutorial.tutorial_steps.length || tutorial.action != undefined
					})
				],
				class: 'tutorial-card'
			});

			/**
             * Place card next to the highlighted element
             */
			if (tutorialCard != undefined) {
				if (highlightedEl != undefined) {

					// Handle mobile view
					if (mobile && !hidden) {
						// Determine tab highlighted el is on
						var getTabIndexForEl = el => {
							while (el.parentNode.className != 'content') {
								el = el.parentNode;
							}
							switch (el.id) {
							case 'visualise': return 0;
							case 'simulate': return 1;
							case 'emulate': return 2;
							default: return -1;
							}
						};

						// Update tab if required
						var index = getTabIndexForEl(highlightedEl);
						if (TabController.index != index) TabController.setTab(index);
					}

					// Scroll into view if required
					var highlightedElBox = highlightedEl.getBoundingClientRect();
					if (!hidden && (highlightedElBox.top < 80 || highlightedElBox.top + highlightedElBox.height + 10 > window.innerHeight)) {
						highlightedEl.scrollIntoView();
					}

					// Affix the element
					tutorialCard.affix(highlightedEl);

				} else {
					// Remove any affixes
					tutorialCard.free();
				}
			}

			return m('div', {
				class: 'tutorial',
				style: style
			}, [
				card
			]);
		}
	};

	/*
     * Views
     */

	/**
     * Home page view
     */
	var HomeView = {
		view: function () {

			if (tutorials == undefined) return;

			var forEach = (x, f) => {
				Object.keys(x).sort((a, b) => x[a].order > x[b].order).forEach(i => {
					f(x[i], i);
				});
			};

			// Add tutorials
			var tutorialCards = [];
			forEach(tutorials, (tutorial, id) => {
				var i18nPrefix = 'tutorial/' + id;
				tutorialCards.push({
					title: getString(tutorial.title, i18nPrefix),
					subtitle: getString(tutorial.description, i18nPrefix),
					image: tutorial.image,
					info: tutorial.estimated_time + ' ' + getString('@minutes', 'core'),
					button: {
						text: getString('@btnLaunch', 'core'),
						onclick: link('/learn/' + id)
					}
				});
			});

			// Add sandboxes
			var sandboxCards = [];
			forEach(sandboxes, (sandbox, id) => {
				var i18nPrefix = 'simulator/' + id;
				sandboxCards.push({
					title: getString(sandbox.displayName, i18nPrefix),
					subtitle: getString(sandbox.description, i18nPrefix),
					image: sandbox.image,
					button: {
						text: getString('@btnLaunch', 'core'),
						onclick: link('/play/' + id)
					}
				});
			});

			// Return layout
			return m('main', [
				m(Header, {
					isHome: true
				}),
				m(HeroSection),
				m('div', {
					class: 'container'
				}, [
					m(CardSection, {
						title: getString('@tutorials', 'core'),
						cards: tutorialCards
					}),
					m(CardSection, {
						title: getString('@sandbox', 'core'),
						cards: sandboxCards
					})
				])
			]);
		}
	};

	/**
     * 404 error page
     */
	var Error404 = {
		view: function () {
			return m('div', {
				class: 'error'
			}, [
				m('img', {
					src: 'img/taxi.png',
					width: 100,
					height: 100
				}),
				m('h1', '404 not found'),
				m('p', 'Looks like you\'ve taken a wrong turn!'),
				m(Button, {
					text: getString('@btnHome', 'core'),
					onclick: link('/')
				})
			]);
		}
	};

	/**
     * Tutorial view
     * @param {String} id the id of the tutorial
     */
	var TutorialView = {
		view: function (vnode) {

			// Fetch the tutorial id
			var id = vnode.attrs.id;

			// Load the tutorial
			PlaygroundController.setTutorial(id);

			// Simulator object
			var simulation = (id) ? PlaygroundController.tutorial.simulator : {
				name: 'taxi',
				inputs: ['taxiCount', 'journeyFrequency', 'gridSize'],
				outputs: ['profit', 'missed', 'pickUpTime'],
				steps: 1000
			};

			// Sidebar contents
			var simulators = [];
			var emulators = [];

			// Add the end card if we have reached the end of the tutorial
			var completed = PlaygroundController.tutorial != undefined && PlaygroundController.tutorialPage == PlaygroundController.tutorial.tutorial_steps.length;
			if (completed) {
				// Push the end card
				simulators.push(m(EndCard));

				// Ensure simulator is unpaused
				if (PlaygroundController.simulator != undefined)
					PlaygroundController.simulator.setPaused(false);

				/**
                 * Set simulator values
                 */
				var end_card = (PlaygroundController.tutorial != undefined) ?
					PlaygroundController.tutorial.end_card : undefined;
				if (end_card.simulator_values != undefined && PlaygroundController.simulator != undefined) {
					var inputs = PlaygroundController.simulator.getInputs();
					Object.keys(end_card.simulator_values).forEach(k => {
						if (inputs[k].value != end_card.simulator_values[k]) {
							PlaygroundController.setValue(k, end_card.simulator_values[k]);
						}
					});
				}
			}



			simulators.push([
				m(SimulatorInputsComponent, {
					editable: simulation.inputs
				}),
				m('div', m(SimulatorOutputsComponent))
			]);

			if (PlaygroundController.tutorial != undefined && PlaygroundController.tutorial.emulators != undefined)
				PlaygroundController.tutorial.emulators.forEach(e => {
					if (e.showOnStep != undefined) {
						e.hidden = e.showOnStep > PlaygroundController.tutorialPage;
					}
					emulators.push(m(EmulatorComponent, e));
				});

			// Handle mobile layout
			if (mobile) {
				var index = TabController.index;

				return [
					m('div', {
						id: 'visualise',
						class: 'visualiser'
					}, [
						m(Visualisation, {
							simulator: simulation
						}),
						m(VisualisationControls)
					]),
					m('div', { 
						id: 'simulate',
						class: 'mobile-container' + ((index != 1) ? ' hidden' : '') 
					}, simulators),
					m('viv', {
						id: 'emulate',
						class: 'mobile-container' + ((index != 2) ? ' hidden' : '')
					}, emulators),
					m(TutorialComponent)
				];
			}


			return [
				// Visualisation
				m('div', {
					class: 'visualiser'
				}, [
					m(Visualisation, {
						simulator: simulation
					}),
					m(VisualisationControls)
				]),
				// Sidebar
				m('div', {
					class: 'sidebar'
				}, [
					m('div', simulators),
					m('div', emulators)
				]),
				m(TutorialComponent)
			];

		}
	};

	/**
     * Sandbox view
     * @param {String} simulator the id of the simulator
     */
	var SandboxView = {
		oninit: function () {
			PlaygroundController.unsetTutorial();
		},
		view: function (vnode) {

			var sim = vnode.attrs.simulator;

			var simulation = {
				name: sim,
				inputs: ['taxiCount', 'journeyFrequency', 'gridSize'],
				outputs: ['profit', 'missed', 'pickUpTime'],
				steps: 1000
			};

			var simulators = [
				m(SimulatorInputsComponent),
				m('div', m(SimulatorOutputsComponent))
			];
			var emulators = [ m(EmulatorControllerComponent) ];

			PlaygroundController.emulatorDefinitions.forEach(e => {
				e.showHyperparameters = true;
				e.showControls = true;
				emulators.push(m(EmulatorComponent, e));
			});

			// Handle mobile layout
			if (mobile) {
				var index = TabController.index;

				return [
					m('div', {
						class: 'visualiser'
					}, [
						m(Visualisation, {
							simulator: simulation
						}),
						m(VisualisationControls)
					]),
					m('div', { class: 'mobile-container' + ((index != 1) ? ' hidden' : '') }, simulators),
					m('viv', { class: 'mobile-container' + ((index != 2) ? ' hidden' : '')}, emulators)
				];
			}

			return [
				// Visualisation
				m('div', {
					class: 'visualiser'
				}, [
					m(Visualisation, {
						simulator: simulation
					}),
					m(VisualisationControls)
				]),
				// Sidebar
				m('div', {
					class: 'sidebar'
				}, [
					m('div', simulators),
					m('div', emulators)
				])
			];

		}
	};

	/**
     * Playground view
     * The active simulator page
     */
	var PlaygroundView = {
		view: function (vnode) {
			// Ensure tutorials are loaded
			if (!loaded) return;

			var id = vnode.attrs.id;
			var sim = vnode.attrs.simulator;

			var content;

			if (sim != undefined && simulators[sim] != undefined) {
				// Sandbox mode
				content = m(SandboxView, {
					simulator: sim
				});
			} else if (tutorials[id] != undefined) {
				// Tutorial mode
				content = m(TutorialView, {
					id: id
				});
			} else {
				// 404
				return m(Error404);
			}

			// Return the view
			return m('main', [
				m(Header, {
					isHome: false
				}),
				m(Tabs),
				m('div', {
					class: 'content'
				}, content),
			]);
		}
	};

	/**
	 * Handles a window resize event
	 */
	function resize() {
		var newWidth = global.innerWidth;

		if (!mobile && newWidth <= 1000) {
			mobile = true;
			m.redraw();
		} else if (mobile && newWidth > 1000) {
			mobile = false;
			m.redraw();
		}
	}

	/*
     * Public methods
     */

	/**
     * Registers a simulator with the playground.
     * 
     * Details should contain a name, a displayName, description, image,
     * and order.
     * 
     * The simulation method should initiate the simulator ready for use
     * by the playground. This method is passed container and options.
     * The container is the DOM element to initiate the visual aspects of
     * the simulator within, and options is an object containing the
     * maxSteps, an onOutputsUpdated callback, and an onFinish callback.
     * 
     * The simulation method should return an object with the following
     * properties:
     * - {Function} getInputs: Returns a dictionary of inputs to the simulator
     * - {Function} getOutputs: Returns a dictionary of outputs from the simulator
     * - {Function} setPaused: Method to toggle simulation state
     * - {Function} setValue: Method to update an input of the simulation
     * - {Function} dispose: Cleans up the simulation
     * - {Function} startSimulation: Method to start a run of the simulation
     * 
     * @param {Object} details contains details about the simulator
     * @param {Function} simulation function to initiate the simulator
     */
	function registerSimulation(details, simulation) {
		simulators[details.name] = simulation;
		PlaygroundController.notifySimulatorLoad(details.name);
		sandboxes[details.name] = details;
	}

	/*
     * Sets up routes, loads languages and tutorial
     */
	function init() {

		// Check if on mobile
		if (global.innerWidth <= 1000) {
			mobile = true;
		}

		// Load tutorials
		m.request({
			method: 'GET',
			url: 'config/tutorials.json',
		}).then(function (data) {
			tutorials = data;
			loaded = true;
		});

		// Load i18n strings
		languages.forEach(function (lang) {
			m.request({
				method: 'GET',
				url: `config/i18n/${lang}.json`
			}).then(function (data) {
				strings[lang] = data;
			});
		});

		// Configure routes
		m.route(root, '/', {
			'/': HomeView,
			'/learn/:id': PlaygroundView,
			'/play/:simulator': PlaygroundView
		});

	}

	// Init on page load
	global.addEventListener('load', init);
	global.addEventListener('resize', resize);

	// Export public interface
	return {
		registerSimulation: registerSimulation
	};

})(this);