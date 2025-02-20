export type WebviewCommandName = string;
export type WebviewPayloadType = void | string | string[] | object;
export interface WebviewMessage<C extends WebviewCommandName, T extends WebviewPayloadType> {
    command: C;
    payload: T;
}