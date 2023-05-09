export class Pos {
    id: string;
    name: string;

    constructor(init?: Partial<Pos>) {
        Object.assign(this, init);
    }
}