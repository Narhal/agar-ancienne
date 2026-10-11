// Utilitaires géométriques et de tableau (portés de l'amont).

export function massToRadius(mass) {
    return 4 + Math.sqrt(mass) * 6;
}

export function mathLog(n, base) {
    return Math.log(n) / (base ? Math.log(base) : 1);
}

// Distance entre les bords de deux cercles.
export function getDistance(p1, p2) {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y) - p1.radius - p2.radius;
}

export function randomInRange(from, to) {
    return Math.floor(Math.random() * (to - from)) + from;
}

export function randomPosition(radius, gameWidth, gameHeight) {
    return {
        x: randomInRange(radius, gameWidth - radius),
        y: randomInRange(radius, gameHeight - radius),
    };
}

// Candidat le plus éloigné de tous les points existants (échantillonnage).
export function uniformPosition(points, radius, gameWidth, gameHeight) {
    let bestCandidate;
    let maxDistance = 0;
    const numberOfCandidates = 10;

    if (points.length === 0) {
        return randomPosition(radius, gameWidth, gameHeight);
    }

    for (let ci = 0; ci < numberOfCandidates; ci++) {
        let minDistance = Infinity;
        const candidate = randomPosition(radius, gameWidth, gameHeight);
        candidate.radius = radius;

        for (const point of points) {
            const distance = getDistance(candidate, point);
            if (distance < minDistance) minDistance = distance;
        }

        if (minDistance > maxDistance) {
            bestCandidate = candidate;
            maxDistance = minDistance;
        } else {
            return randomPosition(radius, gameWidth, gameHeight);
        }
    }

    return bestCandidate;
}

export function findIndex(arr, id) {
    let len = arr.length;
    while (len--) {
        if (arr[len].id === id) return len;
    }
    return -1;
}

export function removeNulls(inputArray) {
    const result = [];
    for (const element of inputArray) {
        if (element != null) result.push(element);
    }
    return result;
}

// Retire les éléments dont l'index est dans `indexes`.
export function removeIndexes(inputArray, indexes) {
    for (const index of indexes) inputArray[index] = null;
    return removeNulls(inputArray);
}

// Les largeurs/hauteurs sont des demi-valeurs.
export function testRectangleRectangle(centerXA, centerYA, widthA, heightA, centerXB, centerYB, widthB, heightB) {
    return centerXA + widthA > centerXB - widthB
        && centerXA - widthA < centerXB + widthB
        && centerYA + heightA > centerYB - heightB
        && centerYA - heightA < centerYB + heightB;
}

export function getIndexes(array, predicate) {
    const acc = [];
    for (let i = 0; i < array.length; i++) {
        if (predicate(array[i])) acc.push(i);
    }
    return acc;
}

let nextId = 1;
export function newId() {
    return (nextId++).toString(36);
}
