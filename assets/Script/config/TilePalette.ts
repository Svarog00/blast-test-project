/**
 * Аналог Unity ScriptableObject: данные палитры тайлов живут в отдельном
 * ассете (resources/config/tile-palette.json) и загружаются во время игры.
 *
 * TilePalette — типизированная обёртка над данными ассета: даёт view-слою
 * доступ к спрайту по индексу цвета, не раскрывая способ хранения.
 * TilePaletteLoader — единственное место, зависящее от способа доставки
 * (cc.resources / cc.JsonAsset / cc.SpriteFrame), по образцу GameConfigLoader.
 */

/** Запись палитры: индекс цвета, путь до спрайта и резервный цвет тонировки. */
export interface TileSpriteEntry {
    colorIndex: number;
    /** Путь спрайта внутри бандла resources (без расширения). */
    sprite: string;
    /** HEX-цвет резервной тонировки, если спрайт не загрузился. */
    color: string;
}

/** «Сырые» данные ассета tile-palette.json. */
export interface TilePaletteData {
    tiles: TileSpriteEntry[];
}

/** Готовая к использованию палитра: colorIndex → SpriteFrame. */
export class TilePalette {

    private frames: Map<number, cc.SpriteFrame> = new Map<number, cc.SpriteFrame>();
    private colors: Map<number, cc.Color> = new Map<number, cc.Color>();

    public constructor(entries: TileSpriteEntry[], frames: Map<number, cc.SpriteFrame>) {
        for (const entry of entries) {
            const frame = frames.get(entry.colorIndex) || null;
            if (frame) {
                this.frames.set(entry.colorIndex, frame);
            }
            this.colors.set(entry.colorIndex, new cc.Color().fromHEX(entry.color));
        }
    }

    /** Спрайт, соответствующий цвету тайла (или null, если не найден). */
    public getFrame(colorIndex: number): cc.SpriteFrame | null {
        return this.frames.get(colorIndex) || null;
    }

    /** Резервный цвет тонировки для colorIndex (используется, когда спрайта нет). */
    public getFallbackColor(colorIndex: number): cc.Color | null {
        return this.colors.get(colorIndex) || null;
    }

    /** Количество цветов в палитре. */
    public get size(): number {
        return this.colors.size;
    }
}

export class TilePaletteLoader {

    /** Путь до data-ассета палитры внутри бандла resources. */
    private static readonly PALETTE_PATH = 'config/tile-palette';

    /**
     * Асинхронно загружает data-ассет палитры и все спрайты из него.
     * @param requiredColors минимально необходимое число цветов (из GameConfig).
     * @param onComplete вызывается один раз: (palette, null) при успехе либо (null, ошибка).
     */
    public load(requiredColors: number, onComplete: (palette: TilePalette | null, error: string | null) => void): void {
        cc.resources.load(TilePaletteLoader.PALETTE_PATH, cc.JsonAsset, (err: Error | null, asset: cc.JsonAsset) => {
            if (err || !asset) {
                onComplete(null, `Не удалось загрузить "${TilePaletteLoader.PALETTE_PATH}": ${err ? err.message : 'ресурс не найден'}`);
                return;
            }
            try {
                const entries = this.validate(asset.json, requiredColors);
                this.loadFrames(entries, onComplete);
            } catch (e) {
                onComplete(null, (e as Error).message);
            }
        });
    }

    // ------------------------------------------------------------------
    // Валидация данных ассета
    // ------------------------------------------------------------------

    /** Чистая функция-валидатор: проверяет структуру и покрытие requiredColors. */
    private validate(raw: unknown, requiredColors: number): TileSpriteEntry[] {
        if (raw === null || typeof raw !== 'object') {
            throw new Error('TilePalette: ассет должен быть JSON-объектом.');
        }
        const data = raw as Record<string, unknown>;
        const tiles = data['tiles'];
        if (!Array.isArray(tiles) || tiles.length === 0) {
            throw new Error('TilePalette: отсутствует или пуст массив "tiles".');
        }

        const seen: Set<number> = new Set<number>();
        const entries: TileSpriteEntry[] = [];
        for (const item of tiles) {
            if (item === null || typeof item !== 'object') {
                throw new Error('TilePalette: элемент массива "tiles" должен быть объектом.');
            }
            const record = item as Record<string, unknown>;
            const colorIndex = record['colorIndex'];
            const sprite = record['sprite'];
            const color = record['color'];
            if (typeof colorIndex !== 'number' || !Number.isInteger(colorIndex) || colorIndex < 0) {
                throw new Error('TilePalette: поле "colorIndex" должно быть целым числом >= 0.');
            }
            if (typeof sprite !== 'string' || sprite.length === 0) {
                throw new Error(`TilePalette: запись colorIndex=${colorIndex} — поле "sprite" должно быть непустой строкой.`);
            }
            if (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
                throw new Error(`TilePalette: запись colorIndex=${colorIndex} — поле "color" должно быть HEX-цветом вида #RRGGBB.`);
            }
            if (seen.has(colorIndex)) {
                throw new Error(`TilePalette: дубликат colorIndex=${colorIndex}.`);
            }
            seen.add(colorIndex);
            entries.push({ colorIndex, sprite, color });
        }

        for (let i = 0; i < requiredColors; i++) {
            if (!seen.has(i)) {
                throw new Error(`TilePalette: палитра не покрывает colorIndex=${i} (в конфиге board.colorsCount=${requiredColors}).`);
            }
        }
        return entries;
    }

    // ------------------------------------------------------------------
    // Загрузка спрайтов
    // ------------------------------------------------------------------

    /** Параллельно грузит все SpriteFrame; ошибки загрузки не фатальны — сработает резервный цвет. */
    private loadFrames(entries: TileSpriteEntry[], onComplete: (palette: TilePalette | null, error: string | null) => void): void {
        const frames: Map<number, cc.SpriteFrame> = new Map<number, cc.SpriteFrame>();
        let pending = entries.length;
        if (pending === 0) {
            onComplete(new TilePalette(entries, frames), null);
            return;
        }

        for (const entry of entries) {
            cc.resources.load(entry.sprite, cc.SpriteFrame, (err: Error | null, frame: cc.SpriteFrame) => {
                if (err || !frame) {
                    cc.warn(`TilePalette: спрайт "${entry.sprite}" не загружен (${err ? err.message : 'не найден'}), будет использована тонировка ${entry.color}.`);
                } else {
                    frames.set(entry.colorIndex, frame);
                }
                pending--;
                if (pending === 0) {
                    onComplete(new TilePalette(entries, frames), null);
                }
            });
        }
    }
}
