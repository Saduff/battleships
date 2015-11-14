define(["gameAPI"], function (gameAPI) {
	"use strict";

	var app = function () {
        this.gridSizes = [
            {label: "3x3", value: 3},
            {label: "4x4", value: 4},
            {label: "5x5", value: 5},
            {label: "6x6", value: 6},
            {label: "7x7", value: 7},
            {label: "8x8", value: 8},
            {label: "9x9", value: 9},
            {label: "10x10", value: 10}
        ];

        this.numShipsOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        this.numShips = 5;
        this.gridSize = this.gridSizes[7];
        this.game = {};

        if (localStorage.gameResults) {
            this.gameResults = JSON.parse(localStorage.gameResults);
            this.calcStatistics();
        } else {
            this.gameResults = [];
            this.gameStats = {};
        }
    };

    app.prototype.attached = function() {
        $(this.gridSizeSelect).dropdown().on('change', e => {
            this.gridSize = this.gridSizes.find(gs => gs.value == e.target.value);
            this.gridSizeChanged();
        });

        $(this.numShipsSelect).dropdown().on('change', e => {
            this.numShips = e.target.value;
        });

        var mq = window.matchMedia("(max-width: 490px)");

        if (mq.matches) {
            this.numShipsOptions = [1, 2, 3, 4, 5, 6, 7];
            this.gridSize = this.gridSizes[5];
            $(this.gridSizeSelect).find("span.text").text(this.gridSize.label);
        }

        this.newGame();
    };

    app.prototype.gridSizeChanged = function() {
        this.numShipsOptions = Array.from({length: this.gridSize.value-1}, (k,v) => v+1);
        this.numShips = 1;
        $(this.numShipsSelect).find("span.text").text("1"); // Firefox fix
    };

    app.prototype.newGame = function() {
        this.playerBoard.cleanBoard();
        this.opponentBoard.cleanBoard();

        $(".draggable").css({
            left: '0px',
            top: '0px'
        });

        this.game = {
            newGame: true,
            gridSize: this.gridSize.value,
            numShips: parseInt(this.numShips),
            shipsPlaced: false,
            playerPlacements: {},
            playerBoard: this.playerBoard
        };
    };

    app.prototype.placeRandomly = function() {
        var placements = gameAPI.genRandomPlacements(this.game);
        this.playerBoard.cleanBoard();
        this.playerBoard.placeShips(placements);
        this.game.playerPlacements = placements;
        this.game.playerPlacements.hits = {count: 0};
        this.game.draggedShips = null;
        this.game.shipsPlaced = true;
    };

    app.prototype.startGame = function() {
        if (!this.game.shipsPlaced && !this.game.draggedShips) {
            this.placeRandomly();
        } else if (this.game.draggedShips) {
            if (Object.keys(this.game.draggedShips).length != this.game.numShips) {
                alert("Please place all ships!");
                return;
            }

            var placements = this.game.playerPlacements;

            for (var shipNum of Object.keys(this.game.draggedShips)) {
                var shipPos = this.game.draggedShips[shipNum];

                if (placements[shipPos.row]) {
                    placements[shipPos.row].push(shipPos.col);
                } else {
                    placements[shipPos.row] = [shipPos.col];
                }
            }

            this.playerBoard.placeShips(placements);
            placements.hits = {count: 0};
            this.game.shipsPlaced = true;
        }

        this.game.opponentPlacements = gameAPI.genRandomPlacements(this.game);
        this.game.opponentPlacements.hits = {count: 0};
        console.log(this.game.opponentPlacements);
        this.game.newGame = false;
        this.game.startTime = new Date();

        $(this.playerBoard).off().on('win', () => {
            if (this.game.playerWon === false) return;
            this.game.gameOver = true;
            this.game.playerWon = true;
            this.addGameResult();
        });

        $(this.opponentBoard).off().on('win', () => {
            if (this.game.playerWon === true) return;
            this.game.gameOver = true;
            this.game.playerWon = false;
            this.addGameResult();
        });
    };

    app.prototype.addGameResult = function() {
        var endTime = new Date();
        var gameTime = Math.round((endTime - this.game.startTime) / 1000);

        var gameResult = {
            gridSize: this.game.gridSize + "x" + this.game.gridSize,
            numShips: this.game.numShips,
            playerShots: $(this.opponentBoard).find(".shot").length,
            opponentShots: $(this.playerBoard).find(".shot").length,
            gameTime: gameTime,
            winner: (this.game.playerWon === true) ? "You" : "Computer"
        };

        if (this.gameResults.length == 10) {
            this.gameResults.shift();
        }

        this.gameResults.push(gameResult);
        localStorage.gameResults = JSON.stringify(this.gameResults);
        this.calcStatistics();
    };

    app.prototype.calcStatistics = function() {
        var stats = {
            playerShots: 0,
            opponentShots: 0,
            gameTime: 0,
            playerWinCount: 0,
            opponentWinCount: 0
        };

        for (var gameResult of this.gameResults) {
            stats.playerShots += gameResult.playerShots;
            stats.opponentShots += gameResult.opponentShots;
            stats.gameTime += gameResult.gameTime;
            stats.playerWinCount += (gameResult.winner == "You") ? 1 : 0;
            stats.opponentWinCount += (gameResult.winner == "Computer") ? 1 : 0;
        }

        stats.playerShots = Math.round(stats.playerShots / this.gameResults.length);
        stats.opponentShots = Math.round(stats.opponentShots / this.gameResults.length);
        stats.gameTime = Math.round(stats.gameTime / this.gameResults.length);
        var winRatio = Math.round(stats.playerWinCount / this.gameResults.length * 100);
        var lossRatio = Math.round(stats.opponentWinCount / this.gameResults.length * 100);

        if (winRatio >= lossRatio) {
            stats.winRatio = "You (" + winRatio + "%)";
        } else {
            stats.winRatio = "Computer (" + lossRatio + "%)";
        }

        this.gameStats = stats;
    };

    /* Drag-drop functionality */

    app.prototype.dragStop = function(event) {
        $(event.target).draggable('option', 'revert', 'invalid');
    };

	return app;
});
