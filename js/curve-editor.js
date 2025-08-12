// Curve editor module for handling arrival pattern curves
class CurveEditor {
    constructor(svgElement, controlPointInputs) {
        this.maxDurationHours = 8;
        this.maxDurationTicks = this.maxDurationHours * 60;
        this.isDragging = false;
        this.dragPoint = null;
        this.svg = svgElement;
        this.controlPointInputs = controlPointInputs; // Object containing all control point input elements
        this.currentSimulationTime = 0;
        this.selectedAnchor = null; // Track which anchor is selected

        // Extract dimensions and offsets from SVG markup
        this.updateDimensions();
    }

    // Extract SVG dimensions and offsets from the markup
    updateDimensions() {
        // Get the rect element inside the SVG to determine the drawing area
        const rect = this.svg.querySelector('.chart-background');
        if (rect) {
            this.svgWidth = parseFloat(rect.getAttribute('width'));
            this.svgHeight = parseFloat(rect.getAttribute('height'));
        } else {
            // Fallback to hardcoded values if rect not found
            this.svgWidth = 800;
            this.svgHeight = 200;
        }

        // Extract offsets from viewBox
        const viewBox = this.svg.getAttribute('viewBox');
        if (viewBox) {
            const viewBoxValues = viewBox.split(' ').map(v => parseFloat(v));
            // viewBox format: "x y width height", offsets are the negative of x and y
            this.offsetX = Math.abs(viewBoxValues[0]);
            this.offsetY = Math.abs(viewBoxValues[1]);
        } else {
            // Fallback to hardcoded values if viewBox not found
            this.offsetX = 20;
            this.offsetY = 20;
        }
    }

    initialize() {
        this.updateDimensions(); // Ensure dimensions are current
        this.setPreset('default', false);
        this.setupEventListeners();
        this.drawCurve();
        this.setupDocumentClickListener();
    }

    setupDocumentClickListener() {
        // Add click listener to document to deselect anchor when clicking elsewhere
        document.addEventListener('click', (e) => {
            // Check if click is inside the SVG or on a control element
            const isInsideSvg = this.svg.contains(e.target);
            const isAnchorPoint = e.target.hasAttribute && e.target.hasAttribute('data-point-id') &&
                                  e.target.classList.contains('curve-control-anchor');

            if (!isInsideSvg || (!isAnchorPoint && isInsideSvg)) {
                if (this.selectedAnchor) {
                    this.selectedAnchor = null;
                    this.drawCurve();
                }
            }
        });
    }

    getControlPointValues() {
        const values = {};
        Object.keys(this.controlPointInputs).forEach(id => {
            values[id] = parseFloat(this.controlPointInputs[id].value);
        });
        return values;
    }

    setControlPointValues(values) {
        Object.keys(values).forEach(id => {
            if (this.controlPointInputs[id]) {
                this.controlPointInputs[id].value = values[id].toFixed(3);
            }
        });
    }

    setupEventListeners() {
        // Add event listeners to control points
        Object.keys(this.controlPointInputs).forEach(id => {
            this.controlPointInputs[id].addEventListener('input', () => {
                if (id === 'p3x' || id === 'p3y') {
                    // When peak point moves, maintain G1 continuity
                    const continuityValues = CurveEditor.enforceG1Continuity(this.getControlPointValues());
                    this.setControlPointValues(continuityValues);
                }
                this.drawCurve();
            });
        });

        this.svg.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.svg.addEventListener('mouseup', () => this.handleMouseUp());

        // Also handle mouseup on document to catch cases where mouse is released outside SVG
        document.addEventListener('mouseup', () => this.handleMouseUp());
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.dragPoint) {
            return;
        }

