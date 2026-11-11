import { TileView, getWhiteSpriteFrame } from './TileView';
import { TilePalette } from '../config/TilePalette';

const { ccclass, property } = cc._decorator;

/**
 * Визуал супер-тайла: компонент на узле из префаба SuperTile.prefab.
 *
 * SRP: вся логика, специфичная для супер-тайла, вынесена из TileView сюда —
 * выбор спрайта супер-тайла и анимация пульсации. Базовый TileView
 * отвечает только за обычный цветной тайл (спрайт по цвету и клик),
 * супер-специфика добавляется наследованием (Open/Closed).
 *
 * Параметры анимации задаются сериализованно в префабе SuperTile.prefab.
 */
@ccclass
export class SuperTileView extends TileView {

    /** Время увеличения супер-тайла до максимума (половина цикла пульса). */
    @property
    private superTileInAnimationTime: number = 0.45;

    /** Время уменьшения супер-тайла обратно к базовому масштабу. */
    @property
    private superTileOutAnimationTime: number = 0.45;

    /** Максимальный масштаб при пульсации супер-тайла. */
    @property
    private maxTileScaleAnimation: number = 1.12;

    private readonly defaultTileScale: number = 1.0;

    /**
     * Жизненный цикл: вызывается после активации узла на сцене — здесь
     * запускается анимация пульсации, чтобы твин шёл уже по «живому»
     * узлу, а не по ещё не вставленному в иерархию.
     */
    protected start(): void {
        this.startSuperPulse();
    }

    /**
     * Внешность супер-тайла: спрайт бомбы из палитры вместо спрайта цвета.
     * Переопределяет поведение базового TileView (который красит тайл по colorIndex).
     */
    protected updateAppearance(): void {
        this.setSuperSprite();
    }

    /** Спрайт супер-тайла из палитры; при отсутствии — тонировка резервным цветом. */
    private setSuperSprite(): void {
        if (!this.sprite) {
            return;
        }

        const kind = TilePalette.SPECIAL_SUPER;
        const frame = this.palette ? this.palette.getSpecialFrame(kind) : null;
        if (frame) {
            this.sprite.spriteFrame = frame;
            this.node.color = cc.Color.WHITE;
            return;
        }

        // Резерв: белая заглушка, тонированная резервным цветом спец-тайла.
        this.sprite.spriteFrame = getWhiteSpriteFrame();
        const fallback = this.palette ? this.palette.getSpecialFallbackColor(kind) : null;
        this.node.color = fallback || cc.Color.WHITE;
    }

    /** Пульсация супер-тайла — визуальное выделение; останавливается при сгорании (stopAllByTarget). */
    private startSuperPulse(): void {
        cc.tween(this.node)
            .repeatForever(
                cc.tween()
                    .to(this.superTileInAnimationTime, { scale: this.maxTileScaleAnimation })
                    .to(this.superTileOutAnimationTime, { scale: this.defaultTileScale })
            )
            .start();
    }
}
