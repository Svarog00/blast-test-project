import { TileModel } from '../core/TileModel';
import { TilePalette } from '../config/TilePalette';
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
 * Фабрика содержит ссылки на оба префаба (обычный тайл и супер-тайл)
 * и сама выбирает, какой визуал создавать, на основе модели тайла
 * (TileModel.isSuper): обычной модели соответствует TileView из
 * Tile.prefab, модели SuperTileModel — SuperTileView из SuperTile.prefab.
 *
 * Конфиг передаётся через конструктор (DI из GameBootstrapper):
 * префабы задаются сериализованно в BoardView, спрайты живут в палитре
 * (data-ассет tile-palette.json), размеры и контейнер — из визуального конфига.
 */

/** Конфигурация фабрики тайлов. */
export interface TileFactoryConfig {
    /** Префаб обычного тайла (сериализованная ссылка из BoardView). */
    tilePrefab: cc.Prefab;
    /** Префаб супер-тайла (сериализованная ссылка из BoardView). */
    superTilePrefab: cc.Prefab;
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
        if (!config.tilePrefab) {
            throw new Error('TileFactory: не задан tilePrefab — укажите ссылку на prefab/Tile в инспекторе префаба BoardContainer.prefab.');
        }
        if (!config.superTilePrefab) {
            throw new Error('TileFactory: не задан superTilePrefab — укажите ссылку на prefab/SuperTile в инспекторе префаба BoardContainer.prefab.');
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
     * Создаёт визуал тайла по модели: выбирает префаб на основе модели
     * (обычный тайл или супер-тайл), инстанцирует его, привязывает модель
     * и палитру и добавляет узел в контейнер.
     */
    public create(tile: TileModel): TileView {
        // Выбор префаба по модели: SuperTileModel → SuperTile.prefab
        // (с компонентом SuperTileView), обычная модель → Tile.prefab.
        const prefab = tile.isSuper ? this.config.superTilePrefab : this.config.tilePrefab;

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
