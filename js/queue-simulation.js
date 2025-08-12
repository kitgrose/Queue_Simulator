// Custom exception classes for QueueSimulation
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

class SimulationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SimulationError';
    }
}

// Simulation module for handling the queue simulation logic
class QueueSimulation extends EventTarget {
    constructor(domElements) {
        super();
        this.maxDurationHours = 8;
        this.maxDurationTicks = this.maxDurationHours * 60;

        // Store DOM element references
        this.kiosksList = domElements.kiosksList;
        this.completedCount = domElements.completedCount;
        this.completedList = domElements.completedList;
        this.numKiosksInput = domElements.numKiosksInput;
        this.simulationSpeedInput = domElements.simulationSpeedInput;
        this.simulationSpeedOutput = domElements.simulationSpeedOutput;
        this.numAttendeesInput = domElements.numAttendeesInput;
        this.secondsAtKioskInput = domElements.secondsAtKioskInput;

        this.simulationSpeed = this.simulationSpeedInput.value;
        this.simulationInterval = null;
        this.attendees = [];
        this.observedQueueLengths = [];
        this.currentTick = 0;
    }

    updateKioskCount() {
        const numKiosks = parseInt(this.numKiosksInput.value);
        if (isNaN(numKiosks) || numKiosks <= 0) {
            throw new ValidationError('Please enter a valid number of kiosks (greater than 0).');
        }

        // Create kiosks
        this.kiosksList.innerHTML = ''; // Clear existing kiosks
        for (let i = 0; i < numKiosks; i++) {
            const kiosk = document.createElement('li');
            kiosk.classList.add('kiosk');
            kiosk.innerHTML = `<ol class="queue"></ol>`;
            this.kiosksList.appendChild(kiosk);
        }
    }

    updateSimulationSpeed() {
        this.simulationSpeed = this.simulationSpeedInput.value;
        this.simulationSpeedOutput.value = this.simulationSpeed;
        console.log(`Simulation speed updated to ${this.simulationSpeed} simulated minutes per second`);

        // If the simulation is running, update the interval but keep running.
        if (this.simulationInterval) {
            console.log(`Simulation already running, updating interval to run every ${1000 / this.simulationSpeed} milliseconds`);
            clearInterval(this.simulationInterval);
            this.simulationInterval = setInterval(() => this.tick(), 1000 / this.simulationSpeed);
        }
    }

    initialiseSimulation(arrivalTimes) {
        this.resetSimulation(arrivalTimes);
        this.playSimulation();
    }

    resetSimulation(arrivalTimes) {
        const numAttendees = parseInt(this.numAttendeesInput.value);
        const numKiosks = parseInt(this.numKiosksInput.value);
        const secondsAtKiosk = parseFloat(this.secondsAtKioskInput.value);

        if (isNaN(numAttendees) || isNaN(numKiosks) || isNaN(secondsAtKiosk) || numAttendees <= 0 || numKiosks <= 0 || secondsAtKiosk <= 0) {
            throw new ValidationError('Please enter valid numbers for all fields.');
        }

        if (!arrivalTimes || arrivalTimes.length !== numAttendees) {
            throw new SimulationError('Invalid arrival times provided.');
        }

        this.currentTick = 0;
        this.observedQueueLengths = []; // Reset the observed queue lengths

        // Fire event for simulation time update
        this.dispatchEvent(new CustomEvent('simulationTimeUpdate', { detail: { time: 0 } }));

        // Clear all kiosks
        const kiosks = document.querySelectorAll('.kiosk .queue');
        kiosks.forEach(queue => {
            queue.innerHTML = ''; // Clear each queue
        });

        // Clear the completed list
        this.completedCount.value = 0;
        this.completedList.innerHTML = ''; // Clear existing completed items

        // Create the attendee list based on the provided arrival times
        this.attendees = [];
        for (let i = 0; i < numAttendees; i++) {
            const attendee = {
                id: i + 1,
                arrivalTimeOffsetMilliseconds: arrivalTimes[i],
            };
            this.attendees.push(attendee);
        }

        this.dispatchEvent(new CustomEvent('simulationReset'));
    }

    playSimulation() {
        console.log(`Running simulation with one tick every ${(1000 / this.simulationSpeed).toFixed(1)} milliseconds`);
        this.simulationInterval = setInterval(() => this.tick(), 1000 / this.simulationSpeed);
        this.dispatchEvent(new CustomEvent('simulationResumed'));
    }

    pauseSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;

            this.dispatchEvent(new CustomEvent('simulationPaused'));
        }
    }

    toggleSimulation() {
        if (this.simulationInterval) {
            this.pauseSimulation();
        } else {
            this.playSimulation();
        }
    }

    tick() {
        const numPeopleStillInQueues = document.querySelectorAll('.kiosk .queue .attendee').length;
        if (this.currentTick >= this.maxDurationTicks || (this.attendees.length === 0 && numPeopleStillInQueues === 0)) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;

            // Keep the time indicator visible when simulation completes naturally

            // Report the max & average queue length we saw
            const maxQueueLength = Math.max(...this.observedQueueLengths);
            const averageQueueLength = this.observedQueueLengths.reduce((sum, length) => sum + length, 0) / this.observedQueueLengths.length;

            // Fire completion event instead of showing alert
            this.dispatchEvent(new CustomEvent('simulationCompleted', {
                detail: {
                    maxQueueLength,
                    averageQueueLength
                }
            }));
            return;
        }

        // Fire event for simulation time update
        this.dispatchEvent(new CustomEvent('simulationTimeUpdate', { detail: { time: this.currentTick } }));

        const queues = document.querySelectorAll('.kiosk .queue');

        // Add any attendees from the attendees list that arrived in the past minute to the queues, balancing them across all kiosks
        this.attendees = this.attendees.filter(attendee => {
            if (attendee.arrivalTimeOffsetMilliseconds <= this.currentTick * 60000) {
                // Find the kiosk with the shortest queue
                let shortestQueue = null;
                for (let i = 0; i < queues.length; i++) {
                    const queue = queues[i];
                    if (!shortestQueue || queue.children.length < shortestQueue.children.length) {
                        shortestQueue = queue;
                    }
                }

                if (shortestQueue) {
                    const attendeeElement = document.createElement('li');
                    attendeeElement.classList.add('attendee');
                    attendeeElement.textContent = attendee.id;
                    attendeeElement.dataset.timeIn = attendee.arrivalTimeOffsetMilliseconds;
                    shortestQueue.appendChild(attendeeElement);
                    return false; // Remove this attendee from the list
                }
            }

            return true; // Keep this attendee in the list
        });

        // Process each kiosk based on the time at kiosk
        const secondsAtKiosk = parseInt(this.secondsAtKioskInput.value);
        const minutesAtKiosk = secondsAtKiosk / 60;
        const numberOfPeopleToRemoveFromEachQueuePerTick = 1 / minutesAtKiosk;

        queues.forEach(queue => {
            const attendeesInQueue = queue.children;
            const numberOfAttendeesToProcess = Math.min(Math.max(1, Math.floor(numberOfPeopleToRemoveFromEachQueuePerTick)), attendeesInQueue.length);
            const offsetPerTick = secondsAtKiosk * 1000 / numberOfAttendeesToProcess;
            const startOffset = Math.max(0, this.currentTick - 1) * 60000;

            for (let i = 0; i < numberOfAttendeesToProcess; i++) {
                const attendeeElement = attendeesInQueue[0];
                if (attendeeElement) {
                    // If the attendee has been at the front of the queue long enough to be processed, remove them from the queue
                    if (!attendeeElement.dataset.timeReachedFrontOfQueue) {
                        attendeeElement.dataset.timeReachedFrontOfQueue = startOffset + (i * offsetPerTick);
                    }

                    if (attendeeElement.dataset.timeReachedFrontOfQueue < (this.currentTick - minutesAtKiosk) * 60000) {
                        // Record the time out
                        attendeeElement.dataset.timeOut = startOffset + (i * offsetPerTick);

                        // Move the attendee to the completed list
                        this.completedCount.value++;
                        this.completedList.appendChild(attendeeElement);

                        // Mark the next attendee as having reached the front of the queue
                        if (i < attendeesInQueue.length - 1) {
                            const nextAttendeeElement = attendeesInQueue[i + 1];
                            if (nextAttendeeElement) {
                                nextAttendeeElement.dataset.timeReachedFrontOfQueue = startOffset + (i * offsetPerTick);
                            }
                        }
                    }
                }
            }
        });

        this.observedQueueLengths = this.observedQueueLengths.concat(Array.from(queues).map(queue => queue.children.length));
        this.currentTick++;
    }
}
