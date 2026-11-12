/**
 * Аналог Unity ScriptableObject: соответствие «вид тайла → префаб» живёт в
 * отдельном data-ассете (resources/config/tile-prefabs.json) и загружается
 * во время игры — по образцу палитры текстур (TilePalette).
 *
 * TilePrefabs — типизированная обёртка над данными ассета: даёт фабрике тайлов
 * (TileFactory) доступ к cc.Prefab по виду (kind), не раскрывая способ хранения.
 * TilePrefabsLoader — единственное место, зависящее от способа доставки
 * (cc.resources / cc.JsonAsset / cc.Prefab), по образцу TilePaletteLoader.
 */

/** Запись конфига префабов: вид тайла и путь до префаба в resources. */
export interface TilePrefabEntry {
    /** Вид тайла; см. константы KIND_* в TilePrefabs. */
    kind: string;
    /** Путь префаба внутри бандла resources (без расширения). */
    prefab: string;
}

/** «Сырые» данные ассета tile-prefabs.json. */
export interface TilePrefabsData {
    tiles: TilePrefabEntry[];
}

/** Готовая к использованию конфигурация: kind → cc.Prefab. */
export class TilePrefabs {

    /** Вид обычного (не-специального) тайла. */
    public static readonly KIND_DEFAULT = 'default';

    /** Вид спец-тайла «супер-тайл» (бомба) — совпадает с видом в палитре. */
    public static readonly KIND_SUPER = 'super';

    private prefabs: Map<string, cc.Prefab> = new Map<string, cc.Prefab>();

    public constructor(entries: TilePrefabEntry[], prefabs: Map<string, cc.Prefab>) {
        for (const entry of entries) {
            const prefab = prefabs.get(entry.kind) || null;
            if (prefab) {
                this.prefabs.set(entry.kind, prefab);
            }
        }
    }

    /** Префаб, соответствующий виду тайла (или null, если не задан / не загрузился). */
    public getPrefab(kind: string): cc.Prefab | null {
        return this.prefabs.get(kind) || null;
    }

    /** Есть ли префаб для указанного вида. */
    public has(kind: string): boolean {
        return this.prefabs.has(kind);
    }

    /** Количество записей в конфигурации. */
    public get size(): number {
        return this.prefabs.size;
    }
}

export class TilePrefabsLoader {

    /** Путь до data-ассета конфигурации префабов внутри бандла resources. */
    private static readonly CONFIG_PATH = 'config/tile-prefabs';

    /** Обязательные виды: без них фабрика не сможет собрать поле. */
    private static readonly REQUIRED_KINDS: string[] = [TilePrefabs.KIND_DEFAULT, TilePrefabs.KIND_SUPER];

    /**
     * Асинхронно загружает data-ассет конфигурации и все префабы из него.
     * @param onComplete вызывается один раз: (prefabs, null) при успехе либо (null, ошибка).
     */
    public load(onComplete: (prefabs: TilePrefabs | null, error: string | null) => void): void {
        cc.resources.load(TilePrefabsLoader.CONFIG_PATH, cc.JsonAsset, (err: Error | null, asset: cc.JsonAsset) => {
            if (err || !asset) {
                onComplete(null, `Не удалось загрузить "${TilePrefabsLoader.CONFIG_PATH}": ${err ? err.message : 'ресурс не найден'}`);
                return;
            }
            try {
                const entries = this.validate(asset.json);
                this.loadPrefabs(entries, onComplete);
            } catch (e) {
                onComplete(null, (e as Error).message);
            }
        });
    }

    // ------------------------------------------------------------------
    // Валидация данных ассета
    // ------------------------------------------------------------------

    /** Чистая функция-валидатор: проверяет структуру и наличие обязательных видов. */
    private validate(raw: unknown): TilePrefabEntry[] {
        if (raw === null || typeof raw !== 'object') {
            throw new Error('TilePrefabs: ассет должен быть JSON-объектом.');
        }
        const data = raw as Record<string, unknown>;
        const tiles = data['tiles'];
        if (!Array.isArray(tiles) || tiles.length === 0) {
            throw new Error('TilePrefabs: отсутствует или пуст массив "tiles".');
        }

        const seen: Set<string> = new Set<string>();
        const entries: TilePrefabEntry[] = [];
        for (const item of tiles) {
            if (item === null || typeof item !== 'object') {
                throw new Error('TilePrefabs: элемент массива "tiles" должен быть объектом.');
            }
            const record = item as Record<string, unknown>;
            const kind = record['kind'];
            const prefab = record['prefab'];
            if (typeof kind !== 'string' || kind.length === 0) {
                throw new Error('TilePrefabs: поле "kind" должно быть непустой строкой.');
            }
            if (typeof prefab !== 'string' || prefab.length === 0) {
                throw new Error(`TilePrefabs: запись kind="${kind}" — поле "prefab" должно быть непустой строкой.`);
            }
            if (seen.has(kind)) {
                throw new Error(`TilePrefabs: дубликат вида тайла kind="${kind}".`);
            }
            seen.add(kind);
            entries.push({ kind, prefab });
        }

        for (const required of TilePrefabsLoader.REQUIRED_KINDS) {
            if (!seen.has(required)) {
                throw new Error(`TilePrefabs: конфигурация не содержит обязательный вид "${required}".`);
            }
        }

        return entries;
    }

    // ------------------------------------------------------------------
    // Загрузка префабов
    // ------------------------------------------------------------------

    /** Параллельно грузит все cc.Prefab из конфигурации; ошибки фатальны — тайл без префаба создать нельзя. */
    private loadPrefabs(entries: TilePrefabEntry[], onComplete: (prefabs: TilePrefabs | null, error: string | null) => void): void {
        const prefabs: Map<string, cc.Prefab> = new Map<string, cc.Prefab>();
        let pending = entries.length;
        if (pending === 0) {
            onComplete(new TilePrefabs(entries, prefabs), null);
            return;
        }

        let failed: string | null = null;
        const onOneLoaded = () => {
            pending--;
            if (pending === 0) {
                if (failed) {
                    onComplete(null, failed);
                } else {
                    onComplete(new TilePrefabs(entries, prefabs), null);
                }
            }
        };

        for (const entry of entries) {
            cc.resources.load(entry.prefab, cc.Prefab, (err: Error | null, prefab: cc.Prefab) => {
                if (err || !prefab) {
                    failed = `TilePrefabs: префаб "${entry.prefab}" (kind="${entry.kind}") не загружен (${err ? err.message : 'не найден'}).`;
                } else {
                    prefabs.set(entry.kind, prefab);
                }
                onOneLoaded();
            });
        }
    }
}
