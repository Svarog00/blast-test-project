import { TileModel } from '../core/TileModel';

/**
 * Визуал одного тайла: спрайт, окрашенный в цвет по индексу из модели.
 *
 * SRP: перехват и первичная обработка клика — ответственность TileView
 * (метод handleClick). Никакой игровой логики: клик передаётся логике
 * самого тайла (TileModel.click()), дальше событие уходит в модель поля.
 */

/** Палитра цветов тайлов (индекс = colorIndex из модели). */
const TILE_COLORS: cc.Color[] = [
    new cc.Color(74, 144, 226),   // синий
    new cc.Color(80, 200, 120),   // зелёный
    new cc.Color(231, 76, 60),    // красный
    new cc.Color(241, 196, 15),   // жёлтый
    new cc.Color(155, 89, 182)    // фиолетовый
];

let sharedWhiteFrame: cc.SpriteFrame | null = null;

/**
 * Единый белый спрайт-фрейм, генерируемый кодом.
 * Цвет тайла задаётся тонировкой (node.color), поэтому ассеты не требуются.
 */
export function getWhiteSpriteFrame(): cc.SpriteFrame {
    if (!sharedWhiteFrame) {
        const size = 4;
        const data = new Uint8Array(size * size * 4);
        for (let i = 0; i < data.length; i++) {
            data[i] = 255;
        }
        const texture = new cc.Texture2D();
        texture.initWithData(data, cc.Texture2D.PixelFormat.RGBA8888, size, size);
        sharedWhiteFrame = new cc.SpriteFrame(texture);
    }
    return sharedWhiteFrame;
}

export class TileView {

    public readonly node: cc.Node;
    private tile: TileModel;

    /**
     * @param parent родительский узел (контейнер поля)
     * @param size размер тайла в пикселях
     * @param tile модель тайла
     */
    constructor(parent: cc.Node, size: number, tile: TileModel) {
        this.tile = tile;

        this.node = new cc.Node('Tile_' + tile.id);
        this.node.setParent(parent);
        this.node.setContentSize(size, size);

        const sprite = this.node.addComponent(cc.Sprite);
        sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = getWhiteSpriteFrame();

        this.setColorIndex(tile.colorIndex);

        this.node.on(cc.Node.EventType.TOUCH_END, this.handleClick, this);
    }

    public setColorIndex(colorIndex: number): void {
        this.node.color = TILE_COLORS[colorIndex % TILE_COLORS.length];
    }

    /** Обработка клика: инициирует событие в логике тайла. */
    private handleClick(): void {
        this.tile.click();
    }
}
