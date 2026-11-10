import { GameBootstrapper } from './core/GameBootstrapper';
import { BoardView } from './view/BoardView';
import UiController from './view/UiController';

const { ccclass, property } = cc._decorator;

/**
 * Тонкая точка входа на сцене (SRP): только делегирует запуск GameBootstrapper.
 * Ссылки на узлы/компоненты приходят из редактора через @property.
 */
@ccclass
export default class GameController extends cc.Component {

    /** Контейнер, в который BoardView складывает тайлы. */
    @property(BoardView)
    boardContainer: BoardView = null;

    @property(UiController)
    uiController: UiController = null;

    protected start(): void {
        new GameBootstrapper(this.boardContainer, this.uiController).bootstrap();
    }
}
