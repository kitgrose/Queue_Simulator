// Main application module that coordinates the curve editor and simulator
class QueueSimulatorApp {
    constructor() {
        this.curveEditor = null;
        this.simulator = null;
    }

    initialize() {
        // Gather all DOM elements that the modules need
        const curveEditorElements = {
            svg: document.getElementById('curveSvg'),
            controlInputs: {
                p0x: document.getElementById('p0x'),
                p0y: document.getElementById('p0y'),
                p1x: document.getElementById('p1x'),
                p1y: document.getElementById('p1y'),
                p2x: document.getElementById('p2x'),
                p2y: document.getElementById('p2y'),
                p3x: document.getElementById('p3x'),
                p3y: document.getElementById('p3y'),
                p4x: document.getElementById('p4x'),
                p4y: document.getElementById('p4y'),
                p5x: document.getElementById('p5x'),
                p5y: document.getElementById('p5y'),
                p6x: document.getElementById('p6x'),
                p6y: document.getElementById('p6y')
            }
        };

        const simulatorElements = {
            kiosksList: document.querySelector('.kiosks'),
            completedCount: document.querySelector('.completed-count'),
            completedList: document.querySelector('.completed'),
            numKiosksInput: document.getElementById('numKiosks'),
            simulationSpeedInput: document.getElementById('simulationSpeed'),
            simulationSpeedOutput: document.getElementById('simulationSpeedOutput'),
            numAttendeesInput: document.getElementById('numAttendees'),
            secondsAtKioskInput: document.getElementById('secondsAtKiosk')
        };

        const playPauseButton = document.getElementById('playpause');

        // Initialize curve editor with DOM elements
        this.curveEditor = new CurveEditor(curveEditorElements.svg, curveEditorElements.controlInputs);
        this.curveEditor.initialize();

        // Initialize simulator with DOM elements (no direct curve editor dependency)
        this.simulator = new QueueSimulation(simulatorElements);

        // Set up event listeners for simulator events
        this.setupSimulatorEventListeners(playPauseButton);

        // Initialize kiosk count
        this.simulator.updateKioskCount();

        // Expose global functions for HTML event handlers
        this.setupGlobalFunctions();
    }

    setupSimulatorEventListeners(playPauseButton) {
        // Listen for simulation time updates and forward them to the curve editor
        this.simulator.addEventListener('simulationTimeUpdate', (event) => {
            this.curveEditor.updateSimulationTime(event.detail.time);
        });

        // Listen for simulation completion and show results
        this.simulator.addEventListener('simulationCompleted', (event) => {
            const { maxQueueLength, averageQueueLength } = event.detail;
            playPauseButton.classList.remove('playing');
            alert(`Simulation completed. Max queue length observed: ${maxQueueLength}. Average queue length observed: ${averageQueueLength.toFixed(1)}.`);
        });

        // Listen for simulation status updates and update the play/pause button state
        this.simulator.addEventListener('simulationPaused', (event) => {
            playPauseButton.textContent = 'Continue';
            playPauseButton.classList.remove('playing');
            playPauseButton.classList.add('paused');
        });

        this.simulator.addEventListener('simulationResumed', (event) => {
            playPauseButton.textContent = 'Pause';
            playPauseButton.classList.remove('paused');
            playPauseButton.classList.add('playing');
        });
    }

    setupGlobalFunctions() {
        // Global functions that can be called from HTML event handlers
        window.setPreset = (type) => {
            this.curveEditor.setPreset(type);
        };

        window.updateKioskCount = () => {
            try {
                this.simulator.updateKioskCount();
            } catch (error) {
                alert(error.message);
            }
        };

        window.updateSimulationSpeed = () => {
            this.simulator.updateSimulationSpeed();
        };

        window.initialiseSimulation = () => {
            try {
                // Get arrival times from the curve editor
                const numAttendees = parseInt(document.getElementById('numAttendees').value);
                if (isNaN(numAttendees) || numAttendees <= 0) {
                    alert('Please enter a valid number of attendees.');
                    return;
                }

                const arrivalTimes = this.curveEditor.generateArrivalTimes(numAttendees);
                this.simulator.initialiseSimulation(arrivalTimes);
            } catch (error) {
                // Handle exceptions from QueueSimulation by showing alerts for now
                alert(error.message);
            }
        };

        window.playSimulation = () => {
            this.simulator.playSimulation();
        };

        window.pauseSimulation = () => {
            this.simulator.pauseSimulation();
        };

        window.toggleSimulation = () => {
            this.simulator.toggleSimulation();
        };
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new QueueSimulatorApp();
    app.initialize();
});
