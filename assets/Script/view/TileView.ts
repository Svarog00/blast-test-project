import { TileModel } from '../core/TileModel';
import { TilePalette } from '../config/TilePalette';

/**
 * Визуал одного тайла: спрайт, выбранный из палитры по индексу цвета модели.
 *
 * SRP: перехват и первичная обработка клика — ответственность TileView
 * (метод handleClick). Никакой игровой логики: клик передаётся логике
 * самого тайла (TileModel.click()), дальше событие уходит в модель поля.
 *
 * Спрайт приходит из TilePalette (data-ассет tile-palette.json — аналог
 * ScriptableObject). Если спрайт для цвета не найден, используется
 * резервная тонировка белой заглушки цветом из палитры.
 */

let sharedWhiteFrame: cc.SpriteFrame | null = null;

/**
 * Единый белый спрайт-фрейм, генерируемый кодом.
 * Используется как резерв, когда в палитре нет спрайта для цвета тайла.
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
    private palette: TilePalette;

    /**
     * @param parent родительский узел (контейнер поля)
     * @param size размер тайла в пикселях
     * @param tile модель тайла
     * @param palette палитра «цвет → спрайт» из data-ассета
     */
    constructor(parent: cc.Node, size: number, tile: TileModel, palette: TilePalette) {
        this.tile = tile;
        this.palette = palette;

        this.node = new cc.Node('Tile_' + tile.id);
        this.node.setParent(parent);
        this.node.setContentSize(size, size);

        const sprite = this.node.addComponent(cc.Sprite);
        sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = getWhiteSpriteFrame();

        this.setColorIndex(tile.colorIndex);

        this.node.on(cc.Node.EventType.TOUCH_END, this.handleClick, this);
    }

    /** Выбор спрайта, соответствующего цвету тайла; при отсутствии — тонировка. */
    public setColorIndex(colorIndex: number): void {
        const sprite = this.node.getComponent(cc.Sprite);
        if (!sprite) {
            return;
        }

        const frame = this.palette.getFrame(colorIndex);
        if (frame) {
            sprite.spriteFrame = frame;
            this.node.color = cc.Color.WHITE;
            return;
        }

        // Резерв: белая заглушка, тонированная цветом из палитры.
        sprite.spriteFrame = getWhiteSpriteFrame();
        const fallback = this.palette.getFallbackColor(colorIndex);
        this.node.color = fallback || cc.Color.WHITE;
    }

    /** Обработка клика: инициирует событие в логике тайла. */
    private handleClick(): void {
        this.tile.click();
    }
}
