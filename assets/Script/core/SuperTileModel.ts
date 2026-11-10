import { TileModel } from './TileModel';
import { BoardModel } from './BoardModel';

/**
 * Супер-тайл (бомба): появляется на месте клика после сгорания достаточно
 * большой группы; по клику сжигает тайлы в радиусе.
 *
 * SRP/OCP: логика эффекта принадлежит самому тайлу — ExecuteEffect(board)
 * изменяет переданную доску, а не дублируется в BoardModel. Новые спец-тайлы
 * добавляются наследниками TileModel со своим ExecuteEffect, без изменения
 * кода поля (Open/Closed).
 */
export class SuperTileModel extends TileModel {

    /** «Цвет» супер-тайла: гарантированно не совпадает ни с одним обычным цветом. */
    public static readonly COLOR_INDEX = -1;

    /** Радиус взрыва в клетках (Чебышёв: max(|dx|, |dy|) <= R). */
    public readonly blastRadius: number;

    /** Признак спец-тайла (переопределяет базовое значение TileModel). */
    public readonly isSuper: boolean = true;

    constructor(x: number, y: number, blastRadius: number) {
        super(x, y, SuperTileModel.COLOR_INDEX);
        this.blastRadius = blastRadius;
    }

    /**
     * Эффект тайла: сжигает все тайлы в радиусе вокруг себя, включая самого себя.
     * Меняет переданную доску напрямую (через BoardModel.clearTiles);
     * гравитация и события поля остаются ответственностью BoardModel.
     * @returns список сгоревших тайлов.
     */
    public ExecuteEffect(board: BoardModel): TileModel[] {
        const burned: TileModel[] = [];
        const radius = this.blastRadius;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const target = board.getTile(this.x + dx, this.y + dy);
                if (target) {
                    burned.push(target);
                }
            }
        }
        board.clearTiles(burned);
        return burned;
    }
}
