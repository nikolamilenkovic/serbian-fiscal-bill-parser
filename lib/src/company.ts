export class Company {
    pib: string | null;
    name: string | null;
    city: string | null;
    address: string | null;
    municipality: string | null;

    constructor(init?: Partial<Company>) {
        Object.assign(this, init);
    }
}