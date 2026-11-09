import { EventEmitter } from './EventEmitter';

/**
 * Данные и логика одного тайла: уникальный идентификатор, цвет,
 * координаты в сетке и событие клика.
 *
 * Триггер клика живёт в самой логике тайла: тайл сам сообщает о клике
 * событием, а не через внешние колбэки. Не знает ни о движке, ни об отображении.
 */
export class TileModel extends EventEmitter {

    /** Сквозной генератор уникальных идентификаторов тайлов. */
    private static nextId: number = 1;

    public static readonly EVENT_CLICKED = 'clicked';

    public readonly id: number;

    /** Столбец тайла (не меняется при падении — падение только по вертикали). */
    public readonly x: number;

    /** Строка тайла (0 — нижняя). Меняется при гравитации. */
    public y: number;

    public readonly colorIndex: number;

    constructor(x: number, y: number, colorIndex: number) {
        super();
        this.id = TileModel.nextId++;
        this.x = x;
        this.y = y;
        this.colorIndex = colorIndex;
    }

    /** Пользовательский клик по тайлу: тайл сам инициирует событие. */
    public click(): void {
        this.emit(TileModel.EVENT_CLICKED, this);
    }
}
