import { massToRadius, randomInRange, newId } from './util.js';
import { getPosition } from './entities.js';

class Virus {
    constructor(position, radius, mass, config) {
        this.id = newId();
        this.x = position.x;
        this.y = position.y;
        this.radius = radius;
        this.mass = mass;
        this.fill = config.fill;
        this.stroke = config.stroke;
        this.strokeWidth = config.strokeWidth;
    }
}

export class VirusManager {
    constructor(config) {
        this.data = [];
        this.virusConfig = config.virus;
        this.gameWidth = config.gameWidth;
        this.gameHeight = config.gameHeight;
    }

    addNew(number) {
        while (number--) {
            const mass = randomInRange(this.virusConfig.defaultMass.from, this.virusConfig.defaultMass.to);
            const radius = massToRadius(mass);
            const position = getPosition(this.virusConfig.uniformDisposition, radius, this.data, this.gameWidth, this.gameHeight);
            this.data.push(new Virus(position, radius, mass, this.virusConfig));
        }
    }

    delete(indexes) {
        // indexes est trié croissant : on retire depuis la fin pour ne rien décaler.
        for (let i = indexes.length - 1; i >= 0; i--) this.data.splice(indexes[i], 1);
    }

    clear() {
        this.data = [];
    }
}
