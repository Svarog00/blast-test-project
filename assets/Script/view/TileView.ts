import { TileModel } from '../core/TileModel';
import { TilePalette } from '../config/TilePalette';

const { ccclass, property } = cc._decorator;

/**
 * Визуал одного тайла: компонент на узле из префаба Tile.prefab.
 *
 * SRP: перехват и первичная обработка клика — ответственность TileView
 * (метод handleClick). Никакой игровой логики: клик передаётся логике
 * самого тайла (TileModel.click()), дальше событие уходит в модель поля.
 *
 * Внешность тайла определяется в защищённом методе updateAppearance():
 * базовый класс красит тайл по colorIndex; специфичную для спец-тайлов
 * внешность добавляют наследники (например SuperTileView — спрайт бомбы
 * и пульсация), переопределяя этот метод (Open/Closed).
 *
 * Зависимости берутся из сериализованных свойств (заполняются в префабе
 * в редакторе): cc.Sprite берётся из @property, а не через getComponent.
 * Модель и палитра приходят извне через init() — их сериализовать нельзя
 * (они создаются в рантайме).
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

@ccclass
export class TileView extends cc.Component {

    /** Спрайт тайла — ссылка задаётся сериализованно в префабе (без getComponent). */
    @property(cc.Sprite)
    protected sprite: cc.Sprite = null;

    protected tile: TileModel | null = null;
    protected palette: TilePalette | null = null;

    /**
     * Привязка модели и палитры; выполняется BoardView (через TileFactory)
     * сразу после Instantiate экземпляра префаба.
     */
    public init(tile: TileModel, palette: TilePalette): void {
        this.tile = tile;
        this.palette = palette;

        this.updateAppearance();

        this.node.off(cc.Node.EventType.TOUCH_END, this.handleClick, this);
        this.node.on(cc.Node.EventType.TOUCH_END, this.handleClick, this);
    }

    /**
     * Внешность тайла по модели. Базовая реализация — спрайт цвета тайла;
     * наследники (спец-тайлы) переопределяют под своё поведение.
     */
    protected updateAppearance(): void {
        this.setColorIndex(this.tile.colorIndex);
    }

    /** Выбор спрайта, соответствующего цвету тайла; при отсутствии — тонировка. */
    public setColorIndex(colorIndex: number): void {
        if (!this.sprite) {
            return;
        }

        const frame = this.palette ? this.palette.getFrame(colorIndex) : null;
        if (frame) {
            this.sprite.spriteFrame = frame;
            this.node.color = cc.Color.WHITE;
            return;
        }

        // Резерв: белая заглушка, тонированная цветом из палитры.
        this.sprite.spriteFrame = getWhiteSpriteFrame();
        const fallback = this.palette ? this.palette.getFallbackColor(colorIndex) : null;
        this.node.color = fallback || cc.Color.WHITE;
    }

    /** Обработка клика: инициирует событие в логике тайла. */
    private handleClick(): void {
        if (this.tile) {
            this.tile.click();
        }
    }
}
