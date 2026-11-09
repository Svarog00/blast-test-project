import { EventEmitter } from './EventEmitter';
import { BoardModel } from './BoardModel';
import { GameConfig } from '../config/GameConfig';

/** Состояния игрового процесса. Ввод разрешён только в Idle. */
export enum GameState {
    Idle = 0,
    Animating = 1,
    Won = 2,
    Lost = 3
}

export interface GameLostPayload {
    reason: 'outOfMoves' | 'noMoves';
}

/**
 * Правила игры: ходы, очки, условия победы/поражения (SRP — только правила).
 * Не знает ни о движке, ни об отображении, ни о вводе: клики приходят
 * извне (связывание выполняет GameBootstrapper), зависимость — только
 * BoardModel и конфиг (DIP).
 */
export class GameManager extends EventEmitter {

    public static readonly EVENT_STATE_CHANGED = 'stateChanged';
    public static readonly EVENT_SCORE_CHANGED = 'scoreChanged';
    public static readonly EVENT_MOVES_CHANGED = 'movesChanged';
    public static readonly EVENT_GAME_WON = 'gameWon';
    public static readonly EVENT_GAME_LOST = 'gameLost';

    private board: BoardModel;
    private config: GameConfig;

    private scoreValue: number = 0;
    private movesLeftValue: number;
    private stateValue: GameState = GameState.Idle;

    constructor(board: BoardModel, config: GameConfig) {
        super();
        this.board = board;
        this.config = config;
        this.movesLeftValue = config.goal.movesLimit;
    }

    public get score(): number {
        return this.scoreValue;
    }

    public get movesLeft(): number {
        return this.movesLeftValue;
    }

    public get state(): GameState {
        return this.stateValue;
    }

    /** Начало сессии: публикует начальные значения очков и ходов. */
    public start(): void {
        this.emitState();
        this.emitScore();
        this.emitMoves();
    }

    /**
     * Обработка клика по тайлу.
     * @returns true, если ход принят (группа из 2+ тайлов сгорела).
     */
    public handleTileClick(x: number, y: number): boolean {
        if (this.stateValue !== GameState.Idle) {
            return false;
        }

        const group = this.board.removeGroup(x, y);
        if (!group) {
            return false;
        }

        this.stateValue = GameState.Animating;
        this.emitState();

        this.scoreValue += this.calculateScore(group.length);
        this.emitScore();

        this.movesLeftValue -= 1;
        this.emitMoves();

        return true;
    }

    /**
     * Завершение анимаций хода: проверка цели, лимита ходов
     * и наличия доступных групп.
     */
    public onAnimationsCompleted(): void {
        if (this.stateValue !== GameState.Animating) {
            return;
        }

        if (this.scoreValue >= this.config.goal.targetScore) {
            this.finish(GameState.Won);
            return;
        }
        if (this.movesLeftValue <= 0) {
            this.finish(GameState.Lost, 'outOfMoves');
            return;
        }
        if (!this.board.hasAvailableMoves()) {
            this.finish(GameState.Lost, 'noMoves');
            return;
        }

        this.stateValue = GameState.Idle;
        this.emitState();
    }

    // ------------------------------------------------------------------
    // Внутренняя логика
    // ------------------------------------------------------------------

    /**
     * Формула очков (Open/Closed: параметры — из конфига):
     * score = basePerTile * n + chainBonusMultiplier * n * (n - 1)
     */
    protected calculateScore(groupSize: number): number {
        const scoring = this.config.scoring;
        return scoring.basePerTile * groupSize + scoring.chainBonusMultiplier * groupSize * (groupSize - 1);
    }

    private finish(state: GameState, reason?: 'outOfMoves' | 'noMoves'): void {
        this.stateValue = state;
        this.emitState();

        if (state === GameState.Won) {
            this.emit(GameManager.EVENT_GAME_WON);
        } else {
            this.emit(GameManager.EVENT_GAME_LOST, { reason: reason } as GameLostPayload);
        }
    }

    private emitState(): void {
        this.emit(GameManager.EVENT_STATE_CHANGED, this.stateValue);
    }

    private emitScore(): void {
        this.emit(GameManager.EVENT_SCORE_CHANGED, this.scoreValue);
    }

    private emitMoves(): void {
        this.emit(GameManager.EVENT_MOVES_CHANGED, this.movesLeftValue);
    }
}
