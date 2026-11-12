import { TileModel } from '../core/TileModel';
import { TilePalette } from '../config/TilePalette';
import { TilePrefabs } from '../config/TilePrefabs';
import { TileView } from './TileView';
import { SuperTileView } from './SuperTileView';

/**
 * Фабрика тайлов: единственное место, где создаётся визуал тайла.
 *
 * SRP: инкапсулирует процесс сборки TileView — инстанцирование префаба,
 * установку размеров и привязку модели/палитры через TileView.init().
 * BoardView больше не знает, откуда берётся узел тайла, и содержит
 * только вызовы фабрики (create).
 *
 * Выбор префаба выполняется по data-ассету tile-prefabs.json (как выбор
 * спрайта — по палитре текстур tile-palette.json): фабрика сама определяет
 * вид тайла на основе модели (TileModel.isSuper) и берёт соответствующий
 * префаб из TilePrefabs. Обычной модели соответствует TileView из
 * Tile.prefab, модели SuperTileModel — SuperTileView из SuperTile.prefab.
 *
 * Конфиг передаётся через конструктор (DI из GameBootstrapper):
 * префабы живут в конфиге tile-prefabs.json, спрайты — в палитре
 * (tile-palette.json), размеры и контейнер — из визуального конфига.
 */

/** Конфигурация фабрики тайлов. */
export interface TileFactoryConfig {
    /** Конфигурация префабов по видам тайлов (data-ассет tile-prefabs.json). */
    prefabs: TilePrefabs;
    /** Палитра со спрайтами тайлов (data-ассет tile-palette.json). */
    palette: TilePalette;
    /** Визуальный размер тайла в пикселях (из GameConfig.visual.tileSize). */
    tileSize: number;
    /** Узел-контейнер, в который добавляются созданные тайлы. */
    container: cc.Node;
}

export class TileFactory {

    /** Отношение визуального размера тайла к шагу сетки (зазор между тайлами). */
    private static readonly TILE_FILL: number = 0.9;

    private readonly config: TileFactoryConfig;

    public constructor(config: TileFactoryConfig) {
        if (!config) {
            throw new Error('TileFactory: конфигурация не передана.');
        }
        if (!config.prefabs) {
            throw new Error('TileFactory: не задана конфигурация префабов (TilePrefabs).');
        }
        if (!config.prefabs.getPrefab(TilePrefabs.KIND_DEFAULT)) {
            throw new Error('TileFactory: в конфигурации префабов отсутствует префаб вида "default" (prefab/Tile).');
        }
        if (!config.prefabs.getPrefab(TilePrefabs.KIND_SUPER)) {
            throw new Error('TileFactory: в конфигурации префабов отсутствует префаб вида "super" (prefab/SuperTile).');
        }
        if (!config.palette) {
            throw new Error('TileFactory: не задана палитра тайлов (TilePalette).');
        }
        if (!(config.tileSize > 0)) {
            throw new Error('TileFactory: tileSize должен быть положительным числом.');
        }
        if (!config.container) {
            throw new Error('TileFactory: не задан контейнер для тайлов.');
        }
        this.config = config;
    }

    /**
     * Создаёт визуал тайла по модели: определяет вид тайла, берёт
     * соответствующий префаб из конфигурации, инстанцирует его, привязывает
     * модель и палитру и добавляет узел в контейнер.
     */
    public create(tile: TileModel): TileView {
        // Выбор префаба по виду из конфигурации: SuperTileModel → вид "super"
        // (prefab с компонентом SuperTileView), обычная модель → вид "default".
        const kind = tile.isSuper ? TilePrefabs.KIND_SUPER : TilePrefabs.KIND_DEFAULT;
        const prefab = this.config.prefabs.getPrefab(kind);

        // Спавн через создание экземпляра префаба: узел и сериализованные
        // свойства view (sprite и т.п.) приходят из префаба.
        const node = cc.instantiate(prefab);
        node.setParent(this.config.container);
        node.setContentSize(
            this.config.tileSize * TileFactory.TILE_FILL,
            this.config.tileSize * TileFactory.TILE_FILL
        );

        const view = tile.isSuper
            ? node.getComponent(SuperTileView) as TileView
            : node.getComponent(TileView);
        view.init(tile, this.config.palette);
        return view;
    }
}
