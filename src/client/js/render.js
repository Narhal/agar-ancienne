// Rendu canvas (porté de l'amont, plus l'anneau de rappel).

const FULL_ANGLE = 2 * Math.PI;

const drawRoundObject = (position, radius, graph) => {
    graph.beginPath();
    graph.arc(position.x, position.y, radius, 0, FULL_ANGLE);
    graph.closePath();
    graph.fill();
    graph.stroke();
};

const circlePoint = (origo, radius, theta) => ({
    x: origo.x + radius * Math.cos(theta),
    y: origo.y + radius * Math.sin(theta),
});

export const drawFood = (position, food, sides, graph) => {
    graph.fillStyle = 'hsl(' + food.hue + ', 100%, 50%)';
    graph.strokeStyle = 'hsl(' + food.hue + ', 100%, 45%)';
    graph.lineWidth = 0;
    if (sides >= 10) {
        drawRoundObject(position, food.radius, graph);
        return;
    }
    graph.beginPath();
    for (let theta = 0; theta < FULL_ANGLE; theta += FULL_ANGLE / sides) {
        const p = circlePoint(position, food.radius, theta);
        graph.lineTo(p.x, p.y);
    }
    graph.closePath();
    graph.fill();
};

export const drawVirus = (position, virus, graph) => {
    graph.strokeStyle = virus.stroke;
    graph.fillStyle = virus.fill;
    graph.lineWidth = virus.strokeWidth;
    const sides = 20;
    graph.beginPath();
    for (let theta = 0; theta < FULL_ANGLE; theta += FULL_ANGLE / sides) {
        const point = circlePoint(position, virus.radius, theta);
        graph.lineTo(point.x, point.y);
    }
    graph.closePath();
    graph.stroke();
    graph.fill();
};

export const drawFireFood = (position, mass, playerConfig, graph) => {
    graph.strokeStyle = 'hsl(' + mass.hue + ', 100%, 45%)';
    graph.fillStyle = 'hsl(' + mass.hue + ', 100%, 50%)';
    graph.lineWidth = playerConfig.border + 2;
    drawRoundObject(position, mass.radius - 1, graph);
};

const valueInRange = (min, max, value) => Math.min(max, Math.max(min, value));

const cellTouchingBorders = (cell, borders) =>
    cell.x - cell.radius <= borders.left ||
    cell.x + cell.radius >= borders.right ||
    cell.y - cell.radius <= borders.top ||
    cell.y + cell.radius >= borders.bottom;

const regulatePoint = (point, borders) => ({
    x: valueInRange(borders.left, borders.right, point.x),
    y: valueInRange(borders.top, borders.bottom, point.y),
});

const drawCellWithLines = (cell, borders, graph) => {
    const pointCount = 30 + ~~(cell.mass / 5);
    const points = [];
    for (let theta = 0; theta < FULL_ANGLE; theta += FULL_ANGLE / pointCount) {
        points.push(regulatePoint(circlePoint(cell, cell.radius, theta), borders));
    }
    graph.beginPath();
    graph.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) graph.lineTo(points[i].x, points[i].y);
    graph.closePath();
    graph.fill();
    graph.stroke();
};

export const drawCells = (cells, playerConfig, toggleMassState, borders, graph, now) => {
    for (const cell of cells) {
        graph.fillStyle = cell.color;
        graph.strokeStyle = cell.borderColor;
        graph.lineWidth = 6;
        if (cellTouchingBorders(cell, borders)) {
            drawCellWithLines(cell, borders, graph);
        } else {
            drawRoundObject(cell, cell.radius, graph);
        }

        // Anneau de rappel : pulsation visible par tous.
        if (cell.recalling) {
            const pulse = 1 + 0.08 * Math.sin(now / 80);
            graph.strokeStyle = 'rgba(52, 152, 219, 0.9)';
            graph.lineWidth = 4;
            graph.setLineDash([8, 6]);
            graph.beginPath();
            graph.arc(cell.x, cell.y, cell.radius * pulse + 6, 0, FULL_ANGLE);
            graph.stroke();
            graph.setLineDash([]);
        }

        let fontSize = Math.max(cell.radius / 3, 12);
        graph.lineWidth = playerConfig.textBorderSize;
        graph.fillStyle = playerConfig.textColor;
        graph.strokeStyle = playerConfig.textBorder;
        graph.miterLimit = 1;
        graph.lineJoin = 'round';
        graph.textAlign = 'center';
        graph.textBaseline = 'middle';
        graph.font = 'bold ' + fontSize + 'px sans-serif';
        graph.strokeText(cell.name, cell.x, cell.y);
        graph.fillText(cell.name, cell.x, cell.y);

        if (toggleMassState === 1) {
            graph.font = 'bold ' + Math.max(fontSize / 3 * 2, 10) + 'px sans-serif';
            if (cell.name.length === 0) fontSize = 0;
            graph.strokeText(Math.round(cell.mass), cell.x, cell.y + fontSize);
            graph.fillText(Math.round(cell.mass), cell.x, cell.y + fontSize);
        }
    }
};

export const drawGrid = (global, player, screen, graph) => {
    graph.lineWidth = 1;
    graph.strokeStyle = global.lineColor;
    graph.globalAlpha = 0.15;
    graph.beginPath();
    const step = screen.height / 18;
    for (let x = -player.x % step; x < screen.width; x += step) {
        graph.moveTo(x, 0);
        graph.lineTo(x, screen.height);
    }
    for (let y = -player.y % step; y < screen.height; y += step) {
        graph.moveTo(0, y);
        graph.lineTo(screen.width, y);
    }
    graph.stroke();
    graph.globalAlpha = 1;
};

export const drawBorder = (borders, lineColor, graph) => {
    graph.lineWidth = 1;
    graph.strokeStyle = lineColor;
    graph.beginPath();
    graph.moveTo(borders.left, borders.top);
    graph.lineTo(borders.right, borders.top);
    graph.lineTo(borders.right, borders.bottom);
    graph.lineTo(borders.left, borders.bottom);
    graph.closePath();
    graph.stroke();
};

export const drawErrorMessage = (message, graph, screen, sub) => {
    graph.fillStyle = '#333333';
    graph.fillRect(0, 0, screen.width, screen.height);
    graph.textAlign = 'center';
    graph.fillStyle = '#FFFFFF';
    graph.font = 'bold 30px sans-serif';
    graph.fillText(message, screen.width / 2, screen.height / 2);
    if (sub) {
        graph.font = '18px sans-serif';
        graph.fillText(sub, screen.width / 2, screen.height / 2 + 36);
    }
};
