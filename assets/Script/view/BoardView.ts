import {
    BoardModel,
    TileMove,
    TileSpawn,
    TilesRemovedPayload,
    TilesMovedPayload,
    TilesSpawnedPayload,
    SuperTileCreatedPayload
} from '../core/BoardModel';
import { TileModel } from '../core/TileModel';
import { VisualConfig } from '../config/GameConfig';
import { TilePalette } from '../config/TilePalette';
import { TileView } from './TileView';

const { ccclass, property } = cc._decorator;

/**
 * Визуал игрового поля: компонент на узле «Board» префаба BoardContainer.prefab.
 * SRP: только отображение состояния BoardModel. Логики игры не содержит —
 * подписывается на события модели и по завершении анимаций сообщает об этом
 * через колбэк (связывание выполняет GameBootstrapper).
 *
 * Префаб тайла задаётся сериализованно через @property (заполняется в
 * редакторе в инспекторе префаба). Рантайм-данные (модель, палитра,
 * визуальные параметры из конфига) сериализовать нельзя — они создаются
 * в рантайме и передаются через init() из GameBootstrapper.
 */
@ccclass
export class BoardView extends cc.Component {

    /** Отношение визуального размера тайла к шагу сетки (зазор между тайлами). */
    private static readonly TILE_FILL: number = 0.9;

    private readonly defaultTileScale : number = 1.0;

    /** Префаб тайла — ссылка задаётся сериализованно в префабе. */
    @property(cc.Prefab)
    public readonly tilePrefab: cc.Prefab = null;
    
    @property(cc.Node)
    private rootNode : cc.Node = null;

    
    @property
    private superTileInAnimationTime : number = 0.45;
    @property
    private superTileOutAnimationTime : number = 0.45;

    @property
    private maxTileScaleAnimation : number = 1.12;

    private tileSize: number = 0;
    private cols: number = 0;
    private rows: number = 0;
    private burnDuration: number = 0;
    private fallDuration: number = 0;

    /** Карта «id тайла → визуал». */
    private views: Map<number, TileView> = new Map<number, TileView>();

    /** Накопленные изменения поля, ожидающие окончания анимации сгорания. */
    private pendingMoves: TileMove[] = [];
    private pendingSpawns: TileSpawn[] = [];
    /** Супер-тайлы, ожидающие появления после анимации сгорания. */
    private pendingSuperSpawns: SuperTileCreatedPayload[] = [];

    private palette: TilePalette = null;
    private onAnimationsCompleted: () => void = null;
    private board: BoardModel = null;

    // Обёртки-подписки: хранятся для корректной отписки в onDestroy.
    private readonly handleTilesSpawned = (payload: TilesSpawnedPayload) => this.onTilesSpawned(payload);
    private readonly handleTilesRemoved = (payload: TilesRemovedPayload) => this.onTilesRemoved(payload);
    private readonly handleTilesMoved = (payload: TilesMovedPayload) => this.onTilesMoved(payload);
    private readonly handleSuperTileCreated = (payload: SuperTileCreatedPayload) => this.onSuperTileCreated(payload);

    /**
     * Привязка модели и рантайм-зависимостей; выполняется GameBootstrapper.
     * Узел компонента является контейнером тайлов.
     */
    public init(
        board: BoardModel,
        visual: VisualConfig,
        palette: TilePalette,
        onAnimationsCompleted: () => void
    ): void {
        this.board = board;
        this.tileSize = visual.tileSize;
        this.cols = board.width;
        this.rows = board.height;
        this.burnDuration = visual.animBurnDuration;
        this.fallDuration = visual.animFallDuration;
        this.palette = palette;
        this.onAnimationsCompleted = onAnimationsCompleted;

        board.on(BoardModel.EVENT_TILES_SPAWNED, this.handleTilesSpawned);
        board.on(BoardModel.EVENT_TILES_REMOVED, this.handleTilesRemoved);
        board.on(BoardModel.EVENT_TILES_MOVED, this.handleTilesMoved);
        board.on(BoardModel.EVENT_SUPER_TILE_CREATED, this.handleSuperTileCreated);
    }

    protected onDestroy(): void {
        if (this.board) {
            this.board.off(BoardModel.EVENT_TILES_SPAWNED, this.handleTilesSpawned);
            this.board.off(BoardModel.EVENT_TILES_REMOVED, this.handleTilesRemoved);
            this.board.off(BoardModel.EVENT_TILES_MOVED, this.handleTilesMoved);
            this.board.off(BoardModel.EVENT_SUPER_TILE_CREATED, this.handleSuperTileCreated);
        }
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

            // Останавливаем прочие твины узла (например, пульс супер-тайла),
            // чтобы они не конфликтовали с анимацией сгорания.
            cc.Tween.stopAllByTarget(view.node);

            cc.tween(view.node)
                .to(this.burnDuration, { scale: 0, opacity: 0 })
                .call(() => {
                    view.node.destroy();
                })
                .start();
        }

        // После сгорания запускаем накопленные падения.
        cc.tween(this.rootNode)
            .delay(this.burnDuration)
            .call(() => {
                this.playFalls();
            })
            .start();
    }

    private onTilesMoved(payload: TilesMovedPayload): void {
        this.pendingMoves = this.pendingMoves.concat(payload.moves);
    }

    private onSuperTileCreated(payload: SuperTileCreatedPayload): void {
        this.pendingSuperSpawns.push(payload);
    }

    // ------------------------------------------------------------------
    // Анимации
    // ------------------------------------------------------------------

    private playFalls(): void {
        // Супер-тайлы появляются на месте клика (после анимации сгорания группы);
        // если гравитация сдвинула их вниз — дальше подхватит цикл перемещений.
        for (const superSpawn of this.pendingSuperSpawns) {
            const view = this.createView(superSpawn.tile);
            view.node.setPosition(this.cellToPos(superSpawn.x, superSpawn.y));
        }

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
        this.pendingSuperSpawns = [];

        cc.tween(this.rootNode)
            .delay(this.fallDuration)
            .call(() => {
                this.onAnimationsCompleted();
            })
            .start();
    }

    // ------------------------------------------------------------------
    // Вспомогательные методы
    // ------------------------------------------------------------------

    private createView(tile: TileModel): TileView {
        // Спавн через создание экземпляра префаба: узел и сериализованные
        // свойства TileView (sprite и т.п.) приходят из префаба.
        const node = cc.instantiate(this.tilePrefab);
        node.setParent(this.rootNode);
        node.setContentSize(this.tileSize * BoardView.TILE_FILL, this.tileSize * BoardView.TILE_FILL);

        const view = node.getComponent(TileView);
        view.init(tile, this.palette);
        this.views.set(tile.id, view);

        if (tile.isSuper) {
            this.startSuperPulse(view);
        }
        return view;
    }

    /** Пульсация супер-тайла — визуальное выделение; останавливается при сгорании. */
    private startSuperPulse(view: TileView): void {
        cc.tween(view.node)
            .repeatForever(
                cc.tween()
                    .to(this.superTileInAnimationTime, { scale: this.maxTileScaleAnimation })
                    .to(this.superTileOutAnimationTime, { scale: this.defaultTileScale })
            )
            .start();
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
