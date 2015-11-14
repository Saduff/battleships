define(["aurelia-framework"], function (framework) {
    "use strict";

    var Decorators = framework.Decorators;

    var Droppable = function Droppable(element) {
        this.element = element;
    };

    Droppable.decorators = function () {
        return Decorators
            .customElement('droppable')
            .inject(Element)
            .bindable("game")
            .noView();
    };

    Droppable.prototype.attached = function() {
        $(this.element).closest(".game-col").droppable({
            drop: (e, ui) => this.dragDrop(this.game, e, ui)
        });
    };

    Droppable.prototype.dragDrop = function(game, event, ui) {
        if (!game.draggedShips) game.draggedShips = {};

        var shipNum = ui.draggable.data('num');
        var row = $(event.target).closest('.game-row').data('row');
        var col = $(event.target).data('col');
        var revert = false;

        if (col == game.gridSize - 1) {
            revert = true;
        }

        for (var num of Object.keys(game.draggedShips)) {
            if (shipNum == num) continue;
            var shipPos = game.draggedShips[num];

            if (row == shipPos.row) {
                if (col == shipPos.col || col == shipPos.col-1 || col == shipPos.col-2 ||
                    col == shipPos.col+1 || col == shipPos.col+2)
                {
                    revert = true;
                }
            } else if (row == shipPos.row - 1 || row == shipPos.row + 1) {
                if (col == shipPos.col || col == shipPos.col-1 || col == shipPos.col+1) {
                    revert = true;
                }
            }
        }

        if (revert) {
            ui.draggable.draggable('option', 'revert', true);
        } else {
            game.draggedShips[shipNum] = {row, col};
        }
    };

    return Droppable;
});