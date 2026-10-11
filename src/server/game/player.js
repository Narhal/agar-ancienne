import SAT from 'sat';
import { massToRadius, mathLog, removeNulls, findIndex } from './util.js';
import { adjustForBoundaries } from './entities.js';

const MIN_SPEED = 6.25;
const SPLIT_CELL_SPEED = 20;
const SPEED_DECREMENT = 0.5;
const MIN_DISTANCE = 50;
const PUSHING_AWAY_SPEED = 1.1;
const MERGE_TIMER = 15; // secondes avant qu'un split puisse refusionner naturellement
const RECALL_PULL = 9;  // pixels par tick d'attraction vers le centre pendant un rappel

export class Cell {
    constructor(x, y, mass, speed) {
        this.x = x;
        this.y = y;
        this.mass = mass;
        this.radius = massToRadius(mass);
        this.speed = speed;
    }

    setMass(mass) {
        this.mass = mass;
        this.radius = massToRadius(this.mass);
    }

    addMass(mass) {
        this.setMass(this.mass + mass);
    }

    toCircle() {
        return new SAT.Circle(new SAT.Vector(this.x, this.y), this.radius);
    }

    move(playerX, playerY, playerTarget, slowBase, initMassLog) {
        const target = {
            x: playerX - this.x + playerTarget.x,
            y: playerY - this.y + playerTarget.y,
        };
        const dist = Math.hypot(target.y, target.x);
        const deg = Math.atan2(target.y, target.x);
        let slowDown = 1;
        if (this.speed <= MIN_SPEED) {
            slowDown = mathLog(this.mass, slowBase) - initMassLog + 1;
        }

        let deltaY = this.speed * Math.sin(deg) / slowDown;
        let deltaX = this.speed * Math.cos(deg) / slowDown;

        if (this.speed > MIN_SPEED) this.speed -= SPEED_DECREMENT;
        if (dist < (MIN_DISTANCE + this.radius)) {
            deltaY *= dist / (MIN_DISTANCE + this.radius);
            deltaX *= dist / (MIN_DISTANCE + this.radius);
        }

        if (!Number.isNaN(deltaY)) this.y += deltaY;
        if (!Number.isNaN(deltaX)) this.x += deltaX;
    }

    // 0 : rien ; 1 : A mange B ; 2 : B mange A
    static checkWhoAteWho(cellA, cellB) {
        if (!cellA || !cellB) return 0;
        const response = new SAT.Response();
        const colliding = SAT.testCircleCircle(cellA.toCircle(), cellB.toCircle(), response);
        if (!colliding) return 0;
        if (response.bInA) return 1;
        if (response.aInB) return 2;
        return 0;
    }
}

export class Player {
    constructor(id) {
        this.id = id;
        this.hue = Math.round(Math.random() * 360);
        this.name = null;
        this.admin = false;
        this.screenWidth = null;
        this.screenHeight = null;
        this.timeToMerge = null;
        this.recallUntil = 0;     // fin du rappel en cours
        this.recallReadyAt = 0;   // prochain rappel autorisé
        this.kills = 0;
        this.ipAddress = null;
        this.token = null;
        this.disconnectedAt = null; // délai de grâce en cours si non null
        this.setLastHeartbeat();
    }

    /* Réinitialise ce qui change à chaque respawn. */
    init(position, defaultPlayerMass) {
        this.cells = [new Cell(position.x, position.y, defaultPlayerMass, MIN_SPEED)];
        this.massTotal = defaultPlayerMass;
        this.x = position.x;
        this.y = position.y;
        this.target = { x: 0, y: 0 };
        this.recallUntil = 0;
        this.timeToMerge = null;
    }

    clientProvidedData(playerData) {
        this.name = playerData.name;
        this.screenWidth = playerData.screenWidth;
        this.screenHeight = playerData.screenHeight;
        this.setLastHeartbeat();
    }

    setLastHeartbeat() {
        this.lastHeartbeat = Date.now();
    }

    setLastSplit() {
        this.timeToMerge = Date.now() + 1000 * MERGE_TIMER;
    }

