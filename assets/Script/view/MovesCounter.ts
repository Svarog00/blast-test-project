const { ccclass, property } = cc._decorator;

/**
 * Счётчик оставшихся ходов (SRP — только отображение).
 * Значения выставляются через @property-ссылки в редакторе, без getComponent.
 */
@ccclass
export default class MovesCounter extends cc.Component {

    @property(cc.Label)
    label: cc.Label = null;

    public setMoves(moves: number): void {
        if (this.label) {
            this.label.string = 'Moves: ' + moves;
        }
    }
}
