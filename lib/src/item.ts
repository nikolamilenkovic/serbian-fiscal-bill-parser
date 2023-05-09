export class Item {
    name: string | null;
    measurementUnit: string | null;
    vatType: number | null;
    unitPrice: number | null;
    price: number | null;
    amount: number | null;

    constructor(init?: Partial<Item>) {
        Object.assign(this, init);
    }
}