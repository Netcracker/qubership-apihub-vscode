export enum PublishErrorTypes {
    ERROR = 'error',
    INFO = 'info'
}

export class PublishError extends Error {
    constructor(
        readonly message: string,
        readonly type: PublishErrorTypes,
        readonly buttonName?: string,
        readonly link?: string
    ) {
        super(message);
    }
}
