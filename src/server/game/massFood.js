import SAT from 'sat';
import { massToRadius, removeIndexes } from './util.js';
import { adjustForBoundaries } from './entities.js';

export class MassFood {
    constructor(playerFiring, cellIndex, mass) {
        this.id = playerFiring.id;
        this.num = cellIndex;
        this.mass = mass;
        this.hue = playerFiring.hue;
        this.direction = new SAT.Vector(
            playerFiring.x - playerFiring.cells[cellIndex].x + playerFiring.target.x,
            playerFiring.y - playerFiring.cells[cellIndex].y + playerFiring.target.y
        ).normalize();
        this.x = playerFiring.cells[cellIndex].x;
        this.y = playerFiring.cells[cellIndex].y;
        this.radius = massToRadius(mass);
        this.speed = 25;
    }

    move(gameWidth, gameHeight) {
        const deltaX = this.speed * this.direction.x;
        const deltaY = this.speed * this.direction.y;

        this.speed -= 0.5;
        if (this.speed < 0) this.speed = 0;
        if (!Number.isNaN(deltaY)) this.y += deltaY;
        if (!Number.isNaN(deltaX)) this.x += deltaX;

        adjustForBoundaries(this, this.radius, 5, gameWidth, gameHeight);
    }
}

export class MassFoodManager {
    constructor() {
        this.data = [];
    }

    addNew(playerFiring, cellIndex, mass) {
        this.data.push(new MassFood(playerFiring, cellIndex, mass));
    }

    move(gameWidth, gameHeight) {
        for (const currentFood of this.data) {
            if (currentFood.speed > 0) currentFood.move(gameWidth, gameHeight);
        }
    }

    remove(indexes) {
        if (indexes.length > 0) this.data = removeIndexes(this.data, indexes);
    }

    clear() {
        this.data = [];
    }
}
