import { EventEmitter } from './EventEmitter';
import { TileModel } from './TileModel';
import { SuperTileModel } from './SuperTileModel';
import { SuperTileConfig } from '../config/GameConfig';

/** Перемещение существующего тайла при гравитации. */
export interface TileMove {
    tile: TileModel;
    fromY: number;
    toY: number;
}

/** Новый тайл, созданный для заполнения пустот сверху. */
export interface TileSpawn {
    tile: TileModel;
    /** Строка, с которой тайл начинает падение (над верхней границей поля). */
    spawnY: number;
}

export interface TilesRemovedPayload {
    tiles: TileModel[];
}

export interface TilesMovedPayload {
    moves: TileMove[];
}

export interface TilesSpawnedPayload {
    tiles: TileSpawn[];
    /** true — первичная генерация поля (без анимации падения). */
    initial: boolean;
}

/** Супер-тайл появился на месте клика (после сгорания достаточно большой группы). */
export interface SuperTileCreatedPayload {
    tile: TileModel;
    /** Клетка клика — место появления супер-тайла. */
    x: number;
    y: number;
}

/**
 * Чистая модель игрового поля: сетка тайлов, поиск группы (flood fill),
 * гравитация и заполнение пустот сверху. Не знает ни о движке, ни об отображении.
 *
 * Агрегирует события кликов тайлов (EVENT_TILE_CLICKED) и сообщает
 * об изменениях поля событиями, на которые подписывается визуальный слой.
 */
export class BoardModel extends EventEmitter {

    public static readonly EVENT_TILE_CLICKED = 'tileClicked';
    public static readonly EVENT_TILES_REMOVED = 'tilesRemoved';
    public static readonly EVENT_TILES_MOVED = 'tilesMoved';
    public static readonly EVENT_TILES_SPAWNED = 'tilesSpawned';
    public static readonly EVENT_SUPER_TILE_CREATED = 'superTileCreated';

    public readonly width: number;
    public readonly height: number;
    public readonly colorsCount: number;

    /** Функция генерации случайных чисел — инъекция для тестируемости. */
    private random: () => number;

    /**
     * Порог размера группы: если сгорело БОЛЬШЕ тайлов — на месте клика
     * появляется супер-тайл. Infinity (конфиг не задан) — механика выключена.
     */
    private superGroupThreshold: number;

    /** Радиус взрыва супер-тайла в клетках (Чебышёв: max(|dx|, |dy|) <= R). */
    private superBlastRadius: number;

    /** Сетка тайлов: grid[y][x], y = 0 — нижняя строка. */
    private grid: (TileModel | null)[][] = [];

    constructor(
        width: number,
        height: number,
        colorsCount: number,
        random: () => number = Math.random,
        superTile?: SuperTileConfig
    ) {
        super();
        this.width = width;
        this.height = height;
        this.colorsCount = colorsCount;
        this.random = random;
        this.superGroupThreshold = superTile ? superTile.groupThreshold : Number.POSITIVE_INFINITY;
        this.superBlastRadius = superTile ? Math.max(0, Math.floor(superTile.blastRadius)) : 0;
    }

    /** Первичная генерация поля. */
    public generate(): void {
        this.grid = [];
        const tiles: TileSpawn[] = [];
        for (let y = 0; y < this.height; y++) {
            const row: (TileModel | null)[] = [];
            for (let x = 0; x < this.width; x++) {
                const tile = this.createTile(x, y);
                row.push(tile);
                tiles.push({ tile: tile, spawnY: y });
            }
            this.grid.push(row);
        }
        this.emit(BoardModel.EVENT_TILES_SPAWNED, { tiles: tiles, initial: true } as TilesSpawnedPayload);
    }

