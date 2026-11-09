/**
 * Минималистичный событийный хаб для чистого ядра игры.
 *
 * Ядро не зависит от движка (cc.EventTarget не используется),
 * связь с визуальным слоем строится только на событиях.
 */
export type EventHandler = (payload?: any) => void;

export class EventEmitter {

    private handlers: { [event: string]: EventHandler[] } = {};

    public on(event: string, handler: EventHandler): void {
        if (!this.handlers[event]) {
            this.handlers[event] = [];
        }
        this.handlers[event].push(handler);
    }

    public off(event: string, handler: EventHandler): void {
        const list = this.handlers[event];
        if (!list) {
            return;
        }
        const index = list.indexOf(handler);
        if (index >= 0) {
            list.splice(index, 1);
        }
    }

    protected emit(event: string, payload?: any): void {
        const list = this.handlers[event];
        if (!list) {
            return;
        }
        const snapshot = list.slice();
        for (const handler of snapshot) {
            handler(payload);
        }
    }
}
