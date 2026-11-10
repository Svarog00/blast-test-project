import { GameConfig, BoardConfig, GoalConfig, ScoringConfig, SuperTileConfig, VisualConfig } from './GameConfig';

/**
 * Загружает игровой конфиг из resources и валидирует его.
 *
 * Единственное место, где конфигурация зависит от способа доставки
 * (cc.resources / cc.JsonAsset). Чистая логика получает уже
 * провалидированный типизированный GameConfig.
 */
export class GameConfigLoader {

    /** Путь до конфига внутри бандла resources. */
    private static readonly CONFIG_PATH = 'config/game-config';

    /**
     * Асинхронно загружает конфиг.
     * @param onComplete вызывается один раз: (config, null) при успехе либо (null, сообщение об ошибке).
     */
    public load(onComplete: (config: GameConfig | null, error: string | null) => void): void {
        cc.resources.load(GameConfigLoader.CONFIG_PATH, cc.JsonAsset, (err: Error | null, asset: cc.JsonAsset) => {
            if (err || !asset) {
                onComplete(null, `Не удалось загрузить "${GameConfigLoader.CONFIG_PATH}": ${err ? err.message : 'ресурс не найден'}`);
                return;
            }
            try {
                onComplete(this.validate(asset.json), null);
            } catch (e) {
                onComplete(null, (e as Error).message);
            }
        });
    }

    /**
     * Валидирует «сырые» данные конфига. Чистая функция — легко тестируется.
     * @throws Error с понятным сообщением, указывающим некорректное поле.
     */
    public validate(raw: unknown): GameConfig {
        if (raw === null || typeof raw !== 'object') {
            throw new Error('GameConfig: конфиг должен быть JSON-объектом.');
        }
        const data = raw as Record<string, unknown>;

        const board = this.readSection(data, 'board');
        const goal = this.readSection(data, 'goal');
        const scoring = this.readSection(data, 'scoring');
        const superTile = this.readSection(data, 'superTile');
        const visual = this.readSection(data, 'visual');

        const width = this.readPositiveInt(board, 'width', 'board');
        const height = this.readPositiveInt(board, 'height', 'board');
        const colorsCount = this.readPositiveInt(board, 'colorsCount', 'board');
        if (colorsCount < 2) {
            throw new Error('GameConfig: поле "board.colorsCount" должно быть не меньше 2.');
        }

        const targetScore = this.readPositiveNumber(goal, 'targetScore', 'goal');
        const movesLimit = this.readPositiveInt(goal, 'movesLimit', 'goal');

        const basePerTile = this.readPositiveNumber(scoring, 'basePerTile', 'scoring');
        const chainBonusMultiplier = this.readNonNegativeNumber(scoring, 'chainBonusMultiplier', 'scoring');

        const groupThreshold = this.readPositiveInt(superTile, 'groupThreshold', 'superTile');
        const blastRadius = Math.floor(this.readNonNegativeNumber(superTile, 'blastRadius', 'superTile'));

        const tileSize = this.readPositiveNumber(visual, 'tileSize', 'visual');
        const animBurnDuration = this.readNonNegativeNumber(visual, 'animBurnDuration', 'visual');
        const animFallDuration = this.readNonNegativeNumber(visual, 'animFallDuration', 'visual');

        return {
            board: { width, height, colorsCount } as BoardConfig,
            goal: { targetScore, movesLimit } as GoalConfig,
            scoring: { basePerTile, chainBonusMultiplier } as ScoringConfig,
            superTile: { groupThreshold, blastRadius } as SuperTileConfig,
            visual: { tileSize, animBurnDuration, animFallDuration } as VisualConfig
        };
    }

    // ------------------------------------------------------------------
    // Вспомогательные методы валидации
    // ------------------------------------------------------------------

    private readSection(data: Record<string, unknown>, name: string): Record<string, unknown> {
        const section = data[name];
        if (section === null || typeof section !== 'object') {
            throw new Error(`GameConfig: отсутствует или некорректна секция "${name}".`);
        }
        return section as Record<string, unknown>;
    }

    private readPositiveInt(section: Record<string, unknown>, field: string, sectionName: string): number {
        const value = this.readNumber(section, field, sectionName);
        if (!Number.isInteger(value) || value <= 0) {
            throw new Error(`GameConfig: поле "${sectionName}.${field}" должно быть целым числом больше 0 (получено: ${value}).`);
        }
        return value;
    }

    private readPositiveNumber(section: Record<string, unknown>, field: string, sectionName: string): number {
        const value = this.readNumber(section, field, sectionName);
        if (value <= 0) {
            throw new Error(`GameConfig: поле "${sectionName}.${field}" должно быть числом больше 0 (получено: ${value}).`);
        }
        return value;
    }

    private readNonNegativeNumber(section: Record<string, unknown>, field: string, sectionName: string): number {
        const value = this.readNumber(section, field, sectionName);
        if (value < 0) {
            throw new Error(`GameConfig: поле "${sectionName}.${field}" не может быть отрицательным (получено: ${value}).`);
        }
        return value;
    }

    private readNumber(section: Record<string, unknown>, field: string, sectionName: string): number {
        const value = section[field];
        if (typeof value !== 'number' || isNaN(value)) {
            throw new Error(`GameConfig: поле "${sectionName}.${field}" отсутствует или не является числом.`);
        }
        return value;
    }
}
