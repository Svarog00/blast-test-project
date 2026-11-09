const { ccclass, property } = cc._decorator;

/**
 * Экран результата: победа, поражение или ошибка конфигурации.
 * SRP — только отображение и перезапуск сессии.
 * Ссылки на узлы/компоненты задаются через @property в редакторе.
 */
@ccclass('ResultScreen')
export default class ResultScreen extends cc.Component {

    @property(cc.Label)
    label: cc.Label = null;

    @property(cc.Node)
    restartButton: cc.Node = null;

    protected start(): void {
        if (this.restartButton) {
            this.restartButton.on(cc.Node.EventType.TOUCH_END, this.onRestartClicked, this);
        }
    }

    public show(text: string): void {
        if (this.label) {
            this.label.string = text;
        }
        this.node.active = true;
    }

    /** Экран ошибки конфигурации — игра не стартует. */
    public showError(message: string): void {
        this.show('Config error:\n' + message);
    }

    public hide(): void {
        this.node.active = false;
    }

    private onRestartClicked(): void {
        cc.director.loadScene(cc.director.getScene().name);
    }
}
