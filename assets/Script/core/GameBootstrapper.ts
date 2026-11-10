import { GameConfigLoader } from '../config/GameConfigLoader';
import { GameConfig } from '../config/GameConfig';
import { TilePalette, TilePaletteLoader } from '../config/TilePalette';
import { BoardModel } from './BoardModel';
import { GameManager } from './GameManager';
import { BoardView } from '../view/BoardView';
import UiController from '../view/UiController';

/**
 * Composition root: единственное место, где создаются и связываются
 * компоненты core и view (DI вместо статиков и синглтонов).
 *
 * 1. Загружает и валидирует конфиг через GameConfigLoader.
 * 2. Создаёт core: BoardModel, GameManager (конфиг — через конструктор, DIP).
 * 3. Берёт BoardView-компонент из префаба BoardContainer.prefab (сериализованная
 *    ссылка на Tile.prefab задаётся в редакторе) и связывает его с моделью через init().
 * 4. Связывает слои через события: модель → view, GameManager → UiController.
 * 5. Связывает ввод: клик инициируется логикой тайла (TileView → TileModel →
 *    BoardModel) и транслируется в GameManager.
 */
export class GameBootstrapper {

    private boardView: BoardView;
    private ui: UiController;

    constructor(boardContainer: BoardView, ui: UiController) {
        this.boardView = boardContainer;
        this.ui = ui;
    }

    /** Точка запуска: загрузка конфига и палитры тайлов, затем сборка игры. */
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
                this.startGame(config, palette);
            });
        });
    }

    // ------------------------------------------------------------------
    // Сборка игры
    // ------------------------------------------------------------------

    private startGame(config: GameConfig, palette: TilePalette): void {
        if (!this.boardView.tilePrefab) {
            this.ui.showError(
                'У компонента BoardView не задан tilePrefab — укажите ссылку на ' +
                'prefab/Tile в инспекторе префаба BoardContainer.prefab.'
            );
            return;
        }

        // Core.
        const board = new BoardModel(config.board.width, config.board.height, config.board.colorsCount, Math.random, config.superTile);
        const game = new GameManager(board, config);

        // View (подписывается на события модели; тайлы спавнит из префаба).
        this.boardView.init(board, config.visual, palette, () => {
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
