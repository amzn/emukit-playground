# Simulators

## Adding new simulators
Further simulators can be added by calling the `Playground.registerSimulation(name, simulation)` method.

This method takes two parameters, `name` which specifies the name of the simulation, and `simulation` which is a function that takes the following parameters:

| Parameter name | Type   | Description |
| -------------- | ------ | ----------- |
| `container`    | string | The DOM element that the visual portion of the simulator should be initiated in. |
| `options`      | object | The options object can contain `onOutputsUpdated` (a callback for handling when an output has been updated), `onFinish` (a callback for handling when a simulation run has finished) and `maxSteps` (the total number of steps that the simulation should run for, default: 10000). |

The `simulation` function should return an object with the following values:

- `init` - A function that initiates the visual aspects of the simulator.
- `getInputs` - A function which returns the inputs object. (See the "Specifying Inputs" section)
- `getOutputs` - A function which returns the outputs object. (See the "Specifying Outputs" section)
- `setPaused` - A function which takes a boolean to set the state of the simulator to paused or unpaused.
- `setValue` - A function taking parameters `key` and `value` which sets the value of an input.
- `dispose` - A function to dispose of the simulation
- `startSimulation` - A function to start a run of the simulation.

### Specifying Inputs
The `getInputs` function returned from the simulation method should return an object of the inputs. Each input can specify a display name, description, default value, min and max values, and a boolean specifying if the input is hidden from the simulation inputs section by default. Below is an example taken from the taxis simulator:

```javascript
/**
 * The inputs of the simulator
 */
var inputs = {
    gridSize: {
        displayName: '@numRoads/title', // The user friendly display name - can use i18n strings
        description: '@numRoads/description', // The user friendly description of this input
        value: 5, // The default value
        min: 3, // The minimum value
        max: 10, // The maximum value
        hidden: false // Determines if this input is hidden (default is false)
    },
    ...
}
```

### Specifying Outputs
The `getOutputs` function returned from the simulation method should return an object of the outputs. Each output can specify a display name, value, a `toString` function used for formatting the value, and a boolean specifying if the output is hidden from the simulation outputs section. Below is an example taken from the taxi simulator:

```javascript
/**
 * The outputs of the simulator
 */
var outputs = {
    profit: {
        displayName: '@profit', // The user friendly display name - can use i18n strings
        value: 0, // The value of the output
        toString: function() { // Formatting function
            // Display as $### if under $1000, or $#.#k if over
            if (this.value < -1000) return '-$' + Math.abs((this.value/1000).toFixed(1)) + 'k'
            else if (this.value < 0) return '-$' + Math.abs(this.value.toFixed(2)); 
            else if (this.value < 1000) return '$' + this.value.toFixed(2); 
            else return '$' + (this.value/1000).toFixed(1) + 'k'
        }
    },
    ...
}
```