    get isRecalling() {
        return this.recallUntil > Date.now();
    }

    /**
     * Rappel : les cellules sont attirées vers le centre du joueur et peuvent
     * fusionner au contact, même avant la fin du délai naturel de 15 s.
     * Retourne un motif de refus, ou null si le rappel démarre.
     */
    recall(cooldownMs, durationMs, now = Date.now()) {
        if (this.cells.length < 2) return 'une_seule_cellule';
        if (now < this.recallUntil) return 'deja_en_cours';
        if (now < this.recallReadyAt) return 'cooldown';
        this.recallUntil = now + durationMs;
        this.recallReadyAt = now + cooldownMs;
        this.timeToMerge = now; // autorise la fusion immédiate au contact
        return null;
    }

    loseMassIfNeeded(massLossRate, defaultPlayerMass, minMassLoss) {
        for (let i = 0; i < this.cells.length; i++) {
            if (this.cells[i].mass * (1 - (massLossRate / 1000)) > defaultPlayerMass && this.massTotal > minMassLoss) {
                const massLoss = this.cells[i].mass * (massLossRate / 1000);
                this.changeCellMass(i, -massLoss);
            }
        }
    }

    changeCellMass(cellIndex, massDifference) {
        this.cells[cellIndex].addMass(massDifference);
        this.massTotal += massDifference;
    }

    removeCell(cellIndex) {
        this.massTotal -= this.cells[cellIndex].mass;
        this.cells.splice(cellIndex, 1);
        return this.cells.length === 0;
    }

    // Divise une cellule en morceaux de masse égale (n-1 nouvelles cellules).
    splitCell(cellIndex, maxRequestedPieces, defaultPlayerMass) {
        const cellToSplit = this.cells[cellIndex];
        const maxAllowedPieces = Math.floor(cellToSplit.mass / defaultPlayerMass);
        const piecesToCreate = Math.min(maxAllowedPieces, maxRequestedPieces);
        if (piecesToCreate === 0) return;
        const newCellsMass = cellToSplit.mass / piecesToCreate;
        for (let i = 0; i < piecesToCreate - 1; i++) {
            this.cells.push(new Cell(cellToSplit.x, cellToSplit.y, newCellsMass, SPLIT_CELL_SPEED));
        }
        cellToSplit.setMass(newCellsMass);
        this.setLastSplit();
        this.recallUntil = 0; // un split annule le rappel en cours
    }

    virusSplit(cellIndexes, maxCells, defaultPlayerMass) {
        for (const cellIndex of cellIndexes) {
            this.splitCell(cellIndex, maxCells - this.cells.length + 1, defaultPlayerMass);
        }
    }

    userSplit(maxCells, defaultPlayerMass) {
        let cellsToCreate;
        if (this.cells.length > maxCells / 2) {
            cellsToCreate = maxCells - this.cells.length + 1;
            this.cells.sort((a, b) => b.mass - a.mass);
        } else {
            cellsToCreate = this.cells.length;
        }
        for (let i = 0; i < cellsToCreate; i++) {
            this.splitCell(i, 2, defaultPlayerMass);
        }
    }

    enumerateCollidingCells(callback) {
        for (let cellAIndex = 0; cellAIndex < this.cells.length; cellAIndex++) {
            const cellA = this.cells[cellAIndex];
            if (!cellA) continue;
            for (let cellBIndex = cellAIndex + 1; cellBIndex < this.cells.length; cellBIndex++) {
                const cellB = this.cells[cellBIndex];
                if (!cellB) continue;
                if (SAT.testCircleCircle(cellA.toCircle(), cellB.toCircle())) {
                    callback(this.cells, cellAIndex, cellBIndex);
                }
            }
        }
        this.cells = removeNulls(this.cells);
    }

    mergeCollidingCells() {
        this.enumerateCollidingCells((cells, a, b) => {
            cells[a].addMass(cells[b].mass);
            cells[b] = null;
        });
    }

