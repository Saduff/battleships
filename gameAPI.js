define(function () {
    "use strict";

    var gameAPI = function gameAPI() {};

    gameAPI.genRandomPlacements = function(game) {
        var maxShipsPerRow = Math.floor(game.gridSize / 3);
        if (game.gridSize % 3 == 2) maxShipsPerRow++;

        var shipsPlaced = 0;

        while (shipsPlaced != game.numShips) {
            shipsPlaced = 0;
            var placements = {};
            var shipsPerRow = Math.floor((Math.random() * maxShipsPerRow) + 1);
            var skippedLinesLeft = (game.gridSize / 2);
            skippedLinesLeft += Math.floor(Math.random() * skippedLinesLeft);

            for (var row = 0; row < game.gridSize; row++) {
                if (shipsPlaced == game.numShips) break;

                if (skippedLinesLeft) {
                    var skip = Math.random() * 20;

                    if (skip >= 5) {
                        skippedLinesLeft--;
                        continue;
                    }
                }

                var count = 0, shipsPlacedRow = 0;
                placements[row] = [];

                while (shipsPlaced < game.numShips && shipsPlacedRow < shipsPerRow && count < 20) {
                    var col = Math.floor(Math.random() * (game.gridSize - 1));
                    count++;

                    if (placements[row].some(x => x == col || x == col - 1 || x == col - 2 || x == col + 1 || x == col + 2)) {
                        continue;
                    }

                    if (placements[row - 1] && placements[row - 1].some(x => x == col || x == col - 1 || x == col + 1)) {
                        continue;
                    }

                    if (placements[row + 1] && placements[row + 1].some(x => x == col || x == col - 1 || x == col + 1)) {
                        continue;
                    }

                    placements[row].push(col);
                    shipsPlacedRow++;
                    shipsPlaced++;
                }
            }
        }

        return placements;
    };

    gameAPI.getAIMove = function(game) {
        if (!game.AIMoves) game.AIMoves = {last: {}};
        var row, col;

        if (game.AIMoves.targetLocked) {
            row = game.AIMoves.last.row;
            col = game.AIMoves.last.col;

            if (game.AIMoves.last.count == 2) {
                game.AIMoves.targetLocked = false;
            } else if (col-1 >= 0 && game.AIMoves[row].indexOf(col-1) === -1) {
                col -= 1;
            } else if (col+1 < game.gridSize && game.AIMoves[row].indexOf(col+1) === -1) {
                col += 1;
            }
        }

        if (!game.AIMoves.targetLocked) {
            do {
                row = Math.round(Math.random() * (game.gridSize-1));
                col = Math.round(Math.random() * (game.gridSize-1));
            } while (game.AIMoves[row] && game.AIMoves[row].indexOf(col) !== -1);
        }

        if (game.AIMoves[row]) {
            game.AIMoves[row].push(col);
        } else {
            game.AIMoves[row] = [col];
        }

        if (!game.AIMoves.targetLocked) {
            game.AIMoves.last = {row, col};
        }

        return {row, col};
    };

    return gameAPI;
});