    public isInside(x: number, y: number): boolean {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    public getTile(x: number, y: number): TileModel | null {
        if (!this.isInside(x, y)) {
            return null;
        }
        return this.grid[y][x];
    }

    /**
     * Поиск группы прилегающих тайлов того же цвета (BFS, 4 направления).
     * @returns группу тайлов или null, если группы из 2+ тайлов нет.
     */
    public findGroup(x: number, y: number): TileModel[] | null {
        const start = this.getTile(x, y);
        if (!start) {
            return null;
        }

        const colorIndex = start.colorIndex;
        const visited: boolean[][] = [];
        for (let row = 0; row < this.height; row++) {
            visited.push(new Array<boolean>(this.width));
        }

        const group: TileModel[] = [];
        const stack: TileModel[] = [start];
        visited[start.y][start.x] = true;

        while (stack.length > 0) {
            const tile = stack.pop();
            if (!tile) {
                break;
            }
            group.push(tile);

            const neighbors = [
                this.getTile(tile.x - 1, tile.y),
                this.getTile(tile.x + 1, tile.y),
                this.getTile(tile.x, tile.y - 1),
                this.getTile(tile.x, tile.y + 1)
            ];
            for (const neighbor of neighbors) {
                if (neighbor && !visited[neighbor.y][neighbor.x] && neighbor.colorIndex === colorIndex) {
                    visited[neighbor.y][neighbor.x] = true;
                    stack.push(neighbor);
                }
            }
        }

        return group.length >= 2 ? group : null;
    }

    /**
     * Сжигает группу тайлов, к которой принадлежит ячейка, и применяет гравитацию.
     *
     * Два сценария:
     * 1. Клик по супер-тайлу — взрыв: сжигаются все тайлы в радиусе R вокруг него.
     * 2. Клик по обычному тайлу — сгорает его цветовая группа; если группа
     *    БОЛЬШЕ порога N, на месте клика появляется супер-тайл.
     *
     * @returns сгоревшие тайлы или null, если клик не образует группу из 2+ тайлов.
     */
    public removeGroup(x: number, y: number): TileModel[] | null {
        const start = this.getTile(x, y);
        if (!start) {
            return null;
        }

        // Спец-тайл применяет свой эффект вместо обычного поиска группы:
        // логика эффекта принадлежит классу тайла, поле лишь выполняет её.
        if (start instanceof SuperTileModel) {
            return this.applyTileEffect(start);
        }

        const group = this.findGroup(x, y);
        if (!group) {
            return null;
        }

        for (const tile of group) {
            this.grid[tile.y][tile.x] = null;
        }
        this.emit(BoardModel.EVENT_TILES_REMOVED, { tiles: group } as TilesRemovedPayload);

        // Механика «супер-тайла»: достаточно большая группа оставляет бомбу на месте клика.
        if (group.length > this.superGroupThreshold) {
            this.spawnSuperTile(x, y);
        }

        this.applyGravity();
        return group;
    }

    /** Есть ли на поле хоть одна сжигаемая группа (2+ тайла одного цвета рядом). */
    public hasAvailableMoves(): boolean {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const tile = this.grid[y][x];
                if (!tile) {
                    continue;
                }
                // Супер-тайл взрывается в любой момент — ход всегда доступен.
                if (tile.isSuper) {
                    return true;
                }
                const right = this.getTile(x + 1, y);
                if (right && right.colorIndex === tile.colorIndex) {
                    return true;
                }
                const up = this.getTile(x, y + 1);
                if (up && up.colorIndex === tile.colorIndex) {
                    return true;
                }
            }
        }
        return false;
    }

    // ------------------------------------------------------------------
    // Внутренняя логика
    // ------------------------------------------------------------------

    /**
     * Гравитация: тайлы в каждом столбце опускаются вниз, пустоты сверху
     * заполняются новыми тайлами. Сообщает о перемещениях и появлении новых тайлов.
     */
    private applyGravity(): void {
        const moves: TileMove[] = [];
        const spawns: TileSpawn[] = [];

        for (let x = 0; x < this.width; x++) {
            // Уплотняем столбец вниз.
            let writeY = 0;
            for (let y = 0; y < this.height; y++) {
                const tile = this.grid[y][x];
                if (!tile) {
                    continue;
                }
                if (writeY !== y) {
                    const fromY = tile.y;
                    tile.y = writeY;
                    this.grid[writeY][x] = tile;
                    this.grid[y][x] = null;
                    moves.push({ tile: tile, fromY: fromY, toY: writeY });
                }
                writeY++;
            }

            // Заполняем освободившиеся верхние ячейки новыми тайлами.
            const newCount = this.height - writeY;
            for (let j = 0; j < newCount; j++) {
                const tile = this.createTile(x, writeY + j);
                this.grid[writeY + j][x] = tile;
                spawns.push({ tile: tile, spawnY: this.height + j });
            }
        }

        if (moves.length > 0) {
            this.emit(BoardModel.EVENT_TILES_MOVED, { moves: moves } as TilesMovedPayload);
        }
        if (spawns.length > 0) {
            this.emit(BoardModel.EVENT_TILES_SPAWNED, { tiles: spawns, initial: false } as TilesSpawnedPayload);
        }
    }

    private createTile(x: number, y: number): TileModel {
        const colorIndex = Math.floor(this.random() * this.colorsCount);
        const tile = new TileModel(x, y, colorIndex);
        this.attachClickForwarding(tile);
        return tile;
    }

    /** Создаёт супер-тайл на месте клика и сообщает об этом визуальному слою. */
    private spawnSuperTile(x: number, y: number): void {
        const tile = new SuperTileModel(x, y, this.superBlastRadius);
        this.attachClickForwarding(tile);
        this.grid[y][x] = tile;
        this.emit(BoardModel.EVENT_SUPER_TILE_CREATED, { tile: tile, x: x, y: y } as SuperTileCreatedPayload);
    }

    /**
     * Применяет эффект спец-тайла к полю: сам тайл меняет доску через
     * ExecuteEffect, поле сообщает визуальному слою о сгоревших тайлах
     * и применяет гравитацию.
     */
    private applyTileEffect(tile: SuperTileModel): TileModel[] {
        const burned = tile.ExecuteEffect(this);
        return burned;
    }

    /** Убирает перечисленные тайлы с поля (без событий и гравитации). */
    public clearTiles(tiles: TileModel[]): void {
        for (const tile of tiles) {
            if (this.isInside(tile.x, tile.y) && this.grid[tile.y][tile.x] === tile) {
                this.grid[tile.y][tile.x] = null;
            }
        }
        
        this.emit(BoardModel.EVENT_TILES_REMOVED, { tiles: tiles } as TilesRemovedPayload);
        this.applyGravity();
    }

    // Агрегируем событие клика тайла: подписчикам поля не нужно
    // обходить все тайлы — клик приходит одной транзакцией от поля.
    private attachClickForwarding(tile: TileModel): void {
        tile.on(TileModel.EVENT_CLICKED, (clickedTile: TileModel) => {
            this.emit(BoardModel.EVENT_TILE_CLICKED, clickedTile);
        });
    }
}
