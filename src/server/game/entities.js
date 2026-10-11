import { uniformPosition, randomPosition, testRectangleRectangle } from './util.js';

export function getPosition(isUniform, radius, uniformPositions, gameWidth, gameHeight) {
    return isUniform
        ? uniformPosition(uniformPositions, radius, gameWidth, gameHeight)
        : randomPosition(radius, gameWidth, gameHeight);
}

export function isVisibleEntity(entity, player, addThreshold = true) {
    const entityHalfSize = entity.radius + (addThreshold ? entity.radius * 0.1 : 0);
    return testRectangleRectangle(
        entity.x, entity.y, entityHalfSize, entityHalfSize,
        player.x, player.y, player.screenWidth / 2, player.screenHeight / 2);
}

export function adjustForBoundaries(position, radius, borderOffset, gameWidth, gameHeight) {
    const borderCalc = radius + borderOffset;
    if (position.x > gameWidth - borderCalc) position.x = gameWidth - borderCalc;
    if (position.y > gameHeight - borderCalc) position.y = gameHeight - borderCalc;
    if (position.x < borderCalc) position.x = borderCalc;
    if (position.y < borderCalc) position.y = borderCalc;
}