        const rect = this.svg.getBoundingClientRect();
        const coordinates = CurveEditor.screenToNormalizedCoordinates(
            e.clientX, e.clientY, rect, this.offsetX, this.offsetY, this.svgWidth, this.svgHeight
        );
        const currentValues = this.getControlPointValues();
        const newValues = CurveEditor.updateDraggedPoint(currentValues, this.dragPoint, coordinates.x, coordinates.y);
        this.setControlPointValues(newValues);
        this.drawCurve();
    }

    // Convert screen coordinates to normalized coordinates between 0 and 1
    static screenToNormalizedCoordinates(clientX, clientY, svgRect, offsetX, offsetY, svgWidth, svgHeight) {
        // Convert screen coordinates to SVG viewBox coordinates using passed dimensions
        const rawX = (clientX - svgRect.left - offsetX) / svgWidth;
        const rawY = (clientY - svgRect.top - offsetY) / svgHeight;

        let x = rawX, y = 1 - rawY;

        // Constrain to curve bounds even when cursor leaves
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));

        return { x, y };
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.dragPoint) {
            return;
        }

        const rect = this.svg.getBoundingClientRect();
        const coordinates = CurveEditor.screenToNormalizedCoordinates(
            e.clientX, e.clientY, rect, this.offsetX, this.offsetY, this.svgWidth, this.svgHeight
        );

        const currentValues = this.getControlPointValues();
        const newValues = CurveEditor.updateDraggedPoint(currentValues, this.dragPoint, coordinates.x, coordinates.y);
        this.setControlPointValues(newValues);
        this.drawCurve();
    }

    handleMouseUp() {
        if (this.isDragging) {
            this.isDragging = false;
            // Reset cursor on all circles - cursor is now handled by CSS
            const circles = this.svg.querySelectorAll('circle[data-point-id]');
            circles.forEach(circle => {
                circle.style.cursor = '';
            });
            this.dragPoint = null;
            this.svg.style.cursor = 'default';
        }
    }

    static updateDraggedPoint(currentValues, dragPoint, x, y) {
        const newValues = { ...currentValues };

        if (dragPoint === 'p0') {
            // Start anchor - both x and y coordinates can change, move adjacent control point p1 with it
            const deltaX = x - currentValues.p0x;
            const deltaY = y - currentValues.p0y;
            newValues.p0x = x;
            newValues.p0y = y;
            // Move adjacent control point p1 by the same delta to maintain relationship
            newValues.p1x = Math.max(0, Math.min(1, currentValues.p1x + deltaX));
            newValues.p1y = Math.max(0, Math.min(1, currentValues.p1y + deltaY));

        } else if (dragPoint === 'p1') {
            // Control point - free movement
            newValues.p1x = x;
            newValues.p1y = y;
        } else if (dragPoint === 'p2') {
            // Peak control 1 - maintain collinearity and prevent crossing
            const peakControlUpdate = CurveEditor.updatePeakControl(currentValues, 'p2', x, y);
            Object.assign(newValues, peakControlUpdate);
        } else if (dragPoint === 'p3') {
            // Peak anchor - move both control points with it to maintain relationships
            const deltaX = x - currentValues.p3x;
            const deltaY = y - currentValues.p3y;

            newValues.p3x = x;
            newValues.p3y = y;

            // Move adjacent control points by the same delta to maintain relationship
            newValues.p2x = Math.max(0, Math.min(1, currentValues.p2x + deltaX));
            newValues.p2y = Math.max(0, Math.min(1, currentValues.p2y + deltaY));
            newValues.p4x = Math.max(0, Math.min(1, currentValues.p4x + deltaX));
            newValues.p4y = Math.max(0, Math.min(1, currentValues.p4y + deltaY));

            const continuityUpdate = CurveEditor.enforceG1Continuity(newValues);
            Object.assign(newValues, continuityUpdate);
        } else if (dragPoint === 'p4') {
            // Peak control 2 - maintain collinearity and prevent crossing
            const peakControlUpdate = CurveEditor.updatePeakControl(currentValues, 'p4', x, y);
            Object.assign(newValues, peakControlUpdate);
        } else if (dragPoint === 'p5') {
            // Control point - free movement
            newValues.p5x = x;
            newValues.p5y = y;
        } else if (dragPoint === 'p6') {
            // End anchor - move adjacent control point p5 with it
            const deltaX = x - currentValues.p6x;
            const deltaY = y - currentValues.p6y;

            newValues.p6x = x;
            newValues.p6y = y;

            // Move adjacent control point p5 by the same delta to maintain relationship
            newValues.p5x = Math.max(0, Math.min(1, currentValues.p5x + deltaX));
            newValues.p5y = Math.max(0, Math.min(1, currentValues.p5y + deltaY));
        }

        return newValues;
    }

    // Keep peak control points collinear
    static enforceG1Continuity(values) {
        const newValues = { ...values };
        const { p3x, p3y, p2x, p2y, p4x, p4y } = values;

        // Calculate the direction vector from p2 to p3
        const dx1 = p3x - p2x;
        const dy1 = p3y - p2y;

        // Calculate distance from p3 to p4
        const dist2 = Math.sqrt((p4x - p3x) ** 2 + (p4y - p3y) ** 2);

        // Keep p4 collinear but maintain its distance
        if (dx1 !== 0 || dy1 !== 0) {
            const length1 = Math.sqrt(dx1 ** 2 + dy1 ** 2);
            const unitX = dx1 / length1;
            const unitY = dy1 / length1;

            newValues.p4x = p3x + unitX * dist2;
            newValues.p4y = p3y + unitY * dist2;
        }

        return newValues;
    }

    // Update peak control points while maintaining constraints
    static updatePeakControl(values, pointId, x, y) {
        const newValues = { ...values };
        const { p3x, p3y } = values;

        if (pointId === 'p2') {
            // Prevent crossing over peak point (must be to the left)
            if (x >= p3x) x = p3x - 0.01;
            newValues.p2x = x;
            newValues.p2y = y;

            // Update p4 to maintain collinearity
            const dx = p3x - x;
            const dy = p3y - y;
            const p4x = values.p4x;
            const p4y = values.p4y;
            const dist = Math.sqrt((p4x - p3x) ** 2 + (p4y - p3y) ** 2);

            if (dx !== 0 || dy !== 0) {
                const length = Math.sqrt(dx ** 2 + dy ** 2);
                const unitX = dx / length;
                const unitY = dy / length;

                newValues.p4x = p3x + unitX * dist;
                newValues.p4y = p3y + unitY * dist;
            }
        } else if (pointId === 'p4') {
            // Prevent crossing over peak point (must be to the right)
            if (x <= p3x) x = p3x + 0.01;
            newValues.p4x = x;
            newValues.p4y = y;

            // Update p2 to maintain collinearity
            const dx = p3x - x;
            const dy = p3y - y;
            const p2x = values.p2x;
            const p2y = values.p2y;
            const dist = Math.sqrt((p2x - p3x) ** 2 + (p2y - p3y) ** 2);

            if (dx !== 0 || dy !== 0) {
                const length = Math.sqrt(dx ** 2 + dy ** 2);
                const unitX = dx / length;
                const unitY = dy / length;

                newValues.p2x = p3x + unitX * dist;
                newValues.p2y = p3y + unitY * dist;
            }
        }

        return newValues;
    }

    // Cubic Bezier curve calculation - used for sampling to generate arrival times
    static cubicBezier(t, p0, p1, p2, p3) {
        const oneMinusT = 1 - t;
        return oneMinusT * oneMinusT * oneMinusT * p0 +
               3 * oneMinusT * oneMinusT * t * p1 +
               3 * oneMinusT * t * t * p2 +
               t * t * t * p3;
    }

    // Get curve point at time t using control point values
    static getCurvePointFromValues(values, t) {
        // Extract all control point values including p0x
        const { p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y, p5x, p5y, p6x, p6y } = values;

        // Find which segment we're in based on the peak point position
        const peakT = p3x;

        if (t <= peakT) {
            // First segment: start to peak (p0, p1, p2, p3)
            const localT = peakT > 0 ? t / peakT : 0;
            return {
                x: CurveEditor.cubicBezier(localT, p0x, p1x, p2x, p3x),
                y: CurveEditor.cubicBezier(localT, p0y, p1y, p2y, p3y)
            };
        } else {
            // Second segment: peak to end (p3, p4, p5, p6)
            const localT = (1 - peakT) > 0 ? (t - peakT) / (1 - peakT) : 0;
            return {
                x: CurveEditor.cubicBezier(localT, p3x, p4x, p5x, p6x),
                y: CurveEditor.cubicBezier(localT, p3y, p4y, p5y, p6y)
            };
        }
    }

    // Get curve point at time t (0 to 1) using piecewise cubic Bezier spline with 7 control points
    getCurvePoint(t) {
        const values = this.getControlPointValues();
        return CurveEditor.getCurvePointFromValues(values, t);
    }

    // Determine which anchor point is associated with a given control point
    getAssociatedAnchor(controlPointId) {
        switch (controlPointId) {
            case 'p1':
                return 'p0';
            case 'p2':
            case 'p4':
                return 'p3';
            case 'p5':
                return 'p6';
            default:
                return null;
        }
    }

    // Draw the curve on SVG
    drawCurve() {
        // Clear existing curve elements (except grid)
        const elementsToRemove = this.svg.querySelectorAll('.curve-element');
        elementsToRemove.forEach(el => el.remove());

        // Use dynamic dimensions
        const svgWidth = this.svgWidth;
        const svgHeight = this.svgHeight;

        // Create namespace for SVG elements
        const svgNS = "http://www.w3.org/2000/svg";

        // Draw time labels
        for (let i = 0; i <= 8; i++) {
            const x = (i / 8) * svgWidth;
            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', svgHeight - 5);
            text.setAttribute('class', 'curve-element curve-time-label');
            text.textContent = `${i}h`;
            this.svg.appendChild(text);
        }

        // Get control points using injected DOM elements
        const values = this.getControlPointValues();
        const { p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y, p5x, p5y, p6x, p6y } = values;

        // Convert normalized coordinates to SVG coordinates (no padding needed due to viewBox offset)
        const points = {
            p0: {x: p0x * svgWidth, y: svgHeight - (p0y * svgHeight)},
            p1: {x: p1x * svgWidth, y: svgHeight - (p1y * svgHeight)},
            p2: {x: p2x * svgWidth, y: svgHeight - (p2y * svgHeight)},
            p3: {x: p3x * svgWidth, y: svgHeight - (p3y * svgHeight)},
            p4: {x: p4x * svgWidth, y: svgHeight - (p4y * svgHeight)},
            p5: {x: p5x * svgWidth, y: svgHeight - (p5y * svgHeight)},
            p6: {x: p6x * svgWidth, y: svgHeight - (p6y * svgHeight)}
        };

        // Create the curve path using native SVG cubic Bézier curves
        const curvePath = `M ${points.p0.x} ${points.p0.y} C ${points.p1.x} ${points.p1.y} ${points.p2.x} ${points.p2.y} ${points.p3.x} ${points.p3.y} C ${points.p4.x} ${points.p4.y} ${points.p5.x} ${points.p5.y} ${points.p6.x} ${points.p6.y}`;

        // Create path for filled area under curve
        const fillPath = curvePath + ` L ${points.p6.x} ${svgHeight} L ${points.p0.x} ${svgHeight} Z`;

        // Draw filled area under curve
        const fillElement = document.createElementNS(svgNS, 'path');
        fillElement.setAttribute('d', fillPath);
        fillElement.setAttribute('class', 'curve-element curve-fill');
        this.svg.appendChild(fillElement);

        // Draw the curve
        const curveElement = document.createElementNS(svgNS, 'path');
        curveElement.setAttribute('d', curvePath);
        curveElement.setAttribute('class', 'curve-element curve-path');
        this.svg.appendChild(curveElement);

        // Draw handle lines (like Illustrator) - from anchor points to control points
        // Only show lines for the selected anchor
        const handleLines = [
            {x1: points.p0.x, y1: points.p0.y, x2: points.p1.x, y2: points.p1.y, anchor: 'p0'},
            {x1: points.p2.x, y1: points.p2.y, x2: points.p3.x, y2: points.p3.y, anchor: 'p3'},
            {x1: points.p3.x, y1: points.p3.y, x2: points.p4.x, y2: points.p4.y, anchor: 'p3'},
            {x1: points.p5.x, y1: points.p5.y, x2: points.p6.x, y2: points.p6.y, anchor: 'p6'}
        ];

        handleLines.forEach(line => {
            // Only show handle lines for the selected anchor
            if (this.selectedAnchor === line.anchor) {
                const lineElement = document.createElementNS(svgNS, 'line');
                lineElement.setAttribute('x1', line.x1);
                lineElement.setAttribute('y1', line.y1);
                lineElement.setAttribute('x2', line.x2);
                lineElement.setAttribute('y2', line.y2);
                lineElement.setAttribute('class', 'curve-element curve-handle-line');
                this.svg.appendChild(lineElement);
            }
        });

        // Draw control points with color scheme: blue for anchors, red for controls
        const controlPoints = [
            {id: 'p0', x: points.p0.x, y: points.p0.y, radius: 6, type: 'anchor'},
            {id: 'p1', x: points.p1.x, y: points.p1.y, radius: 4, type: 'control'},
            {id: 'p2', x: points.p2.x, y: points.p2.y, radius: 4, type: 'control'},
            {id: 'p3', x: points.p3.x, y: points.p3.y, radius: 6, type: 'anchor'},
            {id: 'p4', x: points.p4.x, y: points.p4.y, radius: 4, type: 'control'},
            {id: 'p5', x: points.p5.x, y: points.p5.y, radius: 4, type: 'control'},
            {id: 'p6', x: points.p6.x, y: points.p6.y, radius: 6, type: 'anchor'}
        ];

        controlPoints.forEach(point => {
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('cx', point.x);
            circle.setAttribute('cy', point.y);

            // Determine visibility and size based on type and selection state
            let shouldShow = true;
            let radius = point.radius;

            if (point.type === 'anchor') {
                // Anchor points: smaller when not selected, full size when selected
                radius = this.selectedAnchor === point.id ? 6 : 4;
            } else {
                // Control points: only show if their associated anchor is selected
                const associatedAnchor = this.getAssociatedAnchor(point.id);
                shouldShow = this.selectedAnchor === associatedAnchor;
            }

            circle.setAttribute('r', radius);
            const cssClass = point.type === 'anchor' ? 'curve-control-anchor' : 'curve-control-point';
            circle.setAttribute('class', `curve-element ${cssClass}`);
            circle.setAttribute('data-point-id', point.id);

            // Only show the element if it should be visible
            if (!shouldShow) {
                circle.style.display = 'none';
            }

            // Add mousedown event listener directly to the circle
            circle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // If this is an anchor point and it's not being dragged, select it
                if (point.type === 'anchor' && !this.isDragging) {
                    if (this.selectedAnchor !== point.id) {
                        this.selectedAnchor = point.id;
                        this.drawCurve(); // Redraw to show/hide control points
                    }
                }

                this.isDragging = true;
                this.dragPoint = point.id;
                circle.style.cursor = 'grabbing';
                this.svg.style.cursor = 'grabbing';
            });

            this.svg.appendChild(circle);
        });

        // Draw simulation time indicator (vertical line)
        if (this.currentSimulationTime > 0) {
            const timePosition = (this.currentSimulationTime / (this.maxDurationHours * 60)) * svgWidth;
            if (timePosition <= svgWidth) {
                // Draw vertical line
                const timeLine = document.createElementNS(svgNS, 'line');
                timeLine.setAttribute('x1', timePosition);
                timeLine.setAttribute('y1', 0);
                timeLine.setAttribute('x2', timePosition);
                timeLine.setAttribute('y2', svgHeight);
                timeLine.setAttribute('class', 'curve-element curve-simulation-time-line');
                this.svg.appendChild(timeLine);

                // Add time label at the top
                const hours = Math.floor(this.currentSimulationTime / 60);
                const minutes = this.currentSimulationTime % 60;
                const timeText = document.createElementNS(svgNS, 'text');
                timeText.setAttribute('x', timePosition + 4);
                timeText.setAttribute('y', 15);
                timeText.setAttribute('class', 'curve-element curve-simulation-time-text');
                timeText.textContent = `${hours}h ${minutes}m`;
                this.svg.appendChild(timeText);
            }
        }
    }

    static getPresetValues(type) {
        const presets = {
            'default': [
                [0, 0],
                [0.06, 0],
                [0.01, 1],
                [0.09, 1],
                [0.12, 1],
                [0.09, 0],
                [0.22, 0]
            ],
            'bell': [
                [0, 0],
                [0.37, 0],
                [0.37, 1],
                [0.5, 1],
                [0.63, 1],
                [0.63, 0],
                [1, 0]
            ],
            'flat': [
                [0, 0.5],
                [0.1, 0.5],
                [0.4, 0.5],
                [0.5, 0.5],
                [0.6, 0.5],
                [0.9, 0.5],
                [1, 0.5]
            ],
            'double': [
                [0, 1],
                [0.12, 1],
                [0.12, 0],
                [0.5, 0],
                [0.88, 0],
                [0.88, 1],
                [1, 1]
            ],
        };

        const points = presets[type];
        if (!points) {
            console.error(`Preset type "${type}" not found.`);
            return null;
        }

        // Convert to values object format
        const values = {};
        for (let i = 0; i < points.length; i++) {
            values[`p${i}x`] = points[i][0];
            values[`p${i}y`] = points[i][1];
        }
        return values;
    }

    // Preset curve configurations for piecewise cubic Bezier spline
    setPreset(type, drawCurveAfterSettingPreset = true) {
        const values = CurveEditor.getPresetValues(type);
        if (!values) return;

        this.setControlPointValues(values);

        if (drawCurveAfterSettingPreset) {
            this.drawCurve();
        }
    }

    // Generate arrival times based on curve values
    static generateArrivalTimesFromValues(values, numAttendees, maxDurationHours) {
        const arrivalTimes = [];
        const samples = 1000; // Sample points along the curve
        const weights = [];
        let totalWeight = 0;

        // Find where the curve actually ends by looking at the end point's x coordinate
        const maxCurveTime = values.p6x;

        // Sample the piecewise curve
        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const point = CurveEditor.getCurvePointFromValues(values, t);

            // Only consider points within the curve's actual time range
            if (point.x <= maxCurveTime && t <= 1) {
                const weight = Math.max(0, point.y);
                weights.push({t: t, x: point.x, weight: weight});
                totalWeight += weight;
            }
        }

        // If all weights are zero, distribute uniformly over the curve duration
        if (totalWeight === 0 || weights.length === 0) {
            for (let i = 0; i < numAttendees; i++) {
                const uniformTime = (i / (numAttendees - 1)) * maxCurveTime * maxDurationHours * 60 * 60000;
                arrivalTimes.push(Math.min(uniformTime, maxDurationHours * 60 * 60000 - 1));
            }
            return arrivalTimes;
        }

        // Create cumulative distribution
        const cumulativeProbs = [];
        let cumulative = 0;
        for (const weightData of weights) {
            cumulative += weightData.weight / totalWeight;
            cumulativeProbs.push({...weightData, cumulative: cumulative});
        }

        // Generate arrival times using inverse transform sampling
        for (let i = 0; i < numAttendees; i++) {
            const random = Math.random();

            // Find the corresponding time on the curve
            let selectedPoint = cumulativeProbs[0];
            for (const point of cumulativeProbs) {
                if (point.cumulative >= random) {
                    selectedPoint = point;
                    break;
                }
            }

            // Use the actual curve x-coordinate for arrival time
            const arrivalTimeMinutes = selectedPoint.x * maxDurationHours * 60;
            const arrivalTimeMs = Math.min(arrivalTimeMinutes * 60000, maxDurationHours * 60 * 60000 - 1);
            arrivalTimes.push(arrivalTimeMs);
        }

        return arrivalTimes.sort((a, b) => a - b);
    }

    // Generate arrival times based on piecewise cubic Bezier spline
    generateArrivalTimes(numAttendees) {
        const values = this.getControlPointValues();
        return CurveEditor.generateArrivalTimesFromValues(values, numAttendees, this.maxDurationHours);
    }

    // Update simulation time for the time indicator
    updateSimulationTime(time) {
        this.currentSimulationTime = time;
        this.drawCurve();
    }
}
