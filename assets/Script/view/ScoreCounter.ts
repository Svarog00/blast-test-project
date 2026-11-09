const { ccclass, property } = cc._decorator;

/**
 * Счётчик очков (SRP — только отображение текущих очков и цели).
 * Значения выставляются через @property-ссылки в редакторе, без getComponent.
 */
@ccclass
export default class ScoreCounter extends cc.Component {

    @property(cc.Label)
    label: cc.Label = null;

    private currentScore: number = 0;
    private targetScore: number = 0;

    public setTarget(targetScore: number): void {
        this.targetScore = targetScore;
        this.refresh();
    }

    public setScore(score: number): void {
        this.currentScore = score;
        this.refresh();
    }

    private refresh(): void {
        if (this.label) {
            this.label.string = 'Score: ' + this.currentScore + ' / ' + this.targetScore;
        }
    }
}
