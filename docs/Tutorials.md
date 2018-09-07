# Tutorials

Tutorials are stored in JSON and accessible at `[Project Root]/config/tutorials.json`

## Adding new tutorials

Tutorials can be added by modifying the tutorials.json file.

Below is an example of the structure of a tutorial:

```json
"introduction": {
    "order": 1,
    "title": "@title",
    "description": "@description",
    "estimated_time": 3,
    "image": "img/sim.png",
    "simulator": {
        "name": "taxi",
        "inputs": [ "taxiCount", "journeyFrequency", "gridSize" ],
        "outputs": [ "profit", "missed", "pickUpTime" ],
        "steps": 1000
    },
    "tutorial_steps": [ 
        ...
        { 
            "highlight": "playButton", 
            "trigger": "endSimulation",
            "action": "playSimulation",
            "simulator_values": {
                "taxiCount": 5
            }
        },
        ... 
    ],
    "emulators": [
        {
            "id": "taxisvsprofit",
            "title": "@emulator1/title",
            "input": "taxiCount",
            "output": "profit",
            "xAxisLabel": "Number of Taxis",
            "yAxisLabel": "Profit ($)",
            "hyperparameters": {
                "variance": 10000,
                "length": 15,
                "noise": 0.0225
            },
            "hidden": true,
            "showOnStep": 8,
            "showSensitivity": false
    }],
    "end_card": {
        "next_tutorial": "bayesian_optimisation",
        "extra_action": "Try changing different inputs of the simulator to see the effect on the outputs."
    }
}
```

The key of the object represents the unique ID of the tutorial. Tutorials are accessible in the application at  the `#!/learn/[Tutorial ID]` endpoint.

Tutorial objects contain the following properties:

| Parameter name | Type   | Description |
| -------------- | ------ | ----------- |
| `order`        | number | The index of the tutorial used to sort tutorials on the home page. Lower values appear first. |
| `title`        | string | The user facing title of the tutorial. Can use i18n strings, such as `@title` (maps to `@tutorial/[Tutorial ID]/title`) |
| `description`  | string | The user facing description. Can use i18n strings, such as `@description` (maps to `@tutorial/[Tutorial ID]/description`) |
| `estimated_time`| number | The estimated completion time in minutes for this tutorial. Displayed on home page. |
| `image`        | string | The URL of the image. Displayed on home page. |
| `simulator`    | object | The simulator configuration. Defines the name of the simulator, the visible inputs and outputs for this tutorial (defaults to all) and the number of steps per simulation run (defaults to 1000). |
| `tutorial_steps`| array | The steps featured in the tutorial. See the "Defining tutorial steps" section for details. |
| `emulators`    | array | (Optional) Contains emulator configuration. `hidden` specifies if the emulator is shown at the start of the tutorial. |


## Definining tutorial steps

Each tutorial step is an object contained within `tutorial_steps` with the following properties:

| Parameter name | Type   | Description |
| -------------- | ------ | ----------- |
| `highlight`    | string | The ID of the object to highlight to the user. Specifying `"highlight": "self"` shows the card in the middle of the screen. |
| `trigger`      | string | (Optional) If a trigger is specified, the card waits for an action to occur before displaying the card. Allowed options for trigger include `midSimulation` and `endSimulation`, which cause cards to appear at 90% completion and upon completion of a simulation run respectively. |
| `action`       | string | (Optional) If an action is specified, the next button is disabled and the user is required to perform an action (such as click the play button, specified by setting action to `playSimulation`) before the tutorial is progressed. |
| `simulation_values`| object | (Optional) If specified, the input defined by the key of an entry is set to the value upon this tutorial step activating. |


## Emulators

Emulators can optionally be added to a tutorial by specifying each of them in the `emulators` array as an object with the following properties:

| Parameter name | Type   | Description |
| -------------- | ------ | ----------- |
| `id`           | string | The ID of the object to highlight to the user. This may also be used for highlighting in a tutorial step. |
| `title`      | string | (Optional) The title of this emulator. If left unset, the title is generated from the display names of the input and output fields. |
| `input`       | string | The ID of the input to the simulator. |
| `output`| string | The ID of the output of the simulator |
| `xAxisLabel`       | string | (Optional) The label shown on the X axis of the emulator. |
| `yAxisLabel`       | string | (Optional) The label shown on the Y axis of the emulator. |
| `hyperparameters` | Object | (Optional) The hyperparameters of this emulator, including `variance`, `length` (the length scale) and `noise`. |
| `showOnStep` | Number | If set, the emulator is not shown until the user reaches the step given |
| `showSensitivity` | Boolean | If true, the sensitivity (derivative of the mean) is displayed on the emulator at the current input value. |


## End card

The end card is used to direct users to test their knowledge, and once ready move on to the next tutorial.

The `end_card` object has the following properties: 

| Parameter name | Type   | Description |
| -------------- | ------ | ----------- |
| `next_tutorial`| string | The ID of the next tutorial in the series, which is linked to the user upon completion of this tutorial. |
| `extra_action` | string | Provides the user with a task to complete to test their knowledge based on the tutorial. |
| `simulation_values`| object | (Optional) If specified, the input defined by the key of an entry is set to the value upon this tutorial step activating. |