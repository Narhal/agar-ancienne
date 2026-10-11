import { isVisibleEntity } from './entities.js';
import { FoodManager } from './food.js';
import { VirusManager } from './virus.js';
import { MassFoodManager } from './massFood.js';
import { PlayerManager } from './player.js';

export class GameMap {
    constructor(config) {
        this.config = config;
        this.food = new FoodManager(config);
        this.viruses = new VirusManager(config);
        this.massFood = new MassFoodManager();
        this.players = new PlayerManager();
    }

    // Vide nourriture, virus et masses projetées (début de partie).
    resetWorld() {
        this.food.clear();
        this.viruses.clear();
        this.massFood.clear();
    }

    balanceMass() {
        const { foodMass, gameMass, maxFood, maxVirus } = this.config;
        const totalMass = this.food.data.length * foodMass + this.players.getTotalMass();
        const massDiff = gameMass - totalMass;
        const foodFreeCapacity = maxFood - this.food.data.length;
        const foodDiff = Math.min(Math.trunc(massDiff / foodMass), foodFreeCapacity);
        if (foodDiff > 0) {
            this.food.addNew(foodDiff);
        } else if (foodDiff && foodFreeCapacity !== maxFood) {
            this.food.removeExcess(-foodDiff);
        }

        const virusesToAdd = maxVirus - this.viruses.data.length;
        if (virusesToAdd > 0) this.viruses.addNew(virusesToAdd);
    }

    // Projection d'un joueur vers les clients : rien de sensible ne passe (ip, token).
    static projectPlayer(player) {
        return {
            x: player.x,
            y: player.y,
            cells: player.cells,
            massTotal: Math.round(player.massTotal),
            hue: player.hue,
            id: player.id,
            name: player.name,
            recalling: player.isRecalling,
            recallReadyAt: player.recallReadyAt,
        };
    }

    enumerateWhatPlayersSee(callback) {
        for (const currentPlayer of this.players.data) {
            if (!currentPlayer.screenWidth) continue;
            const visibleFood = this.food.data.filter((e) => isVisibleEntity(e, currentPlayer, false));
            const visibleViruses = this.viruses.data.filter((e) => isVisibleEntity(e, currentPlayer));
            const visibleMass = this.massFood.data.filter((e) => isVisibleEntity(e, currentPlayer));

            const visiblePlayers = [];
            for (const player of this.players.data) {
                for (const cell of player.cells) {
                    if (isVisibleEntity(cell, currentPlayer)) {
                        visiblePlayers.push(GameMap.projectPlayer(player));
                        break;
                    }
                }
            }

            callback(currentPlayer, GameMap.projectPlayer(currentPlayer), visiblePlayers, visibleFood, visibleMass, visibleViruses);
        }
    }
}
