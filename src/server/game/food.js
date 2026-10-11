import { massToRadius, removeIndexes, newId } from './util.js';
import { getPosition } from './entities.js';

class Food {
    constructor(position, radius) {
        this.id = newId();
        this.x = position.x;
        this.y = position.y;
        this.radius = radius;
        this.mass = Math.random() + 2;
        this.hue = Math.round(Math.random() * 360);
    }
}

export class FoodManager {
    constructor(config) {
        this.data = [];
        this.foodMass = config.foodMass;
        this.foodUniformDisposition = config.foodUniformDisposition;
        this.gameWidth = config.gameWidth;
        this.gameHeight = config.gameHeight;
    }

    addNew(number) {
        const radius = massToRadius(this.foodMass);
        while (number--) {
            const position = getPosition(this.foodUniformDisposition, radius, this.data, this.gameWidth, this.gameHeight);
            this.data.push(new Food(position, radius));
        }
    }

    removeExcess(number) {
        while (number-- && this.data.length) this.data.pop();
    }

    delete(foodsToDelete) {
        if (foodsToDelete.length > 0) this.data = removeIndexes(this.data, foodsToDelete);
    }

    clear() {
        this.data = [];
    }
}
