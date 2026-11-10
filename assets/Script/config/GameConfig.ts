/**
 * Типизированная конфигурация игровых правил.
 *
 * Правила приходят извне (JSON-конфиг) и не захардкожены в игровой логике —
 * чистое ядро получает готовый провалидированный объект (Dependency Inversion).
 */

/** Параметры игрового поля (требования ТЗ: N x M, количество цветов). */
export interface BoardConfig {
    width: number;
    height: number;
    colorsCount: number;
}

/** Цель игры (требования ТЗ: набрать X очков за Y ходов). */
export interface GoalConfig {
    targetScore: number;
    movesLimit: number;
}

/** Параметры начисления очков (формула настраивается, логика — в GameManager). */
export interface ScoringConfig {
    basePerTile: number;
    chainBonusMultiplier: number;
}

/** Механика «супер-тайла»: большая группа оставляет бомбу, взрывающуюся по радиусу. */
export interface SuperTileConfig {
    /** Если размер сжигаемой группы БОЛЬШЕ этого значения — на месте клика появится супер-тайл. */
    groupThreshold: number;
    /** Радиус взрыва супер-тайла в клетках. */
    blastRadius: number;
}

/** Визуальные параметры: поле подстраивается под размеры из правил. */
export interface VisualConfig {
    tileSize: number;
    animBurnDuration: number;
    animFallDuration: number;
}

export interface GameConfig {
    board: BoardConfig;
    goal: GoalConfig;
    scoring: ScoringConfig;
    superTile: SuperTileConfig;
    visual: VisualConfig;
}
