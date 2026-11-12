import { GameConfigLoader } from '../config/GameConfigLoader';
import { GameConfig } from '../config/GameConfig';
import { TilePalette, TilePaletteLoader } from '../config/TilePalette';
import { TilePrefabs, TilePrefabsLoader } from '../config/TilePrefabs';
import { BoardModel } from './BoardModel';
import { GameManager } from './GameManager';
import { BoardView } from '../view/BoardView';
import { TileFactory } from '../view/TileFactory';
import UiController from '../view/UiController';

/**
 * Composition root: единственное место, где создаются и связываются
 * компоненты core и view (DI вместо статиков и синглтонов).
 *
 * 1. Загружает и валидирует конфиг через GameConfigLoader.
 * 2. Создаёт core: BoardModel, GameManager (конфиг — через конструктор, DIP).
 * 3. Загружает data-ассеты префабов (tile-prefabs.json) и спрайтов тайлов
 *    (tile-palette.json), собирает из них TileFactory.
 * 4. Берёт BoardView-компонент из префаба BoardContainer.prefab и связывает
 *    его с моделью через init().
 * 5. Связывает слои через события: модель → view, GameManager → UiController.
 * 6. Связывает ввод: клик инициируется логикой тайла (TileView → TileModel →
 *    BoardModel) и транслируется в GameManager.
 */
export class GameBootstrapper {

    private boardView: BoardView;
    private ui: UiController;

    constructor(boardContainer: BoardView, ui: UiController) {
        this.boardView = boardContainer;
        this.ui = ui;
    }

    /** Точка запуска: загрузка конфига, палитры и префабов тайлов, затем сборка игры. */
    public bootstrap(): void {
        new GameConfigLoader().load((config: GameConfig | null, error: string | null) => {
            if (!config) {
                this.ui.showError(error || 'Неизвестная ошибка конфигурации.');
                return;
            }
            new TilePaletteLoader().load(config.board.colorsCount, (palette: TilePalette | null, paletteError: string | null) => {
                if (!palette) {
                    this.ui.showError(paletteError || 'Неизвестная ошибка палитры тайлов.');
                    return;
                }
                new TilePrefabsLoader().load((prefabs: TilePrefabs | null, prefabsError: string | null) => {
                    if (!prefabs) {
                        this.ui.showError(prefabsError || 'Неизвестная ошибка конфигурации префабов тайлов.');
                        return;
                    }
                    this.startGame(config, palette, prefabs);
                });
            });
        });
    }

    // ------------------------------------------------------------------
    // Сборка игры
    // ------------------------------------------------------------------

    private startGame(config: GameConfig, palette: TilePalette, prefabs: TilePrefabs): void {
        // Фабрика тайлов: собирается здесь (composition root) из конфигурации
        // префабов (tile-prefabs.json), палитры спрайтов (tile-palette.json)
        // и визуального конфига. Какой префаб использовать для конкретного
        // тайла, фабрика решает сама — по модели (TileModel.isSuper).
        const tileFactory = new TileFactory({
            prefabs: prefabs,
            palette: palette,
            tileSize: config.visual.tileSize,
            container: this.boardView.containerNode
        });

        // Core.
        const board = new BoardModel(config.board.width, config.board.height, config.board.colorsCount, Math.random, config.superTile);
        const game = new GameManager(board, config);

        // View (подписывается на события модели; тайлы создаёт TileFactory).
        this.boardView.init(board, config.visual, tileFactory, () => {
            game.onAnimationsCompleted();
        });
        this.ui.bindGame(game, config);

        // Ввод: TileView → TileModel.click() → BoardModel.EVENT_TILE_CLICKED → GameManager.
        board.on(BoardModel.EVENT_TILE_CLICKED, (tile: { x: number; y: number }) => {
            game.handleTileClick(tile.x, tile.y);
        });

        // Запуск сессии.
        this.generatePlayableBoard(board);
        game.start();
    }

    /** Генерирует поле, гарантированно содержащее хотя бы одну доступную группу. */
    private generatePlayableBoard(board: BoardModel): void {
        board.generate();
        let attempts = 1;
        while (!board.hasAvailableMoves() && attempts < 100) {
            board.generate();
            attempts++;
        }
    }
}
