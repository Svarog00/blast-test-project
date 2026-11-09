import {
    BoardModel,
    TileMove,
    TileSpawn,
    TilesRemovedPayload,
    TilesMovedPayload,
    TilesSpawnedPayload
} from '../core/BoardModel';
import { VisualConfig } from '../config/GameConfig';
import { TileView } from './TileView';

/**
 * Визуал игрового поля: создание тайлов, анимации сгорания, падения и появления.
 * SRP: только отображение состояния BoardModel. Логики игры не содержит —
 * подписывается на события модели и по завершении анимаций сообщает об этом
 * через колбэк (связывание выполняет GameBootstrapper).
 */
export class BoardView {

    /** Отношение визуального размера тайла к шагу сетки (зазор между тайлами). */
    private static readonly TILE_FILL: number = 0.9;

    private boardNode: cc.Node;
    private tileSize: number;
    private cols: number;
    private rows: number;
    private burnDuration: number;
    private fallDuration: number;

    /** Карта «id тайла → визуал». */
    private views: Map<number, TileView> = new Map<number, TileView>();

    /** Накопленные изменения поля, ожидающие окончания анимации сгорания. */
    private pendingMoves: TileMove[] = [];
    private pendingSpawns: TileSpawn[] = [];

    private onAnimationsCompleted: () => void;

    constructor(parent: cc.Node, board: BoardModel, visual: VisualConfig, onAnimationsCompleted: () => void) {
        this.tileSize = visual.tileSize;
        this.cols = board.width;
        this.rows = board.height;
        this.burnDuration = visual.animBurnDuration;
        this.fallDuration = visual.animFallDuration;
        this.onAnimationsCompleted = onAnimationsCompleted;

        this.boardNode = new cc.Node('Board');
        this.boardNode.setParent(parent);

        board.on(BoardModel.EVENT_TILES_SPAWNED, (payload: TilesSpawnedPayload) => this.onTilesSpawned(payload));
        board.on(BoardModel.EVENT_TILES_REMOVED, (payload: TilesRemovedPayload) => this.onTilesRemoved(payload));
        board.on(BoardModel.EVENT_TILES_MOVED, (payload: TilesMovedPayload) => this.onTilesMoved(payload));
    }

    // ------------------------------------------------------------------
    // Реакция на события модели
    // ------------------------------------------------------------------

    private onTilesSpawned(payload: TilesSpawnedPayload): void {
        if (payload.initial) {
            // Первичная генерация: пересоздаём все тайлы без анимации падения.
            this.clearViews();
            for (const spawn of payload.tiles) {
                const view = this.createView(spawn.tile);
                view.node.setPosition(this.cellToPos(spawn.tile.x, spawn.spawnY));
            }
            return;
        }
        // Новые тайлы после сгорания: падение стартует после анимации сгорания.
        this.pendingSpawns = this.pendingSpawns.concat(payload.tiles);
    }

    private onTilesRemoved(payload: TilesRemovedPayload): void {
        for (const tile of payload.tiles) {
            const view = this.views.get(tile.id);
            if (!view) {
                continue;
            }
            this.views.delete(tile.id);

            cc.tween(view.node)
                .to(this.burnDuration, { scale: 0, opacity: 0 })
                .call(() => {
                    view.node.destroy();
                })
                .start();
        }

        // После сгорания запускаем накопленные падения.
        cc.tween(this.boardNode)
            .delay(this.burnDuration)
            .call(() => {
                this.playFalls();
            })
            .start();
    }

    private onTilesMoved(payload: TilesMovedPayload): void {
        this.pendingMoves = this.pendingMoves.concat(payload.moves);
    }

    // ------------------------------------------------------------------
    // Анимации
    // ------------------------------------------------------------------

    private playFalls(): void {
        for (const move of this.pendingMoves) {
            const view = this.views.get(move.tile.id);
            if (!view) {
                continue;
            }
            cc.tween(view.node)
                .to(this.fallDuration, { position: this.cellToPos(move.tile.x, move.tile.y) })
                .start();
        }

        for (const spawn of this.pendingSpawns) {
            const view = this.createView(spawn.tile);
            view.node.setPosition(this.cellToPos(spawn.tile.x, spawn.spawnY));
            cc.tween(view.node)
                .to(this.fallDuration, { position: this.cellToPos(spawn.tile.x, spawn.tile.y) })
                .start();
        }

        this.pendingMoves = [];
        this.pendingSpawns = [];

        cc.tween(this.boardNode)
            .delay(this.fallDuration)
            .call(() => {
                this.onAnimationsCompleted();
            })
            .start();
    }

    // ------------------------------------------------------------------
    // Вспомогательные методы
    // ------------------------------------------------------------------

    private createView(tile: import('../core/TileModel').TileModel): TileView {
        const view = new TileView(this.boardNode, this.tileSize * BoardView.TILE_FILL, tile);
        this.views.set(tile.id, view);
        return view;
    }

    private clearViews(): void {
        this.views.forEach((view) => {
            view.node.destroy();
        });
        this.views.clear();
    }

    /** Позиция центра ячейки (x, y) относительно центра поля. */
    private cellToPos(x: number, y: number): cc.Vec3 {
        return new cc.Vec3(
            (x - (this.cols - 1) / 2) * this.tileSize,
            (y - (this.rows - 1) / 2) * this.tileSize,
            0
        );
    }
}