    pushAwayCollidingCells() {
        this.enumerateCollidingCells((cells, a, b) => {
            const cellA = cells[a];
            const cellB = cells[b];
            let vector = new SAT.Vector(cellB.x - cellA.x, cellB.y - cellA.y);
            vector = vector.normalize().scale(PUSHING_AWAY_SPEED, PUSHING_AWAY_SPEED);
            if (vector.len() === 0) vector = new SAT.Vector(0, 1);
            cellA.x -= vector.x;
            cellA.y -= vector.y;
            cellB.x += vector.x;
            cellB.y += vector.y;
        });
    }

    // Pendant un rappel, chaque cellule glisse vers le barycentre du joueur.
    pullCellsToCenter() {
        for (const cell of this.cells) {
            const dx = this.x - cell.x;
            const dy = this.y - cell.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 1) continue;
            const step = Math.min(RECALL_PULL, dist);
            cell.x += dx / dist * step;
            cell.y += dy / dist * step;
        }
    }

    move(slowBase, gameWidth, gameHeight, initMassLog) {
        if (this.cells.length > 1) {
            const recalling = this.isRecalling;
            if (recalling) this.pullCellsToCenter();
            if (recalling || this.timeToMerge < Date.now()) {
                this.mergeCollidingCells();
            } else {
                this.pushAwayCollidingCells();
            }
        }

        let xSum = 0;
        let ySum = 0;
        for (const cell of this.cells) {
            cell.move(this.x, this.y, this.target, slowBase, initMassLog);
            adjustForBoundaries(cell, cell.radius / 3, 0, gameWidth, gameHeight);
            xSum += cell.x;
            ySum += cell.y;
        }
        this.x = xSum / this.cells.length;
        this.y = ySum / this.cells.length;
    }

    static checkForCollisions(playerA, playerB, playerAIndex, playerBIndex, callback) {
        for (let cellAIndex = 0; cellAIndex < playerA.cells.length; cellAIndex++) {
            for (let cellBIndex = 0; cellBIndex < playerB.cells.length; cellBIndex++) {
                const cellA = playerA.cells[cellAIndex];
                const cellB = playerB.cells[cellBIndex];
                const cellAData = { playerIndex: playerAIndex, cellIndex: cellAIndex };
                const cellBData = { playerIndex: playerBIndex, cellIndex: cellBIndex };
                const whoAteWho = Cell.checkWhoAteWho(cellA, cellB);
                if (whoAteWho === 1) callback(cellBData, cellAData);
                else if (whoAteWho === 2) callback(cellAData, cellBData);
            }
        }
    }
}

export class PlayerManager {
    constructor() {
        this.data = [];
    }

    pushNew(player) {
        this.data.push(player);
    }

    findIndexByID(id) {
        return findIndex(this.data, id);
    }

    findByID(id) {
        const i = this.findIndexByID(id);
        return i > -1 ? this.data[i] : null;
    }

    removePlayerByID(id) {
        const index = this.findIndexByID(id);
        if (index > -1) this.removePlayerByIndex(index);
    }

    removePlayerByIndex(index) {
        this.data.splice(index, 1);
    }

    shrinkCells(massLossRate, defaultPlayerMass, minMassLoss) {
        for (const player of this.data) {
            player.loseMassIfNeeded(massLossRate, defaultPlayerMass, minMassLoss);
        }
    }

    removeCell(playerIndex, cellIndex) {
        return this.data[playerIndex].removeCell(cellIndex);
    }

    getCell(playerIndex, cellIndex) {
        return this.data[playerIndex].cells[cellIndex];
    }

    handleCollisions(callback) {
        for (let a = 0; a < this.data.length; a++) {
            for (let b = a + 1; b < this.data.length; b++) {
                Player.checkForCollisions(this.data[a], this.data[b], a, b, callback);
            }
        }
    }

    // Tous les joueurs vivants, triés par masse décroissante.
    getRanked() {
        return [...this.data].sort((a, b) => b.massTotal - a.massTotal);
    }

    getTotalMass() {
        let result = 0;
        for (const player of this.data) result += player.massTotal;
        return result;
    }
}
