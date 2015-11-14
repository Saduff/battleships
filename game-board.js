define(["aurelia-framework", "gameAPI"], function (framework, gameAPI) {
    "use strict";

    var Decorators = framework.Decorators;

    var GameBoard = function GameBoard(element) {
        this.element = element;
        this.element.cleanBoard = this.cleanBoard;
        this.element.placeShips = this.placeShips;
    };

    GameBoard.decorators = function () {
        return Decorators
            .customElement('game-board')
            .inject(Element)
            .bindable("game")
            .bindable("opponent");
    };

    GameBoard.prototype.cleanBoard = function() {
        $(this).find(".ship-2").hide();
        $(this).find(".shot").removeClass("shot hit miss");
    };

    GameBoard.prototype.placeShips = function(placements) {
        var $board = $(this);

        for (var row of Object.keys(placements)) {
            var cols = placements[row];

            for (var col of cols) {
                $board.find(".row" + row + " .col" + col + " .ship-2").show();
            }
        }
    };

    GameBoard.prototype.shoot = function(event, AIMove) {
        if (!this.opponent) return;
        if (!AIMove && $(event.target).hasClass("shot")) return;
        var col = AIMove ? AIMove.col : $(event.target).data("col");
        var row = AIMove ? AIMove.row : $(event.target).closest("tr").data("row");

        if (AIMove) {
            event = {target: $(this.game.playerBoard).find(".row" + row + " .col" + col)};
        }

        var placements = AIMove ? this.game.playerPlacements : this.game.opponentPlacements;

        if (placements[row] && placements[row].some(x => x == col || x == col-1)) {
            $(event.target).addClass("shot hit");
            placements.hits.count++;

            if (placements.hits[row]) {
                placements.hits[row].push(col);
            } else {
                placements.hits[row] = [col];
            }

            if (AIMove && !this.game.AIMoves.targetLocked) {
                this.game.AIMoves.last.count = 1;
                this.game.AIMoves.targetLocked = true;
            } else if (AIMove) {
                this.game.AIMoves.last.count++;
            }

            if (!AIMove && placements.hits[row].some(x => x == col-1 || x == col+1)) {
                var c = placements[row].find(x => x == col || x == col-1 || x == col+1);
                $(this.element).find(".row" + row + " .col" + c + " .ship-2").show();
            }

            if (placements.hits.count == this.game.numShips * 2) {
                var e = new Event('win');

                if (AIMove) {
                    this.element.dispatchEvent(e);
                } else {
                    this.game.playerBoard.dispatchEvent(e);
                }
            } else if (AIMove) {
                var move = gameAPI.getAIMove(this.game);
                this.shoot(null, move);
            }
        } else {
            $(event.target).addClass("shot miss");

            if (!AIMove) {
                var move = gameAPI.getAIMove(this.game);
                this.shoot(null, move);
            }
        }
    };

    return GameBoard;
});