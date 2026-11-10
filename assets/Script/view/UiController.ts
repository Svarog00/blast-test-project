import ScoreCounter from './ScoreCounter';
import MovesCounter from './MovesCounter';
import ResultScreen from './ResultScreen';
import { GameManager, GameLostPayload } from '../core/GameManager';
import { GameConfig } from '../config/GameConfig';

const { ccclass, property } = cc._decorator;

/**
 * Контроллер интерфейса (SRP — только связывание состояния GameManager с UI).
 * Не содержит игровой логики; ссылки на счётчики задаются через @property
 * в редакторе (без getComponent), подписка выполняется через bindGame.
 */
@ccclass
export default class UiController extends cc.Component {

    @property(ScoreCounter)
    scoreCounter: ScoreCounter = null;

    @property(MovesCounter)
    movesCounter: MovesCounter = null;

    @property(ResultScreen)
    resultScreen: ResultScreen = null;

    /** Подписка на события GameManager (связывание выполняет GameBootstrapper). */
    public bindGame(game: GameManager, config: GameConfig): void {
        this.scoreCounter.setTarget(config.goal.targetScore);

        game.on(GameManager.EVENT_SCORE_CHANGED, (score: number) => {
            this.scoreCounter.setScore(score);
        });
        game.on(GameManager.EVENT_MOVES_CHANGED, (moves: number) => {
            this.movesCounter.setMoves(moves);
        });
        game.on(GameManager.EVENT_GAME_WON, () => {
            this.resultScreen.show('You Win!');
        });
        game.on(GameManager.EVENT_GAME_LOST, (payload: GameLostPayload) => {
            this.resultScreen.show('You Lose!');
        });

        this.scoreCounter.setScore(game.score);
        this.movesCounter.setMoves(game.movesLeft);

        this.resultScreen.hide();
    }

    /** Экран ошибки конфигурации — игра не стартует. */
    public showError(message: string): void {
        this.resultScreen.showError(message);
    }
}
